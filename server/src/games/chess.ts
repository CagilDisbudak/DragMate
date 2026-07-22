/**
 * Authoritative chess module. chess.js is the entire game state; the server
 * validates every move against the stored FEN — a client can no longer inject
 * an arbitrary position (the central client-trust hole in the old code).
 *
 * Seat mapping: seat 0 = white ('w'), seat 1 = black ('b').
 */
import { Chess } from 'chess.js';
import type { ApplyResult, ChessGameState, RoomEnvelope } from '../types.js';
import { GameError, type GameModule, type InitResult } from './GameModule.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const seatToColor = (seat: number): 'w' | 'b' => (seat === 0 ? 'w' : 'b');
const turnToSeat = (turn: 'w' | 'b'): number => (turn === 'w' ? 0 : 1);

interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

function parseMove(move: unknown): ChessMove {
  if (!move || typeof move !== 'object') throw new GameError('bad_move', 'Move payload missing');
  const m = move as Record<string, unknown>;
  if (typeof m.from !== 'string' || typeof m.to !== 'string') {
    throw new GameError('bad_move', 'Move must have string from/to');
  }
  return {
    from: m.from,
    to: m.to,
    promotion: typeof m.promotion === 'string' ? m.promotion : undefined,
  };
}

function evaluate(game: Chess): Pick<ApplyResult, 'phase' | 'winner' | 'status' | 'currentTurn'> {
  const turn = game.turn() as 'w' | 'b';
  if (game.isCheckmate()) {
    // Side to move is checkmated → the other side won.
    return { phase: 'gameOver', winner: turnToSeat(turn) === 0 ? 1 : 0, status: 'checkmate', currentTurn: turnToSeat(turn) };
  }
  if (game.isStalemate()) {
    return { phase: 'gameOver', winner: null, status: 'stalemate', currentTurn: turnToSeat(turn) };
  }
  if (game.isDraw()) {
    return { phase: 'gameOver', winner: null, status: 'draw', currentTurn: turnToSeat(turn) };
  }
  return { phase: 'playing', winner: null, status: 'active', currentTurn: turnToSeat(turn) };
}

export const chessModule: GameModule = {
  type: 'chess',
  maxSeats: 2,
  hasWaitingRoom: false,
  aiDelayMs: 500,

  init(): InitResult {
    const state: ChessGameState = { kind: 'chess', fen: START_FEN };
    return { state, currentTurn: 0, phase: 'playing' };
  },

  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult {
    if (room.state.kind !== 'chess') throw new GameError('bad_state', 'Not a chess room');
    if (room.phase !== 'playing') throw new GameError('not_active', 'Game is not active');

    const game = new Chess(room.state.fen);
    const sideToMove = game.turn() as 'w' | 'b';
    if (seatToColor(seat) !== sideToMove) {
      throw new GameError('not_your_turn', 'It is not your turn');
    }

    const { from, to, promotion } = parseMove(move);
    let applied;
    try {
      applied = game.move({ from, to, promotion: promotion || 'q' });
    } catch {
      applied = null;
    }
    if (!applied) throw new GameError('illegal_move', 'Illegal move');

    const evalr = evaluate(game);
    const state: ChessGameState = { kind: 'chess', fen: game.fen() };
    return {
      state,
      currentTurn: evalr.currentTurn,
      phase: evalr.phase,
      winner: evalr.winner,
      status: evalr.status,
      lastMove: { from: applied.from, to: applied.to, san: applied.san },
    };
  },

  aiTurn(room: RoomEnvelope): ApplyResult {
    if (room.state.kind !== 'chess') throw new GameError('bad_state', 'Not a chess room');
    const game = new Chess(room.state.fen);
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) {
      const evalr = evaluate(game);
      return { state: room.state, ...evalr };
    }
    const pick = moves[Math.floor(Math.random() * moves.length)];
    return this.applyMove(room, turnToSeat(game.turn() as 'w' | 'b'), {
      from: pick.from,
      to: pick.to,
      promotion: pick.promotion,
    });
  },

  resign(room: RoomEnvelope, seat: number): ApplyResult {
    return {
      state: room.state,
      currentTurn: room.currentTurn,
      phase: 'gameOver',
      winner: seat === 0 ? 1 : 0,
      status: 'resigned',
    };
  },

  rematch(): ApplyResult {
    const state: ChessGameState = { kind: 'chess', fen: START_FEN };
    return { state, currentTurn: 0, phase: 'playing', winner: null, status: 'active' };
  },

  projectView(room: RoomEnvelope) {
    // Chess has no hidden information — everyone sees the full position.
    return { state: room.state };
  },
};
