import React, { useState, useRef } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView as RNScrollView
} from 'react-native';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Image,
  Input,
  InputField,
  InputIcon,
  Pressable,
  Heading,
  Icon,
  Divider,
  Card,
  Avatar,
  Badge,
  BadgeText,
  Spinner
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  Search, 
  Filter,
  Star,
  Heart,
  X,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react-native';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  discount: number;
  badge: string | null;
  brand: string;
  ageRange: string;
  features: string[];
  description?: string;
}

interface MarketplaceScreenProps {
  navigation?: any;
  onNavigateToProductDetail?: (product: Product) => void;
}

const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ navigation, onNavigateToProductDetail }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearButton, setShowClearButton] = useState(false);
  
  const marketplaceItems: Product[] = [
    {
      id: 1,
      name: 'Buddy the Bear',
      price: 89.99,
      originalPrice: 119.99,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      rating: 4.8,
      reviews: 124,
      category: 'Toys',
      discount: 25,
      badge: 'Popular',
      brand: 'AI Toys Co.',
      ageRange: 'Ages 3-7',
      features: ['AI-Powered', 'Safe Materials'],
      description: 'An interactive AI-powered teddy bear that provides companionship and educational entertainment for children. With advanced voice recognition and emotional intelligence, Buddy can engage in meaningful conversations and adapt to your child\'s personality.',
    },
    {
      id: 2,
      name: 'Smart Elephant',
      price: 69.99,
      originalPrice: 89.99,
      image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
      rating: 4.6,
      reviews: 89,
      category: 'Toys',
      discount: 22,
      badge: 'Sale',
      brand: 'Smart Toys',
      ageRange: 'Ages 4-8',
      features: ['AI-Powered', 'Educational'],
      description: 'A wise and interactive elephant toy that teaches children about animals, nature, and conservation. Features touch sensors, voice recognition, and multiple educational games.',
    },
    {
      id: 3,
      name: 'Dino Explorer',
      price: 79.99,
      originalPrice: 99.99,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      rating: 4.9,
      reviews: 156,
      category: 'Educational',
      discount: 20,
      badge: 'New',
      brand: 'Dino Toys',
      ageRange: 'Ages 5-10',
      features: ['Educational', 'Safe Materials'],
      description: 'An exciting dinosaur companion that brings prehistoric times to life. Features sound effects, movement sensors, and facts about different dinosaur species.',
    },
    {
      id: 4,
      name: 'Robot Friend',
      price: 109.99,
      originalPrice: 139.99,
      image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
      rating: 4.7,
      reviews: 203,
      category: 'Electronics',
      discount: 21,
      badge: 'Popular',
      brand: 'Tech Toys',
      ageRange: 'Ages 6-12',
      features: ['AI-Powered', 'Educational'],
      description: 'A programmable robot companion that teaches children basic coding concepts while providing entertainment. Features LED lights, movement capabilities, and voice interaction.',
    },
    {
      id: 5,
      name: 'Space Buddy',
      price: 99.99,
      originalPrice: 129.99,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      rating: 4.5,
      reviews: 78,
      category: 'Educational',
      discount: 23,
      badge: 'Sale',
      brand: 'Space Toys',
      ageRange: 'Ages 4-9',
      features: ['Educational', 'AI-Powered'],
      description: 'A space-themed AI toy that teaches children about astronomy, planets, and space exploration. Features constellation projection and interactive space missions.',
    },
    {
      id: 6,
      name: 'Ocean Friend',
      price: 84.99,
      originalPrice: 104.99,
      image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
      rating: 4.8,
      reviews: 142,
      category: 'Toys',
      discount: 19,
      badge: 'New',
      brand: 'Ocean Toys',
      ageRange: 'Ages 3-8',
      features: ['Safe Materials', 'Educational'],
      description: 'A friendly sea creature toy that teaches children about marine life and ocean conservation. Features water-resistant design and underwater sound effects.',
    },
    {
      id: 7,
      name: 'Adventure Kit',
      price: 59.99,
      originalPrice: null,
      image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80',
      rating: 4.6,
      reviews: 92,
      category: 'Accessories',
      discount: 0,
      badge: null,
      brand: 'Adventure Toys',
      ageRange: 'Ages 5-10',
      features: ['Safe Materials', 'Durable'],
      description: 'A complete adventure set including compass, magnifying glass, and explorer tools. Perfect for outdoor adventures and nature exploration activities.',
    },
    {
      id: 8,
      name: 'Learning Blocks',
      price: 49.99,
      originalPrice: 59.99,
      image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
      rating: 4.7,
      reviews: 167,
      category: 'Educational',
      discount: 17,
      badge: 'Popular',
      brand: 'Learning Toys',
      ageRange: 'Ages 2-6',
      features: ['Educational', 'Safe Materials'],
      description: 'Colorful educational blocks that help children learn shapes, colors, numbers, and letters. Features textured surfaces for sensory development and creative building.',
    },
  ];

  const tabs = [
    { id: 'All', label: 'All' },
    { id: 'Toys', label: 'Toys' },
    { id: 'Accessories', label: 'Accessories' },
    { id: 'Electronics', label: 'Electronics' },
    { id: 'Educational', label: 'Educational' },
  ];

  const filteredItems = marketplaceItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || item.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowClearButton(text.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowClearButton(false);
  };

  // Header and filter components to be rendered in the FlatList
  const ListHeaderComponent = () => (
    <>
      {/* Search Bar */}
      <Box p="$4">
        <Input variant="outline" size="lg" borderRadius="$lg" borderWidth="$1" borderColor="$borderLight400" bg="$backgroundLight0">
          <InputField 
            placeholder="Search toys, accessories..."
            placeholderTextColor="$textDark800" 
            value={searchQuery}
            onChangeText={handleSearchChange}
            py="$3.5"
            pl="$10"
            pr="$6"
          />
          <InputIcon as={Search} position="absolute" left="$3" top="$3.5" size="sm" color="$textDark800" />
          {showClearButton && (
            <Pressable position="absolute" right="$4" top="$3.5" onPress={clearSearch}>
              <Icon as={X} size="sm" color="$textDark800" />
            </Pressable>
          )}
        </Input>
      </Box>
      
      {/* Category Tabs */}
      <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <HStack space="md">
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
            >
              <Box 
                bg={activeTab === tab.id ? '$primary500' : '$backgroundLight0'} 
                borderRadius="$full" 
                px="$4" 
                py="$2"
                borderWidth={activeTab === tab.id ? 0 : 1}
                borderColor={activeTab === tab.id ? 'transparent' : '$borderLight300'}
              >
                <Text 
                  color={activeTab === tab.id ? '$textLight50' : '$textDark800'} 
                  fontWeight={activeTab === tab.id ? '$bold' : '$normal'}
                >
                  {tab.label}
                </Text>
              </Box>
            </Pressable>
          ))}
        </HStack>
      </RNScrollView>
      
      {/* Results Count */}
      <HStack justifyContent="space-between" alignItems="center" px="$4" pt="$4" pb="$3">
        <Text size="sm" color="$textDark500">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
        </Text>
      </HStack>
    </>
  );

  const renderProductCard = ({ item }: { item: Product }) => {
    return (
      <Pressable 
        onPress={() => {
          if (onNavigateToProductDetail) {
            onNavigateToProductDetail(item);
          } else if (navigation) {
            navigation.navigate('ProductDetail', { product: item });
          }
        }}
        m="$2"
        flex={1}
        maxWidth="48%"
      >
        <Card borderRadius="$lg" borderWidth={0.5} borderColor="$borderLight300" overflow="hidden">
          <Box position="relative">
            <Image 
              source={{ uri: item.image }} 
              alt={item.name}
              size="full" 
              resizeMode="cover"
              style={{ width: '100%', height: 100 }}
            />
          </Box>
          
          <Box p="$2">
            <Heading size="sm" numberOfLines={2} mb="$1" color="$textDark800">{item.name}</Heading>
            <HStack alignItems="center" mb="$1">
              <Text size="xs" color="$textDark500" flex={1}>{item.brand}</Text>
              <HStack alignItems="center">
                <Icon as={Star} size="xs" color="$yellow500" mr="$1" />
                <Text size="xs" fontWeight="$medium" color="$textDark800">{item.rating}</Text>
              </HStack>
            </HStack>
            
            <Text size="md" fontWeight="$bold" color="$primary500" mb="$1">${item.price.toFixed(2)}</Text>
            
            <Button 
              variant="solid" 
              size="sm" 
              bg="$primary500"
              borderRadius="$full"
              alignSelf="center"
              onPress={() => {
                if (onNavigateToProductDetail) {
                  onNavigateToProductDetail(item);
                } else if (navigation) {
                  navigation.navigate('ProductDetail', { product: item });
                }
              }}
            >
              <ButtonText size="xs" color="$textLight50" fontWeight="$medium">View Details</ButtonText>
              <Icon as={ChevronRight} size="xs" color="$textLight50" ml="$1" />
            </Button>
          </Box>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Pressable p="$2">
            <Icon as={User} size="xl" color="$textDark800" />
          </Pressable>
          
          <Heading size="md" color="$textDark800">Marketplace</Heading>
          
          <Pressable p="$2">
            <Icon as={Bell} size="lg" color="$textDark800" />
          </Pressable>
        </HStack>
        
        {/* Products FlatList with header components */}
        <FlatList
          data={filteredItems}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <VStack flex={1} justifyContent="center" alignItems="center" py="$10">
              <Icon as={Search} size="2xl" color="$textDark300" mb="$4" />
              <Heading size="md" color="$textDark800" mb="$2">No items found</Heading>
              <Text size="sm" color="$textDark500" textAlign="center">Try adjusting your search or filters</Text>
            </VStack>
          }
        />
      </VStack>
    </SafeAreaView>
  );
};

export default MarketplaceScreen;