import ESP32Service from './ESP32Service';
import WhisperService from './WhisperService';
import GoogleSTTService from './GoogleSTTService';
import LLMService from './LLMService';
import TTSService from './TTSService';

// Config only covers AI services — BLE / NUS UUIDs are internal to ESP32Service
interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
}

class VoiceProcessingService {
  private config: VoiceProcessingConfig | null = null;
  private isInitialized: boolean = false;

  // ── Initialise AI services ─────────────────────────────────────────────────

  async initialize(config: VoiceProcessingConfig): Promise<boolean> {
    try {
      this.config = config;

      const initPromises: Promise<boolean>[] = [];

      // Whisper.cpp (local STT — native module not yet built, will fall through)
      if (config.whisperModelPath) {
        initPromises.push(
          WhisperService.initialize({ modelPath: config.whisperModelPath, language: 'en' })
        );
      }

      // Google STT (Supabase edge function fallback)
      initPromises.push(GoogleSTTService.initialize({ languageCode: 'en-US' }));

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

  // ── Full pipeline: audio bytes → STT → LLM → TTS → BLE chunks back ────────

  /**
   * Step 1 — STT: Whisper (local) → Google STT (edge fn) fallback
   * Step 2 — LLM: Gemini via Supabase edge function
   * Step 3 — TTS: Resemble AI via Supabase edge function → WAV ArrayBuffer
   * Step 4 — BLE: send WAV back to ESP32 in 500-byte chunks via ESP32Service
   */
  async processAudioFromToy(
    audioData: ArrayBuffer,
    toyPersonality?: string
  ): Promise<{ success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: 'VoiceProcessingService not initialised' };
      }

      console.log(`Pipeline start — audio: ${audioData.byteLength} bytes`);

      // ── Step 1: STT ──────────────────────────────────────────────────────
      let sttResult = await WhisperService.transcribe(audioData);

      if (!sttResult.success) {
        console.log('Whisper unavailable — falling back to Google STT');
        sttResult = await GoogleSTTService.transcribe(audioData);
      }

      if (!sttResult.success) {
        return { success: false, error: `STT failed: ${sttResult.error}` };
      }

      console.log(`STT transcript: "${sttResult.text}"`);

      // ── Step 2: LLM ──────────────────────────────────────────────────────
      if (!LLMService.isReady()) {
        return { success: false, error: 'LLM service not ready' };
      }

      const llmResult = await LLMService.getResponse(sttResult.text, {
        toyPersonality:
          toyPersonality ||
          'You are a friendly AI toy companion. Respond warmly and in a child-friendly way. Keep replies short.',
        conversationId: `toy-${Date.now()}`,
      });

      if (!llmResult.success) {
        return { success: false, error: `LLM failed: ${llmResult.error}` };
      }

      console.log(`LLM response: "${llmResult.response}"`);

      // ── Step 3: TTS ──────────────────────────────────────────────────────
      if (!TTSService.isReady()) {
        return { success: false, error: 'TTS service not ready' };
      }

      const ttsResult = await TTSService.speak(llmResult.response);

      if (!ttsResult.success || !ttsResult.audioData) {
        return { success: false, error: `TTS failed: ${ttsResult.error}` };
      }

      console.log(`TTS WAV: ${ttsResult.audioData.byteLength} bytes`);

      // ── Step 4: BLE — send WAV to ESP32 in 500-byte chunks ───────────────
      if (!ESP32Service.isConnected()) {
        return { success: false, error: 'ESP32 not connected' };
      }

      await ESP32Service.sendFileToESP32('response.wav', ttsResult.audioData);
      console.log('Pipeline complete — response.wav sent to ESP32');

      return { success: true, error: '' };
    } catch (error) {
      console.error('VoiceProcessingService pipeline error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // ── Listen for autonomous recordings pushed by ESP32 ─────────────────────

  /**
   * Register on the TX characteristic.
   * Whenever ESP32 finishes a recording it pushes:
   *   FILE:name:size\n  →  [binary chunks]  →  END:name\n  →  LISTENING\n
   *
   * ESP32Service assembles the chunks and calls onProcessingComplete after
   * the full pipeline (STT → LLM → TTS → BLE send) completes.
   */
  async startListeningToToy(
    onProcessingComplete: (success: boolean, error?: string) => void,
    toyPersonality?: string
  ): Promise<void> {
    if (!ESP32Service.isConnected()) {
      console.error('VoiceProcessingService: ESP32 not connected');
      return;
    }

    // Register auto-receive handler BEFORE subscribing so no message is missed
    ESP32Service.setAutoReceiveHandler(async (filename, audioData) => {
      console.log(`Received ${filename} (${audioData.byteLength} bytes) — running pipeline`);
      const result = await this.processAudioFromToy(audioData, toyPersonality);
      onProcessingComplete(result.success, result.error || undefined);
    });

    // Subscribe to TX — drives the internal state machine + logs signals
    await ESP32Service.subscribeToMessages((msg) => {
      if (msg.type === 'SAVED')    { console.log(`ESP32 saved: ${msg.filename}`); }
      if (msg.type === 'ERROR')    { console.error(`ESP32 error: ${msg.message}`); }
      if (msg.type === 'LISTENING'){ console.log('ESP32 ready to receive'); }
    });

    console.log('VoiceProcessingService: listening for recordings from ESP32');
  }

  // ── BLE connection helpers ────────────────────────────────────────────────

  async connectToESP32(): Promise<boolean> {
    return ESP32Service.connect();
  }

  async disconnectFromESP32(): Promise<void> {
    await ESP32Service.disconnect();
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isReady(): boolean {
    return (
      this.isInitialized &&
      ESP32Service.isConnected() &&
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
