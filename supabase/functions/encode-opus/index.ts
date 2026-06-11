/**
 * Supabase Edge Function: encode-opus
 *
 * Encodes raw 16kHz 16-bit mono PCM into length-prefixed raw Opus packets.
 * Output format: [uint16_t pktLen LE][opus bytes][uint16_t pktLen LE][...]
 *
 * Input:  { pcm: string }  - base64-encoded Int16Array (16kHz mono 16-bit)
 * Output: { opus: string } - base64-encoded length-prefixed Opus packet stream
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAMPLE_RATE = 16000;
const FRAME_SIZE = 320; // 20ms at 16kHz
const BITRATE = 24000; // 24 kbps
const MAX_PCM_BYTES = SAMPLE_RATE * 2 * 15; // 15 seconds, 16-bit mono

let opusModulePromise: Promise<any> | null = null;

function getOpusModule(): Promise<any> {
  if (!opusModulePromise) {
    opusModulePromise = import("npm:opusscript@0.1.1")
      .then((mod) => mod.default ?? mod)
      .catch((error) => {
        opusModulePromise = null;
        throw error;
      });
  }
  return opusModulePromise;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkBinary = "";
    for (let j = 0; j < chunk.length; j++) {
      chunkBinary += String.fromCharCode(chunk[j]);
    }
    binary += chunkBinary;
  }
  return btoa(binary);
}

serve(async (req: Request) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  let pcmB64: string;
  try {
    const body = await req.json() as { pcm: string };
    pcmB64 = body.pcm;
    if (!pcmB64) throw new Error("missing pcm field");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Bad request: ${e}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const pcmBytes = base64ToBytes(pcmB64);
  if (pcmBytes.byteLength > MAX_PCM_BYTES) {
    return new Response(
      JSON.stringify({
        error: `PCM too long for encode-opus (${pcmBytes.byteLength} bytes). Max is ${MAX_PCM_BYTES} bytes.`,
      }),
      { status: 413, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
  console.log(`[${requestId}] encode-opus: received ${pcmBytes.byteLength}B PCM`);

  let OpusScript: any;
  try {
    OpusScript = await getOpusModule();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Failed to load opusscript: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (OpusScript.ready) {
    try {
      await OpusScript.ready;
    } catch {
      // opusscript also works in builds that do not expose a ready promise.
    }
  }

  let encoder: any;
  try {
    encoder = new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);
    encoder.setBitrate(BITRATE);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Opus encoder init failed: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const packets: Uint8Array[] = [];
  let totalLen = 0;
  const totalSamples = Math.floor(pcmBytes.byteLength / 2);

  try {
    for (let i = 0; i + FRAME_SIZE <= totalSamples; i += FRAME_SIZE) {
      const frameBytes = new Uint8Array(pcmBytes.buffer, i * 2, FRAME_SIZE * 2);
      const encoded: Uint8Array = encoder.encode(frameBytes, FRAME_SIZE);
      const pkt = new Uint8Array(2 + encoded.length);
      pkt[0] = encoded.length & 0xff;
      pkt[1] = (encoded.length >> 8) & 0xff;
      pkt.set(encoded, 2);
      packets.push(pkt);
      totalLen += pkt.length;

      if (packets.length % 100 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } catch (e) {
    encoder.delete?.();
    return new Response(
      JSON.stringify({ error: `Encode loop failed: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  encoder.delete?.();

  if (packets.length === 0) {
    return new Response(
      JSON.stringify({ error: `PCM too short - need >= ${FRAME_SIZE * 2} bytes (got ${pcmBytes.byteLength})` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const pkt of packets) {
    result.set(pkt, offset);
    offset += pkt.length;
  }

  const opus = bytesToBase64(result);

  console.log(
    `[${requestId}] encode-opus: ${pcmBytes.byteLength}B PCM -> ${totalLen}B Opus ` +
      `(${packets.length} frames, ${((totalLen / pcmBytes.byteLength) * 100).toFixed(1)}%, ` +
      `${Date.now() - startedAt}ms)`,
  );

  return new Response(
    JSON.stringify({ opus }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
