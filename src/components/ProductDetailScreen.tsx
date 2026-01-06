import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  rating: number;
  reviews: number;
  category: string;
  discount?: number;
  badge?: string;
  brand: string;
  ageRange: string;
  features: string[];
  description: string;
  details?: {
    material?: string;
    dimensions?: string;
    weight?: string;
    battery?: string;
    connectivity?: string;
  };
}

const mockProduct: Product = {
  id: 1,
  name: 'Buddy the Bear',
  price: 89.99,
  originalPrice: 119.99,
  image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80',
  images: [
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1534367507877-0edd93bd013b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1585404900546-9cbc53e6e7f4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80'
  ],
  rating: 4.8,
  reviews: 124,
  category: 'Toys',
  discount: 25,
  badge: 'Popular',
  brand: 'AI Toys Co.',
  ageRange: 'Ages 3-7',
  features: ['AI-Powered', 'Safe Materials', 'Educational'],
  description: 'Buddy the Bear is an interactive AI-powered toy that provides companionship and educational entertainment for children. With advanced voice recognition and emotional intelligence, Buddy can engage in meaningful conversations and adapt to your child\'s personality.',
  details: {
    material: 'BPA-Free Plastic, Organic Cotton',
    dimensions: '12" × 8" × 6"',
    weight: '0.8 kg',
    battery: 'Rechargeable 2000mAh, 8h playtime',
    connectivity: 'Bluetooth 5.0, Wi-Fi Enabled'
  }
};

