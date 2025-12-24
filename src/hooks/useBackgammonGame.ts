
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
import { type BackgammonState, createBackgammonGame } from '../logic/backgammonLogic';

export interface BackgammonRoom {
    board: number[];
    bar: { white: number; black: number };
    off: { white: number; black: number };
    turn: 'white' | 'black';
    dice: number[];
    movesLeft: number[];
    whitePlayer: string;
    blackPlayer: string;
    winner: 'white' | 'black' | '';
    status: 'active' | 'finished' | 'resigned';
    lastMove?: any;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const useBackgammonGame = (roomId: string | null) => {
    const [room, setRoom] = useState<BackgammonRoom | null>(null);
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

    const ensureUserReady = async () => {
        if (userId) return userId;
        const auth = getAuth();
        const cred = await signInAnonymously(auth);
        setUserId(cred.user.uid);
        return cred.user.uid;
    };

    // Subscribe to room changes
    useEffect(() => {
        if (!firebaseEnabled || !db) {
            setLoading(false);
            return;
        }

        if (!roomId) {
            setRoom(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const roomRef = doc(collection(db, 'rooms_bg'), roomId); // separate collection for safety
        const unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setRoom(snapshot.data() as BackgammonRoom);
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

        const uid = await ensureUserReady();
        const id = generateRoomId();
        const roomRef = doc(collection(db, 'rooms_bg'), id);

        const initialGame = createBackgammonGame();

        const roomData: BackgammonRoom = {
            board: initialGame.board,
            bar: initialGame.bar,
            off: initialGame.off,
            turn: initialGame.turn,
            dice: initialGame.dice,
            movesLeft: initialGame.movesLeft,
            whitePlayer: uid,
            blackPlayer: '',
            winner: '',
            status: 'active',
        };

        await setDoc(roomRef, roomData);
        return id;
    };

    const joinRoom = async (id: string) => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');
        const uid = await ensureUserReady();
        const roomRef = doc(collection(db, 'rooms_bg'), id);

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) throw new Error('Room not found');

            const data = snap.data() as BackgammonRoom;
            const nextData = { ...data };

            if (!nextData.whitePlayer) {
                nextData.whitePlayer = uid;
            } else if (!nextData.blackPlayer && nextData.whitePlayer !== uid) {
                nextData.blackPlayer = uid;
            }

            transaction.update(roomRef, nextData);
        });
    };

    const updateGameState = async (newState: BackgammonState) => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const roomRef = doc(collection(db, 'rooms_bg'), roomId);

        let status: BackgammonRoom['status'] = 'active';
        let winner: BackgammonRoom['winner'] = '';

        if (newState.winner) {
            status = 'finished';
            winner = newState.winner;
        }

        await updateDoc(roomRef, {
            board: newState.board,
            bar: newState.bar,
            off: newState.off,
            turn: newState.turn,
            dice: newState.dice,
            movesLeft: newState.movesLeft,
            winner,
            status
        });
    };

    const resignGame = async (color: 'white' | 'black') => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const roomRef = doc(collection(db, 'rooms_bg'), roomId);
        const winner = color === 'white' ? 'black' : 'white';
        await updateDoc(roomRef, {
            status: 'resigned',
            winner,
        });
    };

    const resetGame = async () => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const initialGame = createBackgammonGame();
        const roomRef = doc(collection(db, 'rooms_bg'), roomId);

        await updateDoc(roomRef, {
            board: initialGame.board,
            bar: initialGame.bar,
            off: initialGame.off,
            turn: initialGame.turn,
            dice: initialGame.dice,
            movesLeft: initialGame.movesLeft,
            status: 'active',
            winner: '',
        });
    };

    return { room, userId, loading, isAuthLoading, createRoom, joinRoom, updateGameState, resignGame, resetGame };
};
