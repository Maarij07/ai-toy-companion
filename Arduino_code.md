// ============================================================
//  INMP441 WAV Recorder + BLE UART + MAX98357A Playback — v15.0
//  ESP32-S3  |  LittleFS  |  NimBLE 2.x  |  Opus decode
//
//  WIRING — INMP441 (microphone) on I2S_NUM_0:
//    SCK  → GPIO 40
//    WS   → GPIO 41
//    SD   → GPIO 42
//    VDD  → 3.3V  |  GND → GND  |  L/R → GND
//
//  WIRING — MAX98357A (speaker) on I2S_NUM_1:
//    BCLK → GPIO 15
//    LRC  → GPIO 16
//    DIN  → GPIO 17
//    VIN  → 5V (more volume) or 3.3V
//    GND  → GND
//    SD   → leave floating or 3.3V (enables amp)
//
//  FLOW:
//  1. ESP32 records voice → saves to LittleFS
//  2. App sends SENDALL → ESP32 streams all files → deletes them
//  3. After ALL files sent → ESP32 sends LISTENING to app
//  4. App sends length-prefixed raw Opus packets in 500-byte BLE chunks
//  5. App sends DONE:filename.opus
//  6. ESP32 decodes Opus from LittleFS → plays on MAX98357A speaker
//  7. ESP32 sends PLAYED:filename.opus back to app
//
//  v15.0 — Opus decode replaces WAV playback
//
//  WHY OPUS:
//    WAV 16kHz 16-bit mono = 32,000 bytes/sec → 240KB for 7.5s → 483 BLE chunks → ~4.8s transfer
//    Opus 24kbps mono      =  3,000 bytes/sec →  22KB for 7.5s →  45 BLE chunks → ~0.45s transfer
//    10× smaller file, near-transparent voice quality, no perceptible degradation.
//
//  OPUS FRAMING (what app must send):
//    Raw Opus packets with 2-byte little-endian length prefix per packet.
//    NO Ogg container — raw packets only. This avoids Ogg parser on ESP32.
//    Format: [uint16_t len][len bytes of Opus data][uint16_t len][...] ...
//    Frame size: 20ms (320 samples at 16kHz) — standard for TTS.
//    The full file is just this sequence of length-prefixed packets.
//
//  DECODE PERFORMANCE:
//    ESP32-S3 LX7 @ 240MHz decodes Opus at ~0.004ms per 20ms frame.
//    375 frames for 7.5s audio = ~1.5ms total decode overhead.
//    No buffer needed — decode → i2s_write directly per frame.
//    I2S DMA handles timing naturally.
//
//  ARDUINO LIBRARY REQUIRED:
//    Install: pschatzmann/arduino-libopus
//    Arduino IDE: Sketch → Include Library → Manage Libraries → "libopus"
//    PlatformIO:  lib_deps = pschatzmann/arduino-libopus
//
//  APP SIDE TTS SETTINGS:
//    ElevenLabs:  output_format = "opus_16000"
//    OpenAI TTS:  response_format = "opus"
//    Google TTS:  audioEncoding = "OGG_OPUS", sampleRateHertz = 16000
//    (App must strip Ogg container and send raw length-prefixed packets)
//
//  v13.0 SOLUTION (base) — LittleFS-first TTS receive:
//    BLE onWrite() → f.write() to /tts_rx.opus  (no tasks, no races)
//    DONE received → close file → playOpusFromLittleFS()
//    Decode loop: read 2-byte len → read packet → opus_decode → upmix → i2s_write
//
//  COMMANDS:
//
//  v10.0 CHANGES — fixes distorted / silent BLE→Speaker streaming:
//
//  FIX 1 — Decouple BLE from I2S (root cause of distortion):
//    Old: streamChunkToSpeaker() called i2s_write() directly from
//         BLE onWrite() callback → blocked BLE stack → jitter → stutter
//    New: BLE callback only enqueues into a FreeRTOS ring buffer.
//         spkWriterTask() on Core 1 (priority 5) drains to I2S at a
//         perfectly steady rate. BLE and I2S are fully decoupled.
//
//  FIX 2 — DONE packet race condition (root cause of silence):
//    Old: exitStreamPlayback() stopped immediately on DONE, before the
//         ring buffer had time to drain → prebuffer never reached
//         threshold → writer task never started → silence
//    New: exitStreamPlayback() waits for ring buffer to fully drain
//         before zeroing I2S. PLAYED: is only sent after real playback.
//
//  FIX 3 — use_apll=true for cleaner I2S clock (reduces metallic tone)
//
//  v11.0 CHANGES — fixes audio cut-off before amp finishes playing:
//
//  ROOT CAUSE (confirmed via serial log analysis):
//    Ring buffer drained in ~0ms → i2s_zero_dma_buffer() fired immediately
//    after DONE arrived. But the I2S DMA ring (16 bufs × 512 samples)
//    still held ~512ms of audio that the MAX98357A amp hadn't played yet.
//    Zeroing DMA mid-playback = silent/clipped output.
//
//  FIX 4 — DMA flush delay in exitStreamPlayback():
//    After ring buffer drains, wait for the full I2S DMA pipeline to
//    empty before calling i2s_zero_dma_buffer(). Delay is computed
//    from actual DMA config (dma_buf_count × dma_buf_len) so it stays
//    accurate if you change those values.
//    Formula: (dma_buf_count * dma_buf_len * 1000) / sample_rate ms
//    = (16 * 512 * 1000) / 16000 = 512ms + 150ms safety margin.
//
//  FIX 5 — spkWriterTask prebuffer gate made stream-end safe:
//    Added spkDraining flag so the writer task keeps draining to I2S
//    even after spkStreaming goes false (DONE received). Without this,
//    the task could idle-reset prebufReady and stop writing while DMA
//    still had data to flush. Now it drains fully before resetting.
//
//  COMMANDS:
//  LIST                → show all recorded files
//  SENDALL             → send all files + auto-listen after
//  SEND:rec_0000.wav   → send one file (no auto-listen)
//  STATUS              → flash usage + current state + ring buf level
//  STREAM_MODE         → test: send WAV chunks then DONE:filename.wav
//  ACK_ON / ACK_OFF    → flow control for file transfer
//  FORMAT              → wipe all recordings
//  HELP                → show commands
// ============================================================

#include <Arduino.h>
#include <driver/i2s.h>
#include <NimBLEDevice.h>
#include "FS.h"
#include "LittleFS.h"
#include <math.h>           // for sinf() — used by startup tone
#include "opus.h"           // arduino-libopus by pschatzmann

// ── INMP441 — I2S_NUM_0 (microphone input) ───────────────────
#define MIC_SCK_PIN   40
#define MIC_WS_PIN    41
#define MIC_SD_PIN    42

// ── MAX98357A — I2S_NUM_1 (speaker output) ───────────────────
#define SPK_BCLK_PIN  15
#define SPK_LRC_PIN   16
#define SPK_DIN_PIN   17

// ── Button — hold to record, release to stop ─────────────────
// Wired: GPIO → button → GND  (internal pull-up enabled)
#define BTN_PIN       2

// ── RGB LED pins (common cathode) ────────────────────────────
// Each pin through a 330Ω resistor to LED leg
// GREEN  = recording  |  BLUE = sending  |  YELLOW = receiving
#define LED_R_PIN     4
#define LED_G_PIN     5
#define LED_B_PIN     6

// Common cathode: HIGH = on, LOW = off
// If you have common anode, swap these
#define LED_ON        HIGH
#define LED_OFF       LOW

