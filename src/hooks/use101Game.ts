import { useState, useCallback, useEffect } from 'react';
import {
    initialize101Game,
    endRound,
    endRoundStackEmpty,
    startNewRound,
    isValidMeld,
    isWildOkey,
    canAddToMeld,
    canMakePairOpen,
    canTakeDiscardToOpen,
    extractPairs,
    getMeldPoints,
    orderMeldTiles,
    addTileToMeld,
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
    OKEY_DISCARD_PENALTY,
} from '../logic/101Logic';
import type { Game101State, Tile101, Meld } from '../logic/101Logic';

let meldIdCounter = 1;

/** State to restore with "Geri Al": taken before this turn's side-tile take / first opening meld. */
interface TurnSnapshot {
    state: Game101State;
    drawn: boolean;
    openingPoints: number;
}

const placeInRack = (rack: (Tile101 | null)[], tile: Tile101, targetSlot?: number) => {
    let finalSlot = -1;
    if (targetSlot !== undefined && targetSlot >= 0 && targetSlot < rack.length) {
        if (rack[targetSlot] === null) {
            finalSlot = targetSlot;
        } else {
            for (let dist = 1; dist < rack.length; dist++) {
                const right = targetSlot + dist;
                const left = targetSlot - dist;
                if (right < rack.length && rack[right] === null) { finalSlot = right; break; }
                if (left >= 0 && rack[left] === null) { finalSlot = left; break; }
            }
        }
    }
    if (finalSlot === -1) finalSlot = rack.findIndex(s => s === null);
    if (finalSlot !== -1) rack[finalSlot] = tile;
    else rack.push(tile);
};

/** Whether the side tile taken this turn is still on the rack (i.e. not yet used). */
const sideTileStillInRack = (s: Game101State, sideTileId: string | null) =>
    !!sideTileId && s.players[0].tiles.some(t => t?.id === sideTileId);

const SIDE_TILE_MSG = 'Yan taşı aldın: bu tur o taşı kullanarak elini açmalısın. Vazgeçmek için "Geri Al"a bas.';
const PARTIAL_OPEN_MSG = `Açılışı ${FIRST_MELD_MINIMUM} puana tamamlamadan taş atamazsın! Perleri geri almak için "Geri Al"a bas.`;

