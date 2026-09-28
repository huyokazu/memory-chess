import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { StockfishEngine } from '../src/lib/stockfish.js';

for (const elo of [800, 1200, 1600]) {
  test(`real Stockfish ${elo} returns legal moves over UCI`, { timeout: 30_000 }, async () => {
    const engine = new StockfishEngine(elo);
    try {
      await engine.init();
      const chess = new Chess();
      for (let ply = 0; ply < 4; ply++) {
        const history = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
        const move = await engine.bestMove(history);
        assert.ok(chess.move(move));
      }
    } finally { engine.close(); }
  });
}
