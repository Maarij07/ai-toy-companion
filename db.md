# Database Usage Documentation

## Previous Firebase Usage (Now Removed)

The application previously used Firebase Firestore for:

### 1. `src/components/SignupScreen.tsx`
- Creating new user profiles in Firestore
- Storing user data: name, email, createdAt, profileComplete status

### 2. `src/components/LoginScreen.tsx`
- Updating user login timestamps
- Retrieving user document for verification

### 3. `src/components/SetupScreen.tsx`
- Storing toy setup information
- Managing user's toy data and preferences

### 4. `src/components/SettingsScreen.tsx`
- Authentication sign-out functionality

### 5. `App.tsx`
- Authentication state management

## Current Status

All Firebase dependencies and code have been removed from the application.
The app now runs without any backend database, relying on local state management only.

## Migration Notes

- All database operations have been replaced with local state simulation
- Authentication now uses mock implementations
- Data persistence is temporarily disabled
- All Firebase-related packages have been removed from package.json
- Android build configurations have been updated to remove Firebase dependencies