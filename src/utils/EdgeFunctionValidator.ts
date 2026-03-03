/**
 * Edge Function Validator
 * Validates that all Supabase Edge Functions are properly configured and accessible
 */

import { supabase } from '../config/supabase';

interface EdgeFunctionStatus {
  name: string;
  endpoint: string;
  status: 'ok' | 'error' | 'unconfigured';
  message: string;
  requiredSecrets: string[];
}

class EdgeFunctionValidator {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    // Get Supabase URL and key from environment or config
    this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://etsnyensdpagqfbuxdpe.supabase.co';
    this.supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0c255ZW5zZHBhZ3FmYnV4ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTM0MTQsImV4cCI6MjA4NTk2OTQxNH0.Z_iK2v6BVqB4tRHNWnIV3kaYjxM4y5UFQis68ad3btw';
  }

  /**
   * Test STT Edge Function
   */
  async testSTTFunction(): Promise<EdgeFunctionStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return {
          name: 'STT Processing',
          endpoint: '/functions/v1/stt-processing',
          status: 'error',
          message: 'User not authenticated',
          requiredSecrets: ['GOOGLE_STT_API_KEY']
        };
      }

      // Create a small test audio buffer (silence)
      const testAudio = new Uint8Array(1024);
      let binary = '';
      for (let i = 0; i < testAudio.byteLength; i++) {
        binary += String.fromCharCode(testAudio[i]);
      }
      const base64Audio = btoa(binary);

      const response = await fetch(`${this.supabaseUrl}/functions/v1/stt-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify({
          audio: base64Audio,
          userId: session.user.id,
          languageCode: 'en-US',
          sampleRateHertz: 16000,
          encoding: 'LINEAR16',
        })
      });

      if (response.status === 500) {
        const error = await response.json();
        if (error.error?.includes('GOOGLE_STT_API_KEY')) {
          return {
            name: 'STT Processing',
            endpoint: '/functions/v1/stt-processing',
            status: 'unconfigured',
            message: 'GOOGLE_STT_API_KEY not configured in Supabase secrets',
            requiredSecrets: ['GOOGLE_STT_API_KEY']
          };
        }
      }

      if (response.ok) {
        return {
          name: 'STT Processing',
          endpoint: '/functions/v1/stt-processing',
          status: 'ok',
          message: 'Edge function is accessible and configured',
          requiredSecrets: ['GOOGLE_STT_API_KEY']
        };
      } else {
        const error = await response.json();
        return {
          name: 'STT Processing',
          endpoint: '/functions/v1/stt-processing',
          status: 'error',
          message: `Error: ${error.error || response.statusText}`,
          requiredSecrets: ['GOOGLE_STT_API_KEY']
        };
      }
    } catch (error) {
      return {
        name: 'STT Processing',
        endpoint: '/functions/v1/stt-processing',
        status: 'error',
        message: `Network error: ${(error as Error).message}`,
        requiredSecrets: ['GOOGLE_STT_API_KEY']
      };
    }
  }

  /**
   * Test LLM Edge Function
   */
  async testLLMFunction(): Promise<EdgeFunctionStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return {
          name: 'LLM Processing',
          endpoint: '/functions/v1/llm-processing',
          status: 'error',
          message: 'User not authenticated',
          requiredSecrets: ['GEMINI_API_KEY']
        };
      }

      const response = await fetch(`${this.supabaseUrl}/functions/v1/llm-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify({
          prompt: 'Hello',
          userId: session.user.id,
          conversationId: 'test',
          toyPersonality: 'You are a friendly AI toy.',
        })
      });

      if (response.status === 500) {
        const error = await response.json();
        if (error.error?.includes('GEMINI_API_KEY')) {
          return {
            name: 'LLM Processing',
            endpoint: '/functions/v1/llm-processing',
            status: 'unconfigured',
            message: 'GEMINI_API_KEY not configured in Supabase secrets',
            requiredSecrets: ['GEMINI_API_KEY']
          };
        }
      }

      if (response.ok) {
        return {
          name: 'LLM Processing',
          endpoint: '/functions/v1/llm-processing',
          status: 'ok',
          message: 'Edge function is accessible and configured',
          requiredSecrets: ['GEMINI_API_KEY']
        };
      } else {
        const error = await response.json();
        return {
          name: 'LLM Processing',
          endpoint: '/functions/v1/llm-processing',
          status: 'error',
          message: `Error: ${error.error || response.statusText}`,
          requiredSecrets: ['GEMINI_API_KEY']
        };
      }
    } catch (error) {
      return {
        name: 'LLM Processing',
        endpoint: '/functions/v1/llm-processing',
        status: 'error',
        message: `Network error: ${(error as Error).message}`,
        requiredSecrets: ['GEMINI_API_KEY']
      };
    }
  }

  /**
   * Test TTS Edge Function
   */
  async testTTSFunction(): Promise<EdgeFunctionStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return {
          name: 'TTS Processing',
          endpoint: '/functions/v1/tts-processing',
          status: 'error',
          message: 'User not authenticated',
          requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
        };
      }

      const response = await fetch(`${this.supabaseUrl}/functions/v1/tts-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify({
          text: 'Hello',
          userId: session.user.id,
        })
      });

      if (response.status === 500) {
        const error = await response.json();
        const errorMsg = error.error || '';
        if (errorMsg.includes('RESEMBLE_API_KEY')) {
          return {
            name: 'TTS Processing',
            endpoint: '/functions/v1/tts-processing',
            status: 'unconfigured',
            message: 'RESEMBLE_API_KEY not configured in Supabase secrets',
            requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
          };
        }
        if (errorMsg.includes('Project ID') || errorMsg.includes('Voice ID')) {
          return {
            name: 'TTS Processing',
            endpoint: '/functions/v1/tts-processing',
            status: 'unconfigured',
            message: 'RESEMBLE_DEFAULT_PROJECT_ID or RESEMBLE_DEFAULT_VOICE_ID not configured',
            requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
          };
        }
      }

      if (response.ok) {
        return {
          name: 'TTS Processing',
          endpoint: '/functions/v1/tts-processing',
          status: 'ok',
          message: 'Edge function is accessible and configured',
          requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
        };
      } else {
        const error = await response.json();
        return {
          name: 'TTS Processing',
          endpoint: '/functions/v1/tts-processing',
          status: 'error',
          message: `Error: ${error.error || response.statusText}`,
          requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
        };
      }
    } catch (error) {
      return {
        name: 'TTS Processing',
        endpoint: '/functions/v1/tts-processing',
        status: 'error',
        message: `Network error: ${(error as Error).message}`,
        requiredSecrets: ['RESEMBLE_API_KEY', 'RESEMBLE_DEFAULT_PROJECT_ID', 'RESEMBLE_DEFAULT_VOICE_ID']
      };
    }
  }

  /**
   * Run all validation tests
   */
  async validateAll(): Promise<EdgeFunctionStatus[]> {
    console.log('Starting Edge Function validation...');
    
    const results = await Promise.all([
      this.testSTTFunction(),
      this.testLLMFunction(),
      this.testTTSFunction(),
    ]);

    return results;
  }

  /**
   * Print validation results
   */
  printResults(results: EdgeFunctionStatus[]): void {
    console.log('\n=== Edge Function Validation Results ===\n');
    
    results.forEach(result => {
      const statusEmoji = result.status === 'ok' ? '✅' : result.status === 'unconfigured' ? '⚠️' : '❌';
      console.log(`${statusEmoji} ${result.name}`);
      console.log(`   Endpoint: ${result.endpoint}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Message: ${result.message}`);
      console.log(`   Required Secrets: ${result.requiredSecrets.join(', ')}`);
      console.log('');
    });

    const allOk = results.every(r => r.status === 'ok');
    if (allOk) {
      console.log('✅ All edge functions are properly configured!');
    } else {
      console.log('⚠️ Some edge functions need configuration. See above for details.');
    }
  }
}

export default new EdgeFunctionValidator();
