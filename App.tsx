/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';

// Firebase initialization
import './src/config/firebase';

import SplashScreen from './src/components/SplashScreen';
import LoginScreen from './src/components/LoginScreen';
import SignupScreen from './src/components/SignupScreen';
import ForgotPasswordScreen from './src/components/ForgotPasswordScreen';
import OnboardingScreen from './src/components/OnboardingScreen';
import SetupScreen from './src/components/SetupScreen';
import SettingsScreen from './src/components/SettingsScreen';
import HomeScreen from './src/components/HomeScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'signup' | 'forgot' | 'onboarding' | 'setup' | 'home'>('login');
  
  useEffect(() => {
    // Simulate splash screen completion
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); // Show splash for 3 seconds
    
    return () => clearTimeout(timer);
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
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {showSplash ? <SplashScreen /> : renderCurrentScreen()}
    </SafeAreaProvider>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
