/**
 * Diagnostic Report Generator
 * Generates a comprehensive diagnostic report of the voice processing system
 */

import { supabase } from '../config/supabase';
import EdgeFunctionValidator from './EdgeFunctionValidator';
import VoiceProcessingService from '../services/VoiceProcessingService';
import BLEService from '../services/BLEService';

interface DiagnosticReportData {
  timestamp: string;
  environment: {
    supabaseUrl: string;
    supabaseConfigured: boolean;
    userAuthenticated: boolean;
    userId?: string;
  };
  edgeFunctions: {
    stt: string;
    llm: string;
    tts: string;
  };
  services: {
    voiceProcessing: string;
    ble: string;
  };
  issues: string[];
  recommendations: string[];
}

class DiagnosticReport {
  /**
   * Generate complete diagnostic report
   */
  async generate(): Promise<DiagnosticReportData> {
    console.log('🔍 Generating diagnostic report...\n');

    const report: DiagnosticReportData = {
      timestamp: new Date().toISOString(),
      environment: await this.checkEnvironment(),
      edgeFunctions: await this.checkEdgeFunctions(),
      services: await this.checkServices(),
      issues: [],
      recommendations: []
    };

    // Analyze and add issues/recommendations
    this.analyzeReport(report);

    return report;
  }

  /**
   * Check environment configuration
   */
  private async checkEnvironment(): Promise<DiagnosticReportData['environment']> {
    console.log('📋 Checking environment...');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://etsnyensdpagqfbuxdpe.supabase.co';
    const { data: { session } } = await supabase.auth.getSession();

    return {
      supabaseUrl: supabaseUrl,
      supabaseConfigured: !!supabaseUrl,
      userAuthenticated: !!session,
      userId: session?.user.id
    };
  }

  /**
   * Check edge functions
   */
  private async checkEdgeFunctions(): Promise<DiagnosticReportData['edgeFunctions']> {
    console.log('📋 Checking edge functions...');

    const results = await EdgeFunctionValidator.validateAll();

    const sttStatus = results.find(r => r.name === 'STT Processing')?.status || 'unknown';
    const llmStatus = results.find(r => r.name === 'LLM Processing')?.status || 'unknown';
    const ttsStatus = results.find(r => r.name === 'TTS Processing')?.status || 'unknown';

    return {
      stt: sttStatus,
      llm: llmStatus,
      tts: ttsStatus
    };
  }

  /**
   * Check services
   */
  private async checkServices(): Promise<DiagnosticReportData['services']> {
    console.log('📋 Checking services...');

    const voiceProcessingReady = VoiceProcessingService.isReady();
    const bleConnected = BLEService.getIsConnected();

    return {
      voiceProcessing: voiceProcessingReady ? 'ready' : 'not ready',
      ble: bleConnected ? 'connected' : 'not connected'
    };
  }

  /**
   * Analyze report and identify issues
   */
  private analyzeReport(report: DiagnosticReportData): void {
    // Check environment
    if (!report.environment.supabaseConfigured) {
      report.issues.push('Supabase not configured');
      report.recommendations.push('Configure Supabase URL in src/config/supabase.ts');
    }

    if (!report.environment.userAuthenticated) {
      report.issues.push('User not authenticated');
      report.recommendations.push('User must be logged in before using voice processing');
    }

    // Check edge functions
    if (report.edgeFunctions.stt === 'unconfigured') {
      report.issues.push('STT edge function not configured');
      report.recommendations.push('Add GOOGLE_STT_API_KEY to Supabase secrets');
    }

    if (report.edgeFunctions.stt === 'error') {
      report.issues.push('STT edge function error');
      report.recommendations.push('Check Supabase function logs for details');
    }

    if (report.edgeFunctions.llm === 'unconfigured') {
      report.issues.push('LLM edge function not configured');
      report.recommendations.push('Add GEMINI_API_KEY to Supabase secrets');
    }

    if (report.edgeFunctions.llm === 'error') {
      report.issues.push('LLM edge function error');
      report.recommendations.push('Check Supabase function logs for details');
    }

    if (report.edgeFunctions.tts === 'unconfigured') {
      report.issues.push('TTS edge function not configured');
      report.recommendations.push('Add RESEMBLE_API_KEY, RESEMBLE_DEFAULT_PROJECT_ID, RESEMBLE_DEFAULT_VOICE_ID to Supabase secrets');
    }

    if (report.edgeFunctions.tts === 'error') {
      report.issues.push('TTS edge function error');
      report.recommendations.push('Check Supabase function logs for details');
    }

    // Check services
    if (report.services.voiceProcessing === 'not ready') {
      report.issues.push('Voice processing service not ready');
      report.recommendations.push('Initialize VoiceProcessingService with correct configuration');
    }

    if (report.services.ble === 'not connected') {
      report.recommendations.push('Connect to BLE device using VoiceProcessingService.connectToESP32()');
    }
  }

