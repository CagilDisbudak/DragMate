import { useEffect, useState } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    runTransaction,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { db, firebaseEnabled } from '../lib/firebase';

export interface GameRoom {
    fen: string;
    whitePlayer: string;
    blackPlayer: string;
    turn: 'w' | 'b';
    lastMove?: any;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useGameRoom = (roomId: string | null) => {
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    // Firebase auth: anonymous sign-in
    useEffect(() => {
        const auth = getAuth();
        signInAnonymously(auth)
            .then((cred) => {
                setUserId(cred.user.uid);
            })
            .catch((err) => {
                console.error('Auth failed', err);
            })
            .finally(() => setIsAuthLoading(false));
    }, []);

    // Subscribe to room changes
    useEffect(() => {
        if (!firebaseEnabled || !db) {
            console.warn('Firebase not configured; room sync disabled.');
            setLoading(false);
            return;
        }

        if (!roomId) {
            setRoom(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const roomRef = doc(collection(db, 'rooms'), roomId);
        const unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setRoom(snapshot.data() as GameRoom);
                } else {
                    setRoom(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Room subscription error', error);
                setRoom(null);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [roomId]);

    const createRoom = async () => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');
        if (!userId) throw new Error('User not ready yet');

        const id = generateRoomId();
        const roomRef = doc(collection(db, 'rooms'), id);

        await setDoc(roomRef, {
            fen: START_FEN,
            whitePlayer: userId,
            blackPlayer: '',
            turn: 'w',
        });

        return id;
    };

    const joinRoom = async (id: string) => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');
        if (!userId) throw new Error('User not ready yet');

        const roomRef = doc(collection(db, 'rooms'), id);

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) {
                throw new Error('Room not found');
            }

            const data = snap.data() as GameRoom;
            const nextData = { ...data };

            if (!nextData.whitePlayer) {
                nextData.whitePlayer = userId;
            } else if (!nextData.blackPlayer && nextData.whitePlayer !== userId) {
                nextData.blackPlayer = userId;
            }

            transaction.update(roomRef, nextData);
        });
    };

    const updateMove = async (fen: string) => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const turn = fen.split(' ')[1] as 'w' | 'b';
        const roomRef = doc(collection(db, 'rooms'), roomId);
        await updateDoc(roomRef, { fen, turn });
    };

    return { room, userId, loading, isAuthLoading, createRoom, joinRoom, updateMove };
};
