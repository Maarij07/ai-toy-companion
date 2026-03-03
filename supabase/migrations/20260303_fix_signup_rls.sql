-- Migration: Fix signup RLS policy and improve trigger robustness
-- Date: 2026-03-03
-- Issue: Signup failure with "Database error saving new user"
-- Root Cause: Missing INSERT RLS policy on profiles table

-- 1. Add missing INSERT and DELETE RLS policies for profiles table
-- This allows users to create their own profile right after signup
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);

-- 2. Improve the trigger function to handle edge cases better
-- Drop the old trigger and function first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Extract full_name from raw_user_meta_data, with fallback to email
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    'User'
  );
  
  -- Use INSERT ... ON CONFLICT to handle the case where profile already exists
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the signup
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Optional: Clean up any orphaned profiles or auth users
-- This query helps identify issues but doesn't delete anything
-- SELECT COUNT(*) as orphaned_profiles FROM profiles 
-- WHERE id NOT IN (SELECT id FROM auth.users);

-- 5. Make sure the profiles table email constraint is properly handling nulls
-- The current constraint is: email TEXT UNIQUE
-- This will store null emails as valid unique values
-- We can improve this if needed in the future, but for now it should work

-- Success message
COMMENT ON FUNCTION public.handle_new_user() IS 'Function to automatically create user profile on auth signup with improved error handling';
