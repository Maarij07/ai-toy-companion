/**
 * Supabase Edge Function: encode-opus
 *
 * Encodes raw 16kHz 16-bit mono PCM into length-prefixed raw Opus packets.
 * Output format: [uint16_t pktLen LE][opus bytes][uint16_t pktLen LE][...]
 *
 * Input:  { pcm: string }  — base64-encoded Int16Array (16kHz mono 16-bit)
 * Output: { opus: string } — base64-encoded length-prefixed Opus packet stream
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAMPLE_RATE = 16000;
const FRAME_SIZE  = 320;   // 20ms at 16kHz
const BITRATE     = 24000; // 24 kbps

serve(async (req) => {
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
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Decode base64 → raw PCM bytes
  const pcmBytes = Uint8Array.from(atob(pcmB64), (c) => c.charCodeAt(0));

  // Dynamically import opusscript — catches WASM init errors cleanly
  let OpusScript: any;
  try {
    const mod = await import("npm:opusscript@0.1.1");
    OpusScript = mod.default ?? mod;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Failed to load opusscript: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Wait for WASM to initialise (opusscript may expose a ready promise)
  if (OpusScript.ready) {
    try { await OpusScript.ready; } catch (_) { /* ignore */ }
  }

  let encoder: any;
  try {
    encoder = new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);
    encoder.setBitrate(BITRATE);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Opus encoder init failed: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
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
    }
  } catch (e) {
    encoder.delete?.();
    return new Response(
      JSON.stringify({ error: `Encode loop failed: ${e}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  encoder.delete?.();

  if (packets.length === 0) {
    return new Response(
      JSON.stringify({ error: `PCM too short — need ≥ ${FRAME_SIZE * 2} bytes (got ${pcmBytes.byteLength})` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const pkt of packets) { result.set(pkt, offset); offset += pkt.length; }

  let binary = "";
  for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
  const opus = btoa(binary);

  console.log(
    `encode-opus: ${pcmBytes.byteLength}B PCM → ${totalLen}B Opus ` +
    `(${packets.length} frames, ${((totalLen / pcmBytes.byteLength) * 100).toFixed(1)}%)`
  );

  return new Response(
    JSON.stringify({ opus }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
