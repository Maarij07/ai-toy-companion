import React, { useState } from 'react';
import { Alert, Image } from 'react-native';
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
import { Mail } from 'lucide-react-native';

interface ForgotPasswordScreenProps {
  onNavigateToLogin?: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ 
  onNavigateToLogin 
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    let newErrors = {
      email: '',
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

    setErrors(newErrors);

    if (!hasError) {
      setIsLoading(true);
      try {
        // Simulate password reset email sending
        console.log('Sending password reset to:', email);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        Alert.alert(
          'Password Reset Email Sent',
          `We've sent a password reset link to ${email}. Please check your inbox.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to login screen
                if (onNavigateToLogin) {
                  onNavigateToLogin();
                }
              }
            }
          ]
        );
      } catch (error: any) {
        console.error('Password reset error:', error);
        
        Alert.alert('Password Reset Failed', 'Unable to send password reset email. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
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
          Reset Password
        </Text>
        <Text fontSize="$sm" color="$textDark500" textAlign="center">
          Enter your email and we'll send you a link to reset your password
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

        {/* Reset Password Button */}
        <Button 
          bg="$primary500" 
          py="$3" 
          h="$12" 
          borderRadius="$lg" 
          onPress={handleResetPassword} 
          disabled={isLoading}
          alignItems="center"
          justifyContent="center"
        >
          {isLoading ? (
            <>
              <ButtonSpinner mr="$2" color="$white" />
              <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
                Sending...
              </ButtonText>
            </>
          ) : (
            <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
              Send Reset Link
            </ButtonText>
          )}
        </Button>

        {/* Back to Login */}
        <HStack justifyContent="center" alignItems="center" mt="$4">
          <Text color="$textDark500">Remember your password? </Text>
          <Pressable onPress={handleGoToLogin}>
            <Text color="$primary500" fontWeight="$medium">Back to Login</Text>
          </Pressable>
        </HStack>
      </VStack>
    </Box>
  );
};

export default ForgotPasswordScreen;