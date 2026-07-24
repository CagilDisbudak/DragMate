/**
 * Authoritative backgammon module. Ports the pure rules from the client
 * (backgammonLogic + backgammonAI) and — critically — moves the two things that
 * used to live in the React component server-side:
 *   1. Dice RNG (was client Math.random; the *ending* player rolled the
 *      opponent's dice — a cheat vector).
 *   2. End-of-turn / forfeit / auto-skip logic (was in BackgammonGame.handleMove
 *      and an auto-skip effect).
 *
 * Seat mapping: seat 0 = white, seat 1 = black.
 */
import type { ApplyResult, BackgammonGameState, RoomEnvelope, AiDifficulty } from '../types.js';
import { GameError, type GameModule, type InitResult } from './GameModule.js';

type Color = 'white' | 'black';

interface Move {
  from: number | 'bar';
  to: number | 'off';
  roll: number;
  isHit?: boolean;
  subMoves?: Move[];
}

interface BgState {
  board: number[];
  bar: { white: number; black: number };
  off: { white: number; black: number };
  turn: Color;
  dice: number[];
  movesLeft: number[];
  winner: Color | null;
}

const INITIAL_BOARD = [
  2, 0, 0, 0, 0, -5,
  0, -3, 0, 0, 0, 5,
  -5, 0, 0, 0, 3, 0,
  5, 0, 0, 0, 0, -2,
];

function rollDice(): number[] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

// Real backgammon opening: each player rolls ONE die, rerolling ties.
// Mapping: die #1 belongs to WHITE (seat 0), die #2 belongs to BLACK (seat 1) —
// the owner of the higher die starts and plays BOTH dice as their first roll.
function rollOpening(): { dice: number[]; turn: Color } {
  let d1 = Math.floor(Math.random() * 6) + 1;
  let d2 = Math.floor(Math.random() * 6) + 1;
  while (d1 === d2) {
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
  }
  return { dice: [d1, d2], turn: d1 > d2 ? 'white' : 'black' };
}

function canBearOff(state: BgState, player: Color): boolean {
  const board = state.board;
  if (player === 'white') {
    if (state.bar.white > 0) return false;
    for (let i = 0; i < 18; i++) if (board[i] > 0) return false;
    return true;
  }
  if (state.bar.black > 0) return false;
  for (let i = 6; i < 24; i++) if (board[i] < 0) return false;
  return true;
}

function getValidMoves(state: BgState): Move[] {
  if (state.winner) return [];

  const getSingleStepMoves = (currentState: BgState): Move[] => {
    const moves: Move[] = [];
    const { turn, board, bar, movesLeft } = currentState;
    const uniqueRolls = Array.from(new Set(movesLeft));
    if (movesLeft.length === 0) return [];

    const isWhite = turn === 'white';
    const direction = isWhite ? 1 : -1;

    const barCount = isWhite ? bar.white : bar.black;
    if (barCount > 0) {
      for (const roll of uniqueRolls) {
        const targetIndex = isWhite ? roll - 1 : 24 - roll;
        const targetContent = board[targetIndex];
        const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;
        if (!isOpponentMulti) {
          moves.push({
            from: 'bar',
            to: targetIndex,
            roll,
            isHit: isWhite ? targetContent === -1 : targetContent === 1,
          });
        }
      }
      return moves; // On bar → must move from bar.
    }

    for (let i = 0; i < 24; i++) {
      const pieceCount = board[i];
      if (isWhite && pieceCount <= 0) continue;
      if (!isWhite && pieceCount >= 0) continue;

      for (const roll of uniqueRolls) {
        const targetIndex = i + direction * roll;
        const bearingOffAllowed = canBearOff(currentState, turn);

        if (bearingOffAllowed) {
          if (isWhite && targetIndex === 24) {
            moves.push({ from: i, to: 'off', roll });
            continue;
          }
          if (!isWhite && targetIndex === -1) {
            moves.push({ from: i, to: 'off', roll });
            continue;
          }
          if (isWhite && targetIndex > 24) {
            let isFurthest = true;
            for (let k = 18; k < i; k++) if (board[k] > 0) isFurthest = false;
            if (isFurthest) moves.push({ from: i, to: 'off', roll });
          }
          if (!isWhite && targetIndex < -1) {
            let isFurthest = true;
            for (let k = 5; k > i; k--) if (board[k] < 0) isFurthest = false;
            if (isFurthest) moves.push({ from: i, to: 'off', roll });
          }
        }

        if (targetIndex < 0 || targetIndex > 23) continue;

        const targetContent = board[targetIndex];
        const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;
        if (!isOpponentMulti) {
          moves.push({
            from: i,
            to: targetIndex,
            roll,
            isHit: isWhite ? targetContent === -1 : targetContent === 1,
          });
        }
      }
    }
    return moves;
  };

  const baseMoves = getSingleStepMoves(state);
  if (baseMoves.length === 0) return [];

  // --- Maximal dice usage (real backgammon rule) -----------------------------
  // A player must use as many dice as legally possible. Enumerate move
  // sequences recursively (doubles give up to 4 steps) to find the maximum
  // number of dice usable from this state; only moves that begin at least
  // one such maximal sequence are legal. Memoized for this call.
  const memo = new Map<string, number>();
  const keyOf = (s: BgState): string =>
    s.board.join(',') + '|' + s.bar.white + ',' + s.bar.black + '|' + [...s.movesLeft].sort().join(',');
  const maxPlayable = (s: BgState): number => {
    if (s.movesLeft.length === 0) return 0;
    const key = keyOf(s);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const m of getSingleStepMoves(s)) {
      const used = 1 + maxPlayable(applyMove(s, m));
      if (used > best) best = used;
      if (best === s.movesLeft.length) break; // cannot do better
    }
    memo.set(key, best);
    return best;
  };

  const maxUsable = maxPlayable(state);
  if (maxUsable === 0) return [];

  // Higher-die rule: when only ONE of two different dice can be played, the
  // HIGHER die must be played if any higher-die move exists.
  let forcedRoll: number | null = null;
  if (maxUsable === 1 && state.movesLeft.length === 2 && state.movesLeft[0] !== state.movesLeft[1]) {
    const higher = Math.max(state.movesLeft[0], state.movesLeft[1]);
    if (baseMoves.some((m) => m.roll === higher)) forcedRoll = higher;
  }

  const allMoves: Move[] = [];

  for (const m1 of baseMoves) {
    if (forcedRoll !== null && m1.roll !== forcedRoll) continue;

    const tempState = applyMove(state, m1);

    // Keep the single step only if it still begins a maximal sequence.
    if (1 + maxPlayable(tempState) !== maxUsable) continue;
    allMoves.push(m1);

    // Extend to depth-2 composites (sum of two dice). 'off' can't continue.
    if (state.movesLeft.length > 1 && m1.to !== 'off') {
      const continuations = getSingleStepMoves(tempState).filter((m2) => m2.from === m1.to);
      for (const m2 of continuations) {
        // The composite must itself begin a maximal sequence.
        const afterBoth = applyMove(tempState, m2);
        if (2 + maxPlayable(afterBoth) !== maxUsable) continue;

        allMoves.push({
          from: m1.from,
          to: m2.to,
          roll: m1.roll + m2.roll,
          isHit: m2.isHit,
          subMoves: [m1, m2],
        });
      }
    }
  }

  return allMoves;
}

