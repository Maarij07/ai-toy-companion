import React, { useState } from 'react';
import { Alert, Platform, Image } from 'react-native';
import { 
  Box, 
  Text, 
  Input, 
  InputField, 
  InputIcon, 
  InputSlot, 
  Button, 
  ButtonText, 
  ButtonSpinner, 
  FormControl, 
  FormControlError, 
  FormControlErrorText, 
  FormControlLabel, 
  FormControlLabelText, 
  HStack, 
  VStack, 
  Center, 
  Pressable 
} from '@gluestack-ui/themed';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Firebase imports
import { getAuth, firestore } from '../config/firebase';
import { updateDoc, doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import authModule from '@react-native-firebase/auth';

interface LoginScreenProps {
  onNavigateToSignup?: () => void;
  onNavigateToForgotPassword?: () => void;
  onNavigateToHome?: () => void;
}

const GlueStackLoginScreen: React.FC<LoginScreenProps> = ({ 
  onNavigateToSignup, 
  onNavigateToForgotPassword, 
  onNavigateToHome 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    let newErrors = {
      email: '',
      password: '',
    };
    let hasError = false;

    // Validate email
    if (!email.trim()) {
      newErrors.email = 'Email is required';
      hasError = true;
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
      hasError = true;
    }

    // Validate password
    if (!password) {
      newErrors.password = 'Password is required';
      hasError = true;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      hasError = true;
    }

    setErrors(newErrors);

    if (!hasError) {
      setIsLoading(true);
      try {
        // Firebase email/password authentication
        const userCredential = await getAuth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Login successful:', user.uid);
        
        // Update last login timestamp in Firestore
        try {
          await updateDoc(doc(firestore, 'users', user.uid), {
            lastLoginAt: new Date(),
          });
        } catch (err) {
          console.warn('Could not update last login timestamp:', err);
        }
        
        // Navigate to home screen after successful login
        if (onNavigateToHome) {
          onNavigateToHome();
        }
      } catch (error: any) {
        console.error('Login error:', error);
        
        // Map Firebase error codes to user-friendly messages
        const errorMessages: { [key: string]: string } = {
          'auth/user-not-found': 'No account found with this email. Please sign up first.',
          'auth/wrong-password': 'Incorrect password. Please try again.',
          'auth/invalid-email': 'Please enter a valid email address.',
          'auth/user-disabled': 'This account has been disabled. Please contact support.',
          'auth/too-many-requests': 'Too many login attempts. Please try again later.',
          'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        };
        
        const friendlyMessage = errorMessages[error.code] || 'Unable to sign in. Please try again.';
        Alert.alert('Sign In Failed', friendlyMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleForgotPassword = () => {
    if (onNavigateToForgotPassword) {
      onNavigateToForgotPassword();
    }
  };

  const handleSignUp = () => {
    if (onNavigateToSignup) {
      onNavigateToSignup();
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      
      // Configure Google Sign-In
      await GoogleSignin.configure({
        webClientId: "708825188624-aba1l7jag9b5omnok4mhme8gft97sg7q.apps.googleusercontent.com",
      });
      
      // Check if Google Play Services is available
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      const userName = response.data?.user?.name;
      const userEmail = response.data?.user?.email;
      const userPhoto = response.data?.user?.photo;
      
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }
      
      // Create Firebase credential
      const auth = getAuth();
      const credential = authModule.GoogleAuthProvider.credential(idToken);
      
      // Sign in to Firebase with the Google credential
      const userCredential = await auth.signInWithCredential(credential);
      const firebaseUser = userCredential.user;
      
      console.log('Google login successful:', firebaseUser.uid);
      
      // Check if user exists in Firestore
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // New user - create Firestore document
        await setDoc(userDocRef, {
          name: userName || '',
          email: userEmail || firebaseUser.email || '',
          photoURL: userPhoto || '',
          createdAt: new Date(),
          lastLoginAt: new Date(),
          profileComplete: false,
          authProvider: 'google',
        });
      } else {
        // Existing user - update last login
        await updateDoc(userDocRef, {
          lastLoginAt: new Date(),
        });
      }
      
      // Navigate to home screen after successful login
      if (onNavigateToHome) {
        onNavigateToHome();
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      
      // Map Google error codes to user-friendly messages
      const errorMessages: { [key: string]: string } = {
        '-1': 'Google Sign-In was cancelled.',
        '12500': 'Google Play Services error. Please check your Google Play Services installation.',
        '12501': 'Sign-in cancelled or no credentials available.',
        'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
      };
      
      const friendlyMessage = errorMessages[error.code?.toString()] || 'Unable to sign in with Google. Please try again.';
      Alert.alert('Google Sign In Failed', friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box flex={1} bg="$backgroundLight0" p="$4" justifyContent="center">
      <Center mb="$8">
        <Image 
          source={require('../public/logo.png')} 
          alt="Logo"
          style={{ width: 80, height: 80, marginBottom: 16 }}
        />
        <Text fontSize="$xl" fontWeight="$bold" color="$textDark800" mb="$2">
          Welcome Back
        </Text>
        <Text fontSize="$sm" color="$textDark500" textAlign="center">
          Sign in to your AI Toy Companion
        </Text>
      </Center>

      <VStack space="lg" mb="$6">
        {/* Email Input */}
        <FormControl isInvalid={!!errors.email}>
          <FormControlLabel mb="$2">
            <FormControlLabelText color="$textDark800">Email</FormControlLabelText>
          </FormControlLabel>
          <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0">
            <InputSlot pl="$3">
              <InputIcon as={Mail} />
            </InputSlot>
            <InputField 
              placeholder="Enter your email" 
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Input>
          <FormControlError>
            <FormControlErrorText>{errors.email}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        {/* Password Input */}
        <FormControl isInvalid={!!errors.password}>
          <FormControlLabel mb="$2">
            <FormControlLabelText color="$textDark800">Password</FormControlLabelText>
          </FormControlLabel>
          <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0">
            <InputSlot pl="$3">
              <InputIcon as={Lock} />
            </InputSlot>
            <InputField 
              placeholder="Enter your password" 
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <InputSlot pr="$3">
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <InputIcon as={showPassword ? EyeOff : Eye} />
              </Pressable>
            </InputSlot>
          </Input>
          <FormControlError>
            <FormControlErrorText>{errors.password}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        {/* Forgot Password */}
        <HStack justifyContent="flex-end" mb="$4">
          <Pressable onPress={handleForgotPassword}>
            <Text color="$primary500" fontWeight="$medium">Forgot Password?</Text>
          </Pressable>
        </HStack>

        {/* Login Button */}
        <Button 
          bg="$primary500" 
          py="$5" 
          h="$12" 
          borderRadius="$lg" 
          onPress={handleLogin} 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ButtonSpinner mr="$2" color="$white" />
              <ButtonText color="$white" fontWeight="$semibold">Signing in...</ButtonText>
            </>
          ) : (
            <ButtonText color="$white" fontWeight="$semibold">Sign In</ButtonText>
          )}
        </Button>

        {/* Sign Up */}
        <HStack justifyContent="center" alignItems="center" mt="$4">
          <Text color="$textDark500">Don't have an account? </Text>
          <Pressable onPress={handleSignUp}>
            <Text color="$primary500" fontWeight="$medium">Sign Up</Text>
          </Pressable>
        </HStack>

        {/* Divider */}
        <HStack alignItems="center" justifyContent="center" my="$6">
          <Box flex={1} h="$0.5" bg="$borderLight300" />
          <Text mx="$4" color="$textDark500">OR</Text>
          <Box flex={1} h="$0.5" bg="$borderLight300" />
        </HStack>

        {/* Social Login Buttons */}
        <VStack space="md">
          <Button 
            variant="outline" 
            borderColor="$borderLight300" 
            bg="$backgroundLight0"
            px="$4"
            py="$5" 
            h="$12" 
            onPress={handleGoogleLogin} 
            disabled={isLoading}
          >
            <HStack alignItems="center" justifyContent="center" space="sm">
              <Ionicons name="logo-google" size={24} color="#4285F4" />
              <ButtonText color="$textDark800" fontWeight="$medium">
                Continue with Google
              </ButtonText>
            </HStack>
          </Button>
          
          {/* Apple button only shows on iOS */}
          {Platform.OS === 'ios' && (
            <Button variant="outline" borderColor="$borderLight300" bg="$backgroundLight0" px="$4" py="$5" h="$12">
              <HStack alignItems="center" justifyContent="center" space="sm">
                <Ionicons name="logo-apple" size={24} color="#000000" />
                <ButtonText color="$textDark800" fontWeight="$medium">
                  Continue with Apple
                </ButtonText>
              </HStack>
            </Button>
          )}
        </VStack>
      </VStack>
    </Box>
  );
};

export default GlueStackLoginScreen;