import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase initialization
 *
 * This file is used for optional real-time features (like global active players).
 * If Firebase is not configured, the app gracefully falls back to demo/local mode.
 *
 * To enable Firebase, either:
 * - Provide Vite env variables (recommended):
 *   - VITE_FIREBASE_API_KEY
 *   - VITE_FIREBASE_AUTH_DOMAIN
 *   - VITE_FIREBASE_PROJECT_ID
 *   - VITE_FIREBASE_STORAGE_BUCKET
 *   - VITE_FIREBASE_MESSAGING_SENDER_ID
 *   - VITE_FIREBASE_APP_ID
 *
 * Or:
 * - Replace firebaseConfig below with your literal config object from Firebase Console.
 */

const firebaseConfig = {
  apiKey: 'AIzaSyB3ncjSdbTdaUqac5QvHon-Id5mCo3pByM',
  authDomain: 'dragmate-af04d.firebaseapp.com',
  projectId: 'dragmate-af04d',
  storageBucket: 'dragmate-af04d.firebasestorage.app',
  messagingSenderId: '370425129874',
  appId: '1:370425129874:web:4c5c526a593e8fa45a6f4b',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseEnabled = false;

try {
  const hasAllConfigValues = Object.values(firebaseConfig).every(Boolean);

  if (hasAllConfigValues) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    firebaseEnabled = true;
    console.log('✅ Firebase initialized for DragMate');
  } else {
    console.warn(
      '🎮 DEMO MODE: Firebase env vars missing. Global features will run in local/demo mode only.'
    );
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

export { db, auth, firebaseEnabled };
