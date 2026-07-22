/**
 * Authoritative Okey-101 module. Ports the pure engine (game101Logic) and runs
 * ALL of it server-side: dealing/RNG, meld validation, the 51-point first
 * lay-down rule, scoring, round/game progression, and the AI (computeAIMove).
 *
 * Like okey, `projectView` hides opponents' racks and the draw-pile order — only
 * a seat's own tiles are sent. AI runs on the server, so a host disconnect no
 * longer stalls bot turns (the old model drove AI from the host's browser).
 *
 * Turn flow is draw → (optionally lay down / add to melds) → discard, tracked by
 * `drawnThisTurn` so melding before discarding works correctly.
 */
import type { ApplyResult, Game101StatePayload, OkeyTile, RoomEnvelope } from '../types.js';
import { GameError, type GameModule, type InitResult } from './GameModule.js';
import {
  initialize101Game,
  startNewRound as startNewRound101,
  endRound,
  computeAIMove,
  isValidMeld,
  canAddToMeld,
  canMakeFirstLayDown,
  sortByRuns,
  sortBySets,
  sortByPairs,
  smartSort101Tiles,
  type Game101State,
} from './logic/game101Logic.js';

const HIDDEN: OkeyTile = { id: 'hidden', value: 0, color: null };
const SEATS = 4;

const count = (tiles: (OkeyTile | null)[]): number => tiles.filter((t) => t !== null).length;

function toGame(room: RoomEnvelope): Game101State {
  const s = room.state as Game101StatePayload;
  return {
    phase: s.phase,
    players: s.players.map((p) => ({ tiles: [...p.tiles], score: p.score, hasLaidDown: p.hasLaidDown })),
    centerStack: [...s.centerStack],
    discardPiles: s.discardPiles.map((d) => [...d]),
    indicatorTile: s.indicatorTile,
    okeyTile: s.okeyTile,
    tableMelds: { ...s.tableMelds },
    currentTurn: s.currentTurn,
    roundWinner: s.roundWinner,
    gameWinner: s.gameWinner,
    roundNumber: s.roundNumber,
  };
}

function toResult(g: Game101State, drawnThisTurn: boolean, lastMove?: unknown): ApplyResult {
  const phase: ApplyResult['phase'] =
    g.phase === 'gameOver' ? 'gameOver' : g.phase === 'roundOver' ? 'roundOver' : 'playing';
  const state: Game101StatePayload = {
    kind: '101',
    phase: g.phase,
    players: g.players,
    centerStack: g.centerStack,
    discardPiles: g.discardPiles,
    indicatorTile: g.indicatorTile,
    okeyTile: g.okeyTile,
    tableMelds: g.tableMelds,
    currentTurn: g.currentTurn,
    roundWinner: g.roundWinner,
    gameWinner: g.gameWinner,
    roundNumber: g.roundNumber,
    drawnThisTurn,
  };
  return { state, currentTurn: g.currentTurn, phase, winner: g.gameWinner ?? g.roundWinner ?? null, status: g.phase, lastMove };
}

function placeInRack(hand: (OkeyTile | null)[], tile: OkeyTile, slot?: number): void {
  if (slot !== undefined && slot >= 0 && slot < hand.length && hand[slot] === null) {
    hand[slot] = tile;
    return;
  }
  const idx = hand.findIndex((t) => t === null);
  if (idx !== -1) hand[idx] = tile;
}

function parseAction(move: unknown): {
  action: string;
  slot?: number;
  index?: number;
  from?: number;
  to?: number;
  meldId?: string;
  indices?: number[];
} {
  if (!move || typeof move !== 'object') throw new GameError('bad_move', 'Move payload missing');
  const m = move as Record<string, unknown>;
  if (typeof m.action !== 'string') throw new GameError('bad_move', 'Missing action');
  return {
    action: m.action,
    slot: typeof m.slot === 'number' ? m.slot : undefined,
    index: typeof m.index === 'number' ? m.index : undefined,
    from: typeof m.from === 'number' ? m.from : undefined,
    to: typeof m.to === 'number' ? m.to : undefined,
    meldId: typeof m.meldId === 'string' ? m.meldId : undefined,
    indices: Array.isArray(m.indices) ? (m.indices.filter((x) => typeof x === 'number') as number[]) : undefined,
  };
}

