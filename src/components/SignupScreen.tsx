import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TermsModal from './TermsModal';
import PrivacyModal from './PrivacyModal';
const colors = require('../config/colors');

const SignupScreen = ({ onNavigateToLogin, onNavigateToOnboarding }: { onNavigateToLogin?: () => void; onNavigateToOnboarding?: () => void; }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFocused, setIsFocused] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleFocus = (field: string) => {
    setIsFocused({
      name: field === 'name',
      email: field === 'email',
      password: field === 'password',
      confirmPassword: field === 'confirmPassword',
    });
  };

  const handleBlur = () => {
    setIsFocused({
      name: false,
      email: false,
      password: false,
      confirmPassword: false,
    });
  };

  const handleSignup = () => {
    let newErrors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    };
    let hasError = false;

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
      hasError = true;
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      hasError = true;
    }

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
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 chars with uppercase, lowercase, and number';
      hasError = true;
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      hasError = true;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    setErrors(newErrors);

    if (!hasError) {
      setIsLoading(true);
      // Simulate API call to Firebase
      setTimeout(() => {
        setIsLoading(false);
        // In a real app, navigate to onboarding screen after successful signup
        if (onNavigateToOnboarding) {
          onNavigateToOnboarding();
        }
      }, 1500);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.innerContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Join AI Toy Companion to get started
                </Text>
              </View>

              {/* Form */}
              <View style={styles.formContainer}>
                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      isFocused.name && styles.inputContainerFocused,
                      errors.name ? styles.inputContainerError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your full name"
                      placeholderTextColor={colors.textTertiary}
                      onFocus={() => handleFocus('name')}
                      onBlur={handleBlur}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                </View>

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
                      onBlur={handleBlur}
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
                      onBlur={handleBlur}
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

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      isFocused.confirmPassword && styles.inputContainerFocused,
                      errors.confirmPassword ? styles.inputContainerError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your password"
                      placeholderTextColor={colors.textTertiary}
                      onFocus={() => handleFocus('confirmPassword')}
                      onBlur={handleBlur}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons 
                        name={showConfirmPassword ? 'eye' : 'eye-off'} 
                        size={24} 
                        color={colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                </View>

                {/* Signup Button */}
                <TouchableOpacity 
                  style={[styles.signupButton, isLoading && styles.signupButtonDisabled]} 
                  onPress={handleSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <View style={styles.loadingSpinner} />
                      <Text style={styles.signupButtonText}>Creating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.signupButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                {/* Terms and Conditions */}
                <View style={styles.termsContainer}>
                  <Text style={styles.termsText}>
                    By creating an account, you agree to our{' '}
                  </Text>
                  <TouchableOpacity onPress={() => setShowTermsModal(true)}>
                    <Text style={styles.termsLink}>Terms of Service</Text>
                  </TouchableOpacity>
                  <Text style={styles.termsText}> and </Text>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(true)}>
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
                
                <TermsModal 
                  visible={showTermsModal} 
                  onClose={() => setShowTermsModal(false)} 
                />
                <PrivacyModal 
                  visible={showPrivacyModal} 
                  onClose={() => setShowPrivacyModal(false)} 
                />

                {/* Back to Login */}
                <View style={styles.backToLoginContainer}>
                  <Text style={styles.backToLoginText}>Already have an account? </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (onNavigateToLogin) {
                        onNavigateToLogin();
                      }
                    }}
                  >
                    <Text style={styles.backToLoginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Login Buttons */}
                <View style={styles.socialLoginContainerVerticalPadding}>
                  <View style={styles.socialLoginContainer}>
                    <TouchableOpacity style={styles.socialButton}>
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
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 24,
    zIndex: 1,
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
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
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
    paddingRight: 40, // Make space for eye icon
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },

  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
    marginLeft: 4,
  },
  signupButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textLight,
    marginRight: 10,
    opacity: 0.8,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  termsText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  termsLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  backToLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  backToLoginLink: {
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  socialLoginContainerPadding: {
    paddingBottom: 40,
  },
  socialContainerWithPadding: {
    paddingHorizontal: 24,
  },
  socialLoginContainerVerticalPadding: {
    paddingBottom: 40,
  },
});

export default SignupScreen;