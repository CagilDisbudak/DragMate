import { useEffect, useRef, useState } from 'react';
import { getSocket, getUserId, emitAck, EV, type RoomView } from '../lib/socket';
import { findRunIndices, findSetIndices } from '../logic/101Logic';
import type { Tile101, Meld } from '../logic/101Logic';

/**
 * 101 room hook — backed by the authoritative Socket.IO server.
 *
 * Keeps the public surface Game101 consumes. Draw/discard/lay-down/add-to-meld
 * are validated server-side; the server owns the deck, scoring, rounds and the
 * AI (so a host disconnect no longer stalls bots). Only this seat's own tiles
 * arrive over the wire — opponents' racks and the draw order are hidden.
 *
 * Tile-selection state (for laying down) stays local UI state, as before.
 */
export interface Player101 {
    odaSlotu: number;
    odaUserId: string;
    adPlayerName: string;
    adIsAI: boolean;
    tiles: (Tile101 | null)[];
    score: number;
    hasLaidDown: boolean;
}

export type Room101Phase = 'waiting' | 'playing' | 'roundOver' | 'gameOver';

export interface MeldMap {
    [key: string]: {
        id: string;
        tiles: Tile101[];
        type: 'set' | 'run';
        ownerPlayer: number;
    };
}

export interface DiscardPilesMap {
    [key: string]: Tile101[];
}

export interface Room101 {
    roomId: string;
    phase: Room101Phase;
    players: Player101[];
    centerStack: Tile101[];
    discardPiles: DiscardPilesMap;
    indicatorTile: Tile101 | null;
    okeyTile: Tile101 | null;
    tableMelds: MeldMap;
    currentTurn: number;
    roundWinner: number | null;
    gameWinner: number | null;
    roundNumber: number;
    hostUserId: string;
    createdAt: number;
}

interface Projection101 {
    players: { tiles: (Tile101 | null)[]; score: number; hasLaidDown: boolean }[];
    centerStackCount: number;
    discardPiles: Tile101[][];
    indicatorTile: Tile101 | null;
    okeyTile: Tile101 | null;
    tableMelds: { [key: string]: Meld };
    roundWinner: number | null;
    gameWinner: number | null;
    roundNumber: number;
}

const HIDDEN: Tile101 = { id: 'hidden', value: 0, color: null };

function viewToRoom(view: RoomView): Room101 {
    const s = view.state as Projection101;
    return {
        roomId: view.roomId,
        phase: view.phase as Room101Phase,
        players: view.seats.map((seat, i) => ({
            odaSlotu: i,
            odaUserId: seat.userId ?? '',
            adPlayerName: seat.displayName || (seat.isAI ? `Bot ${i + 1}` : ''),
            adIsAI: seat.isAI,
            tiles: s.players[i]?.tiles ?? [],
            score: s.players[i]?.score ?? 0,
            hasLaidDown: s.players[i]?.hasLaidDown ?? false,
        })),
        centerStack: Array(s.centerStackCount).fill(HIDDEN),
        discardPiles: {
            '0': s.discardPiles[0] ?? [],
            '1': s.discardPiles[1] ?? [],
            '2': s.discardPiles[2] ?? [],
            '3': s.discardPiles[3] ?? [],
        },
        indicatorTile: s.indicatorTile,
        okeyTile: s.okeyTile,
        tableMelds: s.tableMelds,
        currentTurn: view.currentTurn,
        roundWinner: s.roundWinner,
        gameWinner: s.gameWinner,
        roundNumber: s.roundNumber,
        hostUserId: view.hostUserId ?? '',
        createdAt: view.createdAt,
    };
}

export const use101Room = (roomId: string | null) => {
    const [room, setRoom] = useState<Room101 | null>(null);
    const [userId] = useState<string>(() => getUserId());
    const [loading, setLoading] = useState<boolean>(!!roomId);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTileIndices, setSelectedTileIndices] = useState<number[]>([]);
    const viewRef = useRef<RoomView | null>(null);
    const roomRef = useRef<Room101 | null>(null);

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
            if (view.roomId !== roomId || view.gameType !== '101') return;
            viewRef.current = view;
            const mapped = viewToRoom(view);
            roomRef.current = mapped;
            setRoom(mapped);
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

    const myTiles = (): (Tile101 | null)[] => {
        const slot = getMySlot();
        return slot >= 0 ? roomRef.current?.players[slot]?.tiles ?? [] : [];
    };

    const move = (payload: Record<string, unknown>) => {
        if (!roomId) return Promise.resolve({ ok: false, error: 'No room' } as const);
        return emitAck(EV.move, { roomId, move: payload });
    };

    const createRoom = async (playerName: string): Promise<string> => {
        const ack = await emitAck<{ roomId: string }>(EV.create, { gameType: '101', displayName: playerName });
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
    const addToMeld = (tileIndex: number, meldId: string) => void move({ action: 'addToMeld', index: tileIndex, meldId });
    const moveTileInRack = (fromIndex: number, toIndex: number) => void move({ action: 'reorder', from: fromIndex, to: toIndex });
    const sortTilesByRuns = () => void move({ action: 'sortRuns' });
    const sortTilesBySets = () => void move({ action: 'sortSets' });
    const sortTilesByPairs = () => void move({ action: 'sortPairs' });
    const autoSortTiles = () => void move({ action: 'smartSort' });

    const layDownMeld = () => {
        if (selectedTileIndices.length < 3) {
            alert('En az 3 taş seçin');
            return;
        }
        void move({ action: 'layDown', indices: selectedTileIndices });
        setSelectedTileIndices([]);
    };

    const startNewRound = () => void move({ action: 'startNewRound' });
    const resetGame = async (): Promise<void> => {
        if (!roomId) return;
        await emitAck(EV.rematch, { roomId });
    };

    // Local-only tile selection (UI state for building a meld before laying down).
    const toggleTileSelection = (index: number) => {
        setSelectedTileIndices((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
        );
    };
    const clearSelection = () => setSelectedTileIndices([]);
    const selectRuns = () => {
        const runs = findRunIndices(myTiles());
        if (runs.length > 0) setSelectedTileIndices(runs[0]);
    };
    const selectSets = () => {
        const sets = findSetIndices(myTiles());
        if (sets.length > 0) setSelectedTileIndices(sets[0]);
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
        layDownMeld,
        addToMeld,
        moveTileInRack,
        sortTilesByRuns,
        sortTilesBySets,
        sortTilesByPairs,
        autoSortTiles,
        selectedTileIndices,
        toggleTileSelection,
        clearSelection,
        selectRuns,
        selectSets,
        startNewRound,
        resetGame,
    };
};
