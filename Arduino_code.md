// ============================================================
//  INMP441 WAV Recorder + WiFi TCP + MAX98357A Playback — v1.0
//  ESP32-S3  |  LittleFS  |  WiFi TCP Socket  |  Opus decode
//
//  MIGRATED FROM BLE v16.0 → WiFi TCP v1.0
//  Replaces NimBLE UART with raw TCP sockets over WiFi.
//  Target latency: 2–4 seconds (down from 7–10s over BLE).
//
//  WHY RAW TCP (not WebSocket, not MQTT):
//    WebSocket  = TCP + HTTP upgrade handshake. Good for browsers.
//                 Adds framing overhead, not needed here.
//    MQTT       = pub/sub via broker. Great for many tiny sensors.
//                 Routes through a broker = extra network hop. Bad for audio.
//    Raw TCP    = direct binary pipe. ESP32 is the server, app connects
//                 directly. No overhead, no broker, no framing. Best for
//                 streaming large binary blobs (audio) between 2 devices.
//
//  NETWORK TOPOLOGY:
//    Phone App ──WiFi──► Router/Hotspot ──WiFi──► ESP32
//              TCP Socket port 8765
//    Both devices must be on the SAME WiFi network.
//    Recommended: ESP32 connects to phone's mobile hotspot.
//    Then the ESP32's IP is printed to Serial on boot — use that in your app.
//
//  FLOW (identical to BLE version, just faster):
//  1. ESP32 records voice → streams live PCM chunks to app via TCP
//  2. App sends SENDALL → ESP32 streams all files → deletes them
//  3. After ALL files sent → ESP32 sends LISTENING to app
//  4. App sends length-prefixed raw Opus packets in TCP stream
//  5. App sends DONE:filename.opus
//  6. ESP32 decodes Opus from LittleFS → plays on MAX98357A speaker
//  7. ESP32 sends PLAYED:filename.opus back to app
//
//  KEY CHANGE vs BLE version:
//    • No delay() between audio chunks — TCP flow control handles pacing
//    • TCP_CHUNK_SIZE = 1460 (TCP MSS, fills one Ethernet frame)
//      vs BLE_CHUNK_SIZE = 500 (BLE MTU limit)
//    • No ACK mode needed — TCP guarantees delivery natively
//    • No MTU negotiation — TCP handles segmentation transparently
//
//  LATENCY IMPROVEMENT:
//    240KB audio over BLE (500B chunks + 10ms delay): ~4.8s
//    240KB audio over TCP (1460B chunks, no delay):   ~0.2s
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
//  ARDUINO LIBRARY REQUIRED:
//    Install: pschatzmann/arduino-libopus
//    Arduino IDE: Sketch → Include Library → Manage Libraries → "libopus"
//
//  COMMANDS (same as BLE version, sent over TCP):
//  LIST                → show all recorded files
//  SENDALL             → send all files + auto-listen after
//  SEND:rec_0000.wav   → send one file
//  STATUS              → flash usage + current state
//  STREAM_MODE         → test: send WAV chunks then DONE:filename.wav
//  FORMAT              → wipe all recordings
//  HELP                → show commands
// ============================================================

#include <Arduino.h>
#include <driver/i2s.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include "FS.h"
#include "LittleFS.h"
#include <math.h>
#include "opus.h"           // arduino-libopus by pschatzmann

// ============================================================
//  ★ CONFIGURE THESE ★
// ============================================================
#define WIFI_SSID     "YourSSID"        // WiFi network name
#define WIFI_PASS     "YourPassword"    // WiFi password
#define TCP_PORT      8765              // TCP server port (app connects to this)
// ============================================================

// ── INMP441 — I2S_NUM_0 (microphone input) ───────────────────
#define MIC_SCK_PIN   40
#define MIC_WS_PIN    41
#define MIC_SD_PIN    42

// ── MAX98357A — I2S_NUM_1 (speaker output) ───────────────────
#define SPK_BCLK_PIN  15
#define SPK_LRC_PIN   16
#define SPK_DIN_PIN   17

// ── Button — hold to record, release to stop ─────────────────
#define BTN_PIN       2

// ── RGB LED pins (common cathode) ────────────────────────────
#define LED_R_PIN     4
#define LED_G_PIN     5
#define LED_B_PIN     6

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
// Chunk size for live PCM streaming during recording.
// 256 samples = 16ms per chunk at 16kHz — low latency, STT starts fast.
// TCP can carry much larger chunks but small chunks keep latency low.
#define STREAM_CHUNK_SAMPLES  256

// ── TCP ───────────────────────────────────────────────────────
// 1460 = standard TCP MSS (Maximum Segment Size).
// This fills exactly one Ethernet/WiFi frame — most efficient transfer size.
// For comparison BLE was limited to 500 bytes by the ATT MTU.
#define TCP_CHUNK_SIZE   1460

// ── STORAGE ──────────────────────────────────────────────────
#define FLASH_FULL_RATIO  0.85f

// ── TTS receive file ─────────────────────────────────────────
#define TTS_RX_PATH      "/tts_rx.opus"
static volatile uint32_t rxChunkCount = 0;

// ── Receive buffer ────────────────────────────────────────────
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
volatile bool  wifiTransferring = false;
uint16_t       fileIndex       = 0;
uint32_t       lastRecTime     = 0;
volatile bool  streaming       = false;

// ── WiFi / TCP ───────────────────────────────────────────────
WiFiServer   tcpServer(TCP_PORT);
WiFiClient   tcpClient;
volatile bool wifiConnected = false;    // true when a TCP client is connected

// ── Receive state machine ─────────────────────────────────────
enum class RxState { COMMAND, LISTENING, STREAMING };
volatile RxState rxState   = RxState::COMMAND;
uint8_t*         rxBuffer  = nullptr;
uint32_t         rxBufSize = 0;
uint32_t         rxBufUsed = 0;

bool spkInitialised = false;

// ── LittleFS file handle for incoming TTS chunks ──────────────
static File    ttsRxFile;
static bool    ttsRxOpen  = false;
static uint32_t ttsRxBytes = 0;

// ── TCP receive staging buffer ────────────────────────────────
// We read from the TCP stream in large chunks for efficiency.
// The incoming data can be a mix of command text and binary Opus data.
#define TCP_RX_BUF_SIZE  4096
static uint8_t tcpRxStageBuf[TCP_RX_BUF_SIZE];

// ── PSRAM Ring Buffer — streaming Opus decode-on-receive ──────
// 8192 stereo int16 pairs = 512ms of audio at 16kHz.
// Power-of-2 size enables fast bitwise modulo masking.
// SPSC: Core 0 (WiFi task) writes, Core 1 (streamPlayTask) reads.
#define STREAM_RING_STEREO  8192
#define STREAM_RING_MASK    (STREAM_RING_STEREO - 1)

static int16_t*          streamRingBuf        = nullptr;
static volatile uint32_t streamRingWritePos   = 0;  // monotonic, Core 0 owns
static volatile uint32_t streamRingReadPos    = 0;  // monotonic, Core 1 owns
static volatile bool     streamRingDone       = false;
static volatile bool     streamPlayStarted    = false;
static TaskHandle_t      streamPlayTaskHandle = nullptr;

// Start playback after 3 Opus frames buffered (3×320 = 960 stereo pairs ≈ 60ms)
#define STREAM_PLAY_THRESHOLD  960

