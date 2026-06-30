/**
 * GeminiLiveService — Direct connection to Gemini Multimodal Live API.
 *
 * Auth: calls the `gemini-key` Supabase Edge Function to get GEMINI_LIVE_API_KEY.
 * Key is cached in memory for the app lifetime (API keys don't expire).
 *
 * Audio in:  PCM 16-bit, 16 kHz, mono  (exact match for ESP32 I2S output)
 * Audio out: PCM 16-bit, 24 kHz, mono  (downsampled to 16 kHz before BLE return)
 *
 * Usage:
 *   1. await GeminiLiveService.connect(systemPrompt)
 *   2. GeminiLiveService.streamPcm(pcmBuffer)
 *   3. const { pcm, text } = await GeminiLiveService.endUserTurn()
 *   4. const pcm16 = GeminiLiveService.downsample24to16(pcm)
 *   5. const wav   = GeminiLiveService.buildWav16k(pcm16)
 *   6. Send wav to ESP32 via ESP32Service.sendFileToESP32()
 *
 * Note: relay/ is built and parked for production/school pilot phase.
 */
import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';
import LatencyTrace from '../utils/LatencyTrace';

const GEMINI_LIVE_WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// How many PCM bytes per realtimeInput message (~125 ms of 16 kHz 16-bit audio)
const STREAM_CHUNK_BYTES = 4000;

// Push-to-talk turn boundaries: the button is the source of truth for when the
// user is speaking, so Gemini's automatic VAD is disabled and the app sends
// explicit activityStart/activityEnd signals. Required for live mic forwarding —
// with auto VAD, a mid-sentence pause would trigger a premature response.
// Set to false to fall back to auto VAD + audioStreamEnd (legacy behaviour).
const EXPLICIT_ACTIVITY = true;

// ── Debug log — circular buffer of last 40 entries, readable on-screen ────────
const DEBUG_LOG: string[] = [];
export function geminiDebugLog(): string[] { return [...DEBUG_LOG]; }
export function geminiDebugClear(): void { DEBUG_LOG.length = 0; }

// Intercept console.log for VPS| and GeminiLive| prefixed messages
const _origLog = console.log.bind(console);
console.log = (...args: any[]) => {
  _origLog(...args);
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (msg.startsWith('VPS|') || msg.startsWith('GeminiLive|') || msg.startsWith('LAT|')) {
    const line = `[${new Date().toISOString().slice(11,23)}] ${msg}`;
    DEBUG_LOG.push(line);
    if (DEBUG_LOG.length > 60) DEBUG_LOG.shift();
  }
};
const _origWarn = console.warn.bind(console);
console.warn = (...args: any[]) => {
  _origWarn(...args);
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (msg.startsWith('VPS|') || msg.startsWith('GeminiLive|')) {
    const line = `[${new Date().toISOString().slice(11,23)}] ⚠ ${msg}`;
    DEBUG_LOG.push(line);
    if (DEBUG_LOG.length > 60) DEBUG_LOG.shift();
  }
};
const _origError = console.error.bind(console);
console.error = (...args: any[]) => {
  _origError(...args);
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (msg.startsWith('VPS|') || msg.startsWith('GeminiLive|')) {
    const line = `[${new Date().toISOString().slice(11,23)}] ❌ ${msg}`;
    DEBUG_LOG.push(line);
    if (DEBUG_LOG.length > 60) DEBUG_LOG.shift();
  }
};

function dbg(msg: string) {
  console.log('GeminiLive|' + msg);
}

class GeminiLiveService {
  private ws: WebSocket | null = null;
  private ready = false;

  // API key cache — fetched once from gemini-key edge fn, never expires
  private cachedApiKey = '';

  // Per-turn state
  private responseChunks: ArrayBuffer[] = [];
  private responseTextParts: string[] = [];
  private turnResolve: ((result: { pcm: ArrayBuffer; text: string }) => void) | null = null;
  private turnReject:  ((err: Error) => void) | null = null;
  private turnTimer:   ReturnType<typeof setTimeout> | null = null;
  // Streaming callback — when set, audio chunks are delivered immediately instead of buffered
  private turnChunkCallback: ((pcm24: ArrayBuffer) => void) | null = null;

