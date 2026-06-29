import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import {
    initialize101Game,
    isValidMeld,
    canAddToMeld,
    canMakeFirstLayDown,
    computeAIMove,
    endRound,
    startNewRound as startNewRound101,
    smartSort101Tiles,
    sortByRuns,
    sortBySets,
    sortByPairs,
    findRunIndices,
    findSetIndices,
    RACK_SIZE_101
} from '../logic/101Logic';
import type { Tile101, Meld, Game101State } from '../logic/101Logic';

// ============ TYPES ============

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

// Firebase-compatible meld structure
export interface MeldMap {
    [key: string]: {
        id: string;
        tiles: Tile101[];
        type: 'set' | 'run';
        ownerPlayer: number;
    };
}

// Firebase-compatible discard piles structure (object instead of nested array)
export interface DiscardPilesMap {
    [key: string]: Tile101[];
}

export interface Room101 {
    roomId: string;
    phase: Room101Phase;
    players: Player101[];
    centerStack: Tile101[];
    discardPiles: DiscardPilesMap; // Per-player discard piles
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

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

let meldIdCounter = 1;

// ===== Room <-> Game101State conversion helpers =====
// The Firestore room stores discardPiles/tableMelds as keyed objects; the shared
// game engine works on Game101State (array-based). These keep both in sync.

const discardMapToArray = (m: DiscardPilesMap): Tile101[][] => [
    m['0'] || [], m['1'] || [], m['2'] || [], m['3'] || []
];

const discardArrayToMap = (a: Tile101[][]): DiscardPilesMap => ({
    '0': a[0] || [], '1': a[1] || [], '2': a[2] || [], '3': a[3] || []
});

const roomToGameState = (data: Room101): Game101State => ({
    phase: data.phase === 'waiting' ? 'dealing' : data.phase,
    players: data.players.map(p => ({ tiles: p.tiles, score: p.score, hasLaidDown: p.hasLaidDown })),
    centerStack: data.centerStack,
    discardPiles: discardMapToArray(data.discardPiles),
    indicatorTile: data.indicatorTile,
    okeyTile: data.okeyTile,
    tableMelds: data.tableMelds as { [key: string]: Meld },
    currentTurn: data.currentTurn,
    roundWinner: data.roundWinner,
    gameWinner: data.gameWinner,
    roundNumber: data.roundNumber,
});

// Build a Firestore update payload that applies a computed Game101State back onto the
// room, preserving each player's identity fields (slot, userId, name, AI flag).
const mergeStateIntoRoom = (data: Room101, next: Game101State) => ({
    players: data.players.map((p, i) => ({
        ...p,
        tiles: next.players[i].tiles,
        score: next.players[i].score,
        hasLaidDown: next.players[i].hasLaidDown,
    })),
    centerStack: next.centerStack,
    discardPiles: discardArrayToMap(next.discardPiles),
    tableMelds: next.tableMelds as MeldMap,
    currentTurn: next.currentTurn,
    phase: next.phase as Room101Phase,
    roundWinner: next.roundWinner,
    gameWinner: next.gameWinner,
});

// ============ HOOK ============

export const use101Room = (roomId: string | null) => {
    const [room, setRoom] = useState<Room101 | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTileIndices, setSelectedTileIndices] = useState<number[]>([]);
    
    // Debounce refs
    const moveTileDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingMoveState = useRef<{ players: Player101[] } | null>(null);

    // Firebase auth
    useEffect(() => {
        const auth = getAuth();
        signInAnonymously(auth)
            .then((cred) => setUserId(cred.user.uid))
            .catch((err) => {
                console.error('Auth failed', err);
                setError('Authentication failed');
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

    // Subscribe to room
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
        const roomRef = doc(collection(db, '101Rooms'), roomId);
        const unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setRoom(snapshot.data() as Room101);
                    setError(null);
                } else {
                    setRoom(null);
                    setError('Room not found');
                }
                setLoading(false);
            },
            (error) => {
                console.error('Room subscription error', error);
                setRoom(null);
                setError('Failed to connect to room');
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
            if (moveTileDebounceTimer.current) {
                clearTimeout(moveTileDebounceTimer.current);
            }
        };
    }, [roomId]);

    // Memoized values
    const mySlotMemo = useMemo((): number => {
        if (!room || !userId) return -1;
        return room.players.findIndex(p => p.odaUserId === userId);
    }, [room?.players, userId]);

    const getMySlot = useCallback((): number => mySlotMemo, [mySlotMemo]);

    const isHostMemo = useMemo((): boolean => {
        if (!room || !userId) return false;
        return room.hostUserId === userId;
    }, [room?.hostUserId, userId]);

