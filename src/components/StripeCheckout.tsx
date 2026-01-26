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
import {
  useStripe,
  CardField,
} from '@stripe/stripe-react-native';

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
  const [name, setName] = useState('');
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const stripe = useStripe();

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter the cardholder name');
      return false;
    }
    
    if (!cardDetails) {
      Alert.alert('Validation Error', 'Please enter card details');
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

      // Use the Stripe SDK to confirm the payment with the card details
      const { error, paymentIntent } = await stripe.confirmPayment(
        paymentResult.client_secret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: name,
            },
          },
        }
      );

      if (error) {
        throw error;
      }
      
      if (paymentIntent) {
        onSuccess(paymentIntent.id);
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
            <FormControlLabelText size="sm" color="$textDark800">Card Information</FormControlLabelText>
          </FormControlLabel>
          <Box bg="$backgroundLight0" borderRadius="$lg" borderWidth={1} borderColor="$borderLight300" p="$3">
            <CardField
              postalCodeEnabled={false}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 8,
              }}
              style={{ width: '100%', height: 50 }}
              onCardChange={(cardDetails) => {
                setCardDetails(cardDetails);
              }}
              onFocus={(focusedField) => {
                console.log('focus field', focusedField);
              }}
            />
          </Box>
        </FormControl>

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
          disabled={isLoading}
        >
          {isLoading ? (
            <ButtonText color="$textLight50" fontWeight="$medium">Processing...</ButtonText>
          ) : (
            <ButtonText color="$textLight50" fontWeight="$medium">Pay ${amount.toFixed(2)}</ButtonText>
          )}
        </Button>
      </HStack>
    </VStack>
  );
};

export default StripeCheckout;