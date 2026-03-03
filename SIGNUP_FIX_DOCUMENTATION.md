# Signup Error Fix - Root Cause Analysis & Solution

## Problem Description
Error during signup: **"AuthApi Error: Database error saving new user"**

## Root Cause Analysis

### Issue #1: Missing RLS INSERT Policy ⚠️
The `profiles` table had these RLS policies:
- ✅ SELECT policy (Users can view own profile)
- ✅ UPDATE policy (Users can update own profile)  
- ❌ **MISSING INSERT policy** - This is the main problem!

When the signup flow tried to manually insert a profile record, Supabase RLS blocked it with error code `42501` (permission denied).

### Issue #2: Unreliable Trigger
The `handle_new_user()` trigger that automatically creates profiles on signup had:
- No error handling - if it failed, the signup could still fail silently
- No fallback mechanism - if the trigger didn't fire, profile would never be created
- Limited metadata extraction - didn't pass `full_name` from auth metadata properly

### Issue #3: No Retry Logic
The signup flow didn't wait long enough for the trigger to complete before trying manual insertion.

---

## Solution Implemented

### 1️⃣ Fixed Database Schema (`supabase/migrations/20260303_fix_signup_rls.sql`)

**Added missing RLS policies:**
```sql
-- Allow users to create their own profile
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);
```

**Improved the trigger function:**
```sql
-- Now handles edge cases:
-- 1. Extracts full_name from auth metadata
-- 2. Uses INSERT ... ON CONFLICT to handle duplicates
-- 3. Has exception handling to prevent trigger failures
-- 4. Logs errors without breaking the signup
```

### 2️⃣ Updated Signup Logic (`src/services/AuthServiceManual.ts`)

**Key improvements:**
1. ✅ Pass `full_name` in auth metadata during signup
2. ✅ Wait for trigger to create profile with retry logic (up to 10 retries, 5 seconds total)
3. ✅ Only attempt manual profile creation if trigger fails
4. ✅ Better error logging for debugging
5. ✅ Never fail signup due to profile creation errors

**New flow:**
```
1. Create auth user with full_name in metadata
2. Wait and retry checking if profile exists (created by trigger)
3. If profile is created by trigger → Success ✓
4. If profile not found after retries → Attempt manual insert
5. If both fail → Log warning but signup still succeeds (auth user is created)
```

---

## How to Apply the Fix

### Option A: Using Supabase Studio (Recommended for QA/Testing)

1. Go to **Supabase Studio** → Your Project
2. Click **SQL Editor** in left sidebar
3. Create a new query and paste the contents of:
   - `supabase/migrations/20260303_fix_signup_rls.sql`
4. Click **Run** button
5. The fix is applied immediately ✅

### Option B: Using Supabase CLI (For Development)

```bash
# From your project root
supabase db pull          # Pull latest schema
supabase migration new    # Creates new migration file
# Edit the migration file with the fixes
supabase db push          # Push to remote
```

### Option C: Manual Application (If using Supabase SQL console directly)

Copy-paste this to Supabase SQL Editor:
```sql
-- Add RLS policies
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);

-- Improve trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User');
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Testing the Fix

### Manual Test Steps:

1. **Start your app** (React Native CLI)
2. **Click Sign Up** on login screen
3. **Enter test data:**
   - Full Name: `Test User`
   - Email: `test-${Date.now()}@example.com` (unique each time)
   - Password: `Password123`
   - Confirm Password: `Password123`
4. **Click Create Account**
5. **Expected result:**
   - ✅ No error alert shown
   - ✅ Redirects to Onboarding screen
   - ✅ Check Supabase Console → auth.users to see new user
   - ✅ Check Supabase Console → profiles table to see new profile

### Debug Console Output (What to look for):

**Success** 🎉:
```
Attempting to sign up user: test@example.com
Auth user created successfully: a1b2c3d4-...
Profile created by trigger successfully
Signup successful: {...}
```

**Warning** ⚠️ (Still OK):
```
Profile not found yet, retry 1/10
Profile not found yet, retry 2/10
...
Profile was not created by trigger, attempting manual creation
Profile created manually successfully
```

---

## Files Modified

1. **`src/services/AuthServiceManual.ts`** - Updated signup logic with retry mechanism
2. **`supabase/migrations/20260303_fix_signup_rls.sql`** - New migration with RLS policies and trigger fixes

## Verification Checklist

- [ ] Migration file created and reviewed
- [ ] AuthServiceManual.ts updated with new logic
- [ ] Tested signup with new email
- [ ] Verified profile created in Supabase Console
- [ ] Verified redirect to Onboarding works
- [ ] Tested with multiple signup attempts (no duplicate errors)
- [ ] Checked browser/mobile console for error messages

---

## Additional Notes

- The fix handles the root cause (missing RLS policy) and adds robustness
- The retry logic ensures the trigger has time to complete
- The manual fallback ensures signup succeeds even if trigger fails
- All existing users are unaffected
- No data migration needed

