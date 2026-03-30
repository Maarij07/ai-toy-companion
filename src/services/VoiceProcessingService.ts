import ESP32Service from './ESP32Service';
import WhisperService from './WhisperService';
import GoogleSTTService from './GoogleSTTService';
import LLMService from './LLMService';
import TTSService from './TTSService';
import ChatService from './ChatService';
import GeminiLiveService from './GeminiLiveService';

// Config only covers AI services — BLE / NUS UUIDs are internal to ESP32Service
interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
  toyId?: string;        // Current toy ID for chat logging
  geminiApiKey?: string; // Set to enable Gemini Live prototype
  useGeminiLive?: boolean;
}

// Status emitted during pipeline execution so UI can update in real time
export type PipelineStatus = 'transcribing' | 'thinking' | 'saving' | 'sending' | 'idle';

class VoiceProcessingService {
  private config: VoiceProcessingConfig | null = null;
  private isInitialized: boolean = false;

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
   * Step 4 — Downsample 24 kHz → 16 kHz + wrap in WAV header
   * Step 5 — Send WAV to ESP32 over BLE
   */
  private async processWithGeminiLive(
    audioData: ArrayBuffer,
    toyPersonality: string,
    onStatus?: (status: PipelineStatus) => void
  ): Promise<{ success: boolean; error: string }> {
    try {
      console.log(`GeminiLive pipeline start — audio: ${audioData.byteLength} bytes`);

      if (audioData.byteLength < 200) {
        return { success: false, error: 'empty_recording' };
      }

      // ── Step 1: Extract PCM from live-stream buffer ───────────────────────
      // The firmware sends a 44-byte WAV header (with placeholder dataSize=0xFFFFFFFF)
      // followed by raw 16-bit 16 kHz mono PCM. Skip the header directly — no
      // WAV parsing needed since format is fixed by the ESP32 firmware config.
      const WAV_HEADER_BYTES = 44;
      // Round down to even bytes — 509-byte BLE chunks (MTU 512−3) can produce odd totals
      const rawPcm = audioData.byteLength > WAV_HEADER_BYTES
        ? audioData.slice(WAV_HEADER_BYTES)
        : audioData;
      const evenLen = rawPcm.byteLength & ~1;
      const pcmData = evenLen < rawPcm.byteLength ? rawPcm.slice(0, evenLen) : rawPcm;

      const pcmSamples = pcmData.byteLength / 2; // 16-bit = 2 bytes per sample
      const durationMs = Math.round((pcmSamples / 16000) * 1000);
      console.log(`GeminiLive: PCM ${pcmData.byteLength} bytes = ${durationMs} ms @ 16kHz 16-bit mono`);
      this.logPCMEnergy(pcmData);

      // Require at least 500 ms of audio — Gemini Live won't respond to shorter clips
      if (durationMs < 500) {
        console.warn(`GeminiLive: audio too short (${durationMs} ms) — hold button for 2+ seconds`);
        onStatus?.('idle');
        return { success: false, error: 'empty_recording' };
      }

      // ── Step 2: Connect to Gemini Live (reuses session if already open) ──
      onStatus?.('thinking');
      console.log('GeminiLive: connecting to WebSocket...');
      const personality =
        toyPersonality ||
        'You are a friendly AI toy companion for children. Respond warmly, in a child-friendly way. Keep answers short and fun.';

      await GeminiLiveService.connect(personality);
      console.log('GeminiLive: session connected — streaming PCM...');

      // ── Step 3: Stream PCM + signal end of turn ──────────────────────────
      GeminiLiveService.streamPcm(pcmData);
      console.log('GeminiLive: PCM streamed — waiting for AI response (up to 30s)...');
      const { pcm: responsePcm24, text: responseText } = await GeminiLiveService.endUserTurn(30_000);

      if (!responsePcm24 || responsePcm24.byteLength === 0) {
        onStatus?.('idle');
        return { success: false, error: 'Gemini Live returned empty audio' };
      }
      console.log(`GeminiLive: got response — ${responsePcm24.byteLength} bytes @ 24kHz`);

      // ── Step 3.5: Save chat to DB if we have a toyId and text ────────────
      onStatus?.('saving');
      if (this.config?.toyId && responseText) {
        const userSave = await ChatService.saveMessage(this.config.toyId, 'user', '[Voice message]');
        const aiSave   = await ChatService.saveMessage(this.config.toyId, 'assistant', responseText);
        if (!userSave.success || !aiSave.success) {
          console.warn('GeminiLive: chat save failed:', userSave.error || aiSave.error);
        } else {
          console.log(`GeminiLive: chat saved for toy ${this.config.toyId}`);
        }
      }

      // ── Step 4: Downsample 24 kHz → 16 kHz + build WAV ──────────────────
      const responsePcm16 = GeminiLiveService.downsample24to16(responsePcm24);
      const responseWav   = GeminiLiveService.buildWav16k(responsePcm16);
      console.log(`GeminiLive: WAV ready — ${responseWav.byteLength} bytes @ 16kHz for ESP32`);

      // ── Step 5: Send WAV back to ESP32 ───────────────────────────────────
      onStatus?.('sending');
      if (ESP32Service.isConnected()) {
        await ESP32Service.sendFileToESP32('response.wav', responseWav);
        console.log(`GeminiLive: response.wav (${responseWav.byteLength} B) sent to ESP32`);
      } else {
        console.warn('GeminiLive: ESP32 not connected — skipping BLE send');
      }

      onStatus?.('idle');
      return { success: true, error: '' };
    } catch (error) {
      console.error('GeminiLive pipeline error:', error);
      onStatus?.('idle');
      return { success: false, error: (error as Error).message };
    }
  }

