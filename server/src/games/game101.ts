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
 * `drawnThisTurn` so melding before discarding works correctly. An unopened player's
 * partial opening and/or side-tile take can be undone this turn with `undo`
 * ("Geri Al"), restored from a server-held snapshot (never sent to clients).
 */
import type { ApplyResult, Game101StatePayload, OkeyTile, RoomEnvelope } from '../types.js';
import { GameError, type GameModule, type InitResult } from './GameModule.js';
import {
  initialize101Game,
  startNewRound as startNewRound101,
  endRound,
  endRoundStackEmpty,
  computeAIMove,
  isValidMeld,
  isWildOkey,
  canAddToMeld,
  canMakePairOpen,
  canTakeDiscardToOpen,
  extractPairs,
  getMeldPoints,
  orderMeldTiles,
  addTileToMeld,
  sortByRuns,
  sortBySets,
  sortByPairs,
  smartSort101Tiles,
  MAX_HAND_SIZE,
  FIRST_MELD_MINIMUM,
  PAIR_OPEN_MINIMUM,
  OKEY_DISCARD_PENALTY,
  type Game101State,
} from './logic/game101Logic.js';

const HIDDEN: OkeyTile = { id: 'hidden', value: 0, color: null };
const SEATS = 4;

/** Turn-local bookkeeping stored alongside the payload (server-only fields). */
interface TurnSnapshot {
  game: Game101State;
  drawnThisTurn: boolean;
  openingPointsThisTurn: number;
}
interface TurnExtras {
  /** Seat that dealt the current round (drives starter rotation). */
  dealer?: number;
  /** Side tile taken this turn by an unopened player — must be used in this turn's opening. */
  sideTileId?: string | null;
  /** State to restore on `undo` (taken before the side-tile take / first opening meld). */
  turnSnapshot?: TurnSnapshot | null;
}
type Payload101 = Game101StatePayload & TurnExtras;

const TURN_ACTIONS = new Set(['drawCenter', 'drawDiscard', 'discard', 'layDown', 'layDownPairs', 'addToMeld', 'undo']);

const count = (tiles: (OkeyTile | null)[]): number => tiles.filter((t) => t !== null).length;

function toGame(room: RoomEnvelope): Game101State {
  const s = room.state as Payload101;
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
    dealer: s.dealer,
  };
}

