// 101 Game Logic - Uses same tile types as Okey
import type { OkeyTile, OkeyColor } from './okeyLogic';
import { createOkeyDeck, shuffleDeck, determineOkey } from './okeyLogic';

// Re-export tile types for 101
export type { OkeyTile, OkeyColor };
export type Tile101 = OkeyTile;

export const RACK_SIZE_101 = 30; // 2 rows of 15 slots
/** Classic deal: 21 tiles each; starter (dealer's right) gets +1 → 22. */
export const INITIAL_HAND_SIZE = 21;
/** After drawing, a hand holds at most 22 tiles. */
export const MAX_HAND_SIZE = 22;
/** Normal first open: meld point sum must be at least 101. */
export const FIRST_MELD_MINIMUM = 101;
/** Pair open: at least this many identical color+value pairs. */
export const PAIR_OPEN_MINIMUM = 5;
/** Penalty for never opening in a round. */
export const NEVER_OPENED_PENALTY = 202;
/** Game ends when someone reaches this cumulative penalty. */
export const LOSING_SCORE = 101;

// A meld is a valid set (same value, different colors), run (same color, consecutive),
// or pair (identical color+value duo used for çift açış).
export interface Meld {
    id: string;
    tiles: Tile101[];
    type: 'set' | 'run' | 'pair';
    ownerPlayer: number; // Who first laid it down
}

export interface Player101Hand {
    tiles: (Tile101 | null)[]; // The tiles in the player's rack
    score: number; // Cumulative score across rounds
    hasLaidDown: boolean; // Has made first open this round (101+ or 5 pairs)
    /** True when this round's open was a pair-open (çift açış). */
    openedWithPairs: boolean;
}

export type Game101Phase = 'dealing' | 'playing' | 'roundOver' | 'gameOver';

export interface Game101State {
    phase: Game101Phase;
    players: Player101Hand[];
    centerStack: Tile101[];
    discardPiles: Tile101[][]; // Per-player discard piles (like Okey)
    indicatorTile: Tile101 | null;
    okeyTile: Tile101 | null;
    tableMelds: { [key: string]: Meld }; // All melds on the table (object for Firebase compatibility)
    currentTurn: number;
    roundWinner: number | null;
    gameWinner: number | null; // The player who DIDN'T reach 101
    roundNumber: number;
}

/**
 * Calculate the point value of a tile
 * 1 = 1 point, 2-10 = face value, 11-13 = 10 points each
 * Joker (isFakeOkey) = 25 points when in hand
 */
export const getTilePoints = (tile: Tile101): number => {
    if (tile.isFakeOkey) return 25; // Joker penalty
    if (tile.value >= 11) return 10; // J, Q, K equivalent
    return tile.value;
};

/**
 * Calculate total points of tiles in a meld
 */
export const calculateMeldPoints = (tiles: Tile101[]): number => {
    return tiles.reduce((sum, tile) => {
        // Jokers in melds take the value of the tile they represent
        if (tile.isFakeOkey) {
            // We need context to know the value, but for simplicity assume it's valid
            return sum + 0; // Jokers don't add to meld point requirement
        }
        return sum + getTilePoints(tile);
    }, 0);
};

/**
 * Calculate points in a player's hand (for scoring at round end)
 */
export const calculateHandPoints = (tiles: (Tile101 | null)[]): number => {
    return tiles
        .filter((t): t is Tile101 => t !== null)
        .reduce((sum, tile) => sum + getTilePoints(tile), 0);
};

/**
 * Check if a set of tiles forms a valid SET (same value, 3-4 different colors)
 */
export const isValidSet = (tiles: Tile101[]): boolean => {
    if (tiles.length < 3 || tiles.length > 4) return false;

    const nonJokers = tiles.filter(t => !t.isFakeOkey);
    const jokerCount = tiles.length - nonJokers.length;

    if (nonJokers.length === 0) return false; // Can't have all jokers

    // All non-jokers must have the same value
    const value = nonJokers[0].value;
    if (!nonJokers.every(t => t.value === value)) return false;

    // All non-jokers must have different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) return false;

    // With jokers, we need enough unique colors
    const uniqueColors = new Set(colors);
    const possibleColors = 4 - uniqueColors.size; // Remaining colors jokers can fill
    
    return jokerCount <= possibleColors;
};

/**
 * Check if a set of tiles forms a valid RUN (same color, 3+ consecutive).
 * Jokers may fill internal gaps or extend either end. Duplicate values are NOT allowed.
 * Classic wrap: 12-13-1 is allowed; 13-1-2 is not.
 */
