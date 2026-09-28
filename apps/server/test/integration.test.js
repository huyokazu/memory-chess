import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Match from '../src/models/Match.js';
import { createBackend } from '../src/server.js';
import { settleRating } from '../src/lib/ratings.js';

const secret = 'test-secret-with-more-than-thirty-two-characters';
let mongo, backend, base;
let currentTime = Date.now();
const clients = [];
const users = [];
const tokens = [];

async function waitFor(predicate, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Condition timed out');
}

const emit = (socket, event, data = {}) => new Promise((resolve, reject) => {
  socket.timeout(12_000).emit(event, data, (error, response) => error ? reject(error) : resolve(response));
});

async function makeClient(token) {
  const socket = connect(base, { auth: { token }, autoConnect: false, forceNew: true });
  socket.on('game:state', (state) => { socket.game = state; });
  socket.on('game:over', (state) => { socket.game = state; });
  const ready = new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  socket.connect();
  await ready;
  return socket;
}

async function party(mode = 'peeks', host = clients[0], guest = clients[1]) {
  const created = await emit(host, 'party:create', { mode });
  assert.equal(created.ok, true);
  assert.match(created.data.code, /^\d{6}$/);
  const joined = await emit(guest, 'party:join', { code: created.data.code });
  assert.equal(joined.ok, true);
  await waitFor(() => host.game?.id === created.data.roomId && host.game.status === 'active' && guest.game?.status === 'active');
  const white = host.game.color === 'w' ? host : guest;
  const black = host.game.color === 'b' ? host : guest;
  return { id: created.data.roomId, white, black };
}

