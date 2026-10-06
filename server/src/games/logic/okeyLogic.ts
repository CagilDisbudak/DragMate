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

// ---------------------------------------------------------------------------
// Tile semantics (single source of truth for the win check, layout and bots)
//
// - The REAL okey (indicator + 1, same colour; 13 wraps to 1) is the wildcard:
//   it can stand in for any tile.
// - The SAHTE okey (isFakeOkey) is NOT wild: it plays as the okey's face value
//   (the okey's colour and number), i.e. it replaces the two tiles that became wild.
// - Run: same colour, consecutive, 3+ tiles. A run may continue from 13 to 1 at its
//   END (e.g. 12-13-1, 10-11-12-13-1) but never past 1 (13-1-2 is invalid).
// - Set: same number, 3 or 4 DIFFERENT colours.
// ---------------------------------------------------------------------------

const COLORS: OkeyColor[] = ['red', 'black', 'blue', 'yellow'];
const COLOR_INDEX: Record<OkeyColor, number> = { red: 0, black: 1, blue: 2, yellow: 3 };

/** True when the tile is the round's actual okey (the wild card). */
export const isRealOkeyTile = (tile: OkeyTile, okeyTile: OkeyTile | null): boolean =>
    !tile.isFakeOkey && okeyTile !== null && tile.color === okeyTile.color && tile.value === okeyTile.value;

/** Face a non-wild tile plays as: sahte okeys play as the okey's colour + number. */
const effectiveTile = (tile: OkeyTile, okeyTile: OkeyTile | null): { value: number; color: OkeyColor | null } =>
    tile.isFakeOkey
        ? { value: okeyTile?.value ?? 1, color: okeyTile?.color ?? 'red' }
        : { value: tile.value, color: tile.color };

/** counts[colourIndex][value] (value 1..13) of the NON-wild tiles, by effective face. */
type Counts = number[][];

/** One tile position in a meld: a colour/value role, filled by a real tile or a wildcard. */
interface MeldRole { color: number; value: number; wild: boolean }
type Meld = { kind: 'run' | 'set'; roles: MeldRole[] };

interface HandAnalysis {
    counts: Counts;
    wild: number;
    /** Tiles that can never be part of a meld (e.g. hidden placeholders). */
    invalid: number;
}

const analyseTiles = (tiles: OkeyTile[], okeyTile: OkeyTile | null): HandAnalysis => {
    const counts: Counts = COLORS.map(() => new Array(14).fill(0));
    let wild = 0;
    let invalid = 0;
    for (const t of tiles) {
        if (isRealOkeyTile(t, okeyTile)) { wild++; continue; }
        const e = effectiveTile(t, okeyTile);
        if (!e.color || e.value < 1 || e.value > 13) { invalid++; continue; }
        counts[COLOR_INDEX[e.color]][e.value]++;
    }
    return { counts, wild, invalid };
};

const countsKey = (counts: Counts, wild: number): string => {
    // Each row as a base-16 number (a face never has more than a handful of copies).
    let key = '';
    for (let c = 0; c < 4; c++) {
        let n = 0;
        const row = counts[c];
        for (let v = 13; v >= 1; v--) n = n * 16 + row[v];
        key += n.toString(36) + ',';
    }
    return key + wild;
};

/** First remaining non-wild tile in (colour, value) order, or null when none remain. */
const firstTile = (counts: Counts): [number, number] | null => {
    for (let c = 0; c < 4; c++) {
        const row = counts[c];
        for (let v = 1; v <= 13; v++) if (row[v] > 0) return [c, v];
    }
    return null;
};

const range = (a: number, b: number): number[] => {
    const r: number[] = [];
    for (let i = a; i <= b; i++) r.push(i);
    return r;
};

/**
 * All run value-sequences that can contain the tile (c, v), where (c, v) is the
 * LOWEST remaining tile of colour c (so every value below v in colour c must be
 * a wildcard) and at most `wild` wildcards are available. Wrap runs end with 1.
 */
