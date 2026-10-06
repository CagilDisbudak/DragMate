// 101 Game Logic - Uses same tile types as Okey
//
// Okey semantics (as in the rules text): the indicator's +1 tile of the same colour
// is the round's OKEY and acts as a wildcard. The two "sahte okey" tiles
// (isFakeOkey) are NOT wild — each stands for the okey's own colour+number.
// Every validator / scorer below takes the round's okey tile for that reason.
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
/** Penalty for throwing the okey away (only allowed when nothing else is left to discard). */
export const OKEY_DISCARD_PENALTY = 101;
/** Hand value of an okey (wild) still on the rack when the round ends. */
export const OKEY_IN_HAND_POINTS = 25;

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
    /** Seat that dealt this round; the starter is the next seat. */
    dealer?: number;
}

type OkeyRef = Tile101 | null | undefined;
type Face = { color: OkeyColor | null; value: number };

const COLOR_ORDER: OkeyColor[] = ['red', 'blue', 'black', 'yellow'];
const colorIndex = (c: OkeyColor | null): number => (c ? COLOR_ORDER.indexOf(c) : 99);
const nonNull = (t: Tile101 | null | undefined): t is Tile101 => !!t;

// ---------------------------------------------------------------------------
// Okey helpers
// ---------------------------------------------------------------------------

/**
 * True when `tile` is this round's wildcard: the real okey (indicator + 1, same colour).
 * Without a known okey (legacy callers) the sahte okey is treated as the joker.
 */
export const isWildOkey = (tile: Tile101, okey: OkeyRef): boolean => {
    if (!okey || !okey.color) return !!tile.isFakeOkey;
    return !tile.isFakeOkey && tile.color === okey.color && tile.value === okey.value;
};

/** Colour/number a non-wild tile plays as (sahte okey → the okey's face). */
export const tileFace = (tile: Tile101, okey: OkeyRef): Face => {
    if (tile.isFakeOkey) {
        return okey && okey.color ? { color: okey.color, value: okey.value } : { color: null, value: 0 };
    }
    return { color: tile.color, value: tile.value };
};

/** Point value of a tile value (1 = 1, 2-10 = face, 11-13 = 10). */
const pointsForValue = (value: number): number => (value >= 11 ? 10 : value);
/** Run position 1..14 where 14 is the "1" placed after 13. */
const pointsForPosition = (pos: number): number => (pos === 14 ? 1 : pointsForValue(pos));

/**
 * Point value of a tile left in hand.
 * Okey (wild) = 25; sahte okey counts as the okey's number; 11-13 = 10.
 */
export const getTilePoints = (tile: Tile101, okey?: OkeyRef): number => {
    if (isWildOkey(tile, okey)) return OKEY_IN_HAND_POINTS;
    const f = tileFace(tile, okey);
    return f.color ? pointsForValue(f.value) : OKEY_IN_HAND_POINTS;
};

/**
 * Calculate points in a player's hand (for scoring at round end)
 */
export const calculateHandPoints = (tiles: (Tile101 | null)[], okey?: OkeyRef): number => {
    return tiles.filter(nonNull).reduce((sum, tile) => sum + getTilePoints(tile, okey), 0);
};

// ---------------------------------------------------------------------------
// Meld validation
// ---------------------------------------------------------------------------

/**
 * Check if a set of tiles forms a valid SET (same value, 3-4 different colors).
 * Okeys (wild) fill missing colours; at least one real tile is required.
 */
export const isValidSet = (tiles: Tile101[], okey?: OkeyRef): boolean => {
    if (tiles.length < 3 || tiles.length > 4) return false;
    const faces = tiles.filter(t => !isWildOkey(t, okey)).map(t => tileFace(t, okey));
    if (faces.length === 0) return false;
    if (faces.some(f => !f.color)) return false;
    const value = faces[0].value;
    if (!faces.every(f => f.value === value)) return false;
    return new Set(faces.map(f => f.color)).size === faces.length;
};

/**
 * Every start position a group of tiles can occupy as a RUN. Positions run 1..14,
 * where 14 is the 1 that may follow 13 (12-13-1 is legal, 13-1-2 is not).
 * Okeys fill any position. Returns [] when the tiles are not a run.
 */
export const runPlacements = (tiles: Tile101[], okey?: OkeyRef): number[] => {
    const len = tiles.length;
    if (len < 3 || len > 13) return [];
    const faces: Face[] = [];
    for (const t of tiles) {
        if (isWildOkey(t, okey)) continue;
        const f = tileFace(t, okey);
        if (!f.color) return [];
        faces.push(f);
    }
    if (faces.length === 0) return [];
    if (!faces.every(f => f.color === faces[0].color)) return [];

    const starts: number[] = [];
    for (let s = 1; s + len - 1 <= 14; s++) {
        const e = s + len - 1;
        const used = new Set<number>();
        let ok = true;
        for (const f of faces) {
            let pos = -1;
            if (f.value >= s && f.value <= e) pos = f.value;
            else if (f.value === 1 && e === 14) pos = 14;
            if (pos === -1 || used.has(pos)) { ok = false; break; }
            used.add(pos);
        }
        if (ok) starts.push(s);
    }
    return starts;
};

/**
 * Check if a set of tiles forms a valid RUN (same color, 3-13 consecutive).
 * Okeys may fill internal gaps or extend either end. Duplicate values are NOT allowed.
 * Classic wrap: 12-13-1 is allowed; 13-1-2 is not.
 */
export const isValidRun = (tiles: Tile101[], okey?: OkeyRef): boolean => runPlacements(tiles, okey).length > 0;

/**
 * Check if tiles form a valid meld (either set or run)
 */
export const isValidMeld = (tiles: Tile101[], okey?: OkeyRef): { valid: boolean; type: 'set' | 'run' | null } => {
    if (isValidSet(tiles, okey)) return { valid: true, type: 'set' };
    if (isValidRun(tiles, okey)) return { valid: true, type: 'run' };
    return { valid: false, type: null };
};

