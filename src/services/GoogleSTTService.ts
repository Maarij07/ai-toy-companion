import { supabase } from '../config/supabase';

interface GoogleSTTConfig {
  languageCode?: string;
  sampleRateHertz?: number;
  encoding?: string;
}

class GoogleSTTService {
  private isInitialized: boolean = false;
  private config: GoogleSTTConfig | null = null;

  async initialize(config: GoogleSTTConfig = {}): Promise<boolean> {
    try {
      this.config = config;
      this.isInitialized = true;
      console.log('Google STT service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google STT service:', error);
      return false;
    }
  }

  async transcribe(audioBuffer: ArrayBuffer | string): Promise<{ text: string; success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { text: '', success: false, error: 'Google STT service not initialized' };
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        return { text: '', success: false, error: 'User not authenticated' };
      }

      // Get Supabase config from supabase client (no local env)
      const supabaseUrl = supabase.supabaseUrl;
      const supabaseKey = supabase.supabaseKey;

      // Convert audio to base64 for transmission
      let audioContent: string;
      if (typeof audioBuffer === 'string') {
        audioContent = audioBuffer;
      } else {
        const bytes = new Uint8Array(audioBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioContent = btoa(binary);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/stt-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          audio: audioContent,
          userId: session.user.id,
          languageCode: this.config?.languageCode || 'en-US',
          sampleRateHertz: this.config?.sampleRateHertz || 16000,
          encoding: this.config?.encoding || 'LINEAR16',
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`STT Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from STT Edge Function');
      }

      return { text: result.transcript, success: true, error: '' };
    } catch (error) {
      console.error('Error in Google STT transcription:', error);
      return { text: '', success: false, error: (error as Error).message };
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getConfig(): GoogleSTTConfig | null {
    return this.config;
  }
}

export default new GoogleSTTService();