const runsContaining = (counts: Counts, c: number, v: number, wild: number): number[][] => {
    const row = counts[c];
    const out: number[][] = [];
    // Plain runs s..e with s <= v <= e.
    for (let s = Math.max(1, v - wild); s <= v; s++) {
        let need = v - s; // wildcards standing in for s..v-1
        if (v - s + 1 >= 3) out.push(range(s, v));
        for (let e = v + 1; e <= 13; e++) {
            if (row[e] === 0) need++;
            if (need > wild) break;
            if (e - s + 1 >= 3) out.push(range(s, e));
        }
    }
    // Wrap runs s..13 followed by 1 (s >= 2 so 1 never appears twice).
    if (v === 1) {
        // (c, 1) is the trailing 1; positions s..13 are real or wild.
        let need = 0;
        for (let s = 13; s >= 2; s--) {
            if (row[s] === 0) need++;
            if (need > wild) break;
            if (13 - s + 2 >= 3) out.push([...range(s, 13), 1]);
        }
    } else {
        // No real (c, 1) remains (v is the lowest), so the trailing 1 is a wildcard.
        let above = 0;
        for (let u = v + 1; u <= 13; u++) if (row[u] === 0) above++;
        for (let s = Math.max(2, v - wild); s <= v; s++) {
            const need = 1 + (v - s) + above;
            if (need <= wild && 13 - s + 2 >= 3) out.push([...range(s, 13), 1]);
        }
    }
    return out;
};

/**
 * Apply a meld containing the first tile (c, v): real tiles where available,
 * wildcards elsewhere. Returns the roles and the number of wildcards used, or
 * null if it needs more wildcards than available. Mutates `counts` (caller undoes).
 */
const takeRun = (counts: Counts, c: number, v: number, values: number[], wild: number): { roles: MeldRole[]; need: number } | null => {
    const roles: MeldRole[] = [];
    let need = 0;
    let firstPlaced = false;
    for (const u of values) {
        if (u === v && !firstPlaced) {
            firstPlaced = true;
            counts[c][u]--;
            roles.push({ color: c, value: u, wild: false });
        } else if (counts[c][u] > 0) {
            counts[c][u]--;
            roles.push({ color: c, value: u, wild: false });
        } else {
            need++;
            roles.push({ color: c, value: u, wild: true });
        }
    }
    if (need > wild) { undoRoles(counts, roles); return null; }
    return { roles, need };
};

const takeSet = (counts: Counts, c: number, v: number, otherColors: number[], wild: number): { roles: MeldRole[]; need: number } | null => {
    const roles: MeldRole[] = [{ color: c, value: v, wild: false }];
    counts[c][v]--;
    let need = 0;
    for (const oc of otherColors) {
        if (counts[oc][v] > 0) { counts[oc][v]--; roles.push({ color: oc, value: v, wild: false }); }
        else { need++; roles.push({ color: oc, value: v, wild: true }); }
    }
    if (need > wild) { undoRoles(counts, roles); return null; }
    return { roles, need };
};

const undoRoles = (counts: Counts, roles: MeldRole[]) => {
    for (const r of roles) if (!r.wild) counts[r.color][r.value]++;
};

/** The 7 non-empty subsets of the three colours other than c. */
const otherColorSubsets = (c: number): number[][] => {
    const others = [0, 1, 2, 3].filter(x => x !== c);
    const subsets: number[][] = [];
    for (let mask = 1; mask < 8; mask++) subsets.push(others.filter((_, i) => mask & (1 << i)));
    return subsets;
};

/**
 * Exact solver: partitions ALL non-wild tiles and ALL wildcards into valid melds.
 * Returns the melds, or null when no partition exists. `failed` memoises dead ends.
 */
