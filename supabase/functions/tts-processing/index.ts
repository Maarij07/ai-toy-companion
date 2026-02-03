// Supabase Edge Function: TTS Processing using Resemble API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface ResembleV2Response {
  success: boolean;
  data?: {
    uuid: string;
    project_uuid: string;
    voice_uuid: string;
    text: string;
    preset: string;
    sample_rate: number;
    output_format: string;
    duration: number;
    status: string;
    error_message: string | null;
    created_by_username: string;
    created_by_email: string;
    created_at: string;
    updated_at: string;
    url: string;
    waveform_url: string;
    mp3_url: string;
  };
  error?: string;
}

const callResembleTTS = async (
  text: string, 
  apiKey: string,
  projectId: string,
  voiceId: string
): Promise<ResembleV2Response> => {
  const url = `https://api.resemble.ai/v2/projects/${projectId}/clips`;

  const requestBody = {
    voice_uuid: voiceId,
    text: text,
    title: `AI_Toy_Companion_${Date.now()}`,
    output_format: 'wav',  // Changed to WAV format for hardware compatibility
    sample_rate: 22050,
    include_waveform: false
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const data: ResembleV2Response = await response.json();
  
  if (!response.ok) {
    throw new Error(`Resemble API error: ${response.status} ${response.statusText}, ${JSON.stringify(data)}`);
  }

  return data;
};

console.log("TTS processing function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { text, userId, projectId, voiceId } = await req.json();

    // Validate required fields
    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get the API key from environment variables
    const resembleApiKey = Deno.env.get("RESEMBLE_API_KEY");
    if (!resembleApiKey) {
      return new Response(JSON.stringify({ error: "RESEMBLE_API_KEY not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Use default project and voice IDs if not provided
    const defaultProjectId = Deno.env.get("RESEMBLE_DEFAULT_PROJECT_ID") || projectId;
    const defaultVoiceId = Deno.env.get("RESEMBLE_DEFAULT_VOICE_ID") || voiceId;
    
    if (!defaultProjectId) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    if (!defaultVoiceId) {
      return new Response(JSON.stringify({ error: "Voice ID is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Call the TTS provider (Resemble)
    const response = await callResembleTTS(text, resembleApiKey, defaultProjectId, defaultVoiceId);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'TTS request failed');
    }

    // Log the TTS request for analytics (optional)
    try {
      await supabase.from('tts_requests').insert({
        user_id: userId || null,
        text: text,
        voice_id: defaultVoiceId,
        project_id: defaultProjectId,
        audio_url: response.data.mp3_url,
        status: response.data.status,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging TTS request:', logError);
      // Continue processing even if logging fails
    }

    // Return the TTS response
    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: response.data.mp3_url,
        clipId: response.data.uuid,
        status: response.data.status
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in TTS processing:", error);
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