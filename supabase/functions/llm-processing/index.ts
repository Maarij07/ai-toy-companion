// Supabase Edge Function: LLM Processing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Google Generative AI
interface GenerateContentRequest {
  contents: {
    parts: {
      text: string;
    }[];
  }[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GenerateContentResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason: string;
  };
}

const callGemini = async (prompt: string, apiKey: string, context?: string): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  
  // Construct the full prompt with context
  const fullPrompt = context ? `${context}\n\nUser: ${prompt}` : prompt;
  
  const requestBody: GenerateContentRequest = {
    contents: [{
      parts: [{
        text: fullPrompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data: GenerateContentResponse = await response.json();
  
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Prompt blocked: ${data.promptFeedback.blockReason}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No candidates returned from Gemini');
  }

  return data.candidates[0].content.parts[0].text;
};

console.log("LLM processing function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { prompt, userId, conversationId, context, toyPersonality } = await req.json();

    // Validate required fields
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get the API key from environment variables
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Determine the context to use - prioritize toyPersonality if provided, otherwise use general context
    const selectedContext = toyPersonality || context;
    
    // Call the LLM provider (currently Gemini)
    const responseText = await callGemini(prompt, geminiApiKey, selectedContext);

    // Log the interaction for analytics (optional)
    try {
      await supabase.from('llm_interactions').insert({
        user_id: userId || null,
        conversation_id: conversationId || null,
        prompt: prompt,
        response: responseText,
        provider: 'gemini',
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging interaction:', logError);
      // Continue processing even if logging fails
    }

    // Return the LLM response
    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        provider: 'gemini'
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in LLM processing:", error);
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