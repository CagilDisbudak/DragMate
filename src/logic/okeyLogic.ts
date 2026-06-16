export type OkeyColor = 'red' | 'black' | 'blue' | 'yellow';

export interface OkeyTile {
    id: string; // unique identifier
    value: number; // 1-13, or special for false okey
    color: OkeyColor | null; // null for false okey
    isFakeOkey?: boolean; // 'Sahte Okey'
}

export const RACK_SIZE = 30; // 2 rows of 15 slots

export interface PlayerHand {
    tiles: (OkeyTile | null)[]; // The tiles in the player's rack (length = RACK_SIZE)
}

export type OkeyPhase = 'dealing' | 'playing' | 'roundOver' | 'stackEmpty';

export interface OkeyGameState {
    phase: OkeyPhase;
    players: PlayerHand[]; // 4 players. Index 0 is local user.
    centerStack: OkeyTile[];
    discardPiles: OkeyTile[][]; // 4 distinct piles, one for each player
    indicatorTile: OkeyTile | null; // The tile that determines the 'Okey'
    okeyTile: OkeyTile | null; // The actual Okey for this round (e.g. Red 5 if indicator is Red 4)
    currentTurn: number; // 0-3
    winner: number | null;
}

/**
 * Validates if the hand is a winning hand (14 tiles in valid sets/runs).
 */
export const isWinningHand = (tiles: (OkeyTile | null)[], okeyTile: OkeyTile | null): boolean => {
    const actualTiles = tiles.filter((t): t is OkeyTile => t !== null);
    if (actualTiles.length !== 14) return false;

    const wildcards: OkeyTile[] = [];
    const normals: OkeyTile[] = [];

    actualTiles.forEach(t => {
        const isRealOkey = !t.isFakeOkey && okeyTile && t.color === okeyTile.color && t.value === okeyTile.value;
        if (isRealOkey) {
            wildcards.push(t);
        } else {
            if (t.isFakeOkey) {
                normals.push({ ...t, value: okeyTile?.value || 1, color: okeyTile?.color || 'red', isFakeOkey: false });
            } else {
                normals.push(t);
            }
        }
    });

    normals.sort((a, b) => {
        if (a.color !== b.color) return a.color!.localeCompare(b.color!);
        return a.value - b.value;
    });

    return checkRecursive(normals, wildcards.length);
};

const checkRecursive = (remainingTiles: OkeyTile[], wildcardCount: number): boolean => {
    if (remainingTiles.length === 0) return true;

    const first = remainingTiles[0];

    // OPTION 1: Run (same color, consecutive)
    const sameColorTiles = remainingTiles.filter(t => t.color === first.color);

    for (let size = 3; size <= 13; size++) {
        const expectedValues = [];
        let valid = true;
        for (let i = 0; i < size; i++) {
            const v = first.value + i;
            if (v > 13) { valid = false; break; }
            expectedValues.push(v);
        }
        if (!valid) break;

        const consumed: OkeyTile[] = [];
        let missing = 0;
        let tempColorTiles = [...sameColorTiles];
        for (const v of expectedValues) {
            const idx = tempColorTiles.findIndex(t => t.value === v);
            if (idx !== -1) {
                consumed.push(tempColorTiles[idx]);
                tempColorTiles.splice(idx, 1);
            } else {
                missing++;
            }
        }

        if (missing <= wildcardCount) {
            const consumedIds = consumed.map(c => c.id);
            const nextRemaining = remainingTiles.filter(t => !consumedIds.includes(t.id));
            if (checkRecursive(nextRemaining, wildcardCount - missing)) return true;
        }
    }

    // Wrap-around Run (if first is '1')
    if (first.value === 1) {
        for (let size = 3; size <= 4; size++) {
            const expectedValues = [];
            for (let v = 13 - (size - 2); v <= 13; v++) expectedValues.push(v);
            expectedValues.push(1);

            const consumed: OkeyTile[] = [];
            let missing = 0;
            let tempColorTiles = [...sameColorTiles];
            for (const v of expectedValues) {
                const idx = tempColorTiles.findIndex(t => t.value === v);
                if (idx !== -1) {
                    consumed.push(tempColorTiles[idx]);
                    tempColorTiles.splice(idx, 1);
                } else {
                    missing++;
                }
            }
            if (missing <= wildcardCount) {
                const consumedIds = consumed.map(c => c.id);
                const nextRemaining = remainingTiles.filter(t => !consumedIds.includes(t.id));
                if (checkRecursive(nextRemaining, wildcardCount - missing)) return true;
            }
        }
    }

    // OPTION 2: Set (same value, different colors)
    const sameValueTiles = remainingTiles.filter(t => t.value === first.value);
    const uniqueColorTiles: OkeyTile[] = [];
    const colorsFound = new Set();
    for (const t of sameValueTiles) {
        if (!colorsFound.has(t.color)) {
            colorsFound.add(t.color);
            uniqueColorTiles.push(t);
        }
    }

    for (let size = 3; size <= 4; size++) {
        const possibleRealTiles = uniqueColorTiles.slice(0, Math.min(size, uniqueColorTiles.length));
        const missing = size - possibleRealTiles.length;
        if (missing >= 0 && missing <= wildcardCount) {
            const consumedIds = possibleRealTiles.map(p => p.id);
            const nextRemaining = remainingTiles.filter(t => !consumedIds.includes(t.id));
            if (checkRecursive(nextRemaining, wildcardCount - missing)) return true;
        }
    }

    return false;
};