async function settled(id) {
  return waitFor(async () => {
    const result = await Match.findById(id);
    return result && ['settled', 'unrated'].includes(result.ratingStatus) && result.status !== 'active' && backend.rooms.get(id)?.persisted && result;
  });
}

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri('memory_chess_test'));
  await Promise.all([User.init(), Match.init()]);
  backend = createBackend({ secret, now: () => currentTime });
  await new Promise((resolve) => backend.httpServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${backend.httpServer.address().port}`;
  for (const username of ['alice', 'bob', 'carol']) {
    const user = await User.create({ username, passwordHash: 'unused-in-socket-tests' });
    users.push(user);
    const token = jwt.sign({}, secret, { subject: String(user._id), issuer: 'memory-chess', audience: 'memory-chess-app', expiresIn: '1h' });
    tokens.push(token);
    clients.push(await makeClient(token));
  }
}, { timeout: 180_000 });

after(async () => {
  for (const client of clients) client.disconnect();
  await backend?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

test('HTTP registration hashes passwords, ignores supplied Elo, and requires authentication', async () => {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'new_player', password: 'sufficient-password', elo: 9000 }) });
  assert.equal(response.status, 201);
  const registered = await response.json();
  assert.equal(registered.user.elo, 1200);
  assert.equal(registered.user.passwordHash, undefined);
  assert.ok(registered.token);
  const saved = await User.findById(registered.user.id).select('+passwordHash');
  assert.match(saved.passwordHash, /^\$2/);
  assert.equal((await fetch(`${base}/api/me`)).status, 401);
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'new_player', password: 'sufficient-password' }) });
  assert.equal(login.status, 200);
});

test('sockets reject unauthenticated connections', async () => {
  await assert.rejects(makeClient('invalid-jwt'));
});

test('private room, hidden state, peek persistence, invalid move, reconnect and atomic Elo', async () => {
  const { id, white, black } = await party();
  assert.equal(white.game.visible, true);
  assert.equal(white.game.deadline - white.game.serverNow, 60_000);
  assert.equal((await emit(clients[2], 'game:peek', { roomId: id })).ok, false);
  assert.equal((await emit(black, 'game:move', { roomId: id, from: 'e7', to: 'e5' })).ok, false);
  assert.equal((await emit(white, 'game:move', { roomId: id, from: 'e2', to: 'e4' })).ok, true);
  await waitFor(() => white.game.ply === 1 && black.game.ply === 1);
  assert.equal(white.game.visible, false);
  assert.equal(black.game.visible, false);
  assert.equal((await emit(white, 'game:peek', { roomId: id })).ok, true);
  assert.equal(white.game.peek.remaining, 10);
  assert.equal(black.game.visible, false);
  await emit(black, 'game:move', { roomId: id, from: 'e7', to: 'e5' });
  await waitFor(() => white.game.ply === 2);
  assert.equal(white.game.visible, true);
  const deadline = white.game.deadline;
  const invalid = await emit(white, 'game:move', { roomId: id, from: 'e4', to: 'e6' });
  assert.equal(invalid.error.code, 'ILLEGAL_MOVE');
  const index = clients.indexOf(white);
  white.disconnect();
  currentTime += 7000;
  const reconnected = await makeClient(tokens[index]);
  clients[index] = reconnected;
  await waitFor(() => reconnected.game?.id === id);
  assert.equal(reconnected.game.deadline, deadline);
  assert.equal(reconnected.game.visible, true);
  await emit(reconnected, 'game:move', { roomId: id, from: 'g1', to: 'f3' });
  await waitFor(() => reconnected.game.ply === 3);
  assert.equal(reconnected.game.visible, false);
  assert.equal(reconnected.game.peek.remaining, 9);
  currentTime = reconnected.game.deadline;
  backend.tick();
  const result = await settled(id);
  assert.equal(result.reason, 'timeout');
  assert.equal(result.winner, 'w');
  assert.equal(result.ratingChanges.w.delta, 16);
  assert.equal(result.ratingChanges.b.delta, -16);
  const winnerBefore = await User.findById(result.white.id);
  await Promise.all([settleRating(id), settleRating(id)]);
  const winnerAfter = await User.findById(result.white.id);
  assert.equal(winnerBefore.elo, winnerAfter.elo);
  assert.equal(winnerAfter.wins, 1);
  assert.equal((await emit(reconnected, 'game:resign', { roomId: id })).ok, false);
});

test('matchmaking respects modes, pairs by Elo, and prevents double room membership', async () => {
  await emit(clients[0], 'match:find', { mode: 'hardcore' });
  await emit(clients[1], 'match:find', { mode: 'peeks' });
  assert.equal(backend.queue.size, 2);
  assert.equal((await emit(clients[0], 'party:create', { mode: 'hardcore' })).ok, false);
  await emit(clients[1], 'match:cancel');
  await emit(clients[1], 'match:find', { mode: 'hardcore' });
  await waitFor(() => clients[0].game?.status === 'active' && clients[0].game.kind === 'ranked');
  assert.equal(backend.queue.size, 0);
  const id = clients[0].game.id;
  assert.equal((await emit(clients[0], 'game:peek', { roomId: id })).error.code, 'PEEK_DISABLED');
  await emit(clients[0], 'game:resign', { roomId: id });
  await settled(id);
});

test('a party accepts exactly one guest even under concurrent join requests', async () => {
  const created = await emit(clients[0], 'party:create', { mode: 'hardcore' });
  const attempts = await Promise.all([emit(clients[1], 'party:join', { code: created.data.code }), emit(clients[2], 'party:join', { code: created.data.code })]);
  assert.equal(attempts.filter((result) => result.ok).length, 1);
  await waitFor(() => clients[0].game?.status === 'active');
  await emit(clients[0], 'game:resign', { roomId: created.data.roomId });
  await settled(created.data.roomId);
});

test('bot game uses real Stockfish and never changes human Elo', async () => {
  const beforeUser = await User.findById(users[0]._id);
  const result = await emit(clients[0], 'bot:start', { mode: 'peeks', elo: 800 });
  assert.equal(result.ok, true);
  await waitFor(() => clients[0].game?.id === result.data.roomId && clients[0].game.status === 'active');
  const game = clients[0].game;
  if (game.color === 'w') await emit(clients[0], 'game:move', { roomId: game.id, from: 'e2', to: 'e4' });
  await waitFor(() => clients[0].game.ply >= (game.color === 'w' ? 2 : 1));
  await emit(clients[0], 'game:resign', { roomId: game.id });
  const match = await settled(game.id);
  assert.equal(match.ratingStatus, 'unrated');
  assert.equal((await User.findById(users[0]._id)).elo, beforeUser.elo);
});
