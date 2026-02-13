# Hardware Integration Guide - Toy Firmware

## Overview

This guide is for the hardware/firmware team developing the AI toy companion. The toy needs to handle audio recording, BLE communication, and audio playback.

## Required Hardware Components

1. **Microphone**: For capturing child's voice
2. **Speaker**: For playing AI responses
3. **Bluetooth Module**: BLE-capable (ESP32 recommended)
4. **Microcontroller**: ESP32 or similar with BLE support
5. **Audio Codec**: For WAV encoding/decoding

## BLE Service Configuration

### Service UUID
```
12345678-1234-1234-1234-123456789ABC
```

### Characteristics

#### 1. Audio RX Characteristic (Toy → Mobile)
- **UUID**: `audio-rx-uuid` (replace with your actual UUID)
- **Properties**: NOTIFY
- **Purpose**: Send audio chunks FROM toy microphone TO mobile app
- **Data Format**: Base64-encoded WAV audio chunks
- **Max Chunk Size**: 512 bytes (adjust based on your BLE MTU)

#### 2. Audio TX Characteristic (Mobile → Toy)
- **UUID**: `audio-tx-uuid` (replace with your actual UUID)
- **Properties**: WRITE
- **Purpose**: Receive audio chunks FROM mobile app TO toy speaker
- **Data Format**: Base64-encoded WAV audio chunks
- **Max Chunk Size**: 512 bytes

## Audio Format Specifications

### Recording (Microphone → Mobile)
```
Format: WAV (PCM)
Sample Rate: 16000 Hz (16 kHz)
Bit Depth: 16-bit
Channels: Mono (1 channel)
Encoding: LINEAR16 (PCM)
```

### Playback (Mobile → Speaker)
```
Format: WAV (PCM)
Sample Rate: 22050 Hz (22.05 kHz)
Bit Depth: 16-bit
Channels: Mono (1 channel)
Encoding: LINEAR16 (PCM)
```

## Communication Protocol

### 1. Recording Flow (Toy → Mobile)

```
1. User presses button or voice activation detected
2. Start recording audio from microphone
3. Encode audio as WAV chunks (512 bytes each)
4. Base64 encode each chunk
5. Send via BLE NOTIFY on Audio RX characteristic
6. When recording complete, send end marker: 0xFF 0xFF 0xFF 0xFF
7. Wait for response audio chunks
```

### 2. Playback Flow (Mobile → Toy)

```
1. Listen for WRITE events on Audio TX characteristic
2. Receive base64-encoded audio chunks
3. Decode base64 to binary
4. Buffer chunks until end marker received: 0xFF 0xFF 0xFF 0xFF
5. Decode WAV audio
6. Play through speaker
```

## Example Firmware Pseudocode

### Recording and Sending

```cpp
// Start recording
void startRecording() {
    audioBuffer.clear();
    isRecording = true;
    
    while (isRecording) {
        // Read from microphone
        int16_t samples[256];
        readMicrophone(samples, 256);
        
        // Add to buffer
        audioBuffer.append(samples, 256);
        
        // If buffer >= 512 bytes, send chunk
        if (audioBuffer.size() >= 512) {
            uint8_t chunk[512];
            audioBuffer.read(chunk, 512);
            
            // Base64 encode
            char encoded[700];
            base64_encode(chunk, 512, encoded);
            
            // Send via BLE
            audioRxCharacteristic.notify(encoded);
        }
    }
    
    // Send remaining data
    if (audioBuffer.size() > 0) {
        uint8_t chunk[audioBuffer.size()];
        audioBuffer.read(chunk, audioBuffer.size());
        
        char encoded[audioBuffer.size() * 2];
        base64_encode(chunk, audioBuffer.size(), encoded);
        audioRxCharacteristic.notify(encoded);
    }
    
    // Send end marker
    uint8_t endMarker[] = {0xFF, 0xFF, 0xFF, 0xFF};
    char encodedMarker[10];
    base64_encode(endMarker, 4, encodedMarker);
    audioRxCharacteristic.notify(encodedMarker);
}

// Receiving and Playing
void onAudioTxWrite(const char* base64Data, size_t length) {
    // Decode base64
    uint8_t decoded[length];
    size_t decodedLen = base64_decode(base64Data, decoded);
    
    // Check for end marker
    if (decodedLen == 4 && 
        decoded[0] == 0xFF && 
        decoded[1] == 0xFF && 
        decoded[2] == 0xFF && 
        decoded[3] == 0xFF) {
        // End of audio, start playback
        playAudioBuffer();
        return;
    }
    
    // Add to playback buffer
    playbackBuffer.append(decoded, decodedLen);
}

void playAudioBuffer() {
    // Decode WAV header
    WAVHeader header;
    playbackBuffer.readHeader(&header);
    
    // Play audio samples
    while (playbackBuffer.hasData()) {
        int16_t samples[256];
        playbackBuffer.read(samples, 256);
        playThroughSpeaker(samples, 256);
    }
    
    playbackBuffer.clear();
}
```