    const isHost = useCallback((): boolean => isHostMemo, [isHostMemo]);

    // Toggle tile selection
    const toggleTileSelection = useCallback((index: number) => {
        setSelectedTileIndices(prev => {
            if (prev.includes(index)) return prev.filter(i => i !== index);
            return [...prev, index];
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedTileIndices([]);
    }, []);

    // Create room
    const createRoom = async (playerName: string): Promise<string | null> => {
        if (!firebaseEnabled || !db) return null;
        try {
            const uid = await ensureUserReady();
            const newRoomId = generateRoomId();
            const roomRef = doc(collection(db, '101Rooms'), newRoomId);

            const initialRoom: Room101 = {
                roomId: newRoomId,
                phase: 'waiting',
                players: [{
                    odaSlotu: 0,
                    odaUserId: uid,
                    adPlayerName: playerName,
                    adIsAI: false,
                    tiles: Array(RACK_SIZE_101).fill(null),
                    score: 0,
                    hasLaidDown: false
                }],
                centerStack: [],
                discardPiles: { '0': [], '1': [], '2': [], '3': [] }, // Per-player discard piles
                indicatorTile: null,
                okeyTile: null,
                tableMelds: {},
                currentTurn: 0,
                roundWinner: null,
                gameWinner: null,
                roundNumber: 1,
                hostUserId: uid,
                createdAt: Date.now()
            };

            await setDoc(roomRef, initialRoom);
            return newRoomId;
        } catch (error) {
            console.error('Error creating room:', error);
            setError('Failed to create room');
            return null;
        }
    };

    // Join room
    const joinRoom = async (targetRoomId: string, playerName: string): Promise<boolean> => {
        if (!firebaseEnabled || !db) return false;
        try {
            const uid = await ensureUserReady();
            const roomRef = doc(collection(db, '101Rooms'), targetRoomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) throw new Error('Room not found');

                const data = snap.data() as Room101;
                if (data.phase !== 'waiting') throw new Error('Game already started');
                if (data.players.length >= 4) throw new Error('Room is full');
                if (data.players.some(p => p.odaUserId === uid)) return;

                const newPlayer: Player101 = {
                    odaSlotu: data.players.length,
                    odaUserId: uid,
                    adPlayerName: playerName,
                    adIsAI: false,
                    tiles: Array(RACK_SIZE_101).fill(null),
                    score: 0,
                    hasLaidDown: false
                };

                transaction.update(roomRef, {
                    players: [...data.players, newPlayer]
                });
            });

            return true;
        } catch (error: any) {
            console.error('Error joining room:', error);
            setError(error.message || 'Failed to join room');
            return false;
        }
    };

