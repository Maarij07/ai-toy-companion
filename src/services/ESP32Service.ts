import BLEService from './BLEService';

// ─── Nordic UART Service (NUS) UUIDs ────────────────────────────────────────
// These are the standard NUS UUIDs used by the ESP32 firmware.
export const NUS_SERVICE_UUID  = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const NUS_RX_UUID       = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // App  → ESP32
export const NUS_TX_UUID       = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // ESP32 → App

const CHUNK_SIZE = 500; // bytes per write (binary data to ESP32)

// ─── Message types parsed from the TX characteristic ────────────────────────
export type ESP32Message =
  | { type: 'FILE_HEADER'; filename: string; size: number }  // FILE:name:size\n
  | { type: 'FILE_END';    filename: string }                // END:name\n
  | { type: 'LISTENING' }                                    // LISTENING\n
  | { type: 'SAVED';       filename: string }                // SAVED:name\n
  | { type: 'ERROR';       message: string }                 // ERROR:reason\n
  | { type: 'TEXT';        raw: string }                     // Any other text (LIST / STATUS reply)
  | { type: 'BINARY';      data: ArrayBuffer };              // Raw binary chunk

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
  // Handler + buffer for recordings the ESP32 pushes without being asked
  private autoReceiveHandler: ((filename: string, data: ArrayBuffer) => void) | null = null;
  private autoReceiveBuffer: AutoReceiveBuffer | null = null;

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
    const encoder = new TextEncoder();
    return this.bytesToBase64(encoder.encode(text));
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

    const knownPrefixes = ['FILE:', 'END:', 'SAVED:', 'ERROR:', 'LISTEN'];
    const isTextCommand = knownPrefixes.some(p => prefix.startsWith(p));

    if (!isTextCommand) {
      // Could still be a plaintext STATUS / LIST reply — only accept if all
      // bytes are printable ASCII or whitespace.
      const allPrintable = bytes.every(b => b === 10 || b === 13 || (b >= 32 && b <= 126));
      if (!allPrintable || bytes.length === 0) {
        return { type: 'BINARY', data: bytes.buffer };
      }
    }

    // Decode as UTF-8 text and strip trailing \r\n
    const text = new TextDecoder('utf-8').decode(bytes).replace(/[\r\n]+$/, '');

    if (text.startsWith('FILE:')) {
      // FILE:rec_0000.wav:160204
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

    // ── Autonomous push (ESP32 sends a recording without being asked) ──────
    // This is the main real-time pipeline path: ESP32 records → pushes file.
    if (this.autoReceiveHandler) {
      switch (msg.type) {
        case 'FILE_HEADER':
          this.autoReceiveBuffer = { filename: msg.filename, chunks: [] };
          console.log(`ESP32: incoming recording — ${msg.filename} (${msg.size} bytes expected)`);
          break;
        case 'BINARY':
          if (this.autoReceiveBuffer) {
            this.autoReceiveBuffer.chunks.push(msg.data);
          }
          break;
        case 'FILE_END':
          if (this.autoReceiveBuffer) {
            const data = this.assembleChunks(this.autoReceiveBuffer.chunks);
            console.log(`ESP32: recording complete — ${this.autoReceiveBuffer.filename} (${data.byteLength} bytes assembled)`);
            this.autoReceiveHandler(this.autoReceiveBuffer.filename, data);
            this.autoReceiveBuffer = null;
          }
          break;
        case 'ERROR':
          console.error('ESP32 error during autonomous push:', msg.message);
          this.autoReceiveBuffer = null;
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
    return assembled.buffer;
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

  /**
   * Register a handler that fires whenever the ESP32 autonomously pushes a
   * recording (FILE_HEADER → binary chunks → FILE_END) without the app
   * requesting it via requestFile(). This is the main real-time voice path.
   *
   * Must be called before subscribeToMessages().
   */
  setAutoReceiveHandler(handler: (filename: string, data: ArrayBuffer) => void): void {
    this.autoReceiveHandler = handler;
    this.autoReceiveBuffer = null;
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

    await BLEService.subscribeToCharacteristic(
      NUS_SERVICE_UUID,
      NUS_TX_UUID,
      (base64Value: string) => {
        const msg = this.parseMessage(base64Value);
        this.handleInternally(msg);
        onMessage(msg);
      }
    );

    this.isSubscribed = true;
    console.log('ESP32Service: subscribed to TX characteristic');
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
    console.log(`ESP32 ← "${command}"`);
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
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Signal end of transfer — use write-with-response so we know ESP32 got it
    await this.writeCommand(`DONE:${filename}`);
    console.log(`ESP32Service: sent DONE:${filename}`);
  }

  // ── Connection ────────────────────────────────────────────────────────────

  /** Scan for and connect to the ESP32 advertising the NUS service. */
  async connect(): Promise<boolean> {
    const connected = await BLEService.scanAndConnect(NUS_SERVICE_UUID);
    if (connected) {
      this.isSubscribed = false; // reset so subscribeToMessages can be called again
      this.pendingReceive = null;
      this.multiReceive = null;
    }
    return connected;
  }

  async disconnect(): Promise<void> {
    this.isSubscribed = false;
    this.pendingReceive = null;
    this.multiReceive = null;
    await BLEService.disconnect();
  }

  isConnected(): boolean {
    return BLEService.getIsConnected();
  }
}

export default new ESP32Service();