export const isValidRun = (tiles: Tile101[]): boolean => {
    if (tiles.length < 3 || tiles.length > 13) return false;

    const nonJokers = tiles.filter(t => !t.isFakeOkey);
    const jokerCount = tiles.length - nonJokers.length;

    if (nonJokers.length === 0) return false;

    // All non-jokers must have the same color
    const color = nonJokers[0].color;
    if (!nonJokers.every(t => t.color === color)) return false;

    // No duplicate values allowed in a run
    const values = nonJokers.map(t => t.value).sort((a, b) => a - b);
    for (let i = 1; i < values.length; i++) {
        if (values[i] === values[i - 1]) return false;
    }

    const has1 = values.includes(1);
    const has13 = values.includes(13);
    const has2 = values.includes(2);

    // Wrap-around run (…-12-13-1): map 1 → 14, forbid continuing into 2.
    if (has1 && has13) {
        if (has2) return false; // 13-1-2 is illegal
        const mapped = values.map(v => (v === 1 ? 14 : v)).sort((a, b) => a - b);
        const minVal = mapped[0];
        const maxVal = mapped[mapped.length - 1];
        const span = maxVal - minVal + 1;
        if (span > tiles.length) return false;
        const internalGaps = span - nonJokers.length;
        if (internalGaps < 0 || internalGaps > jokerCount) return false;
        // Wrapped runs sit at the high end of 1–13 (1 becomes 14).
        if (maxVal !== 14) return false;
        const earliestStart = Math.max(1, maxVal - tiles.length + 1);
        const latestStart = Math.min(minVal, 14 - tiles.length + 1);
        return earliestStart <= latestStart;
    }

    const minVal = values[0];
    const maxVal = values[values.length - 1];
    const span = maxVal - minVal + 1;

    if (span > tiles.length) return false;

    const internalGaps = span - nonJokers.length;
    if (internalGaps < 0 || internalGaps > jokerCount) return false;

    const earliestStart = Math.max(1, maxVal - tiles.length + 1);
    const latestStart = Math.min(minVal, 13 - tiles.length + 1);
    return earliestStart <= latestStart;
};

/**
 * Check if tiles form a valid meld (either set or run)
 */
export const isValidMeld = (tiles: Tile101[]): { valid: boolean; type: 'set' | 'run' | null } => {
    if (isValidSet(tiles)) return { valid: true, type: 'set' };
    if (isValidRun(tiles)) return { valid: true, type: 'run' };
    return { valid: false, type: null };
};

/**
 * Check if a tile can be added to an existing meld.
 * Re-validates the augmented tile group so end/internal/joker cases are all handled.
 * Pair melds (çift açış) do not accept additions.
 */
export const canAddToMeld = (meld: Meld, tile: Tile101): boolean => {
    if (meld.type === 'pair') return false;
    const newTiles = [...meld.tiles, tile];
    if (meld.type === 'set') {
        return isValidSet(newTiles);
    }
    return isValidRun(newTiles);
};

/**
 * Point value of a non-joker tile value (1 = 1, 2-10 = face, 11-13 = 10).
 */
const pointsForValue = (value: number): number => (value >= 11 ? 10 : value);

/**
 * Total point value a meld contributes toward the 101-point first lay-down,
 * counting jokers as the value they represent (for runs, the filled/extended
 * positions; for sets, the shared value). Pairs do not count toward 101 open.
 */
export const getMeldPoints = (tiles: Tile101[], type: 'set' | 'run' | 'pair'): number => {
    if (type === 'pair') return 0;
    const nonJokers = tiles.filter(t => !t.isFakeOkey);
    if (nonJokers.length === 0) return 0;

    if (type === 'set') {
        return tiles.length * pointsForValue(nonJokers[0].value);
    }

    // Run: place the run at the highest values that still cover the non-jokers,
    // then sum every position (jokers included via their represented value).
    // Wrap runs (…-13-1): treat 1 as 14 for placement.
    const raw = nonJokers.map(t => t.value);
    const wrap = raw.includes(1) && raw.includes(13) && !raw.includes(2);
    const vals = raw.map(v => (wrap && v === 1 ? 14 : v));
    const maxVal = Math.max(...vals);
    const start = Math.max(1, maxVal - tiles.length + 1);
    let sum = 0;
    for (let i = 0; i < tiles.length; i++) {
        let v = start + i;
        if (v === 14) v = 1;
        if (v >= 1 && v <= 13) sum += pointsForValue(v);
    }
    return sum;
};

/**
 * Check if player can make their first normal lay down (101+ points across melds).
 */
export const canMakeFirstLayDown = (melds: Tile101[][]): boolean => {
    let totalPoints = 0;

    for (const meld of melds) {
        const validation = isValidMeld(meld);
        if (!validation.valid || !validation.type) return false;
        totalPoints += getMeldPoints(meld, validation.type);
    }

    return totalPoints >= FIRST_MELD_MINIMUM;
};

/** Pair key for identical color+value tiles (jokers excluded). */
const pairKey = (tile: Tile101): string | null => {
    if (tile.isFakeOkey || !tile.color) return null;
    return `${tile.color}-${tile.value}`;
};

/**
 * Count how many complete pairs (2 identical color+value tiles) exist in a pool.
 */
