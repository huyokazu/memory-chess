import { Chess } from 'chess.js';
import { memoryVisibility, playedPlies } from '../memoryVisibility.js';

export const MOVE_DURATION = 300;

export function boardFrame(room) {
  return { id: room.id, fen: room.fen, ply: playedPlies(room),
    visible: memoryVisibility(room).piecesVisible, lastMove: room.lastMove,
    status: room.status, sequence: room.sequence };
}

export function squarePoint(square, flipped = false) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: flipped ? 7 - file : file, y: flipped ? rank : 7 - rank };
}

// Verify a contiguous legal move rather than inferring pieces from changed cells.
// Reconnect jumps are applied immediately, never replayed as an invented move.
export function movementBetween(before, after) {
  if (before.id !== after.id || after.ply !== before.ply + 1 || !after.lastMove) return null;
  try {
    const chess = new Chess(before.fen);
    const { from, to, promotion } = after.lastMove;
    const move = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (chess.fen() !== after.fen) return null;
    const pieces = [{ from, to, type: move.piece, color: move.color }];
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.color === 'w' ? '1' : '8';
      pieces.push({ from: (move.flags.includes('k') ? 'h' : 'a') + rank,
        to: (move.flags.includes('k') ? 'f' : 'd') + rank, type: 'r', color: move.color });
    }
    return pieces;
  } catch { return null; }
}

export class BoardPlayback {
  constructor(initial, notify = () => {}) {
    this.current = initial;
    this.notify = notify;
    this.pending = [];
    this.transition = null;
    this.serial = 0;
  }
  get snapshot() { return { frame: this.current, transition: this.transition }; }
  enqueue(next) {
    if (next.id !== this.current.id) {
      this.pending = []; this.transition = null; this.current = next;
      this.notify(this.snapshot); return;
    }
    this.pending.push(next);
    this.pump();
  }
  pump() {
    if (this.transition) return;
    while (this.pending.length) {
      const target = this.pending.shift();
      const pieces = movementBetween(this.current, target);
      if (pieces) {
        this.transition = { id: ++this.serial, pieces, target,
          // Source visibility persists until the slide completes. Hidden moves
          // stay hidden, including the move that ends the game.
          visible: this.current.visible };
        this.notify(this.snapshot); return;
      }
      this.current = target;
    }
    this.notify(this.snapshot);
  }
  complete(id) {
    if (this.transition?.id !== id) return;
    this.current = this.transition.target;
    this.transition = null;
    this.pump();
  }
}
