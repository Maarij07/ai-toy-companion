import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Animated,
  StatusBar,
  ActivityIndicator,
  Modal,
  View,
  TouchableOpacity,
} from 'react-native';
import ESP32Service from '../services/ESP32Service';
import VoiceProcessingService, { PipelineStatus } from '../services/VoiceProcessingService';
import voiceConfig from '../config/voiceConfig';
import ChatService, { ChatMessage } from '../services/ChatService';
import { ToyService } from '../services/ToyService';
import { AuthService } from '../services/AuthService';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Image,
  Heading,
  Icon,
  Card,
  Avatar,
  Pressable
} from '@gluestack-ui/themed';
import {
  User,
  Bell,
  Power,
  Settings,
  MessageSquare,
  Shield,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MessageCircle,
  Home,
  Store,
  ShoppingCart,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react-native';

// Import other screens for tab navigation
import MarketplaceScreen from './MarketplaceScreen';
import CartScreen from './CartScreen';
import SettingsScreen from './SettingsScreen';
import ProductDetailScreen from './ProductDetailScreen';
import ChatScreen from './ChatScreen';

interface NewHomeContentProps {
  onNavigateToHome?: () => void;
  onNavigateToAddToy?: () => void; // Function to navigate to add new toy flow
  toyDetailVisible: boolean;
  setToyDetailVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedToy: any;
  setSelectedToy: React.Dispatch<React.SetStateAction<any>>;
}

const NewHomeContent = ({
  onNavigateToHome,
  onNavigateToAddToy,
  toyDetailVisible,
  setToyDetailVisible,
  selectedToy,
  setSelectedToy
}: NewHomeContentProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [toys, setToys] = useState<any[]>([]);
  const [isLoadingToys, setIsLoadingToys] = useState(true);

  // BLE pipeline state
  type BLEStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'error';
  const [bleStatus, setBleStatus] = useState<BLEStatus>('idle');
  const [bleStatusLabel, setBleStatusLabel] = useState('');
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [connectedToyId, setConnectedToyId] = useState<string | null>(null);
  const bleStartedRef = useRef(false);
  const lastToyRef = useRef<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    loadToys();
  }, []);

  // ── Load last 5 messages for the connected toy ──────────────────────────
  const loadRecentMessages = async (toyId: string) => {
    const result = await ChatService.getMessages(toyId);
    if (result.success && result.data) {
      setRecentMessages(result.data.slice(-5));
    }
  };

  // ── Start the BLE → STT → LLM → DB → TTS → BLE pipeline ───────────────
  const handleReconnect = async () => {
    const toy = lastToyRef.current;
    if (!toy) return;
    setBleStatus('connecting');
    setBleStatusLabel('Reconnecting...');
    const connected = await VoiceProcessingService.reconnectToESP32();
    if (!connected) {
      setBleStatus('error');
      setBleStatusLabel('Could not reconnect');
      setTimeout(() => { setBleStatus('idle'); setBleStatusLabel(''); }, 4000);
      return;
    }
    setConnectedToyId(toy.id);
    setBleStatus('listening');
    setBleStatusLabel('Listening...');
    // Re-subscribe and restart pipeline with same toy
    await VoiceProcessingService.startListeningToToy(
      (_success, error) => {
        if (error && error !== 'empty_recording') {
          setBleStatus('error');
          setBleStatusLabel(error);
          setTimeout(() => { setBleStatus('listening'); setBleStatusLabel('Listening...'); }, 4000);
        } else {
          setBleStatus('listening');
          setBleStatusLabel('Listening...');
        }
        if (!error || error !== 'empty_recording') loadRecentMessages(toy.id);
      },
      toy.custom_personality ||
        `You are ${toy.name}, a friendly AI toy companion for children. Respond warmly, keep answers short and fun.`,
      (status: PipelineStatus) => {
        const statusMap: Record<PipelineStatus, string> = {
          transcribing: 'Understanding speech...',
          thinking:     'Thinking of a response...',
          saving:       'Saving conversation...',
          sending:      'Sending response to toy...',
          idle:         'Listening...',
        };
        setBleStatus(status === 'idle' ? 'listening' : 'processing');
        setBleStatusLabel(statusMap[status]);
      }
    );
  };

  const startBLEPipeline = async (toy: any) => {
    lastToyRef.current = toy;
    setBleStatus('connecting');
    setBleStatusLabel('Connecting to toy...');

    // If already connected to a different toy, disconnect first
    if (ESP32Service.isConnected() && connectedToyId && connectedToyId !== toy.id) {
      await VoiceProcessingService.disconnectFromESP32();
      setConnectedToyId(null);
    }

    // Initialise AI services and bind the toyId for chat logging
    await VoiceProcessingService.initialize({
      toyId: toy.id,
      geminiApiKey: voiceConfig.geminiApiKey,
      useGeminiLive: voiceConfig.useGeminiLive,
    });

    // Physically connect via BLE if not already connected
    if (!ESP32Service.isConnected()) {
      const connected = await VoiceProcessingService.connectToESP32();
      if (!connected) {
        setBleStatus('error');
        setBleStatusLabel('Could not connect to toy via Bluetooth');
        bleStartedRef.current = false;
        return;
      }
    }

    setConnectedToyId(toy.id);
    setBleStatus('listening');
    setBleStatusLabel('Listening...');
    loadRecentMessages(toy.id);

    // Reset pipeline state when BLE connection drops (device off or manual disconnect)
    // lastToyRef is intentionally kept so the Reconnect button can appear
    ESP32Service.setDisconnectHandler(() => {
      setBleStatus('idle');
      setBleStatusLabel('');
      setConnectedToyId(null);
      bleStartedRef.current = false;
    });

    // Register the auto-receive handler — fires for every recording pushed by ESP32
    await VoiceProcessingService.startListeningToToy(
      (_success, error) => {
        if (error && error !== 'empty_recording') {
          console.error('Pipeline error:', error);
          // Show error briefly, then return to listening
          setBleStatus('error');
          setBleStatusLabel(error);
          setTimeout(() => {
            setBleStatus('listening');
            setBleStatusLabel('Listening...');
          }, 4000);
        } else {
          setBleStatus('listening');
          setBleStatusLabel('Listening...');
        }
        if (!error || error !== 'empty_recording') {
          loadRecentMessages(toy.id);
        }
      },
      toy.custom_personality ||
        `You are ${toy.name}, a friendly AI toy companion for children. Respond warmly, keep answers short and fun.`,
      (status: PipelineStatus) => {
        // Show real-time progress while a recording is being processed
        const statusMap: Record<PipelineStatus, string> = {
          transcribing: 'Understanding speech...',
          thinking:     'Thinking of a response...',
          saving:       'Saving conversation...',
          sending:      'Sending response to toy...',
          idle:         'Listening...',
        };
        if (status === 'idle') {
          setBleStatus('listening');
        } else {
          setBleStatus('processing');
        }
        setBleStatusLabel(statusMap[status]);
      }
    );
  };

  const loadToys = async () => {
    try {
      setIsLoadingToys(true);
      const { data: sessionData } = await AuthService.getSession();
      if (!sessionData?.session?.user?.id) return;
      const { data: toysData } = await ToyService.getUserToys(sessionData.session.user.id);
      if (toysData) {
        setToys(toysData);
        // Auto-start BLE pipeline for the first connected toy (once per mount)
        const connectedToy = (toysData as any[]).find(t => t.connected);
        if (connectedToy && !bleStartedRef.current) {
          bleStartedRef.current = true;
          startBLEPipeline(connectedToy);
        }
      }
    } catch (e) {
      // silently fail, toys stays []
    } finally {
      setIsLoadingToys(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadToys().finally(() => setRefreshing(false));
  };

  const parentalControls = [
    { id: 'safetyMode', label: 'Safety Mode', enabled: true },
    { id: 'screenTime', label: 'Screen Time', enabled: true },
    { id: 'contentFilter', label: 'Content Filter', enabled: true },
  ];

  const [parentalControlStates, setParentalControlStates] = useState(
    parentalControls.reduce((acc, control) => {
      acc[control.id] = control.enabled;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleParentalControl = (id: string) => {
    setParentalControlStates(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Greeting */}
          <VStack mb="$6">
            <Text size="2xl" fontWeight="$bold" color="$textDark800">Good morning, Sarah!</Text>
            <Text size="sm" color="$textDark500">Welcome back</Text>
          </VStack>

          {/* Toys */}
          {isLoadingToys ? (
            <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4" alignItems="center">
              <ActivityIndicator size="small" color="#6D8B74" />
            </Box>
          ) : toys.length === 0 ? (
            <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
              <HStack alignItems="center">
                <Box bg="$backgroundLight100" borderRadius="$full" p="$3" mr="$3">
                  <Icon as={Power} size="md" color="$textDark400" />
                </Box>
                <VStack>
                  <Text size="sm" fontWeight="$semibold" color="$textDark800">No toy connected</Text>
                  <Text size="xs" color="$textDark500">Add a toy to get started</Text>
                </VStack>
              </HStack>
            </Box>
          ) : (
            toys.map((toy: any) => (
              <Pressable
                key={toy.id}
                bg="$backgroundLight0"
                borderRadius="$lg"
                p="$4"
                mb="$4"
                onPress={() => {
                  setSelectedToy(toy);
                  setToyDetailVisible(true);
                }}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <HStack alignItems="center">
                    <Avatar size="md" bg="$primary500" mr="$3">
                      <Text color="$textLight50" fontWeight="$bold">
                        {toy.name?.charAt(0).toUpperCase() || 'T'}
                      </Text>
                    </Avatar>
                    <VStack>
                      <Text size="lg" fontWeight="$bold" color="$textDark800">{toy.name}</Text>
                      <HStack alignItems="center">
                        <Box w="$2" h="$2" bg={toy.connected ? "$success500" : "$warning500"} borderRadius="$full" mr="$2" />
                        <Text size="sm" color="$textDark800">{toy.connected ? 'Connected' : 'Disconnected'}</Text>
                        {toy.id === connectedToyId && bleStatus === 'listening' && (
                          <Text size="xs" color="$success600" ml="$2">· Listening</Text>
                        )}
                        {toy.id === connectedToyId && bleStatus === 'processing' && (
                          <Text size="xs" color="$warning600" ml="$2">· {bleStatusLabel}</Text>
                        )}
                        {toy.id === connectedToyId && bleStatus === 'connecting' && (
                          <Text size="xs" color="$textDark400" ml="$2">· Connecting...</Text>
                        )}
                        {toy.id === connectedToyId && bleStatus === 'error' && (
                          <Text size="xs" color="$error600" ml="$2">· {bleStatusLabel}</Text>
                        )}
                      </HStack>
                    </VStack>
                  </HStack>
                  {toy.id === connectedToyId && bleStatus !== 'idle' ? (
                    // Active toy — no button, status shown inline
                    <Icon as={ChevronRight} size="md" color="$textDark500" />
                  ) : toy.id === lastToyRef.current?.id && bleStatus === 'idle' ? (
                    // Last toy lost connection — show Reconnect
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); handleReconnect(); }}
                      bg="$primary500"
                      borderRadius="$md"
                      px="$3"
                      py="$1"
                    >
                      <Text size="xs" color="$white" fontWeight="$semibold">Reconnect</Text>
                    </Pressable>
                  ) : toy.id !== connectedToyId ? (
                    // Different toy — allow connecting to it
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); startBLEPipeline(toy); }}
                      bg="$backgroundLight100"
                      borderRadius="$md"
                      px="$3"
                      py="$1"
                      borderWidth={1}
                      borderColor="$primary500"
                    >
                      <Text size="xs" color="$primary500" fontWeight="$semibold">Connect</Text>
                    </Pressable>
                  ) : (
                    <Icon as={ChevronRight} size="md" color="$textDark500" />
                  )}
                </HStack>
              </Pressable>
            ))
          )}

          {/* Add New Toy */}
          <Pressable 
            bg="$backgroundLight0" 
            borderRadius="$lg" 
            p="$4" 
            mb="$4"
            borderWidth={1.5}
            borderColor="$primary500"
            borderStyle="dashed"
            alignItems="center"
            flexDirection="row"
            justifyContent="center"
            onPress={() => {
              // Navigate to the toy setup flow
              if (onNavigateToAddToy) {
                onNavigateToAddToy();
              }
            }}
          >
            <Icon as={PlusCircle} size="md" color="$primary500" mr="$2" />
            <Text size="sm" fontWeight="$medium" color="$primary500">Add New Toy</Text>
          </Pressable>

          {/* Parental Controls */}
          <VStack mb="$4">
            <Heading size="sm" mb="$3" color="$textDark800">Parental Controls</Heading>
            <Card bg="$backgroundLight0" borderRadius="$lg" p="$3">
              {parentalControls.map((control, index) => (
                <VStack 
                  key={control.id} 
                  py="$3" 
                  borderBottomWidth={index !== parentalControls.length - 1 ? 0.5 : 0} 
                  borderBottomColor="$borderLight300"
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack alignItems="center">
                      <Box mr="$3">
                        <Icon as={Shield} size="sm" color="$textDark800" />
                      </Box>
                      <Text size="sm" color="$textDark800">{control.label}</Text>
                    </HStack>
                    <Pressable
                      onPress={() => toggleParentalControl(control.id)}
                      bg={parentalControlStates[control.id] ? "$primary500" : "$borderLight400"}
                      borderRadius="$full"
                      w="$10" 
                      h="$5"
                      justifyContent="center"
                      alignItems="flex-start"
                      px="$1"
                    >
                      <Box 
                        bg="$white" 
                        borderRadius="$full" 
                        w="$4" 
                        h="$4" 
                        position="absolute"
                        style={{ transform: [{ translateX: parentalControlStates[control.id] ? 20 : 0 }] }}
                      />
                    </Pressable>
                  </HStack>
                </VStack>
              ))}
            </Card>
          </VStack>

          {/* Recent Activity */}
          <VStack>
            <HStack justifyContent="space-between" alignItems="center" mb="$3">
              <Heading size="sm" color="$textDark800">Recent Activity</Heading>
              {bleStatus === 'error' && (
                <Text size="xs" color="$error600">{bleStatusLabel}</Text>
              )}
            </HStack>

            {/* BLE status banner */}
            {connectedToyId && bleStatus !== 'idle' && bleStatus !== 'error' && (
              <HStack
                bg="$backgroundLight0"
                borderRadius="$lg"
                p="$3"
                mb="$3"
                alignItems="center"
                space="sm"
              >
                <Box
                  w={8}
                  h={8}
                  borderRadius="$full"
                  bg={
                    bleStatus === 'listening'
                      ? '$success500'
                      : bleStatus === 'processing'
                      ? '$warning500'
                      : '$textDark300'
                  }
                />
                <Icon
                  as={bleStatus === 'listening' ? Wifi : WifiOff}
                  size="sm"
                  color={bleStatus === 'listening' ? '$success600' : '$warning600'}
                />
                <Text size="sm" color="$textDark700">{bleStatusLabel}</Text>
              </HStack>
            )}

            {/* Last messages from the toy */}
            {recentMessages.length > 0 ? (
              recentMessages.map(msg => (
                <Box
                  key={msg.id}
                  bg="$backgroundLight0"
                  borderRadius="$lg"
                  p="$3"
                  mb="$2"
                >
                  <HStack justifyContent="space-between" mb="$1">
                    <Text
                      size="xs"
                      fontWeight="$bold"
                      color={msg.message_type === 'user' ? '$primary500' : '$textDark500'}
                    >
                      {msg.message_type === 'user' ? 'Child' : 'Buddy'}
                    </Text>
                    <Text size="xs" color="$textDark400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </HStack>
                  <Text size="sm" color="$textDark700" numberOfLines={2}>
                    {msg.content}
                  </Text>
                </Box>
              ))
            ) : (
              <Box bg="$backgroundLight0" borderRadius="$lg" p="$5" alignItems="center">
                <Icon as={MessageSquare} size="lg" color="$textDark400" mb="$2" />
                <Text size="sm" color="$textDark500" textAlign="center">
                  {connectedToyId
                    ? 'No conversations yet — the toy is listening'
                    : 'Connect a toy to see recent activity'}
                </Text>
              </Box>
            )}
          </VStack>
        </Animated.View>
      </ScrollView>
    </>
  );
};

