import { useState, useCallback, useEffect } from 'react';
import {
    initialize101Game,
    endRound,
    endRoundInDraw,
    startNewRound,
    isValidMeld,
    canAddToMeld,
    canMakePairOpen,
    canTakeDiscardToOpen,
    extractPairs,
    getMeldPoints,
    findPairIndices,
    computeAIMove,
    smartSort101Tiles,
    sortByRuns,
    sortBySets,
    sortByPairs,
    findRunIndices,
    MAX_HAND_SIZE,
    FIRST_MELD_MINIMUM,
    PAIR_OPEN_MINIMUM,
} from '../logic/101Logic';
import type { Game101State, Tile101, Meld } from '../logic/101Logic';

let meldIdCounter = 1;

export const use101Game = (roomId: string | null) => {
    const [gameState, setGameState] = useState<Game101State | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [selectedTileIndices, setSelectedTileIndices] = useState<number[]>([]);
    // Turn discipline: draw → (meld) → discard. Starter begins with 22 tiles.
    const [drawnThisTurn, setDrawnThisTurn] = useState(true);
    /** Progressive normal-open points laid this turn before reaching 101. */
    const [openingPointsThisTurn, setOpeningPointsThisTurn] = useState(0);

    // Initialize game
    useEffect(() => {
        if (!roomId || roomId === '') {
            try {
                const initial = initialize101Game(4);
                console.log("101 Game Initialized", initial);
                setGameState(initial);
                setDrawnThisTurn(true); // player 0 starts with 22 tiles
                setOpeningPointsThisTurn(0);
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
        const prev = gameState;
        if (!prev || prev.currentTurn !== 0 || prev.phase !== 'playing') return;
        if (drawnThisTurn) return; // Already drew this turn

        const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
        if (currentTilesCount >= MAX_HAND_SIZE) return; // Can't draw if hand is full

        const newStack = [...prev.centerStack];
        const drawnTile = newStack.pop();
        if (!drawnTile) {
            // Yığın bitti — tur berabere biter, kimse el puanı yazmaz.
            setGameState(endRoundInDraw(prev));
            return;
        }

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

        setGameState({ ...prev, players: newPlayers, centerStack: newStack });
        setDrawnThisTurn(true);
        setOpeningPointsThisTurn(0);
    }, [gameState, drawnThisTurn]);

    // Draw from previous player's discard pile (counter-clockwise)
    const drawFromDiscard = useCallback((targetSlot?: number) => {
        const prev = gameState;
        if (!prev || prev.currentTurn !== 0 || prev.phase !== 'playing') return;
        if (drawnThisTurn) return; // Already drew this turn

        const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
        if (currentTilesCount >= MAX_HAND_SIZE) return;

        // Draw from previous player's discard (counter-clockwise, so player 3)
        const prevPlayerIdx = 3; // In single player, we are player 0, prev is 3
        const prevPlayerDiscard = prev.discardPiles[prevPlayerIdx] || [];
        if (prevPlayerDiscard.length === 0) return;

        const drawnTile = prevPlayerDiscard[prevPlayerDiscard.length - 1];

        // Classic: unopened players may take discard only if it enables opening.
        if (!prev.players[0].hasLaidDown && !canTakeDiscardToOpen(prev.players[0].tiles, drawnTile)) {
            alert('Yan taşı yalnızca onunla elini açabileceksen alabilirsin!');
            return;
        }

        const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
            idx === prevPlayerIdx ? pile.slice(0, -1) : [...pile]
        );

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
        setGameState({ ...prev, players: newPlayers, discardPiles: newDiscardPiles });
        setDrawnThisTurn(true);
        setOpeningPointsThisTurn(0);
    }, [gameState, drawnThisTurn]);

    // Discard a tile to own pile and end turn
    const discardTile = useCallback((index: number) => {
        const prev = gameState;
        if (!prev || prev.currentTurn !== 0 || prev.phase !== 'playing') return;

        if (!drawnThisTurn) {
            console.log("Must draw before discarding");
            return;
        }

        if (!prev.players[0].hasLaidDown && openingPointsThisTurn > 0 && openingPointsThisTurn < FIRST_MELD_MINIMUM) {
            alert(`Açılışı ${FIRST_MELD_MINIMUM} puana tamamlamadan taş atamazsın!`);
            return;
        }

        const newPlayers = [...prev.players];
        const newRack = [...prev.players[0].tiles];
        const discardedTile = newRack[index];

        if (!discardedTile) return;

        const okey = prev.okeyTile;
        const isRealOkey =
            !!okey &&
            !discardedTile.isFakeOkey &&
            discardedTile.color === okey.color &&
            discardedTile.value === okey.value;
        if (discardedTile.isFakeOkey || isRealOkey) {
            alert('Okey taşını yere atamazsın! (+101 ceza)');
            return;
        }

        newRack[index] = null;
        newPlayers[0] = { ...newPlayers[0], tiles: newRack };

        // Discard to own pile (player 0)
        const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
            idx === 0 ? [...pile, discardedTile] : [...pile]
        );

        // Discarding the last tile wins the round
        if (newRack.filter(t => t !== null).length === 0) {
            setGameState(endRound(
                { ...prev, players: newPlayers, discardPiles: newDiscardPiles },
                0
            ));
            clearSelection();
            setOpeningPointsThisTurn(0);
            return;
        }

        const nextTurn = (prev.currentTurn + 1) % prev.players.length;

        setGameState({
            ...prev,
            players: newPlayers,
            discardPiles: newDiscardPiles,
            currentTurn: nextTurn
        });
        setDrawnThisTurn(false);
        setOpeningPointsThisTurn(0);
        clearSelection();
    }, [gameState, drawnThisTurn, openingPointsThisTurn, clearSelection]);

    // Lay down selected tiles as a new meld (normal open ≥101, progressive within turn)
    const layDownMeld = useCallback(() => {
        if (selectedTileIndices.length < 3) {
            alert("En az 3 taş seçmelisiniz!");
            return;
        }

        if (!drawnThisTurn) {
            alert("Önce taş çekmelisiniz!");
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

            const meldPoints = getMeldPoints(selectedTiles, validation.type);
            let nextOpening = openingPointsThisTurn;
            let hasLaidDown = player.hasLaidDown;
            let openedWithPairs = player.openedWithPairs;

            if (!hasLaidDown) {
                nextOpening += meldPoints;
                if (nextOpening >= FIRST_MELD_MINIMUM) {
                    hasLaidDown = true;
                    nextOpening = 0;
                }
                // Defer setOpeningPointsThisTurn after state update
                queueMicrotask(() => setOpeningPointsThisTurn(nextOpening));
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
                hasLaidDown,
                openedWithPairs,
            };

            // Check if player wins (no tiles left)
            const remainingTiles = newRack.filter(t => t !== null).length;
            const newTableMelds = { ...prev.tableMelds, [newMeld.id]: newMeld };

            if (remainingTiles === 0) {
                if (!hasLaidDown) {
                    alert(`İlk açış en az ${FIRST_MELD_MINIMUM} puan olmalı!`);
                    return prev;
                }
                return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds }, 0);
            }

            return {
                ...prev,
                players: newPlayers,
                tableMelds: newTableMelds
            };
        });
        clearSelection();
    }, [selectedTileIndices, drawnThisTurn, openingPointsThisTurn, clearSelection]);

    /** Classic çift açış: lay ≥5 identical pairs in one action. */
    const layDownPairs = useCallback(() => {
        if (!drawnThisTurn) {
            alert('Önce taş çekmelisiniz!');
            return;
        }

        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;
            const player = prev.players[0];
            if (player.hasLaidDown) {
                alert('Zaten açtın!');
                return prev;
            }

            const source =
                selectedTileIndices.length > 0
                    ? selectedTileIndices.map(i => player.tiles[i]).filter((t): t is Tile101 => t !== null)
                    : player.tiles.filter((t): t is Tile101 => t !== null);

            if (!canMakePairOpen(source)) {
                alert(`Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli!`);
                return prev;
            }

            const pairs = extractPairs(source, 99);
            if (pairs.length < PAIR_OPEN_MINIMUM) {
                alert(`Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli!`);
                return prev;
            }

            const newRack = [...player.tiles];
            const newTableMelds = { ...prev.tableMelds };
            for (const pairTiles of pairs) {
                const id = `meld-${meldIdCounter++}`;
                newTableMelds[id] = { id, tiles: pairTiles, type: 'pair', ownerPlayer: 0 };
                for (const t of pairTiles) {
                    const i = newRack.findIndex(h => h?.id === t.id);
                    if (i !== -1) newRack[i] = null;
                }
            }

            const newPlayers = [...prev.players];
            newPlayers[0] = {
                ...newPlayers[0],
                tiles: newRack,
                hasLaidDown: true,
                openedWithPairs: true,
            };

            if (newRack.filter(t => t !== null).length === 0) {
                return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds }, 0);
            }

            return { ...prev, players: newPlayers, tableMelds: newTableMelds };
        });
        setOpeningPointsThisTurn(0);
        clearSelection();
    }, [selectedTileIndices, drawnThisTurn, clearSelection]);

    // Add a tile to an existing meld
    const addToMeld = useCallback((tileIndex: number, meldId: string) => {
        if (!drawnThisTurn) {
            alert("Önce taş çekmelisiniz!");
            return;
        }

        setGameState(prev => {
            if (!prev || prev.currentTurn !== 0) return prev;

            const player = prev.players[0];
            if (!player.hasLaidDown) {
                alert("Önce elini açmalısın (101 puan veya 5 çift)!");
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
    }, [drawnThisTurn]);

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

    // Select identical pairs for pair-open (çift açış)
    const selectSets = useCallback(() => {
        if (!gameState) return;
        const pairGroups = findPairIndices(gameState.players[0].tiles);
        if (pairGroups.length > 0) {
            // Select first PAIR_OPEN_MINIMUM pairs (or all if fewer)
            const flat = pairGroups.slice(0, PAIR_OPEN_MINIMUM).flat();
            setSelectedTileIndices(flat);
        }
    }, [gameState]);

    // Reset/restart game
    const resetGame = useCallback(() => {
        setGameState(initialize101Game(4));
        setDrawnThisTurn(true); // player 0 starts with 22 tiles
        setOpeningPointsThisTurn(0);
        clearSelection();
    }, [clearSelection]);

    // Start new round (works after a drawn round too: dealer falls back to 0)
    const newRound = useCallback(() => {
        const prev = gameState;
        if (!prev || prev.phase !== 'roundOver') return;
        const next = startNewRound(prev);
        setGameState(next);
        setDrawnThisTurn(next.currentTurn === 0); // starter already holds the extra tile
        setOpeningPointsThisTurn(0);
        clearSelection();
    }, [gameState, clearSelection]);

    // Finish game (when player has 0 tiles and discards)
    const finishGame = useCallback((discardIndex: number) => {
        if (!drawnThisTurn) {
            alert("Önce taş çekmelisiniz!");
            return;
        }

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
    }, [drawnThisTurn]);

    // Smart AI Turn Simulation — delegates to the shared engine so local & online match.
    useEffect(() => {
        if (gameState && gameState.currentTurn !== 0 && gameState.phase === 'playing') {
            const timer = setTimeout(() => {
                setGameState(prev => {
                    if (!prev || prev.currentTurn === 0 || prev.phase !== 'playing') return prev;
                    return computeAIMove(prev);
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
        layDownPairs,
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

