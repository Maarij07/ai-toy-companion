import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
const colors = require('../config/colors');

// Firebase imports
import { getAuth, firestore } from '../config/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { updateDoc, doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import authModule from '@react-native-firebase/auth';

const LoginScreen = ({ onNavigateToSignup, onNavigateToForgotPassword, onNavigateToHome }: { onNavigateToSignup?: () => void; onNavigateToForgotPassword?: () => void; onNavigateToHome?: () => void; }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState({
    email: false,
    password: false,
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleFocus = (field: string) => {
    setIsFocused({
      email: field === 'email',
      password: field === 'password',
    });
  };

  const handleBlur = (field: string) => {
    if (field === 'email' && email && !validateEmail(email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    } else if (field === 'email') {
      setErrors(prev => ({ ...prev, email: '' }));
    }
    
    setIsFocused({
      email: false,
      password: false,
    });
  };

  const handleLogin = async () => {
    let newErrors = {
      email: '',
      password: '',
    };
    let hasError = false;

    // Validate email
    if (!email.trim()) {
      newErrors.email = 'Email is required';
      hasError = true;
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
      hasError = true;
    }

    // Validate password
    if (!password) {
      newErrors.password = 'Password is required';
      hasError = true;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      hasError = true;
    }

    setErrors(newErrors);

    if (!hasError) {
      setIsLoading(true);
      try {
        // Firebase email/password authentication
        const userCredential = await getAuth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Login successful:', user.uid);
        
        // Update last login timestamp in Firestore
        try {
          await updateDoc(doc(firestore, 'users', user.uid), {
            lastLoginAt: new Date(),
          });
        } catch (err) {
          console.warn('Could not update last login timestamp:', err);
        }
        
        // Navigate to home screen after successful login
        if (onNavigateToHome) {
          onNavigateToHome();
        }
      } catch (error: any) {
        console.error('Login error:', error);
        
        // Map Firebase error codes to user-friendly messages
        const errorMessages: { [key: string]: string } = {
          'auth/user-not-found': 'No account found with this email. Please sign up first.',
          'auth/wrong-password': 'Incorrect password. Please try again.',
          'auth/invalid-email': 'Please enter a valid email address.',
          'auth/user-disabled': 'This account has been disabled. Please contact support.',
          'auth/too-many-requests': 'Too many login attempts. Please try again later.',
          'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        };
        
        const friendlyMessage = errorMessages[error.code] || 'Unable to sign in. Please try again.';
        Alert.alert('Sign In Failed', friendlyMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password screen
    if (onNavigateToForgotPassword) {
      onNavigateToForgotPassword();
    }
  };

  const handleSignUp = () => {
    // Navigate to sign up screen
    if (onNavigateToSignup) {
      onNavigateToSignup();
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      
      // Configure Google Sign-In
      await GoogleSignin.configure({
        webClientId: "708825188624-aba1l7jag9b5omnok4mhme8gft97sg7q.apps.googleusercontent.com", // Your actual Google Web Client ID from google-services.json
      });
      
      // Check if Google Play Services is available
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      const userName = response.data?.user?.name;
      const userEmail = response.data?.user?.email;
      const userPhoto = response.data?.user?.photo;
      
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }
      
      // Create Firebase credential using react-native-firebase
      const auth = getAuth();
      const credential = authModule.GoogleAuthProvider.credential(idToken);
      
      // Sign in to Firebase with the Google credential
      const userCredential = await auth.signInWithCredential(credential);
      const firebaseUser = userCredential.user;
      
      console.log('Google login successful:', firebaseUser.uid);
      
      // Check if user exists in Firestore
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // New user - create Firestore document
        await setDoc(userDocRef, {
          name: userName || '',
          email: userEmail || firebaseUser.email || '',
          photoURL: userPhoto || '',
          createdAt: new Date(),
          lastLoginAt: new Date(),
          profileComplete: false,
          authProvider: 'google',
        });
      } else {
        // Existing user - update last login
        await updateDoc(userDocRef, {
          lastLoginAt: new Date(),
        });
      }
      
      // Navigate to home screen after successful login
      if (onNavigateToHome) {
        onNavigateToHome();
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      
      // Map Google error codes to user-friendly messages
      const errorMessages: { [key: string]: string } = {
        '-1': 'Google Sign-In was cancelled.',
        '12500': 'Google Play Services error. Please check your Google Play Services installation.',
        '12501': 'Sign-in cancelled or no credentials available.',
        'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
      };
      
      const friendlyMessage = errorMessages[error.code?.toString()] || 'Unable to sign in with Google. Please try again.';
      Alert.alert('Google Sign In Failed', friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          {/* Header with logo */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../public/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your AI Toy Companion</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  isFocused.email && styles.inputContainerFocused,
                  errors.email ? styles.inputContainerError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => handleFocus('email')}
                  onBlur={() => handleBlur('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  isFocused.password && styles.inputContainerFocused,
                  errors.password ? styles.inputContainerError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => handleFocus('password')}
                  onBlur={() => handleBlur('password')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? 'eye' : 'eye-off'} 
                    size={24} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {/* Sign Up */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleSignUp}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialLoginContainer}>
              <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
                <View style={styles.socialButtonContent}>
                  <Ionicons name="logo-google" size={24} color="#4285F4" style={styles.googleIcon} />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </View>
              </TouchableOpacity>
              
              {/* Apple button only shows on iOS */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialButton}>
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    height: 56,
    borderWidth: 2,
    borderColor: colors.surfaceLight,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: colors.textTertiary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
    marginLeft: 4,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceLight,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  socialLoginContainer: {
    width: '100%',
    alignItems: 'center',
  },
  socialButton: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.surface,
    shadowColor: colors.textTertiary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIcon: {
    marginRight: 12,
  },
});

export default LoginScreen;