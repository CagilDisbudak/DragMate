/**
 * A game module encapsulates ALL authoritative rules for one game:
 * dealing/RNG, move validation, turn advancement, win detection, AI, and the
 * per-seat view projection. The room manager is game-agnostic and only talks
 * to modules through this interface.
 */
import type { ApplyResult, GameState, GameType, RoomEnvelope, RoomPhase } from '../types.js';

/** Thrown by a module when an intent is illegal. Carries a client-facing code. */
export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'GameError';
  }
}

export interface InitResult {
  state: GameState;
  currentTurn: number;
  phase: RoomPhase;
}

export interface GameModule {
  readonly type: GameType;
  readonly maxSeats: number;
  /** okey/101 open in a 'waiting' lobby that the host must start; chess/bg start immediately. */
  readonly hasWaitingRoom: boolean;
  /** Cosmetic AI think delay in ms. */
  readonly aiDelayMs: number;

  /** Build the starting state for a fresh room (before/at creation). */
  init(room: Pick<RoomEnvelope, 'aiDifficulty' | 'seats'>): InitResult;

  /**
   * Host pressed "start" (okey/101): fill empty seats with AI, deal, begin.
   * chess/bg don't use a waiting room, so this is optional.
   */
  start?(room: RoomEnvelope): ApplyResult;

  /** Apply a validated move by `seat`. Throws GameError on any illegal intent. */
  applyMove(room: RoomEnvelope, seat: number, move: unknown): ApplyResult;

  /** Perform the current AI seat's full turn. Called by the turn scheduler. */
  aiTurn(room: RoomEnvelope): ApplyResult;

  /** Seat resigns; derive winner from the seat, never from the client. */
  resign(room: RoomEnvelope, seat: number): ApplyResult;

  /** Reset for a rematch / next round. */
  rematch(room: RoomEnvelope): ApplyResult;

  /**
   * Project the state for a specific seat (-1 = spectator). Hides hidden info
   * (opponent racks, draw-pile order) for okey/101; full state for chess/bg.
   * Returns `{ state, hints? }`.
   */
  projectView(room: RoomEnvelope, seat: number): { state: unknown; hints?: unknown };
}
