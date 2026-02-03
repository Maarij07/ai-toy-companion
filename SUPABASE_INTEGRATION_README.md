Understanding the ProblemThe "database error saving new user" with unexpected_failure typically occurs when:

The trigger function fails during execution
RLS policies block the trigger from inserting data
There's a constraint violation in the profiles table
The trigger doesn't have proper permissions
Step-by-Step SolutionStep 1: Check Supabase Dashboard LogsFirst, let's see the actual error:
Go to your Supabase Dashboard
Navigate to Database → Functions → handle_new_user
Or go to Logs → Postgres Logs
Look for errors around the time you tried to sign up
Step 2: Fix the Database SchemaHere's the corrected schema with proper permissions and error handling
-- =============================================================================

-- SUPABASE DATABASE SCHEMA - FIXED VERSION

-- =============================================================================



-- Drop existing trigger and function if they exist

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;



-- =============================================================================

-- PROFILES TABLE

-- =============================================================================



-- Create profiles table (if not exists)

CREATE TABLE IF NOT EXISTS public.profiles (

  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

  full_name TEXT,

  avatar_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL

);



-- Enable Row Level Security

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;



-- =============================================================================

-- RLS POLICIES

-- =============================================================================



-- Drop existing policies

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;



-- Policy: Anyone can view profiles

CREATE POLICY "Public profiles are viewable by everyone"

  ON public.profiles

  FOR SELECT

  USING (true);



-- Policy: Users can insert their own profile

CREATE POLICY "Users can insert their own profile"

  ON public.profiles

  FOR INSERT

  WITH CHECK (auth.uid() = id);



-- Policy: Users can update their own profile

CREATE POLICY "Users can update their own profile"

  ON public.profiles

  FOR UPDATE

  USING (auth.uid() = id)

  WITH CHECK (auth.uid() = id);



-- =============================================================================

-- TRIGGER FUNCTION

-- =============================================================================



-- Create function to handle new user creation

CREATE OR REPLACE FUNCTION public.handle_new_user()

RETURNS TRIGGER

SECURITY DEFINER -- This is critical - allows function to bypass RLS

SET search_path = public

LANGUAGE plpgsql

AS $$

BEGIN

  -- Insert new profile with error handling

  INSERT INTO public.profiles (id, full_name, created_at, updated_at)

  VALUES (

    NEW.id,

    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),

    NOW(),

    NOW()

  );

  

  RETURN NEW;

EXCEPTION

  WHEN OTHERS THEN

    -- Log the error but don't fail the signup

    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;

    RETURN NEW;

END;

$$;



-- =============================================================================

-- TRIGGER

-- =============================================================================



-- Create trigger on auth.users

CREATE TRIGGER on_auth_user_created

  AFTER INSERT ON auth.users

  FOR EACH ROW

  EXECUTE FUNCTION public.handle_new_user();



-- =============================================================================

-- GRANTS

-- =============================================================================



-- Grant necessary permissions

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON public.profiles TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.profiles TO anon;



-- =============================================================================

-- INDEXES

-- =============================================================================



-- Create indexes for better performance

CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);



-- =============================================================================

-- COMMENTS

-- =============================================================================



COMMENT ON TABLE public.profiles IS 'User profile information';

COMMENT ON COLUMN public.profiles.id IS 'References auth.users.id';

COMMENT ON COLUMN public.profiles.full_name IS 'User full name from signup';

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile when user signs up';

Step 3: Key Changes Explained
The critical fixes in the schema:

SECURITY DEFINER - This is the most important fix! It allows the trigger function to bypass RLS policies
Error handling - Wrapped insert in EXCEPTION block so signup doesn't fail if profile creation has issues
Proper grants - Ensures the function has permission to insert into profiles
COALESCE - Handles cases where full_name might be missing

Step 4: Apply the Fixed Schema
bash# Copy the SQL content and run it in Supabase SQL Editor
# OR if using Supabase CLI:
supabase db reset  # Warning: This drops all data!

# Or apply just the migration:
# Copy the content of supabase_schema_fixed.sql
# Paste into Supabase Dashboard → SQL Editor → New query
# Run the query
Step 5: Update AuthService (Keep it Simple)
// src/services/AuthService.ts

import { supabase } from '../config/supabase';

