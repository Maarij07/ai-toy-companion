/**
 * Gemini Live Relay Server
 *
 * Sits between the AI Toy mobile app and Vertex AI Live API.
 * Responsibilities:
 *  1. Authenticate the mobile client via Supabase JWT
 *  2. Mint a short-lived Vertex AI Bearer token using the GCP service account
 *  3. Open a Vertex AI Live WebSocket on behalf of the client
 *  4. Transparently proxy all JSON frames in both directions
 *  5. Log session events (start, end, errors) for compliance / audit
 *
 * Deploy to Cloud Run:
 *   gcloud run deploy gemini-live-relay \
 *     --source relay/ \
 *     --project ai-toy-toya \
 *     --region us-central1 \
 *     --set-env-vars SUPABASE_URL=...,SUPABASE_ANON_KEY=...,GOOGLE_SERVICE_ACCOUNT_JSON=...
 *
 * Required env vars:
 *   PORT                        (injected by Cloud Run, default 8080)
 *   SUPABASE_URL                (Supabase project URL)
 *   SUPABASE_ANON_KEY           (Supabase anon/public key — used to verify JWTs)
 *   GOOGLE_SERVICE_ACCOUNT_JSON (full JSON key for ai-toy-toya service account)
 *   VERTEX_PROJECT              (default: ai-toy-toya)
 *   VERTEX_LOCATION             (default: us-central1)
 *   VERTEX_MODEL                (default: gemini-2.5-flash-native-audio-preview-12-2025)
 */

'use strict';

const http    = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const { GoogleAuth }   = require('google-auth-library');

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT          = process.env.PORT || 8080;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const SA_JSON       = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const VERTEX_PROJECT  = process.env.VERTEX_PROJECT  || 'ai-toy-toya';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const VERTEX_MODEL    = process.env.VERTEX_MODEL
  || 'gemini-2.5-flash-native-audio-preview-12-2025';

const VERTEX_WS_URL =
  `wss://${VERTEX_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LLMUtilityService.BidiGenerateContent`;

// Full Vertex AI model resource path — injected into the setup message
const VERTEX_MODEL_RESOURCE =
  `projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}`;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  process.exit(1);
}
if (!SA_JSON) {
  console.error('FATAL: GOOGLE_SERVICE_ACCOUNT_JSON must be set');
  process.exit(1);
}

// ── Google Auth ───────────────────────────────────────────────────────────────

const googleAuth = new GoogleAuth({
  credentials: JSON.parse(SA_JSON),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

let _vertexTokenCache  = '';
let _vertexTokenExpiry = 0;

async function getVertexToken() {
  const now = Date.now();
  if (_vertexTokenCache && _vertexTokenExpiry - now > 5 * 60 * 1000) {
    return _vertexTokenCache;
  }
  const client    = await googleAuth.getClient();
  const { token, res } = await client.getAccessToken();
  // res.data.expires_in is in seconds; fall back to 1 hour
  const expiresIn = res?.data?.expires_in ?? 3600;
  _vertexTokenCache  = token;
  _vertexTokenExpiry = now + expiresIn * 1000;
  console.log('[auth] Vertex AI token refreshed');
  return token;
}

// ── Supabase JWT verification ─────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function verifyJwt(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Session logging (console + TODO: write to Supabase relay_sessions table) ──

function logSession(event, meta) {
  const line = { ts: new Date().toISOString(), event, ...meta };
  console.log('[session]', JSON.stringify(line));
  // TODO (production): insert into Supabase relay_sessions table for audit trail
  // await supabaseAdmin.from('relay_sessions').insert(line);
}

// ── HTTP server (Cloud Run health check on GET /) ────────────────────────────

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    res.end('Gemini Live Relay — OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, path: '/live' });

wss.on('connection', async (appWs, req) => {
  // ── 1. Parse query params ────────────────────────────────────────────────
  const url   = new URL(req.url, `http://localhost`);
  const token = url.searchParams.get('token');

  if (!token) {
    appWs.close(1008, 'Missing auth token');
    return;
  }

  // ── 2. Verify Supabase JWT ───────────────────────────────────────────────
  let user;
  try {
    user = await verifyJwt(token);
  } catch (e) {
    console.error('[auth] JWT verification error:', e.message);
    appWs.close(1011, 'Auth check failed');
    return;
  }

  if (!user) {
    appWs.close(1008, 'Invalid or expired token');
    return;
  }

  const sessionId = `${user.id.slice(0, 8)}-${Date.now()}`;
  logSession('open', { sessionId, userId: user.id });

  // ── 3. Mint Vertex AI Bearer token ──────────────────────────────────────
  let vertexToken;
  try {
    vertexToken = await getVertexToken();
  } catch (e) {
    console.error('[auth] Failed to get Vertex AI token:', e.message);
    logSession('error', { sessionId, reason: 'vertex_token_failed' });
    appWs.close(1011, 'Could not obtain Vertex AI credentials');
    return;
  }

  // ── 4. Connect to Vertex AI Live WebSocket ───────────────────────────────
  const vertexWs = new WebSocket(VERTEX_WS_URL, {
    headers: { Authorization: `Bearer ${vertexToken}` },
  });

  let vertexReady = false;

  vertexWs.on('open', () => {
    vertexReady = true;
    console.log(`[${sessionId}] Vertex AI WS open`);
  });

  vertexWs.on('error', (err) => {
    console.error(`[${sessionId}] Vertex AI WS error:`, err.message);
    logSession('error', { sessionId, reason: 'vertex_ws_error', detail: err.message });
    if (appWs.readyState === WebSocket.OPEN) {
      appWs.close(1011, 'Vertex AI connection error');
    }
  });

  vertexWs.on('close', (code, reason) => {
    console.log(`[${sessionId}] Vertex AI WS closed (${code})`);
    if (appWs.readyState === WebSocket.OPEN) {
      appWs.close(code, reason);
    }
  });

  // ── 5. Transparent proxy: Vertex AI → App ────────────────────────────────
  vertexWs.on('message', (data) => {
    if (appWs.readyState === WebSocket.OPEN) {
      appWs.send(data);
    }
  });

  // ── 6. Transparent proxy: App → Vertex AI ───────────────────────────────
  // Intercept the first setup message to inject the correct Vertex AI model
  // path — the app sends just the model name, we upgrade it to the full resource.
  let setupSent = false;

  appWs.on('message', (data) => {
    if (vertexWs.readyState !== WebSocket.OPEN) return;

    if (!setupSent) {
      setupSent = true;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.setup) {
          // Ensure the model is the full Vertex AI resource path
          msg.setup.model = VERTEX_MODEL_RESOURCE;
          console.log(`[${sessionId}] Setup forwarded — model: ${VERTEX_MODEL_RESOURCE}`);
          vertexWs.send(JSON.stringify(msg));
          return;
        }
      } catch {
        // Not JSON or no setup key — fall through to raw forward
      }
    }

    vertexWs.send(data);
  });

  appWs.on('close', (code) => {
    logSession('close', { sessionId, code });
    if (vertexWs.readyState === WebSocket.OPEN) {
      vertexWs.close();
    }
  });

  appWs.on('error', (err) => {
    console.error(`[${sessionId}] App WS error:`, err.message);
    logSession('error', { sessionId, reason: 'app_ws_error', detail: err.message });
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Gemini Live Relay listening on port ${PORT}`);
  console.log(`Vertex AI model: ${VERTEX_MODEL_RESOURCE}`);
});
