/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View, ActivityIndicator, Text } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import customConfig from './src/config/theme';

// Supabase services
import { AuthService } from './src/services';



import SplashScreen from './src/components/SplashScreen';
import LoginScreen from './src/components/LoginScreen';
import SignupScreen from './src/components/SignupScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import OnboardingScreen from './src/components/OnboardingScreen';
import SetupScreen from './src/components/SetupScreen';
import SettingsScreen from './src/components/SettingsScreen';
import HomeScreen from './src/components/HomeScreen';
import VoiceProcessingScreen from './src/components/VoiceProcessingScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [showSplash, setShowSplash] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'signup' | 'forgot' | 'onboarding' | 'setup' | 'home' | 'voiceProcessing'>('login');
  
  useEffect(() => {
    // Initialize app and check for existing session
    const initApp = async () => {
      // Show splash screen while initializing
      const splashTimer = setTimeout(() => {
        setShowSplash(false);
      }, 3000);
      
      try {
        // Check for existing session
        // Check if AuthService is properly imported
        if (!AuthService || typeof AuthService.getSession !== 'function') {
          console.error('AuthService is not properly loaded. Using fallback behavior.');
          setCurrentScreen('login');
          setIsInitializing(false);
          return;
        }
        
        const { data: sessionData, error: sessionError } = await AuthService.getSession();
        
        if (sessionData?.session && !sessionError) {
          // User is already logged in
          setCurrentScreen('home');
        } else {
          // No existing session, show login screen
          setCurrentScreen('login');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // Default to login screen on error
        setCurrentScreen('login');
      } finally {
        setIsInitializing(false);
      }
      
      return () => {
        clearTimeout(splashTimer);
      };
    };
    
    initApp();
  }, []);

  const navigateToSignup = () => {
    setCurrentScreen('signup');
  };

  const navigateToForgotPassword = () => {
    setCurrentScreen('forgot');
  };

  const navigateToLogin = () => {
    setCurrentScreen('login');
  };

  const navigateToHome = () => {
    setCurrentScreen('home');
  };

  const navigateToOnboarding = () => {
    setCurrentScreen('onboarding');
  };

  const navigateToSetup = () => {
    setCurrentScreen('setup');
  };

  const navigateToVoiceProcessing = () => {
    setCurrentScreen('voiceProcessing');
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'signup':
        return <SignupScreen onNavigateToLogin={navigateToLogin} onNavigateToOnboarding={navigateToOnboarding} />;
      case 'onboarding':
        return <OnboardingScreen onNavigateToSetup={navigateToSetup} />;
      case 'setup':
        return <SetupScreen onNavigateToHome={navigateToHome} />;
      case 'forgot':
        return <ForgotPasswordScreen onNavigateToLogin={navigateToLogin} />;
      case 'home':
        return <HomeScreen onNavigateToHome={() => setCurrentScreen('home')} />;
      case 'voiceProcessing':
        return <VoiceProcessingScreen />;
      case 'login':
      default:
        return <LoginScreen 
          onNavigateToSignup={navigateToSignup} 
          onNavigateToForgotPassword={navigateToForgotPassword} 
          onNavigateToHome={navigateToHome}
        />;
    }
  };

  return (
    <GluestackUIProvider config={customConfig}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {isInitializing ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F4E9' }}>
            <ActivityIndicator size="large" color="#6D8B74" />
            <Text style={{ marginTop: 10, color: '#3C3C3C' }}>Initializing...</Text>
          </View>
        ) : showSplash ? (
          <SplashScreen />
        ) : (
          renderCurrentScreen()
        )}
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
