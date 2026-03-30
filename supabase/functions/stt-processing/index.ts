// Supabase Edge Function: STT Processing using Google Cloud Speech-to-Text
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface GoogleSTTRequest {
  config: {
    encoding: string;
    sampleRateHertz: number;
    languageCode: string;
  };
  audio: {
    content: string;
  };
}

interface GoogleSTTResponse {
  results?: Array<{
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

const callGoogleSTT = async (
  audioContent: string,
  apiKey: string,
  languageCode: string,
  sampleRateHertz: number,
  encoding: string,
  audioChannelCount: number,
): Promise<string> => {
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  const requestBody = {
    config: {
      encoding,
      sampleRateHertz,
      languageCode,
      audioChannelCount,
      enableAutomaticPunctuation: true,
    },
    audio: {
      content: audioContent,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Google STT API error: ${response.status} ${response.statusText}`);
  }

  const data: GoogleSTTResponse = await response.json();

  if (data.error) {
    throw new Error(`Google STT error: ${data.error.message}`);
  }

  if (!data.results || data.results.length === 0) {
    throw new Error('No transcription results returned');
  }

  return data.results[0].alternatives[0].transcript;
};

console.log("STT processing function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { audio, userId, languageCode, sampleRateHertz, audioChannelCount, encoding } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: "Audio data is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const googleApiKey = Deno.env.get("GOOGLE_STT_API_KEY");
    if (!googleApiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_STT_API_KEY not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const transcript = await callGoogleSTT(
      audio,
      googleApiKey,
      languageCode || 'en-US',
      sampleRateHertz || 16000,
      encoding || 'LINEAR16',
      audioChannelCount || 1,
    );

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in STT processing:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
