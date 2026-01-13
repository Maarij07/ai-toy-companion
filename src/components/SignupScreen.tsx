import React, { useState } from 'react';
import { Alert, Platform, Image, ScrollView } from 'react-native';
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
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Ionicons from 'react-native-vector-icons/Ionicons';


// Modal components
import TermsModal from './TermsModal';
import PrivacyModal from './PrivacyModal';

interface SignupScreenProps {
  onNavigateToLogin?: () => void;
  onNavigateToOnboarding?: () => void;
}

const SignupScreen: React.FC<SignupScreenProps> = ({ 
  onNavigateToLogin, 
  onNavigateToOnboarding 
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const hasMinLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return hasMinLength && hasLowercase && hasUppercase && hasNumber;
  };

  const handleSignup = async () => {
    let newErrors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    };
    let hasError = false;

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
      hasError = true;
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      hasError = true;
    }

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
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 chars with uppercase, lowercase, and number';
      hasError = true;
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      hasError = true;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    setErrors(newErrors);

    if (!hasError) {
      setIsLoading(true);
      
      try {
        // Simulate user creation
        console.log('Creating user with name:', name, 'and email:', email);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Navigate to onboarding screen after successful "signup"
        if (onNavigateToOnboarding) {
          onNavigateToOnboarding();
        }
      } catch (error: any) {
        console.error('Signup error:', error);
        Alert.alert('Sign Up Failed', 'Failed to create account. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleGoogleSignup = async () => {
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
      
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }
      
      console.log('Google signup successful:', userEmail || userName);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to onboarding screen after successful "signup"
      if (onNavigateToOnboarding) {
        onNavigateToOnboarding();
      }
    } catch (error: any) {
      console.error('Google signup error:', error);
      Alert.alert('Google Sign Up Failed', 'Failed to sign up with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
  };

  return (
    <Box flex={1} bg="$backgroundLight0">
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Box p="$4" justifyContent="center" flex={1}>
          <Center mb="$8">
            <Image 
              source={require('../public/logo.png')} 
              alt="Logo"
              style={{ width: 80, height: 80, marginBottom: 16 }}
            />
            <Text fontSize="$xl" fontWeight="$bold" color="$textDark800" mb="$2">
              Create Account
            </Text>
            <Text fontSize="$sm" color="$textDark500" textAlign="center">
              Join AI Toy Companion to get started
            </Text>
          </Center>

          <VStack space="lg" mb="$6">
            {/* Name Input */}
            <FormControl isInvalid={!!errors.name}>
              <FormControlLabel mb="$2">
                <FormControlLabelText color="$textDark800">Full Name</FormControlLabelText>
              </FormControlLabel>
              <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
                <InputSlot pl="$3">
                  <InputIcon as={User} color="$textDark800" />
                </InputSlot>
                <InputField 
                  placeholder="Enter your full name" 
                  placeholderTextColor="$textDark500"
                  color="$textDark800"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </Input>
              <FormControlError>
                <FormControlErrorText>{errors.name}</FormControlErrorText>
              </FormControlError>
            </FormControl>

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

            {/* Confirm Password Input */}
            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormControlLabel mb="$2">
                <FormControlLabelText color="$textDark800">Confirm Password</FormControlLabelText>
              </FormControlLabel>
              <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
                <InputSlot pl="$3">
                  <InputIcon as={Lock} color="$textDark800" />
                </InputSlot>
                <InputField 
                  placeholder="Confirm your password" 
                  placeholderTextColor="$textDark500"
                  color="$textDark800"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <InputSlot pr="$3">
                  <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <InputIcon as={showConfirmPassword ? EyeOff : Eye} color="$textDark800" />
                  </Pressable>
                </InputSlot>
              </Input>
              <FormControlError>
                <FormControlErrorText>{errors.confirmPassword}</FormControlErrorText>
              </FormControlError>
            </FormControl>

            {/* Signup Button */}
            <Button 
              bg="$primary500" 
              py="$3" 
              h="$12" 
              borderRadius="$lg" 
              onPress={handleSignup} 
              disabled={isLoading}
              alignItems="center"
              justifyContent="center"
            >
              {isLoading ? (
                <>
                  <ButtonSpinner mr="$2" color="$white" />
                  <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
                    Creating...
                  </ButtonText>
                </>
              ) : (
                <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
                  Create Account
                </ButtonText>
              )}
            </Button>

            {/* Terms and Conditions */}
            <HStack justifyContent="center" alignItems="center" flexWrap="wrap" mt="$2">
              <Text color="$textDark500" textAlign="center" fontSize="$xs">
                By creating an account, you agree to our{' '}
              </Text>
              <Pressable onPress={() => setShowTermsModal(true)}>
                <Text color="$primary500" textAlign="center" fontSize="$xs" fontWeight="$medium">
                  Terms of Service
                </Text>
              </Pressable>
              <Text color="$textDark500" textAlign="center" fontSize="$xs">
                {' '}and{' '}
              </Text>
              <Pressable onPress={() => setShowPrivacyModal(true)}>
                <Text color="$primary500" textAlign="center" fontSize="$xs" fontWeight="$medium">
                  Privacy Policy
                </Text>
              </Pressable>
            </HStack>

            {/* Back to Login */}
            <HStack justifyContent="center" alignItems="center" mt="$4">
              <Text color="$textDark500">Already have an account? </Text>
              <Pressable onPress={handleGoToLogin}>
                <Text color="$primary500" fontWeight="$medium">Sign In</Text>
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
                onPress={handleGoogleSignup} 
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
      </ScrollView>
      
      {/* Terms Modal */}
      <TermsModal 
        visible={showTermsModal} 
        onClose={() => setShowTermsModal(false)} 
      />
      
      {/* Privacy Modal */}
      <PrivacyModal 
        visible={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)} 
      />
    </Box>
  );
};

export default SignupScreen;