const exactPartition = (counts: Counts, wild: number, failed: Set<string>): Meld[] | null => {
    const first = firstTile(counts);
    if (!first) return wild === 0 ? [] : null; // spare wildcards must sit inside a meld
    const key = countsKey(counts, wild);
    if (failed.has(key)) return null;
    const [c, v] = first;

    for (const values of runsContaining(counts, c, v, wild)) {
        const r = takeRun(counts, c, v, values, wild);
        if (!r) continue;
        const rest = exactPartition(counts, wild - r.need, failed);
        undoRoles(counts, r.roles);
        if (rest) return [{ kind: 'run', roles: r.roles }, ...rest];
    }
    for (const subset of otherColorSubsets(c)) {
        if (subset.length < 2) continue;
        const r = takeSet(counts, c, v, subset, wild);
        if (!r) continue;
        const rest = exactPartition(counts, wild - r.need, failed);
        undoRoles(counts, r.roles);
        if (rest) return [{ kind: 'set', roles: r.roles }, ...rest];
    }
    failed.add(key);
    return null;
};

interface CoverResult { score: number; meld: Meld | null; need: number; skip: boolean }

/**
 * Best partial partition: maximises 10 x (real tiles in melds) + (wildcards in melds),
 * leaving the rest ungrouped. Melds are canonical (a wildcard sits on a run end only
 * in a 3-tile run; 4-tile sets are all real) — spare wildcards are attached afterwards.
 */
const bestCover = (counts: Counts, wild: number, memo: Map<string, CoverResult>): number => {
    const first = firstTile(counts);
    if (!first) return 0;
    const key = countsKey(counts, wild);
    const hit = memo.get(key);
    if (hit) return hit.score;
    const [c, v] = first;

    // Option: leave this tile ungrouped.
    counts[c][v]--;
    let best: CoverResult = { score: bestCover(counts, wild, memo), meld: null, need: 0, skip: true };
    counts[c][v]++;

    for (const values of runsContaining(counts, c, v, wild)) {
        const r = takeRun(counts, c, v, values, wild);
        if (!r) continue;
        const roles = r.roles;
        const canonical = roles.length === 3 || (!roles[0].wild && !roles[roles.length - 1].wild);
        if (canonical) {
            const score = 10 * (roles.length - r.need) + r.need + bestCover(counts, wild - r.need, memo);
            if (score > best.score) best = { score, meld: { kind: 'run', roles }, need: r.need, skip: false };
        }
        undoRoles(counts, roles);
    }
    for (const subset of otherColorSubsets(c)) {
        if (subset.length < 2) continue;
        const r = takeSet(counts, c, v, subset, wild);
        if (!r) continue;
        if (r.roles.length === 3 || r.need === 0) {
            const score = 10 * (r.roles.length - r.need) + r.need + bestCover(counts, wild - r.need, memo);
            if (score > best.score) best = { score, meld: { kind: 'set', roles: r.roles }, need: r.need, skip: false };
        }
        undoRoles(counts, r.roles);
    }
    memo.set(key, best);
    return best.score;
};

/** Reconstruct the melds chosen by bestCover (mutates a copy of counts). */
const coverPartition = (counts: Counts, wild: number): Meld[] => {
    const memo = new Map<string, CoverResult>();
    bestCover(counts, wild, memo);
    const melds: Meld[] = [];
    let w = wild;
    for (;;) {
        const first = firstTile(counts);
        if (!first) break;
        const choice = memo.get(countsKey(counts, w));
        if (!choice || choice.skip || !choice.meld) {
            counts[first[0]][first[1]]--; // ungrouped
            continue;
        }
        for (const r of choice.meld.roles) if (!r.wild) counts[r.color][r.value]--;
        w -= choice.need;
        melds.push(choice.meld);
    }
    return melds;
};

const cloneCounts = (counts: Counts): Counts => counts.map(r => [...r]);

/**
 * Validates if the hand is a winning hand: exactly 14 tiles, all of them in valid
 * runs/sets (see the semantics block above). Rack positions/gaps are not required.
 */
export const isWinningHand = (tiles: (OkeyTile | null)[], okeyTile: OkeyTile | null): boolean => {
    const actualTiles = tiles.filter((t): t is OkeyTile => t !== null);
    if (actualTiles.length !== 14) return false;
    // A rack holding the same physical tile twice is corrupt, never a win.
    if (new Set(actualTiles.map(t => t.id)).size !== actualTiles.length) return false;
    const a = analyseTiles(actualTiles, okeyTile);
    if (a.invalid > 0) return false;
    return exactPartition(a.counts, a.wild, new Set()) !== null;
};

