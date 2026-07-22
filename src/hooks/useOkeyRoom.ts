import { useEffect, useRef, useState } from 'react';
import { getSocket, getUserId, emitAck, EV, type RoomView } from '../lib/socket';
import type { OkeyTile } from '../logic/okeyLogic';

/**
 * Okey room hook — backed by the authoritative Socket.IO server.
 *
 * Keeps the same public surface the components use (room in OkeyRoom shape,
 * getMySlot/isHost, create/join/leave/start, draw/discard/finish, reorder/sort,
 * reshuffle/endInTie, reset). The server now owns the deck and every hand, and
 * only this seat's own tiles arrive over the wire — opponents' racks and the
 * draw-pile order are hidden (were fully visible in the old Firestore model).
 */
export type OkeyRoomPhase = 'waiting' | 'playing' | 'roundOver' | 'stackEmpty';

export interface OkeyPlayer {
    odaSlotu: number;
    odaUserId: string;
    adPlayerName: string;
    adIsAI: boolean;
    tiles: (OkeyTile | null)[];
}

export interface DiscardPilesMap {
    pile0: OkeyTile[];
    pile1: OkeyTile[];
    pile2: OkeyTile[];
    pile3: OkeyTile[];
}

export interface OkeyRoom {
    roomId: string;
    phase: OkeyRoomPhase;
    players: OkeyPlayer[];
    centerStack: OkeyTile[];
    discardPiles: DiscardPilesMap;
    indicatorTile: OkeyTile | null;
    okeyTile: OkeyTile | null;
    currentTurn: number;
    winner: number | null;
    hostUserId: string;
    createdAt: number;
}

interface OkeyProjection {
    phase: OkeyRoomPhase;
    centerStackCount: number;
    discardPiles: OkeyTile[][];
    indicatorTile: OkeyTile | null;
    okeyTile: OkeyTile | null;
    hands: (OkeyTile | null)[][];
    handCounts: number[];
}

const HIDDEN: OkeyTile = { id: 'hidden', value: 0, color: null };

function viewToRoom(view: RoomView): OkeyRoom {
    const s = view.state as OkeyProjection;
    return {
        roomId: view.roomId,
        phase: s.phase,
        players: view.seats.map((seat, i) => ({
            odaSlotu: i,
            odaUserId: seat.userId ?? '',
            adPlayerName: seat.displayName || (seat.isAI ? `Bot ${i + 1}` : ''),
            adIsAI: seat.isAI,
            tiles: s.hands[i] ?? [],
        })),
        centerStack: Array(s.centerStackCount).fill(HIDDEN),
        discardPiles: {
            pile0: s.discardPiles[0] ?? [],
            pile1: s.discardPiles[1] ?? [],
            pile2: s.discardPiles[2] ?? [],
            pile3: s.discardPiles[3] ?? [],
        },
        indicatorTile: s.indicatorTile,
        okeyTile: s.okeyTile,
        currentTurn: view.currentTurn,
        winner: view.winner,
        hostUserId: view.hostUserId ?? '',
        createdAt: view.createdAt,
    };
}

export const useOkeyRoom = (roomId: string | null) => {
    const [room, setRoom] = useState<OkeyRoom | null>(null);
    const [userId] = useState<string>(() => getUserId());
    const [loading, setLoading] = useState<boolean>(!!roomId);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const viewRef = useRef<RoomView | null>(null);

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
            if (view.roomId !== roomId || view.gameType !== 'okey') return;
            viewRef.current = view;
            setRoom(viewToRoom(view));
            setLoading(false);
        };

        socket.on(EV.view, onView);
        emitAck(EV.subscribe, { roomId }).then((ack) => {
            if (!ack.ok) {
                setError(ack.error);
                setLoading(false);
            }
        });

        return () => {
            socket.off(EV.view, onView);
        };
    }, [roomId]);

    const getMySlot = (): number => {
        const seats = viewRef.current?.seats;
        if (!seats) return -1;
        return seats.findIndex((s) => s.userId === userId);
    };
    const isHost = (): boolean => viewRef.current?.hostUserId === userId;

    const move = (payload: Record<string, unknown>) => {
        if (!roomId) return Promise.resolve({ ok: false, error: 'No room' } as const);
        return emitAck(EV.move, { roomId, move: payload });
    };

    const createRoom = async (playerName: string): Promise<string> => {
        const ack = await emitAck<{ roomId: string }>(EV.create, { gameType: 'okey', displayName: playerName });
        if (!ack.ok || !ack.data) throw new Error(ack.ok ? 'No room id' : ack.error);
        return ack.data.roomId;
    };
    const joinRoom = async (id: string, playerName: string): Promise<boolean> => {
        const ack = await emitAck(EV.join, { roomId: id, displayName: playerName });
        if (!ack.ok) setError(ack.error);
        return ack.ok;
    };
    const leaveRoom = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.leave, { roomId });
    };
    const startGame = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.start, { roomId });
    };

    const drawFromCenter = (slot?: number) => void move({ action: 'drawCenter', slot });
    const drawFromDiscard = (slot?: number) => void move({ action: 'drawDiscard', slot });
    const discardTile = (index: number) => void move({ action: 'discard', index });
    const moveTileInRack = (fromIndex: number, toIndex: number) => void move({ action: 'reorder', from: fromIndex, to: toIndex });
    const autoSortTiles = () => void move({ action: 'sort' });
    const reshuffleDiscards = () => void move({ action: 'reshuffle' });
    const endInTie = () => void move({ action: 'endTie' });
    const finishGame = async (index: number): Promise<boolean> => {
        const ack = await move({ action: 'finish', index });
        return ack.ok;
    };
    const resetGame = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.rematch, { roomId });
    };

    return {
        room,
        userId,
        loading,
        isAuthLoading,
        error,
        getMySlot,
        isHost,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        drawFromCenter,
        drawFromDiscard,
        discardTile,
        moveTileInRack,
        autoSortTiles,
        finishGame,
        reshuffleDiscards,
        endInTie,
        resetGame,
    };
};
