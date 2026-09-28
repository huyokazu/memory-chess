export const TURN_MS = 60_000;
export const MAX_PEEKS = 10;
export const MODES = ['hardcore', 'peeks'];
export const BOT_LEVELS = {
  800: { skill: 0, depth: 2, moveTime: 150 },
  1200: { skill: 4, depth: 5, moveTime: 300 },
  1600: { skill: 8, depth: 9, moveTime: 600 },
};

export const opposite = (color) => color === 'w' ? 'b' : 'w';

export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function ensure(condition, code, message) {
  if (!condition) throw new GameError(code, message);
}

export function eloChanges(whiteElo, blackElo, winner) {
  const expected = 1 / (1 + 10 ** ((blackElo - whiteElo) / 400));
  const score = winner === null ? 0.5 : winner === 'w' ? 1 : 0;
  let white = Math.round(32 * (score - expected));
  if (winner === 'w') white = Math.max(1, white);
  if (winner === 'b') white = Math.min(-1, white);
  return { w: white || 0, b: -white || 0 };
}

export function terminalResult(chess) {
  if (chess.isCheckmate()) return { winner: opposite(chess.turn()), reason: 'checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'threefold_repetition' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient_material' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty_move_rule' };
  return null;
}

export function enablePeek(room, color) {
  ensure(room.mode === 'peeks', 'PEEK_DISABLED', 'Chế độ Hardcore không có Peek.');
  ensure(room.ply > 0, 'BOARD_VISIBLE', 'Bàn cờ đang hiển thị ở đầu ván.');
  const peek = room.peeks[color];
  if (peek.active) return;
  ensure(peek.remaining > 0, 'NO_PEEKS', 'Bạn đã dùng hết 10 lượt Peek.');
  peek.active = true;
}

export function applyMove(room, color, move, now) {
  ensure(room.status === 'active', 'GAME_NOT_ACTIVE', 'Ván đấu chưa bắt đầu hoặc đã kết thúc.');
  ensure(now < room.deadline, 'TURN_EXPIRED', 'Đã hết 60 giây của lượt đi.');
  ensure(room.chess.turn() === color, 'NOT_YOUR_TURN', 'Chưa đến lượt của bạn.');
  try {
    room.chess.move(move);
  } catch {
    throw new GameError('ILLEGAL_MOVE', 'Nước đi không hợp lệ.');
  }
  if (room.peeks[color].active) {
    room.peeks[color].active = false;
    room.peeks[color].remaining -= 1;
  }
  room.ply += 1;
  room.lastMove = { from: move.from, to: move.to, color, ...(move.promotion ? { promotion: move.promotion } : {}) };
  room.deadline = now + TURN_MS;
  return terminalResult(room.chess);
}
