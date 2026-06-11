import BLEService from './BLEService';

// ─── Nordic UART Service (NUS) UUIDs ────────────────────────────────────────
// These are the standard NUS UUIDs used by the ESP32 firmware.
export const NUS_SERVICE_UUID  = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const NUS_RX_UUID       = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // App  → ESP32
export const NUS_TX_UUID       = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // ESP32 → App

const CHUNK_SIZE = 510; // bytes per write (binary data to ESP32)

// ─── Message types parsed from the TX characteristic ────────────────────────
export type ESP32Message =
  | { type: 'NEW_FILE';    filename: string; size: number }  // NEW:name:size\n  (firmware notifies new recording)
  | { type: 'FILE_HEADER'; filename: string; size: number }  // FILE:name:size\n (response to SEND:name)
  | { type: 'FILE_END';    filename: string }                // END:name\n
  | { type: 'LISTENING' }                                    // LISTENING\n (all files sent, ready for Opus response)
  | { type: 'READY_FOR_RESPONSE' }                           // READY_FOR_RESPONSE\n (v15: STREAM_MODE accepted, send Opus)
  | { type: 'PLAYED';      filename: string }                // PLAYED:name\n (v15: Opus playback complete)
  | { type: 'SAVED';       filename: string }                // SAVED:name\n
  | { type: 'ERROR';       message: string }                 // ERROR:reason\n
  | { type: 'TEXT';        raw: string }                     // Any other text (STATUS reply)
  | { type: 'BINARY';      data: ArrayBuffer }               // Raw binary chunk
  | { type: 'STREAM_START'; filename: string }               // STREAM_START:name\n  (live stream begins)
  | { type: 'STREAM_END';   filename: string; dataBytes: number }; // STREAM_END:name:bytes\n

// ─── Internal state for receiving a file ─────────────────────────────────────
interface PendingReceive {
  filename: string;
  expectedSize: number;
  chunks: ArrayBuffer[];
  bytesReceived: number;
  resolve: (data: ArrayBuffer) => void;
  reject: (err: Error) => void;
}

// ─── Internal state for SENDALL (multi-file) ─────────────────────────────────
interface MultiReceive {
  currentFilename: string;
  currentChunks: ArrayBuffer[];
  onFile: (filename: string, data: ArrayBuffer) => void;
  onComplete: () => void;
}

// ─── Internal state for autonomous (unsolicited) pushes from ESP32 ───────────
interface AutoReceiveBuffer {
  filename: string;
  chunks: ArrayBuffer[];
}

// ─── Service ─────────────────────────────────────────────────────────────────
class ESP32Service {
  private isSubscribed = false;
  private pendingReceive: PendingReceive | null = null;
  private multiReceive: MultiReceive | null = null;
  private autoReceiveHandler: ((filename: string, data: ArrayBuffer) => void) | null = null;
  private autoReceiveBuffer: AutoReceiveBuffer | null = null;
  private streamBuffer: { filename: string; chunks: ArrayBuffer[] } | null = null;
  private pendingSendTimeout: ReturnType<typeof setTimeout> | null = null;
  private onDisconnectHandler: (() => void) | null = null;

  // ── Byte / Base64 helpers ──────────────────────────────────────────────────

  private base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private textToBase64(text: string): string {
    // TextEncoder not available in Hermes — encode ASCII manually
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return this.bytesToBase64(bytes);
  }

  // ── Parse incoming TX notification ────────────────────────────────────────
  // Known text prefixes are ASCII and always < 128. Binary WAV/PCM data
  // will not start with these strings, so prefix-matching is safe.

  private parseMessage(base64Value: string): ESP32Message {
    const bytes = this.base64ToBytes(base64Value);

    // Build a short ASCII prefix string (up to 10 bytes) for fast matching
    const prefixLen = Math.min(bytes.length, 10);
    let prefix = '';
    for (let i = 0; i < prefixLen; i++) {
      prefix += String.fromCharCode(bytes[i]);
    }

    const knownPrefixes = ['FILE:', 'NEW:', 'END:', 'SAVED:', 'ERROR:', 'LISTEN', 'PLAYED:', 'READY_FOR'];
    const isTextCommand = knownPrefixes.some(p => prefix.startsWith(p));

    if (!isTextCommand) {
      // Could still be a plaintext STATUS / LIST reply — only accept if all
      // bytes are printable ASCII or whitespace.
      const allPrintable = bytes.every(b => b === 10 || b === 13 || (b >= 32 && b <= 126));
      if (!allPrintable || bytes.length === 0) {
        return { type: 'BINARY', data: bytes.buffer as ArrayBuffer };
      }
    }

    // Decode ASCII text — bytes already verified printable above
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      text += String.fromCharCode(bytes[i]);
    }
    text = text.replace(/[\r\n]+$/, '');

