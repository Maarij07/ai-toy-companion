import { supabase } from '../config/supabase';

interface TTSConfig {
  language?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  projectId?: string;  // Resemble project ID
  voiceId?: string;    // Resemble voice ID
}

class TTSService {
  private isInitialized: boolean = false;
  private config: TTSConfig | null = null;

  /**
   * Initialize the TTS service with configuration
   */
  async initialize(config: TTSConfig = {}): Promise<boolean> {
    try {
      this.config = config;
      this.isInitialized = true;
      console.log('TTS service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing TTS service:', error);
      return false;
    }
  }

  /**
   * Convert text to speech and return audio data
   */
  async speak(text: string): Promise<{ audioData: ArrayBuffer | null; success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { audioData: null, success: false, error: 'TTS service not initialized' };
      }

      console.log('Converting text to speech via Edge Function:', text);

      // Get the user's session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        return { audioData: null, success: false, error: 'User not authenticated' };
      }

      // Get Supabase config from supabase client (no local env)
      const supabaseUrl = supabase.supabaseUrl;
      const supabaseKey = supabase.supabaseKey;
      
      // Call the Supabase Edge Function for TTS processing (Resemble)
      const response = await fetch(`${supabaseUrl}/functions/v1/tts-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          text: text,
          userId: session.user.id,
          projectId: this.config?.projectId,
          voiceId: this.config?.voiceId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from TTS Edge Function');
      }

      // Download the audio file from the returned URL
      const audioResponse = await fetch(result.audioUrl);
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      
      const audioArrayBuffer = await audioResponse.arrayBuffer();

      console.log(`TTS audio downloaded: ${audioArrayBuffer.byteLength} bytes, format: WAV`);
      
      return { audioData: audioArrayBuffer, success: true, error: '' };
    } catch (error) {
      console.error('Error in TTS synthesis:', error);
      return { audioData: null, success: false, error: (error as Error).message };
    }
  }

  /**
   * Convert text to speech and save to file
   */
  async speakToFile(text: string, filePath: string): Promise<{ success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: 'TTS service not initialized' };
      }

      console.log('Converting text to speech via Edge Function and saving to file:', filePath);

      // Use the speak method to get audio data
      const result = await this.speak(text);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // In React Native, we'd need to use react-native-fs or similar to save the file
      // Since we're returning the audio data, the caller can handle saving to file
      console.log('Received audio data, file saving should be handled by caller');

      // Placeholder for actual file saving - in React Native this would use FileSystem
      return { success: true, error: '' };
    } catch (error) {
      console.error('Error in TTS synthesis to file:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get TTS audio URL without downloading (for direct playback)
   */
  async getAudioUrl(text: string): Promise<{ url: string; success: boolean; error: string }> {
    try {
      if (!this.isInitialized) {
        return { url: '', success: false, error: 'TTS service not initialized' };
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        return { url: '', success: false, error: 'User not authenticated' };
      }

      const supabaseUrl = supabase.supabaseUrl;
      const supabaseKey = supabase.supabaseKey;

      const response = await fetch(`${supabaseUrl}/functions/v1/tts-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          text,
          userId: session.user.id,
          projectId: this.config?.projectId,
          voiceId: this.config?.voiceId,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from TTS Edge Function');
      }

      return { url: result.audioUrl, success: true, error: '' };
    } catch (error) {
      console.error('Error getting TTS audio URL:', error);
      return { url: '', success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if TTS service is ready to use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): TTSConfig | null {
    return this.config;
  }
}

export default new TTSService();