function applyMove(state: BgState, move: Move): BgState {
  const newState: BgState = {
    ...state,
    board: [...state.board],
    bar: { ...state.bar },
    off: { ...state.off },
    movesLeft: [...state.movesLeft],
  };

  const isWhite = state.turn === 'white';

  if (move.subMoves && move.subMoves.length > 0) {
    let currentState = state;
    for (const subMove of move.subMoves) currentState = applyMove(currentState, subMove);
    return currentState;
  }

  if (move.from === 'bar') {
    if (isWhite) newState.bar.white--;
    else newState.bar.black--;
  } else {
    newState.board[move.from as number] -= isWhite ? 1 : -1;
  }

  if (move.to === 'off') {
    if (isWhite) newState.off.white++;
    else newState.off.black++;
  } else {
    const destIdx = move.to as number;
    if (move.isHit) {
      if (isWhite) newState.bar.black++;
      else newState.bar.white++;
      newState.board[destIdx] = 0;
    }
    newState.board[destIdx] += isWhite ? 1 : -1;
  }

  const diceIdx = newState.movesLeft.indexOf(move.roll);
  if (diceIdx > -1) newState.movesLeft.splice(diceIdx, 1);

  if (isWhite && newState.off.white === 15) newState.winner = 'white';
  if (!isWhite && newState.off.black === 15) newState.winner = 'black';

  return newState;
}

// --- AI (port of backgammonAI, plays one die-move at a time) -----------------

function evaluateMove(state: BgState, move: Move, difficulty: string): number {
  let score = 0;
  if (move.isHit) score += 100;
  if (move.to === 'off') score += 200;

  const newState = applyMove(state, move);
  const isWhite = state.turn === 'white';

  if (typeof move.to === 'number') {
    const destCount = newState.board[move.to];
    if (isWhite && destCount === 2) score += 50;
    if (!isWhite && destCount === -2) score += 50;
    if (Math.abs(destCount) === 1) score -= 30;
  }
  if (typeof move.from === 'number') {
    const srcCount = newState.board[move.from];
    if (Math.abs(srcCount) === 1) score -= 40;
  }
  if (difficulty === 'Hard' && typeof move.to === 'number') {
    const isHome = isWhite ? move.to >= 18 : move.to <= 5;
    if (isHome && Math.abs(newState.board[move.to]) > 1) score += 30;
  }
  score += Math.random() * 5;
  return score;
}