// ── LED colour helpers ────────────────────────────────────────
inline void ledOff()    { digitalWrite(LED_R_PIN,LED_OFF); digitalWrite(LED_G_PIN,LED_OFF); digitalWrite(LED_B_PIN,LED_OFF); }
inline void ledGreen()  { digitalWrite(LED_R_PIN,LED_OFF); digitalWrite(LED_G_PIN,LED_ON);  digitalWrite(LED_B_PIN,LED_OFF); }
inline void ledBlue()   { digitalWrite(LED_R_PIN,LED_OFF); digitalWrite(LED_G_PIN,LED_OFF); digitalWrite(LED_B_PIN,LED_ON);  }
inline void ledYellow() { digitalWrite(LED_R_PIN,LED_ON);  digitalWrite(LED_G_PIN,LED_ON);  digitalWrite(LED_B_PIN,LED_OFF); }

// ── AUDIO ────────────────────────────────────────────────────
#define SAMPLE_RATE      16000
#define I2S_BUF_LEN      512

// ── STREAMING ─────────────────────────────────────────────────
// When BLE is connected, audio chunks stream live to app
// instead of saving to LittleFS first.
// App receives: STREAM_START\n → [PCM chunks] → STREAM_END\n
// Each chunk is raw 16-bit PCM (no WAV header mid-stream).
// WAV header sent once at STREAM_START as first 44 bytes.
// Falls back to LittleFS recording if BLE disconnected.
#define STREAM_CHUNK_SAMPLES  256   // 256 samples = 16ms per chunk at 16kHz
                                    // Small chunks = low latency, STT can start fast

// ── VOICE DETECTION ──────────────────────────────────────────

// ── STORAGE ──────────────────────────────────────────────────
#define FLASH_FULL_RATIO  0.85f

// ── BLE ──────────────────────────────────────────────────────
#define BLE_DEVICE_NAME  "ESP32_Recorder"
#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_TX_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define BLE_CHUNK_SIZE   500

// ── v15: LittleFS-first Opus receive ─────────────────────────
// Incoming Opus packets are written directly to LittleFS.
// When DONE is received the file is decoded and played.
// Format: length-prefixed raw Opus packets (no Ogg container).
// [uint16_t len][opus bytes][uint16_t len][opus bytes]...
#define TTS_RX_PATH      "/tts_rx.opus"  // temp file for received Opus audio
static volatile uint32_t rxChunkCount = 0;  // chunk counter for debug logging

// ── Receive buffer — heap allocated when first needed ─────────
// 512KB = ~16 seconds of 16kHz 16-bit audio
// Reduce if you see heap allocation errors
#define RX_BUF_MAX  (512 * 1024)

// ── Command queue ─────────────────────────────────────────────
#define CMD_MAX_LEN     96
#define CMD_QUEUE_DEPTH  8
static QueueHandle_t cmdQueue = nullptr;

// ============================================================
//  WAV HEADER
// ============================================================
#pragma pack(push, 1)
struct WavHeader {
  char     riff[4]       = {'R','I','F','F'};
  uint32_t fileSize      = 0;
  char     wave[4]       = {'W','A','V','E'};
  char     fmt[4]        = {'f','m','t',' '};
  uint32_t fmtSize       = 16;
  uint16_t audioFormat   = 1;
  uint16_t numChannels   = 1;
  uint32_t sampleRate    = SAMPLE_RATE;
  uint32_t byteRate      = SAMPLE_RATE * 2;
  uint16_t blockAlign    = 2;
  uint16_t bitsPerSample = 16;
  char     data[4]       = {'d','a','t','a'};
  uint32_t dataSize      = 0;
};
#pragma pack(pop)

// ============================================================
//  GLOBALS
// ============================================================
static int32_t gRawBuf[I2S_BUF_LEN];
static int16_t gPcmBuf[I2S_BUF_LEN];
static int32_t gVadBuf[I2S_BUF_LEN];

volatile bool  recording       = false;
volatile bool  bleTransferring = false;
uint16_t       fileIndex       = 0;
uint32_t       lastRecTime     = 0;
volatile bool  streaming       = false;   // true when live-streaming to app

NimBLECharacteristic* pTxChar      = nullptr;
volatile bool         bleConnected = false;

// ── Receive state machine ─────────────────────────────────────
enum class RxState { COMMAND, LISTENING, STREAMING };
volatile RxState rxState   = RxState::COMMAND;
uint8_t*         rxBuffer  = nullptr;
uint32_t         rxBufSize = 0;
uint32_t         rxBufUsed = 0;

bool spkInitialised   = false;
// v13: no spkStreaming/spkDraining/ring buffer — LittleFS handles receive
uint32_t      wavBytesSkip   = 0;
uint32_t      wavHdrUsed     = 0;
static uint8_t wavHdrBuf[256];
bool           wavHdrDone_g   = false;

// v13: LittleFS file handle for incoming TTS chunks
static File    ttsRxFile;
static bool    ttsRxOpen  = false;
static uint32_t ttsRxBytes = 0;   // running byte count — f.size() is stale until file closed

// ── BLE Flow Control ──────────────────────────────────────────
// ACK mode is OPTIONAL — enabled only when custom IoT app sends "ACK_ON"
// In ACK mode: ESP32 waits for "ACK\n" after each binary chunk (reliable)
// In no-ACK mode: simple delay between chunks (works with any BLE tool)
// App enables ACK mode by sending command: ACK_ON
// App disables ACK mode by sending command: ACK_OFF
#define ACK_TIMEOUT_MS       5000
#define ACK_TOKEN            "ACK"
#define BLE_TEXT_DELAY_MS    20
#define BLE_NOACK_DELAY_MS   20   // delay when ACK mode off

SemaphoreHandle_t ackSemaphore = nullptr;
volatile bool     ackModeEnabled = false;  // disabled by default

// ============================================================
//  BLE SEND
// ============================================================

// Text notification — simple delay, NO ACK wait.
// Used for: CONNECTED, STATUS, NEW:, FILE:, END:, DELETED:,
//           LISTENING, PLAYED:, ERROR: — all text signals.
void bleSendRaw(const String& msg) {
  if (!bleConnected || !pTxChar) return;
  int len = msg.length(), pos = 0;
  while (pos < len) {
    int end = min(pos + BLE_CHUNK_SIZE, len);
    pTxChar->setValue((uint8_t*)msg.c_str() + pos, end - pos);
    pTxChar->notify();
    pos = end;
    delay(BLE_TEXT_DELAY_MS);
  }
}

// Alias for readability
void bleSend(const String& msg) { bleSendRaw(msg); }

// Binary data sender.
// ACK mode ON  (custom IoT app): waits for "ACK\n" per chunk — reliable
// ACK mode OFF (nRF Connect etc): simple delay — works with any BLE tool
// Returns bytes sent — less than len means transfer aborted.
size_t bleSendBinary(const uint8_t* data, size_t len) {
  if (!bleConnected || !pTxChar) return 0;
  size_t pos = 0;
  while (pos < len) {
    if (!bleConnected) { Serial.println("[BLE] Disconnected mid-transfer"); return pos; }
    size_t chunk = min((size_t)BLE_CHUNK_SIZE, len - pos);

    if (ackModeEnabled) {
      // ACK mode — wait for app confirmation before next chunk
      xSemaphoreTake(ackSemaphore, 0);  // clear stale
      pTxChar->setValue((uint8_t*)data + pos, chunk);
      pTxChar->notify();
      if (xSemaphoreTake(ackSemaphore, pdMS_TO_TICKS(ACK_TIMEOUT_MS)) != pdTRUE) {
        Serial.printf("[BLE] ACK timeout at byte %u/%u\n", pos, len);
        return pos;
      }
    } else {
      // No-ACK mode — simple delay, works with any BLE app/tool
      pTxChar->setValue((uint8_t*)data + pos, chunk);
      pTxChar->notify();
      delay(BLE_NOACK_DELAY_MS);
    }
    pos += chunk;
  }
  return pos;
}

