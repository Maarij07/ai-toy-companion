/**
 * ESP32WiFiService — protocol layer for the WiFi TCP firmware (v1.0).
 *
 * Same message protocol as the BLE version (ESP32Service).
 * Only the transport changes: raw TCP socket instead of BLE GATT.
 *
 * Key differences vs BLE:
 *   • connect(host, port) instead of BLE scan
 *   • Raw bytes from TCP (no base64 encoding/decoding)
 *   • Chunk size 4096 bytes (vs 510 for BLE)
 *   • No MTU negotiation — TCP handles segmentation
 *   • 150ms delay before DONE to prevent TCP coalescing (firmware bug workaround)
 *
 * TCP message parsing strategy:
 *   ESP32 sends text commands as \n-terminated ASCII strings.
 *   With setNoDelay(true) on the ESP32 server, each print()/write() call goes
 *   as its own TCP segment. On local WiFi this means text and binary usually
 *   arrive as separate data events, just like BLE notifications.
 *   A line accumulator handles the rare case of partial text reads.
 *   Binary chunks (file transfer, live stream PCM) are detected by non-printable bytes.
 */

import WiFiTCPService from './WiFiTCPService';

const CHUNK_SIZE = 4096;

// ── Message types — identical to BLE version ──────────────────────────────────
export type ESP32WiFiMessage =
  | { type: 'CONNECTED' }
  | { type: 'NEW_FILE';     filename: string; size: number }
  | { type: 'FILE_HEADER';  filename: string; size: number }
  | { type: 'FILE_END';     filename: string }
  | { type: 'LISTENING' }
  | { type: 'READY_FOR_RESPONSE' }
  | { type: 'PLAYED';       filename: string }
  | { type: 'SAVED';        filename: string }
  | { type: 'ERROR';        message: string }
  | { type: 'TEXT';         raw: string }
  | { type: 'BINARY';       data: ArrayBuffer }
  | { type: 'STREAM_START'; filename: string }
  | { type: 'STREAM_END';   filename: string; dataBytes: number };

interface PendingReceive {
  filename: string;
  expectedSize: number;
  chunks: ArrayBuffer[];
  bytesReceived: number;
  resolve: (data: ArrayBuffer) => void;
  reject:  (err: Error) => void;
}

interface MultiReceive {
  currentFilename: string;
  currentChunks: ArrayBuffer[];
  onFile:     (filename: string, data: ArrayBuffer) => void;
  onComplete: () => void;
}

interface AutoReceiveBuffer {
  filename: string;
  chunks: ArrayBuffer[];
}

/**
 * Live audio handler — receives the mic stream chunk-by-chunk as the user
 * speaks (STREAM_START → PCM chunks → STREAM_END), instead of one assembled
 * buffer at the end. Lets the pipeline forward speech to Gemini in real time.
 * Chunks include the 44-byte WAV header the firmware sends at stream start.
 */
export interface LiveAudioHandler {
  onStart: (filename: string) => void;
  onChunk: (data: ArrayBuffer) => void;
  onEnd:   (filename: string, dataBytes: number) => void;
}

class ESP32WiFiService {
  private isSubscribed = false;
  private pendingReceive:      PendingReceive | null = null;
  private multiReceive:        MultiReceive   | null = null;
  private autoReceiveHandler:  ((filename: string, data: ArrayBuffer) => void) | null = null;
  private autoReceiveBuffer:   AutoReceiveBuffer | null = null;
  private liveAudioHandler:    LiveAudioHandler | null = null;
  private streamBuffer:        { filename: string; chunks: ArrayBuffer[] } | null = null;
  private pendingSendTimeout:  ReturnType<typeof setTimeout> | null = null;
  private onDisconnectHandler: (() => void) | null = null;

  // Text line accumulator — handles partial TCP reads of \n-terminated commands
  private lineBuffer = '';
  private readonly streamEndMarker = 'STREAM_END:';

  // ── Message parser (raw bytes → typed message) ────────────────────────────────
  //
  // With setNoDelay(true) on the ESP32 TCP server, text commands and binary data
  // arrive in separate TCP segments. Each data event is therefore either:
  //   a) A complete \n-terminated text line (or multiple lines)
  //   b) A raw binary chunk (PCM or Opus data)
  //
  // We distinguish them by checking printable-ASCII: binary data will contain
  // bytes outside 32-126, text commands won't.

