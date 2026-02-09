import BLEService from './BLEService';
import WhisperService from './WhisperService';
import GoogleSTTService from './GoogleSTTService';
import LLMService from './LLMService';
import TTSService from './TTSService';

interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
  esp32ServiceUUID: string;
}

class VoiceProcessingService {
  private bleService: typeof BLEService;
  private whisperService: typeof WhisperService;
  private googleSTTService: typeof GoogleSTTService;
  private llmService: typeof LLMService;
  private ttsService: typeof TTSService;
  private config: VoiceProcessingConfig | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.bleService = BLEService;
    this.whisperService = WhisperService;
    this.googleSTTService = GoogleSTTService;
    this.llmService = LLMService;
    this.ttsService = TTSService;
  }

  /**
   * Initialize the voice processing service with configuration
   */
  async initialize(config: VoiceProcessingConfig): Promise<boolean> {
    try {
      this.config = config;

      // Initialize all services
      const initPromises = [];

      // Initialize Whisper if model path is provided
      if (config.whisperModelPath) {
        initPromises.push(
          this.whisperService.initialize({
            modelPath: config.whisperModelPath,
            language: 'en'
          })
        );
      }

      // Initialize Google STT (uses edge function, no client-side key needed)
      initPromises.push(
        this.googleSTTService.initialize({
          languageCode: 'en-US'
        })
      );

      // Initialize LLM service
      initPromises.push(
        this.llmService.initialize({})
      );

      // Initialize TTS service (uses edge function, project/voice IDs are server-side)
      initPromises.push(
        this.ttsService.initialize({
          language: config.ttsLanguage || 'en-US',
        })
      );

      await Promise.all(initPromises);
      this.isInitialized = true;
      console.log('Voice processing service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing voice processing service:', error);
      return false;
    }
  }

  /**
   * Process audio from ESP32 through the complete pipeline
   */
  async processAudioFromESP32(audioData: ArrayBuffer): Promise<{ success: boolean; error: string }> {
    try {
      if (!this.isInitialized || !this.config) {
        return { success: false, error: 'Voice processing service not initialized' };
      }

      console.log('Starting voice processing pipeline');

      // Step 1: Attempt to transcribe using Whisper (local)
      let transcriptionResult;
      
      if (this.whisperService.isReady()) {
        console.log('Attempting transcription with Whisper...');
        transcriptionResult = await this.whisperService.transcribe(audioData);
        
        if (!transcriptionResult.success) {
          console.log('Whisper failed, falling back to Google STT...');
        }
      } else {
        // If Whisper isn't ready, initialize with default values
        transcriptionResult = { text: '', success: false, error: 'Whisper not ready' };
      }

      // Step 2: If Whisper fails, use Google STT as fallback
      if (!transcriptionResult.success && this.googleSTTService.isReady()) {
        console.log('Using Google STT for transcription...');
        transcriptionResult = await this.googleSTTService.transcribe(audioData);
      }

      if (!transcriptionResult.success) {
        return { success: false, error: transcriptionResult.error };
      }

      const transcribedText = transcriptionResult.text;
      console.log('Transcription successful:', transcribedText);

      // Step 3: Send transcribed text to LLM for response
      if (!this.llmService.isReady()) {
        return { success: false, error: 'LLM service not available' };
      }

      console.log('Sending text to LLM...');
      // Pass toy personality context to the LLM
      const llmResult = await this.llmService.getResponse(transcribedText, {
        toyPersonality: 'You are a friendly bear toy named Buddy. Respond in a warm, caring, and child-friendly manner. Keep responses engaging but appropriate for children.',
        conversationId: 'default-conversation-id'  // In a real app, you'd generate or track conversation IDs
      });

      if (!llmResult.success) {
        return { success: false, error: llmResult.error };
      }

      const llmResponse = llmResult.response;
      console.log('LLM response received:', llmResponse);

      // Step 4: Convert LLM response to speech
      if (!this.ttsService.isReady()) {
        return { success: false, error: 'TTS service not available' };
      }

      console.log('Converting LLM response to speech...');
      const ttsResult = await this.ttsService.speak(llmResponse);

      if (!ttsResult.success) {
        return { success: false, error: ttsResult.error };
      }

      // Step 5: Send synthesized audio back to ESP32 via BLE
      if (!this.bleService.getIsConnected()) {
        return { success: false, error: 'ESP32 not connected' };
      }

      // Send the audio data to ESP32 via BLE
      console.log('Sending TTS audio to ESP32 via BLE...');
      
      try {
        // Send audio data to ESP32
        // Check if audio data is available before sending
        if (!ttsResult.audioData) {
          console.error('No audio data to send to ESP32');
          return { success: false, error: 'No audio data to send to ESP32' };
        }
        
        await this.bleService.writeCharacteristic(
          this.config.esp32ServiceUUID, 
          'audio_characteristic_uuid', // This should be the actual characteristic UUID for audio data
          ttsResult.audioData
        );
        console.log('Successfully sent audio to ESP32');
      } catch (sendError: unknown) {
        console.error('Error sending audio to ESP32:', sendError);
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        return { success: false, error: `Failed to send audio to ESP32: ${errorMessage}` };
      }

      console.log('Voice processing pipeline completed successfully');
      return { success: true, error: '' };
    } catch (error) {
      console.error('Error in voice processing pipeline:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Connect to ESP32 device
   */
  async connectToESP32(): Promise<boolean> {
    if (!this.config) {
      console.error('Voice processing service not configured');
      return false;
    }

    return await this.bleService.scanAndConnect(this.config.esp32ServiceUUID);
  }

  /**
   * Disconnect from ESP32 device
   */
  async disconnectFromESP32(): Promise<void> {
    await this.bleService.disconnect();
  }

  /**
   * Check if all required services are ready
   */
  isReady(): boolean {
    return this.isInitialized && 
           this.bleService.getIsConnected() && 
           (this.whisperService.isReady() || this.googleSTTService.isReady()) &&
           this.llmService.isReady() &&
           this.ttsService.isReady();
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceProcessingConfig | null {
    return this.config;
  }
}

export default new VoiceProcessingService();