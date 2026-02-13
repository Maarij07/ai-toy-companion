# Architecture Update - Toy Microphone to Mobile Pipeline

## New Architecture Flow

```
TOY HARDWARE (Microphone) 
    ↓ (WAV chunks via BLE)
MOBILE APP (React Native)
    ↓ (Base64 audio)
SUPABASE EDGE FUNCTION (STT - Google Speech-to-Text)
    ↓ (Transcribed text)
SUPABASE EDGE FUNCTION (LLM - Gemini)
    ↓ (AI response text)
SUPABASE EDGE FUNCTION (TTS - Resemble)
    ↓ (WAV audio chunks)
MOBILE APP (React Native)
    ↓ (Audio chunks via BLE)
TOY HARDWARE (Speaker)
```

## Key Changes

### 1. Audio Recording Location
- **OLD**: Mobile app records audio
- **NEW**: Toy microphone records audio, sends WAV chunks to mobile via BLE

### 2. STT Processing
- **Removed**: Whisper.cpp local processing
- **Using**: Google Speech-to-Text API (via Supabase Edge Function)
- **API Key**: Stored in Supabase Edge Function environment variables

### 3. LLM Processing
- **Using**: Google Gemini API (via Supabase Edge Function)
- **API Key**: Stored in Supabase Edge Function environment variables

### 4. TTS Processing
- **Using**: Resemble AI API (via Supabase Edge Function)
- **API Keys**: Stored in Supabase Edge Function environment variables
- **Output Format**: WAV audio for hardware compatibility

### 5. Environment Variables
- **Removed**: All API keys from local .env file
- **Using**: Supabase client configuration only (URL + Anon Key)
- **All API Keys**: Managed in Supabase Dashboard → Edge Functions → Secrets

## BLE Characteristics

### Required UUIDs (Configure in your toy firmware):

```typescript
ESP32_SERVICE_UUID: "12345678-1234-1234-1234-123456789ABC"
AUDIO_RX_CHARACTERISTIC: "audio-rx-uuid" // Mobile receives audio FROM toy
AUDIO_TX_CHARACTERISTIC: "audio-tx-uuid" // Mobile sends audio TO toy
```

### Audio Chunk Protocol:

1. **Receiving from Toy**:
   - Toy sends WAV audio chunks (base64 encoded)
   - Mobile accumulates chunks until end marker
   - End marker: `0xFF 0xFF 0xFF 0xFF`

2. **Sending to Toy**:
   - Mobile sends audio in 512-byte chunks
   - Each chunk is base64 encoded
   - Ends with marker: `0xFF 0xFF 0xFF 0xFF`

## Updated Services

### VoiceProcessingService
- `processAudioFromToy()`: Main pipeline handler
- `startListeningToToy()`: Subscribe to toy microphone chunks
- Removed Whisper dependency

### BLEService
- `subscribeToAudioChunks()`: Listen to toy microphone
- `sendAudioChunks()`: Send TTS audio to toy speaker

### GoogleSTTService
- Removed local env dependencies
- Uses Supabase client config only

### LLMService
- Removed local env dependencies
- Uses Supabase client config only
- Calls Gemini via Edge Function

### TTSService
- Removed local env dependencies
- Uses Supabase client config only
- Calls Resemble via Edge Function

## Supabase Edge Function Environment Variables

Configure these in Supabase Dashboard → Edge Functions → Secrets:

```bash
# Google Speech-to-Text
GOOGLE_STT_API_KEY=your_google_stt_api_key

# Google Gemini LLM
GEMINI_API_KEY=your_gemini_api_key

# Resemble AI TTS
RESEMBLE_API_KEY=your_resemble_api_key
RESEMBLE_DEFAULT_PROJECT_ID=your_project_id
RESEMBLE_DEFAULT_VOICE_ID=your_voice_id
```

## Mobile App Configuration

Only these are needed in the mobile app:

```typescript
// src/config/supabase.ts
const supabaseUrl = 'https://hshnsjiewmgwjjpzrclu.supabase.co';
const supabaseAnonKey = 'your_anon_key';
```

## Usage Example

```typescript
import VoiceProcessingService from './services/VoiceProcessingService';

// Initialize service
await VoiceProcessingService.initialize({
  esp32ServiceUUID: '12345678-1234-1234-1234-123456789ABC',
  audioRxCharacteristicUUID: 'audio-rx-uuid',
  audioTxCharacteristicUUID: 'audio-tx-uuid',
  ttsLanguage: 'en-US'
});

// Connect to toy
await VoiceProcessingService.connectToESP32();

// Start listening to toy microphone
await VoiceProcessingService.startListeningToToy(
  (success, error) => {
    if (success) {
      console.log('Voice processing completed!');
    } else {
      console.error('Error:', error);
    }
  },
  'You are a friendly bear toy. Respond warmly to children.'
);
```

## Testing Checklist

- [ ] Configure Supabase Edge Function secrets
- [ ] Update toy firmware with correct BLE UUIDs
- [ ] Test audio chunk transmission from toy to mobile
- [ ] Test STT transcription via Edge Function
- [ ] Test Gemini LLM responses via Edge Function
- [ ] Test Resemble TTS generation via Edge Function
- [ ] Test audio chunk transmission from mobile to toy
- [ ] Verify end-to-end pipeline latency
- [ ] Test error handling for each service

## Security Benefits

1. **No API Keys in Mobile App**: All sensitive keys in Supabase Edge Functions
2. **Server-Side Processing**: API calls made from Supabase, not client
3. **Authentication**: All Edge Function calls require valid user session
4. **Rate Limiting**: Can be implemented at Edge Function level
5. **Audit Trail**: All interactions logged in Supabase database
