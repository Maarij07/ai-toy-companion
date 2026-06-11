import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded Supabase credentials
export const supabaseUrl = 'https://etsnyensdpagqfbuxdpe.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0c255ZW5zZHBhZ3FmYnV4ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTM0MTQsImV4cCI6MjA4NTk2OTQxNH0.Z_iK2v6BVqB4tRHNWnIV3kaYjxM4y5UFQis68ad3btw';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
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
