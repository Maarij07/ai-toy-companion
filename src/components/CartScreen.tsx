import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  SafeAreaView,
} from 'react-native';

// Supabase services
import CartService from '../services/CartService';
import AuthService from '../services/AuthService';
import PaymentService from '../services/PaymentService';
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

// ── Module-level cart cache (per user, kept in sync with mutations) ──────────
let _cartCache: CartItem[] | null = null;
let _cartCacheUserId: string | null = null;

/** Call this from outside (e.g. after adding to cart) to force a fresh fetch */
export const invalidateCartCache = () => { _cartCache = null; _cartCacheUserId = null; };

const CartScreen = () => {
  // Always start empty — we validate the cache userId before using it
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Helper: update both React state and the module-level cache atomically
  const setCart = (updater: (prev: CartItem[]) => CartItem[]) => {
    setCartItems(prev => {
      const next = updater(prev);
      _cartCache = next;
      return next;
    });
  };

  // Fetch cart items from Supabase (skipped when cache exists for this user)
  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        setFetchError(false);
        const { data: sessionData } = await AuthService.getSession();
        if (!sessionData?.session?.user) throw new Error('User not authenticated');

        const userId = sessionData.session.user.id;

        // Return early if cache is warm for THIS user
        if (_cartCache !== null && _cartCacheUserId === userId) {
          setCartItems(_cartCache);
          setLoading(false);
          return;
        }

        // Different user or no cache — always fetch fresh
        _cartCache = null;
        _cartCacheUserId = null;

        const { data, error } = await CartService.getUserCart(userId);

        if (error) {
          console.error('Error fetching cart items:', error);
          setFetchError(true);
          setCartItems([]);
        } else if (data) {
          const formattedCartItems = data.map((item: any) => ({
            id: typeof item.id === 'string' ? parseInt(item.id) : item.id,
            name: item.products.name,
            price: parseFloat(item.products.price),
            originalPrice: item.products.original_price
              ? parseFloat(item.products.original_price)
              : parseFloat(item.products.price),
            image: item.products.image_url,
            quantity: item.quantity,
            discount: item.products.discount_percent || 0,
          }));
          _cartCache = formattedCartItems;
          _cartCacheUserId = userId;
          setCartItems(formattedCartItems);
        } else {
          setCartItems([]);
        }
      } catch (error) {
        console.error('Unexpected error fetching cart items:', error);
        setFetchError(true);
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, []);

  const updateQuantity = async (id: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      const { error } = await CartService.updateItemQuantity(id.toString(), newQuantity);
      if (error) console.error('Error updating item quantity:', error);
      // Update state + cache regardless (optimistic)
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
    } catch (error) {
      console.error('Error updating item quantity:', error);
    }
  };

  const removeItem = async (id: number) => {
    try {
      const { error } = await CartService.removeItemFromCart(id.toString());
      if (error) console.error('Error removing item:', error);
      // Update state + cache regardless (optimistic)
      setCart(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };
  
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

  // Check if cart is empty after loading
  const isEmpty = !loading && cartItems.length === 0;

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
  
  if (isEmpty) {
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
            {fetchError ? (
              <>
                <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">Couldn't load cart</Heading>
                <Text size="md" color="$textDark500" textAlign="center">Check your connection and try again.</Text>
              </>
            ) : (
              <>
                <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">Your cart is empty</Heading>
                <Text size="md" color="$textDark500" textAlign="center">Add some toys to get started!</Text>
              </>
            )}
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
            {cartItems.map(item => <React.Fragment key={item.id}>{renderCartItem(item)}</React.Fragment>)}
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
                  setCart(() => []);
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