function isHostSeat(room: RoomEnvelope, seat: number): boolean {
  return room.seats[seat]?.userId != null && room.seats[seat]?.userId === room.hostUserId;
}

function emptyGame(): Game101State {
  return {
    phase: 'dealing',
    players: Array.from({ length: SEATS }, () => ({ tiles: [], score: 0, hasLaidDown: false })),
    centerStack: [],
    discardPiles: [[], [], [], []],
    indicatorTile: null,
    okeyTile: null,
    tableMelds: {},
    currentTurn: 0,
    roundWinner: null,
    gameWinner: null,
    roundNumber: 1,
  };
}

export const game101Module: GameModule = {
  type: '101',
  maxSeats: SEATS,
  hasWaitingRoom: true,
  aiDelayMs: 1400,

  init(): InitResult {
    return { state: toResult(emptyGame(), false).state, currentTurn: 0, phase: 'waiting' };
  },

  start(room: RoomEnvelope): ApplyResult {
    for (const seat of room.seats) {
      if (!seat.userId) {
        seat.isAI = true;
        seat.userId = `AI_${seat.seatIndex}`;
        seat.displayName = `Bot ${seat.seatIndex + 1}`;
        seat.connected = true;
      }
    }
    const g = initialize101Game(SEATS);
    return toResult(g, true); // dealer holds the extra tile → already "drawn"
  },

  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult {
    const { action, slot, index, from, to, meldId, indices } = parseAction(move);
    const prevDrawn = (room.state as Game101StatePayload).drawnThisTurn;
    const g = toGame(room);
    const isTurn = seat === g.currentTurn;
    const hand = g.players[seat].tiles;

    switch (action) {
      case 'reorder': {
        if (from === undefined || to === undefined) throw new GameError('bad_move', 'reorder needs from/to');
        if (from < 0 || from >= hand.length || to < 0 || to >= hand.length) throw new GameError('bad_move', 'out of range');
        [hand[from], hand[to]] = [hand[to], hand[from]];
        return toResult(g, prevDrawn);
      }
      case 'sortRuns':
        g.players[seat].tiles = sortByRuns(hand);
        return toResult(g, prevDrawn);
      case 'sortSets':
        g.players[seat].tiles = sortBySets(hand);
        return toResult(g, prevDrawn);
      case 'sortPairs':
        g.players[seat].tiles = sortByPairs(hand);
        return toResult(g, prevDrawn);
      case 'smartSort':
        g.players[seat].tiles = smartSort101Tiles(hand);
        return toResult(g, prevDrawn);

      case 'drawCenter': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= 15) throw new GameError('too_many', 'Discard before drawing');
        const tile = g.centerStack.pop();
        if (!tile) throw new GameError('stack_empty', 'Center stack is empty');
        placeInRack(hand, tile, slot);
        return toResult(g, true, { draw: 'center', seat });
      }
      case 'drawDiscard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= 15) throw new GameError('too_many', 'Discard before drawing');
        const prev = (seat + 3) % SEATS;
        const tile = g.discardPiles[prev].pop();
        if (!tile) throw new GameError('empty_pile', 'No tile to take');
        placeInRack(hand, tile, slot);
        return toResult(g, true, { draw: 'discard', seat });
      }
      case 'discard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before discarding');
        if (index === undefined) throw new GameError('bad_move', 'discard needs index');
        const tile = hand[index];
        if (!tile) throw new GameError('empty_slot', 'No tile at that slot');
        hand[index] = null;
        g.discardPiles[seat].push(tile);
        g.currentTurn = (seat + 1) % SEATS;
        return toResult(g, false, { discard: tile.id, seat });
      }
      case 'layDown': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before laying down');
        if (!indices || indices.length < 3) throw new GameError('bad_meld', 'Select at least 3 tiles');
        const tiles = indices.map((i) => hand[i]).filter((t): t is OkeyTile => t != null);
        if (tiles.length !== indices.length || tiles.length < 3) throw new GameError('bad_meld', 'Invalid selection');
        const validation = isValidMeld(tiles);
        if (!validation.valid || !validation.type) throw new GameError('invalid_meld', 'Not a valid set or run');
        if (!g.players[seat].hasLaidDown && !canMakeFirstLayDown([tiles])) {
          throw new GameError('need_51', 'First lay-down must be at least 51 points');
        }
        const meldId2 = `meld-${seat}-r${g.roundNumber}-${Object.keys(g.tableMelds).length}-${Math.floor(Math.random() * 1e6)}`;
        g.tableMelds[meldId2] = { id: meldId2, tiles, type: validation.type, ownerPlayer: seat };
        for (const t of tiles) {
          const i = hand.findIndex((h) => h?.id === t.id);
          if (i !== -1) hand[i] = null;
        }
        g.players[seat].hasLaidDown = true;
        if (count(hand) === 0) {
          return toResult(endRound(g, seat), prevDrawn, { layDown: seat, win: true });
        }
        return toResult(g, prevDrawn, { layDown: seat });
      }
      case 'addToMeld': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before adding');
        if (index === undefined || !meldId) throw new GameError('bad_move', 'addToMeld needs index + meldId');
        if (!g.players[seat].hasLaidDown) throw new GameError('not_open', 'Lay down 51 first');
        const meld = g.tableMelds[meldId];
        if (!meld) throw new GameError('no_meld', 'Meld not found');
        const tile = hand[index];
        if (!tile) throw new GameError('empty_slot', 'No tile at that slot');
        if (!canAddToMeld(meld, tile)) throw new GameError('cant_add', 'Tile does not fit that meld');
        g.tableMelds[meldId] = { ...meld, tiles: [...meld.tiles, tile] };
        hand[index] = null;
        if (count(hand) === 0) {
          return toResult(endRound(g, seat), prevDrawn, { addToMeld: seat, win: true });
        }
        return toResult(g, prevDrawn, { addToMeld: seat });
      }
      case 'startNewRound': {
        if (!isHostSeat(room, seat)) throw new GameError('not_host', 'Only the host can start a new round');
        if (g.phase !== 'roundOver') throw new GameError('bad_phase', 'Round is not over');
        return toResult(startNewRound101(g), true);
      }
      default:
        throw new GameError('bad_action', `Unknown action ${action}`);
    }
  },

  aiTurn(room: RoomEnvelope): ApplyResult {
    const next = computeAIMove(toGame(room));
    return toResult(next, false, { ai: true });
  },

  resign(room: RoomEnvelope, seat: number): ApplyResult {
    const g = toGame(room);
    g.phase = 'roundOver';
    g.roundWinner = null;
    return toResult(g, false, { resigned: seat });
  },

  rematch(): ApplyResult {
    return toResult(initialize101Game(SEATS), true);
  },

  projectView(room: RoomEnvelope, seat: number) {
    const s = room.state as Game101StatePayload;
    const players = s.players.map((p, i) => ({
      tiles: i === seat ? p.tiles : (Array(count(p.tiles)).fill(HIDDEN) as (OkeyTile | null)[]),
      score: p.score,
      hasLaidDown: p.hasLaidDown,
    }));
    return {
      state: {
        kind: '101',
        players,
        centerStackCount: s.centerStack.length,
        discardPiles: s.discardPiles,
        indicatorTile: s.indicatorTile,
        okeyTile: s.okeyTile,
        tableMelds: s.tableMelds,
        roundWinner: s.roundWinner,
        gameWinner: s.gameWinner,
        roundNumber: s.roundNumber,
      },
    };
  },
};
