/**
 * Authoritative Okey module.
 *
 * The single biggest win here vs the old Firestore model: **hidden information**.
 * Previously every client's onSnapshot received every opponent's rack AND the
 * ordered draw pile. Here the server keeps all hands + the deck private and
 * `projectView` sends each seat ONLY its own rack plus public info (discard piles,
 * indicator, counts). AI also runs server-side, so a host disconnect can't stall it.
 *
 * All actions arrive on `game:move` as `{ action, ... }`; this module enforces
 * turn ownership per action (rack reorder/sort are legal off-turn).
 */
import type { ApplyResult, OkeyTile, RoomEnvelope } from '../types.js';
import { GameError, type GameModule, type InitResult } from './GameModule.js';
import {
  initializeOkeyGame,
  isWinningHand,
  arrangeTiles,
  shuffleDeck,
  chooseBotDraw,
  chooseBotFinish,
  chooseBotDiscard,
} from './logic/okeyLogic.js';

type OkeyPhase = 'waiting' | 'playing' | 'roundOver' | 'stackEmpty';

interface OkeyPayload {
  kind: 'okey';
  centerStack: OkeyTile[];
  discardPiles: OkeyTile[][];
  indicatorTile: OkeyTile | null;
  okeyTile: OkeyTile | null;
  hands: (OkeyTile | null)[][];
}

const HIDDEN: OkeyTile = { id: 'hidden', value: 0, color: null };
const SEATS = 4;

function payload(room: RoomEnvelope): OkeyPayload {
  if (room.state.kind !== 'okey') throw new GameError('bad_state', 'Not an okey room');
  const s = room.state;
  return {
    kind: 'okey',
    centerStack: [...s.centerStack],
    discardPiles: s.discardPiles.map((p) => [...p]),
    indicatorTile: s.indicatorTile,
    okeyTile: s.okeyTile,
    hands: s.hands.map((h) => [...h]),
  };
}

function countTiles(hand: (OkeyTile | null)[]): number {
  return hand.filter((t) => t !== null).length;
}

function result(
  p: OkeyPayload,
  phase: ApplyResult['phase'],
  status: OkeyPhase,
  currentTurn: number,
  winner: number | null,
  lastMove?: unknown,
): ApplyResult {
  return { state: p, currentTurn, phase, winner, status, lastMove };
}

function parseAction(move: unknown): { action: string; slot?: number; index?: number; from?: number; to?: number } {
  if (!move || typeof move !== 'object') throw new GameError('bad_move', 'Move payload missing');
  const m = move as Record<string, unknown>;
  if (typeof m.action !== 'string') throw new GameError('bad_move', 'Missing action');
  return {
    action: m.action,
    slot: typeof m.slot === 'number' ? m.slot : undefined,
    index: typeof m.index === 'number' ? m.index : undefined,
    from: typeof m.from === 'number' ? m.from : undefined,
    to: typeof m.to === 'number' ? m.to : undefined,
  };
}

function placeInRack(hand: (OkeyTile | null)[], tile: OkeyTile, slot?: number): void {
  if (slot !== undefined && slot >= 0 && slot < hand.length && hand[slot] === null) {
    hand[slot] = tile;
    return;
  }
  const idx = hand.findIndex((t) => t === null);
  if (idx !== -1) hand[idx] = tile;
}

function isHostSeat(room: RoomEnvelope, seat: number): boolean {
  return room.seats[seat]?.userId != null && room.seats[seat]?.userId === room.hostUserId;
}

