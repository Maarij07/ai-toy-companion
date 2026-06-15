import {
  OpusStreamSender,
  FIRST_CHUNK_BYTES,
  STREAM_CHUNK_BYTES,
  OPUS_FRAME_BYTES,
} from '../src/services/OpusStreamSender';

const pcm = (bytes: number): ArrayBuffer => new ArrayBuffer(bytes);

interface Harness {
  sender: OpusStreamSender;
  sent: number[];
  encodeCalls: number[];
  resolvers: Array<(opus: ArrayBuffer) => void>;
  firstChunkSentAt: () => number;
}

function makeHarness(opts: { connected?: () => boolean; autoResolve?: boolean } = {}): Harness {
  const sent: number[] = [];
  const encodeCalls: number[] = [];
  const resolvers: Array<(opus: ArrayBuffer) => void> = [];
  let firstSentMark = -1;

  const sender = new OpusStreamSender({
    encode: (pcm16: ArrayBuffer) => {
      encodeCalls.push(pcm16.byteLength);
      if (opts.autoResolve !== false) {
        return Promise.resolve(new ArrayBuffer(Math.max(1, pcm16.byteLength / 10)));
      }
      return new Promise<ArrayBuffer>(resolve => { resolvers.push(resolve); });
    },
    send: (opus: Uint8Array) => {
      sent.push(opus.byteLength);
      if (firstSentMark === -1) firstSentMark = sent.length;
    },
    isConnected: opts.connected ?? (() => true),
  });

  return { sender, sent, encodeCalls, resolvers, firstChunkSentAt: () => firstSentMark };
}

describe('OpusStreamSender', () => {
  it('fires the first encode at the small first-chunk threshold', () => {
    const h = makeHarness();
    h.sender.addPcm16(pcm(FIRST_CHUNK_BYTES - OPUS_FRAME_BYTES));
    expect(h.encodeCalls).toHaveLength(0);

    h.sender.addPcm16(pcm(OPUS_FRAME_BYTES));
    expect(h.encodeCalls).toHaveLength(1);
    expect(h.encodeCalls[0]).toBe(FIRST_CHUNK_BYTES);
  });

  it('uses the larger steady-state threshold after the first chunk', () => {
    const h = makeHarness();
    h.sender.addPcm16(pcm(FIRST_CHUNK_BYTES));          // chunk 1 queued
    h.sender.addPcm16(pcm(STREAM_CHUNK_BYTES - OPUS_FRAME_BYTES));
    expect(h.encodeCalls).toHaveLength(1);              // below steady threshold

    h.sender.addPcm16(pcm(OPUS_FRAME_BYTES));
    expect(h.encodeCalls).toHaveLength(2);
    expect(h.encodeCalls[1]).toBe(STREAM_CHUNK_BYTES);
  });

  it('sends chunks in order even when a later encode resolves first', async () => {
    const h = makeHarness({ autoResolve: false });
    h.sender.addPcm16(pcm(FIRST_CHUNK_BYTES));   // chunk 1 — encode pending
    h.sender.addPcm16(pcm(STREAM_CHUNK_BYTES));  // chunk 2 — encode pending
    expect(h.resolvers).toHaveLength(2);

    h.resolvers[1](new ArrayBuffer(2));          // chunk 2 finishes first
    await Promise.resolve();
    expect(h.sent).toHaveLength(0);              // must wait for chunk 1

    h.resolvers[0](new ArrayBuffer(1));
    const result = await h.sender.finish();
    expect(h.sent).toEqual([1, 2]);              // strict order preserved
    expect(result.chunks).toBe(2);
    expect(result.totalOpusBytes).toBe(3);
  });

  it('flushes trailing frame-aligned PCM on finish', async () => {
    const h = makeHarness();
    h.sender.addPcm16(pcm(OPUS_FRAME_BYTES * 3 + 100)); // 3 frames + ragged tail
    expect(h.encodeCalls).toHaveLength(0);

    const result = await h.sender.finish();
    expect(h.encodeCalls).toEqual([OPUS_FRAME_BYTES * 3]); // tail < 1 frame dropped
    expect(result.chunks).toBe(1);
  });

  it('resolves with zero chunks when Gemini returned no audio', async () => {
    const h = makeHarness();
    const result = await h.sender.finish();
    expect(result.chunks).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('rejects finish() when the ESP32 disconnects mid-send', async () => {
    let connected = true;
    const h = makeHarness({ connected: () => connected });
    h.sender.addPcm16(pcm(FIRST_CHUNK_BYTES));
    connected = false;
    h.sender.addPcm16(pcm(STREAM_CHUNK_BYTES));
    await expect(h.sender.finish()).rejects.toThrow('ESP32 disconnected during send');
  });

  it('rejects finish() when an encode fails, without sending later chunks', async () => {
    const sent: number[] = [];
    let call = 0;
    const sender = new OpusStreamSender({
      encode: () => {
        call++;
        return call === 1
          ? Promise.reject(new Error('encode-opus edge fn failed'))
          : Promise.resolve(new ArrayBuffer(4));
      },
      send: (opus: Uint8Array) => { sent.push(opus.byteLength); },
      isConnected: () => true,
    });

    sender.addPcm16(pcm(FIRST_CHUNK_BYTES));
    sender.addPcm16(pcm(STREAM_CHUNK_BYTES));
    await expect(sender.finish()).rejects.toThrow('encode-opus edge fn failed');
    expect(sent).toHaveLength(0);
  });
});
