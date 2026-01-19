import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Input,
  InputField,
  InputSlot,
  InputIcon,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Heading
} from '@gluestack-ui/themed';
import { Eye, EyeOff } from 'lucide-react-native';
import { PaymentService } from '../services';

interface StripeCheckoutProps {
  amount: number;
  currency?: string;
  description?: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  amount,
  currency = 'usd',
  description = 'AI Toy Purchase',
  onSuccess,
  onCancel,
  onError
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCvc, setShowCvc] = useState(false);

  const formatCardNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as XXXX XXXX XXXX XXXX
    return digits
      .replace(/(\d{4})(?=\d)/g, '$1 ')
      .substring(0, 19);
  };

  const formatExpiry = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as MM/YY
    if (digits.length >= 3) {
      return `${digits.substring(0, 2)}/${digits.substring(2, 4)}`;
    }
    return digits;
  };

  const formatCvc = (value: string) => {
    // CVC is typically 3-4 digits
    return value.replace(/\D/g, '').substring(0, 4);
  };

  const handleCardNumberChange = (value: string) => {
    setCardNumber(formatCardNumber(value));
  };

  const handleExpiryChange = (value: string) => {
    setExpiry(formatExpiry(value));
  };

  const handleCvcChange = (value: string) => {
    setCvc(formatCvc(value));
  };

  const validateForm = () => {
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      Alert.alert('Validation Error', 'Please enter a valid card number');
      return false;
    }

    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
      Alert.alert('Validation Error', 'Please enter a valid expiry date (MM/YY)');
      return false;
    }

    if (!cvc || cvc.length < 3) {
      Alert.alert('Validation Error', 'Please enter a valid CVC (3-4 digits)');
      return false;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter the cardholder name');
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Create payment intent
      const paymentResult = await PaymentService.createPaymentIntent({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
      });

      console.log('Payment intent created:', paymentResult);

      // In a real app, we would use the Stripe SDK to confirm the payment with actual card details
      // For this simulation, we'll proceed directly to confirmation
      const confirmResult = await PaymentService.confirmPaymentIntent(paymentResult.id);

      if (confirmResult.status === 'succeeded') {
        onSuccess(confirmResult.payment_intent_id);
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error.message || 'There was an error processing your payment. Please try again.';
      
      if (onError) {
        onError(errorMessage);
      } else {
        Alert.alert('Payment Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VStack space="lg" pt="$2">
      <Box bg="$primary50" borderRadius="$lg" p="$3" mb="$3">
        <Text size="sm" fontWeight="$medium" color="$textDark800">Order Total: ${amount.toFixed(2)}</Text>
      </Box>

      <VStack space="md">
        <FormControl isRequired mb="$3">
          <FormControlLabel mb="$2">
            <FormControlLabelText size="sm" color="$textDark800">Card Number</FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" size="md" borderRadius="$lg">
            <InputField 
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              keyboardType="numeric"
              maxLength={19}
              autoCapitalize="none"
            />
          </Input>
        </FormControl>

        <HStack space="sm" mb="$3">
          <FormControl flex={1} isRequired>
            <FormControlLabel mb="$2">
              <FormControlLabelText size="sm" color="$textDark800">Expiry</FormControlLabelText>
            </FormControlLabel>
            <Input variant="outline" size="md" borderRadius="$lg">
              <InputField 
                placeholder="MM/YY"
                value={expiry}
                onChangeText={handleExpiryChange}
                keyboardType="numeric"
                maxLength={5}
                autoCapitalize="none"
              />
            </Input>
          </FormControl>

          <FormControl flex={1} isRequired>
            <FormControlLabel mb="$2">
              <FormControlLabelText size="sm" color="$textDark800">CVC</FormControlLabelText>
            </FormControlLabel>
            <Input variant="outline" size="md" borderRadius="$lg">
              <InputField 
                placeholder="123"
                value={cvc}
                onChangeText={handleCvcChange}
                secureTextEntry={!showCvc}
                keyboardType="numeric"
                maxLength={4}
                autoCapitalize="none"
              />
              <InputSlot pr="$3" onPress={() => setShowCvc(!showCvc)}>
                <InputIcon as={showCvc ? EyeOff : Eye} size="sm" color="$textDark500" />
              </InputSlot>
            </Input>
          </FormControl>
        </HStack>

        <FormControl isRequired mb="$3">
          <FormControlLabel mb="$2">
            <FormControlLabelText size="sm" color="$textDark800">Name on Card</FormControlLabelText>
          </FormControlLabel>
          <Input variant="outline" size="md" borderRadius="$lg">
            <InputField 
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </Input>
        </FormControl>

        <Box mt="$4" p="$3" bg="$backgroundLight50" borderRadius="$md">
          <Heading size="xs" color="$textDark800" mb="$1">Secure Payment</Heading>
          <Text size="xs" color="$textDark500">
            Your payment details are securely processed through Stripe. 
            We do not store your credit card information.
          </Text>
        </Box>
      </VStack>

      <HStack space="md" mt="$4">
        <Button 
          variant="outline" 
          size="md" 
          flex={1}
          onPress={onCancel}
        >
          <ButtonText color="$textDark800">Cancel</ButtonText>
        </Button>
        <Button 
          variant="solid" 
          size="md" 
          bg="$primary500" 
          flex={1}
          onPress={handlePayment}
          isLoading={isLoading}
          isDisabled={isLoading}
        >
          <ButtonText color="$textLight50" fontWeight="$medium">Pay ${amount.toFixed(2)}</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
};

export default StripeCheckout;