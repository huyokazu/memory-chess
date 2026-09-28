import 'dotenv/config';
import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import { z } from 'zod';
import User, { publicUser } from './models/User.js';
import Match from './models/Match.js';
import { settleRating, recoverMatches } from './lib/ratings.js';
import { StockfishEngine } from './lib/stockfish.js';
import { TURN_MS, MAX_PEEKS, BOT_LEVELS, MODES, GameError, ensure, opposite, enablePeek, applyMove } from './lib/rules.js';
import { mountWeb } from './web.js';

const modeInput = z.object({ mode: z.enum(MODES) });
const roomInput = z.object({ roomId: z.string().uuid() });
const moveInput = roomInput.extend({
  from: z.string().regex(/^[a-h][1-8]$/), to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});
const credentials = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  password: z.string().min(8).refine((value) => Buffer.byteLength(value) <= 72),
});
const JWT_OPTIONS = { issuer: 'memory-chess', audience: 'memory-chess-app', algorithm: 'HS256' };
const WAITING_TTL = 10 * 60_000;
const FINISHED_TTL = 10 * 60_000;

export function createBackend({
  secret = process.env.JWT_SECRET,
  origins = (process.env.CLIENT_ORIGINS || 'http://localhost:8081,http://localhost:5173').split(',').map((s) => s.trim()),
  publicClientUrl = process.env.PUBLIC_CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:8081',
  webDist = process.env.SERVE_WEB === 'true' ? process.env.WEB_DIST || fileURLToPath(new URL('../../client/dist/', import.meta.url)) : null,
  trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0),
  now = Date.now,
  maxBotGames = Number(process.env.MAX_BOT_GAMES || 4),
  engineFactory = (elo) => new StockfishEngine(elo),
} = {}) {
  if (!secret || secret.length < 32 || secret.startsWith('replace-this')) {
    throw new Error('JWT_SECRET must contain at least 32 characters and must not be the example value.');
  }
  const app = express();
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
  app.set('trust proxy', trustProxyHops);
  const httpServer = createServer(app);
  const allowedOrigins = [...new Set([...origins.filter(Boolean), new URL(publicClientUrl).origin])];
  const originAllowed = (origin) => !origin || allowedOrigins.includes(origin);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    connectSrc: ["'self'", 'https:', 'wss:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:', 'ws:'])],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  } } }));
  app.use(cors({ origin(origin, callback) { callback(null, originAllowed(origin)); } }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  const authLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Thử lại sau ít phút.' } },
  });
  const verify = (token) => jwt.verify(token, secret, {
    issuer: JWT_OPTIONS.issuer, audience: JWT_OPTIONS.audience, algorithms: ['HS256'],
  });
  const issue = (user) => ({
    token: jwt.sign({}, secret, { ...JWT_OPTIONS, subject: String(user._id), expiresIn: '7d' }),
    user: publicUser(user),
  });
  const authenticate = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const claims = verify(token);
      req.user = await User.findById(claims.sub);
      if (!req.user) throw new Error('Missing user');
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập lại.' } });
    }
  };

  app.get('/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    ok: mongoose.connection.readyState === 1, service: 'memory-chess', turnSeconds: 60,
  }));
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await User.create({ username: input.username, passwordHash: await bcrypt.hash(input.password, 12) });
    res.status(201).json(issue(user));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await User.findOne({ username: input.username }).select('+passwordHash');
    if (!user || !await bcrypt.compare(input.password, user.passwordHash)) {
      return res.status(401).json({ error: { code: 'INVALID_LOGIN', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' } });
    }
    res.json(issue(user));
  });
  app.get('/api/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
  app.get('/api/leaderboard', authenticate, async (req, res) => {
    const users = await User.find().sort({ elo: -1, wins: -1, username: 1 }).limit(30);
    res.json({ users: users.map(publicUser) });
  });
  app.get('/api/matches', authenticate, async (req, res) => {
    const id = String(req.user._id);
    const matches = await Match.find({
      $or: [{ 'white.id': id }, { 'black.id': id }], status: { $ne: 'active' },
    }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ matches });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API không tồn tại.' } }));
  mountWeb(app, webDist);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu không hợp lệ. Username: 3–24 ký tự a-z, 0-9, _. Mật khẩu: ít nhất 8 ký tự, tối đa 72 byte.' } });
    if (error.code === 11000) return res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'Tên đăng nhập đã được sử dụng.' } });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON không hợp lệ.' } });
    console.error(error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Server chưa thể xử lý yêu cầu.' } });
  });

  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, originAllowed(req.headers.origin)),
    maxHttpBufferSize: 8192,
  });
  const rooms = new Map();
  const codes = new Map();
  const queue = new Map();
  const occupied = new Map();
  const sockets = new Map();
  const actionLocks = new Set();
  let stopping = false;

  const getSocket = (id) => io.sockets.sockets.get(sockets.get(id));
  const player = (user) => ({ id: user.id, username: user.username, elo: user.elo, bot: false });
  const colorOf = (room, id) => room.players.w?.id === id ? 'w' : room.players.b?.id === id ? 'b' : null;

  function snapshot(room, id) {
    const color = colorOf(room, id);
    return {
      id: room.id, code: room.code || null, mode: room.mode, kind: room.kind, rated: room.rated,
      status: room.status, players: room.players, color,
      fen: room.chess.fen(), ply: room.ply, turn: room.chess.turn(), lastMove: room.lastMove || null,
      deadline: room.deadline, serverNow: now(), turnMs: TURN_MS,
      remainingMs: room.status === 'active' ? Math.max(0, room.deadline - now()) : 0,
      visible: room.ply === 0 || room.status === 'finished' || Boolean(color && room.peeks[color].active),
      peek: color ? { ...room.peeks[color] } : null,
      result: room.result || null,
      connected: { w: Boolean(room.players.w?.bot || getSocket(room.players.w?.id)), b: Boolean(room.players.b?.bot || getSocket(room.players.b?.id)) },
    };
  }

  function broadcast(room, event = 'game:state') {
    for (const p of Object.values(room.players)) {
      if (p && !p.bot) getSocket(p.id)?.emit(event, snapshot(room, p.id));
    }
  }

  function assertFree(id) {
    ensure(!stopping, 'SHUTTING_DOWN', 'Server đang khởi động lại.');
    ensure(!occupied.has(id) && !queue.has(id), 'ALREADY_BUSY', 'Bạn đang ở phòng hoặc đang tìm trận.');
  }

  function removeRoom(room) {
    clearTimeout(room.timer);
    clearTimeout(room.openingTimer);
    room.engine?.close();
    rooms.delete(room.id);
    if (room.code) codes.delete(room.code);
    for (const p of Object.values(room.players)) {
      if (p && !p.bot) {
        if (occupied.get(p.id) === room.id) occupied.delete(p.id);
        getSocket(p.id)?.leave(room.id);
      }
    }
  }

  function newRoom(owner, mode, kind, code = null) {
    const room = {
      id: randomUUID(), code, mode, kind, rated: kind !== 'bot',
      status: 'waiting', players: { w: owner, b: null }, chess: new Chess(), ply: 0,
      peeks: { w: { remaining: MAX_PEEKS, active: false }, b: { remaining: MAX_PEEKS, active: false } },
      deadline: null, createdAt: now(), timer: null, engine: null, result: null,
    };
    rooms.set(room.id, room);
    occupied.set(owner.id, room.id);
    if (code) codes.set(code, room.id);
    getSocket(owner.id)?.join(room.id);
    return room;
  }

  function armClock(room) {
    clearTimeout(room.timer);
    if (room.status !== 'active') return;
    room.timer = setTimeout(() => {
      if (!expire(room)) armClock(room);
    }, Math.max(1, room.deadline - now()));
    room.timer.unref?.();
  }

  function expire(room) {
    if (room.status === 'active' && now() >= room.deadline) {
      finish(room, opposite(room.chess.turn()), 'timeout');
      return true;
    }
    return false;
  }

  function persistResult(room) {
    if (room.persisting) return room.persistence;
    if (room.persisted) return Promise.resolve();
    room.persisting = true;
    room.persistence = (async () => {
    try {
      let match = await Match.findOneAndUpdate({ _id: room.id, status: 'active' }, { $set: {
        status: room.result.reason === 'engine_error' ? 'aborted' : 'finished',
        winner: room.result.winner, reason: room.result.reason, pgn: room.chess.pgn(),
        finalFen: room.chess.fen(), finishedAt: new Date(room.finishedAt),
        ratingStatus: room.result.rated ? 'pending' : 'unrated',
      } }, { new: true });
      if (!match) match = await Match.findById(room.id);
      if (!match) throw new Error('Match ledger is missing');
      if (match.ratingStatus === 'pending') match = await settleRating(room.id);
      room.result.ratingChanges = match.ratingChanges;
      room.result.ratingStatus = match.ratingStatus;
      const humans = Object.values(room.players).filter((p) => !p.bot);
      const profiles = await Promise.all(humans.map((p) => User.findById(p.id)));
      room.persisted = true;
      for (const [index, p] of humans.entries()) {
        if (!p.bot) {
          if (occupied.get(p.id) === room.id) occupied.delete(p.id);
          const user = profiles[index];
          const socket = getSocket(p.id);
          if (socket && user) {
            socket.data.user = publicUser(user);
            socket.emit('profile', socket.data.user);
          }
        }
      }
      broadcast(room, 'game:over');
    } catch (error) {
      room.retryAt = now() + 3000;
      console.error(`Failed to persist result ${room.id}; will retry:`, error.message);
    } finally {
      room.persisting = false;
    }
    })();
    return room.persistence;
  }

  function finish(room, winner, reason) {
    if (room.status !== 'active') return;
    room.status = 'finished';
    room.finishedAt = now();
    clearTimeout(room.timer);
    clearTimeout(room.openingTimer);
    room.engine?.close();
    room.result = { winner, reason, rated: room.rated && reason !== 'engine_error', ratingChanges: null, ratingStatus: room.rated && reason !== 'engine_error' ? 'pending' : 'unrated' };
    broadcast(room);
    void persistResult(room);
  }

  async function botTurn(room) {
    const color = room.chess.turn();
    if (room.status !== 'active' || !room.players[color].bot || room.botThinking) return;
    room.botThinking = true;
    try {
      const moves = room.chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
      const move = await room.engine.bestMove(moves);
      if (room.status !== 'active' || expire(room)) return;
      const result = applyMove(room, color, move, now());
      if (result) finish(room, result.winner, result.reason);
      else { armClock(room); broadcast(room); }
    } catch (error) {
      if (room.status === 'active') {
        console.error('Bot error:', error.message);
        finish(room, null, 'engine_error');
      }
    } finally {
      room.botThinking = false;
    }
  }

  async function startRoom(room, guest) {
    ensure(room.status === 'waiting', 'ROOM_FULL', 'Phòng đã bắt đầu.');
    room.status = 'starting';
    room.players.b = guest;
    if (!guest.bot) { occupied.set(guest.id, room.id); getSocket(guest.id)?.join(room.id); }
    if (randomInt(2)) [room.players.w, room.players.b] = [room.players.b, room.players.w];
    if (room.code) codes.delete(room.code);
    broadcast(room);
    try {
      if (room.kind === 'bot') {
        room.engine = engineFactory(guest.elo);
        await room.engine.init();
      }
      await Match.create({ _id: room.id, mode: room.mode, kind: room.kind, rated: room.rated, white: room.players.w, black: room.players.b });
      room.status = 'active';
      room.deadline = now() + TURN_MS;
      armClock(room);
      broadcast(room);
      if (room.players.w.bot) {
        // Initial viewing time is part of the bot's normal 60-second turn.
        room.openingTimer = setTimeout(() => { void botTurn(room); }, 3000);
        room.openingTimer.unref?.();
      }
    } catch (error) {
      broadcast(room, 'room:failed');
      removeRoom(room);
      throw error;
    }
    return room;
  }

  function matchmaking() {
    if (stopping) return;
    const candidates = [...queue.values()].sort((a, b) => a.since - b.since);
    for (const first of candidates) {
      if (!queue.has(first.user.id)) continue;
      if (!getSocket(first.user.id)) { queue.delete(first.user.id); continue; }
      const range = (entry) => Math.min(1200, 100 + Math.floor((now() - entry.since) / 10_000) * 100);
      const possible = candidates.filter((second) => second.user.id !== first.user.id && queue.has(second.user.id)
        && second.mode === first.mode && getSocket(second.user.id)
        && Math.abs(second.user.elo - first.user.elo) <= Math.min(range(first), range(second)));
      if (!possible.length) continue;
      const second = possible[randomInt(possible.length)];
      queue.delete(first.user.id);
      queue.delete(second.user.id);
      const room = newRoom(player(first.user), first.mode, 'ranked');
      void startRoom(room, player(second.user)).catch((error) => console.error('Match start failed:', error.message));
    }
  }

  function tick() {
    matchmaking();
    for (const room of rooms.values()) {
      if (room.status === 'active') {
        if (!expire(room)) io.to(room.id).emit('game:clock', { roomId: room.id, turn: room.chess.turn(), deadline: room.deadline, serverNow: now(), remainingMs: Math.max(0, room.deadline - now()) });
      } else if (room.status === 'waiting' && now() - room.createdAt >= WAITING_TTL) {
        broadcast(room, 'room:closed'); removeRoom(room);
      } else if (room.status === 'finished') {
        if (!room.persisted && (!room.retryAt || now() >= room.retryAt)) void persistResult(room);
        if (room.persisted && now() - room.finishedAt >= FINISHED_TTL) removeRoom(room);
      }
    }
  }
  const interval = setInterval(tick, 250);
  interval.unref?.();

  io.use(async (socket, next) => {
    try {
      ensure(!stopping, 'SHUTTING_DOWN', 'Server đang khởi động lại.');
      const claims = verify(socket.handshake.auth?.token);
      const user = await User.findById(claims.sub);
      if (!user) throw new Error('Unknown user');
      socket.data.user = publicUser(user);
      next();
    } catch {
      const error = new Error('Vui lòng đăng nhập lại.');
      error.data = { code: 'UNAUTHORIZED' };
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const id = socket.data.user.id;
    const previous = getSocket(id);
    sockets.set(id, socket.id);
    if (previous && previous !== socket) {
      previous.emit('session:replaced');
      previous.disconnect(true);
    }
    socket.emit('profile', socket.data.user);
    if (queue.has(id)) socket.emit('queue:state', { searching: true, mode: queue.get(id).mode, since: queue.get(id).since });
    const currentRoom = rooms.get(occupied.get(id));
    if (currentRoom) {
      socket.join(currentRoom.id);
      expire(currentRoom);
      broadcast(currentRoom);
    } else {
      const recent = [...rooms.values()].reverse().find((room) => room.status === 'finished' && colorOf(room, id));
      if (recent) socket.emit('game:over', snapshot(recent, id));
    }
    let windowStart = now();
    let eventCount = 0;

    function on(event, schema, handler) {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        let locked = false;
        try {
          ensure(getSocket(id) === socket, 'SESSION_REPLACED', 'Phiên đăng nhập đã được thay thế.');
          if (now() - windowStart > 10_000) { windowStart = now(); eventCount = 0; }
          ensure(++eventCount <= 60, 'RATE_LIMIT', 'Bạn thao tác quá nhanh.');
          ensure(!actionLocks.has(id), 'ACTION_PENDING', 'Đợi thao tác trước hoàn tất.');
          const input = schema.parse(payload ?? {});
          actionLocks.add(id); locked = true;
          const data = await handler(input);
          reply({ ok: true, data: data ?? null });
        } catch (error) {
          const code = error instanceof z.ZodError ? 'INVALID_INPUT' : error.code || 'SERVER_ERROR';
          const message = error instanceof GameError ? error.message : error instanceof z.ZodError ? 'Dữ liệu không hợp lệ.' : 'Server chưa thể xử lý yêu cầu.';
          if (code === 'SERVER_ERROR') console.error(error);
          reply({ ok: false, error: { code, message } });
        } finally {
          if (locked) actionLocks.delete(id);
        }
      });
    }

    function ownedRoom(roomId, active = true) {
      const room = rooms.get(roomId);
      ensure(room && colorOf(room, id), 'ROOM_NOT_FOUND', 'Bạn không thuộc phòng này.');
      if (active) {
        expire(room);
        ensure(room.status === 'active', 'GAME_NOT_ACTIVE', 'Ván đấu chưa bắt đầu hoặc đã kết thúc.');
      }
      return room;
    }

    async function freshUser() {
      const user = await User.findById(id);
      ensure(user, 'UNAUTHORIZED', 'Tài khoản không tồn tại.');
      socket.data.user = publicUser(user);
      ensure(socket.connected && getSocket(id) === socket, 'DISCONNECTED', 'Kết nối đã đóng.');
      return socket.data.user;
    }

    on('match:find', modeInput, async ({ mode }) => {
      assertFree(id);
      const user = await freshUser();
      assertFree(id);
      queue.set(id, { user, mode, since: now() });
      socket.emit('queue:state', { searching: true, mode, since: now() });
      matchmaking();
      return { searching: queue.has(id) };
    });
    on('match:cancel', z.object({}), () => {
      ensure(!occupied.has(id), 'ALREADY_MATCHED', 'Đã tìm thấy đối thủ.');
      queue.delete(id);
      socket.emit('queue:state', { searching: false });
    });
    on('party:create', modeInput, async ({ mode }) => {
      assertFree(id);
      const user = await freshUser();
      assertFree(id);
      let code;
      do { code = String(randomInt(100_000, 1_000_000)); } while (codes.has(code));
      const room = newRoom(player(user), mode, 'party', code);
      broadcast(room);
      return { code, roomId: room.id, link: `${publicClientUrl.replace(/\/$/, '')}/?room=${code}` };
    });
    on('party:join', z.object({ code: z.string().regex(/^\d{6}$/) }), async ({ code }) => {
      assertFree(id);
      const user = await freshUser();
      assertFree(id);
      const room = rooms.get(codes.get(code));
      ensure(room?.status === 'waiting', 'ROOM_NOT_FOUND', 'Mã phòng không tồn tại hoặc phòng đã bắt đầu.');
      await startRoom(room, player(user));
      return { roomId: room.id };
    });
    on('room:leave', roomInput, ({ roomId }) => {
      const room = ownedRoom(roomId, false);
      ensure(room.status === 'waiting' || room.status === 'finished', 'GAME_ACTIVE', 'Dùng nút đầu hàng để rời ván đang chơi.');
      ensure(room.status !== 'finished' || room.persisted, 'RESULT_PENDING', 'Đang lưu kết quả.');
      if (room.status === 'waiting') { broadcast(room, 'room:closed'); removeRoom(room); }
      else socket.leave(room.id);
    });
    on('bot:start', modeInput.extend({ elo: z.union([z.literal(800), z.literal(1200), z.literal(1600)]) }), async ({ mode, elo }) => {
      assertFree(id);
      const user = await freshUser();
      assertFree(id);
      ensure([...rooms.values()].filter((room) => room.kind === 'bot' && ['starting', 'active'].includes(room.status)).length < maxBotGames, 'BOTS_BUSY', 'Các bot đang bận. Hãy thử lại sau.');
      const room = newRoom(player(user), mode, 'bot');
      await startRoom(room, { id: `bot:${randomUUID()}`, username: `Stockfish ${elo}`, elo, bot: true });
      return { roomId: room.id };
    });
    on('game:sync', roomInput, ({ roomId }) => snapshot(ownedRoom(roomId, false), id));
    on('game:move', moveInput, ({ roomId, ...move }) => {
      const room = ownedRoom(roomId);
      const result = applyMove(room, colorOf(room, id), move, now());
      if (result) finish(room, result.winner, result.reason);
      else { armClock(room); broadcast(room); void botTurn(room); }
    });
    on('game:peek', roomInput, ({ roomId }) => {
      const room = ownedRoom(roomId);
      enablePeek(room, colorOf(room, id));
      socket.emit('game:state', snapshot(room, id));
    });
    on('game:resign', roomInput, ({ roomId }) => {
      const room = ownedRoom(roomId);
      finish(room, opposite(colorOf(room, id)), 'resignation');
    });
    socket.on('disconnect', () => {
      if (sockets.get(id) !== socket.id) return;
      sockets.delete(id);
      queue.delete(id);
      const room = rooms.get(occupied.get(id));
      if (room) broadcast(room);
      // Disconnecting never pauses or resets a turn. Reconnect with the same JWT.
    });
  });

  async function close() {
    stopping = true;
    clearInterval(interval);
    for (const room of rooms.values()) { clearTimeout(room.timer); clearTimeout(room.openingTimer); room.engine?.close(); }
    await Promise.all([...rooms.values()].filter((room) => room.status === 'finished').map(persistResult));
    await new Promise((resolve) => io.close(resolve));
    if (httpServer.listening) await new Promise((resolve) => httpServer.close(resolve));
  }
  return { app, httpServer, io, rooms, queue, tick, close };
}

export async function main({ handleSignals = true } = {}) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must use a replica set for atomic Elo transactions. Run docker compose up -d --wait.');
  await Promise.all([User.init(), Match.init()]);
  await recoverMatches();
  const backend = createBackend();
  const port = Number(process.env.PORT || 3001);
  await new Promise((resolve, reject) => {
    backend.httpServer.once('error', reject);
    backend.httpServer.listen(port, '0.0.0.0', resolve);
  });
  console.log(`Memory Chess API listening on http://localhost:${port}`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await backend.close();
    await mongoose.disconnect();
  };
  if (handleSignals) {
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
  return backend;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