function placeInRack(hand: (OkeyTile | null)[], tile: OkeyTile, slot?: number): void {
  if (slot !== undefined && slot >= 0 && slot < hand.length && hand[slot] === null) {
    hand[slot] = tile;
    return;
  }
  const idx = hand.findIndex((t) => t === null);
  if (idx !== -1) hand[idx] = tile;
  else hand.push(tile);
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

/** Rack indices must be distinct integers pointing at real tiles. */
function checkIndices(indices: number[], hand: (OkeyTile | null)[]): OkeyTile[] {
  const seen = new Set<number>();
  return indices.map((i) => {
    if (!Number.isInteger(i) || i < 0 || i >= hand.length) throw new GameError('bad_move', 'Index out of range');
    if (seen.has(i)) throw new GameError('bad_move', 'Duplicate index');
    seen.add(i);
    const t = hand[i];
    if (!t) throw new GameError('empty_slot', 'No tile at that slot');
    return t;
  });
}

function checkIndex(index: number | undefined, hand: (OkeyTile | null)[]): OkeyTile {
  if (index === undefined || !Number.isInteger(index) || index < 0 || index >= hand.length) {
    throw new GameError('bad_move', 'Index out of range');
  }
  const t = hand[index];
  if (!t) throw new GameError('empty_slot', 'No tile at that slot');
  return t;
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

let meldSeq = 0;
const newMeldId = (seat: number, g: Game101State, tag: string) =>
  `meld-${seat}-r${g.roundNumber}-${tag}-${Date.now().toString(36)}-${(meldSeq++).toString(36)}`;

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
    const prevState = room.state as Payload101;
    const prevDrawn = prevState.drawnThisTurn;
    let openingPoints = prevState.openingPointsThisTurn ?? 0;
    const sideTileId = prevState.sideTileId ?? null;
    const snapshot = prevState.turnSnapshot ?? null;
    const keep: TurnExtras = { sideTileId, turnSnapshot: snapshot };
    const g = toGame(room);
    const okey = g.okeyTile;
    const isTurn = seat === g.currentTurn;
    const hand = g.players[seat].tiles;
    const opened = g.players[seat].hasLaidDown;

    if (TURN_ACTIONS.has(action)) {
      if (g.phase !== 'playing') throw new GameError('bad_phase', 'El bitti — yeni eli bekleyin');
      if (!isTurn) throw new GameError('not_your_turn', 'Not your turn');
    }
    /** Pre-move copy of the game for "Geri Al". */
    const snapshotNow = (): TurnSnapshot => ({
      game: JSON.parse(JSON.stringify(toGame(room))) as Game101State,
      drawnThisTurn: prevDrawn,
      openingPointsThisTurn: openingPoints,
    });
    const removeFromHand = (tiles: OkeyTile[]) => {
      for (const t of tiles) {
        const i = hand.findIndex((h) => h?.id === t.id);
        if (i !== -1) hand[i] = null;
      }
    };

    switch (action) {
      case 'reorder': {
        if (from === undefined || to === undefined) throw new GameError('bad_move', 'reorder needs from/to');
        if (from < 0 || from >= hand.length || to < 0 || to >= hand.length) throw new GameError('bad_move', 'out of range');
        [hand[from], hand[to]] = [hand[to], hand[from]];
        return buildResult(g, prevDrawn, undefined, openingPoints, keep);
      }
      case 'sortRuns':
        g.players[seat].tiles = sortByRuns(hand, okey);
        return buildResult(g, prevDrawn, undefined, openingPoints, keep);
      case 'sortSets':
        g.players[seat].tiles = sortBySets(hand, okey);
        return buildResult(g, prevDrawn, undefined, openingPoints, keep);
      case 'sortPairs':
        g.players[seat].tiles = sortByPairs(hand, okey);
        return buildResult(g, prevDrawn, undefined, openingPoints, keep);
      case 'smartSort':
        g.players[seat].tiles = smartSort101Tiles(hand, okey);
        return buildResult(g, prevDrawn, undefined, openingPoints, keep);

      case 'drawCenter': {
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= MAX_HAND_SIZE) throw new GameError('too_many', 'Discard before drawing');
        const tile = g.centerStack.pop();
        if (!tile) {
          return buildResult(endRoundStackEmpty(g), false, { roundDraw: true, seat });
        }
        placeInRack(hand, tile, slot);
        return buildResult(g, true, { draw: 'center', seat }, 0);
      }
      case 'drawDiscard': {
        if (prevDrawn) throw new GameError('already_drew', 'You already drew this turn');
        if (count(hand) >= MAX_HAND_SIZE) throw new GameError('too_many', 'Discard before drawing');
        const prev = (seat + SEATS - 1) % SEATS;
        const pile = g.discardPiles[prev];
        const tile = pile[pile.length - 1];
        if (!tile) throw new GameError('empty_pile', 'No tile to take');
        // Classic: unopened players may take the side tile only to open with it this turn.
        if (!opened && !canTakeDiscardToOpen(hand, tile, okey)) {
          throw new GameError('cant_take', 'Yan taşı yalnızca onunla bu tur elini açabileceksen alabilirsin');
        }
        const snap = opened ? null : snapshotNow();
        pile.pop();
        placeInRack(hand, tile, slot);
        return buildResult(g, true, { draw: 'discard', seat }, 0, {
          sideTileId: opened ? null : tile.id,
          turnSnapshot: snap,
        });
      }
      case 'discard': {
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before discarding');
        if (!opened && openingPoints > 0 && openingPoints < FIRST_MELD_MINIMUM) {
          throw new GameError('finish_open', 'Açılışı 101 puana tamamlamadan taş atamazsın — perleri geri almak için "Geri Al"');
        }
        if (sideTileId && (!opened || hand.some((t) => t?.id === sideTileId))) {
          throw new GameError('side_tile_unused', 'Yan taşı aldın: bu tur o taşı kullanarak elini açmalısın (vazgeçmek için "Geri Al")');
        }
        const tile = checkIndex(index, hand);
        let penalty = 0;
        if (isWildOkey(tile, okey)) {
          if (!hand.every((t) => !t || isWildOkey(t, okey))) {
            throw new GameError('okey_discard', 'Okey taşını yere atamazsın');
          }
          penalty = OKEY_DISCARD_PENALTY; // only okeys left: allowed, +101
        }
        hand[index!] = null;
        g.players[seat].score += penalty;
        g.discardPiles[seat].push(tile);
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), false, { discard: tile.id, seat, win: true });
        }
        if (g.centerStack.length === 0) {
          return buildResult(endRoundStackEmpty(g), false, { discard: tile.id, seat, roundDraw: true });
        }
        g.currentTurn = (seat + 1) % SEATS;
        return buildResult(g, false, { discard: tile.id, seat }, 0);
      }
      case 'layDownPairs':
      case 'layDown': {
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before laying down');

        const wantPairs = action === 'layDownPairs' || mode === 'pairs';

        if (wantPairs) {
          if (opened) throw new GameError('already_open', 'Zaten açtın');
          if (openingPoints > 0) {
            throw new GameError('no_mix', 'Bu tur normal açışa başladın; çift açışla karıştıramazsın ("Geri Al" ile geri alabilirsin)');
          }
          const sourceTiles = indices && indices.length > 0 ? checkIndices(indices, hand) : hand.filter((t): t is OkeyTile => t != null);
          if (!canMakePairOpen(sourceTiles, okey)) {
            throw new GameError('need_pairs', `Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli`);
          }
          const sideTile = sideTileId ? sourceTiles.find((t) => t.id === sideTileId) ?? null : null;
          const pairs = extractPairs(sourceTiles, 99, okey, sideTile);
          if (pairs.length < PAIR_OPEN_MINIMUM) {
            throw new GameError('need_pairs', `Çift açış için en az ${PAIR_OPEN_MINIMUM} çift gerekli`);
          }
          for (const pairTiles of pairs) {
            const id = newMeldId(seat, g, 'pair');
            g.tableMelds[id] = { id, tiles: pairTiles, type: 'pair', ownerPlayer: seat };
          }
          removeFromHand(pairs.flat());
          g.players[seat].hasLaidDown = true;
          g.players[seat].openedWithPairs = true;
          if (count(hand) === 0) {
            return buildResult(endRound(g, seat), false, { layDownPairs: seat, win: true });
          }
          return buildResult(g, prevDrawn, { layDownPairs: seat }, 0, keep);
        }

        if (!indices || indices.length < 3) throw new GameError('bad_meld', 'Select at least 3 tiles');
        const tiles = checkIndices(indices, hand);
        const validation = isValidMeld(tiles, okey);
        if (!validation.valid || !validation.type) throw new GameError('invalid_meld', 'Not a valid set or run');
        const meldPoints = getMeldPoints(tiles, validation.type, okey);

        let extras = keep;
        if (!opened) {
          // Progressive open within the turn: accumulate until ≥101 (undoable with "Geri Al").
          extras = { sideTileId, turnSnapshot: snapshot ?? snapshotNow() };
          openingPoints += meldPoints;
          if (openingPoints >= FIRST_MELD_MINIMUM) {
            g.players[seat].hasLaidDown = true;
            openingPoints = 0;
          }
        }
        removeFromHand(tiles);
        if (count(hand) === 0 && !g.players[seat].hasLaidDown) {
          throw new GameError('need_101', `İlk açış en az ${FIRST_MELD_MINIMUM} puan olmalı`);
        }
        const id = newMeldId(seat, g, validation.type);
        g.tableMelds[id] = { id, tiles: orderMeldTiles(tiles, validation.type, okey), type: validation.type, ownerPlayer: seat };
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), false, { layDown: seat, win: true });
        }
        return buildResult(g, prevDrawn, { layDown: seat }, openingPoints, extras);
      }
      case 'addToMeld': {
        if (!prevDrawn) throw new GameError('draw_first', 'Draw before adding');
        if (!meldId) throw new GameError('bad_move', 'addToMeld needs index + meldId');
        if (!opened) throw new GameError('not_open', 'Önce elini açmalısın (101 veya 5 çift)');
        const meld = g.tableMelds[meldId];
        if (!meld) throw new GameError('no_meld', 'Meld not found');
        const tile = checkIndex(index, hand);
        if (!canAddToMeld(meld, tile, okey)) throw new GameError('cant_add', 'Bu taş bu pere eklenemez');
        g.tableMelds[meldId] = { ...meld, tiles: addTileToMeld(meld, tile, okey) };
        hand[index!] = null;
        if (count(hand) === 0) {
          return buildResult(endRound(g, seat), false, { addToMeld: seat, win: true });
        }
        return buildResult(g, prevDrawn, { addToMeld: seat }, openingPoints, keep);
      }
      case 'undo': {
        if (!snapshot) throw new GameError('nothing_to_undo', 'Geri alınacak bir şey yok');
        return buildResult(snapshot.game, snapshot.drawnThisTurn, { undo: seat }, snapshot.openingPointsThisTurn);
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
    const s = room.state as Payload101;
    const players = s.players.map((p, i) => ({
      tiles: i === seat ? p.tiles : (Array(count(p.tiles)).fill(HIDDEN) as (OkeyTile | null)[]),
      score: p.score,
      hasLaidDown: p.hasLaidDown,
      openedWithPairs: p.openedWithPairs ?? false,
    }));
    const me = s.players[seat];
    const canUndo =
      s.phase === 'playing' &&
      seat === s.currentTurn &&
      !!s.turnSnapshot &&
      !!me &&
      (!me.hasLaidDown || (!!s.sideTileId && me.tiles.some((t) => t?.id === s.sideTileId)));
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
        canUndo,
      },
    };
  },
};

function buildResult(
  g: Game101State,
  drawnThisTurn: boolean,
  lastMove?: unknown,
  openingPointsThisTurn = 0,
  extras: TurnExtras = {},
): ApplyResult {
  const phase: ApplyResult['phase'] =
    g.phase === 'gameOver' ? 'gameOver' : g.phase === 'roundOver' ? 'roundOver' : 'playing';
  const turnFields: TurnExtras = {
    dealer: g.dealer,
    sideTileId: extras.sideTileId ?? null,
    turnSnapshot: extras.turnSnapshot ?? null,
  };
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
    ...turnFields,
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
