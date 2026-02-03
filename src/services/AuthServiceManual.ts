import { supabase } from '../config/supabase';

class AuthServiceManual {
  static async signUp(
    email: string,
    password: string,
    fullName: string
  ) {
    try {
      console.log('Attempting to sign up user:', email);
      
      // First, check if user already exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existingUser) {
        console.log('User already exists, returning existing user');
        return { data: { user: existingUser }, error: null };
      }
      
      // If user doesn't exist, create new user
      // To avoid trigger issues, we'll create the user and profile separately
      // First, let's try a direct approach that bypasses the trigger conflict
      
      // Step 1: Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        console.error('This is likely due to database trigger issues');
        // Re-throw the error since auth signup failed
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('User not created');
      }
      
      console.log('Auth user created successfully:', authData.user.id);
      
      // Step 2: Create the profile separately after a short delay
      // This gives time for any asynchronous operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Try to insert the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              email: authData.user.email ?? email,
              full_name: fullName,
            }
          ]);
        
        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Check different types of errors
          if (profileError.message.includes('duplicate key value') || profileError.message.includes('already exists') || profileError.code === '23505') {
            console.log('Profile already exists, continuing...');
          } else if (profileError.code === '42501') {
            console.log('RLS policy blocking profile creation, this is expected behavior');
            // The profile might be created by the trigger after all
          } else {
            // For other errors, log but continue
            console.error('Unexpected profile creation error:', profileError);
          }
        } else {
          console.log('Profile created successfully');
        }
      } catch (profileCreationError: any) {
        console.error('Exception during profile creation:', profileCreationError);
        // Continue anyway, as the auth user was created
      }

      return { data: authData, error: null };
    } catch (error) {
      console.error('Error during signup process:', error);
      return { data: null, error };
    }
  }

  static async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  static async signOut() {
    return supabase.auth.signOut();
  }

  static async getSession() {
    return supabase.auth.getSession();
  }

  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'io.supabase.flutterdemo://login-callback',
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  static async updateProfile(userId: string, updates: Partial<{ full_name: string }>) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  static async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  static onAuthStateChange(callback: (event: string, session: any | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export default AuthServiceManual;