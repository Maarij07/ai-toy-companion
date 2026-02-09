// Configuration interface for voice processing
interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
  esp32ServiceUUID: string;
}

// Load configuration from environment variables
const voiceConfig: VoiceProcessingConfig = {
  whisperModelPath: process.env.WHISPER_MODEL_PATH || undefined,
  ttsLanguage: process.env.TTS_LANGUAGE || 'en-US',
  esp32ServiceUUID: process.env.ESP32_SERVICE_UUID || '12345678-1234-1234-1234-123456789ABC',
};

export default voiceConfig;