/** A pair (çift): two identical tiles, or one tile + an okey. */
export const isValidPair = (tiles: Tile101[], okey?: OkeyRef): boolean => {
    if (tiles.length !== 2) return false;
    const real = tiles.filter(t => !isWildOkey(t, okey));
    if (real.length === 0) return false;
    if (real.length === 1) return !!tileFace(real[0], okey).color;
    const a = tileFace(real[0], okey), b = tileFace(real[1], okey);
    return !!a.color && a.color === b.color && a.value === b.value;
};

/**
 * Start position (1..14 scale) of a run as it lies on the table, i.e. consistent with the
 * stored tile order — so every okey keeps the value it was laid as. Null if the stored
 * order is not a run layout (then the multiset rule applies).
 */
const laidRunStart = (tiles: Tile101[], okey: OkeyRef): number | null => {
    const len = tiles.length;
    const first = tiles.findIndex(t => !isWildOkey(t, okey));
    if (first === -1) return null;
    const f = tileFace(tiles[first], okey);
    const options = f.value === 1 ? [1 - first, 14 - first] : [f.value - first];
    for (const s of options) {
        if (s < 1 || s + len - 1 > 14) continue;
        const ok = tiles.every((t, i) => {
            if (isWildOkey(t, okey)) return true;
            const g = tileFace(t, okey);
            const pos = s + i;
            return g.color === f.color && (pos === 14 ? g.value === 1 : g.value === pos);
        });
        if (ok) return s;
    }
    return null;
};

/** Where a tile would attach to a laid run: 'low' / 'high' end, or null if it does not fit. */
const runAttachSide = (meld: Meld, tile: Tile101, okey: OkeyRef): 'low' | 'high' | null => {
    const tiles = [...meld.tiles, tile];
    if (!isValidRun(tiles, okey)) return null;
    const s = laidRunStart(meld.tiles, okey);
    if (s === null) return 'high'; // legacy unordered meld: multiset rule, re-ordered on add
    const e = s + meld.tiles.length - 1;
    if (isWildOkey(tile, okey)) return e < 14 ? 'high' : s > 1 ? 'low' : null;
    const f = tileFace(tile, okey);
    const color = tileFace(meld.tiles.find(t => !isWildOkey(t, okey))!, okey).color;
    if (f.color !== color) return null;
    if (e < 14 && (e + 1 === 14 ? 1 : e + 1) === f.value) return 'high';
    if (s > 1 && s - 1 === f.value) return 'low';
    return null;
};

/**
 * Check if a tile can be added to an existing meld.
 * Runs grow only at their ends and okeys already on the table keep their value;
 * sets accept a missing colour. Pair melds (çift açış) do not accept additions.
 */
export const canAddToMeld = (meld: Meld, tile: Tile101, okey?: OkeyRef): boolean => {
    if (meld.type === 'pair') return false;
    if (meld.type === 'set') return isValidSet([...meld.tiles, tile], okey);
    return runAttachSide(meld, tile, okey) !== null;
};

/** Tiles of `meld` after adding `tile` (call only when canAddToMeld is true), in display order. */
export const addTileToMeld = (meld: Meld, tile: Tile101, okey?: OkeyRef): Tile101[] => {
    if (meld.type === 'run') {
        if (laidRunStart(meld.tiles, okey) === null) return orderMeldTiles([...meld.tiles, tile], 'run', okey);
        return runAttachSide(meld, tile, okey) === 'low' ? [tile, ...meld.tiles] : [...meld.tiles, tile];
    }
    return orderMeldTiles([...meld.tiles, tile], meld.type, okey);
};

/**
 * Total point value a meld contributes toward the 101-point first lay-down.
 * Okeys count as the tile they stand for. When an okey at a run end could stand
 * for either neighbour, the higher-value placement is used. Pairs count 0.
 */
export const getMeldPoints = (tiles: Tile101[], type: 'set' | 'run' | 'pair', okey?: OkeyRef): number => {
    if (type === 'pair') return 0;
    if (type === 'set') {
        const real = tiles.find(t => !isWildOkey(t, okey));
        if (!real) return 0;
        return tiles.length * pointsForValue(tileFace(real, okey).value);
    }
    let best = 0;
    for (const s of runPlacements(tiles, okey)) {
        let sum = 0;
        for (let i = 0; i < tiles.length; i++) sum += pointsForPosition(s + i);
        if (sum > best) best = sum;
    }
    return best;
};

/**
 * Display order for a meld: runs ascending (okeys in the slots they fill),
 * sets by colour with okeys last.
 */
export const orderMeldTiles = (tiles: Tile101[], type: 'set' | 'run' | 'pair', okey?: OkeyRef): Tile101[] => {
    if (type === 'pair') return [...tiles];
    if (type === 'set') {
        const real = tiles.filter(t => !isWildOkey(t, okey))
            .sort((a, b) => colorIndex(tileFace(a, okey).color) - colorIndex(tileFace(b, okey).color));
        return [...real, ...tiles.filter(t => isWildOkey(t, okey))];
    }
    const starts = runPlacements(tiles, okey);
    if (starts.length === 0) return [...tiles];
    let s = starts[0];
    let bestPts = -1;
    for (const st of starts) {
        let sum = 0;
        for (let i = 0; i < tiles.length; i++) sum += pointsForPosition(st + i);
        if (sum > bestPts) { bestPts = sum; s = st; }
    }
    const e = s + tiles.length - 1;
    const slots: (Tile101 | null)[] = new Array(tiles.length).fill(null);
    const wilds: Tile101[] = [];
    for (const t of tiles) {
        if (isWildOkey(t, okey)) { wilds.push(t); continue; }
        const v = tileFace(t, okey).value;
        const pos = v >= s && v <= e ? v : 14;
        slots[pos - s] = t;
    }
    return slots.map(t => t ?? wilds.shift()!);
};

/**
 * Check if player can make their first normal lay down (101+ points across melds).
 */