import { User, Session } from '@supabase/supabase-js';



export interface AuthResponse {

  user: User | null;

  session: Session | null;

  error: Error | null;

}



class AuthService {

  /**

   * Sign up a new user

   * Profile will be created automatically by database trigger

   */

  static async signUp(

    email: string, 

    password: string, 

    fullName: string

  ): Promise<AuthResponse> {

    try {

      console.log('[AuthService] Starting signup for:', email);

      

      const { data, error } = await supabase.auth.signUp({

        email,

        password,

        options: {

          data: {

            full_name: fullName, // This goes into raw_user_meta_data

          },

        },

      });



      if (error) {

        console.error('[AuthService] Signup error:', {

          message: error.message,

          status: error.status,

          code: error.code || error.name,

        });

        throw error;

      }



      console.log('[AuthService] Signup successful:', data.user?.id);

      

      // Profile is created automatically by trigger

      // Let's verify it was created (optional, for debugging)

      if (data.user) {

        await this.verifyProfile(data.user.id);

      }



      return {

        user: data.user,

        session: data.session,

        error: null,

      };

    } catch (error: any) {

      console.error('[AuthService] Signup failed:', error);

      return {

        user: null,

        session: null,

        error: error,

      };

    }

  }



  /**

   * Verify profile was created (debugging helper)

   */

  private static async verifyProfile(userId: string): Promise<void> {

    try {

      const { data, error } = await supabase

        .from('profiles')

        .select('*')

        .eq('id', userId)

        .single();



      if (error) {

        console.warn('[AuthService] Profile not found, might be created async:', error);

        return;

      }



      console.log('[AuthService] Profile verified:', data);

    } catch (error) {

      console.warn('[AuthService] Profile verification failed:', error);

    }

  }



  /**

   * Sign in existing user

   */

  static async signIn(email: string, password: string): Promise<AuthResponse> {

    try {

      console.log('[AuthService] Signing in:', email);

      

      const { data, error } = await supabase.auth.signInWithPassword({

        email,

        password,

      });



      if (error) {

        console.error('[AuthService] Sign in error:', error);

        throw error;

      }



      console.log('[AuthService] Sign in successful:', data.user?.id);



      return {

        user: data.user,

        session: data.session,

        error: null,

      };

    } catch (error: any) {

      console.error('[AuthService] Sign in failed:', error);

      return {

        user: null,

        session: null,

        error: error,

      };

    }

  }



  /**

   * Sign out current user

   */

  static async signOut(): Promise<{ error: Error | null }> {

    try {

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      

      console.log('[AuthService] Sign out successful');

      return { error: null };

    } catch (error: any) {

      console.error('[AuthService] Sign out failed:', error);

      return { error };

    }

  }



  /**

   * Get current user

   */

  static async getCurrentUser(): Promise<User | null> {

    try {

      const { data: { user } } = await supabase.auth.getUser();

      return user;

    } catch (error) {

      console.error('[AuthService] Get current user failed:', error);

      return null;

    }

  }



  /**

   * Get current session

   */

  static async getCurrentSession(): Promise<Session | null> {

    try {

      const { data: { session } } = await supabase.auth.getSession();

      return session;

    } catch (error) {

      console.error('[AuthService] Get current session failed:', error);

      return null;

    }

  }



  /**

   * Update user profile

   */

  static async updateProfile(updates: {

    full_name?: string;

    avatar_url?: string;

  }): Promise<{ error: Error | null }> {

    try {

      const user = await this.getCurrentUser();

      if (!user) {

        throw new Error('No user logged in');

      }



      const { error } = await supabase

        .from('profiles')

        .update({

          ...updates,

          updated_at: new Date().toISOString(),

        })

        .eq('id', user.id);



      if (error) throw error;



      console.log('[AuthService] Profile updated');

      return { error: null };

    } catch (error: any) {

      console.error('[AuthService] Update profile failed:', error);

      return { error };

    }

  }



  /**

   * Get user profile

   */

  static async getProfile(userId?: string) {

    try {

      const user = userId || (await this.getCurrentUser())?.id;

      if (!user) {

        throw new Error('No user ID provided');

      }



      const { data, error } = await supabase

        .from('profiles')

        .select('*')

        .eq('id', user)

        .single();



      if (error) throw error;



      return { data, error: null };

    } catch (error: any) {

      console.error('[AuthService] Get profile failed:', error);

      return { data: null, error };

    }

  }



