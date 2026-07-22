/**
 * Socket.IO wire protocol: event names and payload shapes shared conceptually
 * with the client (the client keeps its own copy of these shapes).
 */
import type { GameType, RoomPhase, Seat, AiDifficulty } from './types.js';

// ---- client -> server events -------------------------------------------------

export interface CreateRoomPayload {
  gameType: GameType;
  displayName?: string;
  aiDifficulty?: AiDifficulty;
}
export interface JoinRoomPayload {
  roomId: string;
  displayName?: string;
}
export interface RoomIdPayload {
  roomId: string;
}
export interface MovePayload {
  roomId: string;
  /** Optional optimistic-concurrency guard; stale versions are rejected. */
  expectedVersion?: number;
  /** Game-specific move intent (validated server-side). */
  move: unknown;
}

// ---- server -> client events -------------------------------------------------

/** What a seat's socket receives after every applied mutation. */
export interface RoomView {
  roomId: string;
  gameType: GameType;
  version: number;
  phase: RoomPhase;
  status: string;
  seats: Seat[];
  hostUserId: string | null;
  currentTurn: number;
  winner: number | null;
  createdAt: number;
  updatedAt: number;
  lastMove?: unknown;
  /** The seat index of the recipient, or -1 for a spectator. */
  yourSeat: number;
  /** Public + this-seat-private game state (projected by the game module). */
  state: unknown;
  /** Optional per-seat hints (e.g. backgammon legal moves for the active seat). */
  hints?: unknown;
}

/** Ack returned to the caller of a mutating event. */
export type Ack<T = unknown> =
  | { ok: true; version: number; data?: T }
  | { ok: false; error: string; code?: string };

// ---- event name constants ----------------------------------------------------

export const EV = {
  // client -> server
  hello: 'client:hello',
  create: 'room:create',
  join: 'room:join',
  leave: 'room:leave',
  start: 'room:start',
  subscribe: 'room:subscribe',
  move: 'game:move',
  resign: 'game:resign',
  rematch: 'game:rematch',
  // server -> client
  view: 'room:view',
  error: 'room:error',
  presence: 'presence:count',
  // client -> server (ack request): pull the current count on demand, so a
  // client that missed the connect-time broadcast never gets stuck loading
  presenceGet: 'presence:get',
} as const;
