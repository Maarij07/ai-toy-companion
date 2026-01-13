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


interface LoginScreenProps {
  onNavigateToSignup?: () => void;
  onNavigateToForgotPassword?: () => void;
  onNavigateToHome?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ 
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
  const [loginError, setLoginError] = useState<string | null>(null);

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
    setLoginError(null); // Clear any previous login error

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
        // Simulate login process
        console.log('Attempting login with email:', email);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For demo purposes, accept any email/password combination
        // In a real app without DB, you might have other validation
        
        // Navigate to home screen after successful "login"
        if (onNavigateToHome) {
          onNavigateToHome();
        }
      } catch (error: any) {
        console.error('Login error:', error);
        setLoginError('Login failed. Please try again.');
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
      setLoginError(null); // Clear any previous login error
      
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
      
      console.log('Google login successful:', userEmail || userName);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to home screen after successful "login"
      if (onNavigateToHome) {
        onNavigateToHome();
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      setLoginError('Google login failed. Please try again.');
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
          <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
            <InputSlot pl="$3">
              <InputIcon as={Mail} color="$textDark800" />
            </InputSlot>
            <InputField 
              placeholder="Enter your email" 
              placeholderTextColor="$textDark500"
              color="$textDark800"
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
          <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
            <InputSlot pl="$3">
              <InputIcon as={Lock} color="$textDark800" />
            </InputSlot>
            <InputField 
              placeholder="Enter your password" 
              placeholderTextColor="$textDark500"
              color="$textDark800"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <InputSlot pr="$3">
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <InputIcon as={showPassword ? EyeOff : Eye} color="$textDark800" />
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

        {/* Login Error Display */}
        {loginError && (
          <Box 
            bg="$error100" 
            p="$3" 
            borderRadius="$lg" 
            mb="$4"
            h="$12"
            borderWidth={1}
            borderColor="$error500"
            justifyContent="center"
          >
            <Text color="$error700" textAlign="center" fontWeight="$medium">
              {loginError}
            </Text>
          </Box>
        )}

        {/* Login Button */}
        <Button 
          bg="$primary500" 
          py="$3" 
          h="$12" 
          borderRadius="$lg" 
          onPress={handleLogin} 
          disabled={isLoading}
          alignItems="center"
          justifyContent="center"
        >
          {isLoading ? (
            <>
              <ButtonSpinner mr="$2" color="$white" />
              <ButtonText>Signing in...</ButtonText>
            </>
          ) : (
            <ButtonText>Sign In</ButtonText>
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
            py="$3" 
            h="$12" 
            onPress={handleGoogleLogin} 
            disabled={isLoading}
            alignItems="center"
            justifyContent="center"
          >
            <HStack alignItems="center" justifyContent="center" space="sm">
              <Ionicons name="logo-google" size={24} color="#4285F4" />
              <ButtonText>
                Continue with Google
              </ButtonText>
            </HStack>
          </Button>
          
          {/* Apple button only shows on iOS */}
          {Platform.OS === 'ios' && (
            <Button variant="outline" borderColor="$borderLight300" bg="$backgroundLight0" px="$4" py="$3" h="$12" alignItems="center" justifyContent="center">
              <HStack alignItems="center" justifyContent="center" space="sm">
                <Ionicons name="logo-apple" size={24} color="#000000" />
                <ButtonText>
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

export default LoginScreen;