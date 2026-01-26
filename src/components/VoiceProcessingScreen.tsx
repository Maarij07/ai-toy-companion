import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  Box,
  Text,
  Button,
  ButtonText,
  VStack,
  HStack,
  Card,
  Heading,
  Icon,
  Pressable,
} from '@gluestack-ui/themed';
import { Mic, MicOff, Bluetooth, BluetoothConnected, Play, Square } from 'lucide-react-native';

import { VoiceProcessingService } from '../services';
import voiceConfig from '../config/voiceConfig';

const VoiceProcessingScreen = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize the voice processing service when component mounts
    const initService = async () => {
      try {
        const success = await VoiceProcessingService.initialize(voiceConfig);
        if (success) {
          console.log('Voice processing service initialized');
        } else {
          Alert.alert('Error', 'Failed to initialize voice processing service');
        }
      } catch (error) {
        console.error('Error initializing voice processing service:', error);
        Alert.alert('Error', 'Failed to initialize voice processing service');
      }
    };

    initService();

    // Check connection status periodically
    const interval = setInterval(async () => {
      const isReady = VoiceProcessingService.isReady();
      setIsConnected(isReady);
      setConnectionStatus(isReady ? 'Connected' : 'Disconnected');
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Audio Recording Permission',
          message: 'This app needs permission to record audio for voice processing.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const connectToESP32 = async () => {
    setIsLoading(true);
    try {
      const connected = await VoiceProcessingService.connectToESP32();
      if (connected) {
        Alert.alert('Success', 'Connected to ESP32 device');
        setIsConnected(true);
        setConnectionStatus('Connected');
      } else {
        Alert.alert('Error', 'Failed to connect to ESP32 device');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
      }
    } catch (error) {
      console.error('Error connecting to ESP32:', error);
      Alert.alert('Error', 'Failed to connect to ESP32 device');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectFromESP32 = async () => {
    setIsLoading(true);
    try {
      await VoiceProcessingService.disconnectFromESP32();
      Alert.alert('Success', 'Disconnected from ESP32 device');
      setIsConnected(false);
      setConnectionStatus('Disconnected');
    } catch (error) {
      console.error('Error disconnecting from ESP32:', error);
      Alert.alert('Error', 'Failed to disconnect from ESP32 device');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Audio recording permission is required to use this feature.');
      return;
    }

    setIsRecording(true);
    setTranscript('');
    setResponse('');

    // In a real implementation, this would start actual audio recording
    // For demo purposes, we'll simulate the process
    console.log('Started recording...');

    // Simulate recording for 5 seconds
    setTimeout(async () => {
      stopRecording();
    }, 5000);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    
    // In a real implementation, this would stop audio recording and process the audio
    // For demo purposes, we'll simulate the processing
    console.log('Stopped recording, processing audio...');
    
    // Simulate audio processing
    setIsLoading(true);
    
    // Simulate the voice processing pipeline
    setTimeout(async () => {
      // Simulated transcription
      const simulatedTranscript = "Hello, can you help me with something?";
      setTranscript(simulatedTranscript);
      
      // Simulated response
      const simulatedResponse = "Sure, I'd be happy to help you. What do you need assistance with?";
      setResponse(simulatedResponse);
      
      setIsLoading(false);
      Alert.alert('Demo', 'This is a simulation of the voice processing pipeline. In the real implementation, this would process actual audio from the ESP32 device.');
    }, 2000);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <VStack space="lg">
          {/* Header */}
          <Heading size="lg" color="$textDark800" mb="$4">
            Voice Processing
          </Heading>

          {/* Connection Status Card */}
          <Card bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center">
                <Icon 
                  as={isConnected ? BluetoothConnected : Bluetooth} 
                  size="lg" 
                  color={isConnected ? "$success500" : "$error500"} 
                  mr="$2" 
                />
                <Text size="md" fontWeight="$medium" color="$textDark800">
                  ESP32 Connection
                </Text>
              </HStack>
              
              <Text 
                size="sm" 
                fontWeight="$medium" 
                color={isConnected ? "$success500" : "$error500"}
              >
                {connectionStatus}
              </Text>
            </HStack>
            
            <HStack mt="$3" space="md">
              {!isConnected ? (
                <Button 
                  flex={1} 
                  bg="$primary500" 
                  onPress={connectToESP32}
                  disabled={isLoading}
                >
                  <ButtonText color="$textLight500">Connect to ESP32</ButtonText>
                </Button>
              ) : (
                <Button 
                  flex={1} 
                  bg="$error500" 
                  onPress={disconnectFromESP32}
                  disabled={isLoading}
                >
                  <ButtonText color="$textLight500">Disconnect</ButtonText>
                </Button>
              )}
            </HStack>
          </Card>

          {/* Recording Controls */}
          <Card bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <Heading size="md" color="$textDark800" mb="$3">
              Voice Interaction
            </Heading>
            
            <HStack space="md" mb="$3">
              <Pressable
                flex={1}
                bg={isRecording ? '$error500' : '$primary500'}
                borderRadius="$lg"
                p="$4"
                alignItems="center"
                justifyContent="center"
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isLoading || !isConnected}
              >
                <HStack alignItems="center">
                  <Icon 
                    as={isRecording ? Square : Mic} 
                    size="lg" 
                    color="$textLight500" 
                    mr="$2" 
                  />
                  <Text size="md" fontWeight="$medium" color="$textLight500">
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Text>
                </HStack>
              </Pressable>
            </HStack>
            
            <Text size="sm" color="$textDark500">
              {isConnected 
                ? "Press the button to start voice interaction with your AI toy" 
                : "Connect to ESP32 to enable voice interaction"}
            </Text>
          </Card>

          {/* Transcript Display */}
          {transcript ? (
            <Card bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
              <Heading size="md" color="$textDark800" mb="$2">
                Transcription
              </Heading>
              <Text size="sm" color="$textDark800" lineHeight="$md">
                {transcript}
              </Text>
            </Card>
          ) : null}

          {/* Response Display */}
          {response ? (
            <Card bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
              <Heading size="md" color="$textDark800" mb="$2">
                AI Response
              </Heading>
              <Text size="sm" color="$textDark800" lineHeight="$md">
                {response}
              </Text>
            </Card>
          ) : null}

          {/* Info Card */}
          <Card bg="$backgroundLight0" borderRadius="$lg" p="$4">
            <Heading size="md" color="$textDark800" mb="$2">
              How It Works
            </Heading>
            <Text size="sm" color="$textDark800" mb="$2">
              1. ESP32 captures audio via microphone
            </Text>
            <Text size="sm" color="$textDark800" mb="$2">
              2. Audio transmitted to mobile app via BLE
            </Text>
            <Text size="sm" color="$textDark800" mb="$2">
              3. Whisper.cpp processes audio locally (fallback to Google STT)
            </Text>
            <Text size="sm" color="$textDark800" mb="$2">
              4. Transcribed text sent to LLM for response
            </Text>
            <Text size="sm" color="$textDark800">
              5. LLM response converted to speech via TTS and sent back to ESP32
            </Text>
          </Card>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VoiceProcessingScreen;