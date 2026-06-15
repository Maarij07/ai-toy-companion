/**
 * OpusStreamSender — orders the encode→send pipeline for one Gemini turn.
 *
 * PCM (16 kHz 16-bit mono) is accumulated into chunks, each chunk's encode
 * starts immediately (overlapping Gemini's generation of the next chunk),
 * and encoded chunks are sent to the ESP32 strictly in order — each the
 * moment its encode resolves. Delivery no longer waits for turnComplete,
 * which removes Gemini's full generation time from the playback-start path.
 *
 * The first chunk uses a smaller threshold (~320 ms) so the firmware can
 * begin playback as early as possible; subsequent chunks use ~1 s to keep
 * the encode-call overhead low.
 */

// Opus frame = 320 samples @ 16 kHz = 640 bytes of PCM (20 ms)
export const OPUS_FRAME_BYTES = 640;
// First chunk: ~320 ms — gets audio to the toy fast
export const FIRST_CHUNK_BYTES = Math.floor(10240 / OPUS_FRAME_BYTES) * OPUS_FRAME_BYTES;
// Steady-state chunks: ~1 s, frame-aligned
export const STREAM_CHUNK_BYTES = Math.floor(32768 / OPUS_FRAME_BYTES) * OPUS_FRAME_BYTES;

export interface OpusSenderDeps {
  /** Encode one frame-aligned PCM16 chunk to length-prefixed Opus packets. */
  encode: (pcm16: ArrayBuffer) => Promise<ArrayBuffer>;
  /** Send one encoded chunk to the ESP32. */
  send: (opus: Uint8Array) => void;
  /** Transport liveness check — sending stops as soon as this is false. */
  isConnected: () => boolean;
  /** Fired once, when the first encoded chunk has been handed to the transport. */
  onFirstChunkSent?: () => void;
}

export class OpusStreamSender {
  private pending = new Uint8Array(0);
  private sendChain: Promise<void> = Promise.resolve();
  private queuedCount = 0;
  private sentCount = 0;
  private totalOpusBytes = 0;
  private firstSent = false;
  private finished = false;
  private aborted: Error | null = null;

  constructor(private deps: OpusSenderDeps) {}

  /** Add downsampled 16 kHz PCM as it arrives from Gemini. */
  addPcm16(pcm16: ArrayBuffer): void {
    if (this.finished) return;
    const merged = new Uint8Array(this.pending.byteLength + pcm16.byteLength);
    merged.set(this.pending);
    merged.set(new Uint8Array(pcm16), this.pending.byteLength);
    this.pending = merged;
    this.flush(false);
  }

  /**
   * Flush remaining PCM, wait for every queued chunk to encode and send.
   * Resolves with chunk/byte counts; rejects if the transport dropped or an
   * encode failed (in-order delivery means nothing after the failure was sent).
   */
  async finish(): Promise<{ chunks: number; totalOpusBytes: number }> {
    this.finished = true;
    this.flush(true);
    await this.sendChain;
    if (this.aborted) throw this.aborted;
    return { chunks: this.sentCount, totalOpusBytes: this.totalOpusBytes };
  }

  /** Number of chunks queued for encoding so far. */
  get chunkCount(): number {
    return this.queuedCount;
  }

  private flush(force: boolean): void {
    for (;;) {
      const threshold = force
        ? OPUS_FRAME_BYTES
        : this.queuedCount === 0 ? FIRST_CHUNK_BYTES : STREAM_CHUNK_BYTES;
      if (this.pending.byteLength < threshold) return;

      const take = force
        ? Math.floor(this.pending.byteLength / OPUS_FRAME_BYTES) * OPUS_FRAME_BYTES
        : threshold;
      const chunk = this.pending.slice(0, take);
      this.pending = this.pending.slice(take);
      this.enqueue(chunk.buffer as ArrayBuffer);
      console.log(`VPS|encode chunk ${this.queuedCount} queued (${chunk.byteLength}B PCM)`);
      if (force) return;
    }
  }

  private enqueue(pcm16: ArrayBuffer): void {
    this.queuedCount++;
    const encodePromise = this.deps.encode(pcm16);
    // Chain preserves order; encode of chunk N+1 still runs concurrently
    this.sendChain = this.sendChain
      .then(async () => {
        if (this.aborted) return;
        const opus = await encodePromise;
        if (!this.deps.isConnected()) {
          this.aborted = new Error('ESP32 disconnected during send');
          return;
        }
        this.deps.send(new Uint8Array(opus));
        this.sentCount++;
        this.totalOpusBytes += opus.byteLength;
        console.log(`VPS|chunk ${this.sentCount} sent (${opus.byteLength}B opus)`);
        if (!this.firstSent) {
          this.firstSent = true;
          this.deps.onFirstChunkSent?.();
        }
      })
      .catch(e => {
        if (!this.aborted) this.aborted = e instanceof Error ? e : new Error(String(e));
      });
  }
}
