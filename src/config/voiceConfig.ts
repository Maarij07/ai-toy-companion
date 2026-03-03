// BLE / NUS UUIDs are hardcoded inside ESP32Service — nothing to configure here.
// Only AI-layer options are exposed.
const voiceConfig = {
  whisperModelPath: process.env.WHISPER_MODEL_PATH || undefined,
  ttsLanguage: process.env.TTS_LANGUAGE || 'en-US',
};

export default voiceConfig;
