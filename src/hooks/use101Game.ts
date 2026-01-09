import { useState, useCallback, useEffect } from 'react';
import {
    initialize101Game,
    endRound,
    startNewRound,
    isValidMeld,
    canAddToMeld,
    canMakeFirstLayDown,
    smartSort101Tiles,
    sortByRuns,
    sortBySets,
    sortByPairs,
    findRunIndices,
    findSetIndices
} from '../logic/101Logic';
import type { Game101State, Tile101, Meld } from '../logic/101Logic';

let meldIdCounter = 1;

export const use101Game = (roomId: string | null) => {
    const [gameState, setGameState] = useState<Game101State | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [selectedTileIndices, setSelectedTileIndices] = useState<number[]>([]);

    // Initialize game
    useEffect(() => {
        if (!roomId || roomId === '') {
            try {
                const initial = initialize101Game(4);
                console.log("101 Game Initialized", initial);
                setGameState(initial);
            } catch (e) {
                console.error("Failed to initialize 101 game", e);
            }
        }
    }, [roomId]);

    // Toggle tile selection for laying down
    const toggleTileSelection = useCallback((index: number) => {
        setSelectedTileIndices(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            }
            return [...prev, index];
        });
    }, []);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedTileIndices([]);
    }, []);

    // Draw from center stack
    const drawFromCenter = useCallback((targetSlot?: number) => {
        setGameState(prev => {
            if (!prev) return null;
            if (prev.currentTurn !== 0) return prev;

            const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
            if (currentTilesCount >= 15) return prev; // Can't draw if hand is full

            const newStack = [...prev.centerStack];
            const drawnTile = newStack.pop();
            if (!drawnTile) return prev;

            const newPlayers = [...prev.players];
            const newRack = [...newPlayers[0].tiles];

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

            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            return { ...prev, players: newPlayers, centerStack: newStack };
        });
    }, []);

    // Draw from previous player's discard pile (counter-clockwise)
    const drawFromDiscard = useCallback((targetSlot?: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
            if (currentTilesCount >= 15) return prev;

            // Draw from previous player's discard (counter-clockwise, so player 3)
            const prevPlayerIdx = 3; // In single player, we are player 0, prev is 3
            const prevPlayerDiscard = prev.discardPiles[prevPlayerIdx] || [];
            if (prevPlayerDiscard.length === 0) return prev;

            const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
                idx === prevPlayerIdx ? pile.slice(0, -1) : [...pile]
            );
            const drawnTile = prevPlayerDiscard[prevPlayerDiscard.length - 1];

            const newPlayers = [...prev.players];
            const newRack = [...newPlayers[0].tiles];

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

            newPlayers[0] = { ...newPlayers[0], tiles: newRack };
            return { ...prev, players: newPlayers, discardPiles: newDiscardPiles };
        });
    }, []);

    // Discard a tile to own pile and end turn
    const discardTile = useCallback((index: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const playerTiles = prev.players[0].tiles.filter(t => t !== null);
            if (playerTiles.length !== 15) {
                console.log("Must have 15 tiles to discard");
                return prev;
            }

            const newPlayers = [...prev.players];
            const newRack = [...prev.players[0].tiles];
            const discardedTile = newRack[index];

            if (!discardedTile) return prev;

            newRack[index] = null;
            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            // Discard to own pile (player 0)
            const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
                idx === 0 ? [...pile, discardedTile] : [...pile]
            );
            const nextTurn = (prev.currentTurn + 1) % prev.players.length;

            return {
                ...prev,
                players: newPlayers,
                discardPiles: newDiscardPiles,
                currentTurn: nextTurn
            };
        });
        clearSelection();
    }, [clearSelection]);

    // Lay down selected tiles as a new meld
    const layDownMeld = useCallback(() => {
        if (selectedTileIndices.length < 3) {
            alert("En az 3 taş seçmelisiniz!");
            return;
        }

        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const player = prev.players[0];
            const selectedTiles = selectedTileIndices
                .map(idx => player.tiles[idx])
                .filter((t): t is Tile101 => t !== null);

            if (selectedTiles.length < 3) {
                alert("Geçersiz taş seçimi!");
                return prev;
            }

            // Check if valid meld
            const validation = isValidMeld(selectedTiles);
            if (!validation.valid || !validation.type) {
                alert("Bu taşlar geçerli bir per oluşturmuyor!");
                return prev;
            }

            // Check first lay down requirement (51+ points)
            if (!player.hasLaidDown) {
                if (!canMakeFirstLayDown([selectedTiles])) {
                    alert("İlk indiriş için en az 51 puan gerekli!");
                    return prev;
                }
            }

            // Create meld
            const newMeld: Meld = {
                id: `meld-${meldIdCounter++}`,
                tiles: selectedTiles,
                type: validation.type,
                ownerPlayer: 0
            };

            // Remove tiles from hand
            const newRack = [...player.tiles];
            selectedTileIndices.forEach(idx => {
                newRack[idx] = null;
            });

            const newPlayers = [...prev.players];
            newPlayers[0] = {
                ...newPlayers[0],
                tiles: newRack,
                hasLaidDown: true
            };

            // Check if player wins (no tiles left)
            const remainingTiles = newRack.filter(t => t !== null).length;
            const newTableMelds = { ...prev.tableMelds, [newMeld.id]: newMeld };

            if (remainingTiles === 0) {
                return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds }, 0);
            }

            return {
                ...prev,
                players: newPlayers,
                tableMelds: newTableMelds
            };
        });
        clearSelection();
    }, [selectedTileIndices, clearSelection]);

    // Add a tile to an existing meld
    const addToMeld = useCallback((tileIndex: number, meldId: string) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const player = prev.players[0];
            if (!player.hasLaidDown) {
                alert("Önce kendi perinizi indirmelisiniz!");
                return prev;
            }

            const tile = player.tiles[tileIndex];
            if (!tile) return prev;

            const meld = prev.tableMelds[meldId];
            if (!meld) return prev;

            if (!canAddToMeld(meld, tile)) {
                alert("Bu taş bu perlere eklenemez!");
                return prev;
            }

            // Add tile to meld
            const newMelds = {
                ...prev.tableMelds,
                [meldId]: {
                    ...meld,
                    tiles: [...meld.tiles, tile]
                }
            };

            // Remove tile from hand
            const newRack = [...player.tiles];
            newRack[tileIndex] = null;

            const newPlayers = [...prev.players];
            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            // Check if player wins
            const remainingTiles = newRack.filter(t => t !== null).length;
            if (remainingTiles === 0) {
                return endRound({ ...prev, players: newPlayers, tableMelds: newMelds }, 0);
            }

            return {
                ...prev,
                players: newPlayers,
                tableMelds: newMelds
            };
        });
    }, []);

    // Move tile within rack
    const moveTileInRack = useCallback((fromIndex: number, toIndex: number) => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const newRack = [...newPlayers[0].tiles];

            const fromTile = newRack[fromIndex];
            newRack[fromIndex] = newRack[toIndex];
            newRack[toIndex] = fromTile;

            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            return { ...prev, players: newPlayers };
        });
    }, []);

    // Auto sort tiles
    const autoSortTiles = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const sortedTiles = smartSort101Tiles(newPlayers[0].tiles);
            newPlayers[0] = { ...newPlayers[0], tiles: sortedTiles };

            return { ...prev, players: newPlayers };
        });
    }, []);

    // Sort by runs (same color, consecutive)
    const sortTilesByRuns = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const sortedTiles = sortByRuns(newPlayers[0].tiles);
            newPlayers[0] = { ...newPlayers[0], tiles: sortedTiles };

            return { ...prev, players: newPlayers };
        });
    }, []);

    // Sort by sets (same value, different colors)
    const sortTilesBySets = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const sortedTiles = sortBySets(newPlayers[0].tiles);
            newPlayers[0] = { ...newPlayers[0], tiles: sortedTiles };

            return { ...prev, players: newPlayers };
        });
    }, []);

    // Sort by pairs (same color, same value)
    const sortTilesByPairs = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const sortedTiles = sortByPairs(newPlayers[0].tiles);
            newPlayers[0] = { ...newPlayers[0], tiles: sortedTiles };

            return { ...prev, players: newPlayers };
        });
    }, []);

    // Select all runs (for laying down)
    const selectRuns = useCallback(() => {
        if (!gameState) return;
        const runGroups = findRunIndices(gameState.players[0].tiles);
        if (runGroups.length > 0) {
            // Select the first valid run found
            setSelectedTileIndices(runGroups[0]);
        }
    }, [gameState]);

    // Select all sets (for laying down)
    const selectSets = useCallback(() => {
        if (!gameState) return;
        const setGroups = findSetIndices(gameState.players[0].tiles);
        if (setGroups.length > 0) {
            // Select the first valid set found
            setSelectedTileIndices(setGroups[0]);
        }
    }, [gameState]);

    // Reset/restart game
    const resetGame = useCallback(() => {
        setGameState(initialize101Game(4));
        clearSelection();
    }, [clearSelection]);

    // Start new round
    const newRound = useCallback(() => {
        setGameState(prev => {
            if (!prev || prev.phase !== 'roundOver') return prev;
            return startNewRound(prev);
        });
        clearSelection();
    }, [clearSelection]);

    // Finish game (when player has 0 tiles and discards)
    const finishGame = useCallback((discardIndex: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const player = prev.players[0];
            const tile = player.tiles[discardIndex];
            if (!tile) return prev;

            // Check if this is the last tile
            const tileCount = player.tiles.filter(t => t !== null).length;
            if (tileCount !== 1) {
                alert("Son taşınız olmalı!");
                return prev;
            }

            // Discard and win
            const newRack = [...player.tiles];
            newRack[discardIndex] = null;

            const newPlayers = [...prev.players];
            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            // Discard to own pile
            const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
                idx === 0 ? [...pile, tile] : [...pile]
            );

            return endRound(
                { ...prev, players: newPlayers, discardPiles: newDiscardPiles },
                0
            );
        });
    }, []);

    // Smart AI Turn Simulation
    useEffect(() => {
        if (gameState && gameState.currentTurn !== 0 && gameState.phase === 'playing') {
            const timer = setTimeout(() => {
                setGameState(prev => {
                    if (!prev || prev.currentTurn === 0) return prev;

                    const currPlayer = prev.currentTurn;
                    let newPlayers = [...prev.players];
                    const nextTurn = (currPlayer + 1) % prev.players.length;
                    let newTableMelds = { ...prev.tableMelds };

                    // AI: Draw from center
                    const newStack = [...prev.centerStack];
                    const drawn = newStack.pop();

                    if (!drawn) {
                        return { ...prev, currentTurn: nextTurn };
                    }

                    let rack = [...newPlayers[currPlayer].tiles];
                    const emptyIdx = rack.findIndex(s => s === null);
                    if (emptyIdx !== -1) rack[emptyIdx] = drawn;

                    // Get all non-null tiles
                    const getTiles = () => rack.filter((t): t is Tile101 => t !== null);
                    const colorOrder: ('red' | 'blue' | 'black' | 'yellow')[] = ['red', 'blue', 'black', 'yellow'];

                    // Helper: Calculate tile points (for discard strategy)
                    const getTilePoints = (tile: Tile101): number => {
                        if (tile.isFakeOkey) return 25;
                        if (tile.value >= 11) return 10;
                        return tile.value;
                    };

                    // Helper: Find best meld (prioritize high-value melds)
                    const findBestMeld = (): { tiles: Tile101[], type: 'set' | 'run', indices: number[] } | null => {
                        const tiles = getTiles();
                        let bestMeld: { tiles: Tile101[], type: 'set' | 'run', indices: number[], points: number } | null = null;

                        // Find sets (same value, different colors) - prioritize high values
                        for (let value = 13; value >= 1; value--) {
                            const tilesWithValue = tiles.filter(t => t.value === value && !t.isFakeOkey);
                            const uniqueColors = [...new Set(tilesWithValue.map(t => t.color))];

                            if (uniqueColors.length >= 3) {
                                const set: Tile101[] = [];
                                for (const color of colorOrder) {
                                    if (uniqueColors.includes(color)) {
                                        const tile = tilesWithValue.find(t => t.color === color && !set.includes(t));
                                        if (tile) set.push(tile);
                                    }
                                }
                                if (set.length >= 3) {
                                    const points = set.reduce((sum, t) => sum + getTilePoints(t), 0);
                                    if (!bestMeld || points > bestMeld.points) {
                                        const indices = set.map(t => rack.findIndex(rt => rt?.id === t.id));
                                        bestMeld = { tiles: set, type: 'set', indices, points };
                                    }
                                }
                            }
                        }

                        // Find runs (same color, consecutive) - prioritize high values
                        for (const color of colorOrder) {
                            let colorTiles = tiles.filter(t => t.color === color && !t.isFakeOkey);
                            colorTiles.sort((a, b) => b.value - a.value); // Start from high values

                            // Look for runs starting from high values
                            colorTiles.sort((a, b) => a.value - b.value);
                            for (let startIdx = colorTiles.length - 1; startIdx >= 0; startIdx--) {
                                const run: Tile101[] = [colorTiles[startIdx]];
                                let expectedValue = colorTiles[startIdx].value - 1;

                                for (let j = startIdx - 1; j >= 0 && expectedValue >= 1; j--) {
                                    if (colorTiles[j].value === expectedValue) {
                                        run.unshift(colorTiles[j]);
                                        expectedValue--;
                                    }
                                }

                                if (run.length >= 3) {
                                    const points = run.reduce((sum, t) => sum + getTilePoints(t), 0);
                                    if (!bestMeld || points > bestMeld.points) {
                                        const indices = run.map(t => rack.findIndex(rt => rt?.id === t.id));
                                        bestMeld = { tiles: run, type: 'run', indices, points };
                                    }
                                }
                            }
                        }

                        return bestMeld;
                    };

                    // Helper: Check if AI can make first lay down (51+ points)
                    const canMakeFirstLayDown = (meldPoints: number): boolean => {
                        return meldPoints >= 51;
                    };

                    // Try to lay down melds (AI strategy: lay down high-value melds)
                    const player = newPlayers[currPlayer];
                    let hasLaidDown = player.hasLaidDown;

                    // Keep trying to lay down melds while possible
                    for (let attempts = 0; attempts < 5; attempts++) {
                        const bestMeld = findBestMeld();
                        if (!bestMeld) break;

                        const meldPoints = bestMeld.tiles.filter(t => !t.isFakeOkey).reduce((sum, t) => sum + getTilePoints(t), 0);

                        // Check first lay down requirement
                        if (!hasLaidDown && !canMakeFirstLayDown(meldPoints)) {
                            break; // Can't lay down yet
                        }

                        // Lay down the meld
                        const meldId = `meld-ai-${currPlayer}-${Date.now()}-${attempts}`;
                        newTableMelds[meldId] = {
                            id: meldId,
                            tiles: bestMeld.tiles,
                            type: bestMeld.type,
                            ownerPlayer: currPlayer
                        };

                        // Remove tiles from rack
                        for (const idx of bestMeld.indices) {
                            rack[idx] = null;
                        }
                        hasLaidDown = true;

                        // Check if AI won (no tiles left)
                        if (rack.filter(t => t !== null).length === 0) {
                            newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack, hasLaidDown };
                            return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds, centerStack: newStack }, currPlayer);
                        }
                    }

                    // Update player state
                    newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack, hasLaidDown };

                    // Try to add tiles to existing melds (if player has laid down)
                    if (hasLaidDown) {
                        for (const [meldId, meld] of Object.entries(newTableMelds)) {
                            const currentTiles = getTiles();
                            for (const tile of currentTiles) {
                                if (canAddToMeld(meld as Meld, tile)) {
                                    // Add tile to meld
                                    (newTableMelds[meldId] as Meld).tiles = [...(meld as Meld).tiles, tile];
                                    const tileIdx = rack.findIndex(t => t?.id === tile.id);
                                    if (tileIdx !== -1) rack[tileIdx] = null;

                                    newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };

                                    // Check if AI won
                                    if (rack.filter(t => t !== null).length === 0) {
                                        return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds, centerStack: newStack }, currPlayer);
                                    }
                                    break; // Only add one tile per turn to melds
                                }
                            }
                        }
                    }

                    // AI: Discard the LOWEST value tile (smart strategy)
                    const tilesWithIdx = rack
                        .map((t, idx) => ({ tile: t, idx }))
                        .filter((item): item is { tile: Tile101, idx: number } => item.tile !== null);

                    if (tilesWithIdx.length > 0) {
                        // Sort by points ascending (lowest first), but avoid discarding jokers
                        tilesWithIdx.sort((a, b) => {
                            // Never discard jokers if possible
                            if (a.tile.isFakeOkey && !b.tile.isFakeOkey) return 1;
                            if (!a.tile.isFakeOkey && b.tile.isFakeOkey) return -1;
                            return getTilePoints(a.tile) - getTilePoints(b.tile);
                        });

                        const lowestTile = tilesWithIdx[0];
                        const discarded = rack[lowestTile.idx];
                        rack[lowestTile.idx] = null;

                        newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };

                        // Discard to AI's own pile
                        const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
                            idx === currPlayer ? (discarded ? [...pile, discarded] : [...pile]) : [...pile]
                        );

                        return {
                            ...prev,
                            centerStack: newStack,
                            players: newPlayers,
                            discardPiles: newDiscardPiles,
                            tableMelds: newTableMelds,
                            currentTurn: nextTurn
                        };
                    }

                    return { ...prev, centerStack: newStack, players: newPlayers, tableMelds: newTableMelds, currentTurn: nextTurn };
                });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.currentTurn, gameState?.phase]);

    // Placeholder network methods
    const createRoom = async () => {
        setIsAuthLoading(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsAuthLoading(false);
        return "101-room-" + Math.random().toString(36).substr(2, 6);
    };

    const joinRoom = async (_id: string) => {
        setIsAuthLoading(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsAuthLoading(false);
    };

    return {
        gameState,
        selectedTileIndices,
        toggleTileSelection,
        clearSelection,
        moveTileInRack,
        drawFromCenter,
        drawFromDiscard,
        discardTile,
        layDownMeld,
        addToMeld,
        finishGame,
        resetGame,
        newRound,
        autoSortTiles,
        sortTilesByRuns,
        sortTilesBySets,
        sortTilesByPairs,
        selectRuns,
        selectSets,
        createRoom,
        joinRoom,
        isAuthLoading
    };
};

