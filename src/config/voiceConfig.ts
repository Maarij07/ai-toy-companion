// BLE / NUS UUIDs are hardcoded inside ESP32Service — nothing to configure here.
// Only AI-layer options are exposed.

/**
 * Gemini Live prototype — set your Gemini API key here.
 * The key is used only on the device (direct WebSocket to Google).
 * For production this moves to a relay server so the key is never in the app.
 * Get a key at: https://aistudio.google.com/app/apikey
 */
const GEMINI_LIVE_API_KEY = 'AIzaSyCueYKY9LYW94B7pn-I9UTjENZkBZcG8e8';

/**
 * Set to true  → use Gemini Live (single WebSocket, replaces STT+LLM+TTS)
 * Set to false → use the original STT → LLM → TTS Supabase edge function pipeline
 */
const USE_GEMINI_LIVE = true;

const voiceConfig = {
  whisperModelPath: process.env.WHISPER_MODEL_PATH || undefined,
  ttsLanguage: process.env.TTS_LANGUAGE || 'en-US',
  geminiApiKey: GEMINI_LIVE_API_KEY,
  useGeminiLive: USE_GEMINI_LIVE,
};

export default voiceConfig;
