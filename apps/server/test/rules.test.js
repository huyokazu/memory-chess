import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { TURN_MS, eloChanges, enablePeek, applyMove, terminalResult } from '../src/lib/rules.js';

const room = (mode = 'peeks') => ({
  mode, status: 'active', chess: new Chess(), ply: 0, deadline: TURN_MS,
  peeks: { w: { remaining: 10, active: false }, b: { remaining: 10, active: false } },
});

test('60 seconds per move; illegal moves do not reset the deadline', () => {
  const game = room();
  assert.throws(() => applyMove(game, 'w', { from: 'e2', to: 'e5' }, 5000), { code: 'ILLEGAL_MOVE' });
  assert.equal(game.deadline, 60_000);
  applyMove(game, 'w', { from: 'e2', to: 'e4' }, 12_000);
  assert.equal(game.deadline, 72_000);
  assert.throws(() => applyMove(game, 'b', { from: 'e7', to: 'e5' }, 72_000), { code: 'TURN_EXPIRED' });
});

test('peek stays visible through the opponent move and invalid own moves', () => {
  const game = room();
  applyMove(game, 'w', { from: 'e2', to: 'e4' }, 100);
  enablePeek(game, 'w');
  enablePeek(game, 'w');
  assert.equal(game.peeks.w.remaining, 10);
  applyMove(game, 'b', { from: 'e7', to: 'e5' }, 200);
  assert.equal(game.peeks.w.active, true);
  assert.throws(() => applyMove(game, 'w', { from: 'e4', to: 'e6' }, 300));
  assert.equal(game.peeks.w.active, true);
  applyMove(game, 'w', { from: 'g1', to: 'f3' }, 400);
  assert.deepEqual(game.peeks.w, { remaining: 9, active: false });
  assert.equal(game.peeks.b.remaining, 10);
});

test('hardcore, initial position, and exhausted peeks cannot be revealed', () => {
  assert.throws(() => enablePeek(room('hardcore'), 'w'), { code: 'PEEK_DISABLED' });
  const game = room();
  assert.throws(() => enablePeek(game, 'w'), { code: 'BOARD_VISIBLE' });
  applyMove(game, 'w', { from: 'e2', to: 'e4' }, 100);
  game.peeks.b.remaining = 0;
  assert.throws(() => enablePeek(game, 'b'), { code: 'NO_PEEKS' });
});

test('wrong turn cannot move or consume a peek', () => {
  const game = room();
  assert.throws(() => applyMove(game, 'b', { from: 'e7', to: 'e5' }, 100), { code: 'NOT_YOUR_TURN' });
  assert.equal(game.ply, 0);
});

test('checkmate is detected using chess rules', () => {
  const game = room();
  applyMove(game, 'w', { from: 'f2', to: 'f3' }, 1);
  applyMove(game, 'b', { from: 'e7', to: 'e5' }, 2);
  applyMove(game, 'w', { from: 'g2', to: 'g4' }, 3);
  assert.deepEqual(applyMove(game, 'b', { from: 'd8', to: 'h4' }, 4), { winner: 'b', reason: 'checkmate' });
});

test('castling, en passant, and underpromotion are legal', () => {
  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(castle.move({ from: 'e1', to: 'g1' }).san, 'O-O');
  const ep = new Chess();
  for (const move of ['e4', 'a6', 'e5', 'd5', 'exd6']) ep.move(move);
  assert.equal(ep.get('d5'), undefined);
  const promotion = new Chess('8/P6k/8/8/8/8/8/7K w - - 0 1');
  promotion.move({ from: 'a7', to: 'a8', promotion: 'n' });
  assert.equal(promotion.get('a8').type, 'n');
});

test('draw reasons and zero-sum Elo are deterministic', () => {
  assert.deepEqual(terminalResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), { winner: null, reason: 'stalemate' });
  assert.deepEqual(terminalResult(new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1')), { winner: null, reason: 'insufficient_material' });
  const repeated = new Chess();
  for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) repeated.move(move);
  assert.equal(terminalResult(repeated).reason, 'threefold_repetition');
  assert.deepEqual(eloChanges(1200, 1200, 'w'), { w: 16, b: -16 });
  assert.deepEqual(eloChanges(1200, 1200, null), { w: 0, b: 0 });
  assert.ok(eloChanges(800, 1600, 'w').w > 16);
  const result = eloChanges(1600, 800, 'b');
  assert.equal(result.w + result.b, 0);
});