/** Number of real (non-wild) tiles in the best meld partition — a hand-quality measure. */
export const countMeldedTiles = (tiles: (OkeyTile | null)[], okeyTile: OkeyTile | null): number => {
    const actual = tiles.filter((t): t is OkeyTile => t !== null);
    const a = analyseTiles(actual, okeyTile);
    const memo = new Map<string, CoverResult>();
    return Math.floor(bestCover(a.counts, a.wild, memo) / 10);
};

// Helpers

// A tile that may carry display-only metadata (kept for backward compatibility).
export interface DisplayOkeyTile extends OkeyTile {
    displayValue?: number;
    displayColor?: string;
    isJokerPlaceholder?: boolean;
}

const COLOR_ORDER: Record<string, number> = { red: 0, black: 1, blue: 2, yellow: 3 };

/**
 * Arranges a collection of tiles into a clean, readable rack layout.
 * - Finds the best partition into runs/sets using the SAME semantics as the win
 *   check (real okey = wildcard, sahte okey = the okey's face value). If the tiles
 *   (or, for 15 tiles, all but one of them) form a winning hand, that exact
 *   partition is shown and the spare tile is left on the bottom shelf.
 * - Unused okeys go first on the top shelf, then melds separated by a gap; melds
 *   that do not fit move to the bottom shelf, followed by the ungrouped tiles
 *   sorted by colour and value.
 * - Every input tile appears exactly once in the output (duplicate references of
 *   the same tile id are collapsed); nothing is ever dropped.
 *
 * Pure & reusable: used for the initial deal and the "Düzenle" auto-sort button.
 */
