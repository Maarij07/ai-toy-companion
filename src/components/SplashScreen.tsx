import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Easing,
  NativeModules,
} from 'react-native';
const colors = require('../config/colors');

const { width, height } = Dimensions.get('window');

// Define particle type
interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}

const SplashScreen = () => {
  // Animation values
  const backgroundOpacity = new Animated.Value(0);
  const logoScale = new Animated.Value(0.5);
  const logoRotation = new Animated.Value(0);
  const handWave = new Animated.Value(0);
  const pupilPulse = new Animated.Value(1);
  const textOpacity = new Animated.Value(0);
  const textScale = new Animated.Value(0.8);
  const progressWidth = new Animated.Value(0);
  const particles = useRef<Particle[]>([]);
  
  // Create particle animation values
  if (particles.current.length === 0) {
    for (let i = 0; i < 15; i++) {
      particles.current[i] = {
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(Math.random() * height),
        opacity: new Animated.Value(Math.random() * 0.5 + 0.2),
        scale: new Animated.Value(Math.random() * 0.8 + 0.5),
      };
    }
  }

  useEffect(() => {
    // Background fade in
    Animated.timing(backgroundOpacity, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    
    // Logo assembly animation
    Animated.sequence([
      // Hands appear first
      Animated.timing(logoScale, {
        toValue: 0.7,
        duration: 300,
        easing: Easing.in(Easing.back(1.7)),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.elastic(1),
        useNativeDriver: true,
      }),
    ]).start();
    
    // Hand waving animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(handWave, {
          toValue: 1,
          duration: 1000,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
        Animated.timing(handWave, {
          toValue: 0,
          duration: 1000,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Pupil pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pupilPulse, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
        Animated.timing(pupilPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Text fade in and progress bar
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(textScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 2000, // 2 seconds for progress to complete
          easing: Easing.linear,
          useNativeDriver: false, // Width property is not supported with native driver
        }),
      ]).start();
    }, 1800);
    
    // Particle animations
    particles.current.forEach((particle, index) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.x, {
              toValue: Math.random() * width,
              duration: 8000 + Math.random() * 4000,
              easing: Easing.linear,
              useNativeDriver: false, // Cannot use native driver for position properties
            }),
            Animated.timing(particle.x, {
              toValue: Math.random() * width,
              duration: 8000 + Math.random() * 4000,
              easing: Easing.linear,
              useNativeDriver: false, // Cannot use native driver for position properties
            }),
          ])
        ).start();
        
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.y, {
              toValue: Math.random() * height,
              duration: 8000 + Math.random() * 4000,
              easing: Easing.linear,
              useNativeDriver: false, // Cannot use native driver for position properties
            }),
            Animated.timing(particle.y, {
              toValue: Math.random() * height,
              duration: 8000 + Math.random() * 4000,
              easing: Easing.linear,
              useNativeDriver: false, // Cannot use native driver for position properties
            }),
          ])
        ).start();
        
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.5 + 0.3,
              duration: 3000 + Math.random() * 2000,
              easing: Easing.sin,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.2 + 0.1,
              duration: 3000 + Math.random() * 2000,
              easing: Easing.sin,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.scale, {
              toValue: Math.random() * 0.8 + 0.4,
              duration: 4000 + Math.random() * 2000,
              easing: Easing.sin,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: Math.random() * 0.5 + 0.3,
              duration: 4000 + Math.random() * 2000,
              easing: Easing.sin,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, index * 200);
    });
    
    // Navigate to main app after progress bar completes
    const timer = setTimeout(() => {
      // Simulate navigation to login screen after animation completes
      const { DevSettings } = NativeModules;
      // In a real app, this would navigate to LoginScreen
      // navigation.replace('Login');
      
      // For now, we'll just log to indicate the navigation would happen
      console.log('Navigation to LoginScreen would happen now');
    }, 3800); // Progress starts at 1800ms + duration 2000ms = 3800ms total

    return () => clearTimeout(timer);
  }, []);
  
  // Interpolate values for animations
  const handWaveInterpolate = handWave.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 5],
  });
  
  const pupilPulseInterpolate = pupilPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });
  
  // Function to render animated particles
  const renderParticles = () => {
    return particles.current.map((particle, index) => {
      const color = index % 3 === 0 ? colors.accent : colors.secondary; // Alternate between accent and secondary colors
      return (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              backgroundColor: color,
              opacity: particle.opacity,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { scale: particle.scale },
              ],
            },
          ]}
        />
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Animated background with radial gradient effect */}
      <Animated.View 
        style={[
          styles.background,
          { opacity: backgroundOpacity }
        ]}
      />
      
      {/* Floating particles */}
      {renderParticles()}
      
      <View style={styles.content}>
        {/* Premium animated logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { translateY: handWaveInterpolate },
              ],
            },
          ]}
        >
          <Image 
            source={require('../public/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App name with premium typography and letter-by-letter appearance */}
        <Animated.View 
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }],
            },
          ]}
        >
          <Text style={styles.title}>AI Toy</Text>
          <Text style={styles.subtitle}>Companion</Text>
          
          {/* Progress bar that appears with text */}
          <Animated.View style={[styles.progressContainer, { opacity: textOpacity }]}> 
            <View style={styles.progressTrack}>
              <Animated.View 
                style={[
                  styles.progressIndicator,
                  {
                    width: progressWidth.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    // Simulate radial gradient with layered elements
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
  },

  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.secondary,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#000000', // Black color as requested
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: colors.accent, // Using accent color for the progress fill
    position: 'absolute',
    left: 0,
    top: 0,
    width: 0, // Start at 0 width
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.3,
  },
});

export default SplashScreen;