  /**

   * Listen to auth state changes

   */

  static onAuthStateChange(callback: (user: User | null) => void) {

    return supabase.auth.onAuthStateChange((_event, session) => {

      callback(session?.user ?? null);

    });

  }

}



export default AuthService;
Step 6: Debugging Helper Script
Create this script to test the trigger directly:

-- =============================================================================
-- DEBUG SCRIPT - Test Trigger Function
-- Run this in Supabase SQL Editor to test if trigger works
-- =============================================================================

-- 1. Check if trigger function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- Expected: Should show DEFINER security type

-- 2. Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Expected: Should show AFTER INSERT on auth.users

-- 3. Check profiles table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 5. Test the trigger function manually
-- This simulates what happens during signup
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_email TEXT := 'test@example.com';
  test_metadata JSONB := '{"full_name": "Test User"}'::jsonb;
BEGIN
  -- Try to insert a test record
  RAISE NOTICE 'Testing trigger with user ID: %', test_user_id;
  
  -- This simulates the trigger execution
  PERFORM handle_new_user() FROM (
    SELECT 
      test_user_id as id,
      test_email as email,
      test_metadata as raw_user_meta_data
  ) as NEW;
  
  RAISE NOTICE 'Trigger test completed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Trigger test failed: %', SQLERRM;
END $$;

-- 6. Check if any profiles exist
SELECT COUNT(*) as profile_count FROM public.profiles;

-- 7. Check recent auth users (last 10)
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'full_name' as full_name_from_metadata
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check if profiles match auth users
SELECT 
  u.id,
  u.email,
  p.full_name,
  CASE 
    WHEN p.id IS NULL THEN 'MISSING PROFILE'
    ELSE 'Profile exists'
  END as profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- 9. Check function permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'handle_new_user';
Step 7: Alternative Approach (If Trigger Still Fails)
If the trigger approach continues to fail, use this manual profile creation approach:
// src/services/AuthServiceManual.ts
// Use this if database trigger continues to fail

import { supabase } from '../config/supabase';
import { User, Session } from '@supabase/supabase-js';

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

class AuthServiceManual {
  /**
   * Sign up with manual profile creation (bypass trigger)
   */
  static async signUp(
    email: string,
    password: string,
    fullName: string
  ): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Starting signup for:', email);

      // Step 1: Create auth user WITHOUT metadata
      // This avoids trigger issues
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        // Don't include options.data to avoid trigger complications
      });

      if (authError) {
        console.error('[AuthService] Auth signup error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Signup succeeded but no user returned');
      }

      console.log('[AuthService] Auth user created:', authData.user.id);

      // Step 2: Manually create profile
      // Wait a bit to ensure auth.users record is committed
      await new Promise(resolve => setTimeout(resolve, 500));

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('[AuthService] Profile creation error:', profileError);
        // Don't fail signup if profile creation fails
        // User can update profile later
        console.warn('[AuthService] Continuing despite profile error');
      } else {
        console.log('[AuthService] Profile created successfully');
      }

      // Step 3: Also update user metadata for consistency
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName },
        });
        console.log('[AuthService] User metadata updated');
      } catch (metaError) {
        console.warn('[AuthService] Metadata update failed:', metaError);
      }

      return {
        user: authData.user,
        session: authData.session,
        error: null,
      };
    } catch (error: any) {
      console.error('[AuthService] Signup failed:', error);
      return {
        user: null,
        session: null,
        error: error,
      };
    }
  }

  /**
   * Ensure profile exists (call this after any signup)
   */
  static async ensureProfile(userId: string, fullName: string): Promise<void> {
    try {
      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (existing) {
        console.log('[AuthService] Profile already exists');
        return;
      }

      // Create profile if missing
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[AuthService] Failed to create missing profile:', error);
      } else {
        console.log('[AuthService] Missing profile created');
      }
    } catch (error) {
      console.error('[AuthService] ensureProfile failed:', error);
    }
  }

  // ... rest of the methods are same as before (signIn, signOut, etc.)
}

export default AuthServiceManual;