export const arrangeTiles = (
    inputTiles: (OkeyTile | null)[],
    okeyTile: OkeyTile | null
): (DisplayOkeyTile | null)[] => {
    // Unique tiles in input order.
    const seen = new Set<string>();
    const tiles: OkeyTile[] = [];
    for (const t of inputTiles) {
        if (t && !seen.has(t.id)) { seen.add(t.id); tiles.push(t); }
    }

    const wildTiles = tiles.filter(t => isRealOkeyTile(t, okeyTile));
    const placeable = tiles.filter(t => !isRealOkeyTile(t, okeyTile));
    const faceOf = (t: OkeyTile) => effectiveTile(t, okeyTile);
    const isValidFace = (t: OkeyTile) => { const e = faceOf(t); return !!e.color && e.value >= 1 && e.value <= 13; };

    const a = analyseTiles(tiles, okeyTile);

    // 1) Exact partition of the whole hand, or of the hand minus one tile. In that
    //    case every okey is already inside a meld (or is the single spare tile).
    let melds: Meld[] | null = null;
    if (a.invalid === 0 && tiles.length === 14) {
        melds = exactPartition(cloneCounts(a.counts), a.wild, new Set());
    } else if (a.invalid === 0 && tiles.length === 15) {
        const tried = new Set<string>();
        for (const t of [...placeable].reverse()) {
            const e = faceOf(t);
            const k = `${e.color}-${e.value}`;
            if (tried.has(k)) continue;
            tried.add(k);
            const counts = cloneCounts(a.counts);
            counts[COLOR_INDEX[e.color as OkeyColor]][e.value]--;
            melds = exactPartition(counts, a.wild, new Set());
            if (melds) break;
        }
        if (!melds && a.wild > 0) melds = exactPartition(cloneCounts(a.counts), a.wild - 1, new Set());
    }
    const exact = melds !== null;
    // 2) Otherwise the best partial partition.
    if (!melds) melds = coverPartition(cloneCounts(a.counts), a.wild);

    // Assign physical tiles to roles.
    const pools = new Map<string, OkeyTile[]>();
    for (const t of placeable) {
        if (!isValidFace(t)) continue;
        const e = faceOf(t);
        const k = `${COLOR_INDEX[e.color as OkeyColor]}-${e.value}`;
        if (!pools.has(k)) pools.set(k, []);
        pools.get(k)!.push(t);
    }
    const wildPool = [...wildTiles];
    const used = new Set<string>();
    const groups: { g: OkeyTile[]; m: Meld }[] = [];
    for (const m of melds) {
        const g: OkeyTile[] = [];
        for (const r of m.roles) {
            const t = r.wild ? wildPool.shift() : pools.get(`${r.color}-${r.value}`)?.shift();
            if (t) { g.push(t); used.add(t.id); }
        }
        if (g.length) groups.push({ g, m: { kind: m.kind, roles: [...m.roles] } });
    }

    // Partial layouts only: attach spare okeys to melds that can grow (visual only).
    const tryGrow = ({ g, m }: { g: OkeyTile[]; m: Meld }, w: OkeyTile): boolean => {
        if (m.kind === 'set') {
            if (g.length >= 4) return false;
            const taken = new Set(m.roles.map(r => r.color));
            const missing = [0, 1, 2, 3].find(c => !taken.has(c))!;
            g.push(w);
            m.roles.push({ color: missing, value: m.roles[0].value, wild: true });
            return true;
        }
        const color = m.roles[0].color;
        const firstVal = m.roles[0].value;
        const lastVal = m.roles[m.roles.length - 1].value;
        const wrapped = lastVal === 1;
        if (!wrapped && lastVal < 13) {
            g.push(w);
            m.roles.push({ color, value: lastVal + 1, wild: true });
            return true;
        }
        if (firstVal > (wrapped ? 2 : 1)) {
            g.unshift(w);
            m.roles.unshift({ color, value: firstVal - 1, wild: true });
            return true;
        }
        return false;
    };
    if (!exact) {
        for (const w of [...wildPool]) {
            if (groups.some(grp => tryGrow(grp, w))) {
                used.add(w.id);
                wildPool.splice(wildPool.indexOf(w), 1);
            }
        }
    }

    // Order melds: runs by colour then start, then sets by value.
    groups.sort((x, y) => {
        if (x.m.kind !== y.m.kind) return x.m.kind === 'run' ? -1 : 1;
        if (x.m.kind === 'run') return x.m.roles[0].color - y.m.roles[0].color || x.m.roles[0].value - y.m.roles[0].value;
        return x.m.roles[0].value - y.m.roles[0].value;
    });

    const spareWilds = tiles.filter(t => isRealOkeyTile(t, okeyTile) && !used.has(t.id));
    spareWilds.forEach(t => used.add(t.id));
    const leftovers = tiles.filter(t => !used.has(t.id));
    leftovers.sort((x, y) => {
        const ex = faceOf(x), ey = faceOf(y);
        const cx = COLOR_ORDER[ex.color ?? ''] ?? 99;
        const cy = COLOR_ORDER[ey.color ?? ''] ?? 99;
        if (cx !== cy) return cx - cy;
        return ex.value - ey.value;
    });

    // Construct the rack.
    const TOP_SHELF = RACK_SIZE / 2; // 15
    const newRack: (DisplayOkeyTile | null)[] = new Array(RACK_SIZE).fill(null);
    const placed = new Set<string>();
    const put = (t: OkeyTile, pos: number) => { newRack[pos] = t; placed.add(t.id); };

    let top = 0;
    spareWilds.forEach(t => { if (top < TOP_SHELF) put(t, top++); });
    if (spareWilds.length > 0) top++;
    let bottom = TOP_SHELF;
    const bottomGroups: OkeyTile[][] = [];
    for (const { g } of groups) {
        if (top + g.length <= TOP_SHELF) {
            g.forEach(t => put(t, top++));
            top++; // gap between groups
        } else {
            bottomGroups.push(g);
        }
    }
    for (const g of bottomGroups) {
        if (bottom + g.length > RACK_SIZE) break;
        g.forEach(t => put(t, bottom++));
        bottom++;
    }
    for (const t of leftovers) {
        if (bottom >= RACK_SIZE) break;
        put(t, bottom++);
    }
    // Safety net: anything not yet placed goes into the first free slot (never dropped).
    for (const t of tiles) {
        if (placed.has(t.id)) continue;
        const free = newRack.indexOf(null);
        if (free !== -1) put(t, free);
        else { newRack.push(t); placed.add(t.id); }
    }

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
        // initializeOkeyGame never picks a sahte okey as indicator; this fallback only
        // protects other callers (e.g. 101) from malformed input.
        return { id: 'virtual-okey', value: 1, color: 'red' };
    }

    const nextVal = indicator.value === 13 ? 1 : indicator.value + 1;
    return { id: 'virtual-okey', value: nextVal, color: indicator.color };
};