  /**
   * Print diagnostic report
   */
  print(report: DiagnosticReportData): void {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          VOICE PROCESSING DIAGNOSTIC REPORT                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📅 Timestamp: ${report.timestamp}\n`);

    // Environment
    console.log('🌍 ENVIRONMENT');
    console.log(`   Supabase URL: ${report.environment.supabaseUrl}`);
    console.log(`   Supabase Configured: ${report.environment.supabaseConfigured ? '✅' : '❌'}`);
    console.log(`   User Authenticated: ${report.environment.userAuthenticated ? '✅' : '❌'}`);
    if (report.environment.userId) {
      console.log(`   User ID: ${report.environment.userId}`);
    }
    console.log('');

    // Edge Functions
    console.log('⚙️  EDGE FUNCTIONS');
    console.log(`   STT Processing: ${this.statusEmoji(report.edgeFunctions.stt)} ${report.edgeFunctions.stt}`);
    console.log(`   LLM Processing: ${this.statusEmoji(report.edgeFunctions.llm)} ${report.edgeFunctions.llm}`);
    console.log(`   TTS Processing: ${this.statusEmoji(report.edgeFunctions.tts)} ${report.edgeFunctions.tts}`);
    console.log('');

    // Services
    console.log('🔧 SERVICES');
    console.log(`   Voice Processing: ${this.statusEmoji(report.services.voiceProcessing)} ${report.services.voiceProcessing}`);
    console.log(`   BLE Connection: ${this.statusEmoji(report.services.ble)} ${report.services.ble}`);
    console.log('');

    // Issues
    if (report.issues.length > 0) {
      console.log('⚠️  ISSUES');
      report.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
      console.log('');
    }

    // Summary
    const allOk = report.issues.length === 0;
    if (allOk) {
      console.log('✅ All systems operational! Ready to connect BLE device.\n');
    } else {
      console.log(`⚠️  ${report.issues.length} issue(s) detected. See recommendations above.\n`);
    }
  }

  /**
   * Get status emoji
   */
  private statusEmoji(status: string): string {
    switch (status) {
      case 'ok':
      case 'ready':
      case 'connected':
        return '✅';
      case 'error':
        return '❌';
      case 'unconfigured':
      case 'not ready':
      case 'not connected':
        return '⚠️';
      default:
        return '❓';
    }
  }

  /**
   * Export report as JSON
   */
  exportJSON(report: DiagnosticReportData): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as CSV
   */
  exportCSV(report: DiagnosticReportData): string {
    const lines: string[] = [];
    
    lines.push('Diagnostic Report');
    lines.push(`Timestamp,${report.timestamp}`);
    lines.push('');
    
    lines.push('Environment');
    lines.push(`Supabase URL,${report.environment.supabaseUrl}`);
    lines.push(`Supabase Configured,${report.environment.supabaseConfigured}`);
    lines.push(`User Authenticated,${report.environment.userAuthenticated}`);
    lines.push('');
    
    lines.push('Edge Functions');
    lines.push(`STT Processing,${report.edgeFunctions.stt}`);
    lines.push(`LLM Processing,${report.edgeFunctions.llm}`);
    lines.push(`TTS Processing,${report.edgeFunctions.tts}`);
    lines.push('');
    
    lines.push('Services');
    lines.push(`Voice Processing,${report.services.voiceProcessing}`);
    lines.push(`BLE Connection,${report.services.ble}`);
    lines.push('');
    
    lines.push('Issues');
    report.issues.forEach(issue => {
      lines.push(`"${issue}"`);
    });
    lines.push('');
    
    lines.push('Recommendations');
    report.recommendations.forEach(rec => {
      lines.push(`"${rec}"`);
    });
    
    return lines.join('\n');
  }
}

export default new DiagnosticReport();
