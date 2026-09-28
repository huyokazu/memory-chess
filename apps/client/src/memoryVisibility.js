// Chess rebuilt from FEN has no move history. Count server plies instead.
export function playedPlies({ ply, fen } = {}) {
  if (Number.isInteger(ply) && ply >= 0) return ply;
  const fields = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
  const fullmove = Number(fields[5]);
  if (fields.length === 6 && Number.isInteger(fullmove) && fullmove >= 1) {
    return (fullmove - 1) * 2 + (fields[1] === 'b' ? 1 : 0);
  }
  return 0;
}

export function memoryVisibility(room) {
  const hasMoved = playedPlies(room) >= 1;
  return {
    hasMoved,
    piecesVisible: !hasMoved || room.status === 'finished'
      || (room.mode === 'peeks' && room.peek?.active === true),
  };
}
