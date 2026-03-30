import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  PermissionsAndroid,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncodingOption,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import { Mic, X, Volume2, AlertCircle, RotateCcw } from 'lucide-react-native';
import GoogleSTTService from '../services/GoogleSTTService';
import LLMService from '../services/LLMService';
import TTSService from '../services/TTSService';

type PipelineState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'done' | 'error';

const audioRecorderPlayer = new AudioRecorderPlayer();

const readFileAsBase64 = (filePath: string): Promise<string> => {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  return fetch(uri)
    .then(r => r.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
};

const PRIMARY = '#6D8B74';
const BG = '#0F172A';

export default function VoiceProcessingScreen({
  onClose,
}: {
  onClose: () => void;
}) {
  const [state, setState] = useState<PipelineState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const animActive = useRef(false);
  const scale1 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity2 = useRef(new Animated.Value(0)).current;

  // Clean up recorder/player on unmount
  useEffect(() => {
    return () => {
      animActive.current = false;
      audioRecorderPlayer.stopRecorder().catch(() => {});
      audioRecorderPlayer.stopPlayer().catch(() => {});
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  // Drive the two expanding ring animations when recording
  useEffect(() => {
    if (state !== 'recording') {
      animActive.current = false;
      scale1.setValue(1);
      opacity1.setValue(0);
      scale2.setValue(1);
      opacity2.setValue(0);
      return;
    }

    animActive.current = true;

    const runRing = (
      s: Animated.Value,
      o: Animated.Value,
      startDelay: number,
    ) => {
      let timer: ReturnType<typeof setTimeout>;
      const go = () => {
        if (!animActive.current) return;
        s.setValue(1);
        o.setValue(0.55);
        Animated.parallel([
          Animated.timing(s, {
            toValue: 2.8,
            duration: 1300,
            useNativeDriver: true,
          }),
          Animated.timing(o, {
            toValue: 0,
            duration: 1300,
            useNativeDriver: true,
          }),
        ]).start(({finished}) => {
          if (finished && animActive.current) go();
        });
      };
      timer = setTimeout(go, startDelay);
      return timer;
    };

    const t1 = runRing(scale1, opacity1, 0);
    const t2 = runRing(scale2, opacity2, 650);

    return () => {
      animActive.current = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message:
          'AI Toy Companion needs microphone access to talk to your AI toy.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const startRecording = async () => {
    const ok = await requestPermission();
    if (!ok) {
      setErrorMsg(
        'Microphone permission denied. Please enable it in app settings.',
      );
      setState('error');
      return;
    }

    setTranscript('');
    setAiResponse('');
    setErrorMsg('');
    setState('recording');

    const audioSet =
      Platform.OS === 'android'
        ? {
            AudioSamplingRateAndroid: 16000,
            AudioEncoderAndroid: AudioEncoderAndroidType.AMR_WB,
            AudioSourceAndroid: AudioSourceAndroidType.MIC,
            OutputFormatAndroid: OutputFormatAndroidType.AMR_WB,
          }
        : {
            AVSampleRateKeyIOS: 16000,
            AVFormatIDKeyIOS: AVEncodingOption.lpcm,
            AVLinearPCMBitDepthKeyIOS: 16,
            AVLinearPCMIsBigEndianKeyIOS: false,
            AVLinearPCMIsFloatKeyIOS: false,
            AVNumberOfChannelsKeyIOS: 1,
          };

    try {
      await audioRecorderPlayer.startRecorder(undefined, audioSet as any);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to start recording');
      setState('error');
    }
  };

  const stopRecordingAndProcess = async () => {
    try {
      const path = await audioRecorderPlayer.stopRecorder();
      await runPipeline(path);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to process recording');
      setState('error');
    }
  };

  const runPipeline = async (audioPath: string) => {
    try {
      // ── Step 1: Speech → Text ────────────────────────────────────────
      setState('transcribing');
      const base64 = await readFileAsBase64(audioPath);
      const encoding = Platform.OS === 'ios' ? 'LINEAR16' : 'AMR_WB';
      await GoogleSTTService.initialize({
        sampleRateHertz: 16000,
        encoding,
        languageCode: 'en-US',
      });
      const sttRes = await GoogleSTTService.transcribe(base64);
      if (!sttRes.success)
        throw new Error(sttRes.error || 'Speech recognition failed');
      if (!sttRes.text?.trim())
        throw new Error("Couldn't hear anything. Please speak clearly and try again.");
      setTranscript(sttRes.text);

      // ── Step 2: Text → LLM response ─────────────────────────────────
      setState('thinking');
      await LLMService.initialize({provider: 'google'});
      const llmRes = await LLMService.getResponse(sttRes.text);
      if (!llmRes.success)
        throw new Error(llmRes.error || 'AI failed to respond');
      setAiResponse(llmRes.response);

      // ── Step 3: Response → Speech ────────────────────────────────────
      setState('speaking');
      await TTSService.initialize();
      const ttsRes = await TTSService.getAudioUrl(llmRes.response);
      if (!ttsRes.success)
        throw new Error(ttsRes.error || 'Text-to-speech failed');

      await audioRecorderPlayer.startPlayer(ttsRes.url);
      audioRecorderPlayer.addPlayBackListener(e => {
        if (e.duration > 0 && e.currentPosition >= e.duration - 100) {
          audioRecorderPlayer.stopPlayer();
          audioRecorderPlayer.removePlayBackListener();
          setState('done');
        }
      });
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  const handleMicPress = () => {
    if (state === 'recording') {
      stopRecordingAndProcess();
    } else if (
      state === 'idle' ||
      state === 'done' ||
      state === 'error'
    ) {
      startRecording();
    }
  };

  const isProcessing = state === 'transcribing' || state === 'thinking';
  const isDisabled = isProcessing || state === 'speaking';

  const statusText: Partial<Record<PipelineState, string>> = {
    idle: 'Tap the mic to speak',
    recording: 'Listening...  tap to stop',
    transcribing: 'Understanding you...',
    thinking: 'Thinking of a response...',
    speaking: 'Playing response...',
    done: 'Tap the mic to speak again',
  };

  const micBg =
    state === 'recording'
      ? '#E11D48'
      : isDisabled
      ? 'rgba(109,139,116,0.45)'
      : PRIMARY;

  const micShadowColor =
    state === 'recording' ? '#E11D48' : PRIMARY;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* ── Close button ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.closeBtn}
        onPress={onClose}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <X size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Talk to Buddy</Text>
        <Text style={s.headerSub}>Powered by AI</Text>
      </View>

      {/* ── Mic with expanding rings ──────────────────────────────── */}
      <View style={s.micArea}>
        {state === 'recording' && (
          <>
            <Animated.View
              style={[
                s.ring,
                {transform: [{scale: scale1}], opacity: opacity1},
              ]}
            />
            <Animated.View
              style={[
                s.ring,
                {transform: [{scale: scale2}], opacity: opacity2},
              ]}
            />
          </>
        )}

        <TouchableOpacity
          onPress={handleMicPress}
          disabled={isDisabled}
          style={[
            s.micBtn,
            {
              backgroundColor: micBg,
              shadowColor: micShadowColor,
            },
          ]}
          activeOpacity={0.82}>
          {isProcessing ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : state === 'speaking' ? (
            <Volume2 size={44} color="#FFFFFF" />
          ) : state === 'error' ? (
            <AlertCircle size={44} color="#FFFFFF" />
          ) : (
            <Mic size={44} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Status / error ───────────────────────────────────────── */}
      {state !== 'error' ? (
        <Text style={s.statusText}>{statusText[state] ?? ''}</Text>
      ) : (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={s.retryRow}
            onPress={() => setState('idle')}>
            <RotateCcw size={14} color="#fff" />
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Transcript & response cards ───────────────────────────── */}
      <ScrollView
        style={s.cards}
        contentContainerStyle={{paddingBottom: 32}}
        showsVerticalScrollIndicator={false}>
        {!!transcript && (
          <View style={s.card}>
            <Text style={s.cardLabel}>YOU SAID</Text>
            <Text style={s.cardText}>{transcript}</Text>
          </View>
        )}
        {!!aiResponse && (
          <View style={[s.card, s.responseCard]}>
            <Text style={[s.cardLabel, s.responseLbl]}>AI RESPONSE</Text>
            <Text style={s.cardText}>{aiResponse}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 64,
    marginBottom: 44,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 4,
  },
  micArea: {
    width: 190,
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#E11D48',
  },
  micBtn: {
    width: 128,
    height: 128,
    borderRadius: 64,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 16,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
  },
  statusText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 28,
    lineHeight: 22,
  },
  errorBox: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 28,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cards: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  responseCard: {
    backgroundColor: 'rgba(109,139,116,0.18)',
    borderColor: 'rgba(109,139,116,0.35)',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  responseLbl: {
    color: 'rgba(134,239,172,0.85)',
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 23,
  },
});
