import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';

// Firebase configuration - replace with your actual values
// You can set these in your .env file and access them via react-native-dotenv
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE", // Add your actual API key here
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // Add your actual authDomain here
  projectId: "YOUR_PROJECT_ID", // Add your actual project ID here
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // Add your actual storage bucket here
  messagingSenderId: "YOUR_SENDER_ID", // Add your actual sender ID here
  appId: "YOUR_APP_ID", // Add your actual app ID here
  measurementId: "G-XXXXXXXXXX", // Add your actual measurement ID here
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export the services
export { auth, firestore };

// Export default app instance
export default firebase;