/**
 * Initializes a new game.
 * - Shuffles
 * - Picks the indicator (never a sahte okey)
 * - Distributes 15 tiles to starter, 14 to others
 * - Remainder goes to center
 */
export const initializeOkeyGame = (): OkeyGameState => {
    const deck = shuffleDeck(createOkeyDeck());

    // Indicator: the last numbered tile of the shuffled deck (uniform over numbered
    // tiles). A sahte okey has no "one above", so it can never be the indicator.
    let indicatorIdx = deck.length - 1;
    while (indicatorIdx > 0 && deck[indicatorIdx].isFakeOkey) indicatorIdx--;
    const indicator = deck.splice(indicatorIdx, 1)[0];

    // The okey definition (virtual tile): both tiles with this colour+value are wild;
    // the sahte okeys play as this colour+value.
    const okeyDef = determineOkey(indicator);

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

// ---------------------------------------------------------------------------
// Bot (AI) helpers — pure functions shared by the local single-player hook and
// the authoritative server module.
// ---------------------------------------------------------------------------

export type BotDifficulty = 'Easy' | 'Normal' | 'Hard';

/** Circular distance between tile values (1 neighbours 13 via the 12-13-1 wrap). */
const valueDistance = (a: number, b: number): number => {
    const d = Math.abs(a - b);
    return Math.min(d, 13 - d);
};

/** Deterministic small hash of a tile id, used as a noise tiebreak (no Math.random). */
const hashTileId = (id: string): number => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
};

/**
 * Heuristic usefulness of a tile given the rest of the hand:
 * - run potential: same-colour neighbours at ±1 (strong) / ±2 (weak),
 * - set potential: same value in other colours,
 * - pair: an exact duplicate already held (only 2 of each exist, so capped at one),
 * - the round's okey (wild) is maximally valuable; a sahte okey is scored as the
 *   okey's face value like any other tile.
 */
export const scoreTileUsefulness = (
    tile: OkeyTile,
    hand: (OkeyTile | null)[],
    okeyTile: OkeyTile | null
): number => {
    if (isRealOkeyTile(tile, okeyTile)) return 1000;

    const self = effectiveTile(tile, okeyTile);
    if (self.color === null) return 0;

    let score = 0;
    let setMates = 0;
    let duplicates = 0;

    for (const other of hand) {
        if (other === null || other.id === tile.id) continue;
        if (isRealOkeyTile(other, okeyTile)) continue; // wilds help every tile equally
        const eff = effectiveTile(other, okeyTile);
        if (eff.color === null) continue;

        if (eff.color === self.color) {
            const dist = valueDistance(eff.value, self.value);
            if (dist === 1) score += 4;
            else if (dist === 2) score += 2;
            else if (dist === 0) duplicates++;
        } else if (eff.value === self.value) {
            setMates++;
        }
    }

    score += Math.min(setMates, 3) * 4; // set partners (at most 3 other colours)
    score += Math.min(duplicates, 1) * 3; // pair bonus — a 2nd duplicate cannot exist

    return score;
};

/** Hand quality used by the draw decision: melded tiles first, usefulness second. */
const handQuality = (tiles: OkeyTile[], okeyTile: OkeyTile | null): number => {
    let usefulness = 0;
    for (const t of tiles) usefulness += scoreTileUsefulness(t, tiles, okeyTile);
    return countMeldedTiles(tiles, okeyTile) * 100000 + usefulness;
};

