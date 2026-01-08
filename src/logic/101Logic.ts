// 101 Game Logic - Uses same tile types as Okey
import type { OkeyTile, OkeyColor } from './okeyLogic';
import { createOkeyDeck, shuffleDeck, determineOkey } from './okeyLogic';

// Re-export tile types for 101
export type { OkeyTile, OkeyColor };
export type Tile101 = OkeyTile;

export const RACK_SIZE_101 = 30; // 2 rows of 15 slots
export const INITIAL_HAND_SIZE = 14;
export const FIRST_MELD_MINIMUM = 51; // Minimum points for first lay down
export const LOSING_SCORE = 101; // Game ends when someone reaches this

// A meld is a valid set (same value, different colors) or run (same color, consecutive)
export interface Meld {
    id: string;
    tiles: Tile101[];
    type: 'set' | 'run';
    ownerPlayer: number; // Who first laid it down
}

export interface Player101Hand {
    tiles: (Tile101 | null)[]; // The tiles in the player's rack
    score: number; // Cumulative score across rounds
    hasLaidDown: boolean; // Has made first 51+ point lay down this round
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
 * Check if a set of tiles forms a valid RUN (same color, 3+ consecutive)
 */
export const isValidRun = (tiles: Tile101[]): boolean => {
    if (tiles.length < 3) return false;

    const nonJokers = tiles.filter(t => !t.isFakeOkey);
    const jokerCount = tiles.length - nonJokers.length;

    if (nonJokers.length === 0) return false;

    // All non-jokers must have the same color
    const color = nonJokers[0].color;
    if (!nonJokers.every(t => t.color === color)) return false;

    // Sort by value
    const sortedNonJokers = [...nonJokers].sort((a, b) => a.value - b.value);
    
    // Check if we can form a consecutive sequence with jokers filling gaps
    const minVal = sortedNonJokers[0].value;
    const maxVal = sortedNonJokers[sortedNonJokers.length - 1].value;
    
    // The sequence length should match tiles.length
    const sequenceLength = maxVal - minVal + 1;
    
    if (sequenceLength > tiles.length) return false; // Can't fill all gaps
    if (sequenceLength < tiles.length) {
        // Need to extend the sequence
        const canExtendDown = minVal - (tiles.length - sequenceLength) >= 1;
        const canExtendUp = maxVal + (tiles.length - sequenceLength) <= 13;
        if (!canExtendDown && !canExtendUp) return false;
    }

    // Check gaps in the sequence
    let gaps = 0;
    for (let i = 0; i < sortedNonJokers.length - 1; i++) {
        gaps += sortedNonJokers[i + 1].value - sortedNonJokers[i].value - 1;
    }

    return gaps <= jokerCount;
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
 * Check if a tile can be added to an existing meld
 */
export const canAddToMeld = (meld: Meld, tile: Tile101): boolean => {
    const newTiles = [...meld.tiles, tile];
    
    if (meld.type === 'set') {
        return isValidSet(newTiles);
    } else {
        // For runs, also check adding at beginning or end
        const sorted = [...meld.tiles].filter(t => !t.isFakeOkey).sort((a, b) => a.value - b.value);
        if (sorted.length === 0) return isValidRun(newTiles);
        
        const minVal = sorted[0].value;
        const maxVal = sorted[sorted.length - 1].value;
        const color = sorted[0].color;
        
        // Joker can be added anywhere (within reason)
        if (tile.isFakeOkey) {
            return newTiles.length <= 13; // Max run length
        }
        
        // Must be same color and extend the sequence
        if (tile.color !== color) return false;
        if (tile.value === minVal - 1 && tile.value >= 1) return true;
        if (tile.value === maxVal + 1 && tile.value <= 13) return true;
        
        return false;
    }
};

/**
 * Check if player can make their first lay down (51+ points)
 */
export const canMakeFirstLayDown = (melds: Tile101[][]): boolean => {
    let totalPoints = 0;
    
    for (const meld of melds) {
        const validation = isValidMeld(meld);
        if (!validation.valid) return false;
        
        // Only count non-joker points
        const meldPoints = meld
            .filter(t => !t.isFakeOkey)
            .reduce((sum, t) => sum + getTilePoints(t), 0);
        totalPoints += meldPoints;
    }
    
    return totalPoints >= FIRST_MELD_MINIMUM;
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
        hasLaidDown: false
    }));
    
    // Deal 14 tiles to each player
    for (let p = 0; p < playerCount; p++) {
        for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
            players[p].tiles[i] = deck.pop()!;
        }
    }
    
    // First player gets one extra tile to start
    const emptySlot = players[0].tiles.findIndex(t => t === null);
    if (emptySlot !== -1 && deck.length > 0) {
        players[0].tiles[emptySlot] = deck.pop()!;
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
        hasLaidDown: false
    }));
    
    // Deal 14 tiles to each player
    for (let p = 0; p < playerCount; p++) {
        for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
            players[p].tiles[i] = deck.pop()!;
        }
    }
    
    // Dealer (who won last round) starts
    const startingPlayer = prevState.roundWinner ?? 0;
    const emptySlot = players[startingPlayer].tiles.findIndex(t => t === null);
    if (emptySlot !== -1 && deck.length > 0) {
        players[startingPlayer].tiles[emptySlot] = deck.pop()!;
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
 * End a round and calculate scores
 */
export const endRound = (state: Game101State, winnerId: number): Game101State => {
    const newPlayers = state.players.map((player, idx) => {
        if (idx === winnerId) {
            return { ...player, score: player.score }; // Winner adds nothing
        }
        // Losers add their hand points
        const handPoints = calculateHandPoints(player.tiles);
        return { ...player, score: player.score + handPoints };
    });
    
    // Check if anyone has reached 101
    const gameLoser = newPlayers.findIndex(p => p.score >= LOSING_SCORE);
    let gameWinner: number | null = null;
    
    if (gameLoser !== -1) {
        // Find player with lowest score (game winner)
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