    // Start game
    const startGame = async () => {
        if (!firebaseEnabled || !db || !roomId || !isHost()) return;
        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                const gameSetup = initialize101Game(4);
                
                // Fill empty slots with AI
                const newPlayers: Player101[] = [...data.players];
                for (let i = newPlayers.length; i < 4; i++) {
                    newPlayers.push({
                        odaSlotu: i,
                        odaUserId: `AI_${i}`,
                        adPlayerName: `Bot ${i}`,
                        adIsAI: true,
                        tiles: Array(RACK_SIZE_101).fill(null),
                        score: 0,
                        hasLaidDown: false
                    });
                }

                // Distribute tiles
                for (let p = 0; p < 4; p++) {
                    newPlayers[p] = {
                        ...newPlayers[p],
                        tiles: gameSetup.players[p].tiles
                    };
                }

                transaction.update(roomRef, {
                    phase: 'playing',
                    players: newPlayers,
                    centerStack: gameSetup.centerStack,
                    discardPiles: { '0': [], '1': [], '2': [], '3': [] },
                    indicatorTile: gameSetup.indicatorTile,
                    okeyTile: gameSetup.okeyTile,
                    tableMelds: {},
                    currentTurn: 0
                });
            });
        } catch (error) {
            console.error('Error starting game:', error);
            setError('Failed to start game');
        }
    };

    // Draw from center
    const drawFromCenter = useCallback(async (targetSlot?: number) => {
        if (!firebaseEnabled || !db || !roomId) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                if (data.currentTurn !== mySlot) return;

                const currentTilesCount = data.players[mySlot].tiles.filter(t => t !== null).length;
                if (currentTilesCount >= 15) return;

                const newStack = [...data.centerStack];
                const drawnTile = newStack.pop();
                if (!drawnTile) return;

                const newPlayers = [...data.players];
                const newRack = [...newPlayers[mySlot].tiles];

                let finalSlot = -1;
                if (targetSlot !== undefined && targetSlot >= 0 && targetSlot < newRack.length) {
                    if (newRack[targetSlot] === null) {
                        finalSlot = targetSlot;
                    } else {
                        for (let dist = 1; dist < newRack.length; dist++) {
                            const right = targetSlot + dist;
                            const left = targetSlot - dist;
                            if (right < newRack.length && newRack[right] === null) {
                                finalSlot = right;
                                break;
                            }
                            if (left >= 0 && newRack[left] === null) {
                                finalSlot = left;
                                break;
                            }
                        }
                    }
                }

                if (finalSlot === -1) {
                    finalSlot = newRack.findIndex(s => s === null);
                }

                if (finalSlot !== -1) {
                    newRack[finalSlot] = drawnTile;
                }

                newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

                transaction.update(roomRef, {
                    players: newPlayers,
                    centerStack: newStack
                });
            });
        } catch (error) {
            console.error('Error drawing from center:', error);
            setError('Failed to draw tile');
        }
    }, [firebaseEnabled, db, roomId, getMySlot]);

    // Draw from previous player's discard (counter-clockwise)
    const drawFromDiscard = useCallback(async (targetSlot?: number) => {
        if (!firebaseEnabled || !db || !roomId) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                if (data.currentTurn !== mySlot) return;

                // Draw from previous player's discard (counter-clockwise)
                const prevPlayerIdx = (mySlot + 3) % 4;
                const prevPlayerDiscard = data.discardPiles[String(prevPlayerIdx)] || [];
                if (prevPlayerDiscard.length === 0) return;

                const currentTilesCount = data.players[mySlot].tiles.filter(t => t !== null).length;
                if (currentTilesCount >= 15) return;

                const drawnTile = prevPlayerDiscard[prevPlayerDiscard.length - 1];
                const newDiscardPiles = {
                    ...data.discardPiles,
                    [String(prevPlayerIdx)]: prevPlayerDiscard.slice(0, -1)
                };

                const newPlayers = [...data.players];
                const newRack = [...newPlayers[mySlot].tiles];

                let finalSlot = -1;
                if (targetSlot !== undefined && newRack[targetSlot] === null) {
                    finalSlot = targetSlot;
                } else {
                    finalSlot = newRack.findIndex(s => s === null);
                }

                if (finalSlot !== -1) {
                    newRack[finalSlot] = drawnTile;
                }

                newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

                transaction.update(roomRef, {
                    players: newPlayers,
                    discardPiles: newDiscardPiles
                });
            });
        } catch (error) {
            console.error('Error drawing from discard:', error);
            setError('Failed to draw from discard');
        }
    }, [firebaseEnabled, db, roomId, getMySlot]);

    // Discard tile to own pile
    const discardTile = useCallback(async (index: number) => {
        if (!firebaseEnabled || !db || !roomId) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                if (data.currentTurn !== mySlot) return;

                const playerTiles = data.players[mySlot].tiles.filter(t => t !== null);
                if (playerTiles.length !== 15) return;

                const newPlayers = [...data.players];
                const newRack = [...newPlayers[mySlot].tiles];
                const discardedTile = newRack[index];

                if (!discardedTile) return;

                newRack[index] = null;
                newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

                // Discard to own pile
                const myDiscardPile = data.discardPiles[String(mySlot)] || [];
                const newDiscardPiles = {
                    ...data.discardPiles,
                    [String(mySlot)]: [...myDiscardPile, discardedTile]
                };
                const nextTurn = (data.currentTurn + 1) % 4;

                transaction.update(roomRef, {
                    players: newPlayers,
                    discardPiles: newDiscardPiles,
                    currentTurn: nextTurn
                });
            });
        } catch (error) {
            console.error('Error discarding tile:', error);
            setError('Failed to discard tile');
        }
        clearSelection();
    }, [firebaseEnabled, db, roomId, getMySlot, clearSelection]);

    // Lay down meld
    const layDownMeld = useCallback(async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        if (selectedTileIndices.length < 3) {
            alert("En az 3 taş seçmelisiniz!");
            return;
        }

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                if (data.currentTurn !== mySlot) return;

                const player = data.players[mySlot];
                const selectedTiles = selectedTileIndices
                    .map(idx => player.tiles[idx])
                    .filter((t): t is Tile101 => t !== null);

                if (selectedTiles.length < 3) return;

                const validation = isValidMeld(selectedTiles);
                if (!validation.valid || !validation.type) {
                    throw new Error("Bu taşlar geçerli bir per oluşturmuyor!");
                }

                if (!player.hasLaidDown && !canMakeFirstLayDown([selectedTiles])) {
                    throw new Error("İlk indiriş için en az 51 puan gerekli!");
                }

                const meldId = `meld-${Date.now()}-${meldIdCounter++}`;
                const newMeld = {
                    id: meldId,
                    tiles: selectedTiles,
                    type: validation.type,
                    ownerPlayer: mySlot
                };

                const newRack = [...player.tiles];
                selectedTileIndices.forEach(idx => {
                    newRack[idx] = null;
                });

                const newPlayers = [...data.players];
                newPlayers[mySlot] = {
                    ...newPlayers[mySlot],
                    tiles: newRack,
                    hasLaidDown: true
                };

                const newMelds = { ...data.tableMelds, [meldId]: newMeld };

                // Check win — score via the shared endRound (lowest total wins the game)
                const remainingTiles = newRack.filter(t => t !== null).length;
                if (remainingTiles === 0) {
                    const gsPlayers = newPlayers.map(p => ({ tiles: p.tiles, score: p.score, hasLaidDown: p.hasLaidDown }));
                    const ended = endRound({ ...roomToGameState(data), players: gsPlayers, tableMelds: newMelds }, mySlot);
                    transaction.update(roomRef, mergeStateIntoRoom(data, ended));
                } else {
                    transaction.update(roomRef, {
                        players: newPlayers,
                        tableMelds: newMelds
                    });
                }
            });
        } catch (error: any) {
            console.error('Error laying down meld:', error);
            alert(error.message || 'Failed to lay down meld');
        }
        clearSelection();
    }, [firebaseEnabled, db, roomId, room, getMySlot, selectedTileIndices, clearSelection]);

    // Add to existing meld
    const addToMeld = useCallback(async (tileIndex: number, meldId: string) => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as Room101;
                if (data.currentTurn !== mySlot) return;

                const player = data.players[mySlot];
                if (!player.hasLaidDown) {
                    throw new Error("Önce kendi perinizi indirmelisiniz!");
                }

                const tile = player.tiles[tileIndex];
                if (!tile) return;

                const meld = data.tableMelds[meldId];
                if (!meld) return;

                if (!canAddToMeld(meld as Meld, tile)) {
                    throw new Error("Bu taş bu perlere eklenemez!");
                }

                const newMelds = {
                    ...data.tableMelds,
                    [meldId]: {
                        ...meld,
                        tiles: [...meld.tiles, tile]
                    }
                };

                const newRack = [...player.tiles];
                newRack[tileIndex] = null;

                const newPlayers = [...data.players];
                newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

                // Check win — score via the shared endRound (lowest total wins the game)
                const remainingTiles = newRack.filter(t => t !== null).length;
                if (remainingTiles === 0) {
                    const gsPlayers = newPlayers.map(p => ({ tiles: p.tiles, score: p.score, hasLaidDown: p.hasLaidDown }));
                    const ended = endRound({ ...roomToGameState(data), players: gsPlayers, tableMelds: newMelds }, mySlot);
                    transaction.update(roomRef, mergeStateIntoRoom(data, ended));
                } else {
                    transaction.update(roomRef, {
                        players: newPlayers,
                        tableMelds: newMelds
                    });
                }
            });
        } catch (error: any) {
            console.error('Error adding to meld:', error);
            alert(error.message || 'Failed to add to meld');
        }
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Move tile in rack (debounced)
    const moveTileInRack = useCallback(async (fromIndex: number, toIndex: number) => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        const newPlayers = [...room.players];
        const newRack = [...newPlayers[mySlot].tiles];

        const fromTile = newRack[fromIndex];
        newRack[fromIndex] = newRack[toIndex];
        newRack[toIndex] = fromTile;

        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };
        pendingMoveState.current = { players: newPlayers };

        if (moveTileDebounceTimer.current) {
            clearTimeout(moveTileDebounceTimer.current);
        }

        moveTileDebounceTimer.current = setTimeout(() => {
            if (pendingMoveState.current && db) {
                const roomRef = doc(collection(db, '101Rooms'), roomId);
                updateDoc(roomRef, { players: pendingMoveState.current.players }).catch(err => {
                    console.error('Error syncing tile move:', err);
                });
                pendingMoveState.current = null;
            }
        }, 100);
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Auto sort tiles
    const autoSortTiles = useCallback(async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        const newPlayers = [...room.players];
        const sortedTiles = smartSort101Tiles(newPlayers[mySlot].tiles);
        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: sortedTiles };

        const roomRef = doc(collection(db, '101Rooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing sorted tiles:', err);
        });
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Sort by runs (same color, consecutive)
    const sortTilesByRuns = useCallback(async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        const newPlayers = [...room.players];
        const sortedTiles = sortByRuns(newPlayers[mySlot].tiles);
        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: sortedTiles };

        const roomRef = doc(collection(db, '101Rooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing sorted tiles:', err);
        });
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Sort by sets (same value, different colors)
    const sortTilesBySets = useCallback(async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        const newPlayers = [...room.players];
        const sortedTiles = sortBySets(newPlayers[mySlot].tiles);
        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: sortedTiles };

        const roomRef = doc(collection(db, '101Rooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing sorted tiles:', err);
        });
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Sort by pairs (same color, same value)
    const sortTilesByPairs = useCallback(async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;

        const newPlayers = [...room.players];
        const sortedTiles = sortByPairs(newPlayers[mySlot].tiles);
        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: sortedTiles };

        const roomRef = doc(collection(db, '101Rooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing sorted tiles:', err);
        });
    }, [firebaseEnabled, db, roomId, room, getMySlot]);

    // Select all runs (for laying down)
    const selectRuns = useCallback(() => {
        if (!room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;
        
        const runGroups = findRunIndices(room.players[mySlot].tiles);
        if (runGroups.length > 0) {
            setSelectedTileIndices(runGroups[0]);
        }
    }, [room, getMySlot]);

    // Select all sets (for laying down)
    const selectSets = useCallback(() => {
        if (!room) return;
        const mySlot = getMySlot();
        if (mySlot === -1) return;
        
        const setGroups = findSetIndices(room.players[mySlot].tiles);
        if (setGroups.length > 0) {
            setSelectedTileIndices(setGroups[0]);
        }
    }, [room, getMySlot]);

    // Start new round — deals via the shared engine (keeps scores, dealer = round
    // winner gets the extra tile and starts).
    const startNewRound = async () => {
        if (!firebaseEnabled || !db || !roomId || !isHost() || !room) return;
        if (room.phase !== 'roundOver') return;

        try {
            const roomRef = doc(collection(db, '101Rooms'), roomId);
            const next = startNewRound101(roomToGameState(room));

            await updateDoc(roomRef, {
                phase: 'playing',
                players: room.players.map((p, idx) => ({
                    ...p,
                    tiles: next.players[idx].tiles,
                    score: next.players[idx].score,
                    hasLaidDown: next.players[idx].hasLaidDown
                })),
                centerStack: next.centerStack,
                discardPiles: discardArrayToMap(next.discardPiles),
                indicatorTile: next.indicatorTile,
                okeyTile: next.okeyTile,
                tableMelds: {},
                currentTurn: next.currentTurn,
                roundWinner: null,
                gameWinner: next.gameWinner,
                roundNumber: next.roundNumber
            });
        } catch (error) {
            console.error('Error starting new round:', error);
        }
    };

    // Reset game
    const resetGame = async () => {
        if (!isHost()) return;
        await startGame();
    };

    // AI Turn handling
    useEffect(() => {
        if (!room || !isHost() || room.phase !== 'playing') return;

        const currentPlayerSlot = room.currentTurn;
        const currentPlayer = room.players[currentPlayerSlot];

        if (!currentPlayer?.adIsAI) return;

        const timer = setTimeout(async () => {
            if (!db || !roomId) return;

            try {
                const roomRef = doc(collection(db, '101Rooms'), roomId);

                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) return;

                    const data = snap.data() as Room101;
                    if (data.currentTurn !== currentPlayerSlot || data.phase !== 'playing') return;
                    if (!data.players[currentPlayerSlot]?.adIsAI) return;

                    // Run the shared smart-AI engine (melds, adds, smart discard, win).
                    const next = computeAIMove(roomToGameState(data));
                    transaction.update(roomRef, mergeStateIntoRoom(data, next));
                });
            } catch (error) {
                console.error('AI turn error:', error);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [room?.currentTurn, room?.phase, isHost, db, roomId]);

    return {
        room,
        userId,
        loading,
        isAuthLoading,
        error,
        selectedTileIndices,
        getMySlot,
        isHost,
        toggleTileSelection,
        clearSelection,
        createRoom,
        joinRoom,
        startGame,
        drawFromCenter,
        drawFromDiscard,
        discardTile,
        layDownMeld,
        addToMeld,
        moveTileInRack,
        autoSortTiles,
        sortTilesByRuns,
        sortTilesBySets,
        sortTilesByPairs,
        selectRuns,
        selectSets,
        startNewRound,
        resetGame
    };
};