const ToyDetailScreen = ({ toy, onGoBack }: { toy: any; onGoBack: () => void }) => {
  const [selectedMode, setSelectedMode] = useState('Chat');
  const [safetyMode, setSafetyMode] = useState(true);
  const [contentFilter, setContentFilter] = useState(true);
  const [isConnected, setIsConnected] = useState<boolean>(!!toy?.connected);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forgetDialogVisible, setForgetDialogVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);

  const owners: any[] = toy?.toy_owners || [];
  const interests: string[] = (toy?.toy_interests || []).map((i: any) => i.interest || i);

  const modes = [
    { id: 'Chat',   emoji: '💬', label: 'Chat' },
    { id: 'Story',  emoji: '📖', label: 'Story' },
    { id: 'Tutor',  emoji: '📚', label: 'Tutor' },
    { id: 'Rap',    emoji: '🎤', label: 'Rap' },
    { id: 'Debate', emoji: '🤔', label: 'Debate' },
  ];

  const interestColors: Record<string, string> = {
    'Creative Arts':     '#FCE7F3',
    'Science & Tech':    '#DBEAFE',
    'Sports & Games':    '#DCFCE7',
    'Music & Dance':     '#FEF3C7',
    'Reading & Stories': '#EDE9FE',
    'Animals & Nature':  '#D1FAE5',
    'Cooking & Food':    '#FEF9C3',
    'Building & Making': '#FFE4E6',
  };

  const cardShadow = {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  } as const;

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await VoiceProcessingService.disconnectFromESP32();
      await ToyService.updateToy(toy.id, { connected: false });
      setIsConnected(false);
    } catch (e) {
      console.error('Disconnect error:', e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnectDevice = async () => {
    setIsReconnecting(true);
    try {
      const connected = await VoiceProcessingService.reconnectToESP32();
      if (connected) {
        await ToyService.updateToy(toy.id, { connected: true });
        setIsConnected(true);
      }
      // If not connected, device is simply off/out of range — no crash, just stays disconnected
    } catch {
      // Scan timeout or BLE error — toy is not nearby or not powered on, ignore silently
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleForgetDevice = () => {
    setForgetDialogVisible(true);
  };

  const confirmForgetDevice = async () => {
    setForgetDialogVisible(false);
    setIsDeleting(true);
    try {
      await VoiceProcessingService.disconnectFromESP32();
      await ToyService.deleteToy(toy.id);
      onGoBack();
    } catch (e) {
      console.error('Delete toy error:', e);
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F4E9' }}>
      {/* Header */}
      <HStack
        justifyContent="space-between"
        alignItems="center"
        px="$4"
        py="$3"
        bg="$white"
        borderBottomWidth={0.5}
        borderBottomColor="$borderLight200"
      >
        <Pressable
          onPress={onGoBack}
          p="$2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon as={ChevronLeft} size="xl" color="$textDark800" />
        </Pressable>
        <Text size="lg" fontWeight="$bold" color="$textDark800">
          Toy Details
        </Text>
        {/* spacer keeps title centred */}
        <Box w="$10" />
      </HStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Hero card ─────────────────────────────── */}
        <Box
          mx="$4"
          mt="$4"
          mb="$4"
          borderRadius="$3xl"
          bg="#6D8B74"
          p="$6"
          alignItems="center"
          style={{
            elevation: 8,
            shadowColor: '#6D8B74',
            shadowOpacity: 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          {/* Avatar circle */}
          <Box
            w={88}
            h={88}
            borderRadius="$full"
            justifyContent="center"
            alignItems="center"
            mb="$3"
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.4)',
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFFFFF' }}>
              {toy?.name?.charAt(0).toUpperCase() || 'T'}
            </Text>
          </Box>

          <Text style={{ fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 }}>
            {toy?.name}
          </Text>

          {/* Connection badge */}
          <Box
            borderRadius="$full"
            px="$4"
            py="$1"
            style={{
              backgroundColor: isConnected
                ? 'rgba(16,185,129,0.3)'
                : 'rgba(0,0,0,0.15)',
              borderWidth: 1,
              borderColor: isConnected
                ? 'rgba(16,185,129,0.5)'
                : 'rgba(255,255,255,0.2)',
            }}
          >
            <HStack alignItems="center" space="xs">
              <Box
                borderRadius="$full"
                style={{
                  width: 7,
                  height: 7,
                  backgroundColor: isConnected ? '#34D399' : '#9CA3AF',
                }}
              />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </HStack>
          </Box>
        </Box>

        {/* ── Quick stats ───────────────────────────── */}
        <HStack mx="$4" mb="$4" space="sm">
          {[
            { label: 'Owners',    value: owners.length },
            { label: 'Interests', value: interests.length },
            { label: 'Sessions',  value: 0 },
          ].map((stat) => (
            <Box
              key={stat.label}
              flex={1}
              bg="$white"
              borderRadius="$xl"
              p="$3"
              alignItems="center"
              style={cardShadow}
            >
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#6D8B74' }}>
                {stat.value}
              </Text>
              <Text size="xs" color="$textDark500" mt="$0.5">
                {stat.label}
              </Text>
            </Box>
          ))}
        </HStack>

        {/* ── Talk Mode ─────────────────────────────── */}
        <Box mx="$4" mb="$4" bg="$white" borderRadius="$xl" p="$4" style={cardShadow}>
          <Text fontWeight="$bold" color="$textDark800" size="sm" mb="$3">
            Talk Mode
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="sm">
              {modes.map((mode) => {
                const active = selectedMode === mode.id;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => setSelectedMode(mode.id)}
                    borderRadius="$xl"
                    px="$4"
                    py="$3"
                    alignItems="center"
                    style={{
                      minWidth: 72,
                      backgroundColor: active ? '#6D8B74' : '#F9FAFB',
                      borderWidth: 1,
                      borderColor: active ? '#6D8B74' : '#E5E7EB',
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{mode.emoji}</Text>
                    <Text
                      size="xs"
                      style={{ fontWeight: '600', color: active ? '#FFFFFF' : '#374151' }}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </ScrollView>
        </Box>

        {/* ── Chat History Button ───────────────────── */}
        <Box mx="$4" mb="$4">
          <Pressable
            onPress={() => setChatVisible(true)}
            borderRadius="$xl"
            px="$4"
            py="$4"
            bg="#6D8B74"
            alignItems="center"
            style={{
              elevation: 4,
              shadowColor: '#6D8B74',
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}>
            <Text style={{ fontSize: 18, marginBottom: 6 }}>💬</Text>
            <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 15 }}>
              View Chat History
            </Text>
            <Text style={{ fontWeight: '500', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
              See all conversations
            </Text>
          </Pressable>
        </Box>

        {/* ── Owners ────────────────────────────────── */}
        {owners.length > 0 && (
          <Box mx="$4" mb="$4" bg="$white" borderRadius="$xl" p="$4" style={cardShadow}>
            <Text fontWeight="$bold" color="$textDark800" size="sm" mb="$3">
              Owners
            </Text>
            <VStack space="sm">
              {owners.map((owner: any, i: number) => (
                <HStack
                  key={i}
                  alignItems="center"
                  borderRadius="$lg"
                  p="$3"
                  style={{ backgroundColor: '#F8F4E9' }}
                >
                  <Box
                    borderRadius="$full"
                    justifyContent="center"
                    alignItems="center"
                    mr="$3"
                    style={{ width: 36, height: 36, backgroundColor: '#6D8B74' }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                      {owner.name?.charAt(0).toUpperCase()}
                    </Text>
                  </Box>
                  <VStack flex={1}>
                    <Text size="sm" fontWeight="$semibold" color="$textDark800">
                      {owner.name}
                    </Text>
                    <Text size="xs" color="$textDark500">
                      Age {owner.age}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}

        {/* ── Interests ─────────────────────────────── */}
        {interests.length > 0 && (
          <Box mx="$4" mb="$4" bg="$white" borderRadius="$xl" p="$4" style={cardShadow}>
            <Text fontWeight="$bold" color="$textDark800" size="sm" mb="$3">
              Interests
            </Text>
            <HStack flexWrap="wrap">
              {interests.map((interest, i) => (
                <Box
                  key={i}
                  borderRadius="$full"
                  px="$3"
                  py="$1.5"
                  mr="$2"
                  mb="$2"
                  style={{ backgroundColor: interestColors[interest] || '#E5E7EB' }}
                >
                  <Text size="xs" style={{ fontWeight: '600', color: '#374151' }}>
                    {interest}
                  </Text>
                </Box>
              ))}
            </HStack>
          </Box>
        )}

        {/* ── Personality ───────────────────────────── */}
        {!!toy?.custom_personality && (
          <Box mx="$4" mb="$4" bg="$white" borderRadius="$xl" p="$4" style={cardShadow}>
            <Text fontWeight="$bold" color="$textDark800" size="sm" mb="$3">
              Personality
            </Text>
            <Box
              borderRadius="$lg"
              p="$3"
              style={{
                backgroundColor: '#F8F4E9',
                borderLeftWidth: 3,
                borderLeftColor: '#6D8B74',
              }}
            >
              <Text size="sm" color="$textDark600" style={{ lineHeight: 20 }}>
                {toy.custom_personality}
              </Text>
            </Box>
          </Box>
        )}

        {/* ── Parental Controls ─────────────────────── */}
        <Box mx="$4" mb="$4" bg="$white" borderRadius="$xl" p="$4" style={cardShadow}>
          <Text fontWeight="$bold" color="$textDark800" size="sm" mb="$3">
            Parental Controls
          </Text>
          {[
            {
              label: 'Safety Mode',
              sub: 'Filters inappropriate content',
              value: safetyMode,
              toggle: () => setSafetyMode((p) => !p),
            },
            {
              label: 'Content Filter',
              sub: 'Age-appropriate responses only',
              value: contentFilter,
              toggle: () => setContentFilter((p) => !p),
            },
          ].map((ctrl, i, arr) => (
            <HStack
              key={ctrl.label}
              justifyContent="space-between"
              alignItems="center"
              py="$3"
              borderBottomWidth={i < arr.length - 1 ? 0.5 : 0}
              borderBottomColor="$borderLight200"
            >
              <VStack flex={1} mr="$4">
                <Text size="sm" fontWeight="$medium" color="$textDark800">
                  {ctrl.label}
                </Text>
                <Text size="xs" color="$textDark500">
                  {ctrl.sub}
                </Text>
              </VStack>
              <Pressable
                onPress={ctrl.toggle}
                borderRadius="$full"
                style={{
                  width: 44,
                  height: 24,
                  backgroundColor: ctrl.value ? '#6D8B74' : '#D1D5DB',
                  justifyContent: 'center',
                }}
              >
                <Box
                  bg="$white"
                  borderRadius="$full"
                  position="absolute"
                  style={{
                    width: 20,
                    height: 20,
                    transform: [{ translateX: ctrl.value ? 22 : 2 }],
                  }}
                />
              </Pressable>
            </HStack>
          ))}
        </Box>

        {/* ── Device Actions ────────────────────────── */}
        <VStack mx="$4" mb="$4" space="sm">
          {/* Disconnect */}
          {isConnected && (
            <Pressable
              onPress={handleDisconnect}
              disabled={isDisconnecting}
              borderRadius="$xl"
              p="$4"
              bg="$white"
              style={{
                ...cardShadow,
                opacity: isDisconnecting ? 0.6 : 1,
                borderWidth: 1.5,
                borderColor: '#6D8B74',
              }}
            >
              <HStack alignItems="center" justifyContent="center" space="sm">
                {isDisconnecting ? (
                  <ActivityIndicator size="small" color="#6D8B74" />
                ) : (
                  <Icon as={WifiOff} size="sm" color="#6D8B74" />
                )}
                <Text style={{ fontWeight: '600', color: '#6D8B74', fontSize: 15 }}>
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Text>
              </HStack>
            </Pressable>
          )}

          {/* Reconnect */}
          {!isConnected && (
            <Pressable
              onPress={handleReconnectDevice}
              disabled={isReconnecting}
              borderRadius="$xl"
              p="$4"
              bg="$white"
              style={{
                ...cardShadow,
                opacity: isReconnecting ? 0.6 : 1,
                borderWidth: 1.5,
                borderColor: '#6D8B74',
              }}
            >
              <HStack alignItems="center" justifyContent="center" space="sm">
                {isReconnecting ? (
                  <ActivityIndicator size="small" color="#6D8B74" />
                ) : (
                  <Icon as={Wifi} size="sm" color="#6D8B74" />
                )}
                <Text style={{ fontWeight: '600', color: '#6D8B74', fontSize: 15 }}>
                  {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
                </Text>
              </HStack>
            </Pressable>
          )}

          {/* Forget Device */}
          <Pressable
            onPress={handleForgetDevice}
            disabled={isDeleting}
            borderRadius="$xl"
            p="$4"
            style={{
              ...cardShadow,
              opacity: isDeleting ? 0.6 : 1,
              backgroundColor: '#FFF1F2',
              borderWidth: 1.5,
              borderColor: '#FDA4AF',
            }}
          >
            <HStack alignItems="center" justifyContent="center" space="sm">
              {isDeleting ? (
                <ActivityIndicator size="small" color="#E11D48" />
              ) : (
                <Icon as={Trash2} size="sm" color="#E11D48" />
              )}
              <Text style={{ fontWeight: '600', color: '#E11D48', fontSize: 15 }}>
                {isDeleting ? 'Removing...' : 'Forget Device'}
              </Text>
            </HStack>
          </Pressable>
        </VStack>
      </ScrollView>

      {/* ── Forget Device Dialog ──────────────────── */}
      <Modal
        visible={forgetDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgetDialogVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 28,
              width: '100%',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
              elevation: 16,
            }}
          >
            {/* Icon */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#FFF1F2',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
                borderWidth: 6,
                borderColor: '#FFE4E6',
              }}
            >
              <Icon as={Trash2} size="lg" color="#E11D48" />
            </View>

            {/* Title */}
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#111827',
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              Forget Device
            </Text>

            {/* Body */}
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 28,
              }}
            >
              Are you sure you want to remove{' '}
              <Text style={{ fontWeight: '700', color: '#111827' }}>
                {toy?.name}
              </Text>
              {' '}from your account?{'\n'}This action cannot be undone.
            </Text>

            {/* Buttons */}
            <HStack space="sm" w="$full">
              {/* Cancel */}
              <Pressable
                flex={1}
                onPress={() => setForgetDialogVisible(false)}
                borderRadius="$xl"
                py="$3"
                style={{
                  backgroundColor: '#F8F4E9',
                  borderWidth: 1.5,
                  borderColor: '#D1D5DB',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#374151', fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>

              {/* Remove */}
              <Pressable
                flex={1}
                onPress={confirmForgetDevice}
                borderRadius="$xl"
                py="$3"
                style={{
                  backgroundColor: '#E11D48',
                  alignItems: 'center',
                  shadowColor: '#E11D48',
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 15 }}>
                  Remove
                </Text>
              </Pressable>
            </HStack>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}>
        <ChatScreen
          toyId={toy.id}
          toyName={toy.name}
          onClose={() => setChatVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
};

const HomeScreen = ({ onNavigateToHome, onNavigateToAddToy }: { onNavigateToHome?: () => void; onNavigateToAddToy?: () => void; }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [isNotificationDrawerVisible, setNotificationDrawerVisible] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [toyDetailVisible, setToyDetailVisible] = useState(false);
  const [selectedToy, setSelectedToy] = useState<any>(null);
  
  const renderTabContent = () => {
    if (detailProduct) {
      return (
        <ProductDetailScreen 
          route={{ params: { product: detailProduct } }}
          navigation={{ goBack: () => setDetailProduct(null) }}
        />
      );
    }
    
    if (toyDetailVisible && selectedToy) {
      return <ToyDetailScreen toy={selectedToy} onGoBack={() => setToyDetailVisible(false)} />;
    }
    
    switch (activeTab) {
      case 'Marketplace':
        return <MarketplaceScreen onNavigateToProductDetail={setDetailProduct} />;
      case 'Cart':
        return <CartScreen />;
      case 'Settings':
        return <SettingsScreen />;
      default:
        return (
          <>
            <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
              <Pressable p="$2">
                <Icon as={User} size="xl" color="$textDark800" />
              </Pressable>
              
              <Heading size="md" color="$textDark800">Home</Heading>
              
              <Pressable p="$2" onPress={() => setNotificationDrawerVisible(true)}>
                <Icon as={Bell} size="lg" color="$textDark800" />
              </Pressable>
              
              {/* Notification Drawer */}
              {isNotificationDrawerVisible && (
                <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="rgba(0,0,0,0.5)" zIndex={999} justifyContent="flex-end">
                  <Pressable flex={1} onPress={() => setNotificationDrawerVisible(false)} />
                  <Box bg="$backgroundLight0" p="$4" borderTopLeftRadius="$lg" borderTopRightRadius="$lg">
                    <HStack justifyContent="space-between" alignItems="center" mb="$4">
                      <Heading size="md" color="$textDark800">Notifications</Heading>
                      <Pressable onPress={() => setNotificationDrawerVisible(false)}>
                        <Icon as={ChevronRight} size="lg" color="$textDark800" style={{ transform: [{ rotate: '180deg' }] }} />
                      </Pressable>
                    </HStack>
                    
                    <VStack space="md">
                      <Pressable bg="$backgroundLight50" p="$3" borderRadius="$md" onPress={() => setNotificationDrawerVisible(false)}>
                        <HStack alignItems="center">
                          <Box bg="$primary200" borderRadius="$full" w="$10" h="$10" justifyContent="center" alignItems="center" mr="$3">
                            <Icon as={MessageCircle} size="sm" color="$primary500" />
                          </Box>
                          <VStack flex={1}>
                            <Text size="sm" fontWeight="$medium" color="$textDark800">New toy connection</Text>
                            <Text size="xs" color="$textDark500">Buddy the Bear connected successfully</Text>
                          </VStack>
                          <Text size="xs" color="$textDark500">2 min ago</Text>
                        </HStack>
                      </Pressable>
                      
                      <Pressable bg="$backgroundLight50" p="$3" borderRadius="$md" onPress={() => setNotificationDrawerVisible(false)}>
                        <HStack alignItems="center">
                          <Box bg="$success200" borderRadius="$full" w="$10" h="$10" justifyContent="center" alignItems="center" mr="$3">
                            <Icon as={Calendar} size="sm" color="$success500" />
                          </Box>
                          <VStack flex={1}>
                            <Text size="sm" fontWeight="$medium" color="$textDark800">Daily reminder</Text>
                            <Text size="xs" color="$textDark500">Time for your child's play session</Text>
                          </VStack>
                          <Text size="xs" color="$textDark500">1 hour ago</Text>
                        </HStack>
                      </Pressable>
                      
                      <Pressable bg="$backgroundLight50" p="$3" borderRadius="$md" onPress={() => setNotificationDrawerVisible(false)}>
                        <HStack alignItems="center">
                          <Box bg="$warning200" borderRadius="$full" w="$10" h="$10" justifyContent="center" alignItems="center" mr="$3">
                            <Icon as={Shield} size="sm" color="$warning500" />
                          </Box>
                          <VStack flex={1}>
                            <Text size="sm" fontWeight="$medium" color="$textDark800">Safety alert</Text>
                            <Text size="xs" color="$textDark500">Check your child's toy settings</Text>
                          </VStack>
                          <Text size="xs" color="$textDark500">3 hours ago</Text>
                        </HStack>
                      </Pressable>
                    </VStack>
                  </Box>
                </Box>
              )}
            </HStack>
            
            <NewHomeContent 
              onNavigateToHome={onNavigateToHome}
              onNavigateToAddToy={onNavigateToAddToy}
              toyDetailVisible={toyDetailVisible}
              setToyDetailVisible={setToyDetailVisible}
              selectedToy={selectedToy}
              setSelectedToy={setSelectedToy}
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {renderTabContent()}
      
      {/* Tab Bar - Only show when not viewing product detail */}
      {detailProduct || toyDetailVisible ? null : (
        <HStack justifyContent="space-around" alignItems="center" p="$3" bg="$backgroundLight0" borderTopWidth={0.5} borderTopColor="$borderLight300" position="absolute" bottom={0} left={0} right={0}>
          {[
            { name: 'Home', icon: Home },
            { name: 'Marketplace', icon: Store },
            { name: 'Cart', icon: ShoppingCart },
            { name: 'Settings', icon: Settings }
          ].map((tab) => (
            <Pressable
              key={tab.name}
              p="$3"
              onPress={() => setActiveTab(tab.name)}
            >
              <VStack alignItems="center">
                <Icon
                  as={tab.icon}
                  size="md"
                  color={activeTab === tab.name ? "$primary500" : "$textDark500"}
                />
                <Text size="xs" mt="$1" color={activeTab === tab.name ? "$primary500" : "$textDark500"}>{tab.name}</Text>
              </VStack>
            </Pressable>
          ))}
        </HStack>
      )}

    </SafeAreaView>
  );
};

export default HomeScreen;