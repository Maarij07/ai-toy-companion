import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';

interface LLMConfig {
  provider?: 'openai' | 'anthropic' | 'google' | 'custom';
  model?: string;
  baseURL?: string;
}

class LLMService {
  private isInitialized: boolean = false;
  private config: LLMConfig | null = null;

  /**
   * Initialize the LLM service with configuration
   */
  async initialize(config: LLMConfig): Promise<boolean> {
    try {
      this.config = config;
      this.isInitialized = true;
      console.log('LLM service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing LLM service:', error);
      return false;
    }
  }

  /**
   * Send text to LLM and get response
   */
  async getResponse(inputText: string, context?: any): Promise<{ response: string; success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { response: '', success: false, error: 'LLM service not initialized' };
      }

      console.log('Sending text to LLM Edge Function:', inputText);

      // Get the user's session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        return { response: '', success: false, error: 'User not authenticated' };
      }

      // Call the Supabase Edge Function for LLM processing (Gemini)
      const response = await fetch(`${supabaseUrl}/functions/v1/llm-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          prompt: inputText,
          userId: session.user.id,
          conversationId: context?.conversationId || null,
          toyPersonality: context?.toyPersonality || null,
          context: context?.generalContext || null
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from LLM Edge Function');
      }

      return { response: result.response, success: true, error: '' };
    } catch (error) {
      console.error('Error in LLM processing:', error);
      return { response: '', success: false, error: (error as Error).message };
    }
  }

  /**
   * Stream response from LLM (for real-time responses)
   */
  async streamResponse(
    inputText: string, 
    onChunk: (chunk: string) => void, 
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      if (!this.isInitialized || !this.config) {
        onError('LLM service not initialized');
        return;
      }

      console.log('Streaming response from LLM for:', inputText);

      // In a real implementation, this would establish a streaming connection to the LLM API
      // For now, we'll simulate the streaming behavior
      // Placeholder for actual streaming implementation
      console.log('Establishing streaming connection to LLM API');

      // Simulate streaming response
      // In real implementation, this would process chunks as they arrive from the API
    } catch (error) {
      console.error('Error in LLM streaming:', error);
      onError((error as Error).message);
    }
  }

  /**
   * Check if LLM service is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.config !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig | null {
    return this.config;
  }
}

export default new LLMService();