// ============================================================
//  SPEAKER — I2S_NUM_1 (MAX98357A)
// ============================================================
void initSpeaker() {
  if (spkInitialised) return;
  i2s_config_t cfg = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,
    // v12: Use RIGHT_LEFT (stereo) instead of ONLY_LEFT.
    // MAX98357A with SD pin floating/3.3V plays LEFT channel.
    // ONLY_LEFT on ESP32-S3 with use_apll can output on wrong wire.
    // RIGHT_LEFT sends same mono data on both slots — amp always hears it.
    .channel_format       = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,    // v12: reduced from 16 — cuts DMA flush wait to 256ms
    .dma_buf_len          = 512,
    .use_apll             = true,
    .tx_desc_auto_clear   = true,
    .fixed_mclk           = 0
  };
  i2s_pin_config_t pins = {
    .bck_io_num   = SPK_BCLK_PIN,
    .ws_io_num    = SPK_LRC_PIN,
    .data_out_num = SPK_DIN_PIN,
    .data_in_num  = I2S_PIN_NO_CHANGE
  };
  i2s_driver_install(I2S_NUM_1, &cfg, 0, NULL);
  i2s_set_pin(I2S_NUM_1, &pins);
  i2s_zero_dma_buffer(I2S_NUM_1);
  spkInitialised = true;
  Serial.println("[SPK] MAX98357A ready on I2S_NUM_1");
}

// ============================================================
//  v15: playOpusFromLittleFS — decode Opus file, play on speaker
//
//  File format (length-prefixed raw packets, no Ogg container):
//    [uint16_t pktLen][pktLen bytes Opus][uint16_t pktLen][...]...
//
//  Decode loop — NO intermediate PCM buffer:
//    read 2-byte length header
//    read Opus packet (max ~400 bytes at 24kbps/20ms)
//    opus_decode() → 320 PCM samples (20ms @ 16kHz) on stack
//    upmix mono→stereo on stack (640 samples)
//    i2s_write() directly — I2S DMA handles timing
//    repeat until EOF
//
//  Decode overhead: ~0.004ms per frame, 375 frames for 7.5s = ~1.5ms total.
//  I2S DMA keeps the amp fed while the next frame decodes.
// ============================================================
void playOpusFromLittleFS(const char* path) {
  File f = LittleFS.open(path, "r");
  if (!f) {
    Serial.printf("[SPK] Cannot open %s\n", path);
    bleSendRaw("ERROR:Cannot open Opus file\n");
    return;
  }

  uint32_t fileSize = f.size();
  Serial.printf("[SPK] Decoding %s (%u bytes)\n", path, fileSize);
  ledYellow();

  // ── Create Opus decoder ───────────────────────────────────────
  // 16kHz, mono, no error pointer needed (we check return codes)
  int opusErr = OPUS_OK;
  OpusDecoder* dec = opus_decoder_create(SAMPLE_RATE, 1, &opusErr);
  if (!dec || opusErr != OPUS_OK) {
    Serial.printf("[SPK] Opus decoder create failed: %d\n", opusErr);
    f.close();
    bleSendRaw("ERROR:Opus decoder init failed\n");
    return;
  }
  Serial.println("[SPK] Opus decoder ready — starting playback");

  // ── Stack buffers — no heap allocation ───────────────────────
  // Opus packet:    max 400 bytes (24kbps × 20ms / 8 bits = 60 bytes typical,
  //                400 covers bursts and high-quality settings)
  // PCM output:     320 samples per 20ms frame at 16kHz (max 960 for 60ms)
  // Stereo output:  640 samples (320 × L + 320 × R) for RIGHT_LEFT I2S format
  uint8_t  opusPkt[400];
  int16_t  pcmMono[960];    // max 60ms frame — 320 typical for 20ms
  int16_t  pcmStereo[1920]; // stereo upmix — 640 typical for 20ms

  uint32_t frameCount  = 0;
  uint32_t errorCount  = 0;
  uint32_t totalPlayed = 0;  // in bytes (stereo int16)

  // ── Decode loop ───────────────────────────────────────────────
  while (f.available()) {
    // Step 1: read 2-byte packet length
    uint16_t pktLen = 0;
    if (f.read((uint8_t*)&pktLen, 2) != 2) break;  // EOF or corrupt

    // Sanity check — valid Opus packet at 24kbps/20ms is 40–80 bytes typical
    if (pktLen == 0 || pktLen > sizeof(opusPkt)) {
      Serial.printf("[SPK] Bad packet length %u at frame %u — stopping\n",
                    pktLen, frameCount);
      break;
    }

    // Step 2: read Opus packet bytes
    size_t got = f.read(opusPkt, pktLen);
    if (got != pktLen) {
      Serial.printf("[SPK] Short read %u/%u at frame %u\n", got, pktLen, frameCount);
      break;
    }

    // Step 3: decode Opus → raw PCM (mono int16, 16kHz)
    // Returns number of decoded samples per channel, or negative error code
    int samples = opus_decode(dec, opusPkt, pktLen, pcmMono,
                              sizeof(pcmMono) / sizeof(int16_t), 0);
    if (samples <= 0) {
      Serial.printf("[SPK] Opus decode error %d at frame %u\n", samples, frameCount);
      errorCount++;
      if (errorCount > 10) {
        Serial.println("[SPK] Too many decode errors — aborting");
        break;
      }
      continue;
    }

    // Step 4: upmix mono → stereo for RIGHT_LEFT I2S channel format
    // MAX98357A plays LEFT channel. RIGHT_LEFT sends L+R interleaved.
    for (int i = 0; i < samples; i++) {
      pcmStereo[i * 2]     = pcmMono[i];  // L
      pcmStereo[i * 2 + 1] = pcmMono[i];  // R
    }

    // Step 5: write stereo PCM directly to I2S DMA — no intermediate buffer
    // i2s_write() fills the DMA ring and returns immediately.
    // The DMA hardware clocks out the samples to MAX98357A independently.
    size_t written = 0;
    esp_err_t err = i2s_write(I2S_NUM_1, pcmStereo,
                              samples * 2 * sizeof(int16_t),
                              &written, pdMS_TO_TICKS(200));
    if (err != ESP_OK) {
      Serial.printf("[SPK] i2s_write error %d at frame %u\n", err, frameCount);
      break;
    }

    totalPlayed += written;
    frameCount++;
  }

  f.close();
  opus_decoder_destroy(dec);

  // ── DMA flush — wait for amp to finish playing ────────────────
  // DMA buffer = dma_buf_count(8) × dma_buf_len(512) × 2ch × 2bytes = 16384 bytes
  // At 16kHz stereo: 16384 / (16000 × 2 × 2) = 256ms
  // Add 100ms safety margin
  vTaskDelay(pdMS_TO_TICKS(356));
  i2s_zero_dma_buffer(I2S_NUM_1);
  ledOff();

  Serial.printf("[SPK] Done — %u frames decoded, %u bytes to I2S, %u errors\n",
                frameCount, totalPlayed, errorCount);
}

// Plays raw 16-bit PCM — no WAV header (used by LISTENING mode)
// v12: upmixes mono to stereo for RIGHT_LEFT I2S channel format
void playPCM(const int16_t* pcmData, uint32_t pcmBytes) {
  initSpeaker();
  Serial.printf("[SPK] Playing %u bytes (%.1fs)\n",
    pcmBytes, pcmBytes / (SAMPLE_RATE * 2.0f));
  ledYellow();

  const uint16_t* src    = (const uint16_t*)pcmData;
  uint32_t        monoSamples = pcmBytes / 2;

  // Upmix mono → stereo in chunks
  static int16_t stereoBuf[256];  // 128 mono samples × 2 channels
  uint32_t       pos = 0;

  while (pos < monoSamples) {
    uint32_t batch = min(monoSamples - pos, (uint32_t)128);
    size_t   outIdx = 0;
    for (uint32_t i = 0; i < batch; i++) {
      int16_t s = (int16_t)src[pos + i];
      stereoBuf[outIdx++] = s;  // L
      stereoBuf[outIdx++] = s;  // R
    }
    size_t written = 0;
    i2s_write(I2S_NUM_1, stereoBuf, outIdx * 2, &written, pdMS_TO_TICKS(200));
    pos += batch;
  }

  i2s_zero_dma_buffer(I2S_NUM_1);
  ledOff();
  Serial.println("[SPK] Done");
}

