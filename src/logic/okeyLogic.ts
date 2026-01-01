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

export type OkeyPhase = 'dealing' | 'playing' | 'roundOver';

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

// Helpers
const COLORS: OkeyColor[] = ['red', 'black', 'blue', 'yellow'];

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

    // Fill user's rack (Player 0)
    for (let i = 0; i < 15; i++) {
        players[0].tiles[i] = deck.pop()!;
    }

    // Fill other players' racks
    for (let p = 1; p < 4; p++) {
        for (let i = 0; i < 14; i++) {
            players[p].tiles[i] = deck.pop()!;
        }
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