export const countCompletePairs = (tiles: Tile101[]): number => {
    const counts = new Map<string, number>();
    for (const t of tiles) {
        const k = pairKey(t);
        if (!k) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    let pairs = 0;
    for (const n of counts.values()) pairs += Math.floor(n / 2);
    return pairs;
};

/**
 * True when the pool contains at least PAIR_OPEN_MINIMUM identical pairs.
 */
export const canMakePairOpen = (tiles: Tile101[]): boolean =>
    countCompletePairs(tiles) >= PAIR_OPEN_MINIMUM;

/**
 * Extract up to `maxPairs` identical pairs from tiles (greedy by key).
 * Returns array of 2-tile pair groups.
 */
export const extractPairs = (tiles: Tile101[], maxPairs = PAIR_OPEN_MINIMUM): Tile101[][] => {
    const byKey = new Map<string, Tile101[]>();
    for (const t of tiles) {
        const k = pairKey(t);
        if (!k) continue;
        const list = byKey.get(k) || [];
        list.push(t);
        byKey.set(k, list);
    }
    const pairs: Tile101[][] = [];
    for (const list of byKey.values()) {
        for (let i = 0; i + 1 < list.length && pairs.length < maxPairs; i += 2) {
            pairs.push([list[i], list[i + 1]]);
        }
        if (pairs.length >= maxPairs) break;
    }
    return pairs;
};

/**
 * Rack indices that form complete identical pairs (for UI "Çift Aç" selection).
 * Returns groups of 2 indices; flatten for selection.
 */
export const findPairIndices = (tiles: (Tile101 | null)[]): number[][] => {
    const byKey = new Map<string, number[]>();
    tiles.forEach((t, idx) => {
        if (!t) return;
        const k = pairKey(t);
        if (!k) return;
        const list = byKey.get(k) || [];
        list.push(idx);
        byKey.set(k, list);
    });
    const groups: number[][] = [];
    for (const idxs of byKey.values()) {
        for (let i = 0; i + 1 < idxs.length; i += 2) {
            groups.push([idxs[i], idxs[i + 1]]);
        }
    }
    return groups;
};

/**
 * Whether an unopened player may take `discard` — only if adding it enables
 * a normal (≥101) or pair (≥5) open this turn.
 */
export const canTakeDiscardToOpen = (
    hand: (Tile101 | null)[],
    discard: Tile101,
): boolean => {
    const pool = [...hand.filter((t): t is Tile101 => t !== null), discard];
    if (canMakePairOpen(pool)) return true;

    // Greedy extract melds and sum points (same spirit as AI collectMelds).
    let remaining = [...pool];
    let total = 0;
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];

    const findBest = (poolTiles: Tile101[]): { tiles: Tile101[]; type: 'set' | 'run'; points: number } | null => {
        let best: { tiles: Tile101[]; type: 'set' | 'run'; points: number } | null = null;
        const nonJokers = poolTiles.filter(t => !t.isFakeOkey);

        for (let v = 1; v <= 13; v++) {
            const ofVal = nonJokers.filter(t => t.value === v);
            if (ofVal.length >= 3) {
                const set = ofVal.slice(0, Math.min(4, ofVal.length));
                if (isValidSet(set)) {
                    const points = getMeldPoints(set, 'set');
                    if (!best || points > best.points) best = { tiles: set, type: 'set', points };
                }
            }
        }
        for (const color of colorOrder) {
            const colorTiles = nonJokers
                .filter(t => t.color === color)
                .sort((a, b) => a.value - b.value);
            for (let start = 0; start < colorTiles.length; start++) {
                const run: Tile101[] = [colorTiles[start]];
                for (let i = start + 1; i < colorTiles.length; i++) {
                    const next = colorTiles[i];
                    const last = run[run.length - 1];
                    if (next.value === last.value) continue;
                    if (next.value === last.value + 1 || (last.value === 13 && next.value === 1 && !run.some(t => t.value === 2))) {
                        run.push(next);
                        if (run.length >= 3 && isValidRun(run)) {
                            const points = getMeldPoints(run, 'run');
                            if (!best || points > best.points) best = { tiles: [...run], type: 'run', points };
                        }
                    } else if (!(last.value === 13 && next.value === 1)) {
                        break;
                    }
                }
            }
        }
        return best;
    };

    for (let guard = 0; guard < 12; guard++) {
        const best = findBest(remaining);
        if (!best) break;
        total += best.points;
        if (total >= FIRST_MELD_MINIMUM) return true;
        const used = new Set(best.tiles.map(t => t.id));
        remaining = remaining.filter(t => !used.has(t.id));
    }
    return false;
};

/**
 * Round-end penalty for one non-winning player.
 */
export const calculateRoundPenalty = (player: Player101Hand): number => {
    if (!player.hasLaidDown) return NEVER_OPENED_PENALTY;
    const hand = calculateHandPoints(player.tiles);
    return player.openedWithPairs ? hand * 2 : hand;
};

/**
 * Initialize a new 101 game
 */
export const initialize101Game = (playerCount: number = 4): Game101State => {
    let deck = shuffleDeck(createOkeyDeck());
    
    // 101'de de Okey (joker) mantigi olsun: bir gösterge sec, ona gore okeyi belirle
    const indicator = deck.pop() as Tile101;
    const okeyDef = determineOkey(indicator) as Tile101;
    
    const players: Player101Hand[] = Array(playerCount).fill(null).map(() => ({
        tiles: Array(RACK_SIZE_101).fill(null),
        score: 0,
        hasLaidDown: false,
        openedWithPairs: false,
    }));

    // Deal: starter (seat 0 / dealer's right) gets 22, others 21.
    for (let p = 0; p < playerCount; p++) {
        const count = p === 0 ? INITIAL_HAND_SIZE + 1 : INITIAL_HAND_SIZE;
        const hand: Tile101[] = [];
        for (let i = 0; i < count && deck.length > 0; i++) {
            hand.push(deck.pop()!);
        }
        players[p].tiles = smartSort101Tiles(hand);
    }

    return {
        phase: 'playing',
        players,
        centerStack: deck,
        discardPiles: [[], [], [], []], // 4 player discard piles
        indicatorTile: indicator,
        okeyTile: okeyDef,
        tableMelds: {},
        currentTurn: 0,
        roundWinner: null,
        gameWinner: null,
        roundNumber: 1
    };
};

/**
 * Start a new round (after someone wins a round)
 */