// ============================================================
//  STARTUP TONE — played once on power-on
// ============================================================
//
//  Generates a friendly ascending 3-note chime (C5 → E5 → G5)
//  using pure sine wave math. No audio files, no extra libraries.
//
//  Each note:
//    • Frequency:  defined in noteFreqs[]
//    • Duration:   defined in noteDurMs[]
//    • Amplitude:  0–32767 (16-bit PCM range)
//    • Envelope:   simple linear fade-in + fade-out to avoid clicks
//
//  To change the tune, edit noteFreqs[] and noteDurMs[].
//  To change volume, adjust TONE_AMPLITUDE (max 32767).
//
// ─────────────────────────────────────────────────────────────
void playStartupTone() {
  initSpeaker();

  // ── Tune definition ──────────────────────────────────────
  // C5=523Hz  E5=659Hz  G5=784Hz  → cheerful major chord arpeggio
  const float    noteFreqs[] = { 523.0f, 659.0f, 784.0f };
  const uint32_t noteDurMs[] = { 140,    140,    280    };
  const int      noteCount   = 3;
  const int16_t  TONE_AMPLITUDE = 18000;  // volume: 0–32767
  const uint32_t FADE_SAMPLES   = 200;    // samples for fade in/out (~12ms)

  Serial.println("[SPK] Playing startup tone");

  for (int n = 0; n < noteCount; n++) {
    float    freq    = noteFreqs[n];
    uint32_t durMs   = noteDurMs[n];
    uint32_t samples = (SAMPLE_RATE * durMs) / 1000;

    // Allocate note buffer on stack — max ~280ms * 16000 * 2 = ~9KB
    // Safe for ESP32-S3 stack
    static int16_t noteBuf[4480];  // sized for longest note (280ms at 16kHz)
    if (samples > sizeof(noteBuf)/sizeof(noteBuf[0]))
        samples = sizeof(noteBuf)/sizeof(noteBuf[0]);

    for (uint32_t i = 0; i < samples; i++) {
      // Pure sine wave
      float t   = (float)i / SAMPLE_RATE;
      float val = sinf(2.0f * M_PI * freq * t) * TONE_AMPLITUDE;

      // Linear fade-in at start
      if (i < FADE_SAMPLES)
        val *= (float)i / FADE_SAMPLES;

      // Linear fade-out at end
      if (i >= samples - FADE_SAMPLES)
        val *= (float)(samples - i) / FADE_SAMPLES;

      noteBuf[i] = (int16_t)val;
    }

    // v12: upmix mono tone to stereo for RIGHT_LEFT channel format
    static int16_t stereoNoteBuf[8960];  // 4480 mono × 2 channels
    uint32_t stereoCount = 0;
    for (uint32_t i = 0; i < samples; i++) {
      if (stereoCount + 1 >= 8960) break;
      stereoNoteBuf[stereoCount++] = noteBuf[i];  // L
      stereoNoteBuf[stereoCount++] = noteBuf[i];  // R
    }

    // Write stereo to I2S — bypass playPCM() to skip LED change
    const uint8_t* src    = (const uint8_t*)stereoNoteBuf;
    uint32_t       remain = stereoCount * sizeof(int16_t);
    size_t         written = 0;
    while (remain > 0) {
      size_t toWrite = min(remain, (uint32_t)1024);
      i2s_write(I2S_NUM_1, src, toWrite, &written, pdMS_TO_TICKS(200));
      src    += written;
      remain -= written;
    }

    // Short gap between notes (silence = zeros already in DMA)
    delay(20);
  }

  i2s_zero_dma_buffer(I2S_NUM_1);
  Serial.println("[SPK] Startup tone done");
}

// ============================================================
//  PROCESS RECEIVED AUDIO — strip WAV header then play
// ============================================================
void processReceivedAudio(const String& fname) {
  if (rxBufUsed == 0) {
    bleSendRaw("ERROR:Empty receive buffer\n");
    return;
  }
  Serial.printf("[RX] Processing %u bytes\n", rxBufUsed);

  uint32_t dataOffset = 0;

  if (rxBufUsed >= 4 &&
      rxBuffer[0]=='R' && rxBuffer[1]=='I' &&
      rxBuffer[2]=='F' && rxBuffer[3]=='F') {
    // Has WAV header — scan for 'data' chunk
    dataOffset = 44;  // default standard WAV
    for (uint32_t i = 12; i < min(rxBufUsed, (uint32_t)256) - 4; i++) {
      if (rxBuffer[i]=='d' && rxBuffer[i+1]=='a' &&
          rxBuffer[i+2]=='t' && rxBuffer[i+3]=='a') {
        dataOffset = i + 8;  // skip 'data' tag + 4-byte size field
        break;
      }
    }
    Serial.printf("[RX] WAV header %u bytes\n", dataOffset);
  } else {
    // No header — raw PCM
    Serial.println("[RX] No WAV header — treating as raw PCM");
  }

  if (dataOffset >= rxBufUsed) {
    bleSendRaw("ERROR:No PCM data after header\n");
    return;
  }

  uint32_t pcmBytes = rxBufUsed - dataOffset;
  bleSend("STATUS:Playing "+fname+" ("+String(pcmBytes/(SAMPLE_RATE*2.0f),1)+"s)\n");
  playPCM((int16_t*)(rxBuffer + dataOffset), pcmBytes);
  bleSend("PLAYED:"+fname+"\n");
  Serial.println("[SPK] Ready for next recording");
  // LED already off from playPCM — system is fully idle, button ready
}

// ============================================================
//  LISTEN MODE
// ============================================================
// Called ONCE in setup — allocates receive buffer from PSRAM
// Buffer is reused for every subsequent receive session
void allocateRxBuffer() {
  if (rxBuffer != nullptr) return;  // already allocated
  // Try PSRAM first (requires Tools → PSRAM → OPI PSRAM in Arduino IDE)
  rxBuffer = (uint8_t*)heap_caps_malloc(RX_BUF_MAX, MALLOC_CAP_SPIRAM);
  if (rxBuffer) {
    rxBufSize = RX_BUF_MAX;
    Serial.printf("[RX] PSRAM buffer allocated: %uKB\n", RX_BUF_MAX / 1024);
    return;
  }
  // PSRAM not available — use heap with safe headroom
  uint32_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
  uint32_t useSize  = (freeHeap > 120*1024) ? (freeHeap - 100*1024) : 0;
  if (useSize >= 32*1024) {
    rxBuffer  = (uint8_t*)malloc(useSize);
    rxBufSize = useSize;
    Serial.printf("[RX] Heap buffer allocated: %uKB (PSRAM unavailable)\n", useSize/1024);
  } else {
    Serial.printf("[RX] FATAL: Cannot allocate buffer — free heap: %uKB\n", freeHeap/1024);
    Serial.println("[RX] Enable PSRAM: Tools → PSRAM → OPI PSRAM");
  }
}


// ── v10: prebuffer is now the ring buffer threshold, not a static array ──

// ============================================================
//  v15: writeChunkToLittleFS — called from BLE onWrite()
//  Appends raw bytes to the open Opus receive file.
//  Chunks are raw BLE data — Opus packets with length prefixes.
//  No parsing here — playOpusFromLittleFS handles that.
// ============================================================
void writeChunkToLittleFS(const uint8_t* data, size_t len) {
  rxChunkCount++;
  if (!ttsRxOpen) {
    Serial.printf("[RX] Chunk %u dropped — file not open\n", rxChunkCount);
    return;
  }
  size_t written = ttsRxFile.write(data, len);
  ttsRxBytes += written;
  if (written != len) {
    Serial.printf("[RX] Chunk %u — write error %u/%u bytes (flash full?)\n",
                  rxChunkCount, written, len);
  } else {
    Serial.printf("[RX] Chunk %u — %u bytes → LittleFS (%u total)\n",
                  rxChunkCount, len, ttsRxBytes);
  }
}

