import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { BoardPlayback, boardFrame, movementBetween, squarePoint, MOVE_DURATION } from '../src/animation/boardPlayback.js';

function frame(chess, ply, options = {}) {
  const last = chess.history({ verbose: true }).at(-1);
  return boardFrame({ id: 'game-1', fen: chess.fen(), ply, mode: 'peeks', status: 'active',
    lastMove: last && { from: last.from, to: last.to, color: last.color, promotion: last.promotion }, ...options });
}

test('first move slides visibly for 300 ms before the initial board is hidden', () => {
  assert.equal(MOVE_DURATION, 300);
  const chess = new Chess(); const player = new BoardPlayback(frame(chess, 0));
  chess.move('e4'); player.enqueue(frame(chess, 1));
  assert.equal(player.snapshot.frame.ply, 0);
  assert.equal(player.snapshot.transition.visible, true);
  assert.deepEqual(player.snapshot.transition.pieces, [{ from: 'e2', to: 'e4', type: 'p', color: 'w' }]);
  player.complete(player.transition.id);
  assert.equal(player.snapshot.frame.ply, 1);
  assert.equal(player.snapshot.frame.visible, false);
});

test('Peek remains visible through its move, then a queued fast bot reply stays invisible', () => {
  const chess = new Chess(); chess.move('e4'); chess.move('e5');
  const player = new BoardPlayback(frame(chess, 2, { peek: { active: true } }));
  chess.move('Nf3'); player.enqueue(frame(chess, 3, { peek: { active: false } }));
  const firstId = player.transition.id;
  chess.move('Nc6'); player.enqueue(frame(chess, 4));
  assert.equal(player.current.visible, true);
  assert.equal(player.transition.target.ply, 3);
  player.complete(firstId);
  assert.equal(player.current.ply, 3);
  assert.equal(player.transition.target.ply, 4);
  assert.equal(player.transition.visible, false);
  // A late CSS fallback must not finish the next animation early.
  player.complete(firstId);
  assert.equal(player.transition.target.ply, 4);
  player.complete(player.transition.id);
  assert.equal(player.current.ply, 4);
  assert.equal(player.current.visible, false);
});

test('hidden movement never leaks the moving piece; invalid moves do not animate', () => {
  const chess = new Chess(); chess.move('e4');
  const player = new BoardPlayback(frame(chess, 1));
  player.enqueue(frame(chess, 1));
  assert.equal(player.transition, null);
  chess.move('e5'); player.enqueue(frame(chess, 2));
  assert.equal(player.transition.visible, false);
});

test('castling moves king and rook together', () => {
  const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const before = frame(chess, 0);
  chess.move('O-O');
  assert.deepEqual(movementBetween(before, frame(chess, 1)), [
    { from: 'e1', to: 'g1', type: 'k', color: 'w' },
    { from: 'h1', to: 'f1', type: 'r', color: 'w' },
  ]);
});

test('capture, en passant and underpromotion settle at exactly the server FEN', () => {
  for (const [fen, move] of [
    ['4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'exd5'],
    ['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'exd6'],
    ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a8=N'],
  ]) {
    const chess = new Chess(fen); const player = new BoardPlayback(frame(chess, 0));
    chess.move(move); player.enqueue(frame(chess, 1));
    assert.equal(player.transition.pieces[0].type, 'p');
    player.complete(player.transition.id);
    assert.equal(player.current.fen, chess.fen());
  }
});

test('reconnect jumps snap to the authoritative state; changing room cancels old completion', () => {
  const chess = new Chess(); const player = new BoardPlayback(frame(chess, 0));
  chess.move('e4'); chess.move('e5');
  player.enqueue(frame(chess, 2)); assert.equal(player.transition, null);
  assert.equal(player.current.ply, 2);
  chess.move('Nf3'); player.enqueue(frame(chess, 3));
  const oldId = player.transition.id;
  player.enqueue({ ...frame(new Chess(), 0), id: 'game-2' });
  player.complete(oldId);
  assert.equal(player.current.id, 'game-2'); assert.equal(player.current.ply, 0);
});

test('flipped board coordinates remain correct for both ends of a move', () => {
  assert.deepEqual(squarePoint('e2'), { x: 4, y: 6 });
  assert.deepEqual(squarePoint('e4'), { x: 4, y: 4 });
  assert.deepEqual(squarePoint('e2', true), { x: 3, y: 1 });
  assert.deepEqual(squarePoint('e4', true), { x: 3, y: 3 });
});
