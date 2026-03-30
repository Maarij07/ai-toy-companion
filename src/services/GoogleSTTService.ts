import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';

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

  async transcribe(
    audioBuffer: ArrayBuffer | string,
    sampleRateHertz?: number,   // actual rate parsed from WAV header — overrides config
    audioChannelCount?: number,  // actual channels parsed from WAV header
  ): Promise<{ text: string; success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { text: '', success: false, error: 'Google STT service not initialized' };
      }

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

      let { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData?.session;

      // Force-refresh if the access token is expired or within 60s of expiry
      if (session) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at ?? 0;
          if (expiresAt - now < 60) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) session = refreshed.session;
        }
      }

      const userId = session?.user?.id;
      const authToken = session?.access_token ?? supabaseAnonKey;

      const response = await fetch(`${supabaseUrl}/functions/v1/stt-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          audio: audioContent,
          userId,
          languageCode: this.config?.languageCode || 'en-US',
          sampleRateHertz: sampleRateHertz ?? this.config?.sampleRateHertz ?? 16000,
          audioChannelCount: audioChannelCount ?? 1,
          encoding: this.config?.encoding || 'LINEAR16',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('STT edge function error body:', JSON.stringify(data));
        throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
      }
      if (!data?.success) throw new Error(data?.error || 'Unknown error from STT Edge Function');

      return { text: data.transcript, success: true, error: '' };
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
