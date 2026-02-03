-- Supabase Database Schema for AI Toy Companion App

-- 1. Profiles Table (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Toys Table
CREATE TABLE toys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  custom_personality TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connected BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS for toys
ALTER TABLE toys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own toys" ON toys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own toys" ON toys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own toys" ON toys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own toys" ON toys FOR DELETE USING (auth.uid() = user_id);

-- 3. Toy Owners Table
CREATE TABLE toy_owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  toy_id UUID REFERENCES toys(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for toy owners
ALTER TABLE toy_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view toy owners for their toys" ON toy_owners FOR SELECT
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));
CREATE POLICY "Users can insert toy owners for their toys" ON toy_owners FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));
CREATE POLICY "Users can delete toy owners for their toys" ON toy_owners FOR DELETE
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));

-- 4. Interest Categories Type and Junction Table
CREATE TYPE interest_category AS ENUM (
  'Creative Arts', 
  'Science & Tech', 
  'Sports & Games', 
  'Music & Dance', 
  'Reading & Stories', 
  'Animals & Nature', 
  'Cooking & Food', 
  'Building & Making'
);

CREATE TABLE toy_interests (
  toy_id UUID REFERENCES toys(id) ON DELETE CASCADE,
  interest interest_category,
  PRIMARY KEY (toy_id, interest)
);

-- Enable RLS for toy interests
ALTER TABLE toy_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view interests for their toys" ON toy_interests FOR SELECT
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));
CREATE POLICY "Users can insert interests for their toys" ON toy_interests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));
CREATE POLICY "Users can delete interests for their toys" ON toy_interests FOR DELETE
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));

-- 5. Products Table (for Marketplace)
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  image_url TEXT,
  rating DECIMAL(2, 1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  category TEXT NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  badge TEXT,
  brand TEXT,
  age_range TEXT,
  features TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for products (public read, admin write)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view products" ON products FOR SELECT USING (TRUE);

-- 6. Shopping Cart Table
CREATE TABLE cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)  -- Prevent duplicate items in cart
);

-- Enable RLS for cart items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cart items" ON cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cart items" ON cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cart items" ON cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cart items" ON cart_items FOR DELETE USING (auth.uid() = user_id);

-- 7. Orders Table (for future implementation)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  shipping_address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Order Items Table (for future implementation)
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

-- Enable RLS for order items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view order items for their orders" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));

-- 9. Database Functions for updated_at timestamps
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Extract full_name from raw_user_meta_data, with fallback to email
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Attach the trigger to tables that need updated_at
CREATE TRIGGER handle_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_toys_updated_at 
  BEFORE UPDATE ON toys 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 10. LLM Interactions Table
CREATE TABLE llm_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for LLM interactions
ALTER TABLE llm_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own LLM interactions" ON llm_interactions FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can insert own LLM interactions" ON llm_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 11. TTS Requests Table
CREATE TABLE tts_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  voice_id TEXT,
  project_id TEXT,
  audio_url TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for TTS requests
ALTER TABLE tts_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own TTS requests" ON tts_requests FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can insert own TTS requests" ON tts_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 12. Insert sample data for products
INSERT INTO products (name, description, price, original_price, image_url, rating, review_count, category, discount_percent, badge, brand, age_range, features) VALUES
('Buddy the Bear', 'An interactive AI-powered teddy bear that provides companionship and educational entertainment for children. With advanced voice recognition and emotional intelligence, Buddy can engage in meaningful conversations and adapt to your child''s personality.', 89.99, 119.99, 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80', 4.8, 124, 'Toys', 25, 'Popular', 'AI Toys Co.', 'Ages 3-7', ARRAY['AI-Powered', 'Safe Materials']),
('Smart Elephant', 'A wise and interactive elephant toy that teaches children about animals, nature, and conservation. Features touch sensors, voice recognition, and multiple educational games.', 69.99, 89.99, 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80', 4.6, 89, 'Toys', 22, 'Sale', 'Smart Toys', 'Ages 4-8', ARRAY['AI-Powered', 'Educational']),
('Dino Explorer', 'An exciting dinosaur companion that brings prehistoric times to life. Features sound effects, movement sensors, and facts about different dinosaur species.', 79.99, 99.99, 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80', 4.9, 156, 'Educational', 20, 'New', 'Dino Toys', 'Ages 5-10', ARRAY['Educational', 'Safe Materials']),
('Robot Friend', 'A programmable robot companion that teaches children basic coding concepts while providing entertainment. Features LED lights, movement capabilities, and voice interaction.', 109.99, 139.99, 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80', 4.7, 203, 'Electronics', 21, 'Popular', 'Tech Toys', 'Ages 6-12', ARRAY['AI-Powered', 'Educational']),
('Space Buddy', 'A space-themed AI toy that teaches children about astronomy, planets, and space exploration. Features constellation projection and interactive space missions.', 99.99, 129.99, 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80', 4.5, 78, 'Educational', 23, 'Sale', 'Space Toys', 'Ages 4-9', ARRAY['Educational', 'AI-Powered']),
('Ocean Friend', 'A friendly sea creature toy that teaches children about marine life and ocean conservation. Features water-resistant design and underwater sound effects.', 84.99, 104.99, 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80', 4.8, 142, 'Toys', 19, 'New', 'Ocean Toys', 'Ages 3-8', ARRAY['Safe Materials', 'Educational']),
('Adventure Kit', 'A complete adventure set including compass, magnifying glass, and explorer tools. Perfect for outdoor adventures and nature exploration activities.', 59.99, NULL, 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=400&q=80', 4.6, 92, 'Accessories', 0, NULL, 'Adventure Toys', 'Ages 5-10', ARRAY['Safe Materials', 'Durable']),
('Learning Blocks', 'Colorful educational blocks that help children learn shapes, colors, numbers, and letters. Features textured surfaces for sensory development and creative building.', 49.99, 59.99, 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80', 4.7, 167, 'Educational', 17, 'Popular', 'Learning Toys', 'Ages 2-6', ARRAY['Educational', 'Safe Materials']);