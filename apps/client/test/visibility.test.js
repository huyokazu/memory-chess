import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { playedPlies, memoryVisibility } from '../src/memoryVisibility.js';

for (const mode of ['hardcore', 'peeks']) {
  test(`${mode}: initial pieces are visible even when a stale visibility flag is false`, () => {
    const room = { mode, ply: 0, fen: new Chess().fen(), visible: false, status: 'active' };
    assert.deepEqual(memoryVisibility(room), { hasMoved: false, piecesVisible: true });
  });
  test(`${mode}: hide after the first legal ply and stay hidden after the reply`, () => {
    const chess = new Chess();
    chess.move('e4');
    assert.equal(memoryVisibility({ mode, ply: 1, fen: chess.fen(), visible: true }).piecesVisible, false);
    chess.move('e5');
    assert.equal(memoryVisibility({ mode, ply: 2, fen: chess.fen() }).piecesVisible, false);
  });
}
test('reconnecting from FEN does not mistake empty chess.history() for a fresh game', () => {
  const chess = new Chess();
  for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) chess.move(move);
  const restored = new Chess(chess.fen());
  assert.equal(restored.history().length, 0);
  assert.equal(playedPlies({ fen: restored.fen() }), 4);
  assert.equal(memoryVisibility({ mode: 'hardcore', fen: restored.fen() }).piecesVisible, false);
});
test('FEN after the first white move is one ply, not zero full moves', () => {
  const chess = new Chess(); chess.move('e4');
  assert.equal(playedPlies({ fen: chess.fen() }), 1);
});
test('Peek only reveals Strategic Peeks; end-of-game review reveals both modes', () => {
  assert.equal(memoryVisibility({ mode: 'peeks', ply: 3, peek: { active: true } }).piecesVisible, true);
  assert.equal(memoryVisibility({ mode: 'peeks', ply: 4, peek: { active: false } }).piecesVisible, false);
  assert.equal(memoryVisibility({ mode: 'hardcore', ply: 3, peek: { active: true } }).piecesVisible, false);
  assert.equal(memoryVisibility({ mode: 'hardcore', ply: 3, status: 'finished' }).piecesVisible, true);
});
test('new game resets visibility independently of the previous match', () => {
  assert.equal(memoryVisibility({ mode: 'hardcore', ply: 20 }).piecesVisible, false);
  assert.equal(memoryVisibility({ mode: 'hardcore', ply: 0 }).piecesVisible, true);
});