// Helpers
const COLORS: OkeyColor[] = ['red', 'black', 'blue', 'yellow'];

// A tile that may carry display-only metadata when a joker stands in for a real tile.
export interface DisplayOkeyTile extends OkeyTile {
    displayValue?: number;
    displayColor?: string;
    isJokerPlaceholder?: boolean;
}

const COLOR_ORDER: Record<string, number> = { red: 0, black: 1, blue: 2, yellow: 3 };

/**
 * Arranges a collection of tiles into a clean, readable rack layout.
 * - Detects complete runs (same color, consecutive) and sets (same value, different colors).
 * - Uses jokers (fake okeys) to complete near-miss runs/sets.
 * - Groups are placed on the top shelf (slots 0..14) separated by a gap.
 * - Leftover (ungrouped) tiles are sorted by color & value and placed on the
 *   bottom shelf (slots 15..29).
 *
 * Pure & reusable: used both for the initial deal and the "Düzenle" auto-sort button,
 * so a freshly dealt hand already looks organized in both single & multiplayer.
 */
export const arrangeTiles = (
    inputTiles: (OkeyTile | null)[],
    okeyTile: OkeyTile | null
): (DisplayOkeyTile | null)[] => {
    const originalTiles = inputTiles.filter((t): t is OkeyTile => t !== null) as DisplayOkeyTile[];

    // Separate joker tiles (pure wild fake okeys) from tiles usable by value.
    const jokerPool: DisplayOkeyTile[] = [...originalTiles.filter(t => t.isFakeOkey)];
    const okeyValueTiles = originalTiles.filter(
        t => !t.isFakeOkey && okeyTile && t.color === okeyTile.color && t.value === okeyTile.value
    );
    const normalTiles = originalTiles.filter(
        t => !t.isFakeOkey && !(okeyTile && t.color === okeyTile.color && t.value === okeyTile.value)
    );

    // Okey-value tiles can be used both as jokers and by their actual value;
    // try to use them by value first.
    const tilesForRuns: DisplayOkeyTile[] = [...normalTiles, ...okeyValueTiles];

    const groups: DisplayOkeyTile[][] = [];
    const remaining = [...tilesForRuns];
    const colors: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];

    const createJokerPlaceholder = (joker: DisplayOkeyTile, forValue: number, forColor: string): DisplayOkeyTile => ({
        ...joker,
        displayValue: forValue,
        displayColor: forColor,
        isJokerPlaceholder: true,
    });

    // 1. First pass: complete runs (3+ consecutive, same color) without jokers.
    colors.forEach(color => {
        let sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);
        let i = 0;
        while (i < sameColor.length) {
            const currentRun: DisplayOkeyTile[] = [sameColor[i]];
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

            // Special case: wrap around 13-1.
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

    // 2. First pass: complete sets (3+ same value, different colors) without jokers.
    for (let val = 1; val <= 13; val++) {
        const sameValue = remaining.filter(t => t.value === val);
        const uniqueColors = Array.from(new Set(sameValue.map(t => t.color)));
        if (uniqueColors.length >= 3) {
            const set = uniqueColors.map(c => sameValue.find(t => t.color === c)!) as DisplayOkeyTile[];
            groups.push(set);
            set.forEach(t => {
                const idx = remaining.findIndex(r => r.id === t.id);
                if (idx !== -1) remaining.splice(idx, 1);
            });
        }
    }

    // 3. Use jokers to complete 2-tile runs (need 1 joker to make 3).
    colors.forEach(color => {
        if (jokerPool.length === 0) return;
        const sameColor = remaining.filter(t => t.color === color).sort((a, b) => a.value - b.value);

        for (let i = 0; i < sameColor.length - 1 && jokerPool.length > 0; i++) {
            const tile1 = sameColor[i];
            const tile2 = sameColor[i + 1];

            // Consecutive (e.g. 5-6, joker as 4 or 7).
            if (tile2.value === tile1.value + 1) {
                const joker = jokerPool.shift()!;
                if (tile2.value < 13) {
                    groups.push([tile1, tile2, createJokerPlaceholder(joker, tile2.value + 1, color)]);
                } else if (tile1.value > 1) {
                    groups.push([createJokerPlaceholder(joker, tile1.value - 1, color), tile1, tile2]);
                } else {
                    groups.push([tile1, tile2, createJokerPlaceholder(joker, 3, color)]);
                }
                [tile1, tile2].forEach(t => {
                    const idx = remaining.findIndex(r => r.id === t.id);
                    if (idx !== -1) remaining.splice(idx, 1);
                });
                i = -1; // restart scan
            }
            // Gap of 1 (e.g. 5-7, joker as 6).
            else if (tile2.value === tile1.value + 2 && jokerPool.length > 0) {
                const joker = jokerPool.shift()!;
                groups.push([tile1, createJokerPlaceholder(joker, tile1.value + 1, color), tile2]);
                [tile1, tile2].forEach(t => {
                    const idx = remaining.findIndex(r => r.id === t.id);
                    if (idx !== -1) remaining.splice(idx, 1);
                });
                i = -1;
            }
        }
    });

    // 4. Use jokers to complete 2-tile sets (same value, 2 different colors).
    for (let val = 1; val <= 13 && jokerPool.length > 0; val++) {
        const sameValue = remaining.filter(t => t.value === val);
        const uniqueColors = Array.from(new Set(sameValue.map(t => t.color)));

        if (uniqueColors.length === 2) {
            const joker = jokerPool.shift()!;
            const missingColor = colors.find(c => !uniqueColors.includes(c))!;
            const jokerTile = createJokerPlaceholder(joker, val, missingColor);
            const set = [...uniqueColors.map(c => sameValue.find(t => t.color === c)!), jokerTile] as DisplayOkeyTile[];
            groups.push(set);
            set.forEach(t => {
                if (!t.isJokerPlaceholder) {
                    const idx = remaining.findIndex(r => r.id === t.id);
                    if (idx !== -1) remaining.splice(idx, 1);
                }
            });
        }
    }

    // Sort leftovers by color then value for a tidy bottom shelf.
    remaining.sort((a, b) => {
        const ca = COLOR_ORDER[a.color ?? ''] ?? 99;
        const cb = COLOR_ORDER[b.color ?? ''] ?? 99;
        if (ca !== cb) return ca - cb;
        return a.value - b.value;
    });

    // Construct the new rack.
    const TOP_SHELF = RACK_SIZE / 2; // 15
    const newRack: (DisplayOkeyTile | null)[] = new Array(RACK_SIZE).fill(null);
    let currentPos = 0;

    // Place any unused jokers first.
    jokerPool.forEach(t => {
        if (currentPos < RACK_SIZE) newRack[currentPos++] = t;
    });
    if (jokerPool.length > 0) currentPos++; // gap after jokers

    // Place groups, separated by a gap.
    groups.forEach(group => {
        group.forEach(t => {
            if (currentPos < RACK_SIZE) newRack[currentPos++] = t;
        });
        currentPos++; // gap between groups
    });

    // Place leftover tiles on the bottom shelf.
    let remainingPos = TOP_SHELF;
    while (remainingPos < RACK_SIZE && newRack[remainingPos] !== null) remainingPos++;
    remaining.forEach(t => {
        if (remainingPos < RACK_SIZE) newRack[remainingPos++] = t;
    });

    return newRack;
};

/**
 * Creates a full set of 106 tiles.
 * 1-13 in 4 colors, 2 of each = 13 * 4 * 2 = 104
 * + 2 False Okeys = 106
 */
export const createOkeyDeck = (): OkeyTile[] => {
    const tiles: OkeyTile[] = [];
    let idCounter = 1;

    COLORS.forEach(color => {
        for (let val = 1; val <= 13; val++) {
            // First set
            tiles.push({ id: `t-${idCounter++}`, value: val, color });
            // Second set
            tiles.push({ id: `t-${idCounter++}`, value: val, color });
        }
    });

    // Two False Okeys
    tiles.push({ id: `t-${idCounter++}`, value: 0, color: null, isFakeOkey: true });
    tiles.push({ id: `t-${idCounter++}`, value: 0, color: null, isFakeOkey: true });

    return tiles;
};

export const shuffleDeck = (deck: OkeyTile[]): OkeyTile[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

/**
 * Determines the 'Okey' based on the indicator.
 * Okey is same color, value + 1. (If 13, then 1).
 */
export const determineOkey = (indicator: OkeyTile): OkeyTile => {
    if (indicator.isFakeOkey || !indicator.color) {
        // Should be rare/impossible if indicator drawn from numbered tiles, 
        // but fallback to Red 1 just in case
        return { id: 'virtual-okey', value: 1, color: 'red' };
    }

    const nextVal = indicator.value === 13 ? 1 : indicator.value + 1;
    return { id: 'virtual-okey', value: nextVal, color: indicator.color };
};

/**
 * Initializes a new game.
 * - Shuffles
 * - Picks indicator
 * - Distributes 15 tiles to starter, 14 to others
 * - Remainder goes to center
 */
export const initializeOkeyGame = (): OkeyGameState => {
    let deck = shuffleDeck(createOkeyDeck());

    // Pick indicator (usually from end or random, let's pop random for simplicity logic)
    // In real Okey, distribution is complex (stacks of 5).
    // Simplified: Pop one for indicator.
    const indicator = deck.pop()!;

    // Determine ACTUAL Okey (virtual tile def)
    const okeyDef = determineOkey(indicator);

    // Note: We don't put the okey definition back in deck, 
    // we just know conceptually that 'Red 5' is now wild.

    // Logic fix: The "False Okeys" in the deck act as the 'okeyDef' tile.
    // The 'okeyDef' tiles in the deck act as Wild Cards.
    // We don't perform this swap in data structure here, visual layer handles logic usually,
    // OR we can mark them. For simplicity, we just store `okeyTile` in state for check checks.

    // Distribute
    // Player 0 (User) starts -> 15 tiles
    // Players 1,2,3 -> 14 tiles
    const players: PlayerHand[] = Array(4).fill(null).map(() => ({
        tiles: Array(RACK_SIZE).fill(null)
    }));

    // Deal each player's tiles (starter gets 15, others 14), then arrange every
    // hand into a clean layout so it already looks organized the moment it is dealt
    // (instead of random order). Arranging all seats means every human in an online
    // room — not just the host at slot 0 — receives a tidy hand.
    const dealCounts = [15, 14, 14, 14];
    for (let p = 0; p < 4; p++) {
        const hand: OkeyTile[] = [];
        for (let i = 0; i < dealCounts[p]; i++) {
            hand.push(deck.pop()!);
        }
        players[p].tiles = arrangeTiles(hand, okeyDef);
    }

    return {
        phase: 'playing',
        players,
        centerStack: deck,
        discardPiles: [[], [], [], []], // 4 piles
        indicatorTile: indicator,
        okeyTile: okeyDef,
        currentTurn: 0,
        winner: null,
    };
};
