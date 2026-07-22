import { io, type Socket } from 'socket.io-client';

/**
 * Singleton Socket.IO client for the authoritative DragMate backend.
 *
 * The backend URL comes from VITE_WS_URL at build time. For the gh-pages
 * production build this must be set to the Render service URL (https://...),
 * which upgrades to WSS automatically. In dev it defaults to localhost:4000.
 */

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'http://localhost:4000';

/** Whether an online backend is configured (always true — falls back to localhost in dev). */
export const backendConfigured = true;
export const backendUrl = WS_URL;

const SESSION_KEY = 'dragmate_session';

/** Durable, per-browser identity. Persisted so a refresh reclaims the same seat. */
export function getSessionToken(): string {
  let token = localStorage.getItem(SESSION_KEY);
  if (!token) {
    token = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(SESSION_KEY, token);
  }
  return token;
}

export const getUserId = getSessionToken;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      auth: { token: getSessionToken() },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

// ---- ack protocol ------------------------------------------------------------

export type Ack<T = unknown> =
  | { ok: true; version: number; data?: T }
  | { ok: false; error: string; code?: string };

/** Wire event names (mirror of server/src/protocol.ts). */
export const EV = {
  create: 'room:create',
  join: 'room:join',
  leave: 'room:leave',
  start: 'room:start',
  subscribe: 'room:subscribe',
  move: 'game:move',
  resign: 'game:resign',
  rematch: 'game:rematch',
  view: 'room:view',
  error: 'room:error',
  presence: 'presence:count',
} as const;

/** Emit an event and resolve with the server's ack (10s timeout guard). */
export function emitAck<T = unknown>(event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const s = getSocket();
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ ok: false, error: 'Timed out — is the server awake?', code: 'timeout' });
      }
    }, 12000);
    s.emit(event, payload, (ack: Ack<T>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ack ?? { ok: false, error: 'No response', code: 'no_ack' });
    });
  });
}

/** Shape of the per-seat snapshot the server pushes on room:view. */
export interface RoomView {
  roomId: string;
  gameType: 'chess' | 'backgammon' | 'okey' | '101';
  version: number;
  phase: 'waiting' | 'playing' | 'roundOver' | 'gameOver';
  status: string;
  seats: {
    seatIndex: number;
    userId: string | null;
    displayName: string;
    isAI: boolean;
    connected: boolean;
    lastSeenAt: number;
  }[];
  hostUserId: string | null;
  currentTurn: number;
  winner: number | null;
  createdAt: number;
  updatedAt: number;
  lastMove?: unknown;
  yourSeat: number;
  state: unknown;
  hints?: unknown;
}
