/**
 * WiFiTCPService — raw TCP socket wrapper for ESP32 WiFi TCP firmware (v1.0).
 *
 * INSTALL REQUIRED (one-time):
 *   npm install react-native-tcp-socket
 *   npx react-native run-android   (auto-links on RN 0.60+)
 *   cd ios && pod install && cd ..  (iOS only)
 *
 * Replaces BLEService. Provides the same interface so ESP32WiFiService
 * is a near-drop-in replacement for ESP32Service.
 *
 * Transport: raw TCP socket. ESP32 is the server on port 8765.
 * Both devices must be on the same WiFi network (or phone hotspot).
 * The ESP32 prints its IP to Serial on boot — use that IP in voiceConfig.ts.
 */

const TcpSocket = require('react-native-tcp-socket');
const { Buffer } = require('buffer');

const CONNECT_TIMEOUT_MS = 10_000;

class WiFiTCPService {
  private socket: any = null;
  private connected = false;
  private lastHost = '';
  private lastPort = 8765;
  private connectingPromise: Promise<boolean> | null = null;
  private connectingHost = '';
  private connectingPort = 8765;
  private onDataCallback: ((data: Uint8Array) => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  // ── Connect ──────────────────────────────────────────────────────────────────

  async connect(host: string, port = 8765): Promise<boolean> {
    if (this.connected && this.socket && this.lastHost === host && this.lastPort === port) {
      console.log(`[TCP] Reusing existing connection to ${host}:${port}`);
      return true;
    }

    if (this.connectingPromise && this.connectingHost === host && this.connectingPort === port) {
      console.log(`[TCP] Connect already in progress to ${host}:${port}`);
      return this.connectingPromise;
    }

    if (this.socket || this.connected) {
      this.disconnect();
    }

    this.lastHost = host;
    this.lastPort = port;
    this.connectingHost = host;
    this.connectingPort = port;

    this.connectingPromise = new Promise((resolve) => {
      let resolved = false;
      let sock: any = null;
      let connectTimer: ReturnType<typeof setTimeout> | null = null;

      const safeResolve = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          if (connectTimer) {
            clearTimeout(connectTimer);
            connectTimer = null;
          }
          this.connectingPromise = null;
          resolve(val);
        }
      };

      connectTimer = setTimeout(() => {
        console.warn(`[TCP] Connect timeout to ${host}:${port}`);
        try { sock?.destroy(); } catch {}
        if (this.socket === sock) {
          this.socket = null;
        }
        this.connected = false;
        safeResolve(false);
      }, CONNECT_TIMEOUT_MS);

      try {
        sock = TcpSocket.createConnection({ port, host }, () => {
          this.connected = true;
          this.socket = sock;
          console.log(`[TCP] Connected to ${host}:${port}`);
          safeResolve(true);
        });
      } catch (error) {
        console.error('[TCP] createConnection failed:', (error as Error)?.message ?? error);
        this.connected = false;
        this.socket = null;
        safeResolve(false);
        return;
      }

      sock.on('data', (raw: Buffer | string) => {
        const bytes = typeof raw === 'string'
          ? new Uint8Array(Buffer.from(raw, 'binary'))
          : new Uint8Array(raw as Buffer);
        this.onDataCallback?.(bytes);
      });

      sock.on('close', () => {
        if (this.socket === sock && this.connected) {
          console.log('[TCP] Connection closed');
          this.connected = false;
          this.socket = null;
          this.onDisconnectCallback?.();
        }
        if (this.socket === sock) {
          this.socket = null;
        }
        safeResolve(false);
      });

      sock.on('error', (err: any) => {
        console.error('[TCP] Socket error:', err?.message ?? err);
        if (this.socket === sock) {
          this.connected = false;
          this.socket = null;
        }
        safeResolve(false);
      });
    });

    return this.connectingPromise;
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  disconnect(): void {
    this.connectingPromise = null;
    this.connected = false;
    try { this.socket?.destroy(); } catch {}
    this.socket = null;
  }

  // ── Reconnect using last known host/port ─────────────────────────────────────

  async reconnect(): Promise<boolean> {
    if (!this.lastHost) return false;
    return this.connect(this.lastHost, this.lastPort);
  }

  // ── Send text (adds no newline — callers append \n) ─────────────────────────

  sendText(text: string): void {
    if (!this.socket || !this.connected) {
      console.warn('[TCP] sendText: not connected');
      return;
    }
    this.socket.write(text);
  }

  // ── Send raw binary bytes ────────────────────────────────────────────────────

  sendBinary(bytes: Uint8Array): void {
    if (!this.socket || !this.connected) {
      console.warn('[TCP] sendBinary: not connected');
      return;
    }
    this.socket.write(Buffer.from(bytes));
  }

  // ── Callbacks ────────────────────────────────────────────────────────────────

  setOnData(cb: (data: Uint8Array) => void): void {
    this.onDataCallback = cb;
  }

  setOnDisconnect(cb: () => void): void {
    this.onDisconnectCallback = cb;
  }

  getIsConnected(): boolean {
    return this.connected;
  }

  getLastHost(): string {
    return this.lastHost;
  }
}

export default new WiFiTCPService();
