import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Box,
  Text,
  Button,
  ButtonText,
  VStack,
  HStack,
  Center,
  Icon,
  Pressable,
} from '@gluestack-ui/themed';
import { Bluetooth, Check, ToyBrick, X, RefreshCw } from 'lucide-react-native';
import BLEService from '../services/BLEService';

type BLEState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

interface OnboardingScreenProps {
  onNavigateToSetup?: () => void;
  onCancel?: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNavigateToSetup, onCancel }) => {
  const [bleState, setBleState] = useState<BLEState>('idle');
  const [devices, setDevices] = useState<Map<string, Device>>(new Map());
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  const bounceValue = useRef(new Animated.Value(0)).current;
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, { toValue: 1, duration: 1000, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(bounceValue, { toValue: 0, duration: 1000, easing: Easing.ease, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      BLEService.stopScan();
    };
  }, []);

  const bounceInterpolate = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {});
    } else {
      Linking.openURL('App-Prefs:Bluetooth').catch(() => {});
    }
  };

  const handleStartScan = async () => {
    // 1. Check if Bluetooth is powered on
    try {
      const btState = await BLEService.getManager().state();
      if (btState === 'PoweredOff') {
        Alert.alert(
          'Bluetooth is Off',
          'Please turn on Bluetooth to connect to your toy.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openBluetoothSettings },
          ]
        );
        return;
      }
    } catch (_) {
      // state() unavailable on some setups — proceed anyway
    }

    // 2. Check permissions
    const hasPermission = await BLEService.requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Bluetooth permission is needed to connect your toy. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setDevices(new Map());
    setBleState('scanning');

    BLEService.startScan(
      (device) => {
        if (device.name) {
          setDevices(prev => {
            const updated = new Map(prev);
            updated.set(device.id, device);
            return updated;
          });
        }
      },
      (error) => {
        // Scan error mid-flight (e.g. BT turned off while scanning)
        BLEService.stopScan();
        setBleState('idle');
        Alert.alert('Scan Error', 'Bluetooth scan failed. Make sure Bluetooth is on and try again.');
      }
    );

    // Auto-stop scan after 15 seconds
    scanTimeoutRef.current = setTimeout(() => {
      BLEService.stopScan();
    }, 15000);
  };

  const handleConnectDevice = async (device: Device) => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    BLEService.stopScan();
    setSelectedDevice(device);
    setBleState('connecting');

    const success = await BLEService.connectById(device.id);
    if (success) {
      setBleState('connected');
      setTimeout(() => {
        onNavigateToSetup?.();
      }, 1500);
    } else {
      setErrorMessage(`Could not connect to ${device.name || device.id}. Make sure the toy is on and nearby.`);
      setBleState('error');
    }
  };

  const handleStopScan = () => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    BLEService.stopScan();
    setBleState('idle');
  };

  const handleRetry = () => {
    setErrorMessage('');
    setSelectedDevice(null);
    setBleState('idle');
  };

  const deviceList = Array.from(devices.values());

  // ── Connected ──────────────────────────────────────────────────────────────
  if (bleState === 'connected') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Center flex={1} px="$6">
          <Box
            w={100} h={100} borderRadius="$full" bg="#10B981"
            justifyContent="center" alignItems="center" mb="$6"
            style={{ shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
          >
            <Icon as={Check} size="xl" color="$white" />
          </Box>
          <Text fontSize="$3xl" fontWeight="$bold" color="$textDark800" textAlign="center" mb="$3">
            Connected!
          </Text>
          <Text fontSize="$sm" color="$textDark500" textAlign="center">
            {selectedDevice?.name} is now ready to play!
          </Text>
        </Center>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (bleState === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Center flex={1} px="$6">
          <Box w={80} h={80} borderRadius="$full" bg="$error100" justifyContent="center" alignItems="center" mb="$6">
            <Icon as={X} size="xl" color="$error500" />
          </Box>
          <Text fontSize="$xl" fontWeight="$bold" color="$textDark800" textAlign="center" mb="$3">
            Connection Failed
          </Text>
          <Text fontSize="$sm" color="$textDark500" textAlign="center" mb="$8" lineHeight="$lg">
            {errorMessage}
          </Text>
          <Button
            bg="$primary500" py="$3" h="$12" borderRadius="$lg"
            onPress={handleRetry} alignItems="center" justifyContent="center"
            style={{ width: '100%' }}
          >
            <HStack alignItems="center" space="sm">
              <Icon as={RefreshCw} size="sm" color="$white" />
              <ButtonText color="$white" fontWeight="$semibold">Try Again</ButtonText>
            </HStack>
          </Button>
        </Center>
      </SafeAreaView>
    );
  }

  // ── Idle / Scanning / Connecting ───────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Animated.View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingBottom: 40,
          opacity: opacityValue,
          transform: [{ scale: scaleValue }],
        }}
      >
        {/* ── IDLE ── */}
        {bleState === 'idle' && (
          <VStack flex={1} justifyContent="center" alignItems="center" space="lg">
            <Animated.View
              style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: '#6D8B74',
                justifyContent: 'center', alignItems: 'center',
                marginBottom: 32,
                shadowColor: '#6D8B74',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
                transform: [{ scale: bounceInterpolate }],
              }}
            >
              <Icon as={ToyBrick} size="xl" color="$white" />
            </Animated.View>
            <Text fontSize="$3xl" fontWeight="$bold" color="$textDark800" textAlign="center">
              Connect Your Toy
            </Text>
            <Text fontSize="$lg" fontWeight="$medium" color="$primary500" textAlign="center">
              Ready to Connect
            </Text>
            <Text fontSize="$sm" color="$textDark500" textAlign="center" lineHeight="$lg">
              Make sure your AI Buddy is turned on and nearby, then tap Scan.
            </Text>
          </VStack>
        )}

        {/* ── SCANNING ── */}
        {bleState === 'scanning' && (
          <VStack flex={1} pt="$6">
            <HStack alignItems="center" justifyContent="space-between" mb="$4">
              <VStack>
                <Text fontSize="$xl" fontWeight="$bold" color="$textDark800">Scanning...</Text>
                <Text fontSize="$sm" color="$textDark500">Select your device below</Text>
              </VStack>
              <Pressable onPress={handleStopScan} p="$2">
                <Text fontSize="$sm" color="$primary500" fontWeight="$semibold">Stop</Text>
              </Pressable>
            </HStack>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {deviceList.length === 0 ? (
                <Box bg="$backgroundLight50" borderRadius="$xl" p="$8" alignItems="center" mt="$6">
                  <Icon as={Bluetooth} size="xl" color="$textDark300" mb="$3" />
                  <Text fontSize="$sm" color="$textDark500" textAlign="center">
                    Looking for nearby devices...
                  </Text>
                </Box>
              ) : (
                deviceList.map((device) => (
                  <Pressable
                    key={device.id}
                    bg="$backgroundLight0"
                    borderRadius="$lg"
                    p="$4"
                    mb="$3"
                    borderWidth={1}
                    borderColor="$borderLight200"
                    onPress={() => handleConnectDevice(device)}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack alignItems="center" space="md" flex={1}>
                        <Box bg="$primary100" borderRadius="$full" p="$2">
                          <Icon as={Bluetooth} size="sm" color="$primary500" />
                        </Box>
                        <VStack flex={1}>
                          <Text fontSize="$sm" fontWeight="$semibold" color="$textDark800">
                            {device.name}
                          </Text>
                          <Text fontSize="$xs" color="$textDark400" numberOfLines={1}>
                            {device.id}
                          </Text>
                        </VStack>
                      </HStack>
                      <Button size="sm" bg="$primary500" borderRadius="$md" px="$3" h="$8">
                        <ButtonText color="$white" fontSize="$xs" fontWeight="$semibold">Connect</ButtonText>
                      </Button>
                    </HStack>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </VStack>
        )}

        {/* ── CONNECTING ── */}
        {bleState === 'connecting' && (
          <VStack flex={1} justifyContent="center" alignItems="center" space="lg">
            <Box
              w={100} h={100} borderRadius="$full" bg="$primary100"
              justifyContent="center" alignItems="center" mb="$4"
            >
              <Icon as={Bluetooth} size="xl" color="$primary500" />
            </Box>
            <Text fontSize="$2xl" fontWeight="$bold" color="$textDark800" textAlign="center">
              Connecting...
            </Text>
            <Text fontSize="$sm" color="$textDark500" textAlign="center">
              Connecting to {selectedDevice?.name}
            </Text>
          </VStack>
        )}

        {/* ── Bottom buttons (idle only) ── */}
        {bleState === 'idle' && (
          <Box pb="$2">
            <Button
              variant="outline"
              borderColor="$borderLight300"
              py="$3" h="$12" borderRadius="$lg" mb="$3"
              onPress={onCancel} alignItems="center" justifyContent="center"
            >
              <ButtonText color="$textDark800" fontWeight="$medium">Cancel</ButtonText>
            </Button>
            <Button
              bg="$primary500" py="$3" h="$12" borderRadius="$lg"
              onPress={handleStartScan} alignItems="center" justifyContent="center"
            >
              <HStack alignItems="center" space="sm">
                <Icon as={Bluetooth} size="sm" color="$white" />
                <ButtonText color="$white" fontWeight="$semibold">Scan for Devices</ButtonText>
              </HStack>
            </Button>
          </Box>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