void enterStreamPlayback() {
  initSpeaker();
  rxChunkCount = 0;
  rxState      = RxState::STREAMING;
  ledYellow();

  // Delete any leftover file from previous session
  if (LittleFS.exists(TTS_RX_PATH)) LittleFS.remove(TTS_RX_PATH);

  // Open file for writing — chunks will append as they arrive
  ttsRxFile = LittleFS.open(TTS_RX_PATH, FILE_WRITE);
  if (!ttsRxFile) {
    Serial.println("[RX] FATAL: Cannot open TTS receive file!");
    bleSendRaw("ERROR:LittleFS write failed\n");
    return;
  }
  ttsRxOpen  = true;
  ttsRxBytes = 0;
  Serial.printf("[RX] TTS receive file open: %s\n", TTS_RX_PATH);
  Serial.printf("[FS] Flash %.1f%% used before receive\n",
                100.0f * LittleFS.usedBytes() / LittleFS.totalBytes());
}

void exitStreamPlayback(const String& fname) {
  // Close the receive file
  if (ttsRxOpen) {
    ttsRxFile.close();
    ttsRxOpen = false;
  }
  rxState = RxState::COMMAND;

  uint32_t fileSize = LittleFS.exists(TTS_RX_PATH) ?
                      LittleFS.open(TTS_RX_PATH, "r").size() : 0;
  Serial.printf("[RX] Receive complete — %u chunks, %u bytes on disk\n",
                rxChunkCount, fileSize);
  Serial.printf("[FS] Flash %.1f%% used after receive\n",
                100.0f * LittleFS.usedBytes() / LittleFS.totalBytes());

  if (fileSize == 0) {
    bleSendRaw("ERROR:TTS file empty\n");
    return;
  }

  // Play from LittleFS — decode Opus, no race conditions
  bleSendRaw("STATUS:Playing " + fname + "\n");
  playOpusFromLittleFS(TTS_RX_PATH);

  // Clean up temp file after playing
  LittleFS.remove(TTS_RX_PATH);
  Serial.println("[FS] TTS temp file deleted");

  bleSendRaw("PLAYED:" + fname + "\n");
  bleSendRaw("STATUS:Ready\n");
}

void enterListenMode(bool notifyApp = true) {
  // Buffer allocated once at startup — just reset the used counter
  if (rxBuffer == nullptr || rxBufSize == 0) {
    Serial.println("[RX] ERROR: Buffer not allocated — call allocateRxBuffer() in setup");
    bleSendRaw("ERROR:Buffer not ready\n");
    return;
  }
  // Allocate buffer once — reused across sessions
  if (rxBuffer == nullptr) {
    // Try PSRAM first, then regular heap
    rxBuffer = (uint8_t*)heap_caps_malloc(RX_BUF_MAX,
                           MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!rxBuffer) rxBuffer = (uint8_t*)malloc(RX_BUF_MAX);
    if (!rxBuffer) {
      Serial.println("[RX] Cannot allocate buffer!");
      bleSendRaw("ERROR:Not enough RAM\n");
      return;
    }
    rxBufSize = RX_BUF_MAX;
    Serial.printf("[RX] Buffer: %uKB\n", rxBufSize / 1024);
  }
  rxBufUsed = 0;
  rxState   = RxState::LISTENING;   // set state FIRST before notifying app
  ledYellow();
  Serial.println("[RX] LISTENING — send WAV chunks then DONE:filename.wav");
  delay(20);  // ensure state is committed before app receives signal
  if (notifyApp) bleSend("LISTENING\n");
  else bleSend("READY_FOR_RESPONSE\n");  // app must wait for this before sending chunks
}

void exitListenMode() {
  rxState   = RxState::COMMAND;
  // DO NOT reset rxBufUsed here — processReceivedAudio still needs it
  // rxBufUsed is reset at the START of next enterListenMode call
  ledOff();
}

// ============================================================
//  BLE CALLBACKS — NimBLE 2.x
// ============================================================
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, NimBLEConnInfo& connInfo) override {
    bleConnected = true;
    rxState = RxState::COMMAND;
    // Request MTU 512 — phone will negotiate down if needed
    // Actual usable payload = negotiated MTU - 3 bytes ATT overhead
    s->setDataLen(connInfo.getConnHandle(), 251);  // extended data length
    NimBLEDevice::setMTU(512);
    Serial.printf("[BLE] Connected — requesting MTU 512\n");
    bleSendRaw("CONNECTED\n");
  }
  void onMTUChange(uint16_t MTU, NimBLEConnInfo& connInfo) override {
    Serial.printf("[BLE] ✓ MTU negotiated: %u bytes (payload: %u bytes)\n", MTU, MTU-3);
    if (MTU < 100) Serial.println("[BLE] WARNING: MTU still small — app must call requestMtu(512)");
  }
  void onDisconnect(NimBLEServer* s, NimBLEConnInfo& connInfo, int reason) override {
    bleConnected = false;
    rxState   = RxState::COMMAND;
    rxBufUsed = 0;
    Serial.println("[BLE] Disconnected");
    NimBLEDevice::startAdvertising();
  }
};

class RxCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& connInfo) override {
    if (!cmdQueue) return;
    std::string val = c->getValue();
    size_t len = val.length();
    if (len == 0) return;
    const uint8_t* raw = (const uint8_t*)val.data();

    // v10 DEBUG: log every packet that enters onWrite — state + size + first bytes
    // Remove this block once audio is confirmed working
    {
      int st = (rxState == RxState::STREAMING) ? 2 :
               (rxState == RxState::LISTENING)  ? 1 : 0;
      if (len <= 32) {
        char preview[48] = {};
        memcpy(preview, raw, min(len, (size_t)47));
        Serial.printf("[DBG] onWrite len=%u state=%d txt='%s'\n",
                      len, st, preview);
      } else {
        Serial.printf("[DBG] onWrite len=%u state=%d hex=%02X%02X%02X%02X\n",
                      len, st, raw[0], raw[1], raw[2], raw[3]);
      }
    }

    // Drop pure-whitespace short packets
    if (len <= 4) {
      bool empty = true;
      for (size_t i = 0; i < len; i++)
        if (raw[i] > 32) { empty = false; break; }
      if (empty) return;
    }

    // ── STREAMING mode ────────────────────────────────────────
    // CRITICAL BUG FIX: exitStreamPlayback() calls vTaskDelay() which
    // must NOT be called from the BLE onWrite() callback thread —
    // doing so blocks the BLE stack and causes instant silent exit.
    // Fix: route DONE through cmdQueue → bleTask() handles it safely.
    if (rxState == RxState::STREAMING) {
      bool isDone = (len >= 5 && len < 64 &&
                     raw[0]==68 && raw[1]==79 && raw[2]==78 && raw[3]==69 &&
                     (raw[4]==58 || raw[4]==10 || raw[4]==13 || raw[4]==32));
      if (isDone) {
        String fname = "response.wav";
        if (raw[4]==58 && len > 5) {
          fname = String((const char*)raw + 5, len - 5);
          fname.trim();
        }
        rxState = RxState::COMMAND;   // stop accepting chunks immediately
        char buf[CMD_MAX_LEN];
        snprintf(buf, CMD_MAX_LEN, "__DONE:%s", fname.c_str());
        xQueueSend(cmdQueue, buf, 0); // bleTask() will call exitStreamPlayback()
        return;
      }
      writeChunkToLittleFS(raw, len);  // v13: write to LittleFS, never blocks
      return;
    }

