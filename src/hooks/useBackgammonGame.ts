import { useEffect, useRef, useState } from 'react';
import { getSocket, getUserId, emitAck, EV, type RoomView } from '../lib/socket';

/**
 * Backgammon room hook — backed by the authoritative Socket.IO server.
 * Preserves the public shape (room/userId/loading/isAuthLoading +
 * create/join/resign/reset/leave). The only change vs the old Firestore hook is
 * `updateGameState(fullState)` → `makeMove(move)`: the client now sends only the
 * move intent and the server owns dice RNG, turn advancement and win detection.
 */
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
    status: 'active' | 'finished' | 'resigned' | string;
    lastMove?: unknown;
}

export interface BackgammonMoveIntent {
    from: number | 'bar';
    to: number | 'off';
}

interface BgStatePayload {
    board: number[];
    bar: { white: number; black: number };
    off: { white: number; black: number };
    dice: number[];
    movesLeft: number[];
}

function viewToRoom(view: RoomView): BackgammonRoom {
    const s = view.state as BgStatePayload;
    return {
        board: s.board,
        bar: s.bar,
        off: s.off,
        dice: s.dice,
        movesLeft: s.movesLeft,
        turn: view.currentTurn === 0 ? 'white' : 'black',
        whitePlayer: view.seats[0]?.userId ?? '',
        blackPlayer: view.seats[1]?.userId ?? '',
        winner: view.winner === 0 ? 'white' : view.winner === 1 ? 'black' : '',
        status: view.status,
        lastMove: view.lastMove,
    };
}

export const useBackgammonGame = (roomId: string | null) => {
    const [room, setRoom] = useState<BackgammonRoom | null>(null);
    const [userId] = useState<string>(() => getUserId());
    const [loading, setLoading] = useState<boolean>(!!roomId);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const versionRef = useRef(0);

    useEffect(() => {
        const socket = getSocket();
        const onConnect = () => setIsAuthLoading(false);
        if (socket.connected) setIsAuthLoading(false);
        socket.on('connect', onConnect);
        return () => {
            socket.off('connect', onConnect);
        };
    }, []);

    useEffect(() => {
        if (!roomId) {
            setRoom(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const socket = getSocket();

        const onView = (view: RoomView) => {
            if (view.roomId !== roomId || view.gameType !== 'backgammon') return;
            versionRef.current = view.version;
            setRoom(viewToRoom(view));
            setLoading(false);
        };

        socket.on(EV.view, onView);
        emitAck(EV.subscribe, { roomId }).then((ack) => {
            if (!ack.ok) setLoading(false);
        });

        return () => {
            socket.off(EV.view, onView);
        };
    }, [roomId]);

    const createRoom = async (): Promise<string> => {
        const ack = await emitAck<{ roomId: string }>(EV.create, { gameType: 'backgammon' });
        if (!ack.ok || !ack.data) throw new Error(ack.ok ? 'No room id' : ack.error);
        return ack.data.roomId;
    };

    const joinRoom = async (id: string): Promise<void> => {
        const ack = await emitAck(EV.join, { roomId: id });
        if (!ack.ok) throw new Error(ack.error);
    };

    /** Send a move intent; returns true if the server accepted it. */
    const makeMove = async (move: BackgammonMoveIntent): Promise<boolean> => {
        if (!roomId) return false;
        const ack = await emitAck(EV.move, {
            roomId,
            move: { from: move.from, to: move.to },
            expectedVersion: versionRef.current,
        });
        return ack.ok;
    };

    const resignGame = async (_color?: 'white' | 'black'): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.resign, { roomId });
    };

    const resetGame = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.rematch, { roomId });
    };

    const leaveRoom = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.leave, { roomId });
    };

    return { room, userId, loading, isAuthLoading, createRoom, joinRoom, makeMove, resignGame, resetGame, leaveRoom };
};