export const startNewRound = (prevState: Game101State): Game101State => {
    const playerCount = prevState.players.length;
    let deck = shuffleDeck(createOkeyDeck());
    
    const indicator = deck.pop() as Tile101;
    const okeyDef = determineOkey(indicator) as Tile101;
    
    const players: Player101Hand[] = prevState.players.map(p => ({
        tiles: Array(RACK_SIZE_101).fill(null),
        score: p.score, // Keep scores
        hasLaidDown: false,
        openedWithPairs: false,
    }));

    // Previous round winner deals; the player to their right (next seat) starts
    // with 22 tiles and discards first without drawing.
    const dealer = prevState.roundWinner ?? 0;
    const startingPlayer = (dealer + 1) % playerCount;

    for (let p = 0; p < playerCount; p++) {
        const count = p === startingPlayer ? INITIAL_HAND_SIZE + 1 : INITIAL_HAND_SIZE;
        const hand: Tile101[] = [];
        for (let i = 0; i < count && deck.length > 0; i++) {
            hand.push(deck.pop()!);
        }
        players[p].tiles = smartSort101Tiles(hand);
    }

    return {
        phase: 'playing',
        players,
        centerStack: deck,
        discardPiles: [[], [], [], []], // Reset 4 player discard piles
        indicatorTile: indicator,
        okeyTile: okeyDef,
        tableMelds: {},
        currentTurn: startingPlayer,
        roundWinner: null,
        gameWinner: prevState.gameWinner,
        roundNumber: prevState.roundNumber + 1
    };
};

/**
 * End a round and calculate classic 101 penalties.
 * Finisher: 0. Never opened: +202. Opened: hand sum (×2 if pair-opened).
 * If the finisher opened with pairs, everyone else's penalty this round is doubled.
 */
export const endRound = (state: Game101State, winnerId: number): Game101State => {
    const winnerOpenedWithPairs = state.players[winnerId]?.openedWithPairs === true;

    const newPlayers = state.players.map((player, idx) => {
        if (idx === winnerId) {
            return { ...player, score: player.score };
        }
        let penalty = calculateRoundPenalty(player);
        if (winnerOpenedWithPairs) penalty *= 2;
        return { ...player, score: player.score + penalty };
    });

    // Check if anyone has reached 101
    const gameLoser = newPlayers.findIndex(p => p.score >= LOSING_SCORE);
    let gameWinner: number | null = null;

    if (gameLoser !== -1) {
        let minScore = Infinity;
        newPlayers.forEach((p, idx) => {
            if (p.score < minScore) {
                minScore = p.score;
                gameWinner = idx;
            }
        });
    }

    return {
        ...state,
        players: newPlayers,
        phase: gameLoser !== -1 ? 'gameOver' : 'roundOver',
        roundWinner: winnerId,
        gameWinner
    };
};

/**
 * End the current round in a DRAW — used when a player must draw but the center
 * stack is exhausted. Nobody wins and nobody scores: hand points are NOT added,
 * roundWinner stays null (startNewRound then falls back to dealer 0).
 */
export const endRoundInDraw = (state: Game101State): Game101State => ({
    ...state,
    phase: 'roundOver',
    roundWinner: null
});

/**
 * Compute one full AI turn for the player whose turn it currently is.
 *
 * Pure function — takes the current game state and returns the next state after the
 * AI has: drawn from the center, laid down the best melds it can (respecting the
 * 101-point first lay-down / 5-pair open rules), added tiles to existing melds, and discarded its
 * lowest-value tile (advancing the turn). If the AI empties its hand it wins the round.
 *
 * Shared by single-player (use101Game) and the online host (use101Room) so AI behaves
 * identically in both modes.
 */
