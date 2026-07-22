/**
 * Core authoritative types shared by every game module.
 *
 * The server holds one `RoomEnvelope` per room. The envelope is the part that is
 * common to all games (seats, turn, phase, version); `state` is a discriminated
 * union owned by the individual game module.
 */

export type GameType = 'chess' | 'backgammon' | 'okey' | '101';
export type RoomPhase = 'waiting' | 'playing' | 'roundOver' | 'gameOver';
export type AiDifficulty = 'Easy' | 'Normal' | 'Hard';

/** A seat at the table. Seat index maps to a game-specific color/slot. */
export interface Seat {
  seatIndex: number;
  /** Durable session id of the occupant, or null when empty. */
  userId: string | null;
  displayName: string;
  isAI: boolean;
  /** Whether a live socket for this occupant is currently connected. */
  connected: boolean;
  lastSeenAt: number;
}

// ---------------------------------------------------------------------------
// Game-specific state payloads (discriminated by `kind`).
// Okey/101 payloads keep native nested arrays — no Firestore map workarounds.
// ---------------------------------------------------------------------------

export interface ChessGameState {
  kind: 'chess';
  fen: string;
}

export interface BackgammonGameState {
  kind: 'backgammon';
  board: number[]; // 24 points; >0 = N white checkers, <0 = N black checkers
  bar: { white: number; black: number };
  off: { white: number; black: number };
  dice: number[];
  movesLeft: number[];
}

export type OkeyColor = 'red' | 'black' | 'blue' | 'yellow';
export interface OkeyTile {
  id: string;
  value: number;
  color: OkeyColor | null;
  isFakeOkey?: boolean;
}

export interface OkeyGameStatePayload {
  kind: 'okey';
  centerStack: OkeyTile[];
  discardPiles: OkeyTile[][];
  indicatorTile: OkeyTile | null;
  okeyTile: OkeyTile | null;
  /** Per-seat racks. Server-private — never sent whole to clients. */
  hands: (OkeyTile | null)[][];
}

export interface Meld {
  id: string;
  tiles: OkeyTile[];
  type: 'set' | 'run';
  ownerPlayer: number;
}

export interface Player101Slot {
  tiles: (OkeyTile | null)[];
  score: number;
  hasLaidDown: boolean;
}

/** Mirrors the client's Game101State (plus `kind`) so the pure engine ports 1:1. */
export interface Game101StatePayload {
  kind: '101';
  phase: 'dealing' | 'playing' | 'roundOver' | 'gameOver';
  players: Player101Slot[];
  centerStack: OkeyTile[];
  discardPiles: OkeyTile[][];
  indicatorTile: OkeyTile | null;
  okeyTile: OkeyTile | null;
  tableMelds: { [key: string]: Meld };
  currentTurn: number;
  roundWinner: number | null;
  gameWinner: number | null;
  roundNumber: number;
  /** Whether the current player has already drawn this turn (draw → meld → discard). */
  drawnThisTurn: boolean;
}

export type GameState =
  | ChessGameState
  | BackgammonGameState
  | OkeyGameStatePayload
  | Game101StatePayload;

/** The authoritative record the server holds for a room. */
export interface RoomEnvelope {
  roomId: string;
  gameType: GameType;
  /** Monotonic; bumped on every applied mutation. Replaces Firestore transactions. */
  version: number;
  phase: RoomPhase;
  seats: Seat[];
  hostUserId: string | null;
  /** Seat index whose turn it is. */
  currentTurn: number;
  /** Winning seat index, or null. */
  winner: number | null;
  /** Game-specific terminal reason: 'checkmate' | 'resigned' | 'draw' | ... */
  status: string;
  aiDifficulty: AiDifficulty;
  createdAt: number;
  updatedAt: number;
  /** Last applied move, for animation/audit. */
  lastMove?: unknown;
  state: GameState;
}

/**
 * A patch produced by a game module after applying a move / AI turn / resign.
 * The room manager applies it to the envelope and bumps `version`.
 */
export interface ApplyResult {
  state: GameState;
  currentTurn: number;
  phase: RoomPhase;
  winner: number | null;
  status: string;
  lastMove?: unknown;
}
