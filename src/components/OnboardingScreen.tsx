import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const colors = require('../config/colors');

const { width, height } = Dimensions.get('window');

const OnboardingScreen = ({ onNavigateToSetup }: { onNavigateToSetup?: () => void; }) => {
  const [scaleValue] = useState(new Animated.Value(0.8));
  const [opacityValue] = useState(new Animated.Value(0));
  const [bounceValue] = useState(new Animated.Value(0));
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Staggered animations for a premium feel
    Animated.parallel([
      // Main container fade in
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Scale in effect
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.back(1.7)),
        useNativeDriver: true,
      }),
    ]).start();
    
    // Bluetooth icon bounce animation (separate to avoid void type issue)
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleConnect = () => {
    // Show connecting state
    setIsConnecting(true);
    
    // Simulate connection delay
    setTimeout(() => {
      // Connect to toy functionality would go here
      console.log('Attempting to connect to toy...');
      // Set connected state
      setIsConnected(true);
      // In a real app: navigation.navigate('Setup');
      if (onNavigateToSetup) {
        onNavigateToSetup();
      }
    }, 2000);
  };

  const bounceInterpolate = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: opacityValue,
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        {/* Header with back button */}


        {/* Main content */}
        <View style={styles.mainContent}>
          {/* Bluetooth icon with animation */}
          <Animated.View 
            style={[
              styles.bluetoothContainer,
              isConnected && styles.connectedBluetoothContainer,
              {
                transform: [{ scale: bounceInterpolate }],
              },
            ]}
          >
            <Text style={styles.bluetoothIcon}>{isConnected ? '✓' : '📡'}</Text>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>{isConnected ? 'Connected!' : 'Connect Your Toy'}</Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>{isConnected ? 'Successfully Connected' : 'Ready to Connect'}</Text>

          {/* Description */}
          <Text style={styles.description}>
            {isConnected 
              ? 'Your AI Buddy is now connected and ready to play!' 
              : 'Make sure your AI Buddy is turned on and nearby, then tap Connect.'}
          </Text>
        </View>

        {/* Connect button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={isConnecting || isConnected}>
            <Text style={styles.connectButtonText}>{isConnected ? 'Connected!' : isConnecting ? 'Connecting...' : 'Connect Toy'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bluetoothContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  bluetoothIcon: {
    fontSize: 48,
    color: colors.textLight,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  connectButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
  },
  connectedBluetoothContainer: {
    borderColor: '#10B981', // Emerald green for success state
    borderWidth: 4,
  },
});

export default OnboardingScreen;