function getBestBackgammonMove(state: BgState, difficulty: AiDifficulty): Move | null {
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;
  if (difficulty === 'Easy') return validMoves[Math.floor(Math.random() * validMoves.length)];

  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  for (const move of validMoves) {
    const score = evaluateMove(state, move, difficulty);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

// --- envelope <-> logic-state bridging ---------------------------------------

function toBg(room: RoomEnvelope): BgState {
  const s = room.state as BackgammonGameState;
  return {
    board: [...s.board],
    bar: { ...s.bar },
    off: { ...s.off },
    dice: [...s.dice],
    movesLeft: [...s.movesLeft],
    turn: room.currentTurn === 0 ? 'white' : 'black',
    winner: room.winner === 0 ? 'white' : room.winner === 1 ? 'black' : null,
  };
}

function toResult(bg: BgState, phase: ApplyResult['phase'], status: string, lastMove?: unknown): ApplyResult {
  const state: BackgammonGameState = {
    kind: 'backgammon',
    board: bg.board,
    bar: bg.bar,
    off: bg.off,
    dice: bg.dice,
    movesLeft: bg.movesLeft,
  };
  return {
    state,
    currentTurn: bg.turn === 'white' ? 0 : 1,
    phase,
    winner: bg.winner === 'white' ? 0 : bg.winner === 'black' ? 1 : null,
    status,
    lastMove,
  };
}

/** Flip turn + roll fresh dice, auto-skipping players with no legal moves. */
function advanceTurn(bg: BgState): BgState {
  let s = bg;
  for (let i = 0; i < 6; i++) {
    const dice = rollDice();
    s = {
      ...s,
      turn: s.turn === 'white' ? 'black' : 'white',
      dice,
      movesLeft: [...dice],
    };
    if (getValidMoves(s).length > 0) break; // this player can move → stop
    // otherwise loop: forfeit and flip again
  }
  return s;
}

function parseIntent(move: unknown): { from: number | 'bar'; to: number | 'off' } {
  if (!move || typeof move !== 'object') throw new GameError('bad_move', 'Move payload missing');
  const m = move as Record<string, unknown>;
  const from = m.from === 'bar' ? 'bar' : typeof m.from === 'number' ? m.from : NaN;
  const to = m.to === 'off' ? 'off' : typeof m.to === 'number' ? m.to : NaN;
  if (from !== 'bar' && Number.isNaN(from)) throw new GameError('bad_move', 'Bad move.from');
  if (to !== 'off' && Number.isNaN(to)) throw new GameError('bad_move', 'Bad move.to');
  return { from: from as number | 'bar', to: to as number | 'off' };
}

export const backgammonModule: GameModule = {
  type: 'backgammon',
  maxSeats: 2,
  hasWaitingRoom: false,
  aiDelayMs: 1200,

  init(): InitResult {
    const opening = rollOpening();
    const state: BackgammonGameState = {
      kind: 'backgammon',
      board: [...INITIAL_BOARD],
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      dice: opening.dice,
      movesLeft: [...opening.dice],
    };
    return { state, currentTurn: opening.turn === 'white' ? 0 : 1, phase: 'playing' };
  },

  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult {
    if (room.state.kind !== 'backgammon') throw new GameError('bad_state', 'Not a backgammon room');
    if (room.phase !== 'playing') throw new GameError('not_active', 'Game is not active');
    if (room.currentTurn !== seat) throw new GameError('not_your_turn', 'It is not your turn');

    const bg = toBg(room);
    const intent = parseIntent(move);
    const chosen = getValidMoves(bg).find((m) => m.from === intent.from && m.to === intent.to);
    if (!chosen) throw new GameError('illegal_move', 'Illegal move');

    let next = applyMove(bg, chosen);
    const lastMove = { from: chosen.from, to: chosen.to, roll: chosen.roll, isHit: chosen.isHit ?? false };

    if (next.winner) return toResult(next, 'gameOver', 'finished', lastMove);

    if (next.movesLeft.length === 0 || getValidMoves(next).length === 0) {
      next = advanceTurn(next);
    }
    return toResult(next, 'playing', 'active', lastMove);
  },

  aiTurn(room: RoomEnvelope): ApplyResult {
    if (room.state.kind !== 'backgammon') throw new GameError('bad_state', 'Not a backgammon room');
    let bg = toBg(room);
    let guard = 0;
    while (bg.movesLeft.length > 0 && !bg.winner && guard++ < 30) {
      const best = getBestBackgammonMove(bg, room.aiDifficulty);
      if (!best) break;
      bg = applyMove(bg, best);
    }
    if (bg.winner) return toResult(bg, 'gameOver', 'finished', { ai: true });
    bg = advanceTurn(bg);
    return toResult(bg, 'playing', 'active', { ai: true });
  },

  resign(room: RoomEnvelope, seat: number): ApplyResult {
    const bg = toBg(room);
    bg.winner = seat === 0 ? 'black' : 'white';
    return toResult(bg, 'gameOver', 'resigned');
  },

  rematch(): ApplyResult {
    const opening = rollOpening();
    const bg: BgState = {
      board: [...INITIAL_BOARD],
      bar: { white: 0, black: 0 },
      off: { white: 0, black: 0 },
      turn: opening.turn,
      dice: opening.dice,
      movesLeft: [...opening.dice],
      winner: null,
    };
    return toResult(bg, 'playing', 'active');
  },

  projectView(room: RoomEnvelope) {
    // Backgammon is fully public — no hidden information to hide.
    return { state: room.state };
  },
};