  // ── Full pipeline: audio bytes → STT → LLM → chat save → TTS → BLE ────────

  /**
   * Routes to Gemini Live or the standard STT → LLM → TTS pipeline depending
   * on whether useGeminiLive is set in config.
   *
   * Standard pipeline steps:
   * Step 1 — STT : Whisper (local) → Google STT (edge fn) fallback
   * Step 2 — LLM : Gemini via Supabase edge function
   * Step 3 — CHAT: Save user + AI messages to DB (always — before TTS/BLE)
   * Step 4 — TTS : Resemble AI → WAV ArrayBuffer  (best-effort)
   * Step 5 — BLE : Send WAV to ESP32 in 500-byte chunks (best-effort)
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
            'You are a friendly AI toy companion for children. Respond warmly and keep answers short.',
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
          'You are a friendly AI toy companion. Respond warmly and in a child-friendly way. Keep replies short.',
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

      // ── Step 4 & 5: TTS + BLE — best-effort, BLE failure won't lose chat ─
      onStatus?.('sending');
      if (TTSService.isReady() && ESP32Service.isConnected()) {
        const ttsResult = await TTSService.speak(llmResult.response);
        if (ttsResult.success && ttsResult.audioData) {
          await ESP32Service.sendFileToESP32('response.wav', ttsResult.audioData);
          console.log(`response.wav (${ttsResult.audioData.byteLength} B) sent to ESP32`);
        } else {
          console.warn('TTS failed, skipping BLE send:', ttsResult.error);
        }
      } else {
        console.warn(
          'TTS/BLE skipped — TTS ready:', TTSService.isReady(),
          'BLE connected:', ESP32Service.isConnected()
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
    if (!ESP32Service.isConnected()) {
      console.error('VoiceProcessingService: ESP32 not connected');
      return;
    }

    // Register auto-receive handler BEFORE subscribing so no message is missed
    ESP32Service.setAutoReceiveHandler(async (filename, audioData) => {
      console.log(`Received ${filename} (${audioData.byteLength} bytes) — running pipeline`);
      const result = await this.processAudioFromToy(audioData, toyPersonality, onStatus);
      onProcessingComplete(result.success, result.error || undefined);
    });

    // Subscribe to TX — drives the internal state machine + logs signals
    await ESP32Service.subscribeToMessages((msg) => {
      if (msg.type === 'SAVED')    { console.log(`ESP32 saved: ${msg.filename}`); }
      if (msg.type === 'ERROR')    { console.error(`ESP32 error: ${msg.message}`); }
      if (msg.type === 'LISTENING'){ console.log('ESP32 ready to receive'); }
    });

    console.log('VoiceProcessingService: continuously listening for ESP32 recordings');
  }

  // ── BLE connection helpers ────────────────────────────────────────────────

  async connectToESP32(): Promise<boolean> {
    return ESP32Service.connect();
  }

  async reconnectToESP32(): Promise<boolean> {
    return ESP32Service.reconnect();
  }

  async disconnectFromESP32(): Promise<void> {
    GeminiLiveService.disconnect(); // close Gemini Live session when toy disconnects
    await ESP32Service.disconnect();
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isReady(): boolean {
    if (!this.isInitialized || !ESP32Service.isConnected()) return false;
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
