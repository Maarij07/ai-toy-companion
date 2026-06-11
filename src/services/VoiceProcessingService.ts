import ESP32WiFiService from './ESP32WiFiService';
import WhisperService from './WhisperService';
import GoogleSTTService from './GoogleSTTService';
import LLMService from './LLMService';
import TTSService from './TTSService';
import ChatService from './ChatService';
import GeminiLiveService from './GeminiLiveService';
import { OpusStreamSender } from './OpusStreamSender';
import Esp32DiscoveryService from './Esp32DiscoveryService';
import { supabaseUrl, supabaseAnonKey } from '../config/supabase';
import { ESP32_FALLBACK_IPS, ESP32_NSD_SERVICE_TYPES } from '../config/voiceConfig';
import LatencyTrace from '../utils/LatencyTrace';

interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
  toyId?: string;        // Current toy ID for chat logging
  geminiApiKey?: string; // Set to enable Gemini Live prototype
  useGeminiLive?: boolean;
  esp32Ip?: string;      // ESP32 IP address (printed to Serial on boot)
  esp32Port?: number;    // TCP port — default 8765
  esp32NsdServiceTypes?: string[];
  esp32FallbackIps?: string[];
}

// Status emitted during pipeline execution so UI can update in real time
export type PipelineStatus = 'transcribing' | 'thinking' | 'saving' | 'sending' | 'idle';

// Per-turn state for the live mic-forwarding path (Gemini Live mode)
interface LiveTurnState {
  headerSkipped: number;          // bytes of the 44-byte WAV header consumed
  pendingPcm: Uint8Array;         // coalesce small TCP chunks before forwarding
  preconnectQueue: ArrayBuffer[]; // audio that arrived before the session was ready
  forwarding: boolean;            // true once the session is ready and queue flushed
  pcmBytes: number;
  sumSq: number;
  sampleCount: number;
  connectPromise: Promise<void> | null;
  connectError: Error | null;
}

// Forward to Gemini in ~125ms slices — matches streamPcm's wire chunking
const LIVE_FORWARD_BYTES = 4000;

class VoiceProcessingService {
  private config: VoiceProcessingConfig | null = null;
  private isInitialized: boolean = false;
  private readonly maxOpusResponseSeconds = 12;
  private liveTurn: LiveTurnState | null = null;

  // ── WAV parser ─────────────────────────────────────────────────────────────

  /**
   * Parse a WAV file — returns PCM payload and the actual fmt metadata.
   * Reading sample rate/channels from the header prevents mismatch with Google STT.
   */
  private parseWav(audioData: ArrayBuffer): {
    pcm: ArrayBuffer;
    sampleRateHertz: number;
    numChannels: number;
    bitsPerSample: number;
  } {
    const defaults = { pcm: audioData, sampleRateHertz: 16000, numChannels: 1, bitsPerSample: 16 };

    if (audioData.byteLength < 44) return defaults;
    const view = new DataView(audioData);

    const riff =
      String.fromCharCode(view.getUint8(0)) +
      String.fromCharCode(view.getUint8(1)) +
      String.fromCharCode(view.getUint8(2)) +
      String.fromCharCode(view.getUint8(3));
    if (riff !== 'RIFF') return defaults; // not a WAV — pass through

    // Read fmt chunk (always starts at offset 12 in standard WAV)
    let sampleRateHertz = 16000;
    let numChannels = 1;
    let bitsPerSample = 16;

    let offset = 12;
    while (offset + 8 <= audioData.byteLength) {
      const id =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));
      const size = view.getUint32(offset + 4, true);

      if (id === 'fmt ' && size >= 16) {
        numChannels    = view.getUint16(offset + 8 + 2, true);
        sampleRateHertz = view.getUint32(offset + 8 + 4, true);
        bitsPerSample  = view.getUint16(offset + 8 + 14, true);
        console.log(
          `WAV fmt: ${sampleRateHertz} Hz, ${numChannels}ch, ${bitsPerSample}-bit`
        );
      }

      if (id === 'data') {
        const pcm = audioData.slice(offset + 8);
        console.log(`WAV data chunk at ${offset + 8}, ${size} PCM bytes`);
        return { pcm, sampleRateHertz, numChannels, bitsPerSample };
      }

