import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';

// For React Native Firebase, initialization happens automatically via native configuration
// No need to manually call initializeApp() - it uses google-services.json (Android) 
// and GoogleService-Info.plist (iOS) files

// Export the services
export { auth, firestore };

// Helper function to get auth instance (preferred method)
export const getAuth = () => auth();

// Export default app instance
export default firebase;