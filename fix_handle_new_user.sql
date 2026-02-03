-- Fix the handle_new_user function to properly handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Extract full_name from raw_user_meta_data, with fallback to email
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'New User');
  
  -- Insert the profile with error handling
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, user_full_name);
  EXCEPTION
    WHEN unique_violation THEN
      -- Profile already exists, ignore the error
      RAISE NOTICE 'Profile already exists for user %', NEW.id;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();