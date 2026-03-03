import { supabase } from '../config/supabase';

class AuthServiceManual {
  static async signUp(
    email: string,
    password: string,
    fullName: string
  ) {
    try {
      console.log('Attempting to sign up user:', email);
      
      // Step 1: Create the auth user with full_name in metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('User not created');
      }
      
      console.log('Auth user created successfully:', authData.user.id);
      
      // Step 2: Wait for the trigger to create the profile
      // The trigger should fire automatically when a new auth.users record is created
      let profileExists = false;
      let retryCount = 0;
      const maxRetries = 10;
      
      while (!profileExists && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          const { data: profileData, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id)
            .single();
          
          if (profileData) {
            console.log('Profile created by trigger successfully');
            profileExists = true;
          } else if (checkError && checkError.code === 'PGRST116') {
            // Profile not found yet, will retry
            console.log(`Profile not found yet, retry ${retryCount + 1}/${maxRetries}`);
            retryCount++;
          } else if (checkError) {
            console.error('Error checking profile:', checkError);
            retryCount++;
          }
        } catch (checkError) {
          console.error('Exception checking profile:', checkError);
          retryCount++;
        }
      }
      
      if (!profileExists) {
        console.warn('Profile was not created by trigger, attempting manual creation');
        
        // Only try manual creation if trigger failed
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              email: authData.user.email,
              full_name: fullName,
            }
          ]);
        
        if (profileError) {
          console.error('Manual profile creation error:', profileError);
          // Warn but don't fail - profile creation error shouldn't prevent successful auth signup
          console.warn('Could not create profile, but user was successfully created in auth');
        } else {
          console.log('Profile created manually successfully');
        }
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