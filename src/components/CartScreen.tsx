import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const colors = {
  primary: '#6D8B74',
  accent: '#FFD166',
  pink: '#EF7C8E',
  cream: '#F8F4E9',
  surface: '#FFFFFF',
  textPrimary: '#3C3C3C',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  border: '#E5E5E5',
  background: '#FAFAFA',
};

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
  const [cartItems, setCartItems] = useState<CartItem[]>([
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
  ]);

  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeItem = (id: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
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

  const renderCartItem = (item: CartItem) => (
    <View key={item.id} style={styles.cartItem}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>${item.price.toFixed(2)}</Text>
          {item.originalPrice && (
            <>
              <Text style={styles.originalPrice}>
                ${item.originalPrice.toFixed(2)}
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discount}%</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.quantityRow}>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, item.quantity - 1)}
              activeOpacity={0.7}
            >
              <Icon name="remove" size={14} color={colors.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{item.quantity}</Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, item.quantity + 1)}
              activeOpacity={0.7}
            >
              <Icon name="add" size={14} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeItem(item.id)}
            activeOpacity={0.7}
          >
            <Icon name="trash-outline" size={18} color={colors.pink} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="person-circle-outline" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerCenterContent}>
            <Text style={styles.headerTitle}>My Cart</Text>
          </View>
          
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="notifications-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="cart-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Add some toys to get started!</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="person-circle-outline" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenterContent}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsContainer}>
          {cartItems.map(item => renderCartItem(item))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Savings</Text>
            <Text style={[styles.summaryValue, styles.savingsValue]}>
              -${discount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>${shipping.toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.checkoutContainer}>
        <TouchableOpacity style={styles.checkoutButton} activeOpacity={0.9}>
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
          <View style={styles.checkoutPriceContainer}>
            <Text style={styles.checkoutPrice}>${total.toFixed(2)}</Text>
            <Icon name="arrow-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
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
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerButton: {
    padding: 4,
  },
  headerCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  itemsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.cream,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  discountBadge: {
    backgroundColor: colors.pink + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.pink,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 8,
    padding: 2,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: 14,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  savingsValue: {
    color: colors.pink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  checkoutContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  checkoutButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  checkoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkoutPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default CartScreen;