export const canMakeFirstLayDown = (melds: Tile101[][], okey?: OkeyRef): boolean => {
    let totalPoints = 0;
    for (const meld of melds) {
        const validation = isValidMeld(meld, okey);
        if (!validation.valid || !validation.type) return false;
        totalPoints += getMeldPoints(meld, validation.type, okey);
    }
    return totalPoints >= FIRST_MELD_MINIMUM;
};

// ---------------------------------------------------------------------------
// Exact meld search (shared by the side-tile rule and the bot)
// ---------------------------------------------------------------------------

export interface PlannedMeld {
    tiles: Tile101[];
    type: 'set' | 'run';
    points: number;
}

interface Candidate {
    keys: number[]; // face keys (colorIdx*13 + value-1), distinct
    wild: number;
    type: 'set' | 'run';
    points: number;
    score: number;
    rel: number[]; // relevant-key indices (ascending)
}

const faceKey = (f: Face): number => (f.color ? COLOR_ORDER.indexOf(f.color) * 13 + (f.value - 1) : -1);

const buildCandidates = (present: Set<number>, wildCount: number): Candidate[] => {
    const W = Math.min(wildCount, 2);
    const out: Candidate[] = [];
    const push = (keys: number[], wild: number, type: 'set' | 'run', points: number) => {
        out.push({ keys, wild, type, points, score: points * 64 + keys.length + wild, rel: [] });
    };
    // Sets
    for (let v = 1; v <= 13; v++) {
        const colors = [0, 1, 2, 3].filter(c => present.has(c * 13 + v - 1));
        for (let mask = 1; mask < 16; mask++) {
            const chosen = colors.filter((_, i) => mask & (1 << i));
            if (chosen.length === 0 || mask >= 1 << colors.length) continue;
            for (let w = 0; w <= Math.min(W, 4 - chosen.length); w++) {
                const size = chosen.length + w;
                if (size < 3) continue;
                push(chosen.map(c => c * 13 + v - 1), w, 'set', size * pointsForValue(v));
            }
        }
    }
    // Runs (positions 1..14, 14 = the 1 after 13)
    for (let c = 0; c < 4; c++) {
        for (let s = 1; s <= 12; s++) {
            const keys: number[] = [];
            let miss = 0;
            let pts = 0;
            for (let e = s; e <= Math.min(14, s + 12); e++) {
                const v = e === 14 ? 1 : e;
                const k = c * 13 + v - 1;
                if (present.has(k)) keys.push(k); else miss++;
                pts += pointsForPosition(e);
                if (miss > W) break;
                if (e - s + 1 < 3 || keys.length === 0) continue;
                push([...keys], miss, 'run', pts);
                // Okeys may also stand in for a present tile that another meld needs.
                if (miss + 1 <= W) {
                    for (let i = 0; i < keys.length; i++) {
                        if (keys.length > 1) push(keys.filter((_, x) => x !== i), miss + 1, 'run', pts);
                        if (miss + 2 <= W) {
                            for (let j = i + 1; j < keys.length; j++) {
                                if (keys.length > 2) push(keys.filter((_, x) => x !== i && x !== j), miss + 2, 'run', pts);
                            }
                        }
                    }
                }
            }
        }
    }
    return out;
};

const SEARCH_STATE_BUDGET = 250_000;

/**
 * Best (highest point) set of disjoint melds that can be formed from `pool`.
 * When `mustUse` is given, only plans whose melds include that tile are considered
 * (returns null if none exists). Exact memoised search with a greedy fallback for
 * pathological hands.
 */
