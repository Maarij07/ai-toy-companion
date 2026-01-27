import { supabase } from '../config/supabase';

console.log('AuthService module loaded, supabase client:', supabase);

// Validate that supabase client is properly initialized
if (!supabase) {
  console.error('Supabase client is not properly initialized. Please check your environment variables.');
}

// Simple test function to verify the module is working
export const testAuthService = () => {
  console.log('AuthService test function called');
  return 'AuthService is working';
};

export class AuthService {
  // Sign up a new user
  static async signUp(email: string, password: string, fullName: string) {
    try {
      console.log('Attempting to sign up user:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('Supabase auth error:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        throw error;
      }
      
      console.log('Auth signup successful, user data:', data.user?.id);
      
      // Profile should be created automatically by the database trigger
      if (data.user) {
        console.log('User signed up, profile should be created by trigger:', data.user.id);
        // Temporarily skip profile creation to test if the trigger is the issue
        console.log('Skipping profile creation for testing');
      } else {
        console.warn('No user data returned from signup');
      }

      return { data, error: null };
    } catch (error: any) {
      console.error('Signup error caught in AuthService:', error);
      return { data: null, error };
    }
  }

  // Sign in existing user
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Sign out current user
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Get current user session
  static async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      
      if (error) throw error;
      return { data: { session }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Listen for auth state changes
  static onAuthStateChange(callback: (event: string, session: any | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Reset password
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'io.supabase.flutterdemo://login-callback', // Update this with your app's deep link URL
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Update user profile
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

  // Get user profile
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
}

// Also export as default for compatibility
export default AuthService;