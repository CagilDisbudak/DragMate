/**
 * Game-agnostic room lifecycle + authority. Owns seat assignment, the monotonic
 * version, per-seat view broadcasting, and the server-side AI turn scheduler.
 * All game-specific rules are delegated to the game module.
 */
import type { Server, Socket } from 'socket.io';
import type { ApplyResult, AiDifficulty, GameType, RoomEnvelope, Seat } from './types.js';
import { allocateRoomId, type RoomStore } from './store.js';
import { getModule } from './games/registry.js';
import { GameError, type GameModule } from './games/GameModule.js';
import { EV, type RoomView, type Ack } from './protocol.js';

const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // abandoned rooms self-expire after 4h

function emptySeats(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => ({
    seatIndex: i,
    userId: null,
    displayName: '',
    isAI: false,
    connected: false,
    lastSeenAt: 0,
  }));
}

export class RoomManager {
  private aiTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private io: Server, private store: RoomStore) {}

  // ---- helpers --------------------------------------------------------------

  private module(gameType: GameType): GameModule {
    const m = getModule(gameType);
    if (!m) throw new GameError('unsupported_game', `Game "${gameType}" is not on the server yet`);
    return m;
  }

  private seatOf(room: RoomEnvelope, userId: string | null): number {
    if (!userId) return -1;
    const seat = room.seats.find((s) => s.userId === userId);
    return seat ? seat.seatIndex : -1;
  }

  private buildView(room: RoomEnvelope, seat: number): RoomView {
    const mod = this.module(room.gameType);
    const projected = mod.projectView(room, seat);
    return {
      roomId: room.roomId,
      gameType: room.gameType,
      version: room.version,
      phase: room.phase,
      status: room.status,
      seats: room.seats,
      hostUserId: room.hostUserId,
      currentTurn: room.currentTurn,
      winner: room.winner,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lastMove: room.lastMove,
      yourSeat: seat,
      state: projected.state,
      hints: projected.hints,
    };
  }

  /** Push a freshly-projected view to every socket subscribed to the room. */
  private async broadcast(room: RoomEnvelope): Promise<void> {
    const sockets = await this.io.in(room.roomId).fetchSockets();
    for (const s of sockets) {
      const uid = (s.data as { userId?: string }).userId ?? null;
      s.emit(EV.view, this.buildView(room, this.seatOf(room, uid)));
    }
  }

  private commit(room: RoomEnvelope, result: ApplyResult): void {
    room.state = result.state;
    room.currentTurn = result.currentTurn;
    room.phase = result.phase;
    room.winner = result.winner;
    room.status = result.status;
    if ('lastMove' in result) room.lastMove = result.lastMove;
    room.version += 1;
    room.updatedAt = Date.now();
    this.store.set(room);
  }

  private async commitAndBroadcast(room: RoomEnvelope, result: ApplyResult): Promise<void> {
    this.commit(room, result);
    await this.broadcast(room);
    this.maybeScheduleAI(room);
  }

  // ---- AI scheduler ---------------------------------------------------------

  private maybeScheduleAI(room: RoomEnvelope): void {
    this.clearAI(room.roomId);
    if (room.phase !== 'playing') return;
    const seat = room.seats[room.currentTurn];
    if (!seat || !seat.isAI) return;
    const mod = this.module(room.gameType);
    const timer = setTimeout(() => this.runAITurn(room.roomId), mod.aiDelayMs);
    this.aiTimers.set(room.roomId, timer);
  }

  private clearAI(roomId: string): void {
    const t = this.aiTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.aiTimers.delete(roomId);
    }
  }

  private async runAITurn(roomId: string): Promise<void> {
    this.aiTimers.delete(roomId);
    const room = this.store.get(roomId);
    if (!room || room.phase !== 'playing') return;
    const seat = room.seats[room.currentTurn];
    if (!seat || !seat.isAI) return; // idempotency guard (survives double-fire)
    const mod = this.module(room.gameType);
    try {
      const result = mod.aiTurn(room);
      await this.commitAndBroadcast(room, result);
    } catch (err) {
      console.error(`AI turn failed in room ${roomId}:`, err);
    }
  }

  // ---- lifecycle ops --------------------------------------------------------

  createRoom(
    userId: string,
    gameType: GameType,
    displayName: string,
    aiDifficulty: AiDifficulty,
  ): RoomEnvelope {
    const mod = this.module(gameType);
    const roomId = allocateRoomId(this.store);
    const now = Date.now();
    const seats = emptySeats(mod.maxSeats);
    seats[0] = { seatIndex: 0, userId, displayName: displayName || 'Player 1', isAI: false, connected: true, lastSeenAt: now };

    const init = mod.init({ aiDifficulty, seats });
    const room: RoomEnvelope = {
      roomId,
      gameType,
      version: 1,
      phase: init.phase,
      seats,
      hostUserId: userId,
      currentTurn: init.currentTurn,
      winner: null,
      status: init.phase === 'playing' ? 'active' : 'waiting',
      aiDifficulty,
      createdAt: now,
      updatedAt: now,
      state: init.state,
    };
    this.store.set(room);
    return room;
  }

  joinRoom(userId: string, roomId: string, displayName: string): RoomEnvelope {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');

    // Reclaim an existing seat (reconnect) if this user already has one.
    const existing = room.seats.find((s) => s.userId === userId);
    if (existing) {
      existing.connected = true;
      existing.lastSeenAt = Date.now();
      if (displayName) existing.displayName = displayName;
      this.store.set(room);
      return room;
    }

    if (room.phase !== 'waiting' && room.phase !== 'playing') {
      throw new GameError('not_joinable', 'Game already finished');
    }
    const mod = this.module(room.gameType);
    if (mod.hasWaitingRoom && room.phase !== 'waiting') {
      throw new GameError('already_started', 'Game already started');
    }
    const free = room.seats.find((s) => !s.userId && !s.isAI);
    if (!free) throw new GameError('room_full', 'Room is full');

    free.userId = userId;
    free.displayName = displayName || `Player ${free.seatIndex + 1}`;
    free.connected = true;
    free.lastSeenAt = Date.now();
    room.version += 1;
    room.updatedAt = Date.now();
    this.store.set(room);
    return room;
  }

  async startRoom(userId: string, roomId: string): Promise<void> {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');
    if (room.hostUserId !== userId) throw new GameError('not_host', 'Only the host can start');
    if (room.phase !== 'waiting') throw new GameError('already_started', 'Already started');
    const mod = this.module(room.gameType);
    if (!mod.start) throw new GameError('no_start', 'This game starts automatically');
    const result = mod.start(room);
    await this.commitAndBroadcast(room, result);
  }

  async makeMove(userId: string, roomId: string, move: unknown, expectedVersion?: number): Promise<number> {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');
    if (expectedVersion !== undefined && expectedVersion !== room.version) {
      throw new GameError('stale', 'State changed, retry');
    }
    const seat = this.seatOf(room, userId);
    if (seat === -1) throw new GameError('not_seated', 'You are not a player in this room');
    if (room.currentTurn !== seat) throw new GameError('not_your_turn', 'It is not your turn');

    const mod = this.module(room.gameType);
    const result = mod.applyMove(room, seat, move);
    await this.commitAndBroadcast(room, result);
    return room.version;
  }

  async resign(userId: string, roomId: string): Promise<void> {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');
    const seat = this.seatOf(room, userId);
    if (seat === -1) throw new GameError('not_seated', 'You are not a player in this room');
    const mod = this.module(room.gameType);
    this.clearAI(roomId);
    await this.commitAndBroadcast(room, mod.resign(room, seat));
  }

  async rematch(userId: string, roomId: string): Promise<void> {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');
    if (this.seatOf(room, userId) === -1) throw new GameError('not_seated', 'You are not a player');
    const mod = this.module(room.gameType);
    this.clearAI(roomId);
    await this.commitAndBroadcast(room, mod.rematch(room));
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const room = this.store.get(roomId);
    if (!room) return;
    const seat = room.seats.find((s) => s.userId === userId);
    if (!seat) return;
    // Before a game starts, free the seat entirely; mid-game just mark disconnected
    // so the player can reconnect and reclaim their seat.
    if (room.phase === 'waiting') {
      seat.userId = null;
      seat.displayName = '';
      seat.connected = false;
    } else {
      seat.connected = false;
      seat.lastSeenAt = Date.now();
    }
    // If nobody human is left seated, drop the room.
    const anyHuman = room.seats.some((s) => s.userId && !s.isAI);
    if (!anyHuman) {
      this.clearAI(roomId);
      this.store.delete(roomId);
      return;
    }
    room.version += 1;
    room.updatedAt = Date.now();
    this.store.set(room);
    await this.broadcast(room);
  }

  // ---- socket wiring --------------------------------------------------------

  /** Attach socket to the room's channel and send it the current view. */
  async subscribe(socket: Socket, roomId: string): Promise<RoomEnvelope> {
    const room = this.store.get(roomId);
    if (!room) throw new GameError('room_not_found', 'Room not found');
    const userId = (socket.data as { userId?: string }).userId ?? null;
    await socket.join(roomId);
    const seat = room.seats.find((s) => s.userId === userId);
    if (seat) {
      seat.connected = true;
      seat.lastSeenAt = Date.now();
      this.store.set(room);
      await this.broadcast(room);
    } else {
      socket.emit(EV.view, this.buildView(room, this.seatOf(room, userId)));
    }
    return room;
  }

  /** Mark seats belonging to a disconnected socket as offline (allow reclaim). */
  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = (socket.data as { userId?: string }).userId ?? null;
    if (!userId) return;
    for (const room of this.store.all()) {
      const seat = room.seats.find((s) => s.userId === userId);
      if (!seat) continue;
      // Another live socket for the same user? Then still connected.
      const otherSockets = await this.io.in(room.roomId).fetchSockets();
      const stillHere = otherSockets.some(
        (s) => s.id !== socket.id && (s.data as { userId?: string }).userId === userId,
      );
      if (stillHere) continue;
      seat.connected = false;
      seat.lastSeenAt = Date.now();
      this.store.set(room);
      await this.broadcast(room);
    }
  }

  /** Periodic sweep of expired/abandoned rooms. */
  sweep(): void {
    const now = Date.now();
    for (const room of this.store.all()) {
      if (now - room.updatedAt > ROOM_TTL_MS) {
        this.clearAI(room.roomId);
        this.store.delete(room.roomId);
      }
    }
  }
}

/** Uniform ack builder for GameError / unknown errors. */
export function errorAck(err: unknown): Ack {
  if (err instanceof GameError) return { ok: false, error: err.message, code: err.code };
  console.error('Unexpected error:', err);
  return { ok: false, error: 'Server error', code: 'internal' };
}
