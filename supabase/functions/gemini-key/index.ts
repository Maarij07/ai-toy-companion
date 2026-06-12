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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Require a signed-in user. The platform's verify_jwt gate is not enough:
 * the public anon key is itself a valid JWT and passes signature checks.
 * getUser() resolves the token to an actual auth user, which the anon key
 * (and any other non-user JWT) cannot do.
 */
async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — sign in required" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const unauthorized = await requireUser(req);
  if (unauthorized) return unauthorized;

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