    // ── LISTENING mode — buffer then play (SENDALL flow) ─────
    if (rxState == RxState::LISTENING) {
      bool isDone = (len >= 5 && len < 64 &&
                     raw[0]==68 && raw[1]==79 && raw[2]==78 && raw[3]==69 &&
                     (raw[4]==58 || raw[4]==10 || raw[4]==13 || raw[4]==32));
      if (isDone) {
        String fname = "response.wav";
        if (raw[4]==58 && len > 5) {
          fname = String((const char*)raw + 5, len - 5);
          fname.trim();
        }
        Serial.printf("[RX] DONE -- %u bytes received\n", rxBufUsed);
        exitListenMode();
        char buf[CMD_MAX_LEN];
        snprintf(buf, CMD_MAX_LEN, "__PLAY:%s", fname.c_str());
        xQueueSend(cmdQueue, buf, 0);
        return;
      }
      if (rxBuffer && rxBufUsed + len <= rxBufSize) {
        memcpy(rxBuffer + rxBufUsed, raw, len);
        rxBufUsed += len;
      } else {
        Serial.printf("[RX] Buffer full! %u/%u\n", rxBufUsed, rxBufSize);
        bleSendRaw("ERROR:Buffer full\n");
        exitListenMode();
      }
      return;
    }

    // ── COMMAND mode ─────────────────────────────────────────
    // ACK for file transfer flow control
    if (len <= 5) {
      String s((const char*)raw, len); s.trim();
      if (s.equalsIgnoreCase("ACK")) {
        if (ackSemaphore) xSemaphoreGiveFromISR(ackSemaphore, nullptr);
        return;
      }
    }

    // v13: In COMMAND mode, large binary packets are unexpected.
    // Log and drop — don't try to parse as text command.
    if (len >= 100) {
      bool looksLikePCM = true;
      for (size_t i = 0; i < min(len, (size_t)8); i++)
        if (raw[i] >= 32 && raw[i] < 127) { looksLikePCM = false; break; }
      if (looksLikePCM) {
        Serial.printf("[RX] WARNING: %u-byte binary chunk in COMMAND mode — dropped\n", len);
        return;
      }
    }

    // Parse as text command
    char buf[CMD_MAX_LEN];
    size_t copyLen = min(len, (size_t)(CMD_MAX_LEN - 1));
    memcpy(buf, raw, copyLen);
    buf[copyLen] = '\0';
    for (int i = (int)copyLen - 1; i >= 0; i--) {
      if (buf[i]==10 || buf[i]==13 || buf[i]==32) buf[i]='\0';
      else break;
    }
    if (strlen(buf) == 0) return;
    if (xQueueSend(cmdQueue, buf, 0) != pdTRUE)
      Serial.println("[BLE] CMD queue full");
    else
      Serial.printf("[BLE] Queued: %s\n", buf);
  }
};

