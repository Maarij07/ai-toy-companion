/**
 * FirebaseErrorService
 * Provides human-readable error messages for Firebase authentication errors
 */

interface ErrorMapping {
  [key: string]: string;
}

const AUTH_ERROR_MAPPINGS: ErrorMapping = {
  // Email/password related errors
  'auth/user-not-found': 'No account found with this email. Please sign up first.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
  'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
  'auth/wrong-credentials': 'Wrong credentials. Please try again.',
  
  // User-related errors
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-token-expired': 'Session expired. Please sign in again.',
  'auth/account-exists-with-different-credential': 'An account with this email already exists with a different sign-in method.',
  
  // Network related errors
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  
  // Phone related errors
  'auth/invalid-phone-number': 'Please enter a valid phone number.',
  'auth/missing-phone-number': 'Phone number is required.',
  
  // General errors
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
  'auth/weak-password': 'Password is too weak. Please use a stronger password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/captcha-check-failed': 'Captcha verification failed. Please try again.',
  'auth/invalid-verification-code': 'Invalid verification code. Please try again.',
  'auth/invalid-verification-id': 'Verification ID is invalid. Please try again.',
  
  // Google sign-in related errors
  'auth/google-sign-in-error': 'Unable to sign in with Google. Please try again.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
  'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
  
  // Additional common errors
  'auth/app-deleted': 'Application has been deleted. Please restart the app.',
  'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication.',
  'auth/argument-error': 'Invalid argument provided to authentication method.',
  'auth/invalid-api-key': 'API key is invalid.',
  'auth/invalid-user-token': 'User token is invalid. Please sign in again.',
  'auth/requires-recent-login': 'Please sign in again to perform this operation.',
  'auth/unauthorized-domain': 'Domain is not authorized for OAuth operations.',
  'auth/user-mismatch': 'Account does not match the current user.',
  'auth/user-signed-out': 'User is signed out. Please sign in again.',
  'auth/timeout': 'Request timed out. Please try again.',
};

const PROVIDER_ERROR_MAPPINGS: ErrorMapping = {
  // Google sign-in specific errors
  '-1': 'Google Sign-In was cancelled.',
  '12500': 'Google Play Services error. Please check your Google Play Services installation.',
  '12501': 'Sign-in cancelled or no credentials available.',
  '12502': 'Google Sign-In requires Google Play Services.',
  'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
};

/**
 * Maps Firebase error codes to human-readable messages
 */
export const getErrorMessage = (errorCode: string, provider?: 'auth' | 'google'): string => {
  // Check provider-specific mappings first if provider is specified
  if (provider === 'google') {
    const providerMessage = PROVIDER_ERROR_MAPPINGS[errorCode];
    if (providerMessage) {
      return providerMessage;
    }
  }
  
  // Check general auth error mappings
  const authMessage = AUTH_ERROR_MAPPINGS[errorCode];
  if (authMessage) {
    return authMessage;
  }
  
  // Default fallback message
  return 'Unable to complete the operation. Please try again.';
};

/**
 * Processes a Firebase error object and returns a human-readable message
 */
export const processFirebaseError = (error: any): string => {
  // Handle different error formats
  if (typeof error === 'string') {
    return getErrorMessage(error);
  }
  
  if (error && typeof error === 'object') {
    // Check for error code in various possible locations
    let errorCode = error.code || error.errorCode || error.message;
    const errorMessage = error.message || error.errorMessage;
    
    // Handle case where error message contains the error code
    if (!errorCode && errorMessage && typeof errorMessage === 'string' && errorMessage.includes('auth/')) {
      errorCode = errorMessage.split(':')[0].trim();
    }
    
    if (errorCode) {
      // If error code contains 'auth/', treat as auth error
      if (typeof errorCode === 'string' && errorCode.includes('auth/')) {
        return getErrorMessage(errorCode, 'auth');
      }
      
      // Check if it's a provider-specific error
      if (errorMessage && typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('google')) {
        return getErrorMessage(errorCode, 'google');
      }
      
      return getErrorMessage(errorCode);
    }
    
    // If no code found but message exists, try to extract meaningful info
    if (errorMessage && typeof errorMessage === 'string') {
      // Check if the message contains any known error patterns
      if (errorMessage.toLowerCase().includes('wrong') || errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('invalid')) {
        return 'Invalid credentials. Please check your email and password.';
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
        return 'Network error. Please check your connection and try again.';
      } else {
        return 'An error occurred. Please try again.';
      }
    }
  }
  
  // Fallback
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Gets a specific error message for a given error code
 */
export const getAuthErrorMessage = (errorCode: string): string => {
  return getErrorMessage(errorCode, 'auth');
};

/**
 * Gets a specific error message for a Google sign-in error
 */
export const getGoogleSignInErrorMessage = (errorCode: string): string => {
  return getErrorMessage(errorCode, 'google');
};