import { useState, useCallback, useEffect } from 'react';
import { initializeOkeyGame, isWinningHand } from '../logic/okeyLogic';
import type { OkeyGameState } from '../logic/okeyLogic';

export const useOkeyGame = (roomId: string | null) => {
    const [gameState, setGameState] = useState<OkeyGameState | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // Initialize game
    useEffect(() => {
        if (!roomId || roomId === '') {
            try {
                // Local game
                const initial = initializeOkeyGame();
                console.log("Okey Game Initialized", initial);
                setGameState(initial);
            } catch (e) {
                console.error("Failed to initialize Okey game", e);
            }
        }
    }, [roomId]);

    const drawFromCenter = useCallback((targetSlot?: number) => {
        setGameState(prev => {
            if (!prev) return null;
            if (prev.currentTurn !== 0) return prev;
            const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
            if (currentTilesCount >= 15) return prev;

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
                    // Find nearest empty slot by searching outwards
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

            // Check if stack is now empty
            if (newStack.length === 0) {
                return { ...prev, players: newPlayers, centerStack: newStack, phase: 'stackEmpty' };
            }

            return { ...prev, players: newPlayers, centerStack: newStack };
        });
    }, []);

    const drawFromDiscard = useCallback((targetSlot?: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;
            const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
            if (currentTilesCount >= 15) return prev;

            // Previous player for Player 0 is Player 3
            const prevPlayerIdx = 3;
            const discardPile = prev.discardPiles[prevPlayerIdx];
            if (discardPile.length === 0) return prev;

            const newDiscardPiles = [...prev.discardPiles];
            const drawnTile = newDiscardPiles[prevPlayerIdx][newDiscardPiles[prevPlayerIdx].length - 1];
            newDiscardPiles[prevPlayerIdx] = newDiscardPiles[prevPlayerIdx].slice(0, -1);

            const newPlayers = [...prev.players];
            const newRack = [...newPlayers[0].tiles];

            let finalSlot = -1;
            if (targetSlot !== undefined && targetSlot >= 0 && targetSlot < newRack.length) {
                if (newRack[targetSlot] === null) {
                    finalSlot = targetSlot;
                } else {
                    // Find nearest empty slot by searching outwards
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

    const finishGame = useCallback((discardIndex: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const playerTiles = [...prev.players[0].tiles];
            const winningTile = playerTiles[discardIndex];
            if (!winningTile) return prev;

            // Hand for validation is all tiles except the one being discarded to the indicator
            const validationTiles = [...playerTiles];
            validationTiles[discardIndex] = null;

            const isWinner = isWinningHand(validationTiles, prev.okeyTile);

            if (isWinner) {
                return {
                    ...prev,
                    phase: 'roundOver',
                    winner: 0
                };
            } else {
                alert("Eliniz okey değil! Lütfen taşları per yapın.");
                return prev;
            }
        });
    }, []);

    const resetGame = useCallback(() => {
        setGameState(initializeOkeyGame());
    }, []);

    const reshuffleDiscards = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;

            // Collect all tiles from discard piles
            const allDiscards: any[] = [];
            prev.discardPiles.forEach(pile => {
                allDiscards.push(...pile);
            });

            if (allDiscards.length === 0) {
                // Should not happen if we are in stackEmpty, but safety first
                return { ...prev, phase: 'roundOver', winner: null };
            }

            // Shuffle them
            const shuffled = [...allDiscards].sort(() => Math.random() - 0.5);

            return {
                ...prev,
                centerStack: shuffled,
                discardPiles: [[], [], [], []], // Clear discard piles
                phase: 'playing'
            };
        });
    }, []);

    const endInTie = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                phase: 'roundOver',
                winner: null // Tie
            };
        });
    }, []);

    const moveTileInRack = useCallback((fromIndex: number, toIndex: number) => {
        setGameState(prev => {
            if (!prev) return null;

            const newPlayers = [...prev.players];
            const newRack = [...newPlayers[0].tiles];

            const fromTile = newRack[fromIndex];
            newRack[fromIndex] = newRack[toIndex];
            newRack[toIndex] = fromTile;

            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            return {
                ...prev,
                players: newPlayers
            };
        });
    }, []);

    const discardTile = useCallback((index: number) => {
        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const playerTiles = prev.players[0].tiles.filter(t => t !== null);
            if (playerTiles.length !== 15) {
                console.log("Discard blocked: Must have 15 tiles to discard.");
                return prev;
            }

            const newPlayers = [...prev.players];
            const newRack = [...prev.players[0].tiles];
            const discardedTile = newRack[index];

            if (!discardedTile) return prev;

            newRack[index] = null;
            newPlayers[0] = { ...newPlayers[0], tiles: newRack };

            const newDiscardPiles = [...prev.discardPiles];
            newDiscardPiles[0] = [...newDiscardPiles[0], discardedTile];

            // Advance turn
            const nextTurn = (prev.currentTurn + 1) % 4;

            return {
                ...prev,
                players: newPlayers,
                discardPiles: newDiscardPiles,
                currentTurn: nextTurn
            };
        });
    }, []);

    // Simple AI Turn Simulation
    useEffect(() => {
        if (gameState && gameState.currentTurn !== 0 && gameState.phase === 'playing') {
            const timer = setTimeout(() => {
                setGameState(prev => {
                    if (!prev || prev.currentTurn === 0) return prev;

                    const currPlayer = prev.currentTurn;
                    const newPlayers = [...prev.players];
                    const nextTurn = (currPlayer + 1) % 4;

                    // Simulating AI: Draw from center, then discard first tile
                    const newStack = [...prev.centerStack];
                    const drawn = newStack.pop();

                    if (drawn) {
                        const rack = [...newPlayers[currPlayer].tiles];
                        const emptyIdx = rack.findIndex(s => s === null);
                        if (emptyIdx !== -1) rack[emptyIdx] = drawn;

                        // Discard one (simple AI: just the first one)
                        const firstTileIdx = rack.findIndex(s => s !== null);
                        const discarded = rack[firstTileIdx];
                        rack[firstTileIdx] = null;

                        newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };

                        const newDiscardPiles = [...prev.discardPiles];
                        newDiscardPiles[currPlayer] = [...newDiscardPiles[currPlayer], discarded!];

                        // Check if stack is empty after AI draw
                        const finalPhase = newStack.length === 0 ? 'stackEmpty' : 'playing';

                        return {
                            ...prev,
                            centerStack: newStack,
                            players: newPlayers,
                            discardPiles: newDiscardPiles,
                            currentTurn: nextTurn,
                            phase: finalPhase
                        };
                    }

                    return { ...prev, currentTurn: nextTurn };
                });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.currentTurn, gameState?.phase]);

    // Placeholder for network methods
    const createRoom = async () => {
        setIsAuthLoading(true);
        // Simulate async
        await new Promise(r => setTimeout(r, 1000));
        setIsAuthLoading(false);
        return "okey-room-" + Math.random().toString(36).substr(2, 6);
    };

    const joinRoom = async (_id: string) => {
        setIsAuthLoading(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsAuthLoading(false);
    };

    const autoSortTiles = useCallback(() => {
        setGameState(prev => {
            if (!prev) return null;
            const player = prev.players[0];
            const originalTiles = player.tiles.filter((t): t is any => t !== null);

            // Separate joker tiles from normal tiles
            // Pure jokers: isFakeOkey === true (wild tiles)
            // Okey value tiles: match the okeyTile color and value (can act as joker OR be used by value)
            const jokerPool: any[] = [...originalTiles.filter(t => t.isFakeOkey)];
            const okeyValueTiles = originalTiles.filter(t => !t.isFakeOkey && prev.okeyTile && t.color === prev.okeyTile.color && t.value === prev.okeyTile.value);
            const normalTiles = originalTiles.filter(t => !t.isFakeOkey && !(prev.okeyTile && t.color === prev.okeyTile.color && t.value === prev.okeyTile.value));

            // okeyValueTiles can be used both as jokers and by their actual value
            // We'll first try to use them by value, then add remaining to joker pool
            const tilesForRuns = [...normalTiles, ...okeyValueTiles];

            const groups: any[][] = [];
            const remaining = [...tilesForRuns];
            const colors = ['red', 'blue', 'black', 'yellow'];

            // Helper: Create a placeholder joker object for display
            const createJokerPlaceholder = (joker: any, forValue: number, forColor: string) => ({
                ...joker,
                displayValue: forValue,
                displayColor: forColor,
                isJokerPlaceholder: true
            });

            // 1. First pass: Find complete runs (3+ consecutive) without jokers
            colors.forEach(color => {
                let sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);
                let i = 0;
                while (i < sameColor.length) {
                    let currentRun: any[] = [sameColor[i]];
                    let nextVal = sameColor[i].value + 1;
                    let j = i + 1;

                    while (j < sameColor.length) {
                        if (sameColor[j].value === nextVal) {
                            currentRun.push(sameColor[j]);
                            nextVal++;
                            j++;
                        } else if (sameColor[j].value < nextVal) {
                            j++;
                        } else {
                            break;
                        }
                    }

                    // Special case: wrap around 13-1
                    if (currentRun[currentRun.length - 1].value === 13) {
                        const oneTile = sameColor.find(t => t.value === 1);
                        if (oneTile && !currentRun.find(rt => rt.id === oneTile.id)) {
                            currentRun.push(oneTile);
                        }
                    }

                    if (currentRun.length >= 3) {
                        groups.push([...currentRun]);
                        currentRun.forEach(t => {
                            const idx = remaining.findIndex(r => r.id === t.id);
                            if (idx !== -1) remaining.splice(idx, 1);
                        });
                        sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);
                        i = 0;
                    } else {
                        i++;
                    }
                }
            });

            // 2. First pass: Find complete sets (3+ same value, different colors) without jokers
            for (let val = 1; val <= 13; val++) {
                const sameValue = remaining.filter(t => t.value === val);
                const uniqueColors = Array.from(new Set(sameValue.map(t => t.color)));
                if (uniqueColors.length >= 3) {
                    const set = uniqueColors.map(c => sameValue.find(t => t.color === c));
                    groups.push(set);
                    set.forEach(t => {
                        const idx = remaining.findIndex(r => r.id === t.id);
                        if (idx !== -1) remaining.splice(idx, 1);
                    });
                }
            }

            // 3. Use jokers to complete 2-tile runs (need 1 joker to make 3)
            colors.forEach(color => {
                if (jokerPool.length === 0) return;
                const sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);

                for (let i = 0; i < sameColor.length - 1 && jokerPool.length > 0; i++) {
                    const tile1 = sameColor[i];
                    const tile2 = sameColor[i + 1];

                    // Check for consecutive (e.g., 5-6, need joker as 4 or 7)
                    if (tile2.value === tile1.value + 1) {
                        const joker = jokerPool.shift()!;
                        // Prefer adding joker at the end if possible, or beginning
                        if (tile2.value < 13) {
                            // Add joker as tile2.value + 1
                            const jokerTile = createJokerPlaceholder(joker, tile2.value + 1, color);
                            groups.push([tile1, tile2, jokerTile]);
                        } else if (tile1.value > 1) {
                            // Add joker as tile1.value - 1
                            const jokerTile = createJokerPlaceholder(joker, tile1.value - 1, color);
                            groups.push([jokerTile, tile1, tile2]);
                        } else {
                            // Edge case: 1-2, add joker as 3
                            const jokerTile = createJokerPlaceholder(joker, 3, color);
                            groups.push([tile1, tile2, jokerTile]);
                        }
                        // Remove used tiles
                        [tile1, tile2].forEach(t => {
                            const idx = remaining.findIndex(r => r.id === t.id);
                            if (idx !== -1) remaining.splice(idx, 1);
                        });
                        // Recalculate sameColor after modification
                        i = -1; // Reset loop
                    }
                    // Check for gap of 1 (e.g., 5-7, need joker as 6)
                    else if (tile2.value === tile1.value + 2 && jokerPool.length > 0) {
                        const joker = jokerPool.shift()!;
                        const jokerTile = createJokerPlaceholder(joker, tile1.value + 1, color);
                        groups.push([tile1, jokerTile, tile2]);
                        [tile1, tile2].forEach(t => {
                            const idx = remaining.findIndex(r => r.id === t.id);
                            if (idx !== -1) remaining.splice(idx, 1);
                        });
                        i = -1;
                    }
                }
            });

            // 4. Use jokers to complete 2-tile sets (same value, 2 different colors)
            for (let val = 1; val <= 13 && jokerPool.length > 0; val++) {
                const sameValue = remaining.filter(t => t.value === val);
                const uniqueColors = Array.from(new Set(sameValue.map(t => t.color)));

                if (uniqueColors.length === 2) {
                    const joker = jokerPool.shift()!;
                    const missingColor = colors.find(c => !uniqueColors.includes(c))!;
                    const jokerTile = createJokerPlaceholder(joker, val, missingColor);
                    const set = [...uniqueColors.map(c => sameValue.find(t => t.color === c)), jokerTile];
                    groups.push(set);
                    set.forEach(t => {
                        if (!t.isJokerPlaceholder) {
                            const idx = remaining.findIndex(r => r.id === t.id);
                            if (idx !== -1) remaining.splice(idx, 1);
                        }
                    });
                }
            }

            // Construct new rack
            let newRack: (any | null)[] = new Array(30).fill(null);
            let currentPos = 0;

            // Place unused jokers first
            jokerPool.forEach((t: any) => {
                newRack[currentPos++] = t;
            });
            if (jokerPool.length > 0) currentPos++; // Space after jokers

            // Place groups
            groups.forEach(group => {
                group.forEach(t => {
                    newRack[currentPos++] = t;
                });
                currentPos++; // Space between groups
            });

            // Place remaining at the end (bottom shelf)
            let remainingPos = 15;
            while (newRack[remainingPos] !== null && remainingPos < 30) remainingPos++;

            remaining.forEach(t => {
                if (remainingPos < 30) {
                    newRack[remainingPos++] = t;
                }
            });

            const newPlayers = [...prev.players];
            newPlayers[0] = { ...player, tiles: newRack };

            return { ...prev, players: newPlayers };
        });
    }, [gameState?.okeyTile]);

    return {
        gameState,
        moveTileInRack,
        drawFromCenter,
        drawFromDiscard,
        finishGame,
        resetGame,
        discardTile,
        autoSortTiles,
        reshuffleDiscards,
        endInTie,
        createRoom,
        joinRoom,
        isAuthLoading
    };
};
