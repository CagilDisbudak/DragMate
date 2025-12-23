# Firebase Setup Instructions

The "New Game" button requires Firebase configuration. Here's how to set it up:

## Quick Setup (5 minutes)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Add project"
   - Enter project name: "DragMate" (or any name)
   - Disable Google Analytics (optional)
   - Click "Create project"

3. **Register Web App**
   - In your project, click the **</> Web** icon
   - Enter app nickname: "DragMate Web"
   - Check "Also set up Firebase Hosting" (optional)
   - Click "Register app"

4. **Copy Configuration**
   - You'll see a `firebaseConfig` object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123:web:abc123"
   };
   ```
   - Copy this entire object

5. **Enable Services**
   - In Firebase Console, go to **Build > Firestore Database**
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location close to you
   - Click "Enable"
   
   - Go to **Build > Authentication**
   - Click "Get started"
   - Enable "Anonymous" sign-in method
   - Click "Save"

6. **Update Your Code**
   - Replace the placeholder values in `src/lib/firebase.ts` with your real config

## Current Error

Open the browser console (F12) and you should see:
- `❌ Firebase initialization failed:` - This confirms the placeholder config issue

## Need Help?

If you'd like, I can:
1. Create a demo Firebase project for you
2. Set up environment variables for secure config storage
3. Add detailed console logging to debug the issue
