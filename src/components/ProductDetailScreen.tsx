import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  Dimensions
} from 'react-native';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Image,
  Heading,
  Icon,
  Card
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  ShoppingCart,
  Star,
  Heart,
  Share2,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft
} from 'lucide-react-native';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  discount?: number;
  badge?: string;
  brand: string;
  ageRange: string;
  features: string[];
  description: string;
}

interface ProductDetailScreenProps {
  route?: {
    params: {
      product: Product;
    };
  };
  navigation?: any;
}

const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({ route, navigation }) => {
  const [quantity, setQuantity] = React.useState<number>(1);
  
  const product = route?.params?.product || {
    id: 1,
    name: 'Buddy the Bear',
    price: 89.99,
    originalPrice: 119.99,
    image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600&q=80',
    rating: 4.8,
    reviews: 124,
    category: 'Toys',
    discount: 25,
    badge: 'Popular',
    brand: 'AI Toys Co.',
    ageRange: 'Ages 3-7',
    features: ['AI-Powered', 'Safe Materials', 'Interactive', 'Educational'],
    description: 'An interactive AI-powered teddy bear that provides companionship and educational entertainment for children. With advanced voice recognition and emotional intelligence, Buddy can engage in meaningful conversations and adapt to your child\'s personality. The bear comes with safety certifications and uses eco-friendly materials.'
  };

  const handleAddToCart = () => {
    // Handle adding to cart
    console.log('Added to cart:', product.name);
  };

  const handleBuyNow = () => {
    // Handle buy now
    console.log('Buy now:', product.name);
  };

  const handleGoBack = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    } else {
      console.log('Navigation not available');
    }
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantity(prev => Math.max(1, prev - 1));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Button 
            variant="link" 
            size="md" 
            onPress={handleGoBack}
            px="$0"
          >
            <Icon as={ChevronLeft} size="lg" color="$textDark800" />
          </Button>
          
          <Heading size="md" color="$textDark800">{product.name}</Heading>
          
          <Button variant="link" size="md" onPress={() => {}} px="$0">
            <Icon as={Share2} size="md" color="$textDark800" />
          </Button>
        </HStack>

        {/* Product Image */}
        <Box>
          <Image 
            source={{ uri: product.image }} 
            alt={product.name}
            size="full" 
            resizeMode="contain"
            style={{ 
              width: Dimensions.get('window').width, 
              height: Dimensions.get('window').width * 0.8 
            }}
          />
        </Box>

        {/* Product Info */}
        <Box p="$4" borderTopWidth={1} borderTopColor="$borderLight300">
          <HStack justifyContent="space-between" alignItems="center" mb="$3">
            <VStack>
              <HStack alignItems="center" mb="$1">
                <Icon as={Star} size="sm" color="$yellow500" mr="$1" />
                <Text size="sm" fontWeight="$medium" color="$textDark800">{product.rating}</Text>
                <Text size="sm" color="$textDark500" ml="$1">({product.reviews} reviews)</Text>
              </HStack>
              <Text size="sm" color="$textDark500">{product.brand}</Text>
            </VStack>
            
            <VStack alignItems="flex-end">
              <HStack alignItems="center">
                {product.originalPrice && (
                  <Text 
                    size="lg" 
                    fontWeight="$bold" 
                    color="$textDark500" 
                    textDecorationLine="line-through" 
                    mr="$2"
                  >
                    ${product.originalPrice.toFixed(2)}
                  </Text>
                )}
                <Text size="xl" fontWeight="$bold" color="$primary500">
                  ${product.price.toFixed(2)}
                </Text>
              </HStack>
              {product.discount && (
                <Badge bg="$error500" borderRadius="$full" px="$2" py="$1" mt="$1">
                  <BadgeText size="xs" color="$textLight50" fontWeight="$medium">
                    Save {product.discount}%
                  </BadgeText>
                </Badge>
              )}
            </VStack>
          </HStack>

          <Divider my="$3" />

          {/* Age Range and Features */}
          <HStack flexWrap="wrap" mb="$4">
            <Box mr="$3" mb="$2">
              <Badge bg="$primary200" borderRadius="$full" px="$3" py="$1">
                <BadgeText size="xs" color="$textDark800" fontWeight="$medium">
                  {product.ageRange}
                </BadgeText>
              </Badge>
            </Box>
            {product.features.map((feature, index) => (
              <Box key={index} mr="$2" mb="$2">
                <Badge bg="$secondary200" borderRadius="$full" px="$3" py="$1">
                  <BadgeText size="xs" color="$textDark800" fontWeight="$medium">
                    {feature}
                  </BadgeText>
                </Badge>
              </Box>
            ))}
          </HStack>

          <Divider my="$3" />

          {/* Description */}
          <VStack mb="$4">
            <Heading size="sm" mb="$2">Description</Heading>
            <Text size="sm" color="$textDark800" lineHeight="$md">
              {product.description}
            </Text>
          </VStack>

          <Divider my="$3" />

          {/* Features List */}
          <VStack mb="$4">
            <Heading size="sm" mb="$2">Key Features</Heading>
            <VStack space="sm">
              <HStack alignItems="center">
                <Icon as={Truck} size="sm" color="$primary500" mr="$2" />
                <Text size="sm" color="$textDark800">Free shipping on orders over $50</Text>
              </HStack>
              <HStack alignItems="center">
                <Icon as={Shield} size="sm" color="$primary500" mr="$2" />
                <Text size="sm" color="$textDark800">30-day money-back guarantee</Text>
              </HStack>
              <HStack alignItems="center">
                <Icon as={RotateCcw} size="sm" color="$primary500" mr="$2" />
                <Text size="sm" color="$textDark800">Easy returns and exchanges</Text>
              </HStack>
            </VStack>
          </VStack>

          <Divider my="$3" />

          {/* Quantity Selector */}
          <HStack justifyContent="space-between" alignItems="center" mb="$4">
            <HStack alignItems="center" space="md">
              <VStack>
                <Heading size="sm">Quantity</Heading>
                <HStack alignItems="center" mt="$1">
                  <Button variant="outline" size="sm" px="$3" onPress={decrementQuantity}>
                    <ButtonText fontSize="$md" fontWeight="$bold" color="$textDark800">-</ButtonText>
                  </Button>
                  <Box bg="$backgroundLight0" borderWidth={1} borderColor="$borderLight300" px="$4" py="$2">
                    <Text size="sm" fontWeight="$medium" color="$textDark800">{quantity}</Text>
                  </Box>
                  <Button variant="outline" size="sm" px="$3" onPress={incrementQuantity}>
                    <ButtonText fontSize="$md" fontWeight="$bold" color="$textDark800">+</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </HStack>

            <VStack alignItems="flex-end">
              <Text size="sm" color="$textDark500">Total: ${(product.price * quantity).toFixed(2)}</Text>
            </VStack>
          </HStack>
        </Box>
      </ScrollView>

      {/* Action Buttons */}
      <Box p="$4" bg="$backgroundLight0" borderTopWidth={0.5} borderTopColor="$borderLight300">
        <HStack space="md">
          <Button 
            variant="outline" 
            size="lg" 
            flex={1}
            onPress={handleAddToCart}
          >
            <ButtonText color="$textDark800" fontWeight="$medium">Add to Cart</ButtonText>
          </Button>
          <Button 
            variant="solid" 
            size="lg" 
            bg="$primary500" 
            flex={1}
            onPress={handleBuyNow}
          >
            <ButtonText color="$textLight50" fontWeight="$medium">Buy Now</ButtonText>
          </Button>
        </HStack>
      </Box>
    </SafeAreaView>
  );
};

export default ProductDetailScreen;