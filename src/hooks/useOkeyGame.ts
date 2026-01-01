import { useState, useCallback, useEffect } from 'react';
import { initializeOkeyGame, isWinningHand } from '../logic/okeyLogic';
import type { OkeyGameState } from '../logic/okeyLogic';

export const useOkeyGame = (roomId: string | null) => {
    const [gameState, setGameState] = useState<OkeyGameState | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // Initialize game
    useEffect(() => {
        if (!roomId) {
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

            // Separate Joker/Fake Okey
            const normalTiles = originalTiles.filter(t => !t.isFakeOkey && !(prev.okeyTile && t.color === prev.okeyTile.color && t.value === prev.okeyTile.value));
            const jokerTiles = originalTiles.filter(t => t.isFakeOkey || (prev.okeyTile && t.color === prev.okeyTile.color && t.value === prev.okeyTile.value));

            const groups: any[][] = [];
            const remaining = [...normalTiles];

            // 1. Logic for Color Runs (e.g., Blue 1, 2, 3)
            const colors = ['red', 'blue', 'black', 'yellow'];
            colors.forEach(color => {
                const sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);
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
                            // Skip duplicates of the same value in the same color
                            j++;
                        } else {
                            break;
                        }
                    }

                    // Special case: 11-12-13-1 or 12-13-1
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
                        // Move i past this run, but since we spliced 'remaining', 
                        // we should just recalculate or be careful. 
                        // Simpler: restart searching since we modified 'remaining'
                        const nextSameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);
                        sameColor.length = 0;
                        sameColor.push(...nextSameColor);
                        i = 0;
                    } else {
                        i++;
                    }
                }
            });

            // 2. Logic for Same Value Sets (e.g., Red 5, Blue 5, Black 5)
            for (let val = 1; val <= 13; val++) {
                const sameValue = remaining.filter(t => t.value === val);
                // Must have different colors
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

            // Construct new rack
            let newRack: (any | null)[] = new Array(30).fill(null);
            let currentPos = 0;

            // Place Jokers first or at the very beginning
            jokerTiles.forEach(t => {
                newRack[currentPos++] = t;
            });
            if (jokerTiles.length > 0) currentPos++; // Space after jokers

            // Place groups
            groups.forEach(group => {
                group.forEach(t => {
                    newRack[currentPos++] = t;
                });
                currentPos++; // Space between groups
            });

            // Place remaining at the end (bottom shelf)
            let remainingPos = 15; // Start of second row
            // Find first null in second row
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
