# Supabase Setup Guide for AI Toy Companion App

## Overview
This guide will walk you through setting up a Supabase backend for the AI Toy Companion application. The database schema is designed to support user authentication, toy configurations, marketplace functionality, and shopping cart features.

## Prerequisites
- A Supabase account (sign up at [supabase.io](https://supabase.io))
- Basic knowledge of SQL
- The AI Toy Companion React Native application

## Step 1: Create a New Supabase Project

1. Go to [supabase.io](https://supabase.io) and sign in to your account
2. Click "New Project"
3. Enter a project name (e.g., "AI Toy Companion")
4. Create a strong password for the database
5. Select your preferred region
6. Click "Create new project"
7. Wait for the database to initialize (this may take a few minutes)

## Step 2: Configure Authentication

1. In your Supabase dashboard, navigate to **Authentication** → **Settings**
2. Configure the following settings:
   - Enable "Email" signups
   - Set up email templates as needed
   - Enable "Secure email change" for enhanced security
3. Navigate to **Authentication** → **Providers**
   - Enable Google OAuth provider
   - Enter your Google Client ID and Secret
   - Add authorized redirect URLs as needed

## Step 3: Set Up Database Schema

1. Go to the **SQL Editor** in your Supabase dashboard
2. Copy the entire content from the `supabase_schema.sql` file provided
3. Paste the SQL code into the editor
4. Click "Run" to execute the script
5. Review any error messages and resolve them if necessary

### Database Schema Overview

The schema includes the following tables:

#### 1. Profiles Table
- Extends Supabase's built-in authentication
- Stores user information (name, email)
- Uses Row Level Security (RLS) to restrict access to own data

#### 2. Toys Table
- Stores AI toy configurations
- Links to users who own the toys
- Contains toy name and custom personality settings
- Supports connection status tracking

#### 3. Toy Owners Table
- Stores information about children who own the toys
- Links to toys table
- Contains owner name and age

#### 4. Toy Interests Table
- Junction table linking toys to their interests
- Uses enum type for standardized interest categories
- Supports multiple interests per toy

#### 5. Products Table
- Stores marketplace inventory
- Includes product details, pricing, and metadata
- Public read access for marketplace browsing

#### 6. Cart Items Table
- Stores user shopping cart contents
- Links users to products they wish to purchase
- Tracks quantities

#### 7. Orders Table (Future Implementation)
- Stores completed purchase orders
- Links to users and contains order details

#### 8. Order Items Table (Future Implementation)
- Stores individual items within orders
- Links orders to specific products

## Step 4: Configure Row Level Security (RLS)

The SQL script enables RLS for all tables. Here's what each policy does:

- **Profiles**: Users can only view and update their own profile
- **Toys**: Users can only manage toys they own
- **Toy Owners**: Users can only manage owners for their own toys
- **Toy Interests**: Users can only manage interests for their own toys
- **Products**: Public can view all products (for marketplace)
- **Cart Items**: Users can only manage their own cart
- **Orders**: Users can only view and manage their own orders

## Step 5: Install Supabase Client in Your React Native App

1. In your AI Toy Companion project directory, run:
```bash
npm install @supabase/supabase-js
```

2. Create a Supabase client configuration file:
```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

3. Add environment variables to your `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 6: Update Application Code

You'll need to update your application code to use Supabase instead of the current mock implementations. Here are examples for key operations:

### User Authentication
```typescript
import { supabase } from '../config/supabase';

// Sign up
const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });
  
  if (error) throw error;
  return data;
};

// Sign in
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
};
```

### Managing Toys
```typescript
import { supabase } from '../config/supabase';

// Create a new toy
const createToy = async (userId: string, toyData: any) => {
  const { data, error } = await supabase
    .from('toys')
    .insert([{
      user_id: userId,
      name: toyData.name,
      custom_personality: toyData.customPersonality,
      connected: true
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Get user's toys
const getUserToys = async (userId: string) => {
  const { data, error } = await supabase
    .from('toys')
    .select(`
      *,
      toy_owners (*),
      toy_interests (interest)
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};
```

### Managing Shopping Cart
```typescript
// Add item to cart
const addToCart = async (userId: string, productId: string, quantity: number = 1) => {
  const { data, error } = await supabase
    .from('cart_items')
    .upsert([
      {
        user_id: userId,
        product_id: productId,
        quantity: quantity
      }
    ], { onConflict: ['user_id', 'product_id'] })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Get user's cart
const getUserCart = async (userId: string) => {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      products (*)
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};
```

## Step 7: Test the Setup

1. Start your React Native application
2. Test user registration and login
3. Test creating and managing toys
4. Verify that marketplace functionality works
5. Test adding items to cart and other e-commerce features

## Security Best Practices

1. **Always use Row Level Security** - The provided schema includes RLS policies, make sure they remain enabled
2. **Validate inputs** - Even with RLS, validate data on the client side before sending to the database
3. **Use stored procedures** - For complex operations, consider creating database functions
4. **Monitor logs** - Regularly check your Supabase logs for unusual activity
5. **Keep anon keys secure** - Never expose your anon key in public repositories

## Troubleshooting

### Common Issues:

1. **Authentication not working**: Ensure your redirect URLs are correctly configured in Supabase auth settings
2. **Database queries failing**: Check that RLS policies are correctly configured and that users have proper permissions
3. **Environment variables not loading**: Make sure your .env variables are prefixed with EXPO_PUBLIC_ for Expo projects

### Debugging Tips:

1. Check the Network tab in your device simulator to see actual API requests
2. Use Supabase's Realtime Logs to monitor database activity
3. Test database queries directly in the SQL Editor before implementing in code

## Scaling Considerations

As your application grows, consider:

1. **Database indexes** - Add indexes to frequently queried columns
2. **Real-time subscriptions** - Use Supabase Realtime for live updates
3. **Edge functions** - Implement server-side logic with Supabase Functions
4. **Storage** - Use Supabase Storage for file uploads like profile pictures

## Conclusion

Your Supabase backend is now configured for the AI Toy Companion app. The database schema supports all the key features of your application including user authentication, toy management, marketplace functionality, and shopping cart features. Remember to regularly backup your database and monitor usage as your application scales.