export const use101Game = (roomId: string | null) => {
    const [gameState, setGameState] = useState<Game101State | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [selectedTileIndices, setSelectedTileIndices] = useState<number[]>([]);
    // Turn discipline: draw → (meld) → discard. Starter begins with 22 tiles.
    const [drawnThisTurn, setDrawnThisTurn] = useState(true);
    /** Progressive normal-open points laid this turn before reaching 101. */
    const [openingPointsThisTurn, setOpeningPointsThisTurn] = useState(0);
    /** Side tile taken this turn while unopened — it must be used in this turn's opening. */
    const [sideTileId, setSideTileId] = useState<string | null>(null);
    const [turnSnapshot, setTurnSnapshot] = useState<TurnSnapshot | null>(null);

    const resetTurnState = useCallback((drawn: boolean) => {
        setDrawnThisTurn(drawn);
        setOpeningPointsThisTurn(0);
        setSideTileId(null);
        setTurnSnapshot(null);
        setSelectedTileIndices([]);
    }, []);

    // Initialize game
    useEffect(() => {
        if (!roomId || roomId === '') {
            try {
                const initial = initialize101Game(4);
                setGameState(initial);
                resetTurnState(initial.currentTurn === 0); // starter already holds 22 tiles
            } catch (e) {
                console.error("Failed to initialize 101 game", e);
            }
        }
    }, [roomId, resetTurnState]);

    const isMyActiveTurn = (s: Game101State | null): s is Game101State =>
        !!s && s.currentTurn === 0 && s.phase === 'playing';

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
        if (!isMyActiveTurn(prev)) return;
        if (drawnThisTurn) return; // Already drew this turn

        const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
        if (currentTilesCount >= MAX_HAND_SIZE) return; // Can't draw if hand is full

        const newStack = [...prev.centerStack];
        const drawnTile = newStack.pop();
        if (!drawnTile) {
            // Deste bitti — el kazanansız biter, cezalar yazılır.
            setGameState(endRoundStackEmpty(prev));
            resetTurnState(false);
            return;
        }

        const newPlayers = [...prev.players];
        const newRack = [...newPlayers[0].tiles];
        placeInRack(newRack, drawnTile, targetSlot);
        newPlayers[0] = { ...newPlayers[0], tiles: newRack };

        setGameState({ ...prev, players: newPlayers, centerStack: newStack });
        setDrawnThisTurn(true);
        setOpeningPointsThisTurn(0);
    }, [gameState, drawnThisTurn, resetTurnState]);

    // Draw from previous player's discard pile (counter-clockwise)
    const drawFromDiscard = useCallback((targetSlot?: number) => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        if (drawnThisTurn) return; // Already drew this turn

        const currentTilesCount = prev.players[0].tiles.filter(t => t !== null).length;
        if (currentTilesCount >= MAX_HAND_SIZE) return;

        const prevPlayerIdx = (prev.players.length - 1) % prev.players.length; // seat to our left
        const prevPlayerDiscard = prev.discardPiles[prevPlayerIdx] || [];
        if (prevPlayerDiscard.length === 0) return;

        const drawnTile = prevPlayerDiscard[prevPlayerDiscard.length - 1];
        const unopened = !prev.players[0].hasLaidDown;

        // Classic: unopened players may take the side tile only to open with it this turn.
        if (unopened && !canTakeDiscardToOpen(prev.players[0].tiles, drawnTile, prev.okeyTile)) {
            alert('Yan taşı yalnızca onunla bu tur elini açabileceksen alabilirsin!');
            return;
        }

        const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
            idx === prevPlayerIdx ? pile.slice(0, -1) : [...pile]
        );
        const newPlayers = [...prev.players];
        const newRack = [...newPlayers[0].tiles];
        placeInRack(newRack, drawnTile, targetSlot);
        newPlayers[0] = { ...newPlayers[0], tiles: newRack };

        if (unopened) {
            setTurnSnapshot({ state: prev, drawn: false, openingPoints: 0 });
            setSideTileId(drawnTile.id);
        }
        setGameState({ ...prev, players: newPlayers, discardPiles: newDiscardPiles });
        setDrawnThisTurn(true);
        setOpeningPointsThisTurn(0);
    }, [gameState, drawnThisTurn]);

    // Discard a tile to own pile and end turn
    const discardTile = useCallback((index: number) => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        if (!drawnThisTurn) return; // must draw first

        const me = prev.players[0];
        if (!me.hasLaidDown && openingPointsThisTurn > 0) {
            alert(PARTIAL_OPEN_MSG);
            return;
        }
        if (sideTileId && (!me.hasLaidDown || sideTileStillInRack(prev, sideTileId))) {
            alert(SIDE_TILE_MSG);
            return;
        }

        const newRack = [...me.tiles];
        const discardedTile = newRack[index];
        if (!discardedTile) return;

        let penalty = 0;
        if (isWildOkey(discardedTile, prev.okeyTile)) {
            const onlyOkeysLeft = newRack.every(t => !t || isWildOkey(t, prev.okeyTile));
            if (!onlyOkeysLeft) {
                alert('Okey taşını yere atamazsın!');
                return;
            }
            const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(`Elinde yalnızca Okey kaldı. Okey'i atarsan +${OKEY_DISCARD_PENALTY} ceza yazılır. Atılsın mı?`)
                : true;
            if (!ok) return;
            penalty = OKEY_DISCARD_PENALTY;
        }

        newRack[index] = null;
        const newPlayers = [...prev.players];
        newPlayers[0] = { ...me, tiles: newRack, score: me.score + penalty };
        const newDiscardPiles = prev.discardPiles.map((pile, idx) =>
            idx === 0 ? [...pile, discardedTile] : [...pile]
        );
        const after: Game101State = { ...prev, players: newPlayers, discardPiles: newDiscardPiles };

        if (newRack.every(t => t === null)) {
            // Discarding the last tile wins the round
            setGameState(endRound(after, 0));
        } else if (prev.centerStack.length === 0) {
            // Deste bitti — el kazanansız biter, cezalar yazılır.
            setGameState(endRoundStackEmpty(after));
        } else {
            setGameState({ ...after, currentTurn: (prev.currentTurn + 1) % prev.players.length });
        }
        resetTurnState(false);
    }, [gameState, drawnThisTurn, openingPointsThisTurn, sideTileId, resetTurnState]);

    // Lay down selected tiles as a new meld (normal open ≥101, progressive within turn)
    const layDownMeld = useCallback(() => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        const indices = [...new Set(selectedTileIndices)];
        if (indices.length < 3) {
            alert("En az 3 taş seçmelisiniz!");
            return;
        }
        if (!drawnThisTurn) {
            alert("Önce taş çekmelisiniz!");
            return;
        }

        const player = prev.players[0];
        const selectedTiles = indices.map(idx => player.tiles[idx]).filter((t): t is Tile101 => !!t);
        if (selectedTiles.length !== indices.length) {
            alert("Geçersiz taş seçimi!");
            return;
        }

        const okey = prev.okeyTile;
        const validation = isValidMeld(selectedTiles, okey);
        if (!validation.valid || !validation.type) {
            alert("Bu taşlar geçerli bir per oluşturmuyor!");
            return;
        }

        const meldPoints = getMeldPoints(selectedTiles, validation.type, okey);
        let nextOpening = openingPointsThisTurn;
        let hasLaidDown = player.hasLaidDown;

        const newRack = [...player.tiles];
        indices.forEach(idx => { newRack[idx] = null; });
        const remainingTiles = newRack.filter(t => t !== null).length;

        if (!hasLaidDown) {
            nextOpening += meldPoints;
            if (nextOpening >= FIRST_MELD_MINIMUM) {
                hasLaidDown = true;
                nextOpening = 0;
            }
            if (remainingTiles === 0 && !hasLaidDown) {
                alert(`İlk açış en az ${FIRST_MELD_MINIMUM} puan olmalı!`);
                return;
            }
            // First unopened meld this turn → remember the state for "Geri Al".
            if (!turnSnapshot) {
                setTurnSnapshot({ state: prev, drawn: drawnThisTurn, openingPoints: openingPointsThisTurn });
            }
        }

        const newMeld: Meld = {
            id: `meld-${meldIdCounter++}`,
            tiles: orderMeldTiles(selectedTiles, validation.type, okey),
            type: validation.type,
            ownerPlayer: 0
        };
        const newPlayers = [...prev.players];
        newPlayers[0] = { ...player, tiles: newRack, hasLaidDown };
        const next: Game101State = {
            ...prev,
            players: newPlayers,
            tableMelds: { ...prev.tableMelds, [newMeld.id]: newMeld },
        };

        setGameState(remainingTiles === 0 ? endRound(next, 0) : next);
        setOpeningPointsThisTurn(nextOpening);
        setSelectedTileIndices([]);
    }, [gameState, selectedTileIndices, drawnThisTurn, openingPointsThisTurn, turnSnapshot]);

    /** Classic çift açış: lay ≥5 pairs in one action. */
    const layDownPairs = useCallback(() => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        if (!drawnThisTurn) {
            alert('Önce taş çekmelisiniz!');
            return;
        }
        const player = prev.players[0];
        if (player.hasLaidDown) {
            alert('Zaten açtın!');
            return;
        }
        if (openingPointsThisTurn > 0) {
            alert('Bu tur normal açışa başladın; çift açışla karıştıramazsın. Perleri geri almak için "Geri Al"a bas.');
            return;
        }

        const okey = prev.okeyTile;
        const indices = [...new Set(selectedTileIndices)];
        const source =
            indices.length > 0
                ? indices.map(i => player.tiles[i]).filter((t): t is Tile101 => !!t)
                : player.tiles.filter((t): t is Tile101 => !!t);

        if (!canMakePairOpen(source, okey)) {
            alert(`Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli!`);
            return;
        }
        const sideTile = sideTileId ? source.find(t => t.id === sideTileId) ?? null : null;
        const pairs = extractPairs(source, 99, okey, sideTile);
        if (pairs.length < PAIR_OPEN_MINIMUM) {
            alert(sideTileId
                ? 'Yan taş çiftlerden birinde kullanılmalı ve en az 5 çift gerekli!'
                : `Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli!`);
            return;
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
        newPlayers[0] = { ...player, tiles: newRack, hasLaidDown: true, openedWithPairs: true };
        const next: Game101State = { ...prev, players: newPlayers, tableMelds: newTableMelds };
        setGameState(newRack.every(t => t === null) ? endRound(next, 0) : next);
        setOpeningPointsThisTurn(0);
        setSelectedTileIndices([]);
    }, [gameState, selectedTileIndices, drawnThisTurn, openingPointsThisTurn, sideTileId]);

    // Add a tile to an existing meld
    const addToMeld = useCallback((tileIndex: number, meldId: string) => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        if (!drawnThisTurn) {
            alert("Önce taş çekmelisiniz!");
            return;
        }
        const player = prev.players[0];
        if (!player.hasLaidDown) {
            alert("Önce elini açmalısın (101 puan veya 5 çift)!");
            return;
        }
        const tile = player.tiles[tileIndex];
        if (!tile) return;
        const meld = prev.tableMelds[meldId];
        if (!meld) return;
        if (!canAddToMeld(meld, tile, prev.okeyTile)) {
            alert("Bu taş bu perlere eklenemez!");
            return;
        }

        const newMelds = {
            ...prev.tableMelds,
            [meldId]: { ...meld, tiles: addTileToMeld(meld, tile, prev.okeyTile) },
        };
        const newRack = [...player.tiles];
        newRack[tileIndex] = null;
        const newPlayers = [...prev.players];
        newPlayers[0] = { ...player, tiles: newRack };
        const next: Game101State = { ...prev, players: newPlayers, tableMelds: newMelds };
        setGameState(newRack.every(t => t === null) ? endRound(next, 0) : next);
    }, [gameState, drawnThisTurn]);

    /** "Geri Al": undo this turn's unopened melds and/or the side-tile take. */
    const undoTurn = useCallback(() => {
        const prev = gameState;
        if (!isMyActiveTurn(prev) || !turnSnapshot) return;
        setGameState(turnSnapshot.state);
        setDrawnThisTurn(turnSnapshot.drawn);
        setOpeningPointsThisTurn(turnSnapshot.openingPoints);
        setSideTileId(null);
        setTurnSnapshot(null);
        setSelectedTileIndices([]);
    }, [gameState, turnSnapshot]);

    const canUndo = !!turnSnapshot && isMyActiveTurn(gameState) &&
        (!gameState.players[0].hasLaidDown || sideTileStillInRack(gameState, sideTileId));

    // Move tile within rack
    const moveTileInRack = useCallback((fromIndex: number, toIndex: number) => {
        setGameState(prev => {
            if (!prev) return null;
            const rack = prev.players[0].tiles;
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= rack.length || toIndex >= rack.length) return prev;

            const newPlayers = [...prev.players];
            const newRack = [...rack];
            const fromTile = newRack[fromIndex];
            newRack[fromIndex] = newRack[toIndex];
            newRack[toIndex] = fromTile;
            newPlayers[0] = { ...newPlayers[0], tiles: newRack };
            return { ...prev, players: newPlayers };
        });
        // Keep the selection pointing at the same tiles after the swap.
        setSelectedTileIndices(sel => sel.map(i => (i === fromIndex ? toIndex : i === toIndex ? fromIndex : i)));
    }, []);

    const sortWith = useCallback((fn: (tiles: (Tile101 | null)[], okey: Tile101 | null) => (Tile101 | null)[]) => {
        setGameState(prev => {
            if (!prev) return null;
            const newPlayers = [...prev.players];
            newPlayers[0] = { ...newPlayers[0], tiles: fn(newPlayers[0].tiles, prev.okeyTile) };
            return { ...prev, players: newPlayers };
        });
        setSelectedTileIndices([]);
    }, []);

    // Auto sort tiles
    const autoSortTiles = useCallback(() => sortWith(smartSort101Tiles), [sortWith]);
    // Sort by runs (same color, consecutive)
    const sortTilesByRuns = useCallback(() => sortWith(sortByRuns), [sortWith]);
    // Sort by sets (same value, different colors)
    const sortTilesBySets = useCallback(() => sortWith(sortBySets), [sortWith]);
    // Sort by pairs (same color, same value)
    const sortTilesByPairs = useCallback(() => sortWith(sortByPairs), [sortWith]);

    // Select all runs (for laying down)
    const selectRuns = useCallback(() => {
        if (!gameState) return;
        const runGroups = findRunIndices(gameState.players[0].tiles, gameState.okeyTile);
        if (runGroups.length > 0) {
            // Select the first valid run found
            setSelectedTileIndices(runGroups[0]);
        }
    }, [gameState]);

    // Select pairs for pair-open (çift açış)
    const selectSets = useCallback(() => {
        if (!gameState) return;
        const pairGroups = findPairIndices(gameState.players[0].tiles, gameState.okeyTile);
        if (pairGroups.length > 0) {
            setSelectedTileIndices(pairGroups.flat());
        }
    }, [gameState]);

    // Reset/restart game
    const resetGame = useCallback(() => {
        const next = initialize101Game(4);
        setGameState(next);
        resetTurnState(next.currentTurn === 0); // starter already holds 22 tiles
    }, [resetTurnState]);

    // Start new round (dealer rotates; after a winnerless round the deal passes on)
    const newRound = useCallback(() => {
        const prev = gameState;
        if (!prev || prev.phase !== 'roundOver') return;
        const next = startNewRound(prev);
        setGameState(next);
        resetTurnState(next.currentTurn === 0); // starter already holds the extra tile
    }, [gameState, resetTurnState]);

    // Finish game (discard the last tile) — same rules as a normal discard.
    const finishGame = useCallback((discardIndex: number) => {
        const prev = gameState;
        if (!isMyActiveTurn(prev)) return;
        if (prev.players[0].tiles.filter(t => t !== null).length !== 1) {
            alert("Son taşınız olmalı!");
            return;
        }
        discardTile(discardIndex);
    }, [gameState, discardTile]);

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
        drawnThisTurn,
        canUndo,
        undoTurn,
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
