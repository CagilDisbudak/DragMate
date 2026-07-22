import { useEffect, useRef, useState } from 'react';
import { getSocket, getUserId, emitAck, EV, type RoomView } from '../lib/socket';

/**
 * Chess room hook — now backed by the authoritative Socket.IO server instead of
 * Firestore. The public shape is preserved (room/userId/loading/isAuthLoading +
 * create/join/resign/reset/leave) so consuming components barely change. The one
 * change is `updateMove(fen)` → `makeMove({from,to,promotion})`, because the
 * server validates the move against its stored position rather than trusting a
 * client-computed FEN.
 */
export interface GameRoom {
    fen: string;
    whitePlayer: string;
    blackPlayer: string;
    turn: 'w' | 'b';
    lastMove?: unknown;
    status?: 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | string;
    winner?: 'w' | 'b' | '';
    resultReason?: string;
}

export interface ChessMoveIntent {
    from: string;
    to: string;
    promotion?: string;
}

/** Adapt the server's per-seat view into the legacy GameRoom shape. */
function viewToRoom(view: RoomView): GameRoom {
    const state = view.state as { fen?: string };
    const winnerSeat = view.winner;
    return {
        fen: state.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        whitePlayer: view.seats[0]?.userId ?? '',
        blackPlayer: view.seats[1]?.userId ?? '',
        turn: view.currentTurn === 0 ? 'w' : 'b',
        lastMove: view.lastMove,
        status: view.status,
        winner: winnerSeat === 0 ? 'w' : winnerSeat === 1 ? 'b' : '',
        resultReason: view.status,
    };
}

export const useGameRoom = (roomId: string | null) => {
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [userId] = useState<string>(() => getUserId());
    const [loading, setLoading] = useState<boolean>(!!roomId);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const versionRef = useRef(0);

    // Socket connection readiness (replaces Firebase anonymous auth loading).
    useEffect(() => {
        const socket = getSocket();
        const onConnect = () => setIsAuthLoading(false);
        if (socket.connected) setIsAuthLoading(false);
        socket.on('connect', onConnect);
        return () => {
            socket.off('connect', onConnect);
        };
    }, []);

    // Subscribe to the room and receive authoritative views.
    useEffect(() => {
        if (!roomId) {
            setRoom(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const socket = getSocket();

        const onView = (view: RoomView) => {
            if (view.roomId !== roomId || view.gameType !== 'chess') return;
            versionRef.current = view.version;
            setVersion(view.version);
            setRoom(viewToRoom(view));
            setLoading(false);
        };

        socket.on(EV.view, onView);
        // Ensure this socket is joined to the room's channel and gets a fresh view.
        emitAck(EV.subscribe, { roomId }).then((ack) => {
            if (!ack.ok) setLoading(false);
        });

        return () => {
            socket.off(EV.view, onView);
        };
    }, [roomId]);

    const createRoom = async (): Promise<string> => {
        const ack = await emitAck<{ roomId: string }>(EV.create, { gameType: 'chess' });
        if (!ack.ok || !ack.data) throw new Error(ack.ok ? 'No room id' : ack.error);
        return ack.data.roomId;
    };

    const joinRoom = async (id: string): Promise<void> => {
        const ack = await emitAck(EV.join, { roomId: id });
        if (!ack.ok) throw new Error(ack.error);
    };

    /** Send a move intent; returns true if the server accepted it. */
    const makeMove = async (move: ChessMoveIntent): Promise<boolean> => {
        if (!roomId) return false;
        const ack = await emitAck(EV.move, { roomId, move, expectedVersion: versionRef.current });
        return ack.ok;
    };

    const resignGame = async (_color?: 'w' | 'b'): Promise<void> => {
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

    return {
        room,
        userId,
        loading,
        isAuthLoading,
        version,
        createRoom,
        joinRoom,
        makeMove,
        resignGame,
        resetGame,
        leaveRoom,
    };
};
