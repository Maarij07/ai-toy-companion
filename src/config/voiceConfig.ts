/**
 * Gemini Live prototype — set your Gemini API key here.
 * Get a key at: https://aistudio.google.com/app/apikey
 */
const GEMINI_LIVE_API_KEY = 'AIzaSyCueYKY9LYW94B7pn-I9UTjENZkBZcG8e8';

/**
 * Set to true  → use Gemini Live (single WebSocket, replaces STT+LLM+TTS)
 * Set to false → use the original STT → LLM → TTS Supabase edge function pipeline
 */
const USE_GEMINI_LIVE = true;

/**
 * ESP32 WiFi TCP config.
 * ESP32_IP: ESP32 mDNS hostname or IP address.
 *   e.g. "esp32audio.local" or "192.168.1.42"
 * Both the phone and ESP32 must be on the same WiFi network (or phone hotspot).
 */
export const ESP32_IP   = 'esp32audio.local'; // ESP32 mDNS hostname
export const ESP32_PORT = 8765;           // matches TCP_PORT in firmware
// Firmware v2 advertises MDNS.addService("tcp", "tcp", ESP32_PORT),
// which maps to DNS-SD service type "_tcp._tcp.".
export const ESP32_NSD_SERVICE_TYPES = ['_tcp._tcp.', '_esp32audio._tcp.'];
export const ESP32_FALLBACK_IPS = ['192.168.1.44']; // fallback when Android cannot resolve mDNS

const voiceConfig = {
  whisperModelPath: process.env.WHISPER_MODEL_PATH || undefined,
  ttsLanguage: process.env.TTS_LANGUAGE || 'en-US',
  geminiApiKey: GEMINI_LIVE_API_KEY,
  useGeminiLive: USE_GEMINI_LIVE,
  esp32Ip:   ESP32_IP,
  esp32Port: ESP32_PORT,
  esp32NsdServiceTypes: ESP32_NSD_SERVICE_TYPES,
  esp32FallbackIps: ESP32_FALLBACK_IPS,
};

export default voiceConfig;