    if (text.startsWith('NEW:')) {
      // NEW:rec_0008.wav:256  — firmware notifies app that a new recording is ready
      const body = text.slice(4);
      const colonIdx = body.lastIndexOf(':');
      const filename = body.slice(0, colonIdx);
      const size = parseInt(body.slice(colonIdx + 1), 10);
      return { type: 'NEW_FILE', filename, size };
    }

    if (text.startsWith('FILE:')) {
      // FILE:rec_0000.wav:160204  — actual file transfer start (after SEND:name request)
      const body = text.slice(5);
      const colonIdx = body.lastIndexOf(':');
      const filename = body.slice(0, colonIdx);
      const size = parseInt(body.slice(colonIdx + 1), 10);
      return { type: 'FILE_HEADER', filename, size };
    }

    if (text.startsWith('END:')) {
      return { type: 'FILE_END', filename: text.slice(4) };
    }

    if (text.startsWith('SAVED:')) {
      return { type: 'SAVED', filename: text.slice(6) };
    }

    if (text.startsWith('ERROR:')) {
      return { type: 'ERROR', message: text.slice(6) };
    }

    if (text.startsWith('LISTENING')) {
      return { type: 'LISTENING' };
    }

    if (text.startsWith('READY_FOR_RESPONSE')) {
      return { type: 'READY_FOR_RESPONSE' };
    }

    if (text.startsWith('PLAYED:')) {
      return { type: 'PLAYED', filename: text.slice(7) };
    }

    if (text.startsWith('STREAM_START:')) {
      return { type: 'STREAM_START', filename: text.slice(13) };
    }

    if (text.startsWith('STREAM_END:')) {
      const body = text.slice(11);
      const lastColon = body.lastIndexOf(':');
      // Guard: if no colon found (malformed message), use full body as filename
      if (lastColon === -1) {
        return { type: 'STREAM_END', filename: body, dataBytes: 0 };
      }
      return {
        type: 'STREAM_END',
        filename: body.slice(0, lastColon),
        dataBytes: parseInt(body.slice(lastColon + 1), 10) || 0,
      };
    }