      if (size === 0 || size > audioData.byteLength) {
        console.warn(`WAV chunk "${id}" has invalid size ${size}, falling back to offset 44`);
        break;
      }
      offset += 8 + size + (size % 2 !== 0 ? 1 : 0);
    }

    // Fallback: standard 44-byte header, assume defaults already read from fmt
    console.warn('VoiceProcessingService: data chunk not found, skipping 44 bytes');
    return { pcm: audioData.slice(44), sampleRateHertz, numChannels, bitsPerSample };
  }

  // ── Audio energy check ─────────────────────────────────────────────────────

  /**
   * Calculate RMS of 16-bit PCM to check if mic captured anything.
   * RMS ~0-50   = silence / dead mic
   * RMS ~50-500 = quiet background noise
   * RMS 500+    = audible speech
   */
  private logPCMEnergy(pcm: ArrayBuffer): void {
    // Int16Array requires even byte count — truncate 1 byte if needed (half a sample, inaudible)
    const evenBytes = pcm.byteLength & ~1;
    const samples = new Int16Array(pcm, 0, evenBytes / 2);
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
    const rms = Math.sqrt(sumSq / samples.length);
    const peak = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    console.log(`PCM energy — RMS: ${rms.toFixed(1)}, peak: ${peak} (speech needs RMS > 500)`);
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      let chunkBinary = '';
      for (let j = 0; j < chunk.length; j++) {
        chunkBinary += String.fromCharCode(chunk[j]);
      }
      binary += chunkBinary;
    }
    return btoa(binary);
  }

  private base64ToBuffer(b64: string): ArrayBuffer {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    label: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`${label} timed out after ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Initialise AI services ─────────────────────────────────────────────────

  async initialize(config: VoiceProcessingConfig): Promise<boolean> {
    try {
      this.config = config;

      if (config.useGeminiLive && config.geminiApiKey) {
        // ── Gemini Live mode: single WebSocket replaces STT + LLM + TTS ────
        GeminiLiveService.initialize(config.geminiApiKey);
        this.isInitialized = true;
        console.log('VoiceProcessingService: AI services initialised (Gemini Live mode)');
        return true;
      }

      // ── Standard pipeline mode ──────────────────────────────────────────
      const initPromises: Promise<boolean>[] = [];

      // Whisper.cpp (local STT — native module not yet built, will fall through)
      if (config.whisperModelPath) {
        initPromises.push(
          WhisperService.initialize({ modelPath: config.whisperModelPath, language: 'en' })
        );
      }

      // Google STT — 16 kHz 16-bit mono WAV (LINEAR16) from ESP32
      initPromises.push(
        GoogleSTTService.initialize({
          languageCode: 'en-US',
          sampleRateHertz: 16000,
          encoding: 'LINEAR16',
        })
      );

      // Gemini LLM (Supabase edge function)
      initPromises.push(LLMService.initialize({}));

      // Resemble TTS (Supabase edge function)
      initPromises.push(TTSService.initialize({ language: config.ttsLanguage || 'en-US' }));

      await Promise.all(initPromises);
      this.isInitialized = true;
      console.log('VoiceProcessingService: AI services initialised');
      return true;
    } catch (error) {
      console.error('VoiceProcessingService: init failed', error);
      return false;
    }
  }

  // ── Gemini Live pipeline ───────────────────────────────────────────────────

  /**
   * Gemini Live path: stream PCM → single WebSocket → get audio response back.
   * Replaces the three-step STT → LLM → TTS chain entirely.
   *
   * Step 1 — Connect (or reuse existing session)
   * Step 2 — Stream PCM to Gemini Live
   * Step 3 — End user turn, await audio response (24 kHz PCM)
   * Step 4 — Downsample 24 kHz → 16 kHz + encode to Opus (via edge fn)
   * Step 5 — Send Opus to ESP32 over WiFi
   */

  /**
   * Calls the encode-opus Supabase Edge Function to convert 16kHz 16-bit mono
   * PCM into length-prefixed raw Opus packets for ESP32 v15 firmware.
   * Format: [uint16_t len LE][opus bytes][uint16_t len LE][...]
   */
  private async encodePcmToOpus(pcm16: ArrayBuffer): Promise<ArrayBuffer> {
    const maxBytes = this.maxOpusResponseSeconds * 16000 * 2;
    const pcmForEncode = pcm16.byteLength > maxBytes ? pcm16.slice(0, maxBytes) : pcm16;
    if (pcmForEncode.byteLength !== pcm16.byteLength) {
      console.warn(
        `VPS|Opus input trimmed from ${pcm16.byteLength}B to ${pcmForEncode.byteLength}B ` +
        `(${this.maxOpusResponseSeconds}s cap)`
      );
    }

    const startedAt = Date.now();
    const pcmB64 = this.bufferToBase64(pcmForEncode);
    console.log(`VPS|encode-opus request: pcm=${pcmForEncode.byteLength}B b64=${pcmB64.length} chars`);

    const res = await this.fetchWithTimeout(`${supabaseUrl}/functions/v1/encode-opus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ pcm: pcmB64 }),
    }, 45_000, 'encode-opus edge function');

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`encode-opus edge fn failed (${res.status}): ${body}`);
    }

    const { opus } = await res.json() as { opus: string };
    const opusBuffer = this.base64ToBuffer(opus);
    console.log(`VPS|encode-opus response: opus=${opusBuffer.byteLength}B elapsed=${Date.now() - startedAt}ms`);
    return opusBuffer;
  }

  /** One sender per turn: encodes concurrently, sends to the ESP32 in order. */
  private createOpusSender(onStatus?: (status: PipelineStatus) => void): OpusStreamSender {
    return new OpusStreamSender({
      encode: (pcm16) => this.encodePcmToOpus(pcm16),
      send: (opus) => ESP32WiFiService.sendOpusChunk(opus),
      isConnected: () => ESP32WiFiService.isConnected(),
      onFirstChunkSent: () => {
        LatencyTrace.mark('first_opus_sent');
        onStatus?.('sending');
      },
    });
  }

  private async processWithGeminiLive(
    audioData: ArrayBuffer,
    toyPersonality: string,
    onStatus?: (status: PipelineStatus) => void
  ): Promise<{ success: boolean; error: string }> {
    try {
      // Batch path: the turn effectively starts when the full recording lands here
      if (!LatencyTrace.isActive()) LatencyTrace.start();
      console.log(`VPS|GeminiLive pipeline start — audio: ${audioData.byteLength} bytes`);

      // ── Guard: empty / corrupt recording ─────────────────────────────────
      if (audioData.byteLength < 200) {
        console.warn(`VPS|REJECTED: too small (${audioData.byteLength} bytes)`);
        return { success: false, error: 'empty_recording' };
      }

      const WAV_HEADER_BYTES = 44;
      const rawPcm = audioData.byteLength > WAV_HEADER_BYTES
        ? audioData.slice(WAV_HEADER_BYTES)
        : audioData;
      const evenLen = rawPcm.byteLength & ~1;
      const pcmData = evenLen < rawPcm.byteLength ? rawPcm.slice(0, evenLen) : rawPcm;

      const durationMs = Math.round((pcmData.byteLength / 2 / 16000) * 1000);
      console.log(`VPS|PCM ${pcmData.byteLength} bytes = ${durationMs}ms`);
      this.logPCMEnergy(pcmData);

      if (durationMs < 500) {
        console.warn(`VPS|REJECTED: too short (${durationMs}ms)`);
        onStatus?.('idle');
        return { success: false, error: 'empty_recording' };
      }

      const samples = new Int16Array(pcmData);
      let sumSq = 0;
      for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
      const rms = Math.sqrt(sumSq / (samples.length || 1));
      console.log(`VPS|RMS=${rms.toFixed(0)}`);
      if (rms < 500) {
        console.warn(`VPS|REJECTED: audio too quiet (RMS=${rms.toFixed(0)})`);
        onStatus?.('idle');
        return { success: false, error: 'audio_too_quiet' };
      }

      // ── Connect (reuses warm session — no reconnect cost after first turn) ─
      onStatus?.('thinking');
      const personality =
        toyPersonality ||
        'You are a friendly AI toy companion for children. Respond warmly, in a child-friendly way. Keep every answer under 20 words.';
      await GeminiLiveService.connect(personality);
      console.log('VPS|Gemini session ready — streaming PCM');

      // ── Streaming encode + send pipeline ──────────────────────────────────
      // As Gemini generates audio chunks we:
      //   1. Downsample 24→16 kHz immediately
      //   2. OpusStreamSender encodes each chunk concurrently (encode of chunk N
      //      overlaps generation of chunk N+1) and sends every chunk to the
      //      ESP32, in order, the moment its encode resolves
      //
      // Delivery starts while Gemini is still generating — the toy receives the
      // first Opus chunk ~300ms after Gemini's first audio, not at turnComplete.
      const sender = this.createOpusSender(onStatus);

      const onChunk = (pcm24: ArrayBuffer) => {
        sender.addPcm16(GeminiLiveService.downsample24to16(pcm24));
      };

      // ── Stream PCM to Gemini + wait for full turn (chunks delivered via onChunk) ─
      GeminiLiveService.beginUserActivity();
      GeminiLiveService.streamPcm(pcmData);
      const { text: responseText } = await GeminiLiveService.endUserTurn(30_000, onChunk);
      console.log(`VPS|turnComplete — text="${responseText}" chunks=${sender.chunkCount}`);

      // ── Save chat (fire-and-forget — don't block audio delivery) ─────────
      if (this.config?.toyId && responseText) {
        Promise.all([
          ChatService.saveMessage(this.config.toyId, 'user', '[Voice message]'),
          ChatService.saveMessage(this.config.toyId, 'assistant', responseText),
        ]).catch(e => console.warn('VPS|chat save failed:', e));
      }

      // ── Drain: encode/send of trailing chunks (most are already on the wire) ─
      const { chunks, totalOpusBytes } = await sender.finish();
      if (chunks === 0) {
        console.warn('VPS|No audio returned from Gemini');
        onStatus?.('idle');
        return { success: false, error: 'Gemini Live returned no audio' };
      }

      // DONE: signal end of stream — firmware exits STREAMING mode and plays
      await ESP32WiFiService.sendStreamDone('response.opus');
      LatencyTrace.mark('done_sent');
      console.log(`VPS|DONE sent — ${totalOpusBytes}B total opus, pipeline complete`);

      onStatus?.('idle');
      return { success: true, error: '' };
    } catch (error) {
      console.error('VPS|GeminiLive pipeline error:', error);
      onStatus?.('idle');
      return { success: false, error: (error as Error).message };
    }
  }

  // ── Full pipeline: audio bytes → STT → LLM → chat save → TTS → WiFi ───────

  /**
   * Routes to Gemini Live or the standard STT → LLM → TTS pipeline depending
   * on whether useGeminiLive is set in config.
   *
   * Standard pipeline steps:
   * Step 1 — STT : Whisper (local) → Google STT (edge fn) fallback
   * Step 2 — LLM : Gemini via Supabase edge function
   * Step 3 — CHAT: Save user + AI messages to DB (always — before TTS/BLE)
   * Step 4 — TTS : Resemble AI → WAV ArrayBuffer  (best-effort)
   * Step 5 — WiFi : Send WAV to ESP32 in chunks (best-effort)
   */
  async processAudioFromToy(
    audioData: ArrayBuffer,
    toyPersonality?: string,
    onStatus?: (status: PipelineStatus) => void
  ): Promise<{ success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: 'VoiceProcessingService not initialised' };
      }

      // Route to Gemini Live if configured
      if (this.config?.useGeminiLive) {
        return this.processWithGeminiLive(
          audioData,
          toyPersonality ||
            'You are a friendly AI toy companion for children. Respond warmly. Keep every answer under 20 words.',
          onStatus
        );
      }

      console.log(`Pipeline start — audio: ${audioData.byteLength} bytes`);

      // Guard: empty/corrupt recording only (< 200 bytes)
      if (audioData.byteLength < 200) {
        console.warn(`VoiceProcessingService: skipping empty recording (${audioData.byteLength} bytes)`);
        return { success: false, error: 'empty_recording' };
      }

      // ── Step 1: STT ──────────────────────────────────────────────────────
      onStatus?.('transcribing');

      // Parse WAV to get raw PCM + actual format metadata (sample rate, channels)
      const { pcm: pcmData, sampleRateHertz, numChannels, bitsPerSample } = this.parseWav(audioData);
      console.log(`PCM data for STT: ${pcmData.byteLength} bytes | ${sampleRateHertz}Hz ${numChannels}ch ${bitsPerSample}-bit`);
      this.logPCMEnergy(pcmData);

      let sttResult = await WhisperService.transcribe(pcmData);

      if (!sttResult.success) {
        console.log('Whisper unavailable — falling back to Google STT');
        sttResult = await GoogleSTTService.transcribe(pcmData, sampleRateHertz, numChannels);
      }

      if (!sttResult.success) {
        onStatus?.('idle');
        // "No transcription results" = silence/background noise — not a real error
        if (sttResult.error.includes('No transcription results')) {
          return { success: false, error: 'empty_recording' };
        }
        return { success: false, error: `STT failed: ${sttResult.error}` };
      }

      console.log(`STT transcript: "${sttResult.text}"`);

      // ── Step 2: LLM ──────────────────────────────────────────────────────
      onStatus?.('thinking');
      if (!LLMService.isReady()) {
        onStatus?.('idle');
        return { success: false, error: 'LLM service not ready' };
      }

      const llmResult = await LLMService.getResponse(sttResult.text, {
        toyPersonality:
          toyPersonality ||
          'You are a friendly AI toy companion. Respond warmly and in a child-friendly way. Keep every reply under 20 words.',
        conversationId: `toy-${Date.now()}`,
      });

      if (!llmResult.success) {
        onStatus?.('idle');
        return { success: false, error: `LLM failed: ${llmResult.error}` };
      }

      console.log(`LLM response: "${llmResult.response}"`);

      // ── Step 3: CHAT — Save to DB before TTS so messages are never lost ──
      onStatus?.('saving');
      if (this.config?.toyId) {
        const userSave = await ChatService.saveMessage(this.config.toyId, 'user', sttResult.text);
        const aiSave   = await ChatService.saveMessage(this.config.toyId, 'assistant', llmResult.response);
        if (!userSave.success || !aiSave.success) {
          console.error('Chat save failed:', userSave.error || aiSave.error);
        } else {
          console.log(`Chat saved for toy ${this.config.toyId}`);
        }
      } else {
        console.warn('VoiceProcessingService: no toyId — chat messages not saved');
      }

      // ── Step 4 & 5: TTS + WiFi — best-effort, WiFi failure won't lose chat ─
      onStatus?.('sending');
      if (TTSService.isReady() && ESP32WiFiService.isConnected()) {
        const ttsResult = await TTSService.speak(llmResult.response);
        if (ttsResult.success && ttsResult.audioData) {
          await ESP32WiFiService.sendFileToESP32('response.wav', ttsResult.audioData);
          console.log(`response.wav (${ttsResult.audioData.byteLength} B) sent to ESP32`);
        } else {
          console.warn('TTS failed, skipping WiFi send:', ttsResult.error);
        }
      } else {
        console.warn(
          'TTS/WiFi skipped — TTS ready:', TTSService.isReady(),
          'WiFi connected:', ESP32WiFiService.isConnected()
        );
      }

      onStatus?.('idle');
      return { success: true, error: '' };
    } catch (error) {
      console.error('VoiceProcessingService pipeline error:', error);
      onStatus?.('idle');
      return { success: false, error: (error as Error).message };
    }
  }

  // ── Live mic forwarding (Gemini Live mode) ────────────────────────────────
  //
  // The firmware streams mic PCM to the app in ~16ms chunks while the user is
  // speaking (STREAM_START → chunks → STREAM_END). Instead of buffering the
  // whole utterance and uploading it after button release, each chunk is
  // forwarded to Gemini as it arrives — so Gemini has heard everything the
  // moment the button is released and generation starts immediately.

  private registerLiveAudioHandler(
    onProcessingComplete: (success: boolean, error?: string) => void,
    toyPersonality?: string,
    onStatus?: (status: PipelineStatus) => void
  ): void {
    const personality =
      toyPersonality ||
      'You are a friendly AI toy companion for children. Respond warmly, in a child-friendly way. Keep every answer under 20 words.';

    ESP32WiFiService.setLiveAudioHandler({
      onStart: (filename) => {
        console.log(`VPS|live stream start — ${filename}`);
        const turn: LiveTurnState = {
          headerSkipped: 0,
          pendingPcm: new Uint8Array(0),
          preconnectQueue: [],
          forwarding: false,
          pcmBytes: 0,
          sumSq: 0,
          sampleCount: 0,
          connectPromise: null,
          connectError: null,
        };
        this.liveTurn = turn;
        // Session is warm after the first turn — this resolves immediately then
        turn.connectPromise = GeminiLiveService.connect(personality)
          .then(() => {
            if (this.liveTurn !== turn) return; // turn was abandoned
            GeminiLiveService.beginUserActivity();
            for (const queued of turn.preconnectQueue) {
              GeminiLiveService.streamPcm(queued);
            }
            turn.preconnectQueue = [];
            turn.forwarding = true;
          })
          .catch((e) => {
            turn.connectError = e instanceof Error ? e : new Error(String(e));
            console.error('VPS|live connect failed:', turn.connectError.message);
          });
      },

      onChunk: (data) => {
        const turn = this.liveTurn;
        if (!turn) return;

        // Strip the 44-byte WAV header the firmware sends at stream start
        let bytes = new Uint8Array(data);
        if (turn.headerSkipped < 44) {
          const skip = Math.min(44 - turn.headerSkipped, bytes.byteLength);
          turn.headerSkipped += skip;
          bytes = bytes.subarray(skip);
          if (bytes.byteLength === 0) return;
        }

        // Energy tally for the end-of-turn silence guard
        const evenLen = bytes.byteLength & ~1;
        const samples = new Int16Array(bytes.buffer, bytes.byteOffset, evenLen / 2);
        for (let i = 0; i < samples.length; i++) turn.sumSq += samples[i] * samples[i];
        turn.sampleCount += samples.length;
        turn.pcmBytes += bytes.byteLength;

        // Coalesce small TCP reads into ~125ms slices before forwarding
        const merged = new Uint8Array(turn.pendingPcm.byteLength + bytes.byteLength);
        merged.set(turn.pendingPcm);
        merged.set(bytes, turn.pendingPcm.byteLength);
        turn.pendingPcm = merged;

        while (turn.pendingPcm.byteLength >= LIVE_FORWARD_BYTES) {
          const slice = turn.pendingPcm.slice(0, LIVE_FORWARD_BYTES);
          turn.pendingPcm = turn.pendingPcm.slice(LIVE_FORWARD_BYTES);
          this.forwardLivePcm(turn, slice.buffer as ArrayBuffer);
        }
      },

      onEnd: (filename, dataBytes) => {
        LatencyTrace.start(); // turn starts at button release
        const turn = this.liveTurn;
        this.liveTurn = null;
        if (!turn) return;
        console.log(`VPS|live stream end — ${filename} (${dataBytes}B reported)`);
        this.processLiveTurn(turn, onStatus)
          .then((result) => onProcessingComplete(result.success, result.error || undefined))
          .catch((e) => onProcessingComplete(false, (e as Error).message));
      },
    });

    console.log('VPS|live mic forwarding registered (Gemini Live mode)');
  }

  private forwardLivePcm(turn: LiveTurnState, pcm: ArrayBuffer): void {
    if (turn.forwarding) {
      GeminiLiveService.streamPcm(pcm);
    } else {
      turn.preconnectQueue.push(pcm);
    }
  }

  /** Runs after STREAM_END: close the Gemini turn and stream the response out. */
  private async processLiveTurn(
    turn: LiveTurnState,
    onStatus?: (status: PipelineStatus) => void
  ): Promise<{ success: boolean; error: string }> {
    try {
      onStatus?.('thinking');

      await turn.connectPromise;
      if (turn.connectError) {
        LatencyTrace.cancel('gemini_connect_failed');
        await this.releaseFirmware();
        onStatus?.('idle');
        return { success: false, error: turn.connectError.message };
      }

      // Flush the sub-slice tail collected during speech
      if (turn.pendingPcm.byteLength > 0) {
        this.forwardLivePcm(turn, turn.pendingPcm.slice().buffer as ArrayBuffer);
        turn.pendingPcm = new Uint8Array(0);
      }

      // Silence / accidental-press guard — same thresholds as the batch path
      const durationMs = Math.round((turn.pcmBytes / 2 / 16000) * 1000);
      const rms = Math.sqrt(turn.sumSq / (turn.sampleCount || 1));
      console.log(`VPS|live turn — ${turn.pcmBytes}B = ${durationMs}ms, RMS=${rms.toFixed(0)}`);
      if (durationMs < 500 || rms < 500) {
        console.warn(`VPS|live turn REJECTED (${durationMs}ms, RMS=${rms.toFixed(0)})`);
        LatencyTrace.cancel(durationMs < 500 ? 'too_short' : 'too_quiet');
        // activityStart was already sent — drop the session so the next turn starts clean
        GeminiLiveService.disconnect();
        await this.releaseFirmware();
        onStatus?.('idle');
        return { success: false, error: durationMs < 500 ? 'empty_recording' : 'audio_too_quiet' };
      }

      // End the user turn; response chunks flow straight into the opus sender
      const sender = this.createOpusSender(onStatus);
      const { text: responseText } = await GeminiLiveService.endUserTurn(30_000, (pcm24) => {
        sender.addPcm16(GeminiLiveService.downsample24to16(pcm24));
      });
      console.log(`VPS|turnComplete — text="${responseText}" chunks=${sender.chunkCount}`);

      // Save chat (fire-and-forget — don't block audio delivery)
      if (this.config?.toyId && responseText) {
        Promise.all([
          ChatService.saveMessage(this.config.toyId, 'user', '[Voice message]'),
          ChatService.saveMessage(this.config.toyId, 'assistant', responseText),
        ]).catch(e => console.warn('VPS|chat save failed:', e));
      }

      const { chunks, totalOpusBytes } = await sender.finish();
      if (chunks === 0) {
        console.warn('VPS|No audio returned from Gemini');
        LatencyTrace.cancel('no_audio');
        await this.releaseFirmware();
        onStatus?.('idle');
        return { success: false, error: 'Gemini Live returned no audio' };
      }

      await ESP32WiFiService.sendStreamDone('response.opus');
      LatencyTrace.mark('done_sent');
      console.log(`VPS|DONE sent — ${totalOpusBytes}B total opus, live pipeline complete`);

      onStatus?.('idle');
      return { success: true, error: '' };
    } catch (error) {
      console.error('VPS|live pipeline error:', error);
      LatencyTrace.cancel('error');
      await this.releaseFirmware();
      onStatus?.('idle');
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * The firmware enters STREAMING mode right after STREAM_END and waits for a
   * response. On abort paths we must still send the end-of-stream signal —
   * the firmware's zero-audio branch then returns it to Ready.
   */
  private async releaseFirmware(): Promise<void> {
    try {
      if (ESP32WiFiService.isConnected()) {
        await ESP32WiFiService.sendStreamDone('response.opus');
      }
    } catch (e) {
      console.warn('VPS|releaseFirmware failed:', e);
    }
  }

  // ── Listen for autonomous recordings pushed by ESP32 ─────────────────────

  /**
   * Subscribe to ESP32 TX characteristic and run the full pipeline for every
   * autonomous recording the hardware pushes:
   *   FILE:name:size\n  →  [binary chunks]  →  END:name\n  →  LISTENING\n
   *
   * The listener stays active indefinitely — each completed recording fires a
   * new pipeline run automatically. Call initialize() with a toyId first so
   * chat messages are stored against the correct toy.
   */
  async startListeningToToy(
    onProcessingComplete: (success: boolean, error?: string) => void,
    toyPersonality?: string,
    onStatus?: (status: PipelineStatus) => void
  ): Promise<void> {
    if (!ESP32WiFiService.isConnected()) {
      console.error('VoiceProcessingService: ESP32 not connected');
      return;
    }

    // Gemini Live mode: forward the mic stream live instead of buffering it.
    // The buffered autoReceive path below stays registered for the
    // store-and-forward protocol (recordings made while the app was away).
    if (this.config?.useGeminiLive) {
      this.registerLiveAudioHandler(onProcessingComplete, toyPersonality, onStatus);
    }

    ESP32WiFiService.setAutoReceiveHandler(async (filename, audioData) => {
      console.log(`VPS|WiFi audio received: ${filename} ${audioData.byteLength}B — useGeminiLive=${this.config?.useGeminiLive}`);
      const result = await this.processAudioFromToy(audioData, toyPersonality, onStatus);
      console.log(`VPS|pipeline result: success=${result.success} error=${result.error}`);
      onProcessingComplete(result.success, result.error || undefined);
    });

    // Subscribe to TX — drives the internal state machine + logs signals
    await ESP32WiFiService.subscribeToMessages((msg) => {
      if (msg.type === 'SAVED')    { console.log(`ESP32 saved: ${msg.filename}`); }
      if (msg.type === 'ERROR')    { console.error(`ESP32 error: ${msg.message}`); }
      if (msg.type === 'LISTENING'){ console.log('ESP32 ready to receive'); }
      if (msg.type === 'PLAYED')   { LatencyTrace.finish('played_received'); }
    });

    console.log('VoiceProcessingService: continuously listening for ESP32 recordings');
  }

  // ── WiFi connection helpers ───────────────────────────────────────────────

  private getEsp32HostCandidates(host?: string, discoveredHost?: string): string[] {
    const primary = host || this.config?.esp32Ip || '';
    const fallbackHosts = this.config?.esp32FallbackIps || ESP32_FALLBACK_IPS;

    return [primary, discoveredHost || '', ...fallbackHosts]
      .map(candidate => candidate.trim())
      .filter((candidate, index, candidates) => Boolean(candidate) && candidates.indexOf(candidate) === index);
  }

  async connectToESP32(ip?: string): Promise<boolean> {
    if (ESP32WiFiService.isConnected()) {
      console.log('VoiceProcessingService: ESP32 already connected, reusing TCP connection');
      return true;
    }

    const requestedHost = ip?.trim();
    const shouldDiscover = !requestedHost || requestedHost.endsWith('.local');
    const discovered = shouldDiscover
      ? await Esp32DiscoveryService.discoverHost(
          this.config?.esp32NsdServiceTypes || ESP32_NSD_SERVICE_TYPES
        )
      : null;
    const hosts = this.getEsp32HostCandidates(ip, discovered?.host);
    if (hosts.length === 0) {
      console.error('VoiceProcessingService: no ESP32 IP — set esp32Ip in voiceConfig or pass to connectToESP32()');
      return false;
    }

    const configuredPort = this.config?.esp32Port ?? 8765;
    for (const host of hosts) {
      const port = discovered?.host === host && discovered.port ? discovered.port : configuredPort;
      console.log(`VoiceProcessingService: connecting to ESP32 at ${host}:${port}`);
      const connected = await ESP32WiFiService.connect(host, port);
      if (connected) {
        return true;
      }
      console.warn(`VoiceProcessingService: failed to connect to ${host}:${port}`);
    }

    return false;
  }

  async reconnectToESP32(ip?: string): Promise<boolean> {
    return this.connectToESP32(ip);
  }

  async disconnectFromESP32(): Promise<void> {
    GeminiLiveService.disconnect();
    await ESP32WiFiService.disconnect();
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isReady(): boolean {
    if (!this.isInitialized || !ESP32WiFiService.isConnected()) return false;
    if (this.config?.useGeminiLive) return GeminiLiveService.isReady();
    return (
      (WhisperService.isReady() || GoogleSTTService.isReady()) &&
      LLMService.isReady() &&
      TTSService.isReady()
    );
  }

  getConfig(): VoiceProcessingConfig | null {
    return this.config;
  }
}

export default new VoiceProcessingService();
