import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types for our database schema
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Toy {
  id: string;
  user_id: string;
  name: string;
  custom_personality: string | null;
  created_at: string;
  updated_at: string;
  connected: boolean;
  is_active: boolean;
}

export interface ToyOwner {
  id: string;
  toy_id: string;
  name: string;
  age: number;
  created_at: string;
}

export interface ToyInterest {
  toy_id: string;
  interest: 'Creative Arts' | 'Science & Tech' | 'Sports & Games' | 'Music & Dance' | 'Reading & Stories' | 'Animals & Nature' | 'Cooking & Food' | 'Building & Making';
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  rating: number;
  review_count: number;
  category: string;
  discount_percent: number;
  badge: string | null;
  brand: string | null;
  age_range: string | null;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  added_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: any; // JSONB type
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}