// ── Opus packet reassembly state ──────────────────────────────
// Incoming TCP chunks carry [uint16_t len LE][opus_bytes] stream.
// A packet may span multiple TCP reads — we reassemble here.
static OpusDecoder* streamDec          = nullptr;
static uint8_t      streamOpusPkt[400];
static uint16_t     streamOpusExpected = 0;  // 0 = waiting for 2-byte length
static uint16_t     streamOpusReceived = 0;
static uint8_t      streamLenBuf[2];
static uint8_t      streamLenHave      = 0;  // 0 or 1 bytes received so far

// ============================================================
//  TCP SEND HELPERS
//  Drop-in replacements for bleSendRaw() / bleSendBinary()
// ============================================================

// Send a text string over TCP.
// No chunking delay needed — TCP flow control handles backpressure.
void tcpSendRaw(const String& msg) {
  if (!wifiConnected || !tcpClient || !tcpClient.connected()) return;
  tcpClient.print(msg);
}

// Alias for readability (was bleSend)
void tcpSend(const String& msg) { tcpSendRaw(msg); }

// Send binary data over TCP in TCP_CHUNK_SIZE pieces.
// Returns bytes sent — less than len means the client disconnected.
// KEY DIFFERENCE FROM BLE: NO delay() between chunks.
// TCP's own flow control (sliding window / Nagle) handles pacing.
// This is why transfer is ~25× faster than BLE with delay(10).
size_t tcpSendBinary(const uint8_t* data, size_t len) {
  if (!wifiConnected || !tcpClient || !tcpClient.connected()) return 0;
  size_t sent = 0;
  while (sent < len) {
    if (!tcpClient.connected()) {
      Serial.println("[TCP] Disconnected mid-transfer");
      wifiConnected = false;
      return sent;
    }
    size_t chunk   = min((size_t)TCP_CHUNK_SIZE, len - sent);
    size_t written = tcpClient.write(data + sent, chunk);
    if (written == 0) {
      // Socket stalled — give a tiny yield and retry once
      delay(1);
      written = tcpClient.write(data + sent, chunk);
      if (written == 0) break;
    }
    sent += written;
  }
  return sent;
}