// ============================================================
//  BLE INIT
// ============================================================
void initBLE() {
  NimBLEDevice::init(BLE_DEVICE_NAME);
  NimBLEDevice::setMTU(512);
  NimBLEServer* pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  NimBLEService* pSvc = pServer->createService(NUS_SERVICE_UUID);
  pTxChar = pSvc->createCharacteristic(NUS_TX_UUID, NIMBLE_PROPERTY::NOTIFY);
  NimBLECharacteristic* pRxChar = pSvc->createCharacteristic(
    NUS_RX_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  pRxChar->setCallbacks(new RxCallbacks());
  pSvc->start();
  NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
  pAdv->addServiceUUID(NUS_SERVICE_UUID);
  NimBLEAdvertisementData sr; sr.setName(BLE_DEVICE_NAME);
  pAdv->setScanResponseData(sr);
  NimBLEDevice::startAdvertising();
  Serial.printf("[BLE] '%s' advertising\n", BLE_DEVICE_NAME);
}

// ============================================================
//  FILE TRANSFER
// ============================================================
void sendFileOverBLE(const char* path) {
  if (!LittleFS.exists(path)) { bleSendRaw("ERROR:Not found\n"); return; }
  File f = LittleFS.open(path, "r");
  if (!f) { bleSendRaw("ERROR:Cannot open\n"); return; }
  uint32_t fileSize = f.size();
  String   fname    = String(path).substring(1);
  ledBlue();  // BLUE = sending to app
  bleSend("FILE:"+fname+":"+String(fileSize)+"\n");
  Serial.printf("[BLE] Sending %s\n", path);
  delay(100);
  static uint8_t buf[BLE_CHUNK_SIZE];
  uint32_t sent = 0, lastLog = 0;
  while (f.available()) {
    if (!bleConnected) { f.close(); return; }
    size_t got = f.read(buf, BLE_CHUNK_SIZE);
    if (!got) break;
    size_t actualSent = bleSendBinary(buf, got);
    sent += actualSent;
    if (!bleConnected) { f.close(); ledOff(); Serial.println("[BLE] Disconnected mid-transfer"); return; }
    if (sent - lastLog >= 10240) { Serial.printf("[BLE] %u/%u\n",sent,fileSize); lastLog=sent; }
  }
  f.close();
  delay(50); bleSend("END:"+fname+"\n");
  delay(100); LittleFS.remove(path);
  ledOff();  // done sending
  bleSend("DELETED:"+fname+"\n");
  Serial.printf("[BLE] Done+deleted: %s\n", path);
}

// ============================================================
//  SEND ALL — enters LISTENING after every file is sent
// ============================================================
void sendAllFiles() {
  String files[200]; int count = 0;
  for (int i = 0; i < 10000 && count < 200; i++) {
    char path[32]; snprintf(path, sizeof(path), "/rec_%04d.wav", i);
    if (LittleFS.exists(path)) {
      File f = LittleFS.open(path, "r");
      if (f && f.size() > 44) files[count++] = String(path);
      if (f) f.close();
    }
    if (!LittleFS.exists(path) && i > (int)fileIndex + 20) break;
  }
  if (count == 0) {
    bleSendRaw("STATUS:No recordings\n");
    delay(100);
    enterListenMode();   // still enter listen even if no files
    return;
  }
  bleSendRaw("STATUS:Sending "+String(count)+" file(s)\n");
  for (int i = 0; i < count; i++) {
    if (!bleConnected) return;
    bleSendRaw("STATUS:File "+String(i+1)+" of "+String(count)+"\n");
    delay(50);
    sendFileOverBLE(files[i].c_str());
    delay(200);
  }
  if (!bleConnected) return;
  fileIndex = findNextIndex();
  bleSendRaw("STATUS:All files sent\n");
  delay(100);
  enterListenMode();     // ← auto-listen ON after all files sent
}

// ============================================================
//  COMMAND HANDLER
// ============================================================
void handleBLECommand(const char* rawCmd) {
  String cmd = String(rawCmd); cmd.trim();
  String up  = cmd; up.toUpperCase();
  Serial.printf("[CMD] '%s'\n", cmd.c_str());

  // Internal: playback trigger from RX callback
  if (cmd.startsWith("__PLAY:")) {
    processReceivedAudio(cmd.substring(7));
    return;
  }

  // v10: DONE routed from onWrite() via queue — safe to call vTaskDelay here
  if (cmd.startsWith("__DONE:")) {
    exitStreamPlayback(cmd.substring(7));
    return;
  }

  if (up == "LIST") {
    bleSend("=== Recordings ===\n");
    int count = 0;
    for (int i = 0; i < 10000; i++) {
      char path[32]; snprintf(path, sizeof(path), "/rec_%04d.wav", i);
      if (!LittleFS.exists(path)) { if (i>(int)fileIndex+5) break; continue; }
      File f = LittleFS.open(path, "r");
      if (f) {
        float secs = (f.size()-44)/(SAMPLE_RATE*2.0f);
        bleSend(String(path+1)+"  "+String(secs,1)+"s  "+String(f.size()/1024)+"KB\n");
        f.close(); count++;
      }
    }
    if (!count) bleSend("No recordings yet.\n");
    bleSend("Flash: "+String((uint32_t)(LittleFS.usedBytes()/1024))+
            "KB/"+String((uint32_t)(LittleFS.totalBytes()/1024))+"KB\n");
  }
  else if (up == "SENDALL") {
    bleTransferring = true; sendAllFiles(); bleTransferring = false;
  }
  else if (up.startsWith("SEND:")) {
    String fname = cmd.substring(5); fname.trim();
    if (!fname.startsWith("/")) fname = "/"+fname;
    bleTransferring = true; sendFileOverBLE(fname.c_str()); bleTransferring = false;
  }
  else if (up == "STATUS") {
    float pct = 100.0f*LittleFS.usedBytes()/LittleFS.totalBytes();
    bleSend("Flash: "+String((uint32_t)(LittleFS.usedBytes()/1024))+
            "KB/"+String((uint32_t)(LittleFS.totalBytes()/1024))+
            "KB ("+String(pct,1)+"%)\n");
    bleSend(recording?"State: RECORDING\n":"State: IDLE\n");
    bleSend(rxState==RxState::STREAMING?"RX: STREAMING\n":
          rxState==RxState::LISTENING?"RX: LISTENING\n":"RX: COMMAND\n");
    bleSend("RxBuf: "+String(rxBufUsed)+" bytes\n");
    bleSend("Flash: "+String((uint32_t)(LittleFS.usedBytes()/1024))+
            "KB/"+String((uint32_t)(LittleFS.totalBytes()/1024))+"KB\n");
  }
  else if (up == "ACK_ON") {
    ackModeEnabled = true;
    bleSendRaw("STATUS:ACK mode ON — send ACK after each chunk\n");
    Serial.println("[BLE] ACK mode ON");
  }
  else if (up == "ACK_OFF") {
    ackModeEnabled = false;
    bleSendRaw("STATUS:ACK mode OFF — no ACK needed\n");
    Serial.println("[BLE] ACK mode OFF");
  }
  else if (up == "FORMAT") {
    bleSend("STATUS:Formatting...\n");
    LittleFS.end(); bool ok = LittleFS.format(); LittleFS.begin(true);
    fileIndex = 0;
    bleSend(ok?"STATUS:Done\n":"ERROR:Format failed\n");
  }
  // STREAM_MODE: switch into direct speaker-streaming state.
  // Send this before sending WAV chunks to test playback without recording.
  else if (up == "STREAM_MODE") {
    Serial.println("[CMD] STREAM_MODE — send WAV chunks then DONE:filename.wav");
    enterStreamPlayback();  // rxState=STREAMING, resets WAV header parser
    bleSendRaw("READY_FOR_RESPONSE\n");
  }
  else if (up == "HELP") {
    bleSend("LIST           - list files\n");
    bleSend("SENDALL        - send all + listen for audio\n");
    bleSend("SEND:filename  - send one file\n");
    bleSend("STATUS         - state + flash\n");
    bleSend("STREAM_MODE    - direct WAV to speaker test\n");
    bleSend("ACK_ON         - enable ACK flow control (IoT app)\n");
    bleSend("ACK_OFF        - disable ACK flow control (default)\n");
    bleSend("FORMAT         - wipe all\n");
    bleSend("After STREAM_MODE/SENDALL: chunks then DONE:name.wav\n");
  }
  else bleSend("Unknown. Type HELP\n");
}

// ============================================================
//  BLE TASK — Core 0
// ============================================================
void bleTask(void* param) {
  char buf[CMD_MAX_LEN];
  for (;;) {
    if (xQueueReceive(cmdQueue, buf, pdMS_TO_TICKS(10)) == pdTRUE)
      handleBLECommand(buf);
  }
}

// ============================================================
//  STORAGE
// ============================================================
void manageStorage(uint16_t skipIndex) {
  float ratio = (float)LittleFS.usedBytes()/(float)LittleFS.totalBytes();
  if (ratio < FLASH_FULL_RATIO) return;
  Serial.printf("[STORAGE] %.1f%% full\n", ratio*100.0f);
  uint16_t p1 = skipIndex;
  uint16_t p2 = skipIndex > 0 ? skipIndex-1 : 65535;
  bool deleted = false;
  for (int i = 0; i < 10000; i++) {
    if ((uint16_t)i==p1||(uint16_t)i==p2) continue;
    char path[32]; snprintf(path,sizeof(path),"/rec_%04d.wav",i);
    if (!LittleFS.exists(path)) continue;
    File chk=LittleFS.open(path,"r"); if(!chk) continue; chk.close();
    if (LittleFS.remove(path)) {
      Serial.printf("[STORAGE] Deleted %s\n",path);
      deleted=true; return;
    }
  }
  if (!deleted) { LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex=0; }
}

uint16_t findNextIndex() {
  for (int i = 0; i < 10000; i++) {
    char path[32]; snprintf(path,sizeof(path),"/rec_%04d.wav",i);
    if (!LittleFS.exists(path)) return (uint16_t)i;
    File f=LittleFS.open(path,"r");
    if (f) { uint32_t sz=f.size(); f.close(); if(sz==0){LittleFS.remove(path);return (uint16_t)i;} }
  }
  return 0;
}

// ============================================================
//  MICROPHONE — I2S_NUM_0
// ============================================================
void initMicrophone() {
  i2s_config_t cfg = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER|I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8, .dma_buf_len = I2S_BUF_LEN,
    .use_apll = false, .tx_desc_auto_clear = false, .fixed_mclk = 0
  };
  i2s_pin_config_t pins = {
    .bck_io_num=MIC_SCK_PIN, .ws_io_num=MIC_WS_PIN,
    .data_out_num=I2S_PIN_NO_CHANGE, .data_in_num=MIC_SD_PIN
  };
  i2s_driver_install(I2S_NUM_0,&cfg,0,NULL);
  i2s_set_pin(I2S_NUM_0,&pins);
  // INMP441 needs ~100ms warmup after power-on before valid data
  delay(100);
  // Flush DMA buffers — discard first few reads which may be zeros
  size_t dummy = 0;
  int32_t dummyBuf[I2S_BUF_LEN];
  for(int i=0;i<5;i++) i2s_read(I2S_NUM_0,dummyBuf,sizeof(dummyBuf),&dummy,pdMS_TO_TICKS(50));
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("[MIC] INMP441 ready on I2S_NUM_0");
}

// ============================================================
//  WAV RECORD
// ============================================================
void writeWavHeader(File& f){WavHeader h;f.write((uint8_t*)&h,sizeof(h));}
void finalizeWavHeader(File& f,uint32_t d){
  WavHeader h;h.dataSize=d;h.fileSize=d+sizeof(WavHeader)-8;
  f.seek(0);f.write((uint8_t*)&h,sizeof(h));
}

// ── WAV header helper for streaming ──────────────────────────
void sendWavHeaderBLE(uint32_t dataSize) {
  WavHeader h;
  h.dataSize = dataSize;
  h.fileSize = dataSize + sizeof(WavHeader) - 8;
  // Raw send — no ACK needed for streaming header
  if (!bleConnected || !pTxChar) return;
  pTxChar->setValue((uint8_t*)&h, sizeof(h));
  pTxChar->notify();
  delay(20);
}

