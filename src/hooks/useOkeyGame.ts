import { useState, useCallback, useEffect } from 'react';
import { initializeOkeyGame, isWinningHand, arrangeTiles, shuffleDeck, chooseBotDraw, chooseBotFinish, chooseBotDiscard } from '../logic/okeyLogic';
import type { OkeyGameState, OkeyTile, BotDifficulty } from '../logic/okeyLogic';

export const useOkeyGame = (roomId: string | null, aiDifficulty: BotDifficulty = 'Normal') => {
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
            const allDiscards: OkeyTile[] = [];
            prev.discardPiles.forEach(pile => {
                allDiscards.push(...pile);
            });

            if (allDiscards.length === 0) {
                // Should not happen if we are in stackEmpty, but safety first
                return { ...prev, phase: 'roundOver', winner: null };
            }

            // Shuffle them (Fisher-Yates — the old sort(random) shuffle was biased)
            const shuffled = shuffleDeck(allDiscards);

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

    // AI Turn Simulation — uses the shared engine bot heuristics.
    useEffect(() => {
        if (gameState && gameState.currentTurn !== 0 && gameState.phase === 'playing') {
            const timer = setTimeout(() => {
                setGameState(prev => {
                    // Phase guard too: the round may have ended between scheduling and firing.
                    if (!prev || prev.currentTurn === 0 || prev.phase !== 'playing') return prev;

                    const currPlayer = prev.currentTurn;
                    const newPlayers = [...prev.players];
                    const nextTurn = (currPlayer + 1) % 4;
                    const rack = [...newPlayers[currPlayer].tiles];
                    const newStack = [...prev.centerStack];
                    const newDiscardPiles = prev.discardPiles.map(pile => [...pile]);

                    // Draw: take the previous player's discard when it is an
                    // immediate meld-maker, otherwise draw from the center.
                    const prevPlayer = (currPlayer + 3) % 4;
                    const prevPile = newDiscardPiles[prevPlayer];
                    const prevTop = prevPile.length > 0 ? prevPile[prevPile.length - 1] : null;
                    let drawn: OkeyTile | null = null;
                    if (prevTop && chooseBotDraw(rack, prevTop, prev.okeyTile) === 'discard') {
                        drawn = prevPile.pop() ?? null;
                    }
                    if (!drawn) drawn = newStack.pop() ?? null;

                    if (!drawn) {
                        // Nothing to draw anywhere — surface the stackEmpty UI.
                        return { ...prev, phase: 'stackEmpty', currentTurn: nextTurn };
                    }

                    const emptyIdx = rack.findIndex(s => s === null);
                    if (emptyIdx !== -1) rack[emptyIdx] = drawn;
                    newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };

                    // Win check BEFORE discarding: if one discard leaves a valid
                    // 14-tile hand, the bot finishes and wins the round.
                    const finishIdx = chooseBotFinish(rack, prev.okeyTile);
                    if (finishIdx !== -1) {
                        const winningTile = rack[finishIdx]!;
                        rack[finishIdx] = null;
                        newDiscardPiles[currPlayer].push(winningTile);
                        return {
                            ...prev,
                            centerStack: newStack,
                            players: newPlayers,
                            discardPiles: newDiscardPiles,
                            phase: 'roundOver',
                            winner: currPlayer
                        };
                    }

                    // Discard the least useful tile (difficulty-aware, never the okey unless forced).
                    const discardIdx = chooseBotDiscard(rack, prev.okeyTile, aiDifficulty);
                    if (discardIdx !== -1) {
                        const discarded = rack[discardIdx]!;
                        rack[discardIdx] = null;
                        newDiscardPiles[currPlayer].push(discarded);
                    }

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
                });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.currentTurn, gameState?.phase, aiDifficulty]);

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
            const newRack = arrangeTiles(player.tiles, prev.okeyTile);
            const newPlayers = [...prev.players];
            newPlayers[0] = { ...player, tiles: newRack };
            return { ...prev, players: newPlayers };
        });
    }, []);

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
