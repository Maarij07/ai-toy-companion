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
import { supabaseUrl, supabaseAnonKey } from '../config/supabase';

const GEMINI_LIVE_WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// How many PCM bytes per realtimeInput message (~125 ms of 16 kHz 16-bit audio)
const STREAM_CHUNK_BYTES = 4000;

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


    const res = await fetch(`${supabaseUrl}/functions/v1/gemini-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`gemini-key edge fn failed (${res.status}): ${body}`);
    }
    const { key } = await res.json() as { key: string };
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
      // reusing existing session
      return;
    }

    this.disconnect(); // clean up any stale socket

    const apiKey = await this.fetchApiKey();
    const url    = `${GEMINI_LIVE_WS_BASE}?key=${apiKey}`;

    return new Promise<void>((resolve, reject) => {
      this.setupResolve = resolve;
      this.setupReject  = reject;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws = ws;

      ws.onopen = () => {
        console.log('GeminiLiveService: connected — sending setup');
        const setupMsg: any = {
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
          },
        };
        if (systemPrompt) {
          setupMsg.setup.systemInstruction = {
            parts: [{ text: systemPrompt }],
          };
        }
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          let text: string;
          if (event.data instanceof ArrayBuffer) {
            const bytes = new Uint8Array(event.data);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            text = binary;
          } else if (typeof event.data === 'string') {
            text = event.data;
          } else {
            return;
          }
          this.handleMessage(JSON.parse(text));
        } catch {
          // ignore unparseable frames
        }
      };

      ws.onerror = () => {
        console.error('GeminiLiveService: WebSocket error');
        this.ready = false;
        const err = new Error('Gemini Live WebSocket error');
        this.setupReject?.(err);
        this.setupReject = null;
        this.setupResolve = null;
        this.turnReject?.(err);
        this.turnReject = null;
        this.turnResolve = null;
      };

      ws.onclose = (event: CloseEvent) => {
        console.log(`GeminiLiveService: closed (code=${event.code})`);
        this.ready = false;
        if (this.turnReject) {
          this.turnReject(new Error('Gemini Live connection closed mid-turn'));
          this.turnReject  = null;
          this.turnResolve = null;
        }
      };
    });
  }

  private handleMessage(msg: any): void {
    // ── Setup handshake complete ────────────────────────────────────────────
    if (msg.setupComplete !== undefined) {
      this.ready = true;
      console.log('GeminiLiveService: session ready');
      this.setupResolve?.();
      this.setupResolve = null;
      this.setupReject  = null;
      return;
    }

    // ── Model audio response ────────────────────────────────────────────────
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.responseChunks.push(this.base64ToBuffer(part.inlineData.data));
        }
      }
    }

    // ── Output transcription (AI's text response) ───────────────────────────
    if (msg.serverContent?.outputTranscription?.text) {
      const t = msg.serverContent.outputTranscription.text;
      console.log(`GeminiLive AI: "${t}"`);
      this.responseTextParts.push(t);
    }

    // ── Turn complete — assemble response and resolve ───────────────────────
    if (msg.serverContent?.turnComplete === true) {
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      if (this.turnResolve) {
        const assembled = this.assembleChunks(this.responseChunks);
        const text = this.responseTextParts.join(' ').trim();
        console.log(`GeminiLive: response complete — ${assembled.byteLength} bytes PCM @ 24 kHz${text ? ` | text: "${text}"` : ''}`);
        this.responseChunks   = [];
        this.responseTextParts = [];
        const resolve    = this.turnResolve;
        this.turnResolve = null;
        this.turnReject  = null;
        resolve({ pcm: assembled, text });
      }
    }
  }

  // ── Audio streaming ─────────────────────────────────────────────────────────

  /**
   * Stream raw 16-bit 16 kHz mono PCM to Gemini Live.
   * The entire PCM buffer is sliced into ~125 ms chunks and sent as
   * realtimeInput messages. Safe to call multiple times before endUserTurn().
   */
  streamPcm(pcm: ArrayBuffer): void {
    if (!this.ws || !this.ready) {
      console.warn('GeminiLiveService: streamPcm called but not connected');
      return;
    }
    const bytes = new Uint8Array(pcm);
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
    }
  }

  /**
   * Signal end of the user's audio turn. Returns a Promise that resolves
   * with the raw 24 kHz PCM response when Gemini finishes generating.
   *
   * @param timeoutMs  Max wait for first response (default 30 s)
   */
  endUserTurn(timeoutMs = 30_000): Promise<{ pcm: ArrayBuffer; text: string }> {
    if (!this.ws || !this.ready) {
      return Promise.reject(new Error('Gemini Live not connected'));
    }

    this.responseChunks    = [];
    this.responseTextParts = [];

    return new Promise<{ pcm: ArrayBuffer; text: string }>((resolve, reject) => {
      this.turnResolve = resolve;
      this.turnReject  = reject;

      this.turnTimer = setTimeout(() => {
        this.turnResolve = null;
        this.turnReject  = null;
        this.responseChunks = [];
        reject(new Error('Gemini Live response timeout after ' + timeoutMs + ' ms'));
      }, timeoutMs);

      // Tell Gemini the audio stream has ended (realtimeInput mode)
      this.ws!.send(JSON.stringify({
        realtimeInput: { audioStreamEnd: true },
      }));

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
    this.turnResolve  = null;
    this.turnReject   = null;
    this.setupResolve = null;
    this.setupReject  = null;
    this.responseChunks = [];
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
    // Process in 8 KB chunks to avoid call-stack limits on large buffers
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
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