## ESP32 Example (Arduino)

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <driver/i2s.h>

#define SERVICE_UUID        "12345678-1234-1234-1234-123456789ABC"
#define AUDIO_RX_CHAR_UUID  "audio-rx-uuid"
#define AUDIO_TX_CHAR_UUID  "audio-tx-uuid"

BLECharacteristic *audioRxCharacteristic;
BLECharacteristic *audioTxCharacteristic;

class AudioTxCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *characteristic) {
        std::string value = characteristic->getValue();
        
        if (value.length() > 0) {
            // Decode and process audio chunk
            processAudioChunk(value.c_str(), value.length());
        }
    }
};

void setup() {
    Serial.begin(115200);
    
    // Initialize BLE
    BLEDevice::init("AI_Toy_Companion");
    BLEServer *server = BLEDevice::createServer();
    BLEService *service = server->createService(SERVICE_UUID);
    
    // Audio RX (Notify)
    audioRxCharacteristic = service->createCharacteristic(
        AUDIO_RX_CHAR_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    audioRxCharacteristic->addDescriptor(new BLE2902());
    
    // Audio TX (Write)
    audioTxCharacteristic = service->createCharacteristic(
        AUDIO_TX_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    audioTxCharacteristic->setCallbacks(new AudioTxCallbacks());
    
    service->start();
    
    // Start advertising
    BLEAdvertising *advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(SERVICE_UUID);
    advertising->start();
    
    Serial.println("BLE Service Started");
    
    // Initialize I2S for audio
    setupI2S();
}

void loop() {
    // Check for button press or voice activation
    if (recordButtonPressed()) {
        recordAndSendAudio();
    }
    delay(100);
}
```

## Testing Checklist

- [ ] BLE service advertises with correct UUID
- [ ] Mobile app can discover and connect to toy
- [ ] Audio RX characteristic sends notifications
- [ ] Audio TX characteristic accepts writes
- [ ] Microphone captures clear audio at 16kHz
- [ ] Audio chunks are properly base64 encoded
- [ ] End marker is sent after recording
- [ ] Speaker plays received audio at 22.05kHz
- [ ] Audio quality is acceptable
- [ ] Latency is under 3 seconds for full pipeline

## Troubleshooting

### No BLE Connection
- Check service UUID matches exactly
- Verify BLE advertising is active
- Check mobile app permissions

### No Audio Received on Mobile
- Verify Audio RX characteristic has NOTIFY property
- Check base64 encoding is correct
- Verify end marker is sent

### No Audio Playback on Toy
- Verify Audio TX characteristic has WRITE property
- Check base64 decoding
- Verify WAV format compatibility

### Poor Audio Quality
- Check sample rate matches specification
- Verify bit depth is 16-bit
- Check for buffer overruns
- Adjust chunk size if needed

## Performance Optimization

1. **Reduce Latency**:
   - Use smaller chunk sizes (256 bytes)
   - Increase BLE connection interval
   - Start playback before all chunks received (streaming)

2. **Improve Audio Quality**:
   - Use noise cancellation on microphone
   - Implement automatic gain control
   - Add audio compression (optional)

3. **Battery Life**:
   - Use voice activation detection
   - Sleep between interactions
   - Optimize BLE power settings

## Support

For questions or issues:
1. Check mobile app logs for BLE errors
2. Use BLE scanner app to verify service/characteristics
3. Monitor serial output from toy for debugging
4. Test with known-good audio files first
