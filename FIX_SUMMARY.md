# Signup Error Fix - Summary of Changes

## 🎯 Problem
Users getting error during signup: **"AuthApi Error: Database error saving new user"**

## 🔧 Root Causes Found & Fixed

### Root Cause #1: Missing RLS INSERT Policy ❌
**Status:** ✅ FIXED in `supabase/migrations/20260303_fix_signup_rls.sql`

The `profiles` table didn't allow users to INSERT their own records due to RLS policies.

```sql
-- ❌ BEFORE: No INSERT policy existed
-- This caused 42501 (permission denied) error

-- ✅ AFTER: Added INSERT policy
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### Root Cause #2: Unreliable Profile Creation ❌
**Status:** ✅ FIXED in both trigger and signup logic

```sql
-- ❌ BEFORE: Trigger with no error handling or fallback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If this failed, profile was never created
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ AFTER: Improved trigger with error handling and ON CONFLICT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User');
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Root Cause #3: No Retry Logic ❌
**Status:** ✅ FIXED in `src/services/AuthServiceManual.ts`

```typescript
// ❌ BEFORE: Just wait 2 seconds, then try to insert
await new Promise(resolve => setTimeout(resolve, 2000));
const { error: profileError } = await supabase
  .from('profiles')
  .insert([{ id: authData.user.id, email, full_name: fullName }]);

// ✅ AFTER: Retry logic with smart error handling
let profileExists = false;
let retryCount = 0;
const maxRetries = 10;

while (!profileExists && retryCount < maxRetries) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();
  
  if (profileData) {
    profileExists = true; // ✓ Profile created by trigger
  }
  retryCount++;
}

// Only try manual insert if trigger failed
if (!profileExists) {
  const { error: profileError } = await supabase
    .from('profiles')
    .insert([{ id: authData.user.id, email, full_name: fullName }]);
}
```

---

## 📋 Files Changed

### 1. `src/services/AuthServiceManual.ts`
**Changes:** Complete refactor of `signUp()` method
- ✅ Now passes `full_name` in auth metadata
- ✅ Added retry logic (waits up to 5 seconds for trigger)
- ✅ Only manually creates profile if trigger fails
- ✅ Better error handling and logging
- ✅ Signup succeeds even if profile creation fails

**Lines affected:** `signUp()` method (entire function refactored)

### 2. `supabase/migrations/20260303_fix_signup_rls.sql` (NEW FILE)
**Changes:** New database migration
- ✅ Adds missing RLS INSERT policy for profiles
- ✅ Adds missing RLS DELETE policy for profiles
- ✅ Replaces trigger function with improved version
- ✅ Better error handling in trigger
- ✅ Handles edge cases with ON CONFLICT

---

## 🧪 How to Apply

### Option 1: Supabase Studio (Fastest)
1. Open Supabase Dashboard → Your Project
2. Go to **SQL Editor**
3. Copy contents of `supabase/migrations/20260303_fix_signup_rls.sql`
4. Paste and click **Run**

### Option 2: Supabase CLI
```bash
supabase db push
```

### Option 3: Copy-paste the SQL directly
See the migration file for the exact SQL commands.

---

## ✅ Verification

After applying the fix:

```
Test Signup Flow:
1. Click "Sign Up" button
2. Enter name, email, password
3. Click "Create Account"

Expected: ✅ No error, redirects to onboarding
Check Supabase:
- New user in auth.users table
- New profile in profiles table with same ID
```

---

## Debugging Tips

### If signup still fails:
1. Check browser console for actual error message
2. Go to Supabase Dashboard → Edge Functions → Logs (if applicable)
3. Check auth.users table for new user (might be created even if signup shows error)
4. Run this in Supabase SQL Editor to verify RLS policies are active:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

### Check trigger execution:
```sql
-- List all triggers on auth.users
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'users';

-- View trigger function code
SELECT pg_get_functiondef('public.handle_new_user'::regprocedure);
```

---

## Timeline
- 🔍 Analyzed: Root causes identified
- 🔧 Fixed: AuthServiceManual.ts updated with retry logic
- 📦 Migration: Database schema fixes created
- ✅ Ready: To deploy and test