export const computeAIMove = (prev: Game101State): Game101State => {
    const currPlayer = prev.currentTurn;
    const playerCount = prev.players.length;
    const nextTurn = (currPlayer + 1) % playerCount;
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];

    const newPlayers = prev.players.map(p => ({ ...p, tiles: [...p.tiles] }));
    const newTableMelds: { [key: string]: Meld } = { ...prev.tableMelds };
    const newStack = [...prev.centerStack];
    const newDiscardPiles = prev.discardPiles.map(pile => [...pile]);

    const rack = newPlayers[currPlayer].tiles;

    // 1) Draw. If not yet opened, take the previous discard ONLY when it enables
    // opening (≥101 melds or ≥5 pairs). Once opened, take it when it fits a table meld
    // or completes a set/run in hand. Otherwise draw from the center.
    const prevPlayer = (currPlayer + playerCount - 1) % playerCount;
    const prevPile = newDiscardPiles[prevPlayer] ?? [];
    const topDiscard = prevPile.length > 0 ? prevPile[prevPile.length - 1] : undefined;

    const discardIsUseful = (tile: Tile101): boolean => {
        if (tile.isFakeOkey) return false;
        if (!newPlayers[currPlayer].hasLaidDown) {
            return canTakeDiscardToOpen(rack, tile);
        }
        for (const meld of Object.values(newTableMelds)) {
            if (canAddToMeld(meld, tile)) return true;
        }
        const handTiles = rack.filter((t): t is Tile101 => t !== null && !t.isFakeOkey);
        for (let i = 0; i < handTiles.length; i++) {
            for (let j = i + 1; j < handTiles.length; j++) {
                if (isValidMeld([handTiles[i], handTiles[j], tile]).valid) return true;
            }
        }
        return false;
    };

    let drawn: Tile101 | undefined;
    if (topDiscard && discardIsUseful(topDiscard)) {
        prevPile.pop();
        drawn = topDiscard;
    } else {
        drawn = newStack.pop();
    }
    if (!drawn) {
        // Center stack exhausted — the round ends in a draw, nobody scores.
        return endRoundInDraw(prev);
    }

    const emptyIdx = rack.findIndex(s => s === null);
    if (emptyIdx !== -1) rack[emptyIdx] = drawn;

    const getTiles = () => rack.filter((t): t is Tile101 => t !== null);

    // Find the highest-value valid meld within a pool of tiles (joker-free, to stay safe).
    const findBestMeldIn = (pool: Tile101[]): { tiles: Tile101[]; type: 'set' | 'run'; points: number } | null => {
        let best: { tiles: Tile101[]; type: 'set' | 'run'; points: number } | null = null;

        // Sets (same value, different colors), high values first.
        for (let value = 13; value >= 1; value--) {
            const sameValue = pool.filter(t => t.value === value && !t.isFakeOkey);
            const uniqueColors = [...new Set(sameValue.map(t => t.color))];
            if (uniqueColors.length >= 3) {
                const set: Tile101[] = [];
                for (const color of colorOrder) {
                    if (uniqueColors.includes(color)) {
                        const tile = sameValue.find(t => t.color === color && !set.includes(t));
                        if (tile) set.push(tile);
                    }
                }
                if (set.length >= 3) {
                    const points = getMeldPoints(set, 'set');
                    if (!best || points > best.points) best = { tiles: set, type: 'set', points };
                }
            }
        }

        // Runs (same color, consecutive).
        for (const color of colorOrder) {
            const colorTiles = pool.filter(t => t.color === color && !t.isFakeOkey).sort((a, b) => a.value - b.value);
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
                    const points = getMeldPoints(run, 'run');
                    if (!best || points > best.points) best = { tiles: run, type: 'run', points };
                }
            }
        }

        return best;
    };

    // Greedily collect as many non-overlapping melds as possible from the current hand.
    const collectMelds = (): { tiles: Tile101[]; type: 'set' | 'run'; points: number }[] => {
        let pool = getTiles();
        const melds: { tiles: Tile101[]; type: 'set' | 'run'; points: number }[] = [];
        let best = findBestMeldIn(pool);
        while (best) {
            melds.push(best);
            const usedIds = new Set(best.tiles.map(t => t.id));
            pool = pool.filter(t => !usedIds.has(t.id));
            best = findBestMeldIn(pool);
        }
        return melds;
    };

    // 2) Lay down melds. To OPEN normally, combined value must reach 101.
    // Prefer pair-open (≥5 pairs) when available and not yet opened.
    let hasLaidDown = newPlayers[currPlayer].hasLaidDown;
    let openedWithPairs = newPlayers[currPlayer].openedWithPairs;

    if (!hasLaidDown && canMakePairOpen(getTiles())) {
        const pairs = extractPairs(getTiles(), PAIR_OPEN_MINIMUM);
        pairs.forEach((pairTiles, i) => {
            const meldId = `meld-ai-${currPlayer}-r${prev.roundNumber}-pair-${i}-${pairTiles[0].id}`;
            newTableMelds[meldId] = { id: meldId, tiles: pairTiles, type: 'pair', ownerPlayer: currPlayer };
            for (const tile of pairTiles) {
                const idx = rack.findIndex(rt => rt?.id === tile.id);
                if (idx !== -1) rack[idx] = null;
            }
        });
        hasLaidDown = true;
        openedWithPairs = true;
    }

    const planned = collectMelds();
    const plannedTotal = planned.reduce((sum, m) => sum + m.points, 0);

    if (planned.length > 0 && (hasLaidDown || plannedTotal >= FIRST_MELD_MINIMUM)) {
        planned.forEach((m, i) => {
            const meldId = `meld-ai-${currPlayer}-r${prev.roundNumber}-${i}-${m.tiles[0].id}`;
            newTableMelds[meldId] = { id: meldId, tiles: m.tiles, type: m.type, ownerPlayer: currPlayer };
            for (const tile of m.tiles) {
                const idx = rack.findIndex(rt => rt?.id === tile.id);
                if (idx !== -1) rack[idx] = null;
            }
        });
        hasLaidDown = true;

        if (rack.filter(t => t !== null).length === 0) {
            newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack, hasLaidDown, openedWithPairs };
            return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds, centerStack: newStack, discardPiles: newDiscardPiles }, currPlayer);
        }
    }
    newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack, hasLaidDown, openedWithPairs };

    // 3) Add tiles to existing melds (once laid down).
    if (hasLaidDown) {
        for (const [meldId, meld] of Object.entries(newTableMelds)) {
            const tiles = getTiles();
            for (const tile of tiles) {
                if (canAddToMeld(meld, tile)) {
                    newTableMelds[meldId] = { ...meld, tiles: [...meld.tiles, tile] };
                    const ti = rack.findIndex(t => t?.id === tile.id);
                    if (ti !== -1) rack[ti] = null;
                    newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };
                    if (rack.filter(t => t !== null).length === 0) {
                        return endRound({ ...prev, players: newPlayers, tableMelds: newTableMelds, centerStack: newStack, discardPiles: newDiscardPiles }, currPlayer);
                    }
                    break; // one tile per meld per turn
                }
            }
        }
    }

    // 4) Discard the lowest-value tile (never a joker if avoidable) and advance.
    const tilesWithIdx = rack
        .map((t, idx) => ({ tile: t, idx }))
        .filter((x): x is { tile: Tile101; idx: number } => x.tile !== null);

    if (tilesWithIdx.length > 0) {
        tilesWithIdx.sort((a, b) => {
            if (a.tile.isFakeOkey && !b.tile.isFakeOkey) return 1;
            if (!a.tile.isFakeOkey && b.tile.isFakeOkey) return -1;
            return getTilePoints(a.tile) - getTilePoints(b.tile);
        });
        const low = tilesWithIdx[0];
        const discarded = rack[low.idx];
        rack[low.idx] = null;
        newPlayers[currPlayer] = { ...newPlayers[currPlayer], tiles: rack };

        if (discarded) newDiscardPiles[currPlayer] = [...newDiscardPiles[currPlayer], discarded];

        return {
            ...prev,
            centerStack: newStack,
            players: newPlayers,
            discardPiles: newDiscardPiles,
            tableMelds: newTableMelds,
            currentTurn: nextTurn,
        };
    }

    return { ...prev, centerStack: newStack, players: newPlayers, discardPiles: newDiscardPiles, tableMelds: newTableMelds, currentTurn: nextTurn };
};

