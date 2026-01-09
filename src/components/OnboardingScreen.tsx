import React, { useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  Center, 
  HStack,
  Icon
} from '@gluestack-ui/themed';
import { Bluetooth, Check, ToyBrick } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
  onNavigateToSetup?: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNavigateToSetup }) => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Animated.View
        style={[
          {
            flex: 1,
            paddingHorizontal: 24,
            justifyContent: 'space-between',
            paddingBottom: 40,
            opacity: opacityValue,
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        {/* Main content */}
        <VStack flex={1} justifyContent="center" alignItems="center" px="$5" space="lg">
          {/* Toy connection icon with animation */}
          <Animated.View 
            style={[
              {
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: isConnected ? '#10B981' : '$primary500', // Green when connected, primary when not
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 32,
                shadowColor: isConnected ? '#10B981' : '$primary500',
                shadowOffset: {
                  width: 0,
                  height: 8,
                },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 8,
                transform: [{ scale: bounceInterpolate }],
                borderWidth: isConnected ? 4 : 0,
                borderColor: '#10B981',
              },
            ]}
          >
            {isConnected ? (
              <Icon as={Check} size="xl" color="$textLight" />
            ) : (
              <Icon as={ToyBrick} size="xl" color="$textLight" />
            )}
          </Animated.View>

          {/* Title */}
          <Text fontSize="$3xl" fontWeight="$bold" color="$textDark800" textAlign="center">
            {isConnected ? 'Connected!' : 'Connect Your Toy'}
          </Text>
          
          {/* Subtitle */}
          <Text fontSize="$lg" fontWeight="$medium" color="$primary500" textAlign="center">
            {isConnected ? 'Successfully Connected' : 'Ready to Connect'}
          </Text>

          {/* Description */}
          <Text fontSize="$sm" color="$textDark500" textAlign="center" lineHeight="$lg">
            {isConnected 
              ? 'Your AI Buddy is now connected and ready to play!' 
              : 'Make sure your AI Buddy is turned on and nearby, then tap Connect.'}
          </Text>
        </VStack>

        {/* Connect button */}
        <Box w="$full" mb="$5">
          <Button 
            bg={isConnected ? '$success500' : '$primary500'} 
            py="$3" 
            h="$12" 
            borderRadius="$lg" 
            onPress={handleConnect} 
            disabled={isConnecting || isConnected}
            alignItems="center"
            justifyContent="center"
          >
            <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
              {isConnected ? 'Connected!' : isConnecting ? 'Connecting...' : 'Connect Toy'}
            </ButtonText>
          </Button>
        </Box>
      </Animated.View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;