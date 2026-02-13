import BLEService from './BLEService';
import WhisperService from './WhisperService';
import GoogleSTTService from './GoogleSTTService';
import LLMService from './LLMService';
import TTSService from './TTSService';

interface VoiceProcessingConfig {
  whisperModelPath?: string;
  ttsLanguage?: string;
  esp32ServiceUUID: string;
  audioRxCharacteristicUUID: string; // For receiving audio from toy microphone
  audioTxCharacteristicUUID: string; // For sending audio to toy speaker
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

      // Initialize Whisper.cpp (local processing on mobile)
      if (config.whisperModelPath) {
        initPromises.push(
          this.whisperService.initialize({
            modelPath: config.whisperModelPath,
            language: 'en'
          })
        );
      }

      // Initialize Google STT as fallback (uses edge function with API key server-side)
      initPromises.push(
        this.googleSTTService.initialize({
          languageCode: 'en-US'
        })
      );

      // Initialize LLM service (Gemini via edge function)
      initPromises.push(
        this.llmService.initialize({})
      );

      // Initialize TTS service (Resemble via edge function)
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
   * Process audio chunks from toy microphone through the complete pipeline
   * NEW ARCHITECTURE: Toy records → sends WAV chunks → Whisper.cpp → Gemini → Resemble → send back to toy
   */
  async processAudioFromToy(audioData: ArrayBuffer, toyPersonality?: string): Promise<{ success: boolean; error: string }> {
    try {
      if (!this.isInitialized || !this.config) {
        return { success: false, error: 'Voice processing service not initialized' };
      }

      console.log('Starting voice processing pipeline (Toy → Mobile → Toy)');
      console.log(`Received audio data: ${audioData.byteLength} bytes`);

      // Step 1: Transcribe using Whisper.cpp (local on mobile)
      console.log('Transcribing audio with Whisper.cpp...');
      let transcriptionResult = await this.whisperService.transcribe(audioData);

      // Fallback to Google STT if Whisper fails
      if (!transcriptionResult.success && this.googleSTTService.isReady()) {
        console.log('Whisper failed, falling back to Google STT...');
        transcriptionResult = await this.googleSTTService.transcribe(audioData);
      }

      if (!transcriptionResult.success) {
        return { success: false, error: `STT failed: ${transcriptionResult.error}` };
      }

      const transcribedText = transcriptionResult.text;
      console.log('Transcription successful:', transcribedText);

      // Step 2: Send transcribed text to Gemini LLM (via Edge Function)
      if (!this.llmService.isReady()) {
        return { success: false, error: 'LLM service not available' };
      }

      console.log('Sending text to Gemini LLM...');
      const llmResult = await this.llmService.getResponse(transcribedText, {
        toyPersonality: toyPersonality || 'You are a friendly AI toy companion. Respond in a warm, caring, and child-friendly manner. Keep responses short, engaging, and appropriate for children.',
        conversationId: `toy-${Date.now()}`
      });

      if (!llmResult.success) {
        return { success: false, error: `LLM failed: ${llmResult.error}` };
      }

      const llmResponse = llmResult.response;
      console.log('Gemini response received:', llmResponse);

      // Step 3: Convert LLM response to speech using Resemble TTS (via Edge Function)
      if (!this.ttsService.isReady()) {
        return { success: false, error: 'TTS service not available' };
      }

      console.log('Converting response to speech with Resemble TTS...');
      const ttsResult = await this.ttsService.speak(llmResponse);

      if (!ttsResult.success || !ttsResult.audioData) {
        return { success: false, error: `TTS failed: ${ttsResult.error}` };
      }

      console.log(`TTS audio generated: ${ttsResult.audioData.byteLength} bytes`);

      // Step 4: Send audio chunks back to toy via BLE
      if (!this.bleService.getIsConnected()) {
        return { success: false, error: 'Toy not connected via BLE' };
      }

      console.log('Sending audio chunks to toy via BLE...');
      
      try {
        await this.bleService.sendAudioChunks(
          this.config.esp32ServiceUUID, 
          this.config.audioTxCharacteristicUUID,
          ttsResult.audioData,
          512 // Chunk size in bytes
        );
        console.log('Successfully sent audio chunks to toy');
      } catch (sendError: unknown) {
        console.error('Error sending audio to toy:', sendError);
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        return { success: false, error: `Failed to send audio to toy: ${errorMessage}` };
      }

      console.log('Voice processing pipeline completed successfully');
      return { success: true, error: '' };
    } catch (error) {
      console.error('Error in voice processing pipeline:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Start listening to audio chunks from toy microphone
   */
  async startListeningToToy(
    onProcessingComplete: (success: boolean, error?: string) => void,
    toyPersonality?: string
  ): Promise<void> {
    if (!this.config) {
      console.error('Voice processing service not configured');
      return;
    }

    if (!this.bleService.getIsConnected()) {
      console.error('Toy not connected');
      return;
    }

    const audioChunks: ArrayBuffer[] = [];

    console.log('Started listening to toy microphone...');

    await this.bleService.subscribeToAudioChunks(
      this.config.esp32ServiceUUID,
      this.config.audioRxCharacteristicUUID,
      (chunk: ArrayBuffer) => {
        console.log(`Received audio chunk: ${chunk.byteLength} bytes`);
        audioChunks.push(chunk);
      },
      async () => {
        console.log('Audio recording complete, processing...');
        
        // Concatenate all chunks into single ArrayBuffer
        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const completeAudio = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of audioChunks) {
          completeAudio.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }

        console.log(`Complete audio assembled: ${completeAudio.byteLength} bytes`);

        // Process the complete audio through the pipeline
        const result = await this.processAudioFromToy(completeAudio.buffer, toyPersonality);
        
        onProcessingComplete(result.success, result.error);
        
        // Clear chunks for next recording
        audioChunks.length = 0;
      }
    );
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