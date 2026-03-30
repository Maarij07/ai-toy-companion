/**
 * Supabase Edge Function: vertex-token
 *
 * Mints a short-lived Google OAuth2 Bearer token for the Vertex AI Live API.
 * The service account JSON key is stored as the secret GOOGLE_SERVICE_ACCOUNT_JSON.
 *
 * Returns: { token: string, expiresAt: number (unix ms) }
 *
 * The token is valid for 1 hour. The mobile app caches it and only calls
 * this function again when the token has less than 5 minutes remaining.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- JWT / OAuth2 helpers ---------------------------------------------------

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function encodeBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function signRS256(payload: string, privateKeyPem: string): Promise<string> {
  // Strip PEM headers and decode
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const data = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
  return base64url(new Uint8Array(sig));
}

async function mintAccessToken(serviceAccountJson: string): Promise<{ token: string; expiresAt: number }> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = encodeBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = encodeBase64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp,
  }));

  const unsignedJwt = `${header}.${claim}`;
  const signature = await signRS256(unsignedJwt, sa.private_key);
  const jwt = `${unsignedJwt}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  return {
    token: json.access_token as string,
    expiresAt: (now + (json.expires_in as number)) * 1000, // ms
  };
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not set" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const { token, expiresAt } = await mintAccessToken(serviceAccountJson);

    return new Response(
      JSON.stringify({ token, expiresAt }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("vertex-token error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
