interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  description?: string;
  receipt_email?: string;
}

interface PaymentIntentResponse {
  client_secret: string;
  id: string;
  status: string;
}

/*
 * PaymentService
 * 
 * This service handles payment operations in the application.
 * All sensitive payment operations are handled server-side via Supabase Edge Functions
 * to protect payment information and Stripe secrets.
 */

class PaymentService {
  // Base URL for Supabase Edge Functions
  static SUPABASE_FUNCTIONS_BASE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
  
  /**
   * Creates a payment intent with Stripe via Supabase Edge Function
   */
  static async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResponse> {
    try {
      // Call Supabase Edge Function to create payment intent
      const response = await fetch(`${this.SUPABASE_FUNCTIONS_BASE_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseAuthToken()}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payment intent: ${response.statusText}. Details: ${errorText}`);
      }
      
      const result = await response.json();
      
      // Return the payment intent data from Supabase Edge Function
      return {
        client_secret: result.client_secret,
        id: result.id,
        status: result.status
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Gets Supabase authentication token for API calls
   */
  static async getSupabaseAuthToken(): Promise<string> {
    // In a real app, this would get the user's Supabase session token
    // This would typically involve importing supabase from '../config/supabase' and getting the session
    const { data: { session } } = await (await import('../config/supabase')).supabase.auth.getSession();
    return session?.access_token || '';
  }

  /**
   * Confirm a payment intent after collecting payment details
   * Note: Payment confirmation happens via Supabase Edge Function
   */
  static async confirmPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      // Call Supabase Edge Function to confirm the payment
      const response = await fetch(`${this.SUPABASE_FUNCTIONS_BASE_URL}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseAuthToken()}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to confirm payment: ${response.statusText}. Details: ${errorText}`);
      }
      
      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw error;
    }
  }

  /**
   * Process a refund for an order via Supabase Edge Function
   */
  static async processRefund(
    paymentIntentId: string, 
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other'
  ): Promise<any> {
    try {
      const response = await fetch(`${this.SUPABASE_FUNCTIONS_BASE_URL}/process-refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseAuthToken()}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          reason: reason
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to process refund: ${response.statusText}. Details: ${errorText}`);
      }
      
      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Check if a payment is eligible for refund based on the refund policy
   */
  static isEligibleForRefund(
    orderDate: Date, 
    productType: 'physical' | 'digital',
    currentDate: Date = new Date()
  ): boolean {
    const timeDiff = currentDate.getTime() - orderDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    if (productType === 'physical') {
      // 30-day money back guarantee for physical toys
      return daysDiff <= 30;
    } else if (productType === 'digital') {
      // 5-day refund policy for digital goods
      return daysDiff <= 5;
    }

    return false;
  }
}

export default PaymentService;