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
        console.error('Auth signup error:', error);
        throw error;
      }
      
      if (!data.user) {
        throw new Error('User not created');
      }
      
      console.log('Auth user created successfully:', data.user.id);
      
      // Try to create profile
      try {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email ?? email,
          full_name: fullName,
        });
        console.log('Profile created successfully');
      } catch (profileError) {
        console.error('Error creating profile:', profileError);
        // Don't fail signup if profile creation fails
      }

      return { data, error: null };
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
}

export default AuthServiceManual;