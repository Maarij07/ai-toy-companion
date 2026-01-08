# Firebase Configuration - Next Steps

## ⚠️ IMPORTANT: Get Your google-services.json File

The app is showing "No Firebase App '[Default]' has been created" because we need the actual `google-services.json` file from your Firebase Console.

### Steps to Get google-services.json:

1. **Go to Firebase Console**
   - Open: https://console.firebase.google.com
   - Select your project: **aitoycompanion**

2. **Download Android Configuration**
   - Click the **Settings gear icon** (⚙️) → Project settings
   - Click **Your apps** tab
   - Find your Android app (if not listed, click "Add app")
   - Click the **Android app**
   - Scroll down to "Download google-services.json"
   - Click **Download**

3. **Place the File**
   - The downloaded `google-services.json` should go here:
   ```
   AI_Toy_Companion/android/app/google-services.json
   ```

4. **Rebuild the App**
   - Run: `npx react-native run-android`

---

## What You'll Find in google-services.json

The file contains:
- Project ID: `aitoycompanion`
- API Keys
- Client IDs for your Android app
- Package name: `com.example.aitoycompanion`

## Current Status

✅ Updated android/build.gradle with Google Services plugin
✅ Updated android/app/build.gradle to apply Google Services plugin
✅ Added placeholder google-services.json (needs to be replaced with actual file)
✅ Firebase imports in place
✅ Auth state listener ready

## Next Commands

```bash
# After downloading google-services.json, run:
npx react-native run-android

# Or if you have gradle cached issues:
cd android
./gradlew clean
cd ..
npx react-native run-android
```