export const findBestMelds = (
    pool: Tile101[],
    okey?: OkeyRef,
    mustUse?: Tile101 | null,
): { melds: PlannedMeld[]; points: number } | null => {
    const wilds = pool.filter(t => isWildOkey(t, okey));
    const byKey = new Map<number, Tile101[]>();
    for (const t of pool) {
        if (isWildOkey(t, okey)) continue;
        const k = faceKey(tileFace(t, okey));
        if (k < 0) continue;
        const list = byKey.get(k) || [];
        list.push(t);
        byKey.set(k, list);
    }
    const cands = buildCandidates(new Set(byKey.keys()), wilds.length);
    const empty = { melds: [] as PlannedMeld[], points: 0 };
    if (cands.length === 0) return mustUse ? null : empty;

    const relKeys = [...new Set(cands.flatMap(c => c.keys))].sort((a, b) => a - b);
    const relIndex = new Map(relKeys.map((k, i) => [k, i]));
    const R = relKeys.length;
    const buckets: number[][] = Array.from({ length: R }, () => []);
    cands.forEach((c, i) => {
        c.rel = c.keys.map(k => relIndex.get(k)!).sort((a, b) => a - b);
        buckets[c.rel[0]].push(i);
    });
    const pow3: number[] = [1];
    for (let i = 1; i <= R; i++) pow3.push(pow3[i - 1] * 3);
    const counts = relKeys.map(k => Math.min(2, byKey.get(k)!.length));
    let code0 = 0;
    counts.forEach((n, i) => { code0 += n * pow3[i]; });

    const memo = new Map<number, number>();
    const choice = new Map<number, number>();
    let overBudget = false;

    const solve = (code: number, wl: number): number => {
        let r = 0;
        while (r < R && counts[r] === 0) r++;
        if (r === R) return 0;
        const mkey = code * 3 + wl;
        const hit = memo.get(mkey);
        if (hit !== undefined) return hit;
        if (memo.size > SEARCH_STATE_BUDGET) { overBudget = true; return 0; }
        counts[r]--;
        let best = solve(code - pow3[r], wl);
        counts[r]++;
        let bestC = -1;
        for (const ci of buckets[r]) {
            const c = cands[ci];
            if (c.wild > wl) continue;
            let ok = true;
            for (const x of c.rel) if (counts[x] === 0) { ok = false; break; }
            if (!ok) continue;
            let delta = 0;
            for (const x of c.rel) { counts[x]--; delta += pow3[x]; }
            const v = c.score + solve(code - delta, wl - c.wild);
            for (const x of c.rel) counts[x]++;
            if (v > best) { best = v; bestC = ci; }
        }
        memo.set(mkey, best);
        choice.set(mkey, bestC);
        return best;
    };

    const applicable = (c: Candidate, wl: number) => c.wild <= wl && c.rel.every(x => counts[x] > 0);
    const chosen: Candidate[] = [];
    let forced: Candidate | null = null;
    let code = code0;
    let wl = Math.min(wilds.length, 2);

    if (mustUse) {
        const mustWild = isWildOkey(mustUse, okey);
        const mk = mustWild ? -2 : faceKey(tileFace(mustUse, okey));
        let bestV = -1;
        for (const c of cands) {
            if (mustWild ? c.wild < 1 : !c.keys.includes(mk)) continue;
            if (!applicable(c, wl)) continue;
            let delta = 0;
            for (const x of c.rel) { counts[x]--; delta += pow3[x]; }
            const v = c.score + solve(code0 - delta, wl - c.wild);
            for (const x of c.rel) counts[x]++;
            if (v > bestV) { bestV = v; forced = c; }
        }
        if (!forced) return null;
        for (const x of forced.rel) { counts[x]--; code -= pow3[x]; }
        wl -= forced.wild;
        chosen.push(forced);
    } else {
        solve(code0, wl);
    }

    if (overBudget) {
        // Greedy fallback: repeatedly take the highest-scoring applicable candidate.
        for (;;) {
            let pick: Candidate | null = null;
            for (const c of cands) if (applicable(c, wl) && (!pick || c.score > pick.score)) pick = c;
            if (!pick) break;
            for (const x of pick.rel) counts[x]--;
            wl -= pick.wild;
            chosen.push(pick);
        }
    } else {
        // Walk the memoised choices.
        for (;;) {
            let r = 0;
            while (r < R && counts[r] === 0) r++;
            if (r === R) break;
            const mkey = code * 3 + wl;
            if (!memo.has(mkey)) solve(code, wl);
            const ci = choice.get(mkey) ?? -1;
            if (ci === -1) { counts[r]--; code -= pow3[r]; continue; }
            const c = cands[ci];
            for (const x of c.rel) { counts[x]--; code -= pow3[x]; }
            wl -= c.wild;
            chosen.push(c);
        }
    }

    // Map candidates onto concrete tiles.
    const lists = new Map<number, Tile101[]>();
    for (const [k, list] of byKey) lists.set(k, [...list]);
    const wildPool = [...wilds];
    if (mustUse && isWildOkey(mustUse, okey)) {
        const i = wildPool.findIndex(t => t.id === mustUse.id);
        if (i > 0) { wildPool.splice(i, 1); wildPool.unshift(mustUse); }
    }
    const melds: PlannedMeld[] = chosen.map((c, idx) => {
        const tiles: Tile101[] = c.keys.map(k => {
            const list = lists.get(k)!;
            if (idx === 0 && forced && mustUse) {
                const j = list.findIndex(t => t.id === mustUse.id);
                if (j !== -1) return list.splice(j, 1)[0];
            }
            return list.pop()!;
        });
        for (let w = 0; w < c.wild; w++) tiles.push(wildPool.shift()!);
        return { tiles: orderMeldTiles(tiles, c.type, okey), type: c.type, points: getMeldPoints(tiles, c.type, okey) };
    });
    return { melds, points: melds.reduce((a, m) => a + m.points, 0) };
};

// ---------------------------------------------------------------------------
// Pairs (çift açış)
// ---------------------------------------------------------------------------

/** Pair key for a non-wild tile (identical colour+number). */
const pairKey = (tile: Tile101, okey: OkeyRef): string | null => {
    if (isWildOkey(tile, okey)) return null;
    const f = tileFace(tile, okey);
    return f.color ? `${f.color}-${f.value}` : null;
};

/**
 * Count how many pairs exist in a pool: identical colour+number duos, plus one
 * okey completing a single tile.
 */
