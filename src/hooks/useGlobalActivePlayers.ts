import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { signInAnonymously, type Auth, type User } from 'firebase/auth';
import { auth, db, firebaseEnabled } from '../lib/firebase';

const ACTIVE_WINDOW_MS = 30_000;

type PresenceState = {
  count: number | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  isSupported: boolean;
};

async function ensureAnonymousUser(authInstance: Auth | null): Promise<User | null> {
  if (!authInstance) return null;

  if (authInstance.currentUser) {
    return authInstance.currentUser;
  }

  const cred = await signInAnonymously(authInstance);
  return cred.user ?? null;
}

async function touchPresence(presenceDb: Firestore, user: User) {
  const presenceRef = doc(presenceDb, 'presence', user.uid);
  await setDoc(
    presenceRef,
    {
      lastSeen: new Date(),
      status: 'online',
    },
    { merge: true }
  );
}

export function useGlobalActivePlayers(): PresenceState {
  const [state, setState] = useState<PresenceState>({
    count: null,
    loading: true,
    error: null,
    isOnline: false,
    isSupported: firebaseEnabled && !!db && !!auth,
  });

  useEffect(() => {
    if (!firebaseEnabled || !db || !auth) {
      // Firebase not configured – stay in demo mode
      setState((prev) => ({
        ...prev,
        loading: false,
        isSupported: false,
      }));
      return;
    }

    let cancelled = false;
    let presenceInterval: number | null = null;
    let unsubscribeSnapshot: (() => void) | null = null;

    const initPresence = async () => {
      try {
        const user = await ensureAnonymousUser(auth);
        if (!user || cancelled) return;

        // Initial presence write
        await touchPresence(db, user);

        setState((prev) => ({
          ...prev,
          isOnline: true,
          isSupported: true,
        }));

        // Refresh presence periodically to mark this user as active
        presenceInterval = window.setInterval(() => {
          touchPresence(db, user).catch((err) => {
            console.error('Failed to update presence', err);
          });
        }, ACTIVE_WINDOW_MS / 2);

        // Listen for all users active in the last ACTIVE_WINDOW_MS
        const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
        const presenceQuery = query(
          collection(db, 'presence'),
          where('lastSeen', '>=', cutoff)
        );

        unsubscribeSnapshot = onSnapshot(
          presenceQuery,
          (snapshot) => {
            if (cancelled) return;
            setState((prev) => ({
              ...prev,
              count: snapshot.size,
              loading: false,
              error: null,
            }));
          },
          (error) => {
            console.error('Presence subscription error', error);
            if (cancelled) return;
            setState((prev) => ({
              ...prev,
              loading: false,
              error: error.message ?? 'Failed to subscribe to presence',
            }));
          }
        );
      } catch (error: any) {
        console.error('Presence initialization failed', error);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message ?? 'Presence initialization failed',
          isSupported: false,
        }));
      }
    };

    void initPresence();

    return () => {
      cancelled = true;
      if (presenceInterval !== null) {
        window.clearInterval(presenceInterval);
      }
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  return state;
}


