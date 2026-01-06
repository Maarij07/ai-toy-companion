import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TextInput,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const colors = {
  primary: '#6D8B74',
  secondary: '#FFD166',
  pink: '#EF7C8E',
  cream: '#F8F4E9',
  surface: '#FFFFFF',
  textPrimary: '#3C3C3C',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  border: '#E5E5E5',
  background: '#FAFAFA',
  error: '#EF7C8E',
};

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
  
  const searchInputScale = useRef(new Animated.Value(1)).current;
  const tabScrollRef = useRef<ScrollView>(null);
  
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

  const handleSearchFocus = () => {
    Animated.spring(searchInputScale, {
      toValue: 1.01,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchBlur = () => {
    Animated.spring(searchInputScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getBadgeColor = (badge: string | null) => {
    if (!badge) return colors.primary;
    switch (badge) {
      case 'New':
        return colors.secondary;
      case 'Popular':
        return colors.primary;
      case 'Sale':
        return colors.pink;
      default:
        return colors.primary;
    }
  };

  const renderCard = ({ item }: { item: Product }) => {
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => {
          if (onNavigateToProductDetail) {
            onNavigateToProductDetail(item);
          } else if (navigation) {
            navigation.navigate('ProductDetail', { product: item });
          }
        }}
      >
        <View style={styles.cardImageContainer}>
          <Image 
            source={{ uri: item.image }} 
            style={styles.cardImage}
          />
          {item.badge && (
            <View style={[styles.badge, { backgroundColor: getBadgeColor(item.badge) }]}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
          {item.discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{item.discount}%</Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.brandText} numberOfLines={1}>{item.brand}</Text>
          
          <View style={styles.ratingRow}>
            <Icon name="star" size={12} color={colors.secondary} />
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.reviewsText}>({item.reviews})</Text>
          </View>
          
          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>${item.price.toFixed(2)}</Text>
              {item.originalPrice && (
                <Text style={styles.originalPrice}>${item.originalPrice.toFixed(2)}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="person-circle-outline" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Marketplace</Text>
        
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Animated.View 
          style={[styles.searchInputContainer, { transform: [{ scale: searchInputScale }] }]}
        >
          <Icon name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search toys, accessories..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {showClearButton && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Category Tabs */}
      <ScrollView 
        ref={tabScrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
        </Text>
        <TouchableOpacity style={styles.filterButton}>
          <Icon name="options-outline" size={16} color={colors.primary} />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Products Grid */}
      <FlatList
        data={filteredItems}
        renderItem={renderCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerButton: {
    padding: 4,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.pink,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.surface,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 10,
    paddingVertical: 0,
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.surface,
    fontWeight: '600',
  },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resultsText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: colors.cream,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.pink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  cardBody: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 17,
  },
  brandText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 4,
    fontWeight: '600',
  },
  reviewsText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 11,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default MarketplaceScreen;