/**
 * DragMate authoritative game server.
 * Express (health check) + Socket.IO (real-time game protocol) on one HTTP server.
 */
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { InMemoryRoomStore } from './store.js';
import { RoomManager, errorAck } from './roomManager.js';
import { EV, type CreateRoomPayload, type JoinRoomPayload, type MovePayload, type RoomIdPayload } from './protocol.js';
import type { AiDifficulty, GameType } from './types.js';
import { supportedGames } from './games/registry.js';

const PORT = Number(process.env.PORT) || 4000;

// Allowed browser origins for CORS. gh-pages + local dev by default; extend via env.
const DEFAULT_ORIGINS = [
  'https://cagildisbudak.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];
const ORIGINS = (process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : []
).concat(DEFAULT_ORIGINS);

const app = express();
app.use(cors({ origin: ORIGINS }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, games: supportedGames(), uptime: process.uptime() });
});
app.get('/', (_req, res) => {
  res.type('text').send('DragMate game server. WebSocket only. See /healthz.');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGINS, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

const store = new InMemoryRoomStore();
const manager = new RoomManager(io, store);

function broadcastPresence(): void {
  io.emit(EV.presence, { count: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  // Durable identity: the client generates a token and persists it in localStorage.
  const token =
    (socket.handshake.auth as { token?: string } | undefined)?.token ??
    (socket.handshake.query.token as string | undefined);
  socket.data.userId = token && typeof token === 'string' ? token : `anon-${socket.id}`;

  broadcastPresence();

  // On-demand pull: lets a client that missed the connect-time broadcast
  // (handler attached late) fetch the count instead of waiting forever.
  socket.on(EV.presenceGet, (ack?: (a: unknown) => void) => {
    ack?.({ count: io.engine.clientsCount });
  });

  socket.on(EV.create, async (payload: CreateRoomPayload, ack?: (a: unknown) => void) => {
    try {
      const userId = socket.data.userId as string;
      const gameType = payload.gameType as GameType;
      const difficulty = (payload.aiDifficulty ?? 'Normal') as AiDifficulty;
      const room = manager.createRoom(userId, gameType, payload.displayName ?? '', difficulty);
      await manager.subscribe(socket, room.roomId);
      ack?.({ ok: true, version: room.version, data: { roomId: room.roomId } });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.join, async (payload: JoinRoomPayload, ack?: (a: unknown) => void) => {
    try {
      const userId = socket.data.userId as string;
      const room = manager.joinRoom(userId, payload.roomId, payload.displayName ?? '');
      await manager.subscribe(socket, room.roomId);
      ack?.({ ok: true, version: room.version, data: { roomId: room.roomId } });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.subscribe, async (payload: RoomIdPayload, ack?: (a: unknown) => void) => {
    try {
      const room = await manager.subscribe(socket, payload.roomId);
      ack?.({ ok: true, version: room.version });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.start, async (payload: RoomIdPayload, ack?: (a: unknown) => void) => {
    try {
      await manager.startRoom(socket.data.userId as string, payload.roomId);
      ack?.({ ok: true, version: store.get(payload.roomId)?.version ?? 0 });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.move, async (payload: MovePayload, ack?: (a: unknown) => void) => {
    try {
      const version = await manager.makeMove(
        socket.data.userId as string,
        payload.roomId,
        payload.move,
        payload.expectedVersion,
      );
      ack?.({ ok: true, version });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.resign, async (payload: RoomIdPayload, ack?: (a: unknown) => void) => {
    try {
      await manager.resign(socket.data.userId as string, payload.roomId);
      ack?.({ ok: true, version: store.get(payload.roomId)?.version ?? 0 });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.rematch, async (payload: RoomIdPayload, ack?: (a: unknown) => void) => {
    try {
      await manager.rematch(socket.data.userId as string, payload.roomId);
      ack?.({ ok: true, version: store.get(payload.roomId)?.version ?? 0 });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on(EV.leave, async (payload: RoomIdPayload, ack?: (a: unknown) => void) => {
    try {
      await manager.leaveRoom(socket.data.userId as string, payload.roomId);
      await socket.leave(payload.roomId);
      ack?.({ ok: true, version: 0 });
    } catch (err) {
      ack?.(errorAck(err));
    }
  });

  socket.on('disconnect', async () => {
    await manager.handleDisconnect(socket);
    broadcastPresence();
  });
});

// Periodically drop abandoned rooms.
setInterval(() => manager.sweep(), 30 * 60 * 1000);

// Presence heartbeat: catches any client that missed an event-driven update.
setInterval(() => broadcastPresence(), 30 * 1000);

httpServer.listen(PORT, () => {
  console.log(`✅ DragMate server listening on :${PORT}`);
  console.log(`   Games: ${supportedGames().join(', ') || '(none yet)'}`);
  console.log(`   Allowed origins: ${ORIGINS.join(', ')}`);
});