export const okeyModule: GameModule = {
  type: 'okey',
  maxSeats: SEATS,
  hasWaitingRoom: true,
  aiDelayMs: 1400,

  init(): InitResult {
    const state: OkeyPayload = {
      kind: 'okey',
      centerStack: [],
      discardPiles: [[], [], [], []],
      indicatorTile: null,
      okeyTile: null,
      hands: [[], [], [], []],
    };
    return { state, currentTurn: 0, phase: 'waiting' };
  },

  start(room: RoomEnvelope): ApplyResult {
    // Fill empty seats with AI, then deal.
    for (const seat of room.seats) {
      if (!seat.userId) {
        seat.isAI = true;
        seat.userId = `AI_${seat.seatIndex}`;
        seat.displayName = `Bot ${seat.seatIndex + 1}`;
        seat.connected = true;
      }
    }
    const g = initializeOkeyGame();
    const p: OkeyPayload = {
      kind: 'okey',
      centerStack: g.centerStack,
      discardPiles: g.discardPiles,
      indicatorTile: g.indicatorTile,
      okeyTile: g.okeyTile,
      hands: g.players.map((pl) => pl.tiles),
    };
    return result(p, 'playing', 'playing', 0, null);
  },

  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult {
    const { action, slot, index, from, to } = parseAction(move);
    const p = payload(room);
    const status = room.status as OkeyPhase;
    const turn = room.currentTurn;
    const isTurn = seat === turn;

    switch (action) {
      case 'reorder': {
        if (from === undefined || to === undefined) throw new GameError('bad_move', 'reorder needs from/to');
        const hand = p.hands[seat];
        if (from < 0 || from >= hand.length || to < 0 || to >= hand.length) throw new GameError('bad_move', 'index out of range');
        [hand[from], hand[to]] = [hand[to], hand[from]];
        return result(p, room.phase, status, turn, room.winner);
      }
      case 'sort': {
        p.hands[seat] = arrangeTiles(p.hands[seat], p.okeyTile) as (OkeyTile | null)[];
        return result(p, room.phase, status, turn, room.winner);
      }
      case 'drawCenter': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (status !== 'playing') throw new GameError('not_active', 'Cannot draw now');
        if (countTiles(p.hands[seat]) >= 15) throw new GameError('too_many', 'Discard before drawing');
        const tile = p.centerStack.pop();
        if (!tile) throw new GameError('stack_empty', 'Center stack is empty');
        placeInRack(p.hands[seat], tile, slot);
        const nextStatus: OkeyPhase = p.centerStack.length === 0 ? 'stackEmpty' : 'playing';
        return result(p, 'playing', nextStatus, turn, null, { draw: 'center', seat });
      }
      case 'drawDiscard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (countTiles(p.hands[seat]) >= 15) throw new GameError('too_many', 'Discard before drawing');
        const prev = (seat + 3) % SEATS;
        const tile = p.discardPiles[prev].pop();
        if (!tile) throw new GameError('empty_pile', 'No tile to take');
        placeInRack(p.hands[seat], tile, slot);
        return result(p, 'playing', status, turn, null, { draw: 'discard', seat });
      }
      case 'discard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (index === undefined) throw new GameError('bad_move', 'discard needs index');
        if (countTiles(p.hands[seat]) !== 15) throw new GameError('need_15', 'You must hold 15 tiles to discard');
        const tile = p.hands[seat][index];
        if (!tile) throw new GameError('empty_slot', 'No tile at that slot');
        p.hands[seat][index] = null;
        p.discardPiles[seat].push(tile);
        const nextTurn = (turn + 1) % SEATS;
        return result(p, 'playing', 'playing', nextTurn, null, { discard: tile.id, seat });
      }
      case 'finish': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (index === undefined) throw new GameError('bad_move', 'finish needs index');
        if (countTiles(p.hands[seat]) !== 15) throw new GameError('need_15', 'You must hold 15 tiles to finish');
        const discard = p.hands[seat][index];
        if (!discard) throw new GameError('empty_slot', 'No tile at that slot');
        const remaining = p.hands[seat].filter((_, i) => i !== index);
        if (!isWinningHand(remaining, p.okeyTile)) throw new GameError('not_winning', 'Not a winning hand');
        p.hands[seat][index] = null;
        p.discardPiles[seat].push(discard);
        return result(p, 'roundOver', 'roundOver', turn, seat, { finish: seat });
      }
      case 'reshuffle': {
        if (!isHostSeat(room, seat)) throw new GameError('not_host', 'Only the host can reshuffle');
        if (status !== 'stackEmpty') throw new GameError('bad_phase', 'Nothing to reshuffle');
        const all = p.discardPiles.flat();
        p.centerStack = shuffleDeck(all);
        p.discardPiles = [[], [], [], []];
        return result(p, 'playing', 'playing', turn, null);
      }
      case 'endTie': {
        if (!isHostSeat(room, seat)) throw new GameError('not_host', 'Only the host can end the round');
        return result(p, 'roundOver', 'roundOver', turn, null);
      }
      default:
        throw new GameError('bad_action', `Unknown action ${action}`);
    }
  },

  aiTurn(room: RoomEnvelope): ApplyResult {
    const p = payload(room);
    const turn = room.currentTurn;
    const hand = p.hands[turn];
    const nextTurn = (turn + 1) % SEATS;

    // Draw: the engine heuristic takes the previous player's discard when that
    // tile is an immediate meld-maker, otherwise the center (with fallbacks
    // when either source is empty).
    if (countTiles(hand) < 15) {
      const prev = (turn + 3) % SEATS;
      const prevPile = p.discardPiles[prev];
      const prevTop = prevPile.length > 0 ? prevPile[prevPile.length - 1] : null;
      let tile: OkeyTile | undefined;
      if (prevTop && chooseBotDraw(hand, prevTop, p.okeyTile) === 'discard') {
        tile = prevPile.pop();
      }
      if (!tile) tile = p.centerStack.pop();
      if (!tile) tile = prevPile.pop();
      if (!tile) {
        // Nothing to draw anywhere — pass the turn to avoid a deadlock.
        return result(p, 'playing', 'stackEmpty', nextTurn, null, { ai: true, pass: true });
      }
      placeInRack(hand, tile);
    }

    // Win check BEFORE discarding: if one discard leaves a valid 14-tile hand,
    // the bot finishes and wins the round.
    const finishIdx = chooseBotFinish(hand, p.okeyTile);
    if (finishIdx !== -1) {
      const tile = hand[finishIdx]!;
      hand[finishIdx] = null;
      p.discardPiles[turn].push(tile);
      return result(p, 'roundOver', 'roundOver', turn, turn, { finish: turn, ai: true });
    }

    // Discard the least useful tile (difficulty-aware, never the okey unless forced).
    const idx = chooseBotDiscard(hand, p.okeyTile, room.aiDifficulty);
    if (idx !== -1) {
      const tile = hand[idx]!;
      hand[idx] = null;
      p.discardPiles[turn].push(tile);
    }

    const status: OkeyPhase = p.centerStack.length === 0 ? 'stackEmpty' : 'playing';
    return result(p, 'playing', status, nextTurn, null, { ai: true });
  },

  resign(room: RoomEnvelope, seat: number): ApplyResult {
    // In a 4-player round game, a resign just ends the round with no winner.
    const p = payload(room);
    const other = room.seats.find((s) => s.userId && !s.isAI && s.seatIndex !== seat);
    return result(p, 'roundOver', 'roundOver', room.currentTurn, other ? other.seatIndex : null, { resigned: seat });
  },

  rematch(): ApplyResult {
    const g = initializeOkeyGame();
    const p: OkeyPayload = {
      kind: 'okey',
      centerStack: g.centerStack,
      discardPiles: g.discardPiles,
      indicatorTile: g.indicatorTile,
      okeyTile: g.okeyTile,
      hands: g.players.map((pl) => pl.tiles),
    };
    return result(p, 'playing', 'playing', 0, null);
  },

  projectView(room: RoomEnvelope, seat: number) {
    const s = room.state as OkeyPayload;
    const handCounts = s.hands.map(countTiles);
    const hands = s.hands.map((h, i) =>
      i === seat ? h : (Array(handCounts[i]).fill(HIDDEN) as (OkeyTile | null)[]),
    );
    return {
      state: {
        kind: 'okey',
        phase: room.status as OkeyPhase,
        centerStackCount: s.centerStack.length,
        discardPiles: s.discardPiles,
        indicatorTile: s.indicatorTile,
        okeyTile: s.okeyTile,
        hands,
        handCounts,
      },
    };
  },
};