const ProductDetailScreen = ({ route, navigation, onGoBack, product: propProduct }: any) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  
  const imageScrollViewRef = useRef<ScrollView>(null);
  
  const product: Product = propProduct || route?.params?.product || mockProduct;

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => quantity > 1 && setQuantity(prev => prev - 1);

  const addToCart = () => {
    console.log(`Added ${quantity} of ${product.name} to cart`);
  };

  return (
    <View style={styles.container}>
      {/* Minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onGoBack}>
          <Icon name="arrow-back" size={22} color="#3C3C3C" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Section */}
        <View style={styles.imageSection}>
          <ScrollView
            ref={imageScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const contentOffsetX = event.nativeEvent.contentOffset.x;
              const currentIndex = Math.round(contentOffsetX / width);
              setSelectedImageIndex(currentIndex);
            }}
            scrollEventThrottle={16}
          >
            {(product.images && product.images.length > 0 ? product.images : [product.image]).map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          
          {product.badge && (
            <View style={[styles.badge, { 
              backgroundColor: product.badge === 'New' ? '#EF7C8E' : 
                             product.badge === 'Popular' ? '#6D8B74' : '#FFD166' 
            }]}
            >
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
          
          {/* Image Dots Indicator */}
          <View style={styles.dotsContainer}>
            {(product.images && product.images.length > 0 ? product.images : [product.image]).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dot, selectedImageIndex === i && styles.activeDot]}
                onPress={() => {
                  setSelectedImageIndex(i);
                  imageScrollViewRef.current?.scrollTo({
                    x: i * width,
                    animated: true,
                  });
                }}
              />
            ))}
          </View>
        </View>

        {/* Product Info Card */}
        <View style={styles.infoCard}>
          {/* Title & Brand */}
          <View style={styles.titleSection}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.brandText}>{product.brand}</Text>
          </View>

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {[...Array(5)].map((_, i) => (
                <Icon 
                  key={i} 
                  name={i < Math.floor(product.rating) ? "star" : "star-outline"} 
                  size={14} 
                  color="#FFD166" 
                />
              ))}
            </View>
            <Text style={styles.ratingValue}>{product.rating}</Text>
            <Text style={styles.reviewCount}>({product.reviews})</Text>
          </View>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.currentPrice}>${product.price}</Text>
              {product.originalPrice && (
                <>
                  <Text style={styles.originalPrice}>${product.originalPrice}</Text>
                  {product.discount && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{product.discount}%</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            <Text style={styles.ageRange}>{product.ageRange}</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresRow}>
            {product.features.map((feature, index) => (
              <View key={index} style={styles.featureChip}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsSection}>
          {['Description', 'Reviews', 'Details'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab.toLowerCase() && styles.activeTab]}
              onPress={() => setActiveTab(tab.toLowerCase())}
            >
              <Text style={[
                styles.tabLabel,
                activeTab === tab.toLowerCase() && styles.activeTabLabel
              ]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.contentSection}>
          {activeTab === 'description' && (
            <Text style={styles.description}>{product.description}</Text>
          )}

          {activeTab === 'reviews' && (
            <View style={styles.reviewsList}>
              {[
                { user: 'Sarah M.', rating: 5, date: 'Oct 15, 2023', 
                  comment: 'My child absolutely loves this toy! It\'s educational and entertaining.' },
                { user: 'John D.', rating: 4, date: 'Sep 22, 2023', 
                  comment: 'Great quality and very interactive. The AI features work really well.' },
                { user: 'Emma R.', rating: 5, date: 'Oct 5, 2023', 
                  comment: 'Perfect for bedtime stories and learning activities. Highly recommend!' }
              ].map((review, idx) => (
                <View key={idx} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewUser}>{review.user}</Text>
                    <View style={styles.reviewStars}>
                      {[...Array(5)].map((_, i) => (
                        <Icon 
                          key={i} 
                          name={i < review.rating ? "star" : "star-outline"} 
                          size={12} 
                          color="#FFD166" 
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                  <Text style={styles.reviewText}>{review.comment}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'details' && (
            <View style={styles.detailsList}>
              {Object.entries(product.details || {}).map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailKey}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        {/* Quantity Selector */}
        <View style={styles.quantitySection}>
          <TouchableOpacity 
            style={[styles.quantityBtn, quantity <= 1 && styles.quantityBtnDisabled]} 
            onPress={decrementQuantity}
            disabled={quantity <= 1}
          >
            <Icon name="remove" size={18} color={quantity > 1 ? "#3C3C3C" : "#B0B0B0"} />
          </TouchableOpacity>
          
          <Text style={styles.quantityValue}>{quantity}</Text>
          
          <TouchableOpacity style={styles.quantityBtn} onPress={incrementQuantity}>
            <Icon name="add" size={18} color="#3C3C3C" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.wishlistBtn}>
            <Icon name="heart-outline" size={22} color="#3C3C3C" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addToCartBtn} onPress={addToCart}>
            <Text style={styles.addToCartLabel}>Add to Cart</Text>
            <Text style={styles.cartPrice}>${(product.price * quantity).toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F4E9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Image Section
  imageSection: {
    position: 'relative',
    backgroundColor: '#F8F4E9',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroImage: {
    width: width,
    height: width * 0.95,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeDot: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },

  // Info Card
  infoCard: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  titleSection: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#3C3C3C',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  brandText: {
    fontSize: 15,
    color: '#6D8B74',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginRight: 6,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C3C',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 14,
    color: '#888888',
  },
  priceSection: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3C3C3C',
    marginRight: 10,
  },
  originalPrice: {
    fontSize: 20,
    color: '#B0B0B0',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF7C8E',
  },
  ageRange: {
    fontSize: 14,
    color: '#888888',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    backgroundColor: '#F8F4E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 13,
    color: '#3C3C3C',
    fontWeight: '500',
  },

  // Tabs
  tabsSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 20,
  },
  tab: {
    marginRight: 32,
    paddingBottom: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6D8B74',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888888',
  },
  activeTabLabel: {
    color: '#3C3C3C',
    fontWeight: '600',
  },

  // Content Section
  contentSection: {
    paddingHorizontal: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#555555',
  },
  reviewsList: {
    gap: 20,
  },
  reviewItem: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewUser: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C3C3C',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555555',
  },
  detailsList: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailKey: {
    fontSize: 15,
    color: '#888888',
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    color: '#3C3C3C',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  bottomSpacer: {
    height: 80,
  },

  // Action Bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 20,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F4E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBtnDisabled: {
    opacity: 0.5,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3C3C3C',
    minWidth: 30,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wishlistBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F8F4E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6D8B74',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  addToCartLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cartPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ProductDetailScreen;