// ── Main record function — streams live if BLE connected ──────
// If BLE connected:  I2S → BLE chunks live (low latency streaming)
//                    also saves to LittleFS as backup
// If BLE disconnected: I2S → LittleFS only (classic store+forward)
void recordWav(const char* path, uint16_t myIdx) {
  ledGreen();
  Serial.printf("[REC] %s — hold button\n", path);

  manageStorage(myIdx);

  File f = LittleFS.open(path, FILE_WRITE);
  if (!f) {
    Serial.printf("[ERROR] Cannot create %s\n", path);
    Serial.println("[REC] Reformatting LittleFS...");
    LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex = 0;
    f = LittleFS.open(path, FILE_WRITE);
    if (!f) { Serial.println("[ERROR] Still cannot create file"); ledOff(); return; }
    Serial.println("[REC] Reformat OK");
  }

  writeWavHeader(f);

  bool doStream = bleConnected;   // snapshot — don't change mid-recording
  uint32_t dataBytes = 0;
  size_t   bytesRead = 0;
  bool     writeErr  = false;
  bool     firstChunk = true;

  if (doStream) {
    streaming = true;
    // Send stream start signal + WAV header so app can start STT immediately
    bleSendRaw("STREAM_START:" + String(path+1) + "\n");
    sendWavHeaderBLE(0xFFFFFFFF);  // placeholder size — app ignores it for streaming
    Serial.printf("[STREAM] Live streaming to app\n");
  }

  while (digitalRead(BTN_PIN) == LOW && !writeErr) {
    esp_err_t err = i2s_read(I2S_NUM_0, gRawBuf, sizeof(gRawBuf),
                              &bytesRead, pdMS_TO_TICKS(50));
    if (err != ESP_OK || bytesRead == 0) continue;
    int got = bytesRead / 4;

    // Diagnostic on first chunk
    if (firstChunk) {
      firstChunk = false;
      long long sq = 0;
      for (int i = 0; i < got; i++) sq += (long long)(gRawBuf[i]>>8)*(gRawBuf[i]>>8);
      int rms = (int)sqrt((double)sq / got);
      Serial.printf("[MIC] First chunk: %d samples raw[0]=0x%08X RMS=%d\n",
                    got, (uint32_t)gRawBuf[0], rms);
      if (rms == 0) Serial.println("[MIC] WARNING: All zeros — check mic wiring");
    }

    // Convert 32-bit I2S to 16-bit PCM
    for (int i = 0; i < got; i++) gPcmBuf[i] = (int16_t)(gRawBuf[i] >> 16);

    // Stream chunk live to app — fire and forget, no ACK
    // Real-time streaming does not retransmit dropped chunks
    if (doStream && bleConnected) {
      size_t pos = 0, total = got * 2;
      const uint8_t* src = (const uint8_t*)gPcmBuf;
      while (pos < total && bleConnected) {
        size_t chunk = min((size_t)BLE_CHUNK_SIZE, total - pos);
        pTxChar->setValue((uint8_t*)src + pos, chunk);
        pTxChar->notify();
        pos += chunk;
        delay(10);  // 10ms — small gap, keeps BLE TX buffer clear
      }
      if (!bleConnected) {
        Serial.println("[STREAM] BLE disconnected — saving to file only");
        doStream = false;
      }
    }

    // Always write to LittleFS as backup
    size_t wr = f.write((uint8_t*)gPcmBuf, got * 2);
    if (!wr) { writeErr = true; break; }
    dataBytes += got * 2;
  }

  if (!writeErr) finalizeWavHeader(f, dataBytes);
  f.close();
  i2s_zero_dma_buffer(I2S_NUM_0);

  if (doStream) {
    bleSendRaw("STREAM_END:" + String(path+1) + ":" + String(dataBytes) + "\n");
    delay(50);  // give app time to process end signal
    streaming = false;
    Serial.printf("[STREAM] Done — %uB streamed\n", dataBytes);
    // Enter STREAMING state — onWrite() routes incoming chunks to LittleFS.
    // exitStreamPlayback() plays the file when DONE is received.
    rxState = RxState::STREAMING;
    enterStreamPlayback();
    Serial.println("[RX] STREAMING — chunks will play directly on speaker");
    bleSendRaw("READY_FOR_RESPONSE\n");  // signal app it can start sending TTS audio
  }

  ledOff();

  if (writeErr || dataBytes == 0) {
    LittleFS.remove(path);
    if (writeErr) {
      fileIndex--;
      Serial.println("[REC] Auto-reformatting...");
      LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex = 0;
      if (bleConnected) bleSendRaw("STATUS:Flash reformatted\n");
    } else {
      Serial.println("[REC] Too short — discarded");
    }
  } else {
    Serial.printf("[DONE] %s  %uB  %.1fs  Flash:%.1f%%\n",
      path, dataBytes+44, dataBytes/(SAMPLE_RATE*2.0f),
      100.0f*LittleFS.usedBytes()/LittleFS.totalBytes());
    if (bleConnected && !doStream)  // only send NEW: if we didn't stream
      bleSendRaw("NEW:"+String(path+1)+":"+String(dataBytes+44)+"\n");
  }
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n============================================");
  Serial.println("  INMP441 + MAX98357A + BLE UART  v15.0");
  Serial.println("============================================\n");

  pinMode(BTN_PIN, INPUT_PULLUP);
  delay(10);
  Serial.printf("[BTN] GPIO%d initial state: %s (should be HIGH when not pressed)\n",
    BTN_PIN, digitalRead(BTN_PIN) ? "HIGH" : "LOW");
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  ledOff();

  cmdQueue=xQueueCreate(CMD_QUEUE_DEPTH,CMD_MAX_LEN);
  if(!cmdQueue){Serial.println("[FATAL] Queue!");while(true)delay(1000);}

  ackSemaphore = xSemaphoreCreateBinary();
  if(!ackSemaphore){Serial.println("[FATAL] ACK Semaphore!");while(true)delay(1000);}


  if(!LittleFS.begin(true)){Serial.println("[FATAL] LittleFS!");while(true)delay(1000);}
  // Sanity check — warn if partition is too small
  if(LittleFS.totalBytes() < 500*1024){
    Serial.printf("[WARN] LittleFS only %uKB! Go to:\n", LittleFS.totalBytes()/1024);
    Serial.println("[WARN] Tools → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)");
    Serial.println("[WARN] Or use a custom partition with more SPIFFS/LittleFS space");
  }
  Serial.printf("[FS] %.1f%% (%uKB/%uKB)\n",
    100.0f*LittleFS.usedBytes()/LittleFS.totalBytes(),
    LittleFS.usedBytes()/1024,LittleFS.totalBytes()/1024);

  fileIndex=findNextIndex();
  Serial.printf("[FS] Index: %u\n",fileIndex);

  delay(500);
  initBLE();
  delay(200);
  initMicrophone();

  allocateRxBuffer();  // allocate once — reused for every receive session
  xTaskCreatePinnedToCore(bleTask,"BLETask",20480,NULL,1,NULL,0);

  // v13: init speaker I2S early so startup tone works
  initSpeaker();

  // ── Startup tone — plays after all hardware is ready ─────
  // Ascending C5→E5→G5 chime confirms speaker is working.
  // Edit playStartupTone() to change notes/duration/volume.
  playStartupTone();

  Serial.printf("[CFG] Delete@%.0f%%  BTN=GPIO%d\n", FLASH_FULL_RATIO*100, BTN_PIN);
  Serial.printf("[HW]  MIC SCK=%d WS=%d SD=%d | SPK BCLK=%d LRC=%d DIN=%d\n",
    MIC_SCK_PIN,MIC_WS_PIN,MIC_SD_PIN,SPK_BCLK_PIN,SPK_LRC_PIN,SPK_DIN_PIN);
  Serial.println("[READY]\n");
}

// ============================================================
//  LOOP — Core 1: Button + recording
//  Hold BTN_PIN to record. Release to stop.
//  Pauses during BLE transfer and LISTENING mode.
// ============================================================
void loop() {
  // Serial debug commands
  if(Serial.available()){
    String cmd=Serial.readStringUntil('\n');cmd.trim();
    char buf[CMD_MAX_LEN];cmd.toCharArray(buf,CMD_MAX_LEN);
    xQueueSend(cmdQueue,buf,0);
  }

  // Pause recording during transfer or listen mode
  if(bleTransferring||rxState==RxState::LISTENING||streaming){delay(10);return;}

  // Button check — LOW = pressed (internal pull-up)
  // Uncomment next line to debug button wiring:
  // Serial.printf("[BTN] state=%d\n", digitalRead(BTN_PIN));
  if(digitalRead(BTN_PIN)==LOW && !recording){
    recording=true;
    char path[32];uint16_t myIdx=fileIndex++;
    snprintf(path,sizeof(path),"/rec_%04d.wav",myIdx);
    recordWav(path,myIdx);  // blocks until button released
    recording=false;
    // Small debounce — wait for clean release
    while(digitalRead(BTN_PIN)==LOW) delay(10);
    delay(50);
  }

  delay(10);  // idle poll rate
}
