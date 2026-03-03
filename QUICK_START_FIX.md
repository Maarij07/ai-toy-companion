# Quick Start: Apply Signup Fix in 3 Steps

## The Issue
Signup error: **"AuthApi Error: Database error saving new user"**

## Root Causes
1. ❌ **Missing RLS INSERT policy** on profiles table (blocks user profile creation)
2. ❌ **Unreliable trigger** that creates profiles (no error handling)
3. ❌ **No retry logic** in signup flow

## The Fix (Applied!)

### Step 1: Apply Database Migration
You have 2 options:

**Option A: Supabase Studio** (Easiest - No CLI needed)
```
1. Open https://supabase.com/dashboard
2. Select your project → SQL Editor
3. Click "New Query"
4. Copy all SQL from: supabase/migrations/20260303_fix_signup_rls.sql
5. Click "Run" button
6. ✅ Done! Changes applied immediately
```

**Option B: Supabase CLI**
```bash
supabase db push
```

### Step 2: Code Changes Already Applied ✅
The updated `src/services/AuthServiceManual.ts` now includes:
- ✅ Passes `full_name` in auth metadata during signup
- ✅ Waits for trigger with retry logic (up to 5 seconds)
- ✅ Smart fallback to manual profile creation if needed
- ✅ Better error handling

### Step 3: Test It!
1. **Run your app:**
   ```bash
   npm start
   ```

2. **Try signing up:**
   - Email: `test-${Date.now()}@example.com` (unique)
   - Password: something with numbers (e.g., `Test123`)
   - Click "Create Account"

3. **What to expect:**
   - ✅ No error dialog shown
   - ✅ Redirects to Onboarding screen
   - ✅ Check Supabase Console to see new user & profile created

---

## Need Help?

### "Still getting signup error"
1. Check **browser console** (F12) for the actual error message
2. Go to **Supabase Dashboard → auth.users** - is the user created there?
3. Run in Supabase SQL Editor:
   ```sql
   -- Check if RLS policies are in place
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

### "Got error code 42501"
→ The RLS policy fix wasn't applied. Re-run the migration!

### "User created but profile missing"
→ The trigger has an issue. Check:
   ```sql
   SELECT pg_get_functiondef('public.handle_new_user'::regprocedure);
   ```

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `src/services/AuthServiceManual.ts` | Updated signup logic with retry | ✅ Applied |
| `supabase/migrations/20260303_fix_signup_rls.sql` | New: RLS policies + trigger | ⏳ Apply this! |

---

## Common Questions

**Q: Will this affect existing users?**
A: No! Only new signups use this logic. Existing users are unaffected.

**Q: Do I need to restart my app?**
A: No. The backend (Supabase) changes take effect immediately. Just refresh your app.

**Q: What if signup still fails after applying the fix?**
A: 
1. Check the browser console for the real error
2. Go to Supabase SQL Editor and verify RLS policies exist:
   ```sql
   SELECT tablename, policyname, qual FROM pg_policies WHERE tablename = 'profiles';
   ```
3. If policies don't show up, re-apply the migration

---

## The Complete Fix Explained

**What was happening:**
```
User clicks "Sign Up"
  ↓
App sends email + password + name to Supabase Auth ✅
  ↓
Supabase creates auth.users record ✅
  ↓
Trigger tries to create profiles record ⚠️
  ↓
RLS policy blocks insert (no INSERT policy exists) ❌
  ↓
"Database error saving new user" error shown ❌
  ↓
User can't sign up 😞
```

**What happens after the fix:**
```
User clicks "Sign Up"
  ↓
App sends email + password + name to Supabase Auth ✅
  ↓
Supabase creates auth.users record ✅
  ↓
Trigger creates profiles record (new RLS policy allows it) ✅
  ↓
App waits for profile to be created (with retry logic) ✅
  ↓
Profile is found, signup succeeds ✅
  ↓
User redirected to onboarding 🎉
```

---

## Next Steps
1. ✅ Apply the migration to Supabase
2. ✅ Test signup with a new account
3. ✅ Verify user appears in Supabase Console (both auth.users & profiles tables)
4. ✅ You're done! 🚀