  private parseChunk(bytes: Uint8Array): ESP32WiFiMessage {
    const prefixLen = Math.min(bytes.length, 20);
    let prefix = '';
    for (let i = 0; i < prefixLen; i++) prefix += String.fromCharCode(bytes[i]);

    const knownPrefixes = [
      'FILE:', 'NEW:', 'END:', 'SAVED:', 'ERROR:', 'LISTEN',
      'PLAYED:', 'READY_FOR', 'STREAM_START:', 'STREAM_END:', 'CONNECTED',
    ];
    const looksLikeText = knownPrefixes.some(p => prefix.startsWith(p));

    if (!looksLikeText) {
      const allPrintable = bytes.every(b => b === 10 || b === 13 || (b >= 32 && b <= 126));
      if (!allPrintable || bytes.length === 0) {
        return { type: 'BINARY', data: (bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
      }
    }

    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    text = text.replace(/[\r\n]+$/, '');

    if (text.startsWith('CONNECTED'))     return { type: 'CONNECTED' };
    if (text.startsWith('NEW:')) {
      const body = text.slice(4);
      const ci = body.lastIndexOf(':');
      return { type: 'NEW_FILE', filename: body.slice(0, ci), size: parseInt(body.slice(ci + 1), 10) };
    }
    if (text.startsWith('FILE:')) {
      const body = text.slice(5);
      const ci = body.lastIndexOf(':');
      return { type: 'FILE_HEADER', filename: body.slice(0, ci), size: parseInt(body.slice(ci + 1), 10) };
    }
    if (text.startsWith('END:'))               return { type: 'FILE_END',    filename: text.slice(4) };
    if (text.startsWith('SAVED:'))             return { type: 'SAVED',       filename: text.slice(6) };
    if (text.startsWith('ERROR:'))             return { type: 'ERROR',       message:  text.slice(6) };
    if (text.startsWith('LISTENING'))          return { type: 'LISTENING' };
    if (text.startsWith('READY_FOR_RESPONSE')) return { type: 'READY_FOR_RESPONSE' };
    if (text.startsWith('PLAYED:'))            return { type: 'PLAYED',      filename: text.slice(7) };
    if (text.startsWith('STREAM_START:'))      return { type: 'STREAM_START',filename: text.slice(13) };
    if (text.startsWith('STREAM_END:')) {
      const body = text.slice(11);
      const li = body.lastIndexOf(':');
      if (li === -1) return { type: 'STREAM_END', filename: body, dataBytes: 0 };
      return { type: 'STREAM_END', filename: body.slice(0, li), dataBytes: parseInt(body.slice(li + 1), 10) || 0 };
    }

    return { type: 'TEXT', raw: text };
  }

  // ── Incoming TCP data processor ───────────────────────────────────────────────
  //
  // TCP is a stream — bytes may arrive fragmented or coalesced.
  // Strategy:
  //   - If chunk contains non-printable bytes → binary data, dispatch immediately.
  //   - If chunk is all printable ASCII → accumulate into lineBuffer, dispatch per \n.
  // This handles partial line reads on local WiFi.

  private processIncomingBytes(
    bytes: Uint8Array,
    onMessage: (msg: ESP32WiFiMessage) => void
  ): void {
    let offset = 0;

    while (offset < bytes.length) {
      if (this.streamBuffer) {
        const markerIndex = this.indexOfAscii(bytes, this.streamEndMarker, offset);
        if (markerIndex === -1) {
          this.dispatchBinary(bytes.subarray(offset), onMessage);
          return;
        }

        if (markerIndex > offset) {
          this.dispatchBinary(bytes.subarray(offset, markerIndex), onMessage);
        }

        const lineEnd = this.findLineEnd(bytes, markerIndex);
        if (lineEnd === -1) {
          this.lineBuffer = this.bytesToAscii(bytes.subarray(markerIndex));
          return;
        }

        this.dispatchTextLine(bytes.subarray(markerIndex, lineEnd + 1), onMessage);
        offset = lineEnd + 1;
        continue;
      }

      const textLength = this.getTextPrefixLength(bytes, offset);
      if (textLength > 0) {
        this.consumeTextBytes(bytes.subarray(offset, offset + textLength), onMessage);
        offset += textLength;
        continue;
      }

      if (this.lineBuffer || this.isPrintableAsciiRun(bytes, offset)) {
        this.consumeTextBytes(bytes.subarray(offset), onMessage);
        return;
      }

      const nextTextIndex = this.findNextTextPrefix(bytes, offset + 1);
      const binaryEnd = nextTextIndex === -1 ? bytes.length : nextTextIndex;
      this.dispatchBinary(bytes.subarray(offset, binaryEnd), onMessage);
      offset = binaryEnd;
    }
  }

  private consumeTextBytes(
    bytes: Uint8Array,
    onMessage: (msg: ESP32WiFiMessage) => void
  ): void {
    for (let i = 0; i < bytes.length; i++) {
      const ch = String.fromCharCode(bytes[i]);
      this.lineBuffer += ch;
      if (ch === '\n') {
        const line = this.lineBuffer;
        this.lineBuffer = '';
        if (line.trim() === '') continue;
        const lineBytes = new Uint8Array(line.length);
        for (let j = 0; j < line.length; j++) lineBytes[j] = line.charCodeAt(j);
        this.dispatchTextLine(lineBytes, onMessage);
      }
    }
  }

  private dispatchTextLine(
    bytes: Uint8Array,
    onMessage: (msg: ESP32WiFiMessage) => void
  ): void {
    const msg = this.parseChunk(bytes);
    this.handleInternally(msg);
    onMessage(msg);
  }

  private dispatchBinary(
    bytes: Uint8Array,
    onMessage: (msg: ESP32WiFiMessage) => void
  ): void {
    if (bytes.length === 0) return;
    const msg: ESP32WiFiMessage = {
      type: 'BINARY',
      data: this.toArrayBuffer(bytes),
    };
    this.handleInternally(msg);
    onMessage(msg);
  }

  private getTextPrefixLength(bytes: Uint8Array, offset: number): number {
    const prefixes = [
      'CONNECTED', 'FILE:', 'NEW:', 'END:', 'SAVED:', 'ERROR:', 'LISTENING',
      'PLAYED:', 'READY_FOR_RESPONSE', 'STREAM_START:', 'STREAM_END:',
      'Flash:', 'State:', 'RX:', 'WiFi:', 'mDNS:', 'STATUS:', 'Unknown',
      '===', 'No recordings',
    ];

    if (!prefixes.some(prefix => this.startsWithAscii(bytes, prefix, offset))) {
      return 0;
    }

    const lineEnd = this.findLineEnd(bytes, offset);
    if (lineEnd !== -1) return lineEnd - offset + 1;

    let end = offset;
    while (end < bytes.length && this.isPrintableAscii(bytes[end])) end++;
    return end - offset;
  }

  private findNextTextPrefix(bytes: Uint8Array, from: number): number {
    const markers = [
      'STREAM_END:', 'STREAM_START:', 'CONNECTED', 'FILE:', 'NEW:', 'END:',
      'SAVED:', 'ERROR:', 'LISTENING', 'PLAYED:', 'READY_FOR_RESPONSE',
    ];

    let best = -1;
    for (const marker of markers) {
      const idx = this.indexOfAscii(bytes, marker, from);
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    }
    return best;
  }

  private startsWithAscii(bytes: Uint8Array, text: string, offset: number): boolean {
    if (offset + text.length > bytes.length) return false;
    for (let i = 0; i < text.length; i++) {
      if (bytes[offset + i] !== text.charCodeAt(i)) return false;
    }
    return true;
  }

  private indexOfAscii(bytes: Uint8Array, text: string, from = 0): number {
    const first = text.charCodeAt(0);
    for (let i = from; i <= bytes.length - text.length; i++) {
      if (bytes[i] !== first) continue;
      if (this.startsWithAscii(bytes, text, i)) return i;
    }
    return -1;
  }

  private findLineEnd(bytes: Uint8Array, from: number): number {
    for (let i = from; i < bytes.length; i++) {
      if (bytes[i] === 10) return i;
    }
    return -1;
  }

  private isPrintableAscii(byte: number): boolean {
    return byte === 10 || byte === 13 || (byte >= 32 && byte <= 126);
  }

  private isPrintableAsciiRun(bytes: Uint8Array, offset: number): boolean {
    if (offset >= bytes.length) return false;
    for (let i = offset; i < bytes.length; i++) {
      if (!this.isPrintableAscii(bytes[i])) return false;
    }
    return true;
  }

  private bytesToAscii(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return (bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  // ── Internal state machine (file receive, same as BLE version) ─────────────────

  private handleInternally(msg: ESP32WiFiMessage): void {
    // ── Single file request ─────────────────────────────────────────────────────
    if (this.pendingReceive) {
      switch (msg.type) {
        case 'FILE_HEADER': this.pendingReceive.expectedSize = msg.size; break;
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

    // ── SENDALL (multi-file) ────────────────────────────────────────────────────
    if (this.multiReceive) {
      switch (msg.type) {
        case 'FILE_HEADER':
          this.multiReceive.currentFilename = msg.filename;
          this.multiReceive.currentChunks   = [];
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
          this.multiReceive.onComplete();
          this.multiReceive = null;
          break;
        case 'ERROR':
          console.error('ESP32WiFi: SENDALL error:', msg.message);
          this.multiReceive = null;
          break;
      }
      return;
    }

    // ── Autonomous push from ESP32 ──────────────────────────────────────────────
    //
    // Two protocols:
    //   Live stream (Gemini Live path):
    //     STREAM_START:name → [WAV header + PCM chunks] → STREAM_END:name:bytes
    //     With a LiveAudioHandler set, chunks are forwarded as they arrive;
    //     otherwise they are buffered and delivered assembled at STREAM_END.
    //   Store-and-forward:
    //     NEW:name:size → app sends SEND:name → FILE:name:size → [binary] → END:name
    if (this.autoReceiveHandler || this.liveAudioHandler) {
      switch (msg.type) {
        case 'STREAM_START':
          // streamBuffer doubles as the "stream in progress" marker that
          // routes binary parsing — keep it set even in live mode.
          this.streamBuffer = { filename: msg.filename, chunks: [] };
          console.log(`ESP32WiFi: live stream start — ${msg.filename}`);
          this.liveAudioHandler?.onStart(msg.filename);
          break;
        case 'STREAM_END':
          if (this.streamBuffer) {
            if (this.liveAudioHandler) {
              console.log(
                `ESP32WiFi: stream complete — ${this.streamBuffer.filename} ` +
                `| ${msg.dataBytes}B forwarded live`
              );
              this.streamBuffer = null;
              this.liveAudioHandler.onEnd(msg.filename, msg.dataBytes);
              break;
            }
            const data = this.assembleChunks(this.streamBuffer.chunks);
            const pcmBytes = data.byteLength > 44 ? data.byteLength - 44 : data.byteLength;
            const durationMs = Math.round((pcmBytes / 2 / 16000) * 1000);
            console.log(
              `ESP32WiFi: stream complete — ${this.streamBuffer.filename} ` +
              `| total=${data.byteLength}B pcm=${pcmBytes}B ~${durationMs}ms`
            );
            this.autoReceiveHandler?.(this.streamBuffer.filename, data);
            this.streamBuffer = null;
          }
          break;
        case 'NEW_FILE':
          console.log(`ESP32WiFi: new recording — requesting ${msg.filename} in 300ms`);
          if (this.pendingSendTimeout) clearTimeout(this.pendingSendTimeout);
          this.pendingSendTimeout = setTimeout(() => {
            this.pendingSendTimeout = null;
            this.writeCommand(`SEND:${msg.filename}`).catch(e =>
              console.error(`ESP32WiFi: SEND:${msg.filename} failed:`, e)
            );
          }, 300);
          break;
        case 'FILE_HEADER':
          this.autoReceiveBuffer = { filename: msg.filename, chunks: [] };
          break;
        case 'FILE_END':
          if (this.autoReceiveBuffer) {
            const data = this.assembleChunks(this.autoReceiveBuffer.chunks);
            console.log(`ESP32WiFi: recording received — ${this.autoReceiveBuffer.filename} (${data.byteLength}B)`);
            this.autoReceiveHandler?.(this.autoReceiveBuffer.filename, data);
            this.autoReceiveBuffer = null;
          }
          break;
        case 'BINARY':
          if (this.streamBuffer) {
            if (this.liveAudioHandler) this.liveAudioHandler.onChunk(msg.data);
            else this.streamBuffer.chunks.push(msg.data);
          } else if (this.autoReceiveBuffer) {
            this.autoReceiveBuffer.chunks.push(msg.data);
          }
          break;
        case 'ERROR':
          console.error('ESP32WiFi: autonomous push error:', msg.message);
          this.autoReceiveBuffer = null;
          this.streamBuffer = null;
          break;
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private assembleChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(new Uint8Array(c), offset); offset += c.byteLength; }
    return out.buffer as ArrayBuffer;
  }

  private resolveReceive(pending: PendingReceive): void {
    const assembled = this.assembleChunks(pending.chunks);
    console.log(`ESP32WiFi: received ${pending.filename} (${assembled.byteLength}B)`);
    pending.resolve(assembled);
  }

  // ── Public API — same surface as ESP32Service ─────────────────────────────────

  setAutoReceiveHandler(handler: (filename: string, data: ArrayBuffer) => void): void {
    this.autoReceiveHandler = handler;
    this.autoReceiveBuffer  = null;
  }

  /**
   * Receive the live mic stream chunk-by-chunk instead of assembled at
   * STREAM_END. Pass null to revert to the buffered autoReceive path.
   */
  setLiveAudioHandler(handler: LiveAudioHandler | null): void {
    this.liveAudioHandler = handler;
  }

  setDisconnectHandler(handler: () => void): void {
    this.onDisconnectHandler = handler;
  }

  async subscribeToMessages(onMessage: (msg: ESP32WiFiMessage) => void): Promise<void> {
    if (this.isSubscribed) {
      console.warn('ESP32WiFiService: already subscribed');
      return;
    }

    WiFiTCPService.setOnData((bytes: Uint8Array) => {
      this.processIncomingBytes(bytes, onMessage);
    });

    this.isSubscribed = true;
    console.log('ESP32WiFiService: subscribed to TCP data stream');

    try { await this.writeCommand('STATUS'); } catch (e) {
      console.warn('ESP32WiFiService: STATUS ping failed:', e);
    }
  }

  private async writeCommand(command: string): Promise<void> {
    if (!WiFiTCPService.getIsConnected()) throw new Error('ESP32 not connected via WiFi');
    WiFiTCPService.sendText(command + '\n');
  }

  private writeBinaryChunk(chunk: Uint8Array): void {
    if (!WiFiTCPService.getIsConnected()) throw new Error('ESP32 not connected via WiFi');
    WiFiTCPService.sendBinary(chunk);
  }

  async listFiles():   Promise<void> { await this.writeCommand('LIST'); }
  async getStatus():   Promise<void> { await this.writeCommand('STATUS'); }
  async formatFlash(): Promise<void> { await this.writeCommand('FORMAT'); }

  /**
   * Send a raw binary Opus chunk to the ESP32 without a DONE signal.
   * Used by the streaming pipeline — call sendStreamDone() when all chunks are sent.
   */
  sendOpusChunk(data: Uint8Array): void {
    this.writeBinaryChunk(data);
  }

  /**
   * Send DONE:filename after a 150ms gap to terminate a streamed Opus send.
   * The gap prevents TCP coalescing from merging the last Opus bytes with DONE,
   * which would cause the firmware to miss the DONE marker and hang in STREAMING mode.
   */
  async sendStreamDone(filename: string): Promise<void> {
    await new Promise(r => setTimeout(r, 150));
    await this.writeCommand(`DONE:${filename}`);
    console.log(`ESP32WiFi: DONE:${filename} sent`);
  }

  async requestFile(filename: string, timeoutMs = 30_000): Promise<ArrayBuffer> {
    if (this.pendingReceive || this.multiReceive) {
      throw new Error('ESP32WiFiService: a transfer is already in progress');
    }
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingReceive?.filename === filename) this.pendingReceive = null;
        reject(new Error(`requestFile timeout for ${filename}`));
      }, timeoutMs);

      this.pendingReceive = {
        filename, expectedSize: 0, chunks: [], bytesReceived: 0,
        resolve: (data) => { clearTimeout(timer); resolve(data); },
        reject:  (err)  => { clearTimeout(timer); reject(err); },
      };

      this.writeCommand(`SEND:${filename}`).catch(err => {
        this.pendingReceive = null;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  requestAllFiles(
    onFile: (filename: string, data: ArrayBuffer) => void,
    onComplete: () => void
  ): void {
    if (this.pendingReceive || this.multiReceive) {
      throw new Error('ESP32WiFiService: a transfer is already in progress');
    }
    this.multiReceive = { currentFilename: '', currentChunks: [], onFile, onComplete };
    this.writeCommand('SENDALL').catch(err => {
      console.error('ESP32WiFi: SENDALL failed:', err);
      this.multiReceive = null;
    });
  }

  /**
   * Send Opus (or WAV) audio to the ESP32 for playback.
   *
   * Sends binary in 4096-byte chunks, then waits 150ms before DONE.
   * The 150ms gap is a firmware bug workaround: if DONE arrives in the same
   * TCP segment as the last Opus chunk, the ESP32 won't detect it
   * (handleTcpIncoming checks raw[0]=='D', but it would see Opus bytes instead).
   */
  async sendFileToESP32(
    filename: string,
    audioData: ArrayBuffer,
    onProgress?: (sent: number, total: number) => void
  ): Promise<void> {
    const bytes = new Uint8Array(audioData);
    const total = bytes.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    console.log(`ESP32WiFi: sending ${filename} (${total}B, ${totalChunks} chunks)`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end   = Math.min(start + CHUNK_SIZE, total);
      this.writeBinaryChunk(bytes.slice(start, end));
      onProgress?.(end, total);

      // Small yield between chunks — TCP flow control handles pacing,
      // but this prevents starving the JS thread on large transfers.
      if (i < totalChunks - 1) {
        await new Promise(r => setTimeout(r, 5));
      }
    }

    // 150ms gap before DONE — firmware bug workaround (TCP coalescing).
    // Without this, DONE may arrive in the same TCP read as the last Opus chunk
    // and be swallowed by the firmware's handleTcpIncoming(), leaving the ESP32
    // stuck in STREAMING mode.
    await new Promise(r => setTimeout(r, 150));
    await this.writeCommand(`DONE:${filename}`);
    console.log(`ESP32WiFi: DONE:${filename} sent`);
  }

  // ── Connection management ─────────────────────────────────────────────────────

  async connect(host: string, port = 8765): Promise<boolean> {
    const ok = await WiFiTCPService.connect(host, port);
    if (ok) {
      this.resetState();
      WiFiTCPService.setOnDisconnect(() => {
        this.resetState();
        this.onDisconnectHandler?.();
      });
    }
    return ok;
  }

  async reconnect(host?: string, port = 8765): Promise<boolean> {
    const h = host || WiFiTCPService.getLastHost();
    if (!h) return false;
    const ok = await WiFiTCPService.connect(h, port);
    if (ok) {
      this.resetState();
      WiFiTCPService.setOnDisconnect(() => {
        this.resetState();
        this.onDisconnectHandler?.();
      });
    }
    return ok;
  }

  async disconnect(): Promise<void> {
    this.resetState();
    WiFiTCPService.disconnect();
    this.onDisconnectHandler?.();
  }

  private resetState(): void {
    this.isSubscribed = false;
    this.lineBuffer   = '';
    if (this.pendingSendTimeout) { clearTimeout(this.pendingSendTimeout); this.pendingSendTimeout = null; }
    this.pendingReceive    = null;
    this.multiReceive      = null;
    this.autoReceiveBuffer = null;
    this.streamBuffer      = null;
  }

  isConnected(): boolean {
    return WiFiTCPService.getIsConnected();
  }
}

export default new ESP32WiFiService();
