/**
 * Room persistence behind a small interface so the in-memory implementation can
 * be swapped for Redis later (Phase: scale) with a one-file change. The
 * `version` field on the envelope is the optimistic-concurrency token that a
 * Redis CAS would key off of.
 */
import type { RoomEnvelope } from './types.js';

export interface RoomStore {
  get(roomId: string): RoomEnvelope | undefined;
  set(room: RoomEnvelope): void;
  delete(roomId: string): void;
  has(roomId: string): boolean;
  all(): RoomEnvelope[];
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, RoomEnvelope>();

  get(roomId: string): RoomEnvelope | undefined {
    return this.rooms.get(roomId);
  }
  set(room: RoomEnvelope): void {
    this.rooms.set(room.roomId, room);
  }
  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }
  has(roomId: string): boolean {
    return this.rooms.has(roomId);
  }
  all(): RoomEnvelope[] {
    return [...this.rooms.values()];
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

/** Allocate a collision-free 6-char room id. */
export function allocateRoomId(store: RoomStore): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!store.has(id)) return id;
  }
  throw new Error('Could not allocate a unique room id');
}
