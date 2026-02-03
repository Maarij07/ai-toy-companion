import React, { useState } from 'react';
import {
  SafeAreaView,
  Alert
} from 'react-native';
import {
  Box,
  Text,
  Button,
  ButtonText,
  VStack,
  HStack,
  Input,
  InputField,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Heading
} from '@gluestack-ui/themed';
import { AuthService } from '../services';

interface ForgotPasswordScreenProps {
  onNavigateToLogin: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onNavigateToLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await AuthService.resetPassword(email);
      
      if (result.error) {
        Alert.alert('Error', result.error.message || 'Failed to send reset email');
      } else {
        Alert.alert(
          'Success', 
          'Password reset email sent! Please check your inbox.',
          [{ text: 'OK', onPress: onNavigateToLogin }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1} justifyContent="center" paddingHorizontal="$6">
        <Box mb="$10">
          <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">
            Reset Password
          </Heading>
          <Text size="sm" color="$textDark500" textAlign="center">
            Enter your email to receive a password reset link
          </Text>
        </Box>

        <FormControl mb="$4">
          <FormControlLabel mb="$2">
            <FormControlLabelText size="sm" color="$textDark800">
              Email Address
            </FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" size="md" borderRadius="$lg">
            <InputField
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Input>
        </FormControl>

        <Button 
          bg="$primary500" 
          borderRadius="$lg" 
          mt="$4" 
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ButtonText color="$textLight500" fontWeight="$medium">
                Sending...
              </ButtonText>
            </>
          ) : (
            <ButtonText color="$textLight500" fontWeight="$medium">
              Send Reset Link
            </ButtonText>
          )}
        </Button>

        <HStack mt="$6" justifyContent="center">
          <Text size="sm" color="$textDark500">
            Remember your password?{' '}
          </Text>
          <Button variant="link" onPress={onNavigateToLogin}>
            <ButtonText color="$primary500" fontWeight="$medium">
              Sign In
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;