    return { type: 'TEXT', raw: text };
  }

  // ── Internal message routing (file receive state machine) ─────────────────

  private handleInternally(msg: ESP32Message): void {
    // ── Single-file request ────────────────────────────────────────────────
    if (this.pendingReceive) {
      switch (msg.type) {
        case 'FILE_HEADER':
          this.pendingReceive.expectedSize = msg.size;
          break;
        case 'BINARY':
          this.pendingReceive.chunks.push(msg.data);
          this.pendingReceive.bytesReceived += msg.data.byteLength;
          break;
        case 'FILE_END':
          this.resolveReceive(this.pendingReceive);
          this.pendingReceive = null;
          break;
        case 'ERROR':
          this.pendingReceive.reject(new Error(msg.message));
          this.pendingReceive = null;
          break;
      }
      return;
    }

    // ── Multi-file request (SENDALL) ───────────────────────────────────────
    if (this.multiReceive) {
      switch (msg.type) {
        case 'FILE_HEADER':
          // Start accumulating a new file
          this.multiReceive.currentFilename = msg.filename;
          this.multiReceive.currentChunks = [];
          break;
        case 'BINARY':
          this.multiReceive.currentChunks.push(msg.data);
          break;
        case 'FILE_END': {
          const assembled = this.assembleChunks(this.multiReceive.currentChunks);
          this.multiReceive.onFile(this.multiReceive.currentFilename, assembled);
          this.multiReceive.currentChunks = [];
          break;
        }
        case 'LISTENING':
          // ESP32 finished streaming all files
          this.multiReceive.onComplete();
          this.multiReceive = null;
          break;
        case 'ERROR':
          console.error('ESP32 error during SENDALL:', msg.message);
          this.multiReceive = null;
          break;
      }
      return;
    }

    // ── Autonomous push — two protocols supported ─────────────────────────
    //
    // Legacy (store-and-forward):
    //   ESP32 → NEW:filename:size   (recording saved to flash)
    //   App   → SEND:filename       (request the file)
    //   ESP32 → FILE:filename:size  (transfer start)
    //           [binary chunks]
    //   ESP32 → END:filename        (transfer complete)
    //
    // Live streaming (v7 firmware, BLE connected during recording):
    //   ESP32 → STREAM_START:filename\n  (stream begins, no ACK)
    //   ESP32 → [44-byte WAV header]     (binary, ACK per chunk)
    //   ESP32 → [PCM chunks]             (binary, ACK per chunk)
    //   ESP32 → STREAM_END:filename:bytes\n (stream done, no ACK)
    if (this.autoReceiveHandler) {
      switch (msg.type) {
        // ── Live streaming ─────────────────────────────────────────────
        case 'STREAM_START':
          this.streamBuffer = { filename: msg.filename, chunks: [] };
          console.log(`ESP32: live stream start — ${msg.filename}`);
          break;
        case 'STREAM_END':
          if (this.streamBuffer) {
            const chunks = this.streamBuffer.chunks.length;
            const data = this.assembleChunks(this.streamBuffer.chunks);
            const pcmBytes = data.byteLength > 44 ? data.byteLength - 44 : data.byteLength;
            const durationMs = Math.round((pcmBytes / 2 / 16000) * 1000);
            console.log(`ESP32: stream complete — ${this.streamBuffer.filename} | chunks=${chunks} total=${data.byteLength}B pcm=${pcmBytes}B ~${durationMs}ms (firmware reported ${msg.dataBytes}B)`);
            this.autoReceiveHandler(this.streamBuffer.filename, data);
            this.streamBuffer = null;
          }
          break;
        // ── Legacy file transfer ────────────────────────────────────────
        case 'NEW_FILE':
          // Delay before requesting so the firmware can finish flushing the file
          console.log(`ESP32: new recording ready — requesting ${msg.filename} in 600ms`);
          if (this.pendingSendTimeout) clearTimeout(this.pendingSendTimeout);
          this.pendingSendTimeout = setTimeout(() => {
            this.pendingSendTimeout = null;
            this.writeCommand(`SEND:${msg.filename}`).catch(e =>
              console.error(`ESP32: SEND:${msg.filename} failed:`, e)
            );
          }, 600);
          break;
        case 'FILE_HEADER':
          this.autoReceiveBuffer = { filename: msg.filename, chunks: [] };
          break;
        case 'FILE_END':
          if (this.autoReceiveBuffer) {
            const data = this.assembleChunks(this.autoReceiveBuffer.chunks);
            console.log(`ESP32: recording complete — ${this.autoReceiveBuffer.filename} (${data.byteLength} bytes assembled)`);
            this.autoReceiveHandler(this.autoReceiveBuffer.filename, data);
            this.autoReceiveBuffer = null;
          }
          break;
        // ── Binary chunks — routed to whichever buffer is active ────────
        case 'BINARY':
          if (this.streamBuffer) {
            this.streamBuffer.chunks.push(msg.data);
          } else if (this.autoReceiveBuffer) {
            this.autoReceiveBuffer.chunks.push(msg.data);
          }
          break;
        case 'ERROR':
          console.error('ESP32 error during autonomous push:', msg.message);
          this.autoReceiveBuffer = null;
          this.streamBuffer = null;
          break;
      }
    }
  }

  private assembleChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const assembled = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      assembled.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return assembled.buffer as ArrayBuffer;
  }

  private resolveReceive(pending: PendingReceive): void {
    const assembled = this.assembleChunks(pending.chunks);
    console.log(
      `Received ${pending.filename}: ${assembled.byteLength} bytes` +
      (pending.expectedSize > 0 ? ` (expected ${pending.expectedSize})` : '')
    );
    pending.resolve(assembled);
  }

  // ── Auto-receive (unsolicited pushes from ESP32) ──────────────────────────

  setAutoReceiveHandler(handler: (filename: string, data: ArrayBuffer) => void): void {
    this.autoReceiveHandler = handler;
    this.autoReceiveBuffer = null;
  }

  /**
   * Register a callback that fires whenever the BLE connection drops
   * (device turned off, out of range, or explicit disconnect).
   * Use this so the UI can update state appropriately.
   */
  setDisconnectHandler(handler: () => void): void {
    this.onDisconnectHandler = handler;
  }

  // ── Diagnostic: dump every service + characteristic UUID ─────────────────

  async logDiscoveredServices(): Promise<void> {
    const device = BLEService.getDevice();
    if (!device) { console.warn('[BLE DIAG] no device'); return; }
    try {
      const services = await device.services();
      console.log(`[BLE DIAG] ${services.length} service(s) on device:`);
      for (const svc of services) {
        console.log(`  SERVICE  ${svc.uuid}`);
        const chars = await svc.characteristics();
        for (const ch of chars) {
          console.log(
            `    CHAR   ${ch.uuid}` +
            `  notify=${ch.isNotifiable}` +
            `  indicate=${ch.isIndicatable}` +
            `  writeResp=${ch.isWritableWithResponse}` +
            `  writeNoResp=${ch.isWritableWithoutResponse}`
          );
        }
      }
      console.log('[BLE DIAG] expected NUS service : ' + NUS_SERVICE_UUID.toLowerCase());
      console.log('[BLE DIAG] expected NUS TX char : ' + NUS_TX_UUID.toLowerCase());
    } catch (e) {
      console.error('[BLE DIAG] service discovery error:', e);
    }
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  /**
   * Subscribe to all messages from the ESP32 (TX characteristic).
   * Must be called after connect(). Can be called once per connection.
   *
   * @param onMessage  Called for every parsed message (including binary chunks).
   */
  async subscribeToMessages(onMessage: (msg: ESP32Message) => void): Promise<void> {
    if (this.isSubscribed) {
      console.warn('ESP32Service: already subscribed to TX messages');
      return;
    }

    // Try MTU negotiation here — this is the last chance before streaming starts,
    // and the result is visible in the captured log output.
    const mtu = await BLEService.negotiateMTU(512);
    console.log(`ESP32Service: MTU at subscribe time = ${mtu} (need ≥ 100 for audio streaming)`);

    await BLEService.subscribeToCharacteristic(
      NUS_SERVICE_UUID,
      NUS_TX_UUID,
      (base64Value: string) => {
        const msg = this.parseMessage(base64Value);
        this.handleInternally(msg);
        onMessage(msg);
        // No ACK needed — firmware v8 defaults to ackModeEnabled=false (no-ACK streaming)
      }
    );

    this.isSubscribed = true;
    console.log('ESP32Service: subscribed to TX characteristic');

    // Send STATUS to wake firmware so it starts pushing NEW: notifications
    try {
      await this.writeCommand('STATUS');
    } catch (e) {
      console.warn('ESP32Service: STATUS ping failed:', e);
    }
  }

  // ── Write helpers ──────────────────────────────────────────────────────────

  /** Write a text command to the RX characteristic (with response / ACK). */
  private async writeCommand(command: string): Promise<void> {
    const device = BLEService.getDevice();
    if (!device) throw new Error('ESP32 not connected');

    const base64 = this.textToBase64(command + '\n');
    await device.writeCharacteristicWithResponseForService(
      NUS_SERVICE_UUID,
      NUS_RX_UUID,
      base64
    );

  }

  /** Write a raw binary chunk to the RX characteristic (without response for speed). */
  private async writeBinaryChunk(chunk: Uint8Array): Promise<void> {
    const device = BLEService.getDevice();
    if (!device) throw new Error('ESP32 not connected');

    const base64 = this.bytesToBase64(chunk);
    await device.writeCharacteristicWithoutResponseForService(
      NUS_SERVICE_UUID,
      NUS_RX_UUID,
      base64
    );
  }

  // ── Commands: App → ESP32 ─────────────────────────────────────────────────

  /** Ask ESP32 to return its LittleFS file list. Listen for TEXT messages. */
  async listFiles(): Promise<void> {
    await this.writeCommand('LIST');
  }

  /** Ask ESP32 to return storage stats. Listen for TEXT messages. */
  async getStatus(): Promise<void> {
    await this.writeCommand('STATUS');
  }

  /** Wipe all files from ESP32 flash. */
  async formatFlash(): Promise<void> {
    await this.writeCommand('FORMAT');
  }

  /**
   * Request a single file from the ESP32.
   * Returns a Promise that resolves with the complete file bytes when
   * END:filename is received.
   *
   * @param filename  e.g. 'rec_0000.wav'
   * @param timeoutMs  Optional timeout in ms (default 30 s)
   */
  async requestFile(filename: string, timeoutMs = 30_000): Promise<ArrayBuffer> {
    if (this.pendingReceive || this.multiReceive) {
      throw new Error('ESP32Service: a file transfer is already in progress');
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingReceive?.filename === filename) {
          this.pendingReceive = null;
        }
        reject(new Error(`requestFile timeout for ${filename}`));
      }, timeoutMs);

      const wrappedResolve = (data: ArrayBuffer) => {
        clearTimeout(timer);
        resolve(data);
      };

      const wrappedReject = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };

      this.pendingReceive = {
        filename,
        expectedSize: 0,
        chunks: [],
        bytesReceived: 0,
        resolve: wrappedResolve,
        reject: wrappedReject,
      };

      this.writeCommand(`SEND:${filename}`).catch(err => {
        this.pendingReceive = null;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Ask ESP32 to stream all stored files.
   * onFile is called once per file when END:filename is received.
   * onComplete is called when LISTENING is received (ESP32 finished sending).
   */
  requestAllFiles(
    onFile: (filename: string, data: ArrayBuffer) => void,
    onComplete: () => void
  ): void {
    if (this.pendingReceive || this.multiReceive) {
      throw new Error('ESP32Service: a file transfer is already in progress');
    }

    this.multiReceive = {
      currentFilename: '',
      currentChunks: [],
      onFile,
      onComplete,
    };

    this.writeCommand('SENDALL').catch(err => {
      console.error('SENDALL command failed:', err);
      this.multiReceive = null;
    });
  }

  // ── Sending file to ESP32 ─────────────────────────────────────────────────

  /**
   * Send a WAV/PCM file to the ESP32.
   * Sends binary data in 500-byte chunks (without response for speed),
   * then sends DONE:filename\n with response to signal completion.
   *
   * @param filename    e.g. 'response.wav'
   * @param audioData   The file bytes as an ArrayBuffer
   * @param onProgress  Optional callback(bytesSent, totalBytes)
   */
  async sendFileToESP32(
    filename: string,
    audioData: ArrayBuffer,
    onProgress?: (sent: number, total: number) => void
  ): Promise<void> {
    const bytes = new Uint8Array(audioData);
    const total = bytes.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    console.log(`ESP32Service: sending ${filename} (${total} bytes, ${totalChunks} chunks)`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, total);
      const chunk = bytes.slice(start, end);

      await this.writeBinaryChunk(chunk);
      onProgress?.(end, total);

      // Brief pause between chunks so the ESP32 BLE RX buffer doesn't overflow.
      // 10 ms is enough for 500-byte chunks at typical BLE 2 Mbps PHY.
      if (i < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Signal end of transfer — use write-with-response so we know ESP32 got it
    await this.writeCommand(`DONE:${filename}`);
    console.log(`ESP32Service: sent DONE:${filename}`);
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /** Reconnect to the last known ESP32 by device ID (no scan). */
  async reconnect(): Promise<boolean> {
    const connected = await BLEService.reconnect(NUS_SERVICE_UUID);
    if (connected) {
      this.resetState();
      BLEService.setOnDisconnect(() => {
        this.resetState();
        this.onDisconnectHandler?.();
      });
    }
    return connected;
  }

  /** Scan for and connect to the ESP32 advertising the NUS service. */
  async connect(): Promise<boolean> {
    const connected = await BLEService.scanAndConnect(NUS_SERVICE_UUID);
    if (connected) {
      this.resetState();
      // Wire up unexpected disconnect handling through BLEService
      BLEService.setOnDisconnect(() => {
        this.resetState();
        this.onDisconnectHandler?.();
      });
    }
    return connected;
  }

  async disconnect(): Promise<void> {
    this.resetState();
    await BLEService.disconnect();
    // Fire the handler so the UI can update
    this.onDisconnectHandler?.();
  }

  private resetState(): void {
    this.isSubscribed = false;
    if (this.pendingSendTimeout) {
      clearTimeout(this.pendingSendTimeout);
      this.pendingSendTimeout = null;
    }
    this.pendingReceive = null;
    this.multiReceive = null;
    this.autoReceiveBuffer = null;
    this.streamBuffer = null;
  }

  isConnected(): boolean {
    return BLEService.getIsConnected();
  }
}

export default new ESP32Service();