export type SortMode = 'smart' | 'runs' | 'sets';

/**
 * Sort tiles prioritizing RUNS (same color, consecutive numbers)
 */
export const sortByRuns = (tiles: (Tile101 | null)[]): (Tile101 | null)[] => {
    const nonNullTiles = tiles.filter((t): t is Tile101 => t !== null);
    const jokers = nonNullTiles.filter(t => t.isFakeOkey);
    let remaining = nonNullTiles.filter(t => !t.isFakeOkey);
    
    const foundRuns: Tile101[][] = [];
    const foundSetsAfterRuns: Tile101[][] = [];
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
    
    // Find runs first (same color, consecutive)
    for (const color of colorOrder) {
        let colorTiles = remaining.filter(t => t.color === color);
        colorTiles.sort((a, b) => a.value - b.value);
        
        while (colorTiles.length >= 3) {
            let bestRun: Tile101[] = [];
            
            for (let startIdx = 0; startIdx < colorTiles.length; startIdx++) {
                const run: Tile101[] = [colorTiles[startIdx]];
                let expectedValue = colorTiles[startIdx].value + 1;
                
                for (let j = startIdx + 1; j < colorTiles.length && expectedValue <= 13; j++) {
                    if (colorTiles[j].value === expectedValue) {
                        run.push(colorTiles[j]);
                        expectedValue++;
                    } else if (colorTiles[j].value > expectedValue) {
                        break;
                    }
                }
                
                if (run.length >= 3 && run.length > bestRun.length) {
                    bestRun = run;
                }
            }
            
            if (bestRun.length >= 3) {
                foundRuns.push(bestRun);
                const usedIds = new Set(bestRun.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
                colorTiles = colorTiles.filter(t => !usedIds.has(t.id));
            } else {
                break;
            }
        }
    }

    // After taking out runs, look for same-value, different-color groups (sets)
    for (let value = 1; value <= 13; value++) {
        const tilesWithValue = remaining.filter(t => t.value === value);
        const uniqueColors = new Set(tilesWithValue.map(t => t.color));
        
        // Only real set candidates (3+ different colors)
        if (uniqueColors.size >= 3) {
            const set: Tile101[] = [];
            for (const color of colorOrder) {
                if (uniqueColors.has(color)) {
                    const tile = tilesWithValue.find(t => t.color === color && !set.includes(t));
                    if (tile) set.push(tile);
                }
            }
            if (set.length >= 3) {
                foundSetsAfterRuns.push(set);
                const usedIds = new Set(set.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
            }
        }
    }
    
    // Build sorted rack – always group clearly by color for readability
    const sortedRack: (Tile101 | null)[] = new Array(RACK_SIZE_101).fill(null);
    let currentIndex = 0;
    
    // 1) Place found runs first, with a gap between each run
    for (const meld of foundRuns) {
        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        if (currentIndex + meld.length > rowEnd && currentRow === 0) currentIndex = 15;
        for (const tile of meld) {
            if (currentIndex < 30) sortedRack[currentIndex++] = tile;
        }
        if (currentIndex < 30 && currentIndex !== 15) currentIndex++;
    }

    // 2) Then place value-based sets (same number, different colors), with gaps
    for (const set of foundSetsAfterRuns) {
        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        if (currentIndex + set.length > rowEnd && currentRow === 0) currentIndex = 15;
        for (const tile of set) {
            if (currentIndex < 30) sortedRack[currentIndex++] = tile;
        }
        if (currentIndex < 30 && currentIndex !== 15) currentIndex++;
    }
    
    // 3) Group remaining tiles strictly by color, with a visible gap between color groups
    for (const color of colorOrder) {
        const group = remaining
            .filter(t => t.color === color)
            .sort((a, b) => a.value - b.value);
        
        if (group.length === 0) continue;

        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        // If this color group would overflow the current row, move to next row start
        if (currentIndex + group.length > rowEnd && currentRow === 0) {
            currentIndex = 15;
        }

        for (const tile of group) {
            if (currentIndex < 30) {
                sortedRack[currentIndex++] = tile;
            }
        }

        // Add one empty slot as a visual separator between color groups
        if (currentIndex < 30 && currentIndex !== 15) {
            currentIndex++;
        }
    }
    
    if (remaining.length > 0 && jokers.length > 0 && currentIndex < 30) currentIndex++;
    for (const tile of jokers) {
        if (currentIndex < 30) sortedRack[currentIndex++] = tile;
    }
    
    return sortedRack;
};

/**
 * Sort tiles prioritizing SETS (same value, different colors)
 */
export const sortBySets = (tiles: (Tile101 | null)[]): (Tile101 | null)[] => {
    const nonNullTiles = tiles.filter((t): t is Tile101 => t !== null);
    const jokers = nonNullTiles.filter(t => t.isFakeOkey);
    let remaining = nonNullTiles.filter(t => !t.isFakeOkey);
    
    const foundMelds: Tile101[][] = [];
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
    
    // Find sets first (same value, different colors)
    for (let value = 1; value <= 13; value++) {
        const tilesWithValue = remaining.filter(t => t.value === value);
        const uniqueColors = new Set(tilesWithValue.map(t => t.color));
        
        if (uniqueColors.size >= 3) {
            const set: Tile101[] = [];
            for (const color of colorOrder) {
                if (uniqueColors.has(color)) {
                    const tile = tilesWithValue.find(t => t.color === color && !set.includes(t));
                    if (tile) set.push(tile);
                }
            }
            if (set.length >= 3) {
                foundMelds.push(set);
                const usedIds = new Set(set.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
            }
        }
    }
    
    // Then sort remaining by value then color
    remaining.sort((a, b) => {
        if (a.value !== b.value) return a.value - b.value;
        const colorIdx = (c: OkeyColor | null) => c ? colorOrder.indexOf(c) : 99;
        return colorIdx(a.color) - colorIdx(b.color);
    });
    
    // Build sorted rack
    const sortedRack: (Tile101 | null)[] = new Array(RACK_SIZE_101).fill(null);
    let currentIndex = 0;
    
    for (const meld of foundMelds) {
        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        if (currentIndex + meld.length > rowEnd && currentRow === 0) currentIndex = 15;
        for (const tile of meld) {
            if (currentIndex < 30) sortedRack[currentIndex++] = tile;
        }
        if (currentIndex < 30 && currentIndex !== 15) currentIndex++;
    }
    
    for (const tile of remaining) {
        if (currentIndex < 30) sortedRack[currentIndex++] = tile;
    }
    
    if (remaining.length > 0 && jokers.length > 0 && currentIndex < 30) currentIndex++;
    for (const tile of jokers) {
        if (currentIndex < 30) sortedRack[currentIndex++] = tile;
    }
    
    return sortedRack;
};

/**
 * Find all valid runs from tiles and return their indices
 */
export const findRunIndices = (tiles: (Tile101 | null)[]): number[][] => {
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
    const result: number[][] = [];
    const used = new Set<number>();
    
    for (const color of colorOrder) {
        // Get indices of tiles with this color
        const colorIndices: { idx: number; value: number }[] = [];
        tiles.forEach((t, idx) => {
            if (t && !t.isFakeOkey && t.color === color && !used.has(idx)) {
                colorIndices.push({ idx, value: t.value });
            }
        });
        colorIndices.sort((a, b) => a.value - b.value);
        
        let i = 0;
        while (i < colorIndices.length) {
            const run: number[] = [colorIndices[i].idx];
            let expectedValue = colorIndices[i].value + 1;
            let j = i + 1;
            
            while (j < colorIndices.length && expectedValue <= 13) {
                if (colorIndices[j].value === expectedValue) {
                    run.push(colorIndices[j].idx);
                    expectedValue++;
                    j++;
                } else if (colorIndices[j].value > expectedValue) {
                    break;
                } else {
                    j++;
                }
            }
            
            if (run.length >= 3) {
                result.push(run);
                run.forEach(idx => used.add(idx));
                i = j;
            } else {
                i++;
            }
        }
    }
    
    return result;
};

/**
 * Find all valid sets from tiles and return their indices
 */
export const findSetIndices = (tiles: (Tile101 | null)[]): number[][] => {
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
    const result: number[][] = [];
    const used = new Set<number>();
    
    for (let value = 1; value <= 13; value++) {
        // Get indices of tiles with this value
        const valueIndices: { idx: number; color: OkeyColor }[] = [];
        tiles.forEach((t, idx) => {
            if (t && !t.isFakeOkey && t.value === value && !used.has(idx)) {
                valueIndices.push({ idx, color: t.color as OkeyColor });
            }
        });
        
        // Check if we have 3+ different colors
        const uniqueColors = new Set(valueIndices.map(v => v.color));
        if (uniqueColors.size >= 3) {
            const set: number[] = [];
            for (const color of colorOrder) {
                const match = valueIndices.find(v => v.color === color && !set.includes(v.idx));
                if (match) set.push(match.idx);
            }
            if (set.length >= 3) {
                result.push(set);
                set.forEach(idx => used.add(idx));
            }
        }
    }
    
    return result;
};

/**
 * Sort tiles by REAL PAIRS (same color, same value) first, then by color/value.
 * Used for \"Çift diz\" davranışı.
 */
export const sortByPairs = (tiles: (Tile101 | null)[]): (Tile101 | null)[] => {
    const nonNullTiles = tiles.filter((t): t is Tile101 => t !== null);
    const jokers = nonNullTiles.filter(t => t.isFakeOkey);
    const normals = nonNullTiles.filter(t => !t.isFakeOkey);

    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];

    // Group by exact color+value
    const groups = new Map<string, Tile101[]>();
    for (const tile of normals) {
        const key = `${tile.color}-${tile.value}`;
        const arr = groups.get(key) ?? [];
        arr.push(tile);
        groups.set(key, arr);
    }

    const pairBlocks: Tile101[][] = [];
    const remaining: Tile101[] = [];

    for (const [, list] of groups) {
        // create 2-by-2 pairs
        let i = 0;
        while (i + 1 < list.length) {
            pairBlocks.push([list[i], list[i + 1]]);
            i += 2;
        }
        // if odd one left, keep as remaining
        if (i < list.length) {
            remaining.push(list[i]);
        }
    }

    // Build rack: pairs first (with gaps), then remaining grouped by color/value
    const sortedRack: (Tile101 | null)[] = new Array(RACK_SIZE_101).fill(null);
    let currentIndex = 0;

    // 1) Place all pairs
    for (const pair of pairBlocks) {
        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        if (currentIndex + pair.length > rowEnd && currentRow === 0) currentIndex = 15;

        for (const tile of pair) {
            if (currentIndex < 30) sortedRack[currentIndex++] = tile;
        }

        // gap after each pair block
        if (currentIndex < 30 && currentIndex !== 15) currentIndex++;
    }

    // 2) Sort remaining by color then value, adding gap on color change
    remaining.sort((a, b) => {
        const colorIdx = (c: OkeyColor | null) => (c ? colorOrder.indexOf(c) : 99);
        if (colorIdx(a.color) !== colorIdx(b.color)) {
            return colorIdx(a.color) - colorIdx(b.color);
        }
        return a.value - b.value;
    });

    let lastColor: OkeyColor | null = null;
    for (const tile of remaining) {
        if (
            lastColor !== null &&
            tile.color !== lastColor &&
            currentIndex < 30 &&
            currentIndex !== 15
        ) {
            currentIndex++;
        }
        if (currentIndex < 30) {
            sortedRack[currentIndex++] = tile;
        }
        lastColor = tile.color as OkeyColor;
    }

    // 3) Place jokers at the very end with a small gap if possible
    if (remaining.length > 0 && jokers.length > 0 && currentIndex < 30) {
        currentIndex++;
    }
    for (const tile of jokers) {
        if (currentIndex < 30) {
            sortedRack[currentIndex++] = tile;
        }
    }

    return sortedRack;
};

/**
 * Smart sort tiles for 101 - groups valid melds together
 */
export const smartSort101Tiles = (tiles: (Tile101 | null)[]): (Tile101 | null)[] => {
    const nonNullTiles = tiles.filter((t): t is Tile101 => t !== null);
    const jokers = nonNullTiles.filter(t => t.isFakeOkey);
    let remaining = nonNullTiles.filter(t => !t.isFakeOkey);
    
    const foundMelds: Tile101[][] = [];
    const colorOrder: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
    
    // Step 1: Find sets (same value, different colors)
    for (let value = 1; value <= 13; value++) {
        const tilesWithValue = remaining.filter(t => t.value === value);
        const uniqueColors = new Set(tilesWithValue.map(t => t.color));
        
        if (uniqueColors.size >= 3) {
            const set: Tile101[] = [];
            for (const color of colorOrder) {
                if (uniqueColors.has(color)) {
                    const tile = tilesWithValue.find(t => t.color === color && !set.includes(t));
                    if (tile) set.push(tile);
                }
            }
            if (set.length >= 3) {
                foundMelds.push(set);
                const usedIds = new Set(set.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
            }
        }
    }
    
    // Step 2: Find runs (same color, consecutive)
    for (const color of colorOrder) {
        let colorTiles = remaining.filter(t => t.color === color);
        colorTiles.sort((a, b) => a.value - b.value);
        
        while (colorTiles.length >= 3) {
            let bestRun: Tile101[] = [];
            
            for (let startIdx = 0; startIdx < colorTiles.length; startIdx++) {
                const run: Tile101[] = [colorTiles[startIdx]];
                let expectedValue = colorTiles[startIdx].value + 1;
                
                for (let j = startIdx + 1; j < colorTiles.length && expectedValue <= 13; j++) {
                    if (colorTiles[j].value === expectedValue) {
                        run.push(colorTiles[j]);
                        expectedValue++;
                    } else if (colorTiles[j].value > expectedValue) {
                        break;
                    }
                }
                
                if (run.length >= 3 && run.length > bestRun.length) {
                    bestRun = run;
                }
            }
            
            if (bestRun.length >= 3) {
                foundMelds.push(bestRun);
                const usedIds = new Set(bestRun.map(t => t.id));
                remaining = remaining.filter(t => !usedIds.has(t.id));
                colorTiles = colorTiles.filter(t => !usedIds.has(t.id));
            } else {
                break;
            }
        }
    }
    
    // Step 3: Build sorted rack
    const sortedRack: (Tile101 | null)[] = new Array(RACK_SIZE_101).fill(null);
    let currentIndex = 0;
    
    // Place melds with gaps
    for (const meld of foundMelds) {
        const currentRow = currentIndex < 15 ? 0 : 1;
        const rowEnd = currentRow === 0 ? 15 : 30;
        
        if (currentIndex + meld.length > rowEnd && currentRow === 0) {
            currentIndex = 15;
        }
        
        for (const tile of meld) {
            if (currentIndex < 30) {
                sortedRack[currentIndex++] = tile;
            }
        }
        
        if (currentIndex < 30 && currentIndex !== 15) {
            currentIndex++;
        }
    }
    
    // Sort remaining by color then value
    remaining.sort((a, b) => {
        const colorIdx = (c: OkeyColor | null) => c ? colorOrder.indexOf(c) : 99;
        if (colorIdx(a.color) !== colorIdx(b.color)) {
            return colorIdx(a.color) - colorIdx(b.color);
        }
        return a.value - b.value;
    });
    
    // Place remaining tiles
    for (const tile of remaining) {
        if (currentIndex < 30) {
            sortedRack[currentIndex++] = tile;
        }
    }
    
    // Add gap before jokers
    if (remaining.length > 0 && jokers.length > 0 && currentIndex < 30) {
        currentIndex++;
    }
    
    // Place jokers at the end
    for (const tile of jokers) {
        if (currentIndex < 30) {
            sortedRack[currentIndex++] = tile;
        }
    }
    
    return sortedRack;
};

