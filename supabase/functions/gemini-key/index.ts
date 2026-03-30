/**
 * Supabase Edge Function: gemini-key
 *
 * Returns the GEMINI_LIVE_API_KEY secret to authenticated app clients.
 * The key is stored server-side and never hardcoded in the app bundle.
 *
 * The app caches this key in memory and only calls this function once per
 * session (the key doesn't expire like OAuth2 tokens do).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("GEMINI_LIVE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_LIVE_API_KEY secret not set" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ key: apiKey }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