/**
 * Where should the bot draw from? It takes the previous player's discard only when
 * (a) that tile lets it finish right now, or (b) after taking it and throwing its
 * least useful OTHER tile the hand is strictly better than before. A tile it would
 * throw straight back is never taken. Because every discard pick strictly improves
 * the taker's own hand, bots can never loop forever passing tiles around.
 */
export const chooseBotDraw = (
    hand14: (OkeyTile | null)[],
    prevDiscardTop: OkeyTile | null,
    okeyTile: OkeyTile | null
): 'center' | 'discard' => {
    if (!prevDiscardTop) return 'center';
    const hand = hand14.filter((t): t is OkeyTile => t !== null);
    const hand15 = [...hand, prevDiscardTop];
    if (chooseBotFinish(hand15, okeyTile, prevDiscardTop.id) !== -1) return 'discard';
    const d = chooseBotDiscard(hand15, okeyTile, 'Normal', Math.random, prevDiscardTop.id);
    if (d === -1 || hand15[d].id === prevDiscardTop.id) return 'center';
    const after = hand15.filter((_, i) => i !== d);
    return handQuality(after, okeyTile) > handQuality(hand, okeyTile) ? 'discard' : 'center';
};

/**
 * If discarding a single tile leaves a winning 14-tile hand, return that tile's
 * rack index (the bot should finish). Returns -1 when no winning discard exists.
 * `avoidTileId` (the tile just taken from the discard pile) is never used as the
 * finishing discard.
 */
export const chooseBotFinish = (
    hand15: (OkeyTile | null)[],
    okeyTile: OkeyTile | null,
    avoidTileId?: string
): number => {
    if (hand15.filter(t => t !== null).length !== 15) return -1;

    const tested = new Set<string>();
    for (let i = 0; i < hand15.length; i++) {
        const tile = hand15[i];
        if (!tile || tile.id === avoidTileId) continue;
        const key = tile.isFakeOkey ? 'fake' : `${tile.color}-${tile.value}`;
        if (tested.has(key)) continue; // an identical tile was already tested
        tested.add(key);

        const remaining = [...hand15];
        remaining[i] = null;
        if (isWinningHand(remaining, okeyTile)) return i;
    }
    return -1;
};

/**
 * Pick the rack index to discard: the least useful tile, never the okey unless the
 * hand holds nothing else, and never `avoidTileId` (the tile just taken from the
 * discard pile) unless it is the only option. Easy throws a random tile ~60% of the
 * time; Hard additionally holds tiles adjacent to the okey's value. `rand` defaults
 * to Math.random — never call this from a React render path (event handlers /
 * timers / server code are fine).
 */
export const chooseBotDiscard = (
    hand15: (OkeyTile | null)[],
    okeyTile: OkeyTile | null,
    difficulty: BotDifficulty = 'Normal',
    rand: () => number = Math.random,
    avoidTileId?: string
): number => {
    const occupied: number[] = [];
    for (let i = 0; i < hand15.length; i++) {
        if (hand15[i] !== null) occupied.push(i);
    }
    if (occupied.length === 0) return -1;

    const notAvoided = occupied.filter(i => hand15[i]!.id !== avoidTileId);
    const pool = notAvoided.length > 0 ? notAvoided : occupied;
    const nonOkey = pool.filter(i => !isRealOkeyTile(hand15[i]!, okeyTile));
    const candidates = nonOkey.length > 0 ? nonOkey : pool; // forced only when all tiles are wild

    if (difficulty === 'Easy' && rand() < 0.6) {
        return candidates[Math.floor(rand() * candidates.length)];
    }

    let bestIdx = candidates[0];
    let bestScore = Infinity;
    for (const i of candidates) {
        const tile = hand15[i]!;
        let score = scoreTileUsefulness(tile, hand15, okeyTile);
        const eff = effectiveTile(tile, okeyTile);
        if (
            difficulty === 'Hard' &&
            okeyTile !== null &&
            eff.color === okeyTile.color &&
            valueDistance(eff.value, okeyTile.value) <= 1
        ) {
            score += 1; // hold tiles adjacent to the okey's value
        }
        score += (hashTileId(tile.id) % 97) / 1000; // deterministic noise tiebreak
        if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }
    return bestIdx;
};
