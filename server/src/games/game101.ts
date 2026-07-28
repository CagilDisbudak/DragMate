/**
 * Authoritative Okey-101 module. Ports the pure engine (game101Logic) and runs
 * ALL of it server-side: dealing/RNG, meld validation, the classic 101-point /
 * 5-pair first open, discard-take-to-open rule, scoring, round/game progression,
 * and the AI (computeAIMove).
 *
 * Like okey, `projectView` hides opponents' racks and the draw-pile order — only
 * a seat's own tiles are sent. AI runs on the server, so a host disconnect no
 * longer stalls bot turns.
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
  endRoundInDraw,
  computeAIMove,
  isValidMeld,
  canAddToMeld,
  canMakePairOpen,
  canTakeDiscardToOpen,
  extractPairs,
  getMeldPoints,
  sortByRuns,
  sortBySets,
  sortByPairs,
  smartSort101Tiles,
  MAX_HAND_SIZE,
  FIRST_MELD_MINIMUM,
  PAIR_OPEN_MINIMUM,
  type Game101State,
} from './logic/game101Logic.js';

const HIDDEN: OkeyTile = { id: 'hidden', value: 0, color: null };
const SEATS = 4;

const count = (tiles: (OkeyTile | null)[]): number => tiles.filter((t) => t !== null).length;

function toGame(room: RoomEnvelope): Game101State {
  const s = room.state as Game101StatePayload;
  return {
    phase: s.phase,
    players: s.players.map((p) => ({
      tiles: [...p.tiles],
      score: p.score,
      hasLaidDown: p.hasLaidDown,
      openedWithPairs: p.openedWithPairs ?? false,
    })),
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
  mode?: string;
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
    mode: typeof m.mode === 'string' ? m.mode : undefined,
  };
}

function isHostSeat(room: RoomEnvelope, seat: number): boolean {
  return room.seats[seat]?.userId != null && room.seats[seat]?.userId === room.hostUserId;
}

function emptyGame(): Game101State {
  return {
    phase: 'dealing',
    players: Array.from({ length: SEATS }, () => ({
      tiles: [],
      score: 0,
      hasLaidDown: false,
      openedWithPairs: false,
    })),
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
    return { state: buildResult(emptyGame(), false).state, currentTurn: 0, phase: 'waiting' };
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
    return buildResult(g, true); // starter holds 22 tiles → already "drawn"
  },

  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult {
    const { action, slot, index, from, to, meldId, indices, mode } = parseAction(move);
    const prevState = room.state as Game101StatePayload;
    const prevDrawn = prevState.drawnThisTurn;
    let openingPoints = prevState.openingPointsThisTurn ?? 0;
    const g = toGame(room);
    const isTurn = seat === g.currentTurn;
    const hand = g.players[seat].tiles;

    switch (action) {
      case 'reorder': {
        if (from === undefined || to === undefined) throw new GameError('bad_move', 'reorder needs from/to');
        if (from < 0 || from >= hand.length || to < 0 || to >= hand.length) throw new GameError('bad_move', 'out of range');
        [hand[from], hand[to]] = [hand[to], hand[from]];
        return buildResult(g, prevDrawn, undefined, openingPoints);
      }
      case 'sortRuns':
        g.players[seat].tiles = sortByRuns(hand);
        return buildResult(g, prevDrawn, undefined, openingPoints);
      case 'sortSets':
        g.players[seat].tiles = sortBySets(hand);
        return buildResult(g, prevDrawn, undefined, openingPoints);
      case 'sortPairs':
        g.players[seat].tiles = sortByPairs(hand);
        return buildResult(g, prevDrawn, undefined, openingPoints);
      case 'smartSort':
        g.players[seat].tiles = smartSort101Tiles(hand);
        return buildResult(g, prevDrawn, undefined, openingPoints);

      case 'drawCenter': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= MAX_HAND_SIZE) throw new GameError('too_many', 'Discard before drawing');
        const tile = g.centerStack.pop();
        if (!tile) {
          return buildResult(endRoundInDraw(g), false, { roundDraw: true, seat });
        }
        placeInRack(hand, tile, slot);
        return buildResult(g, true, { draw: 'center', seat }, 0);
      }
      case 'drawDiscard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= MAX_HAND_SIZE) throw new GameError('too_many', 'Discard before drawing');
        const prev = (seat + 3) % SEATS;
        const pile = g.discardPiles[prev];
        const tile = pile[pile.length - 1];
        if (!tile) throw new GameError('empty_pile', 'No tile to take');
        // Classic: unopened players may take discard only if it enables opening.
        if (!g.players[seat].hasLaidDown && !canTakeDiscardToOpen(hand, tile)) {
          throw new GameError('cant_take', 'Yan taşı yalnızca onunla açabileceksen alabilirsin');
        }
        pile.pop();
        placeInRack(hand, tile, slot);
        return buildResult(g, true, { draw: 'discard', seat }, 0);
      }
      case 'discard': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before discarding');
        if (!g.players[seat].hasLaidDown && openingPoints > 0 && openingPoints < FIRST_MELD_MINIMUM) {
          throw new GameError('finish_open', 'Açılışı 101 puana tamamlamadan taş atamazsın');
        }
        if (index === undefined) throw new GameError('bad_move', 'discard needs index');
        const tile = hand[index];
        if (!tile) throw new GameError('empty_slot', 'No tile at that slot');
        // Discarding the okey (joker) is a classic foul — reject rather than silent +101 UI.
        if (tile.isFakeOkey || (g.okeyTile && tile.color === g.okeyTile.color && tile.value === g.okeyTile.value && !tile.isFakeOkey)) {
          // Real okey tiles match indicator+1; fake okey is the joker piece.
          // Only block the true okey face and fake-okey jokers.
        }
        const isRealOkey =
          !!g.okeyTile &&
          !tile.isFakeOkey &&
          tile.color === g.okeyTile.color &&
          tile.value === g.okeyTile.value;
        if (tile.isFakeOkey || isRealOkey) {
          throw new GameError('okey_discard', 'Okey taşını yere atamazsın (+101)');
        }
        hand[index] = null;
        g.discardPiles[seat].push(tile);
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), false, { discard: tile.id, seat, win: true });
        }
        g.currentTurn = (seat + 1) % SEATS;
        return buildResult(g, false, { discard: tile.id, seat }, 0);
      }
      case 'layDownPairs':
      case 'layDown': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before laying down');

        const wantPairs = action === 'layDownPairs' || mode === 'pairs';

        if (wantPairs) {
          if (g.players[seat].hasLaidDown) throw new GameError('already_open', 'Zaten açtın');
          const sourceTiles =
            indices && indices.length > 0
              ? indices.map((i) => hand[i]).filter((t): t is OkeyTile => t != null)
              : hand.filter((t): t is OkeyTile => t != null);
          if (!canMakePairOpen(sourceTiles)) {
            throw new GameError('need_pairs', `Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli`);
          }
          const pairs = extractPairs(sourceTiles, Math.max(PAIR_OPEN_MINIMUM, countCompletePairsSafe(sourceTiles)));
          if (pairs.length < PAIR_OPEN_MINIMUM) {
            throw new GameError('need_pairs', `Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli`);
          }
          for (const pairTiles of pairs) {
            const meldId2 = `meld-${seat}-r${g.roundNumber}-pair-${Object.keys(g.tableMelds).length}-${Math.floor(Math.random() * 1e6)}`;
            g.tableMelds[meldId2] = { id: meldId2, tiles: pairTiles, type: 'pair', ownerPlayer: seat };
            for (const t of pairTiles) {
              const i = hand.findIndex((h) => h?.id === t.id);
              if (i !== -1) hand[i] = null;
            }
          }
          g.players[seat].hasLaidDown = true;
          g.players[seat].openedWithPairs = true;
          if (count(hand) === 0) {
            return buildResult(endRound(g, seat), prevDrawn, { layDownPairs: seat, win: true });
          }
          return buildResult(g, prevDrawn, { layDownPairs: seat }, 0);
        }

        if (!indices || indices.length < 3) throw new GameError('bad_meld', 'Select at least 3 tiles');
        const tiles = indices.map((i) => hand[i]).filter((t): t is OkeyTile => t != null);
        if (tiles.length !== indices.length || tiles.length < 3) throw new GameError('bad_meld', 'Invalid selection');
        const validation = isValidMeld(tiles);
        if (!validation.valid || !validation.type) throw new GameError('invalid_meld', 'Not a valid set or run');

        const meldPoints = getMeldPoints(tiles, validation.type);

        if (!g.players[seat].hasLaidDown) {
          // Progressive open within the turn: accumulate until ≥101.
          openingPoints += meldPoints;
          const meldId2 = `meld-${seat}-r${g.roundNumber}-${Object.keys(g.tableMelds).length}-${Math.floor(Math.random() * 1e6)}`;
          g.tableMelds[meldId2] = { id: meldId2, tiles, type: validation.type, ownerPlayer: seat };
          for (const t of tiles) {
            const i = hand.findIndex((h) => h?.id === t.id);
            if (i !== -1) hand[i] = null;
          }
          if (openingPoints >= FIRST_MELD_MINIMUM) {
            g.players[seat].hasLaidDown = true;
            openingPoints = 0;
          }
          if (count(hand) === 0) {
            if (!g.players[seat].hasLaidDown) {
              throw new GameError('need_101', `İlk açış en az ${FIRST_MELD_MINIMUM} puan olmalı`);
            }
            return buildResult(endRound(g, seat), prevDrawn, { layDown: seat, win: true }, 0);
          }
          return buildResult(g, prevDrawn, { layDown: seat }, openingPoints);
        }

        const meldId2 = `meld-${seat}-r${g.roundNumber}-${Object.keys(g.tableMelds).length}-${Math.floor(Math.random() * 1e6)}`;
        g.tableMelds[meldId2] = { id: meldId2, tiles, type: validation.type, ownerPlayer: seat };
        for (const t of tiles) {
          const i = hand.findIndex((h) => h?.id === t.id);
          if (i !== -1) hand[i] = null;
        }
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), prevDrawn, { layDown: seat, win: true });
        }
        return buildResult(g, prevDrawn, { layDown: seat }, openingPoints);
      }
      case 'addToMeld': {
        if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before adding');
        if (index === undefined || !meldId) throw new GameError('bad_move', 'addToMeld needs index + meldId');
        if (!g.players[seat].hasLaidDown) throw new GameError('not_open', 'Önce elini açmalısın (101 veya 5 çift)');
        const meld = g.tableMelds[meldId];
        if (!meld) throw new GameError('no_meld', 'Meld not found');
        const tile = hand[index];
        if (!tile) throw new GameError('empty_slot', 'No tile at that slot');
        if (!canAddToMeld(meld, tile)) throw new GameError('cant_add', 'Tile does not fit that meld');
        g.tableMelds[meldId] = { ...meld, tiles: [...meld.tiles, tile] };
        hand[index] = null;
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), prevDrawn, { addToMeld: seat, win: true });
        }
        return buildResult(g, prevDrawn, { addToMeld: seat }, openingPoints);
      }
      case 'startNewRound': {
        if (!isHostSeat(room, seat)) throw new GameError('not_host', 'Only the host can start a new round');
        if (g.phase !== 'roundOver') throw new GameError('bad_phase', 'Round is not over');
        return buildResult(startNewRound101(g), true, undefined, 0);
      }
      default:
        throw new GameError('bad_action', `Unknown action ${action}`);
    }
  },

  aiTurn(room: RoomEnvelope): ApplyResult {
    const next = computeAIMove(toGame(room));
    return buildResult(next, false, { ai: true }, 0);
  },

  resign(room: RoomEnvelope, seat: number): ApplyResult {
    const g = toGame(room);
    g.phase = 'roundOver';
    g.roundWinner = null;
    return buildResult(g, false, { resigned: seat }, 0);
  },

  rematch(): ApplyResult {
    return buildResult(initialize101Game(SEATS), true, undefined, 0);
  },

  projectView(room: RoomEnvelope, seat: number) {
    const s = room.state as Game101StatePayload;
    const players = s.players.map((p, i) => ({
      tiles: i === seat ? p.tiles : (Array(count(p.tiles)).fill(HIDDEN) as (OkeyTile | null)[]),
      score: p.score,
      hasLaidDown: p.hasLaidDown,
      openedWithPairs: p.openedWithPairs ?? false,
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
        drawnThisTurn: s.drawnThisTurn,
        openingPointsThisTurn: s.openingPointsThisTurn ?? 0,
      },
    };
  },
};

function countCompletePairsSafe(tiles: OkeyTile[]): number {
  const counts = new Map<string, number>();
  for (const t of tiles) {
    if (t.isFakeOkey || !t.color) continue;
    const k = `${t.color}-${t.value}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let pairs = 0;
  for (const n of counts.values()) pairs += Math.floor(n / 2);
  return pairs;
}

function buildResult(
  g: Game101State,
  drawnThisTurn: boolean,
  lastMove?: unknown,
  openingPointsThisTurn = 0,
): ApplyResult {
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
    openingPointsThisTurn,
  };
  return {
    state,
    currentTurn: g.currentTurn,
    phase,
    winner: g.gameWinner ?? g.roundWinner ?? null,
    status: g.phase,
    lastMove,
  };
}
