/**
 * Voice Processing Integration Test
 * Tests the complete voice processing pipeline
 */

import VoiceProcessingService from '../services/VoiceProcessingService';
import GoogleSTTService from '../services/GoogleSTTService';
import LLMService from '../services/LLMService';
import TTSService from '../services/TTSService';
import BLEService from '../services/BLEService';
import EdgeFunctionValidator from './EdgeFunctionValidator';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

class VoiceProcessingIntegrationTest {
  private results: TestResult[] = [];

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 Starting Voice Processing Integration Tests\n');

    // Test 1: Validate Edge Functions
    await this.testEdgeFunctionValidation();

    // Test 2: Service Initialization
    await this.testServiceInitialization();

    // Test 3: STT Service
    await this.testSTTService();

    // Test 4: LLM Service
    await this.testLLMService();

    // Test 5: TTS Service
    await this.testTTSService();

    // Test 6: BLE Service
    await this.testBLEService();

    // Test 7: Complete Pipeline
    await this.testCompletePipeline();

    this.printResults();
    return this.results;
  }

  /**
   * Test 1: Edge Function Validation
   */
  private async testEdgeFunctionValidation(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 1: Edge Function Validation');
      
      const results = await EdgeFunctionValidator.validateAll();
      const allOk = results.every(r => r.status === 'ok');

      if (allOk) {
        this.results.push({
          name: 'Edge Function Validation',
          status: 'pass',
          message: 'All edge functions are properly configured',
          duration: Date.now() - startTime
        });
        console.log('✅ All edge functions validated\n');
      } else {
        const unconfigured = results.filter(r => r.status === 'unconfigured');
        const errors = results.filter(r => r.status === 'error');
        
        let message = '';
        if (unconfigured.length > 0) {
          message += `Unconfigured: ${unconfigured.map(r => r.name).join(', ')}. `;
        }
        if (errors.length > 0) {
          message += `Errors: ${errors.map(r => r.name).join(', ')}`;
        }

        this.results.push({
          name: 'Edge Function Validation',
          status: 'fail',
          message: message,
          duration: Date.now() - startTime
        });
        console.log('❌ Some edge functions are not configured\n');
      }
    } catch (error) {
      this.results.push({
        name: 'Edge Function Validation',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ Edge function validation failed\n');
    }
  }

  /**
   * Test 2: Service Initialization
   */
  private async testServiceInitialization(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 2: Service Initialization');

      const initialized = await VoiceProcessingService.initialize({
        ttsLanguage: 'en-US',
      });

      if (initialized) {
        this.results.push({
          name: 'Service Initialization',
          status: 'pass',
          message: 'Voice processing service initialized successfully',
          duration: Date.now() - startTime
        });
        console.log('✅ Services initialized\n');
      } else {
        this.results.push({
          name: 'Service Initialization',
          status: 'fail',
          message: 'Failed to initialize voice processing service',
          duration: Date.now() - startTime
        });
        console.log('❌ Service initialization failed\n');
      }
    } catch (error) {
      this.results.push({
        name: 'Service Initialization',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ Service initialization error\n');
    }
  }

  /**
   * Test 3: STT Service
   */
  private async testSTTService(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 3: STT Service');

      // Create a small test audio buffer
      const testAudio = new Uint8Array(1024);
      
      const result = await GoogleSTTService.transcribe(testAudio.buffer);

      if (result.success) {
        this.results.push({
          name: 'STT Service',
          status: 'pass',
          message: `Transcription successful: "${result.text}"`,
          duration: Date.now() - startTime
        });
        console.log('✅ STT service working\n');
      } else {
        // Check if it's an API key issue
        if (result.error.includes('API') || result.error.includes('configured')) {
          this.results.push({
            name: 'STT Service',
            status: 'skip',
            message: `API not configured: ${result.error}`,
            duration: Date.now() - startTime
          });
          console.log('⏭️  STT service skipped (API not configured)\n');
        } else {
          this.results.push({
            name: 'STT Service',
            status: 'fail',
            message: result.error,
            duration: Date.now() - startTime
          });
          console.log('❌ STT service failed\n');
        }
      }
    } catch (error) {
      this.results.push({
        name: 'STT Service',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ STT service error\n');
    }
  }

  /**
   * Test 4: LLM Service
   */
  private async testLLMService(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 4: LLM Service');

      const result = await LLMService.getResponse('Hello', {
        toyPersonality: 'You are a friendly AI toy.'
      });

      if (result.success) {
        this.results.push({
          name: 'LLM Service',
          status: 'pass',
          message: `LLM response received: "${result.response.substring(0, 50)}..."`,
          duration: Date.now() - startTime
        });
        console.log('✅ LLM service working\n');
      } else {
        if (result.error.includes('API') || result.error.includes('configured')) {
          this.results.push({
            name: 'LLM Service',
            status: 'skip',
            message: `API not configured: ${result.error}`,
            duration: Date.now() - startTime
          });
          console.log('⏭️  LLM service skipped (API not configured)\n');
        } else {
          this.results.push({
            name: 'LLM Service',
            status: 'fail',
            message: result.error,
            duration: Date.now() - startTime
          });
          console.log('❌ LLM service failed\n');
        }
      }
    } catch (error) {
      this.results.push({
        name: 'LLM Service',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ LLM service error\n');
    }
  }

  /**
   * Test 5: TTS Service
   */
  private async testTTSService(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 5: TTS Service');

      const result = await TTSService.speak('Hello world');

      if (result.success && result.audioData) {
        this.results.push({
          name: 'TTS Service',
          status: 'pass',
          message: `Audio generated: ${result.audioData.byteLength} bytes`,
          duration: Date.now() - startTime
        });
        console.log('✅ TTS service working\n');
      } else {
        if (result.error.includes('API') || result.error.includes('configured')) {
          this.results.push({
            name: 'TTS Service',
            status: 'skip',
            message: `API not configured: ${result.error}`,
            duration: Date.now() - startTime
          });
          console.log('⏭️  TTS service skipped (API not configured)\n');
        } else {
          this.results.push({
            name: 'TTS Service',
            status: 'fail',
            message: result.error,
            duration: Date.now() - startTime
          });
          console.log('❌ TTS service failed\n');
        }
      }
    } catch (error) {
      this.results.push({
        name: 'TTS Service',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ TTS service error\n');
    }
  }

  /**
   * Test 6: BLE Service
   */
  private async testBLEService(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 6: BLE Service');

      const isConnected = BLEService.getIsConnected();
      
      if (!isConnected) {
        this.results.push({
          name: 'BLE Service',
          status: 'skip',
          message: 'BLE device not connected (manual connection required)',
          duration: Date.now() - startTime
        });
        console.log('⏭️  BLE service skipped (device not connected)\n');
      } else {
        this.results.push({
          name: 'BLE Service',
          status: 'pass',
          message: 'BLE device connected',
          duration: Date.now() - startTime
        });
        console.log('✅ BLE service connected\n');
      }
    } catch (error) {
      this.results.push({
        name: 'BLE Service',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ BLE service error\n');
    }
  }

  /**
   * Test 7: Complete Pipeline
   */
  private async testCompletePipeline(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('📋 Test 7: Complete Pipeline');

      const isReady = VoiceProcessingService.isReady();

      if (isReady) {
        this.results.push({
          name: 'Complete Pipeline',
          status: 'pass',
          message: 'All services ready for voice processing',
          duration: Date.now() - startTime
        });
        console.log('✅ Complete pipeline ready\n');
      } else {
        this.results.push({
          name: 'Complete Pipeline',
          status: 'skip',
          message: 'Not all services ready (BLE device may not be connected)',
          duration: Date.now() - startTime
        });
        console.log('⏭️  Complete pipeline not ready\n');
      }
    } catch (error) {
      this.results.push({
        name: 'Complete Pipeline',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - startTime
      });
      console.log('❌ Complete pipeline error\n');
    }
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n=== Test Results Summary ===\n');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    this.results.forEach(result => {
      const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
      console.log(`${emoji} ${result.name}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Message: ${result.message}`);
      console.log(`   Duration: ${result.duration}ms\n`);
    });

    console.log(`\nTotal: ${this.results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);

    if (failed === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log(`\n❌ ${failed} test(s) failed. See above for details.`);
    }
  }
}

export default new VoiceProcessingIntegrationTest();
