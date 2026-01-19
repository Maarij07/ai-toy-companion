import { supabase } from '../config/supabase';
import { CartItem } from '../config/supabase';

export class CartService {
  // Add item to cart
  static async addItemToCart(userId: string, productId: string, quantity: number = 1) {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .upsert([
          {
            user_id: userId,
            product_id: productId,
            quantity: quantity,
          }
        ], { onConflict: 'user_id,product_id' })
        .select(`
          *,
          products (*)
        `)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Get user's cart items
  static async getUserCart(userId: string) {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (*)
        `)
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Update item quantity in cart
  static async updateItemQuantity(cartItemId: string, quantity: number) {
    try {
      if (quantity <= 0) {
        return await this.removeItemFromCart(cartItemId);
      }

      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: quantity })
        .eq('id', cartItemId)
        .select(`
          *,
          products (*)
        `)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Remove item from cart
  static async removeItemFromCart(cartItemId: string) {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Clear user's entire cart
  static async clearUserCart(userId: string) {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Get cart item count
  static async getCartItemCount(userId: string) {
    try {
      const { count, error } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      return { data: count || 0, error: null };
    } catch (error: any) {
      return { data: 0, error };
    }
  }

  // Calculate cart totals
  static async calculateCartTotals(userId: string) {
    try {
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select(`
          quantity,
          products (price, original_price)
        `)
        .eq('user_id', userId);

      if (cartError) throw cartError;

      let subtotal = 0;
      let discount = 0;

      cartItems?.forEach((item: any) => {
        const product = item.products;
        if (product) {
          const itemTotal = product.price * item.quantity;
          subtotal += itemTotal;
          
          if (product.original_price && product.original_price > product.price) {
            const itemDiscount = (product.original_price - product.price) * item.quantity;
            discount += itemDiscount;
          }
        }
      });

      const shipping = subtotal > 0 ? 5.99 : 0;
      const total = subtotal + shipping;

      return {
        data: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount: parseFloat(discount.toFixed(2)),
          shipping: parseFloat(shipping.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          itemCount: cartItems?.length || 0
        },
        error: null
      };
    } catch (error: any) {
      return { data: null, error };
    }
  }
}