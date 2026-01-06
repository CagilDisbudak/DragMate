import { useEffect, useState, useCallback } from 'react';
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
    initializeOkeyGame,
    RACK_SIZE,
    isWinningHand
} from '../logic/okeyLogic';
import type { OkeyTile } from '../logic/okeyLogic';

// ============ TYPES ============

export interface OkeyPlayer {
    odaSlotu: number;       // 0-3 slot position
    odaUserId: string;      // Firebase user ID or 'AI_0', 'AI_1', etc.
    adPlayerName: string;   // Display name
    adIsAI: boolean;        // Is this an AI player?
    tiles: (OkeyTile | null)[]; // Player's rack
}

export type OkeyRoomPhase = 'waiting' | 'playing' | 'roundOver' | 'stackEmpty';

// Firebase doesn't support nested arrays, so we use an object for discardPiles
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

// Helper function to convert array to map format
const discardPilesToMap = (piles: OkeyTile[][]): DiscardPilesMap => ({
    pile0: piles[0] || [],
    pile1: piles[1] || [],
    pile2: piles[2] || [],
    pile3: piles[3] || []
});

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ============ HOOK ============

export const useOkeyRoom = (roomId: string | null) => {
    const [room, setRoom] = useState<OkeyRoom | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Firebase auth: anonymous sign-in
    useEffect(() => {
        const auth = getAuth();
        signInAnonymously(auth)
            .then((cred) => {
                setUserId(cred.user.uid);
            })
            .catch((err) => {
                console.error('Auth failed', err);
                setError('Authentication failed');
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
        const roomRef = doc(collection(db, 'okeyRooms'), roomId);
        const unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setRoom(snapshot.data() as OkeyRoom);
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

        return () => unsubscribe();
    }, [roomId]);

    // Get current player's slot index
    const getMySlot = useCallback((): number => {
        if (!room || !userId) return -1;
        return room.players.findIndex(p => p.odaUserId === userId);
    }, [room, userId]);

    // Check if current user is the host
    const isHost = useCallback((): boolean => {
        if (!room || !userId) return false;
        return room.hostUserId === userId;
    }, [room, userId]);

    // Create a new room
    const createRoom = async (playerName: string): Promise<string> => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');

        const uid = await ensureUserReady();
        const id = generateRoomId();
        const roomRef = doc(collection(db, 'okeyRooms'), id);

        // Initialize with empty player slots
        const emptyPlayers: OkeyPlayer[] = Array(4).fill(null).map((_, i) => ({
            odaSlotu: i,
            odaUserId: '',
            adPlayerName: '',
            adIsAI: false,
            tiles: Array(RACK_SIZE).fill(null)
        }));

        // Host takes slot 0
        emptyPlayers[0] = {
            odaSlotu: 0,
            odaUserId: uid,
            adPlayerName: playerName,
            adIsAI: false,
            tiles: Array(RACK_SIZE).fill(null)
        };

        const newRoom: OkeyRoom = {
            roomId: id,
            phase: 'waiting',
            players: emptyPlayers,
            centerStack: [],
            discardPiles: { pile0: [], pile1: [], pile2: [], pile3: [] },
            indicatorTile: null,
            okeyTile: null,
            currentTurn: 0,
            winner: null,
            hostUserId: uid,
            createdAt: Date.now()
        };

        await setDoc(roomRef, newRoom);
        return id;
    };

    // Join an existing room
    const joinRoom = async (id: string, playerName: string): Promise<boolean> => {
        if (!firebaseEnabled || !db) throw new Error('Firebase not configured');
        const uid = await ensureUserReady();

        const roomRef = doc(collection(db, 'okeyRooms'), id);

        try {
            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) {
                    throw new Error('Room not found');
                }

                const data = snap.data() as OkeyRoom;

                // Check if game already started
                if (data.phase !== 'waiting') {
                    throw new Error('Game already started');
                }

                // Check if user is already in the room
                const existingSlot = data.players.findIndex(p => p.odaUserId === uid);
                if (existingSlot !== -1) {
                    // Already in room, just update name if needed
                    const updatedPlayers = [...data.players];
                    updatedPlayers[existingSlot] = {
                        ...updatedPlayers[existingSlot],
                        adPlayerName: playerName
                    };
                    transaction.update(roomRef, { players: updatedPlayers });
                    return;
                }

                // Find an empty slot
                const emptySlotIndex = data.players.findIndex(p => !p.odaUserId);
                if (emptySlotIndex === -1) {
                    throw new Error('Room is full');
                }

                // Join the empty slot
                const updatedPlayers = [...data.players];
                updatedPlayers[emptySlotIndex] = {
                    odaSlotu: emptySlotIndex,
                    odaUserId: uid,
                    adPlayerName: playerName,
                    adIsAI: false,
                    tiles: Array(RACK_SIZE).fill(null)
                };

                transaction.update(roomRef, { players: updatedPlayers });
            });
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    // Leave the room
    const leaveRoom = async () => {
        if (!firebaseEnabled || !db || !roomId) return;

        try {
            const uid = await ensureUserReady();
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;
                const slotIndex = data.players.findIndex(p => p.odaUserId === uid);

                if (slotIndex === -1) return;

                const updatedPlayers = [...data.players];
                updatedPlayers[slotIndex] = {
                    odaSlotu: slotIndex,
                    odaUserId: '',
                    adPlayerName: '',
                    adIsAI: false,
                    tiles: Array(RACK_SIZE).fill(null)
                };

                transaction.update(roomRef, { players: updatedPlayers });
            });
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    };

    // Start the game (host only)
    const startGame = async () => {
        if (!firebaseEnabled || !db || !roomId) return;
        if (!isHost()) {
            setError('Only host can start the game');
            return;
        }

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;

                // Initialize the game
                const gameState = initializeOkeyGame();

                // Fill empty slots with AI
                const updatedPlayers: OkeyPlayer[] = data.players.map((player, index) => {
                    if (!player.odaUserId) {
                        // This is an empty slot, make it AI
                        return {
                            odaSlotu: index,
                            odaUserId: `AI_${index}`,
                            adPlayerName: `Bot ${index + 1}`,
                            adIsAI: true,
                            tiles: gameState.players[index].tiles
                        };
                    }
                    // Human player - assign tiles
                    return {
                        ...player,
                        tiles: gameState.players[index].tiles
                    };
                });

                const updatedRoom: Partial<OkeyRoom> = {
                    phase: 'playing',
                    players: updatedPlayers,
                    centerStack: gameState.centerStack,
                    discardPiles: discardPilesToMap(gameState.discardPiles),
                    indicatorTile: gameState.indicatorTile,
                    okeyTile: gameState.okeyTile,
                    currentTurn: 0,
                    winner: null
                };

                transaction.update(roomRef, updatedRoom);
            });
        } catch (error) {
            console.error('Error starting game:', error);
            setError('Failed to start game');
        }
    };

    // Update game state (for moves)
    const updateGameState = async (updates: Partial<OkeyRoom>) => {
        if (!firebaseEnabled || !db || !roomId) return;

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);
            await updateDoc(roomRef, updates);
        } catch (error) {
            console.error('Error updating game state:', error);
            setError('Failed to update game');
        }
    };

    // Draw from center stack
    const drawFromCenter = async (targetSlot?: number) => {
        if (!firebaseEnabled || !db || !roomId) return;

        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;

                // Validate it's this player's turn
                if (data.currentTurn !== mySlot) return;

                // Validate player has less than 15 tiles
                const currentTilesCount = data.players[mySlot].tiles.filter(t => t !== null).length;
                if (currentTilesCount >= 15) return;

                // Draw from stack
                const newStack = [...data.centerStack];
                const drawnTile = newStack.pop();
                if (!drawnTile) return;

                // Find slot for the tile
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

                const newPhase = newStack.length === 0 ? 'stackEmpty' : data.phase;

                transaction.update(roomRef, {
                    players: newPlayers,
                    centerStack: newStack,
                    phase: newPhase
                });
            });
        } catch (error) {
            console.error('Error drawing from center:', error);
            setError('Failed to draw tile');
        }
    };

    // Draw from discard pile
    const drawFromDiscard = async (targetSlot?: number) => {
        if (!firebaseEnabled || !db || !roomId) return;

        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;

                // Validate it's this player's turn
                if (data.currentTurn !== mySlot) return;

                // Validate player has less than 15 tiles
                const currentTilesCount = data.players[mySlot].tiles.filter(t => t !== null).length;
                if (currentTilesCount >= 15) return;

                // Previous player's discard pile
                const prevPlayerIdx = (mySlot + 3) % 4;
                const pileKey = `pile${prevPlayerIdx}` as keyof DiscardPilesMap;
                const discardPile = data.discardPiles[pileKey];
                if (!discardPile || discardPile.length === 0) return;

                const drawnTile = discardPile[discardPile.length - 1];
                const newDiscardPiles: DiscardPilesMap = {
                    ...data.discardPiles,
                    [pileKey]: discardPile.slice(0, -1)
                };

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
                    discardPiles: newDiscardPiles
                });
            });
        } catch (error) {
            console.error('Error drawing from discard:', error);
            setError('Failed to draw from discard');
        }
    };

    // Discard a tile
    const discardTile = async (index: number) => {
        if (!firebaseEnabled || !db || !roomId) return;

        const mySlot = getMySlot();
        if (mySlot === -1) return;

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;

                // Validate it's this player's turn
                if (data.currentTurn !== mySlot) return;

                // Validate player has 15 tiles
                const playerTiles = data.players[mySlot].tiles.filter(t => t !== null);
                if (playerTiles.length !== 15) return;

                // Get the tile to discard
                const discardedTile = data.players[mySlot].tiles[index];
                if (!discardedTile) return;

                // Create new players array with the tile removed
                const newPlayers = [...data.players];
                const newRack = [...newPlayers[mySlot].tiles];
                newRack[index] = null;
                newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

                // Update discard pile
                const pileKey = `pile${mySlot}` as keyof DiscardPilesMap;
                const currentPile = data.discardPiles[pileKey] || [];
                const newDiscardPiles: DiscardPilesMap = {
                    ...data.discardPiles,
                    [pileKey]: [...currentPile, discardedTile]
                };

                // Advance turn
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
    };

    // Move tile within rack - optimized for speed (no transaction needed for self-rearrangement)
    const moveTileInRack = async (fromIndex: number, toIndex: number) => {
        if (!firebaseEnabled || !db || !roomId || !room) return;

        const mySlot = getMySlot();
        if (mySlot === -1) return;

        // Use local state for immediate update (faster)
        const newPlayers = [...room.players];
        const newRack = [...newPlayers[mySlot].tiles];

        const fromTile = newRack[fromIndex];
        newRack[fromIndex] = newRack[toIndex];
        newRack[toIndex] = fromTile;

        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: newRack };

        // Fire-and-forget update to Firebase (no await for faster response)
        const roomRef = doc(collection(db, 'okeyRooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing tile move:', err);
        });
    };

    // Reset game
    const resetGame = async () => {
        if (!isHost()) return;
        await startGame();
    };

    // Reshuffle discards when stack is empty
    const reshuffleDiscards = async () => {
        if (!room || !roomId || !isHost()) return;

        const allDiscards: OkeyTile[] = [
            ...(room.discardPiles.pile0 || []),
            ...(room.discardPiles.pile1 || []),
            ...(room.discardPiles.pile2 || []),
            ...(room.discardPiles.pile3 || [])
        ];

        if (allDiscards.length === 0) {
            await updateGameState({ phase: 'roundOver', winner: null });
            return;
        }

        const shuffled = [...allDiscards].sort(() => Math.random() - 0.5);

        await updateGameState({
            centerStack: shuffled,
            discardPiles: { pile0: [], pile1: [], pile2: [], pile3: [] },
            phase: 'playing'
        });
    };

    // End in tie
    const endInTie = async () => {
        if (!room || !roomId || !isHost()) return;
        await updateGameState({ phase: 'roundOver', winner: null });
    };

    // Auto sort tiles for the current player - optimized (no transaction needed)
    const autoSortTiles = async () => {
        if (!firebaseEnabled || !db || !roomId || !room) return;

        const mySlot = getMySlot();
        if (mySlot === -1) return;

        // Use local state for immediate sorting
        const newPlayers = [...room.players];
        const currentTiles = [...newPlayers[mySlot].tiles];

        // Get non-null tiles
        const nonNullTiles = currentTiles.filter((t): t is OkeyTile => t !== null);

        // Separate jokers and normal tiles
        const jokers = nonNullTiles.filter(t => t.isFakeOkey || !t.color);
        const normalTiles = nonNullTiles.filter(t => !t.isFakeOkey && t.color);

        // Group tiles by color
        const colorOrder = ['red', 'blue', 'black', 'yellow'];
        const colorGroups: { [key: string]: OkeyTile[] } = {
            red: [],
            blue: [],
            black: [],
            yellow: []
        };

        normalTiles.forEach(tile => {
            if (tile.color) {
                colorGroups[tile.color].push(tile);
            }
        });

        // Sort each color group by value
        colorOrder.forEach(color => {
            colorGroups[color].sort((a, b) => a.value - b.value);
        });

        // Create new rack with 30 slots (2 rows of 15)
        const sortedRack: (OkeyTile | null)[] = new Array(30).fill(null);

        // Place tiles with gaps between color groups
        // Top row (0-14): First 2 colors
        // Bottom row (15-29): Other 2 colors + jokers

        let topIndex = 0;
        let bottomIndex = 15;

        // Place red tiles on top row
        colorGroups['red'].forEach(tile => {
            if (topIndex < 15) {
                sortedRack[topIndex++] = tile;
            }
        });
        if (colorGroups['red'].length > 0 && topIndex < 15) topIndex++; // Add gap

        // Place blue tiles on top row
        colorGroups['blue'].forEach(tile => {
            if (topIndex < 15) {
                sortedRack[topIndex++] = tile;
            }
        });

        // Place black tiles on bottom row
        colorGroups['black'].forEach(tile => {
            if (bottomIndex < 30) {
                sortedRack[bottomIndex++] = tile;
            }
        });
        if (colorGroups['black'].length > 0 && bottomIndex < 30) bottomIndex++; // Add gap

        // Place yellow tiles on bottom row
        colorGroups['yellow'].forEach(tile => {
            if (bottomIndex < 30) {
                sortedRack[bottomIndex++] = tile;
            }
        });
        if (colorGroups['yellow'].length > 0 && bottomIndex < 30) bottomIndex++; // Add gap

        // Place jokers at the end of bottom row
        jokers.forEach(tile => {
            if (bottomIndex < 30) {
                sortedRack[bottomIndex++] = tile;
            }
        });

        newPlayers[mySlot] = { ...newPlayers[mySlot], tiles: sortedRack };

        // Fire-and-forget update to Firebase (no await for faster response)
        const roomRef = doc(collection(db, 'okeyRooms'), roomId);
        updateDoc(roomRef, { players: newPlayers }).catch(err => {
            console.error('Error syncing sorted tiles:', err);
        });
    };

    // Finish game - validate winning hand and end round
    const finishGame = async (discardIndex: number): Promise<boolean> => {
        if (!firebaseEnabled || !db || !roomId) return false;

        const mySlot = getMySlot();
        if (mySlot === -1) return false;

        try {
            const roomRef = doc(collection(db, 'okeyRooms'), roomId);
            let isWinner = false;

            await runTransaction(db, async (transaction) => {
                const snap = await transaction.get(roomRef);
                if (!snap.exists()) return;

                const data = snap.data() as OkeyRoom;

                // Validate it's this player's turn
                if (data.currentTurn !== mySlot) return;

                // Validate player has 15 tiles (needs to discard one to finish)
                const playerTiles = data.players[mySlot].tiles;
                const tileCount = playerTiles.filter(t => t !== null).length;
                if (tileCount !== 15) return;

                // Get the tile being discarded
                const winningTile = playerTiles[discardIndex];
                if (!winningTile) return;

                // Create validation tiles (all tiles except the one being discarded)
                const validationTiles = [...playerTiles];
                validationTiles[discardIndex] = null;

                // Check if this is a winning hand
                isWinner = isWinningHand(validationTiles, data.okeyTile);

                if (isWinner) {
                    transaction.update(roomRef, {
                        phase: 'roundOver',
                        winner: mySlot
                    });
                }
            });

            if (!isWinner) {
                alert("Eliniz okey değil! Lütfen taşları per yapın.");
            }

            return isWinner;
        } catch (error) {
            console.error('Error finishing game:', error);
            setError('Failed to finish game');
            return false;
        }
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
        updateGameState,
        drawFromCenter,
        drawFromDiscard,
        discardTile,
        moveTileInRack,
        autoSortTiles,
        finishGame,
        resetGame,
        reshuffleDiscards,
        endInTie
    };
};