// Send WAV header over TCP (used at STREAM_START)
void sendWavHeaderTCP(uint32_t dataSize) {
  WavHeader h;
  h.dataSize = dataSize;
  h.fileSize = dataSize + sizeof(WavHeader) - 8;
  if (!wifiConnected || !tcpClient || !tcpClient.connected()) return;
  tcpClient.write((uint8_t*)&h, sizeof(h));
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
    .channel_format       = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,
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
//  Opus playback from LittleFS
// ============================================================
void playOpusFromLittleFS(const char* path) {
  File f = LittleFS.open(path, "r");
  if (!f) {
    Serial.printf("[SPK] Cannot open %s\n", path);
    tcpSendRaw("ERROR:Cannot open Opus file\n");
    return;
  }

  uint32_t fileSize = f.size();
  Serial.printf("[SPK] Decoding %s (%u bytes)\n", path, fileSize);
  ledYellow();

  int opusErr = OPUS_OK;
  OpusDecoder* dec = opus_decoder_create(SAMPLE_RATE, 1, &opusErr);
  if (!dec || opusErr != OPUS_OK) {
    Serial.printf("[SPK] Opus decoder create failed: %d\n", opusErr);
    f.close();
    tcpSendRaw("ERROR:Opus decoder init failed\n");
    return;
  }
  Serial.println("[SPK] Opus decoder ready — starting playback");

  uint8_t  opusPkt[400];
  int16_t  pcmMono[960];
  int16_t  pcmStereo[1920];

  uint32_t frameCount  = 0;
  uint32_t errorCount  = 0;
  uint32_t totalPlayed = 0;

  while (f.available()) {
    uint16_t pktLen = 0;
    if (f.read((uint8_t*)&pktLen, 2) != 2) break;

    if (pktLen == 0 || pktLen > sizeof(opusPkt)) {
      Serial.printf("[SPK] Bad packet length %u at frame %u — stopping\n", pktLen, frameCount);
      break;
    }

    size_t got = f.read(opusPkt, pktLen);
    if (got != pktLen) {
      Serial.printf("[SPK] Short read %u/%u at frame %u\n", got, pktLen, frameCount);
      break;
    }

    int samples = opus_decode(dec, opusPkt, pktLen, pcmMono,
                              sizeof(pcmMono) / sizeof(int16_t), 0);
    if (samples <= 0) {
      Serial.printf("[SPK] Opus decode error %d at frame %u\n", samples, frameCount);
      errorCount++;
      if (errorCount > 10) { Serial.println("[SPK] Too many errors — aborting"); break; }
      continue;
    }

    for (int i = 0; i < samples; i++) {
      pcmStereo[i * 2]     = pcmMono[i];
      pcmStereo[i * 2 + 1] = pcmMono[i];
    }

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

  // DMA flush — wait for amp to finish playing
  // dma_buf_count(8) × dma_buf_len(512) × 2ch × 2bytes / (16000×4) = 256ms + 100ms margin
  vTaskDelay(pdMS_TO_TICKS(356));
  i2s_zero_dma_buffer(I2S_NUM_1);
  ledOff();

  Serial.printf("[SPK] Done — %u frames decoded, %u bytes to I2S, %u errors\n",
                frameCount, totalPlayed, errorCount);
}

// ── Play raw 16-bit PCM ───────────────────────────────────────
void playPCM(const int16_t* pcmData, uint32_t pcmBytes) {
  initSpeaker();
  Serial.printf("[SPK] Playing %u bytes (%.1fs)\n",
    pcmBytes, pcmBytes / (SAMPLE_RATE * 2.0f));
  ledYellow();

  const uint16_t* src         = (const uint16_t*)pcmData;
  uint32_t        monoSamples = pcmBytes / 2;
  static int16_t  stereoBuf[256];
  uint32_t        pos = 0;

  while (pos < monoSamples) {
    uint32_t batch = min(monoSamples - pos, (uint32_t)128);
    size_t   outIdx = 0;
    for (uint32_t i = 0; i < batch; i++) {
      int16_t s = (int16_t)src[pos + i];
      stereoBuf[outIdx++] = s;
      stereoBuf[outIdx++] = s;
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
//  STARTUP TONE — C5 → E5 → G5 chime on boot
// ============================================================
void playStartupTone() {
  initSpeaker();

  const float    noteFreqs[] = { 523.0f, 659.0f, 784.0f };
  const uint32_t noteDurMs[] = { 140,    140,    280    };
  const int      noteCount   = 3;
  const int16_t  TONE_AMPLITUDE = 18000;
  const uint32_t FADE_SAMPLES   = 200;

  Serial.println("[SPK] Playing startup tone");

  for (int n = 0; n < noteCount; n++) {
    float    freq    = noteFreqs[n];
    uint32_t durMs   = noteDurMs[n];
    uint32_t samples = (SAMPLE_RATE * durMs) / 1000;

    static int16_t noteBuf[4480];
    if (samples > sizeof(noteBuf)/sizeof(noteBuf[0]))
        samples = sizeof(noteBuf)/sizeof(noteBuf[0]);

    for (uint32_t i = 0; i < samples; i++) {
      float t   = (float)i / SAMPLE_RATE;
      float val = sinf(2.0f * M_PI * freq * t) * TONE_AMPLITUDE;
      if (i < FADE_SAMPLES)            val *= (float)i / FADE_SAMPLES;
      if (i >= samples - FADE_SAMPLES) val *= (float)(samples - i) / FADE_SAMPLES;
      noteBuf[i] = (int16_t)val;
    }

    static int16_t stereoNoteBuf[8960];
    uint32_t stereoCount = 0;
    for (uint32_t i = 0; i < samples; i++) {
      if (stereoCount + 1 >= 8960) break;
      stereoNoteBuf[stereoCount++] = noteBuf[i];
      stereoNoteBuf[stereoCount++] = noteBuf[i];
    }

    const uint8_t* src    = (const uint8_t*)stereoNoteBuf;
    uint32_t       remain = stereoCount * sizeof(int16_t);
    size_t         written = 0;
    while (remain > 0) {
      size_t toWrite = min(remain, (uint32_t)1024);
      i2s_write(I2S_NUM_1, src, toWrite, &written, pdMS_TO_TICKS(200));
      src    += written;
      remain -= written;
    }
    delay(20);
  }

  i2s_zero_dma_buffer(I2S_NUM_1);
  Serial.println("[SPK] Startup tone done");
}

// ============================================================
//  BABY TUNE — plays during Gemini wait window
// ============================================================
#define NOTE_C4   261.63f
#define NOTE_D4   293.66f
#define NOTE_E4   329.63f
#define NOTE_F4   349.23f
#define NOTE_G4   392.00f
#define NOTE_A4   440.00f
#define NOTE_REST 0.0f

struct BabyNote { float freq; uint16_t durMs; };

static const BabyNote babyMelody[] = {
  {NOTE_C4,400},{NOTE_C4,400},{NOTE_G4,400},{NOTE_G4,400},
  {NOTE_A4,400},{NOTE_A4,400},{NOTE_G4,800},
  {NOTE_F4,400},{NOTE_F4,400},{NOTE_E4,400},{NOTE_E4,400},
  {NOTE_D4,400},{NOTE_D4,400},{NOTE_C4,800},
  {NOTE_G4,400},{NOTE_G4,400},{NOTE_F4,400},{NOTE_F4,400},
  {NOTE_E4,400},{NOTE_E4,400},{NOTE_D4,800},
  {NOTE_G4,400},{NOTE_G4,400},{NOTE_F4,400},{NOTE_F4,400},
  {NOTE_E4,400},{NOTE_E4,400},{NOTE_D4,800},
  {NOTE_C4,400},{NOTE_C4,400},{NOTE_G4,400},{NOTE_G4,400},
  {NOTE_A4,400},{NOTE_A4,400},{NOTE_G4,800},
  {NOTE_F4,400},{NOTE_F4,400},{NOTE_E4,400},{NOTE_E4,400},
  {NOTE_D4,400},{NOTE_D4,400},{NOTE_C4,800},
  {NOTE_REST,500}
};
static const int BABY_MELODY_LEN = sizeof(babyMelody) / sizeof(babyMelody[0]);

volatile bool       babyTunePlaying   = false;
volatile bool       babyTuneStop      = false;
static TaskHandle_t babyTuneTaskHandle = nullptr;

static const int16_t BABY_TUNE_AMPLITUDE = 22000;
#define BABY_CHUNK_MONO_SAMPLES 512

void babyTuneTask(void* param) {
  static int16_t monoBuf[BABY_CHUNK_MONO_SAMPLES];
  static int16_t stereoBuf[BABY_CHUNK_MONO_SAMPLES * 2];

  Serial.println("[TUNE] Baby tune task started");

  while (!babyTuneStop) {
    for (int n = 0; n < BABY_MELODY_LEN && !babyTuneStop; n++) {
      float    freq         = babyMelody[n].freq;
      uint32_t durMs        = babyMelody[n].durMs;
      uint32_t totalSamples = (SAMPLE_RATE * durMs) / 1000;
      uint32_t produced     = 0;
      float    phase        = 0.0f;
      float    phaseInc     = (freq > 0.0f)
                              ? (2.0f * M_PI * freq / (float)SAMPLE_RATE)
                              : 0.0f;
      const uint32_t NOTE_FADE = 160;

      while (produced < totalSamples && !babyTuneStop) {
        uint32_t chunk = totalSamples - produced;
        if (chunk > BABY_CHUNK_MONO_SAMPLES) chunk = BABY_CHUNK_MONO_SAMPLES;

        for (uint32_t i = 0; i < chunk; i++) {
          int16_t sample = 0;
          if (freq > 0.0f) {
            float v = sinf(phase) * BABY_TUNE_AMPLITUDE;
            phase += phaseInc;
            if (phase > 2.0f * M_PI) phase -= 2.0f * M_PI;
            uint32_t pos  = produced + i;
            uint32_t left = totalSamples - pos;
            if (pos  < NOTE_FADE) v *= (float)pos  / (float)NOTE_FADE;
            if (left < NOTE_FADE) v *= (float)left / (float)NOTE_FADE;
            sample = (int16_t)v;
          }
          monoBuf[i] = sample;
        }

        for (uint32_t i = 0; i < chunk; i++) {
          stereoBuf[i * 2]     = monoBuf[i];
          stereoBuf[i * 2 + 1] = monoBuf[i];
        }

        size_t written = 0;
        i2s_write(I2S_NUM_1, stereoBuf, chunk * 2 * sizeof(int16_t),
                  &written, pdMS_TO_TICKS(50));
        produced += chunk;
        if (babyTuneStop) break;
      }
    }
  }

  i2s_zero_dma_buffer(I2S_NUM_1);
  Serial.println("[TUNE] Baby tune task exited");
  babyTuneTaskHandle = nullptr;
  babyTunePlaying    = false;
  vTaskDelete(NULL);
}

void startBabyTune() {
  if (babyTunePlaying || babyTuneTaskHandle != nullptr) return;
  initSpeaker();
  babyTuneStop    = false;
  babyTunePlaying = true;
  BaseType_t ok = xTaskCreatePinnedToCore(
    babyTuneTask, "BabyTune", 4096, NULL, 4, &babyTuneTaskHandle, 1);
  if (ok != pdPASS) {
    Serial.println("[TUNE] FATAL: cannot create tune task");
    babyTunePlaying    = false;
    babyTuneTaskHandle = nullptr;
  }
  Serial.println("[TUNE] Lullaby started");
}

void stopBabyTune() {
  if (!babyTunePlaying && babyTuneTaskHandle == nullptr) return;
  babyTuneStop = true;
  uint32_t startWait = millis();
  while (babyTunePlaying && (millis() - startWait) < 200)
    vTaskDelay(pdMS_TO_TICKS(5));
  if (babyTunePlaying) {
    Serial.println("[TUNE] WARNING: task didn't exit within 200ms");
    babyTunePlaying = false;
  }
}

// ============================================================
//  PROCESS RECEIVED AUDIO (LISTENING mode — WAV in rxBuffer)
// ============================================================
void processReceivedAudio(const String& fname) {
  if (rxBufUsed == 0) { tcpSendRaw("ERROR:Empty receive buffer\n"); return; }
  Serial.printf("[RX] Processing %u bytes\n", rxBufUsed);

  uint32_t dataOffset = 0;
  if (rxBufUsed >= 4 &&
      rxBuffer[0]=='R' && rxBuffer[1]=='I' &&
      rxBuffer[2]=='F' && rxBuffer[3]=='F') {
    dataOffset = 44;
    for (uint32_t i = 12; i < min(rxBufUsed, (uint32_t)256) - 4; i++) {
      if (rxBuffer[i]=='d' && rxBuffer[i+1]=='a' &&
          rxBuffer[i+2]=='t' && rxBuffer[i+3]=='a') {
        dataOffset = i + 8; break;
      }
    }
  }

  if (dataOffset >= rxBufUsed) { tcpSendRaw("ERROR:No PCM data after header\n"); return; }

  uint32_t pcmBytes = rxBufUsed - dataOffset;
  tcpSend("STATUS:Playing "+fname+" ("+String(pcmBytes/(SAMPLE_RATE*2.0f),1)+"s)\n");
  playPCM((int16_t*)(rxBuffer + dataOffset), pcmBytes);
  tcpSend("PLAYED:"+fname+"\n");
  Serial.println("[SPK] Ready for next recording");
}

// ============================================================
//  RX BUFFER — allocated once from PSRAM at startup
// ============================================================
void allocateRxBuffer() {
  if (rxBuffer != nullptr) return;
  rxBuffer = (uint8_t*)heap_caps_malloc(RX_BUF_MAX, MALLOC_CAP_SPIRAM);
  if (rxBuffer) {
    rxBufSize = RX_BUF_MAX;
    Serial.printf("[RX] PSRAM buffer: %uKB\n", RX_BUF_MAX / 1024);
    return;
  }
  uint32_t freeHeap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
  uint32_t useSize  = (freeHeap > 120*1024) ? (freeHeap - 100*1024) : 0;
  if (useSize >= 32*1024) {
    rxBuffer  = (uint8_t*)malloc(useSize);
    rxBufSize = useSize;
    Serial.printf("[RX] Heap buffer: %uKB\n", useSize/1024);
  } else {
    Serial.println("[RX] FATAL: Cannot allocate buffer — enable PSRAM");
  }
}

// ============================================================
//  WRITE OPUS CHUNK TO LITTLEFS (called from TCP handler)
// ============================================================
void writeChunkToLittleFS(const uint8_t* data, size_t len) {
  rxChunkCount++;
  // Stop the lullaby on the very first Gemini chunk
  if (rxChunkCount == 1 && babyTunePlaying) {
    Serial.println("[TUNE] First Gemini chunk — signalling tune stop");
    babyTuneStop = true;
  }
  if (!ttsRxOpen) {
    Serial.printf("[RX] Chunk %u dropped — file not open\n", rxChunkCount);
    return;
  }
  size_t written = ttsRxFile.write(data, len);
  ttsRxBytes += written;
  if (written != len) {
    Serial.printf("[RX] Chunk %u — write error %u/%u bytes\n", rxChunkCount, written, len);
  } else {
    Serial.printf("[RX] Chunk %u — %u bytes → LittleFS (%u total)\n",
                  rxChunkCount, len, ttsRxBytes);
  }
}

// ============================================================
//  STREAM PLAY TASK — Core 1
//  Drains PSRAM ring buffer → I2S_NUM_1.
//  Waits for lullaby task to exit (both share I2S_NUM_1).
//  Thread-safe PLAYED: ack sent via cmdQueue.
// ============================================================
void streamPlayTask(void* param) {
  Serial.println("[PLAY] streamPlayTask started — waiting for lullaby");

  // Wait for babyTuneTask to release I2S_NUM_1
  uint32_t waitStart = millis();
  while (babyTunePlaying && (millis() - waitStart) < 500)
    vTaskDelay(pdMS_TO_TICKS(5));
  if (babyTunePlaying) {
    babyTunePlaying    = false;
    babyTuneTaskHandle = nullptr;
  }
  vTaskDelay(pdMS_TO_TICKS(30));  // let DMA drain

  Serial.println("[PLAY] Ring buffer → I2S_NUM_1 playback");
  ledYellow();

  static int16_t playBuf[512 * 2];  // 512 stereo pairs per burst
  uint32_t totalFrames = 0;

  for (;;) {
    uint32_t filled = streamRingWritePos - streamRingReadPos;

    if (filled == 0) {
      if (streamRingDone) break;        // DONE + empty = finished
      vTaskDelay(pdMS_TO_TICKS(5));     // wait for more decoded frames
      continue;
    }

    uint32_t take = (filled > 512) ? 512 : filled;
    for (uint32_t i = 0; i < take; i++) {
      uint32_t idx       = (streamRingReadPos & STREAM_RING_MASK) * 2;
      playBuf[i * 2]     = streamRingBuf[idx];
      playBuf[i * 2 + 1] = streamRingBuf[idx + 1];
      streamRingReadPos++;
    }

    size_t written = 0;
    i2s_write(I2S_NUM_1, playBuf, take * 2 * sizeof(int16_t),
              &written, pdMS_TO_TICKS(200));
    totalFrames += take;
  }

  // DMA flush: buf_count(8) × buf_len(512) × 2ch × 2B / (16000×4) ≈ 256ms + 100ms
  vTaskDelay(pdMS_TO_TICKS(356));
  i2s_zero_dma_buffer(I2S_NUM_1);
  ledOff();

  Serial.printf("[PLAY] Done — %u stereo frames\n", totalFrames);

  // Bounce PLAYED: to wifiTask via queue — safe cross-core TCP send
  char msg[CMD_MAX_LEN];
  snprintf(msg, CMD_MAX_LEN, "__PLAYED:response.opus");
  xQueueSend(cmdQueue, msg, pdMS_TO_TICKS(100));

  streamPlayTaskHandle = nullptr;
  streamPlayStarted    = false;
  vTaskDelete(NULL);
}

// ============================================================
//  WRITE OPUS CHUNK TO RING BUFFER (called from TCP handler, Core 0)
//  Parses [uint16_t len LE][opus bytes] stream arriving in arbitrary
//  TCP chunks, decodes each complete packet, writes stereo PCM to
//  PSRAM ring buffer. Starts streamPlayTask after STREAM_PLAY_THRESHOLD
//  stereo pairs are buffered (≈60ms pre-roll).
// ============================================================
void writeChunkToRingBuf(const uint8_t* data, size_t len) {
  rxChunkCount++;
  if (rxChunkCount == 1 && babyTunePlaying) {
    Serial.println("[RING] First chunk — stopping tune");
    babyTuneStop = true;
  }

  if (!streamRingBuf || !streamDec) {
    Serial.printf("[RING] Drop %u bytes — ring not ready\n", len);
    return;
  }

  size_t pos = 0;
  while (pos < len) {

    // ── Reassemble 2-byte little-endian length header ─────────
    while (streamLenHave < 2 && pos < len)
      streamLenBuf[streamLenHave++] = data[pos++];
    if (streamLenHave < 2) break;

    if (streamOpusExpected == 0) {
      streamOpusExpected = (uint16_t)(streamLenBuf[0] | (streamLenBuf[1] << 8));
      streamOpusReceived = 0;

      // ── Zero-length packet = end-of-stream sentinel ──────────
      // In-band and unambiguous: replaces the text "DONE" detection,
      // which broke whenever DONE coalesced with audio bytes in one
      // TCP read or arrived split across two reads.
      if (streamOpusExpected == 0) {
        Serial.printf("[RING] End-of-stream sentinel after %u chunks\n", rxChunkCount);
        streamLenHave = 0;
        rxState       = RxState::COMMAND;
        char dbuf[CMD_MAX_LEN];
        snprintf(dbuf, CMD_MAX_LEN, "__DONE:response.opus");
        xQueueSend(cmdQueue, dbuf, 0);
        return;   // ignore anything after the sentinel in this read
      }

      if (streamOpusExpected > sizeof(streamOpusPkt)) {
        Serial.printf("[RING] Bad pktLen=%u — skip chunk\n", streamOpusExpected);
        streamOpusExpected = 0;
        streamLenHave      = 0;
        break;
      }
    }

    // ── Accumulate opus bytes for this packet ──────────────────
    uint16_t need  = streamOpusExpected - streamOpusReceived;
    uint16_t avail = (uint16_t)min((size_t)need, len - pos);
    memcpy(streamOpusPkt + streamOpusReceived, data + pos, avail);
    streamOpusReceived += avail;
    pos += avail;

    if (streamOpusReceived < streamOpusExpected) break;  // incomplete — wait

    // ── Full packet: decode → ring buffer ─────────────────────
    int16_t pcmMono[960];
    int decoded = opus_decode(streamDec, streamOpusPkt, streamOpusExpected,
                              pcmMono, 960, 0);
    if (decoded <= 0) {
      Serial.printf("[RING] Opus decode err %d\n", decoded);
    } else {
      uint32_t free = STREAM_RING_STEREO - 1 -
                      (streamRingWritePos - streamRingReadPos);
      if ((uint32_t)decoded <= free) {
        for (int i = 0; i < decoded; i++) {
          uint32_t idx           = (streamRingWritePos & STREAM_RING_MASK) * 2;
          streamRingBuf[idx]     = pcmMono[i];
          streamRingBuf[idx + 1] = pcmMono[i];
          streamRingWritePos++;
        }
      } else {
        Serial.printf("[RING] Overflow — %d frames dropped\n", decoded);
      }

      // Start play task once pre-roll threshold reached
      uint32_t filled = streamRingWritePos - streamRingReadPos;
      if (!streamPlayStarted && filled >= STREAM_PLAY_THRESHOLD) {
        streamPlayStarted = true;
        BaseType_t ok = xTaskCreatePinnedToCore(
          streamPlayTask, "StreamPlay", 8192, NULL, 5,
          &streamPlayTaskHandle, 1);
        if (ok != pdPASS) {
          Serial.println("[RING] FATAL: cannot create streamPlayTask");
          streamPlayStarted = false;
        } else {
          Serial.printf("[RING] Play task started (%u frames buffered)\n", filled);
        }
      }
    }

    // Reset for next packet
    streamOpusExpected = 0;
    streamOpusReceived = 0;
    streamLenHave      = 0;
  }
}

// ============================================================
//  STREAMING STATE — ENTER / EXIT
// ============================================================
void enterStreamPlayback() {
  initSpeaker();
  rxChunkCount = 0;
  rxState      = RxState::STREAMING;
  ledYellow();

  // Allocate PSRAM ring buffer once — reused across turns
  if (!streamRingBuf) {
    streamRingBuf = (int16_t*)heap_caps_malloc(
      STREAM_RING_STEREO * 2 * sizeof(int16_t), MALLOC_CAP_SPIRAM);
    if (!streamRingBuf) {
      Serial.println("[RING] FATAL: Cannot allocate PSRAM ring buffer");
      tcpSendRaw("ERROR:Ring buffer alloc failed\n");
      return;
    }
    Serial.printf("[RING] PSRAM ring buffer: %uKB\n",
                  (STREAM_RING_STEREO * 2 * sizeof(int16_t)) / 1024);
  }

  // Reset ring state for this turn
  streamRingWritePos   = 0;
  streamRingReadPos    = 0;
  streamRingDone       = false;
  streamPlayStarted    = false;
  streamPlayTaskHandle = nullptr;

  // Reset Opus reassembly state
  streamOpusExpected = 0;
  streamOpusReceived = 0;
  streamLenHave      = 0;

  // (Re-)create Opus decoder for this turn
  if (streamDec) { opus_decoder_destroy(streamDec); streamDec = nullptr; }
  int err = OPUS_OK;
  streamDec = opus_decoder_create(SAMPLE_RATE, 1, &err);
  if (!streamDec || err != OPUS_OK) {
    Serial.printf("[RING] FATAL: Opus decoder create failed: %d\n", err);
    tcpSendRaw("ERROR:Opus decoder init failed\n");
    return;
  }

  Serial.println("[RING] Ready — decode-on-receive streaming");
  startBabyTune();
}

void exitStreamPlayback(const String& fname) {
  // Signal ring buffer complete — streamPlayTask drains and sends PLAYED
  streamRingDone = true;
  Serial.printf("[RING] DONE — %u chunks, %u stereo frames buffered\n",
                rxChunkCount, streamRingWritePos - streamRingReadPos);

  // Nothing decoded (Gemini returned no audio)
  if (streamRingWritePos == 0) {
    if (babyTunePlaying) stopBabyTune();
    tcpSendRaw("ERROR:TTS returned no audio\n");
    tcpSendRaw("STATUS:Ready\n");
    return;
  }

  // Short response — below start threshold — create play task now
  if (!streamPlayStarted) {
    streamPlayStarted = true;
    BaseType_t ok = xTaskCreatePinnedToCore(
      streamPlayTask, "StreamPlay", 8192, NULL, 5,
      &streamPlayTaskHandle, 1);
    if (ok != pdPASS) {
      Serial.println("[RING] FATAL: cannot start streamPlayTask at DONE");
      streamPlayStarted = false;
      if (babyTunePlaying) stopBabyTune();
      tcpSendRaw("PLAYED:" + fname + "\n");
      tcpSendRaw("STATUS:Ready\n");
    }
  }
  // streamPlayTask sends PLAYED: via cmdQueue when drain is complete
}

// ============================================================
//  LISTEN MODE (SENDALL flow — WAV buffered in RAM)
// ============================================================
void enterListenMode(bool notifyApp = true) {
  if (rxBuffer == nullptr || rxBufSize == 0) {
    tcpSendRaw("ERROR:Buffer not ready\n"); return;
  }
  rxBufUsed = 0;
  rxState   = RxState::LISTENING;
  ledYellow();
  Serial.println("[RX] LISTENING — send WAV chunks then DONE:filename.wav");
  delay(20);
  if (notifyApp) tcpSend("LISTENING\n");
  else           tcpSend("READY_FOR_RESPONSE\n");
}

void exitListenMode() {
  rxState = RxState::COMMAND;
  ledOff();
}

// ============================================================
//  TCP INCOMING DATA HANDLER
//  Called from wifiTask whenever tcpClient.available() > 0.
//  Replaces BLE onWrite() callback. Same routing logic.
// ============================================================
void handleTcpIncoming() {
  while (tcpClient.available()) {
    int avail = tcpClient.available();
    if (avail <= 0) break;

    int toRead = min(avail, (int)TCP_RX_BUF_SIZE);
    int len    = tcpClient.readBytes(tcpRxStageBuf, toRead);
    if (len <= 0) break;

    const uint8_t* raw = tcpRxStageBuf;

    // ── STREAMING mode: Opus chunks + DONE ───────────────────
    if (rxState == RxState::STREAMING) {
      bool isDone = (len >= 5 && len < 64 &&
                     raw[0]=='D' && raw[1]=='O' && raw[2]=='N' && raw[3]=='E' &&
                     (raw[4]==':' || raw[4]=='\n' || raw[4]=='\r'));
      if (isDone) {
        String fname = "response.opus";
        if (raw[4]==':' && len > 5) {
          fname = String((const char*)raw + 5, len - 5);
          fname.trim();
        }
        rxState = RxState::COMMAND;
        char buf[CMD_MAX_LEN];
        snprintf(buf, CMD_MAX_LEN, "__DONE:%s", fname.c_str());
        xQueueSend(cmdQueue, buf, 0);
        Serial.printf("[TCP] DONE queued — fname=%s\n", fname.c_str());
      } else {
        writeChunkToRingBuf(raw, len);
      }
      return;
    }

    // ── LISTENING mode: WAV bytes buffered in RAM ─────────────
    if (rxState == RxState::LISTENING) {
      bool isDone = (len >= 5 && len < 64 &&
                     raw[0]=='D' && raw[1]=='O' && raw[2]=='N' && raw[3]=='E' &&
                     (raw[4]==':' || raw[4]=='\n' || raw[4]=='\r'));
      if (isDone) {
        String fname = "response.wav";
        if (raw[4]==':' && len > 5) {
          fname = String((const char*)raw + 5, len - 5);
          fname.trim();
        }
        Serial.printf("[RX] DONE — %u bytes received\n", rxBufUsed);
        exitListenMode();
        char buf[CMD_MAX_LEN];
        snprintf(buf, CMD_MAX_LEN, "__PLAY:%s", fname.c_str());
        xQueueSend(cmdQueue, buf, 0);
      } else {
        if (rxBuffer && rxBufUsed + len <= rxBufSize) {
          memcpy(rxBuffer + rxBufUsed, raw, len);
          rxBufUsed += len;
        } else {
          Serial.printf("[RX] Buffer full! %u/%u\n", rxBufUsed, rxBufSize);
          tcpSendRaw("ERROR:Buffer full\n");
          exitListenMode();
        }
      }
      return;
    }

    // ── COMMAND mode: text commands ───────────────────────────
    // Drop large binary blobs in command mode
    if (len >= 100) {
      bool looksLikeBinary = true;
      for (int i = 0; i < min(len, 8); i++)
        if (raw[i] >= 32 && raw[i] < 127) { looksLikeBinary = false; break; }
      if (looksLikeBinary) {
        Serial.printf("[TCP] WARNING: %d-byte binary in COMMAND mode — dropped\n", len);
        return;
      }
    }

    char buf[CMD_MAX_LEN];
    size_t copyLen = min(len, (int)(CMD_MAX_LEN - 1));
    memcpy(buf, raw, copyLen);
    buf[copyLen] = '\0';
    // Strip trailing whitespace / newlines
    for (int i = (int)copyLen - 1; i >= 0; i--) {
      if (buf[i]=='\n' || buf[i]=='\r' || buf[i]==' ') buf[i]='\0';
      else break;
    }
    if (strlen(buf) == 0) return;
    if (xQueueSend(cmdQueue, buf, 0) != pdTRUE)
      Serial.println("[TCP] CMD queue full");
    else
      Serial.printf("[TCP] Queued cmd: %s\n", buf);
  }
}

// ============================================================
//  WIFI INIT
// ============================================================
void initWiFi() {
  Serial.printf("[WiFi] Connecting to '%s'", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) {
    delay(300);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] FAILED — check SSID/password in sketch");
    Serial.println("[WiFi] Device will retry on next boot");
    // Non-fatal — continues without WiFi (records to LittleFS only)
    return;
  }

  Serial.printf("\n[WiFi] Connected!\n");
  Serial.printf("[WiFi] IP Address : %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[WiFi] Signal     : %d dBm\n", WiFi.RSSI());
  Serial.printf("[TCP]  Server     : %s:%d\n",
                WiFi.localIP().toString().c_str(), TCP_PORT);
  Serial.println("[TCP]  *** Use this IP in your app ***");

  tcpServer.begin();
  tcpServer.setNoDelay(true);   // disable Nagle for lower latency on small packets
  Serial.printf("[TCP]  Server listening on port %d\n", TCP_PORT);
}

// ============================================================
//  FILE TRANSFER — send one WAV file over TCP
// ============================================================
void sendFileOverTCP(const char* path) {
  if (!LittleFS.exists(path)) { tcpSendRaw("ERROR:Not found\n"); return; }
  File f = LittleFS.open(path, "r");
  if (!f) { tcpSendRaw("ERROR:Cannot open\n"); return; }
  uint32_t fileSize = f.size();
  String   fname    = String(path).substring(1);
  ledBlue();
  tcpSend("FILE:"+fname+":"+String(fileSize)+"\n");
  Serial.printf("[TCP] Sending %s (%u bytes)\n", path, fileSize);
  delay(50);   // give app time to prepare for incoming binary

  static uint8_t buf[TCP_CHUNK_SIZE];
  uint32_t sent = 0, lastLog = 0;

  while (f.available()) {
    if (!wifiConnected || !tcpClient.connected()) { f.close(); ledOff(); return; }
    size_t got = f.read(buf, TCP_CHUNK_SIZE);
    if (!got) break;
    size_t actualSent = tcpSendBinary(buf, got);
    sent += actualSent;
    if (!wifiConnected) { f.close(); ledOff(); return; }
    if (sent - lastLog >= 20480) {
      Serial.printf("[TCP] %u/%u bytes\n", sent, fileSize);
      lastLog = sent;
    }
  }
  f.close();

  delay(30);
  tcpSend("END:"+fname+"\n");
  delay(50);
  LittleFS.remove(path);
  ledOff();
  tcpSend("DELETED:"+fname+"\n");
  Serial.printf("[TCP] Done + deleted: %s  sent=%u bytes\n", path, sent);
}

// ============================================================
//  SEND ALL — sends every recording, then enters LISTEN mode
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
    tcpSendRaw("STATUS:No recordings\n");
    delay(100);
    enterListenMode();
    return;
  }
  tcpSendRaw("STATUS:Sending "+String(count)+" file(s)\n");
  for (int i = 0; i < count; i++) {
    if (!wifiConnected) return;
    tcpSendRaw("STATUS:File "+String(i+1)+" of "+String(count)+"\n");
    delay(30);
    sendFileOverTCP(files[i].c_str());
    delay(100);
  }
  if (!wifiConnected) return;
  fileIndex = findNextIndex();
  tcpSendRaw("STATUS:All files sent\n");
  delay(100);
  enterListenMode();
}

// ============================================================
//  COMMAND HANDLER — same commands as BLE version
// ============================================================
void handleTCPCommand(const char* rawCmd) {
  String cmd = String(rawCmd); cmd.trim();
  String up  = cmd; up.toUpperCase();
  Serial.printf("[CMD] '%s'\n", cmd.c_str());

  if (cmd.startsWith("__PLAY:"))   { processReceivedAudio(cmd.substring(7)); return; }
  if (cmd.startsWith("__DONE:"))   { exitStreamPlayback(cmd.substring(7));   return; }
  // Legacy DONE: line — apps still send it 150ms after the sentinel for
  // old-firmware compatibility. The sentinel already ended the stream;
  // ignore silently instead of replying "Unknown command".
  if (cmd.startsWith("DONE:") || cmd.startsWith("done:")) { return; }
  if (cmd.startsWith("__PLAYED:")) {
    // Bounced from streamPlayTask (Core 1 → Core 0) for thread-safe TCP send
    tcpSendRaw("PLAYED:" + cmd.substring(9) + "\n");
    tcpSendRaw("STATUS:Ready\n");
    return;
  }

  if (up == "LIST") {
    tcpSend("=== Recordings ===\n");
    int count = 0;
    for (int i = 0; i < 10000; i++) {
      char path[32]; snprintf(path, sizeof(path), "/rec_%04d.wav", i);
      if (!LittleFS.exists(path)) { if (i>(int)fileIndex+5) break; continue; }
      File f = LittleFS.open(path, "r");
      if (f) {
        float secs = (f.size()-44)/(SAMPLE_RATE*2.0f);
        tcpSend(String(path+1)+"  "+String(secs,1)+"s  "+String(f.size()/1024)+"KB\n");
        f.close(); count++;
      }
    }
    if (!count) tcpSend("No recordings yet.\n");
    tcpSend("Flash: "+String((uint32_t)(LittleFS.usedBytes()/1024))+
            "KB/"+String((uint32_t)(LittleFS.totalBytes()/1024))+"KB\n");
  }
  else if (up == "SENDALL") {
    wifiTransferring = true; sendAllFiles(); wifiTransferring = false;
  }
  else if (up.startsWith("SEND:")) {
    String fname = cmd.substring(5); fname.trim();
    if (!fname.startsWith("/")) fname = "/"+fname;
    wifiTransferring = true; sendFileOverTCP(fname.c_str()); wifiTransferring = false;
  }
  else if (up == "STATUS") {
    float pct = 100.0f * LittleFS.usedBytes() / LittleFS.totalBytes();
    tcpSend("Flash: "+String((uint32_t)(LittleFS.usedBytes()/1024))+
            "KB/"+String((uint32_t)(LittleFS.totalBytes()/1024))+
            "KB ("+String(pct,1)+"%)\n");
    tcpSend(recording ? "State: RECORDING\n" : "State: IDLE\n");
    tcpSend(rxState==RxState::STREAMING ? "RX: STREAMING\n" :
            rxState==RxState::LISTENING ? "RX: LISTENING\n" : "RX: COMMAND\n");
    tcpSend("WiFi: "+WiFi.localIP().toString()+" RSSI="+String(WiFi.RSSI())+"dBm\n");
  }
  else if (up == "STREAM_MODE") {
    Serial.println("[CMD] STREAM_MODE");
    enterStreamPlayback();
    tcpSendRaw("READY_FOR_RESPONSE\n");
  }
  else if (up == "FORMAT") {
    tcpSend("STATUS:Formatting...\n");
    LittleFS.end(); bool ok = LittleFS.format(); LittleFS.begin(true);
    fileIndex = 0;
    tcpSend(ok ? "STATUS:Done\n" : "ERROR:Format failed\n");
  }
  else if (up == "HELP") {
    tcpSend("LIST           - list files\n");
    tcpSend("SENDALL        - send all + listen for audio\n");
    tcpSend("SEND:filename  - send one file\n");
    tcpSend("STATUS         - state + flash + WiFi info\n");
    tcpSend("STREAM_MODE    - direct Opus to speaker test\n");
    tcpSend("FORMAT         - wipe all\n");
    tcpSend("After STREAM_MODE/SENDALL: send Opus chunks then DONE:name.opus\n");
  }
  else {
    tcpSend("Unknown command. Type HELP\n");
  }
}

// ============================================================
//  WIFI TASK — Core 0
//  Handles: client accept, disconnect detection, incoming data.
//  Also processes commands from cmdQueue (was bleTask).
// ============================================================
void wifiTask(void* param) {
  char buf[CMD_MAX_LEN];

  for (;;) {
    // ── 1. Accept new client ──────────────────────────────────
    if (tcpServer.hasClient()) {
      if (tcpClient && tcpClient.connected()) {
        tcpClient.stop();  // drop old client
        Serial.println("[TCP] Old client replaced");
      }
      tcpClient     = tcpServer.accept();
      wifiConnected = true;
      rxState       = RxState::COMMAND;
      Serial.printf("[TCP] Client connected: %s\n",
                    tcpClient.remoteIP().toString().c_str());
      tcpSendRaw("CONNECTED\n");
    }

    // ── 2. Detect disconnection ───────────────────────────────
    if (wifiConnected && (!tcpClient || !tcpClient.connected())) {
      wifiConnected = false;
      rxState       = RxState::COMMAND;
      rxBufUsed     = 0;
      if (babyTunePlaying) stopBabyTune();
      Serial.println("[TCP] Client disconnected");
    }

    // ── 3. Handle incoming data ───────────────────────────────
    if (wifiConnected && tcpClient.available()) {
      handleTcpIncoming();
    }

    // ── 4. Process command queue (Opus DONE, PLAY, text cmds) ─
    if (xQueueReceive(cmdQueue, buf, 0) == pdTRUE) {
      handleTCPCommand(buf);
    }

    // ── 5. WiFi reconnect watchdog ────────────────────────────
    static uint32_t lastWifiCheck = 0;
    if (millis() - lastWifiCheck > 10000) {
      lastWifiCheck = millis();
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Reconnecting...");
        WiFi.reconnect();
      }
    }

    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

// ============================================================
//  STORAGE HELPERS
// ============================================================
void manageStorage(uint16_t skipIndex) {
  float ratio = (float)LittleFS.usedBytes()/(float)LittleFS.totalBytes();
  if (ratio < FLASH_FULL_RATIO) return;
  Serial.printf("[STORAGE] %.1f%% full\n", ratio*100.0f);
  uint16_t p1 = skipIndex;
  uint16_t p2 = skipIndex > 0 ? skipIndex-1 : 65535;
  for (int i = 0; i < 10000; i++) {
    if ((uint16_t)i==p1||(uint16_t)i==p2) continue;
    char path[32]; snprintf(path,sizeof(path),"/rec_%04d.wav",i);
    if (!LittleFS.exists(path)) continue;
    if (LittleFS.remove(path)) { Serial.printf("[STORAGE] Deleted %s\n",path); return; }
  }
  LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex=0;
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
//  MICROPHONE — I2S_NUM_0 (INMP441)
// ============================================================
void initMicrophone() {
  i2s_config_t cfg = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER|I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,
    .dma_buf_len          = I2S_BUF_LEN,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };
  i2s_pin_config_t pins = {
    .bck_io_num    = MIC_SCK_PIN,
    .ws_io_num     = MIC_WS_PIN,
    .data_out_num  = I2S_PIN_NO_CHANGE,
    .data_in_num   = MIC_SD_PIN
  };
  i2s_driver_install(I2S_NUM_0, &cfg, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pins);
  delay(100);  // INMP441 needs ~100ms warmup
  size_t dummy = 0;
  int32_t dummyBuf[I2S_BUF_LEN];
  for (int i=0; i<5; i++) i2s_read(I2S_NUM_0,dummyBuf,sizeof(dummyBuf),&dummy,pdMS_TO_TICKS(50));
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("[MIC] INMP441 ready on I2S_NUM_0");
}

// ============================================================
//  WAV RECORD
//  Hold BTN_PIN to record. Release to stop.
//  If WiFi connected: streams live PCM to app + saves to LittleFS.
//  If not connected:  saves to LittleFS only.
// ============================================================
void writeWavHeader(File& f) { WavHeader h; f.write((uint8_t*)&h,sizeof(h)); }
void finalizeWavHeader(File& f, uint32_t d) {
  WavHeader h; h.dataSize=d; h.fileSize=d+sizeof(WavHeader)-8;
  f.seek(0); f.write((uint8_t*)&h,sizeof(h));
}

void recordWav(const char* path, uint16_t myIdx) {
  ledGreen();
  Serial.printf("[REC] %s — hold button\n", path);
  manageStorage(myIdx);

  File f = LittleFS.open(path, FILE_WRITE);
  if (!f) {
    Serial.printf("[ERROR] Cannot create %s\n", path);
    LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex = 0;
    f = LittleFS.open(path, FILE_WRITE);
    if (!f) { Serial.println("[ERROR] Still cannot create file"); ledOff(); return; }
  }
  writeWavHeader(f);

  bool doStream  = wifiConnected;
  uint32_t dataBytes = 0;
  size_t   bytesRead = 0;
  bool     writeErr  = false;
  bool     firstChunk = true;

  if (doStream) {
    streaming = true;
    tcpSendRaw("STREAM_START:" + String(path+1) + "\n");
    sendWavHeaderTCP(0xFFFFFFFF);
    Serial.printf("[STREAM] Live streaming to app over TCP\n");
  }

  while (digitalRead(BTN_PIN) == LOW && !writeErr) {
    esp_err_t err = i2s_read(I2S_NUM_0, gRawBuf, sizeof(gRawBuf),
                              &bytesRead, pdMS_TO_TICKS(50));
    if (err != ESP_OK || bytesRead == 0) continue;
    int got = bytesRead / 4;

    if (firstChunk) {
      firstChunk = false;
      long long sq = 0;
      for (int i = 0; i < got; i++) sq += (long long)(gRawBuf[i]>>8)*(gRawBuf[i]>>8);
      int rms = (int)sqrt((double)sq / got);
      Serial.printf("[MIC] First chunk: %d samples RMS=%d\n", got, rms);
      if (rms == 0) Serial.println("[MIC] WARNING: All zeros — check mic wiring");
    }

    // Convert 32-bit I2S to 16-bit PCM
    for (int i = 0; i < got; i++) gPcmBuf[i] = (int16_t)(gRawBuf[i] >> 16);

    // Stream chunk live to app — NO delay needed, TCP paces itself
    if (doStream && wifiConnected && tcpClient.connected()) {
      size_t pos   = 0;
      size_t total = got * 2;
      const uint8_t* src = (const uint8_t*)gPcmBuf;
      while (pos < total && wifiConnected && tcpClient.connected()) {
        size_t chunk   = min((size_t)TCP_CHUNK_SIZE, total - pos);
        size_t written = tcpClient.write(src + pos, chunk);
        if (written == 0) break;
        pos += written;
        // ← NO delay(10) here — this is the biggest latency win vs BLE
      }
      if (!wifiConnected || !tcpClient.connected()) {
        Serial.println("[STREAM] TCP disconnected — saving to file only");
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
    tcpSendRaw("STREAM_END:" + String(path+1) + ":" + String(dataBytes) + "\n");
    delay(30);
    streaming = false;
    Serial.printf("[STREAM] Done — %uB streamed\n", dataBytes);
    rxState = RxState::STREAMING;
    enterStreamPlayback();
    Serial.println("[RX] STREAMING — waiting for Opus response");
    tcpSendRaw("READY_FOR_RESPONSE\n");
  }

  ledOff();

  if (writeErr || dataBytes == 0) {
    LittleFS.remove(path);
    if (writeErr) {
      fileIndex--;
      LittleFS.end(); LittleFS.format(); LittleFS.begin(true); fileIndex = 0;
      if (wifiConnected) tcpSendRaw("STATUS:Flash reformatted\n");
    } else {
      Serial.println("[REC] Too short — discarded");
    }
  } else {
    Serial.printf("[DONE] %s  %uB  %.1fs  Flash:%.1f%%\n",
      path, dataBytes+44, dataBytes/(SAMPLE_RATE*2.0f),
      100.0f*LittleFS.usedBytes()/LittleFS.totalBytes());
    if (wifiConnected && !doStream)
      tcpSendRaw("NEW:"+String(path+1)+":"+String(dataBytes+44)+"\n");
  }
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n============================================");
  Serial.println("  INMP441 + MAX98357A + WiFi TCP  v1.0");
  Serial.println("============================================\n");

  pinMode(BTN_PIN, INPUT_PULLUP);
  delay(10);
  Serial.printf("[BTN] GPIO%d state: %s\n", BTN_PIN,
                digitalRead(BTN_PIN) ? "HIGH (not pressed)" : "LOW (pressed)");
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  ledOff();

  cmdQueue = xQueueCreate(CMD_QUEUE_DEPTH, CMD_MAX_LEN);
  if (!cmdQueue) { Serial.println("[FATAL] Queue!"); while(true) delay(1000); }

  if (!LittleFS.begin(true)) { Serial.println("[FATAL] LittleFS!"); while(true) delay(1000); }
  if (LittleFS.totalBytes() < 500*1024) {
    Serial.printf("[WARN] LittleFS only %uKB!\n", LittleFS.totalBytes()/1024);
    Serial.println("[WARN] Tools → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)");
  }
  Serial.printf("[FS] %.1f%% (%uKB/%uKB)\n",
    100.0f*LittleFS.usedBytes()/LittleFS.totalBytes(),
    LittleFS.usedBytes()/1024, LittleFS.totalBytes()/1024);

  fileIndex = findNextIndex();
  Serial.printf("[FS] Index: %u\n", fileIndex);

  allocateRxBuffer();

  // Init WiFi — prints IP address to Serial
  initWiFi();

  initMicrophone();
  initSpeaker();
  playStartupTone();

  // Start WiFi task on Core 0 (handles TCP accept + data + commands)
  xTaskCreatePinnedToCore(wifiTask, "WiFiTask", 20480, NULL, 1, NULL, 0);

  Serial.printf("[CFG] Delete@%.0f%%  BTN=GPIO%d\n", FLASH_FULL_RATIO*100, BTN_PIN);
  Serial.printf("[HW]  MIC SCK=%d WS=%d SD=%d | SPK BCLK=%d LRC=%d DIN=%d\n",
    MIC_SCK_PIN,MIC_WS_PIN,MIC_SD_PIN,SPK_BCLK_PIN,SPK_LRC_PIN,SPK_DIN_PIN);
  Serial.println("[READY]\n");
}

// ============================================================
//  LOOP — Core 1: Button + recording
// ============================================================
void loop() {
  // Serial debug commands (same as BLE version)
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n'); cmd.trim();
    char buf[CMD_MAX_LEN]; cmd.toCharArray(buf, CMD_MAX_LEN);
    xQueueSend(cmdQueue, buf, 0);
  }

  // Pause recording during transfer or listen mode
  if (wifiTransferring || rxState==RxState::LISTENING || streaming) {
    delay(10); return;
  }

  // Button check — LOW = pressed (internal pull-up)
  if (digitalRead(BTN_PIN)==LOW && !recording) {
    recording = true;
    char path[32]; uint16_t myIdx = fileIndex++;
    snprintf(path, sizeof(path), "/rec_%04d.wav", myIdx);
    recordWav(path, myIdx);
    recording = false;
    while (digitalRead(BTN_PIN)==LOW) delay(10);
    delay(50);
  }

  delay(10);
}