export const countCompletePairs = (tiles: Tile101[], okey?: OkeyRef): number => {
    const counts = new Map<string, number>();
    let wild = 0;
    for (const t of tiles) {
        if (isWildOkey(t, okey)) { wild++; continue; }
        const k = pairKey(t, okey);
        if (!k) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    let pairs = 0;
    let singles = 0;
    for (const n of counts.values()) { pairs += Math.floor(n / 2); singles += n % 2; }
    return pairs + Math.min(wild, singles);
};

/**
 * True when the pool contains at least PAIR_OPEN_MINIMUM pairs.
 */
export const canMakePairOpen = (tiles: Tile101[], okey?: OkeyRef): boolean =>
    countCompletePairs(tiles, okey) >= PAIR_OPEN_MINIMUM;

/**
 * Extract up to `maxPairs` pairs (identical duos first, then single + okey).
 * With `mustUse`, that tile is placed in the first pair; returns [] if it cannot be paired.
 */
export const extractPairs = (
    tiles: Tile101[],
    maxPairs = PAIR_OPEN_MINIMUM,
    okey?: OkeyRef,
    mustUse?: Tile101 | null,
): Tile101[][] => {
    const byKey = new Map<string, Tile101[]>();
    let wilds: Tile101[] = [];
    for (const t of tiles) {
        if (isWildOkey(t, okey)) { wilds.push(t); continue; }
        const k = pairKey(t, okey);
        if (!k) continue;
        const list = byKey.get(k) || [];
        list.push(t);
        byKey.set(k, list);
    }
    const pairs: Tile101[][] = [];
    if (mustUse) {
        if (isWildOkey(mustUse, okey)) {
            wilds = wilds.filter(t => t.id !== mustUse.id);
            // Prefer pairing the okey with a single so no natural pair is broken.
            let partnerKey: string | null = null;
            for (const [k, list] of byKey) if (list.length % 2 === 1) { partnerKey = k; break; }
            if (!partnerKey) for (const k of byKey.keys()) { partnerKey = k; break; }
            if (!partnerKey) return [];
            const partner = byKey.get(partnerKey)!.pop()!;
            pairs.push([partner, mustUse]);
        } else {
            const k = pairKey(mustUse, okey);
            if (!k) return [];
            const list = (byKey.get(k) || []).filter(t => t.id !== mustUse.id);
            if (list.length > 0) {
                pairs.push([mustUse, list.shift()!]);
                byKey.set(k, list);
            } else if (wilds.length > 0) {
                pairs.push([mustUse, wilds.shift()!]);
                byKey.set(k, []);
            } else {
                return [];
            }
        }
    }
    for (const list of byKey.values()) {
        while (list.length >= 2 && pairs.length < maxPairs) pairs.push([list.shift()!, list.shift()!]);
    }
    for (const list of byKey.values()) {
        if (list.length === 1 && wilds.length > 0 && pairs.length < maxPairs) pairs.push([list.shift()!, wilds.shift()!]);
    }
    return pairs.slice(0, Math.max(maxPairs, mustUse ? 1 : 0));
};

/**
 * Rack indices that form pairs (for UI "Çift Seç" selection).
 * Returns groups of 2 indices; flatten for selection.
 */
export const findPairIndices = (tiles: (Tile101 | null)[], okey?: OkeyRef): number[][] => {
    const byKey = new Map<string, number[]>();
    const wild: number[] = [];
    tiles.forEach((t, idx) => {
        if (!t) return;
        if (isWildOkey(t, okey)) { wild.push(idx); return; }
        const k = pairKey(t, okey);
        if (!k) return;
        const list = byKey.get(k) || [];
        list.push(idx);
        byKey.set(k, list);
    });
    const groups: number[][] = [];
    for (const idxs of byKey.values()) {
        for (let i = 0; i + 1 < idxs.length; i += 2) groups.push([idxs[i], idxs[i + 1]]);
    }
    for (const idxs of byKey.values()) {
        if (idxs.length % 2 === 1 && wild.length > 0) groups.push([idxs[idxs.length - 1], wild.shift()!]);
    }
    return groups;
};

// ---------------------------------------------------------------------------
// Side tile (yan taş)
// ---------------------------------------------------------------------------

/**
 * Whether an unopened player may take `discard`: only if an opening that USES that
 * tile exists this turn — a normal open (≥101) or a pair open (≥5 pairs).
 * Uses the same exact search as the bot, so the bot never takes a tile it can't open with.
 */
export const canTakeDiscardToOpen = (
    hand: (Tile101 | null)[],
    discard: Tile101,
    okey?: OkeyRef,
): boolean => {
    const pool = [...hand.filter(nonNull), discard];
    const plan = findBestMelds(pool, okey, discard);
    if (plan && plan.points >= FIRST_MELD_MINIMUM) return true;
    const pairs = extractPairs(pool, 99, okey, discard);
    return pairs.length >= PAIR_OPEN_MINIMUM && pairs.some(p => p.some(t => t.id === discard.id));
};

// ---------------------------------------------------------------------------
// Scoring / rounds
// ---------------------------------------------------------------------------

/**
 * Round-end penalty for one non-winning player.
 */
export const calculateRoundPenalty = (player: Player101Hand, okey?: OkeyRef): number => {
    if (!player.hasLaidDown) return NEVER_OPENED_PENALTY;
    const hand = calculateHandPoints(player.tiles, okey);
    return player.openedWithPairs ? hand * 2 : hand;
};

const finishRound = (state: Game101State, players: Player101Hand[], winnerId: number | null): Game101State => {
    const someoneOut = players.some(p => p.score >= LOSING_SCORE);
    let gameWinner: number | null = null;
    if (someoneOut) {
        let minScore = Infinity;
        players.forEach((p, idx) => {
            if (p.score < minScore) {
                minScore = p.score;
                gameWinner = idx;
            }
        });
    }
    return {
        ...state,
        players,
        phase: someoneOut ? 'gameOver' : 'roundOver',
        roundWinner: winnerId,
        gameWinner,
    };
};

const dealHands = (deck: Tile101[], playerCount: number, starter: number, okey: Tile101) => {
    const players: Player101Hand[] = [];
    for (let p = 0; p < playerCount; p++) {
        const count = p === starter ? INITIAL_HAND_SIZE + 1 : INITIAL_HAND_SIZE;
        const hand: Tile101[] = [];
        for (let i = 0; i < count && deck.length > 0; i++) hand.push(deck.pop()!);
        players.push({ tiles: smartSort101Tiles(hand, okey), score: 0, hasLaidDown: false, openedWithPairs: false });
    }
    return players;
};

/**
 * Initialize a new 101 game
 */
export const initialize101Game = (playerCount: number = 4): Game101State => {
    const deck = shuffleDeck(createOkeyDeck());

    // Gösterge: its +1 (same colour) is the round's okey (wildcard).
    const indicator = deck.pop() as Tile101;
    const okeyDef = determineOkey(indicator) as Tile101;

    // Deal: dealer is the last seat, so the starter (seat 0) gets 22, others 21.
    const dealer = playerCount - 1;
    const starter = (dealer + 1) % playerCount;
    const players = dealHands(deck, playerCount, starter, okeyDef);

    return {
        phase: 'playing',
        players,
        centerStack: deck,
        discardPiles: Array.from({ length: playerCount }, () => []),
        indicatorTile: indicator,
        okeyTile: okeyDef,
        tableMelds: {},
        currentTurn: starter,
        roundWinner: null,
        gameWinner: null,
        roundNumber: 1,
        dealer,
    };
};

/**
 * Start a new round. The previous round's winner deals; after a round without a
 * winner the deal passes to the next seat. The seat after the dealer starts with 22.
 */
export const startNewRound = (prevState: Game101State): Game101State => {
    const playerCount = prevState.players.length;
    const deck = shuffleDeck(createOkeyDeck());

    const indicator = deck.pop() as Tile101;
    const okeyDef = determineOkey(indicator) as Tile101;

    const prevDealer = prevState.dealer ?? playerCount - 1;
    const dealer = prevState.roundWinner ?? (prevDealer + 1) % playerCount;
    const startingPlayer = (dealer + 1) % playerCount;

    const dealt = dealHands(deck, playerCount, startingPlayer, okeyDef);
    const players: Player101Hand[] = prevState.players.map((p, i) => ({ ...dealt[i], score: p.score }));

    return {
        phase: 'playing',
        players,
        centerStack: deck,
        discardPiles: Array.from({ length: playerCount }, () => []),
        indicatorTile: indicator,
        okeyTile: okeyDef,
        tableMelds: {},
        currentTurn: startingPlayer,
        roundWinner: null,
        gameWinner: prevState.gameWinner,
        roundNumber: prevState.roundNumber + 1,
        dealer,
    };
};

/**
 * End a round and calculate classic 101 penalties.
 * Finisher: 0. Never opened: +202. Opened: hand sum (×2 if pair-opened).
 * If the finisher opened with pairs, everyone else's penalty this round is doubled.
 */
export const endRound = (state: Game101State, winnerId: number): Game101State => {
    const winnerOpenedWithPairs = state.players[winnerId]?.openedWithPairs === true;
    const players = state.players.map((player, idx) => {
        if (idx === winnerId) return { ...player };
        let penalty = calculateRoundPenalty(player, state.okeyTile);
        if (winnerOpenedWithPairs) penalty *= 2;
        return { ...player, score: player.score + penalty };
    });
    return finishRound(state, players, winnerId);
};

/**
 * End the round when the center stack is exhausted: nobody wins, but every player's
 * penalty is written (never opened +202, opened = rack sum, pair-opened ×2; no
 * winner doubling). Then the usual 101-limit / game-over check.
 */
export const endRoundStackEmpty = (state: Game101State): Game101State => {
    const players = state.players.map(player => ({
        ...player,
        score: player.score + calculateRoundPenalty(player, state.okeyTile),
    }));
    return finishRound(state, players, null);
};

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

/** How promising a tile is to keep (higher = keep). */
const keepScore = (tile: Tile101, hand: Tile101[], okey: OkeyRef, opened: boolean): number => {
    const f = tileFace(tile, okey);
    let s = 0;
    for (const o of hand) {
        if (o.id === tile.id) continue;
        if (isWildOkey(o, okey)) continue;
        const g = tileFace(o, okey);
        if (g.color === f.color && g.value === f.value) { s += opened ? 0 : 1; continue; }
        if (g.value === f.value) { s += 2; continue; }
        if (g.color === f.color) {
            let d = Math.abs(g.value - f.value);
            if (f.value === 1 || g.value === 1) d = Math.min(d, 14 - Math.max(f.value, g.value));
            if (d === 1) s += 2;
            else if (d === 2) s += 1;
        }
    }
    return s;
};

const sideTileUsefulWhenOpen = (hand: Tile101[], tile: Tile101, melds: Meld[], okey: OkeyRef): boolean => {
    if (isWildOkey(tile, okey)) return true;
    if (melds.some(m => canAddToMeld(m, tile, okey))) return true;
    const without = findBestMelds(hand, okey)?.points ?? 0;
    const withTile = findBestMelds([...hand, tile], okey, tile)?.points ?? -1;
    return withTile > without;
};

/**
 * Compute one full AI turn for the player whose turn it currently is.
 *
 * Pure function — takes the current game state and returns the next state after the
 * AI has: drawn (skipped for the 22-tile starter; the side tile only when it can be
 * used — to open if not yet opened), opened (≥101 normal open preferred, else ≥5 pairs),
 * laid further melds, added tiles to table melds, and discarded (never the okey unless
 * nothing else is left). Emptying the hand — by laying down or by the final discard —
 * wins the round; an empty center stack after the discard ends the round without a winner.
 *
 * Shared by single-player (use101Game) and the online server so AI behaves identically.
 */
export const computeAIMove = (prev: Game101State): Game101State => {
    const okey = prev.okeyTile;
    const p = prev.currentTurn;
    const playerCount = prev.players.length;
    const nextTurn = (p + 1) % playerCount;
    const prevSeat = (p + playerCount - 1) % playerCount;

    const players = prev.players.map(pl => ({ ...pl, tiles: [...pl.tiles] }));
    const melds: { [key: string]: Meld } = { ...prev.tableMelds };
    const stack = [...prev.centerStack];
    const piles = prev.discardPiles.map(pile => [...pile]);
    const rack = players[p].tiles;

    const inHand = () => rack.filter(nonNull);
    const removeFromRack = (t: Tile101) => {
        const i = rack.findIndex(x => x?.id === t.id);
        if (i !== -1) rack[i] = null;
    };
    const addToRack = (t: Tile101) => {
        const i = rack.findIndex(x => x === null);
        if (i !== -1) rack[i] = t; else rack.push(t);
    };
    const meldId = (tag: string, tiles: Tile101[]) => `meld-ai-${p}-r${prev.roundNumber}-${tag}-${tiles[0].id}`;
    const layPlan = (plan: PlannedMeld[]) => {
        for (const m of plan) {
            const id = meldId(m.type, m.tiles);
            melds[id] = { id, tiles: m.tiles, type: m.type, ownerPlayer: p };
            m.tiles.forEach(removeFromRack);
        }
    };

    let opened = players[p].hasLaidDown;
    let withPairs = players[p].openedWithPairs;
    let sideTaken: Tile101 | null = null;

    // 1) Draw — the 22-tile starter only discards.
    let drew = false;
    if (inHand().length < MAX_HAND_SIZE) {
        const top = piles[prevSeat]?.[piles[prevSeat].length - 1];
        const take = !!top && (opened
            ? sideTileUsefulWhenOpen(inHand(), top, Object.values(melds), okey)
            : canTakeDiscardToOpen(rack, top, okey));
        if (top && take) {
            piles[prevSeat].pop();
            addToRack(top);
            sideTaken = top;
            drew = true;
        }
    }
    const drawFromStack = (): boolean => {
        const d = stack.pop();
        if (!d) return false;
        addToRack(d);
        return true;
    };
    if (!drew && inHand().length < MAX_HAND_SIZE) {
        if (!drawFromStack()) return endRoundStackEmpty(prev);
    }

    // 2) Open (normal ≥101 preferred, else pairs). A side tile taken unopened must be used.
    const tryOpen = (mustUse: Tile101 | null): boolean => {
        const plan = findBestMelds(inHand(), okey, mustUse);
        if (plan && plan.points >= FIRST_MELD_MINIMUM) {
            layPlan(plan.melds);
            return true;
        }
        const pairs = extractPairs(inHand(), 99, okey, mustUse);
        if (pairs.length >= PAIR_OPEN_MINIMUM) {
            pairs.forEach(pr => {
                const id = meldId('pair', pr);
                melds[id] = { id, tiles: pr, type: 'pair', ownerPlayer: p };
                pr.forEach(removeFromRack);
            });
            withPairs = true;
            return true;
        }
        return false;
    };
    if (!opened) {
        opened = tryOpen(sideTaken);
        if (!opened && sideTaken) {
            // Safety net: never keep a side tile without opening — put it back and draw.
            removeFromRack(sideTaken);
            piles[prevSeat].push(sideTaken);
            sideTaken = null;
            if (!drawFromStack()) return endRoundStackEmpty(prev);
            opened = tryOpen(null);
        }
    }

    // 3) Once open: lay every further meld, then add tiles to table melds.
    if (opened) {
        const more = findBestMelds(inHand(), okey);
        if (more) layPlan(more.melds);
        let changed = true;
        while (changed && inHand().length > 0) {
            changed = false;
            const order = [...inHand()].sort((a, b) => Number(isWildOkey(a, okey)) - Number(isWildOkey(b, okey)));
            for (const tile of order) {
                const target = Object.values(melds).find(m => canAddToMeld(m, tile, okey));
                if (target) {
                    melds[target.id] = { ...target, tiles: addTileToMeld(target, tile, okey) };
                    removeFromRack(tile);
                    changed = true;
                    break;
                }
            }
        }
    }

    players[p] = { ...players[p], tiles: rack, hasLaidDown: opened, openedWithPairs: withPairs };
    const base: Game101State = { ...prev, players, tableMelds: melds, centerStack: stack, discardPiles: piles };
    if (inHand().length === 0) return endRound(base, p);

    // 4) Discard: never the okey unless nothing else is left (+101), keep the side tile.
    const hand = inHand();
    const discardable = hand.filter(t => !isWildOkey(t, okey));
    let toDiscard: Tile101;
    let penalty = 0;
    if (discardable.length === 0) {
        toDiscard = hand[0];
        penalty = OKEY_DISCARD_PENALTY;
    } else {
        let pool = discardable.filter(t => t.id !== sideTaken?.id);
        if (pool.length === 0) pool = discardable;
        pool.sort((a, b) => {
            const ka = keepScore(a, hand, okey, opened), kb = keepScore(b, hand, okey, opened);
            if (ka !== kb) return ka - kb;
            const pa = getTilePoints(a, okey), pb = getTilePoints(b, okey);
            return opened ? pb - pa : pa - pb;
        });
        toDiscard = pool[0];
    }
    removeFromRack(toDiscard);
    piles[p].push(toDiscard);
    if (penalty) players[p] = { ...players[p], score: players[p].score + penalty };
    const after: Game101State = { ...base, players: [...players] };

    if (inHand().length === 0) return endRound(after, p);
    if (stack.length === 0) return endRoundStackEmpty(after);
    return { ...after, currentTurn: nextTurn };
};

// ---------------------------------------------------------------------------
// Rack arrangement (never drops tiles)
// ---------------------------------------------------------------------------

export type SortMode = 'smart' | 'runs' | 'sets';

/**
 * Lay groups out on the 30-slot rack: groups stay contiguous, separated by a gap,
 * and a group that would straddle the two rows moves to row 2. If that does not fit,
 * the row break and then the gaps are dropped — every tile is always kept.
 */
const layoutRack = (groups: Tile101[][], original: (Tile101 | null)[]): (Tile101 | null)[] => {
    const parts = groups.filter(g => g.length > 0);
    for (const mode of [2, 1, 0]) {
        const rack: (Tile101 | null)[] = new Array(RACK_SIZE_101).fill(null);
        let idx = 0;
        let ok = true;
        for (const g of parts) {
            if (mode === 2 && idx < 15 && idx + g.length > 15 && g.length <= 15) idx = 15;
            if (idx + g.length > RACK_SIZE_101) { ok = false; break; }
            for (const t of g) rack[idx++] = t;
            if (mode > 0 && idx < RACK_SIZE_101 && idx !== 15) idx++;
        }
        if (ok) return rack;
    }
    return [...original];
};

/** Guard: a sort result must contain exactly the input tiles. */
const keepAllTiles = (original: (Tile101 | null)[], sorted: (Tile101 | null)[]): (Tile101 | null)[] => {
    const a = original.filter(nonNull).map(t => t.id).sort();
    const b = sorted.filter(nonNull).map(t => t.id).sort();
    if (a.length !== b.length || a.some((id, i) => id !== b[i])) return [...original];
    return sorted;
};

const splitWild = (tiles: (Tile101 | null)[], okey: OkeyRef) => {
    const all = tiles.filter(nonNull);
    return { wild: all.filter(t => isWildOkey(t, okey)), normal: all.filter(t => !isWildOkey(t, okey)) };
};

const byColorThenValue = (okey: OkeyRef) => (a: Tile101, b: Tile101) => {
    const fa = tileFace(a, okey), fb = tileFace(b, okey);
    return colorIndex(fa.color) - colorIndex(fb.color) || fa.value - fb.value;
};

const extractRuns = (tiles: Tile101[], okey: OkeyRef): { groups: Tile101[][]; rest: Tile101[] } => {
    let remaining = [...tiles];
    const groups: Tile101[][] = [];
    for (const color of COLOR_ORDER) {
        let colorTiles = remaining.filter(t => tileFace(t, okey).color === color)
            .sort((a, b) => tileFace(a, okey).value - tileFace(b, okey).value);
        while (colorTiles.length >= 3) {
            let bestRun: Tile101[] = [];
            for (let start = 0; start < colorTiles.length; start++) {
                const run: Tile101[] = [colorTiles[start]];
                let expected = tileFace(colorTiles[start], okey).value + 1;
                for (let j = start + 1; j < colorTiles.length && expected <= 13; j++) {
                    const v = tileFace(colorTiles[j], okey).value;
                    if (v === expected) { run.push(colorTiles[j]); expected++; } else if (v > expected) break;
                }
                if (run.length >= 3 && run.length > bestRun.length) bestRun = run;
            }
            if (bestRun.length < 3) break;
            groups.push(bestRun);
            const used = new Set(bestRun.map(t => t.id));
            remaining = remaining.filter(t => !used.has(t.id));
            colorTiles = colorTiles.filter(t => !used.has(t.id));
        }
    }
    return { groups, rest: remaining };
};

const extractSets = (tiles: Tile101[], okey: OkeyRef): { groups: Tile101[][]; rest: Tile101[] } => {
    let remaining = [...tiles];
    const groups: Tile101[][] = [];
    for (let value = 1; value <= 13; value++) {
        const withValue = remaining.filter(t => tileFace(t, okey).value === value);
        const set: Tile101[] = [];
        for (const color of COLOR_ORDER) {
            const t = withValue.find(x => tileFace(x, okey).color === color);
            if (t) set.push(t);
        }
        if (set.length >= 3) {
            groups.push(set);
            const used = new Set(set.map(t => t.id));
            remaining = remaining.filter(t => !used.has(t.id));
        }
    }
    return { groups, rest: remaining };
};

const colorGroups = (tiles: Tile101[], okey: OkeyRef): Tile101[][] => {
    const sorted = [...tiles].sort(byColorThenValue(okey));
    const groups: Tile101[][] = [];
    for (const t of sorted) {
        const last = groups[groups.length - 1];
        if (last && tileFace(last[0], okey).color === tileFace(t, okey).color) last.push(t);
        else groups.push([t]);
    }
    return groups;
};

/**
 * Sort tiles prioritizing RUNS (same color, consecutive numbers)
 */
export const sortByRuns = (tiles: (Tile101 | null)[], okey?: OkeyRef): (Tile101 | null)[] => {
    const { wild, normal } = splitWild(tiles, okey);
    const runs = extractRuns(normal, okey);
    const sets = extractSets(runs.rest, okey);
    return keepAllTiles(tiles, layoutRack([...runs.groups, ...sets.groups, ...colorGroups(sets.rest, okey), wild], tiles));
};

/**
 * Sort tiles prioritizing SETS (same value, different colors)
 */
export const sortBySets = (tiles: (Tile101 | null)[], okey?: OkeyRef): (Tile101 | null)[] => {
    const { wild, normal } = splitWild(tiles, okey);
    const sets = extractSets(normal, okey);
    const rest = [...sets.rest].sort((a, b) => {
        const fa = tileFace(a, okey), fb = tileFace(b, okey);
        return fa.value - fb.value || colorIndex(fa.color) - colorIndex(fb.color);
    });
    return keepAllTiles(tiles, layoutRack([...sets.groups, rest, wild], tiles));
};

/**
 * Sort tiles by REAL PAIRS (same color, same value) first, then by color/value.
 * Used for "Çift diz" davranışı.
 */
export const sortByPairs = (tiles: (Tile101 | null)[], okey?: OkeyRef): (Tile101 | null)[] => {
    const { wild, normal } = splitWild(tiles, okey);
    const groupsByKey = new Map<string, Tile101[]>();
    const loose: Tile101[] = [];
    for (const t of normal) {
        const k = pairKey(t, okey);
        if (!k) { loose.push(t); continue; }
        const list = groupsByKey.get(k) || [];
        list.push(t);
        groupsByKey.set(k, list);
    }
    const pairBlocks: Tile101[][] = [];
    for (const list of groupsByKey.values()) {
        let i = 0;
        while (i + 1 < list.length) { pairBlocks.push([list[i], list[i + 1]]); i += 2; }
        if (i < list.length) loose.push(list[i]);
    }
    return keepAllTiles(tiles, layoutRack([...pairBlocks, ...colorGroups(loose, okey), wild], tiles));
};

/**
 * Find all valid runs from tiles and return their indices
 */
export const findRunIndices = (tiles: (Tile101 | null)[], okey?: OkeyRef): number[][] => {
    const result: number[][] = [];
    const used = new Set<number>();
    for (const color of COLOR_ORDER) {
        const colorIndices: { idx: number; value: number }[] = [];
        tiles.forEach((t, idx) => {
            if (!t || isWildOkey(t, okey) || used.has(idx)) return;
            const f = tileFace(t, okey);
            if (f.color === color) colorIndices.push({ idx, value: f.value });
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
export const findSetIndices = (tiles: (Tile101 | null)[], okey?: OkeyRef): number[][] => {
    const result: number[][] = [];
    const used = new Set<number>();
    for (let value = 1; value <= 13; value++) {
        const valueIndices: { idx: number; color: OkeyColor }[] = [];
        tiles.forEach((t, idx) => {
            if (!t || isWildOkey(t, okey) || used.has(idx)) return;
            const f = tileFace(t, okey);
            if (f.color && f.value === value) valueIndices.push({ idx, color: f.color });
        });
        const set: number[] = [];
        for (const color of COLOR_ORDER) {
            const match = valueIndices.find(v => v.color === color);
            if (match) set.push(match.idx);
        }
        if (set.length >= 3) {
            result.push(set);
            set.forEach(idx => used.add(idx));
        }
    }
    return result;
};

/**
 * Smart sort tiles for 101 - groups valid melds together
 */
export const smartSort101Tiles = (tiles: (Tile101 | null)[], okey?: OkeyRef): (Tile101 | null)[] => {
    const { wild, normal } = splitWild(tiles, okey);
    const sets = extractSets(normal, okey);
    const runs = extractRuns(sets.rest, okey);
    const rest = [...runs.rest].sort(byColorThenValue(okey));
    return keepAllTiles(tiles, layoutRack([...sets.groups, ...runs.groups, rest, wild], tiles));
};