  // setupResolve / setupReject live only during the initial handshake
  private setupResolve: (() => void) | null = null;
  private setupReject:  ((err: Error) => void) | null = null;

  // ── Initialisation ─────────────────────────────────────────────────────────

  initialize(_apiKey?: string): void {
  }

  isReady(): boolean {
    return true;
  }

  // ── API key management ──────────────────────────────────────────────────────

  private async fetchApiKey(): Promise<string> {
    if (this.cachedApiKey) return this.cachedApiKey;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Not authenticated — cannot fetch Gemini Live key');
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/gemini-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`gemini-key edge fn failed (${res.status}): ${body}`);
    }
    const { key } = await res.json() as { key: string };
    if (!key || typeof key !== 'string') {
      throw new Error('gemini-key edge fn returned an invalid or missing key');
    }
    this.cachedApiKey = key;
    console.log('GeminiLiveService: API key ready');
    return key;
  }

  // ── Session management ─────────────────────────────────────────────────────

  /**
   * Open a Gemini Live session with the given system prompt.
   * Safe to call when already connected — reuses the existing session.
   */
  async connect(systemPrompt: string): Promise<void> {
    if (this.ws && this.ready) {
      dbg('connect: reusing existing session');
      return;
    }

    this.disconnect();

    dbg('connect: fetching API key...');
    const apiKey = await this.fetchApiKey();
    dbg('connect: API key ready, opening WebSocket...');
    const url    = `${GEMINI_LIVE_WS_BASE}?key=${apiKey}`;

    return new Promise<void>((resolve, reject) => {
      // 15-second connect timeout — if setupComplete never arrives
      const connectTimer = setTimeout(() => {
        dbg('connect: TIMEOUT waiting for setupComplete (15s)');
        this.setupResolve = null;
        this.setupReject  = null;
        reject(new Error('Gemini Live connect timeout — setupComplete not received in 15s'));
      }, 15_000);

      const wrappedResolve = () => { clearTimeout(connectTimer); resolve(); };
      const wrappedReject  = (e: Error) => { clearTimeout(connectTimer); reject(e); };

      this.setupResolve = wrappedResolve;
      this.setupReject  = wrappedReject;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
      } catch (e) {
        clearTimeout(connectTimer);
        reject(e);
        return;
      }

      this.ws = ws;

      ws.onopen = () => {
        dbg('connect: WS open — sending setup msg');
        const setupMsg: any = {
          setup: {
            model: 'models/gemini-2.0-flash-live-001',
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
          },
        };
        if (EXPLICIT_ACTIVITY) {
          setupMsg.setup.realtimeInputConfig = {
            automaticActivityDetection: { disabled: true },
          };
        }
        if (systemPrompt) {
          setupMsg.setup.systemInstruction = {
            parts: [{ text: systemPrompt }],
          };
        }
        ws.send(JSON.stringify(setupMsg));
        dbg('connect: setup msg sent');
      };

      ws.onmessage = (event) => {

        const decodeAndHandle = (raw: string) => {
          const tryHandle = (parsed: any) => {
            const keys = Object.keys(parsed).join(',');
            if (keys === 'sessionResumptionUpdate') { this.handleMessage(parsed); return; } // silent
            dbg(`decode OK keys=${keys}`);
            this.handleMessage(parsed);
          };
          // 1. Direct JSON parse (text frame)
          try { tryHandle(JSON.parse(raw)); return; } catch {}
          // 2. base64 → JSON
          try { tryHandle(JSON.parse(atob(raw))); return; } catch {}
          // 3. base64 → bytes → string → JSON
          try {
            const b = atob(raw); let str = '';
            for (let i = 0; i < b.length; i++) str += b[i];
            tryHandle(JSON.parse(str)); return;
          } catch {}
          dbg(`decode FAILED len=${raw.length} start=${raw.slice(0,30)}`);
        };

        if (event.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(event.data);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          decodeAndHandle(binary);
        } else if (event.data instanceof Uint8Array) {
          let binary = '';
          for (let i = 0; i < event.data.length; i++) binary += String.fromCharCode(event.data[i]);
          decodeAndHandle(binary);
        } else if (typeof event.data === 'string') {
          decodeAndHandle(event.data);
        } else if (event.data && typeof event.data === 'object' && typeof event.data.text === 'function') {
          event.data.text().then((t: string) => decodeAndHandle(t)).catch((e: any) => dbg(`Blob.text error: ${e}`));
        } else {
          dbg(`onmessage: UNKNOWN type=${typeof event.data}`);
        }
      };

      ws.onerror = () => {
        console.error('GeminiLiveService: WebSocket error');
        if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
        this.ready = false;
        const err = new Error('Gemini Live WebSocket error');
        this.setupReject?.(err);
        this.setupReject = null;
        this.setupResolve = null;
        this.turnReject?.(err);
        this.turnReject = null;
        this.turnResolve = null;
        // Clean up the socket so next connect() starts fresh
        this.ws = null;
      };

      ws.onclose = (event) => {
        console.log(`GeminiLiveService: closed (code=${event.code} reason=${event.reason})`);
        this.ready = false;
        // If closed before setupComplete arrived, reject connect() immediately
        // instead of hanging until the 15-second timeout.
        if (this.setupReject) {
          const err = new Error(`Gemini Live WS closed during setup (code=${event.code})`);
          this.setupReject(err);
          this.setupReject  = null;
          this.setupResolve = null;
        }
        if (this.turnReject) {
          this.turnReject(new Error(`Gemini Live closed mid-turn (code=${event.code} reason=${event.reason || 'none'})`));
          this.turnReject  = null;
          this.turnResolve = null;
        }
      };
    });
  }

  private handleMessage(msg: any): void {
    const topKey = Object.keys(msg)[0] ?? 'unknown';
    // sessionResumptionUpdate is a keepalive — skip logging, handle silently
    if (topKey === 'sessionResumptionUpdate') return;
    dbg(`handleMessage: topKey=${topKey}`);

    if (msg.setupComplete !== undefined) {
      this.ready = true;
      dbg('handleMessage: setupComplete → session ready');
      this.setupResolve?.();
      this.setupResolve = null;
      this.setupReject  = null;
      return;
    }

    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          LatencyTrace.mark('gemini_first_audio');
          const buf = this.base64ToBuffer(part.inlineData.data);
          if (this.turnChunkCallback) {
            // Streaming mode: deliver each chunk immediately as Gemini generates it
            this.turnChunkCallback(buf);
            dbg(`handleMessage: audio chunk ${buf.byteLength}B → streaming callback`);
          } else {
            // Batch mode (backward compat): accumulate until turnComplete
            this.responseChunks.push(buf);
            dbg(`handleMessage: audio chunk ${buf.byteLength}B total chunks=${this.responseChunks.length}`);
          }
        }
      }
    }

    if (msg.serverContent?.outputTranscription?.text) {
      const t = msg.serverContent.outputTranscription.text;
      dbg(`handleMessage: transcript="${t}"`);
      this.responseTextParts.push(t);
    }

    if (msg.serverContent?.turnComplete === true) {
      LatencyTrace.mark('gemini_turn_complete');
      if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
      const text = this.responseTextParts.join(' ').trim();
      // In streaming mode pcm is empty (delivered via onChunk); in batch mode assemble now
      const assembled = this.turnChunkCallback
        ? new ArrayBuffer(0)
        : this.assembleChunks(this.responseChunks);
      dbg(`handleMessage: turnComplete — ${assembled.byteLength}B PCM, text="${text}" streaming=${!!this.turnChunkCallback}`);
      this.responseChunks      = [];
      this.responseTextParts   = [];
      this.turnChunkCallback   = null;
      const resolve    = this.turnResolve;
      this.turnResolve = null;
      this.turnReject  = null;
      // Session stays OPEN — reused on the next turn (saves ~500ms reconnect cost)
      resolve?.({ pcm: assembled, text });
    }
  }

  // ── Audio streaming ─────────────────────────────────────────────────────────

  /**
   * Mark the start of the user's speech (button pressed). With explicit
   * activity signaling, Gemini buffers everything streamed via streamPcm()
   * until endUserTurn() sends activityEnd. No-op in legacy auto-VAD mode.
   */
  beginUserActivity(): void {
    if (!EXPLICIT_ACTIVITY) return;
    if (!this.ws || !this.ready) {
      dbg('beginUserActivity: NOT CONNECTED — skipping');
      return;
    }
    this.ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
    dbg('beginUserActivity: activityStart sent');
  }

  /**
   * Stream raw 16-bit 16 kHz mono PCM to Gemini Live.
   * The entire PCM buffer is sliced into ~125 ms chunks and sent as
   * realtimeInput messages. Safe to call multiple times before endUserTurn().
   */
  streamPcm(pcm: ArrayBuffer): void {
    if (!this.ws || !this.ready) {
      dbg('streamPcm: NOT CONNECTED — skipping');
      return;
    }
    // Calculate RMS to confirm real audio (not silence).
    // Guard the Int16 view against odd-length buffers (half a sample).
    const samples = new Int16Array(pcm, 0, (pcm.byteLength & ~1) / 2);
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
    const rms = Math.sqrt(sumSq / (samples.length || 1));

    DEBUG_LOG.push('────────────────────');
    dbg(`streamPcm: ${pcm.byteLength}B PCM, RMS=${rms.toFixed(0)} (speech>500)`);

    const bytes = new Uint8Array(pcm);
    let chunkCount = 0;
    for (let i = 0; i < bytes.length; i += STREAM_CHUNK_BYTES) {
      const slice = bytes.subarray(i, i + STREAM_CHUNK_BYTES);
      this.ws.send(JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: this.bufferToBase64(slice),
          },
        },
      }));
      chunkCount++;
    }
    dbg(`streamPcm: sent ${chunkCount} chunks`);
  }

  /**
   * Signal end of the user's audio turn. Returns a Promise that resolves
   * when Gemini finishes generating.
   *
   * @param timeoutMs  Max wait for response (default 30 s)
   * @param onChunk    Optional streaming callback — fired for each audio chunk as it
   *                   arrives. When provided, the resolved `pcm` field is empty
   *                   (ArrayBuffer(0)) since audio was delivered incrementally.
   *                   Without it, all audio is accumulated and returned in `pcm`.
   */
  endUserTurn(timeoutMs = 15_000, onChunk?: (pcm24: ArrayBuffer) => void): Promise<{ pcm: ArrayBuffer; text: string }> {
    if (!this.ws || !this.ready) {
      return Promise.reject(new Error('Gemini Live not connected'));
    }

    // Legacy auto-VAD mode can start the response before endUserTurn is
    // called — hand any already-buffered chunks to the streaming callback
    // instead of discarding them at turnComplete.
    if (onChunk && this.responseChunks.length > 0) {
      dbg(`endUserTurn: delivering ${this.responseChunks.length} pre-buffered chunks to callback`);
      for (const chunk of this.responseChunks) onChunk(chunk);
    }
    this.responseChunks      = [];
    this.responseTextParts   = [];
    this.turnChunkCallback   = onChunk ?? null;

    return new Promise<{ pcm: ArrayBuffer; text: string }>((resolve, reject) => {
      this.turnResolve = resolve;
      this.turnReject  = reject;

      this.turnTimer = setTimeout(() => {
        this.turnResolve       = null;
        this.turnReject        = null;
        this.turnChunkCallback = null;
        this.responseChunks    = [];
        this.responseTextParts = [];
        // Force-close the session so next attempt starts fresh — stale sessions never respond
        dbg('endUserTurn: TIMEOUT — closing stale session');
        this.disconnect();
        reject(new Error('Gemini Live response timeout after ' + timeoutMs + ' ms'));
      }, timeoutMs);

      // Signal end of the user's speech — triggers model generation
      if (EXPLICIT_ACTIVITY) {
        dbg('endUserTurn: sending activityEnd');
        this.ws!.send(JSON.stringify({
          realtimeInput: { activityEnd: {} },
        }));
      } else {
        dbg('endUserTurn: sending audioStreamEnd');
        this.ws!.send(JSON.stringify({
          realtimeInput: { audioStreamEnd: true },
        }));
      }
      LatencyTrace.mark('activity_end_sent');
      dbg('endUserTurn: waiting for turnComplete...');
    });
  }

  // ── Audio format helpers ────────────────────────────────────────────────────

  /**
   * Downsample 24 kHz 16-bit mono PCM to 16 kHz using 3:2 linear interpolation.
   * For every 3 input samples → 2 output samples:
   *   out[0] = in[0]
   *   out[1] = round((in[1] + in[2]) / 2)
   */
  downsample24to16(pcm24: ArrayBuffer): ArrayBuffer {
    const input = new Int16Array(pcm24);
    // Floor to the number of complete 3-sample groups so outputLen always
    // matches the number of samples the loop actually writes (avoids trailing zeros).
    const groups    = Math.floor(input.length / 3);
    const outputLen = groups * 2;
    const output    = new Int16Array(outputLen);
    let oi = 0;
    for (let i = 0; i < groups * 3; i += 3) {
      output[oi]     = input[i];
      output[oi + 1] = Math.round((input[i + 1] + input[i + 2]) / 2);
      oi += 2;
    }
    return output.buffer as ArrayBuffer;
  }

  /**
   * Wrap raw 16-bit 16 kHz mono PCM in a standard 44-byte WAV header.
   * The result is ready to send directly to ESP32 via sendFileToESP32().
   */
  buildWav16k(pcm: ArrayBuffer): ArrayBuffer {
    const sampleRate    = 16000;
    const numChannels   = 1;
    const bitsPerSample = 16;
    const byteRate      = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign    = numChannels * (bitsPerSample / 8);
    const dataSize      = pcm.byteLength;

    const wav     = new ArrayBuffer(44 + dataSize);
    const view    = new DataView(wav);
    const wavBytes = new Uint8Array(wav);

    // RIFF chunk descriptor
    [82,73,70,70].forEach((b, i) => view.setUint8(i, b));          // 'RIFF'
    view.setUint32(4,  36 + dataSize, true);                        // file size - 8
    [87,65,86,69].forEach((b, i) => view.setUint8(8  + i, b));     // 'WAVE'
    // fmt sub-chunk
    [102,109,116,32].forEach((b, i) => view.setUint8(12 + i, b));  // 'fmt '
    view.setUint32(16, 16,            true);  // sub-chunk size = 16 for PCM
    view.setUint16(20, 1,             true);  // AudioFormat = PCM
    view.setUint16(22, numChannels,   true);
    view.setUint32(24, sampleRate,    true);
    view.setUint32(28, byteRate,      true);
    view.setUint16(32, blockAlign,    true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    [100,97,116,97].forEach((b, i) => view.setUint8(36 + i, b));   // 'data'
    view.setUint32(40, dataSize,      true);
    wavBytes.set(new Uint8Array(pcm), 44);

    return wav;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  disconnect(): void {
    if (this.turnTimer)  { clearTimeout(this.turnTimer); this.turnTimer = null; }
    this.turnResolve       = null;
    this.turnReject        = null;
    this.turnChunkCallback = null;
    this.setupResolve      = null;
    this.setupReject       = null;
    this.responseChunks    = [];
    this.ready = false;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return !!this.ws && this.ready;
  }

  // ── Private utilities ───────────────────────────────────────────────────────

  private base64ToBuffer(b64: string): ArrayBuffer {
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
  }

  private bufferToBase64(bytes: Uint8Array): string {
    // Hermes (release builds) cannot spread large arrays — must loop manually
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private assembleChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const out   = new Uint8Array(total);
    let offset  = 0;
    for (const chunk of chunks) {
      out.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return out.buffer as ArrayBuffer;
  }
}

export default new GeminiLiveService();
