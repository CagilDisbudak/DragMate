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
import { Chess } from 'chess.js';
import { db, firebaseEnabled } from '../lib/firebase';

export interface GameRoom {
    fen: string;
    whitePlayer: string;
    blackPlayer: string;
    turn: 'w' | 'b';
    lastMove?: any;
    status?: 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
    winner?: 'w' | 'b' | '';
    resultReason?: string;
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

    // Ensure we have a userId before performing room ops
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

        const uid = await ensureUserReady();

        const id = generateRoomId();
        const roomRef = doc(collection(db, 'rooms'), id);

        await setDoc(roomRef, {
            fen: START_FEN,
            whitePlayer: uid,
            blackPlayer: '',
            turn: 'w',
            status: 'active',
            winner: '',
            resultReason: '',
        });

        return id;
    };

    const joinRoom = async (id: string) => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');
        const uid = await ensureUserReady();

        const roomRef = doc(collection(db, 'rooms'), id);

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) {
                throw new Error('Room not found');
            }

            const data = snap.data() as GameRoom;
            const nextData = { ...data };

            if (!nextData.whitePlayer) {
                nextData.whitePlayer = uid;
            } else if (!nextData.blackPlayer && nextData.whitePlayer !== uid) {
                nextData.blackPlayer = uid;
            }

            transaction.update(roomRef, nextData);
        });
    };

    const updateMove = async (fen: string) => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const roomRef = doc(collection(db, 'rooms'), roomId);

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) return;

            const data = snap.data() as GameRoom;
            if (data.status && data.status !== 'active') {
                // Oyun bitmişse yeni hamle yazma
                return;
            }

            const game = new Chess(fen);
            const turn = game.turn() as 'w' | 'b';

            let status: GameRoom['status'] = 'active';
            let winner: GameRoom['winner'] = '';
            let resultReason = '';

            if (game.isCheckmate()) {
                status = 'checkmate';
                winner = turn === 'w' ? 'b' : 'w'; // Sırası gelen mat ise kazanan diğer renk
                resultReason = 'checkmate';
            } else if ((game as any).isStalemate && (game as any).isStalemate()) {
                status = 'stalemate';
                winner = '';
                resultReason = 'stalemate';
            } else if (game.isDraw()) {
                status = 'draw';
                winner = '';
                resultReason = 'draw';
            }

            transaction.update(roomRef, { fen, turn, status, winner, resultReason });
        });
    };

    const resignGame = async (color: 'w' | 'b') => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const roomRef = doc(collection(db, 'rooms'), roomId);
        const winner = color === 'w' ? 'b' : 'w';
        await updateDoc(roomRef, {
            status: 'resigned',
            winner,
            resultReason: 'resigned',
        });
    };

    const resetGame = async () => {
        if (!firebaseEnabled || !db) return;
        if (!roomId) return;

        const roomRef = doc(collection(db, 'rooms'), roomId);
        await updateDoc(roomRef, {
            fen: START_FEN,
            turn: 'w',
            status: 'active',
            winner: '',
            resultReason: '',
        });
    };

    return { room, userId, loading, isAuthLoading, createRoom, joinRoom, updateMove, resignGame, resetGame };
};
