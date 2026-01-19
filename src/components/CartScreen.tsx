import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  SafeAreaView,
} from 'react-native';

// Supabase services
import { CartService, AuthService, PaymentService } from '../services';
import StripeCheckout from './StripeCheckout';
import { Alert } from 'react-native';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Image,
  Pressable,
  Heading,
  Icon,
  Card,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Divider,
  Spinner
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowRight,
  Package,
  Truck,
  DollarSign,
  X
} from 'lucide-react-native';

interface CartItem {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  quantity: number;
  discount: number;
}

const CartScreen = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch cart items from Supabase
  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        const { data: sessionData } = await AuthService.getSession();
        if (!sessionData?.session?.user) {
          throw new Error('User not authenticated');
        }
        
        const userId = sessionData.session.user.id;
        const { data, error } = await CartService.getUserCart(userId);
        
        if (error) {
          console.error('Error fetching cart items:', error);
          // Fallback to mock data if there's an error
          setCartItems(mockCartItems);
        } else if (data) {
          // Convert Supabase data to our CartItem format
          const formattedCartItems = data.map((item: any) => ({
            id: typeof item.id === 'string' ? parseInt(item.id) : item.id, // Use the cart item ID for updates/removals
            name: item.products.name,
            price: parseFloat(item.products.price),
            originalPrice: item.products.original_price ? parseFloat(item.products.original_price) : parseFloat(item.products.price),
            image: item.products.image_url,
            quantity: item.quantity,
            discount: item.products.discount_percent || 0,
          }));
          
          setCartItems(formattedCartItems);
        } else {
          // If data is null, use mock data
          setCartItems(mockCartItems);
        }
      } catch (error) {
        console.error('Unexpected error fetching cart items:', error);
        // Fallback to mock data
        setCartItems(mockCartItems);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCartItems();
  }, []);
  
  const updateQuantity = async (id: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    try {
      // Update quantity in Supabase - id refers to the cart item ID, not product ID
      const { error } = await CartService.updateItemQuantity(id.toString(), newQuantity);
      
      if (error) {
        console.error('Error updating item quantity:', error);
        // Fallback to local state update if Supabase fails
        setCartItems(prevItems =>
          prevItems.map(item =>
            item.id === id ? { ...item, quantity: newQuantity } : item
          )
        );
        return;
      }
      
      // Update local state
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      console.error('Error updating item quantity:', error);
    }
  };

  const removeItem = async (id: number) => {
    try {
      // Remove item from Supabase cart - id refers to the cart item ID, not product ID
      const { error } = await CartService.removeItemFromCart(id.toString());
      
      if (error) {
        console.error('Error removing item:', error);
        // Fallback to local state removal if Supabase fails
        setCartItems(prevItems => prevItems.filter(item => item.id !== id));
        return;
      }
      
      // Update local state
      setCartItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };
  
  // Mock cart items as fallback
  const mockCartItems: CartItem[] = [
    {
      id: 1,
      name: 'Buddy the Bear',
      price: 89.99,
      originalPrice: 119.99,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      quantity: 1,
      discount: 25,
    },
    {
      id: 2,
      name: 'Smart Elephant',
      price: 69.99,
      originalPrice: 89.99,
      image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
      quantity: 2,
      discount: 22,
    },
    {
      id: 3,
      name: 'Dino Explorer',
      price: 79.99,
      originalPrice: 99.99,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      quantity: 1,
      discount: 20,
    },
  ];

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = cartItems.reduce((sum, item) => {
    const discountAmount = item.originalPrice
      ? (item.originalPrice - item.price) * item.quantity
      : 0;
    return sum + discountAmount;
  }, 0);
  const shipping = subtotal > 0 ? 5.99 : 0;
  const total = subtotal + shipping;
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const renderCartItem = (item: CartItem) => (
    <Card my="$1" bg="$backgroundLight0" borderRadius="$md" borderWidth={0.5} borderColor="$borderLight300">
      <HStack p="$2" space="sm" alignItems="center">
        <Image 
          source={{ uri: item.image }} 
          alt={item.name}
          borderRadius={6} 
          resizeMode="cover"
          style={{ width: 60, height: 60 }}
        />
        
        <VStack flex={1} justifyContent="space-between">
          <Heading size="xs" fontWeight="$medium" color="$textDark800" numberOfLines={1}>
            {item.name}
          </Heading>
          
          <HStack alignItems="center" mt="$1">
            <Text size="sm" fontWeight="$bold" color="$textDark800">${item.price.toFixed(2)}</Text>
            {item.originalPrice && (
              <>
                <Text ml="$1" size="xs" color="$textDark500" textDecorationLine="line-through">
                  ${item.originalPrice.toFixed(2)}
                </Text>
                <Box bg="$error50" borderRadius="$full" px="$1" py="$0.5" ml="$1">
                  <Text size="2xs" fontWeight="$medium" color="$error500">-{item.discount}%</Text>
                </Box>
              </>
            )}
          </HStack>
          
          <HStack justifyContent="space-between" alignItems="center" mt="$1">
            <HStack alignItems="center" bg="$backgroundLight50" borderRadius="$md" p="$0.5">
              <Pressable 
                onPress={() => updateQuantity(item.id, item.quantity - 1)} 
                p="$1"
              >
                <Icon as={Minus} size="xs" color="$textDark800" />
              </Pressable>

              <Box bg="$backgroundLight0" borderRadius="$sm" minWidth={24} alignItems="center" justifyContent="center" p="$1" borderWidth={0.5} borderColor="$borderLight300">
                <Text size="xs" fontWeight="$medium" color="$textDark800">
                  {item.quantity}
                </Text>
              </Box>

              <Pressable 
                onPress={() => updateQuantity(item.id, item.quantity + 1)} 
                p="$1"
              >
                <Icon as={Plus} size="xs" color="$textDark800" />
              </Pressable>
            </HStack>

            <Pressable onPress={() => removeItem(item.id)} p="$1">
              <Icon as={Trash2} size="sm" color="$error500" />
            </Pressable>
          </HStack>
        </VStack>
      </HStack>
    </Card>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <VStack flex={1}>
          {/* Sticky Header */}
          <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
            <Pressable p="$2">
              <Icon as={User} size="xl" color="$textDark800" />
            </Pressable>
            
            <Heading size="md" color="$textDark800">My Cart</Heading>
            
            <Pressable p="$2">
              <Icon as={Bell} size="lg" color="$textDark800" />
            </Pressable>
          </HStack>
          
          <VStack flex={1} justifyContent="center" alignItems="center" px="$10">
            <Icon as={ShoppingCart} size="5xl" color="$textDark300" mb="$4" />
            <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">Your cart is empty</Heading>
            <Text size="md" color="$textDark500" textAlign="center">Add some toys to get started!</Text>
          </VStack>
        </VStack>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="$primary500" />
          <Text mt="$2" color="$textDark500">Loading cart items...</Text>
        </VStack>
      </SafeAreaView>
    );
  }
  
  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <VStack flex={1}>
          {/* Sticky Header */}
          <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
            <Pressable p="$2">
              <Icon as={User} size="xl" color="$textDark800" />
            </Pressable>
            
            <Heading size="md" color="$textDark800">My Cart</Heading>
            
            <Pressable p="$2">
              <Icon as={Bell} size="lg" color="$textDark800" />
            </Pressable>
          </HStack>
          
          <VStack flex={1} justifyContent="center" alignItems="center" px="$10">
            <Icon as={ShoppingCart} size="5xl" color="$textDark300" mb="$4" />
            <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">Your cart is empty</Heading>
            <Text size="md" color="$textDark500" textAlign="center">Add some toys to get started!</Text>
          </VStack>
        </VStack>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1}>
        {/* Sticky Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Pressable p="$2">
            <Icon as={User} size="xl" color="$textDark800" />
          </Pressable>
          
          <Heading size="md" color="$textDark800">My Cart</Heading>
          
          <Pressable p="$2">
            <Icon as={Bell} size="lg" color="$textDark800" />
          </Pressable>
        </HStack>
        
        <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 150, flexGrow: 1 }}>
          <VStack space="xs">
            {cartItems.map(item => renderCartItem(item))}
          </VStack>

          {/* Promotional Banner */}
          <Box bg="$primary500" borderRadius="$lg" p="$4" mt="$4">
            <HStack alignItems="center">
              <Icon as={Package} size="lg" color="$textLight50" mr="$2" />
              <VStack flex={1}>
                <Text size="sm" fontWeight="$medium" color="$textLight50">Free Shipping</Text>
                <Text size="xs" color="$textLight50">You're eligible for free shipping on orders over $100</Text>
              </VStack>
              <Button size="xs" variant="link" action="secondary">
                <ButtonText color="$textLight50">Learn More</ButtonText>
              </Button>
            </HStack>
          </Box>

          {/* Order Summary */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mt="$4">
            <Heading size="sm" color="$textDark800" mb="$3">Order Summary</Heading>

            <HStack justifyContent="space-between" mb="$2">
              <Text size="sm" color="$textDark600">Subtotal</Text>
              <Text size="sm" fontWeight="$medium" color="$textDark800">${subtotal.toFixed(2)}</Text>
            </HStack>

            <HStack justifyContent="space-between" mb="$2">
              <Text size="sm" color="$textDark600">Savings</Text>
              <Text size="sm" fontWeight="$medium" color="$error500">-${discount.toFixed(2)}</Text>
            </HStack>

            <HStack justifyContent="space-between" mb="$2">
              <Text size="sm" color="$textDark600">Shipping</Text>
              <Text size="sm" fontWeight="$medium" color="$textDark800">${shipping.toFixed(2)}</Text>
            </HStack>

            <Box my="$3" h="$0.5" bg="$borderLight300" />

            <HStack justifyContent="space-between" alignItems="center">
              <Text size="md" fontWeight="$bold" color="$textDark800">Total</Text>
              <Text size="lg" fontWeight="$bold" color="$primary500">${total.toFixed(2)}</Text>
            </HStack>
          </Box>

          {/* Delivery Options */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mt="$4">
            <Heading size="sm" color="$textDark800" mb="$3">Delivery Options</Heading>
            
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center" py="$2">
                <HStack alignItems="center">
                  <Icon as={Truck} size="md" color="$primary500" mr="$2" />
                  <VStack>
                    <Text size="sm" fontWeight="$medium" color="$textDark800">Standard Delivery</Text>
                    <Text size="xs" color="$textDark500">3-5 business days</Text>
                  </VStack>
                </HStack>
                <Text size="sm" fontWeight="$medium" color="$textDark800">$5.99</Text>
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$2">
                <HStack alignItems="center">
                  <Icon as={Truck} size="md" color="$textDark500" mr="$2" />
                  <VStack>
                    <Text size="sm" fontWeight="$medium" color="$textDark800">Express Delivery</Text>
                    <Text size="xs" color="$textDark500">1-2 business days</Text>
                  </VStack>
                </HStack>
                <Text size="sm" fontWeight="$medium" color="$textDark800">$14.99</Text>
              </HStack>
            </VStack>
          </Box>
          
          {/* Checkout Button */}
          <Button 
            size="lg" 
            borderRadius="$lg" 
            bg="$primary500" 
            mt="$4"
            onPress={() => setShowCheckoutModal(true)}
          >
            <HStack justifyContent="space-between" alignItems="center" flex={1}>
              <ButtonText fontWeight="$medium" color="$textLight50">Proceed to Checkout</ButtonText>
              <HStack alignItems="center">
                <Icon as={DollarSign} size="md" color="$textLight50" />
                <Text fontWeight="$medium" color="$textLight50" ml="$1">${total.toFixed(2)}</Text>
                <Icon as={ArrowRight} size="md" color="$textLight50" ml="$2" />
              </HStack>
            </HStack>
          </Button>
        </ScrollView>

        <Modal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)}>
          <ModalBackdrop />
          <ModalContent>
            <ModalHeader>
              <Heading size="md" color="$textDark800">Complete Your Purchase</Heading>
              <ModalCloseButton onPress={() => setShowCheckoutModal(false)}>
                <Icon as={X} size="md" color="$textDark800" />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              <StripeCheckout 
                amount={total}
                description={`AI Toy Purchase - ${cartItems.length} items`}
                onSuccess={(paymentIntentId) => {
                  // Clear the cart after successful payment
                  setCartItems([]);
                  
                  // Show success message
                  Alert.alert('Success', `Payment successful! Order ID: ${paymentIntentId}`);
                  setShowCheckoutModal(false);
                }}
                onCancel={() => setShowCheckoutModal(false)}
                onError={(error) => {
                  Alert.alert('Payment Error', error);
                }}
              />
              
              <Box mt="$4" p="$3" bg="$backgroundLight50" borderRadius="$md">
                <Text size="xs" color="$textDark500">By completing this purchase, you agree to our refund policy:</Text>
                <Text size="xs" color="$textDark500">• 30-day money back guarantee applies to physical toys</Text>
                <Text size="xs" color="$textDark500">• 5-day refund policy for digital goods</Text>
              </Box>
            </ModalBody>
          </ModalContent>
        </Modal>
      </VStack>
    </SafeAreaView>
  );
};

export default CartScreen;