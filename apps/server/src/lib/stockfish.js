import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { BOT_LEVELS } from './rules.js';

const require = createRequire(import.meta.url);

export class StockfishEngine {
  constructor(elo) {
    this.level = BOT_LEVELS[elo];
    if (!this.level) throw new Error('Unsupported bot level');
    const root = dirname(require.resolve('stockfish/package.json'));
    const bin = join(root, 'bin');
    const script = readdirSync(bin).find((name) => /-lite-single\.js$/.test(name));
    if (!script) throw new Error('Stockfish lite single-thread engine was not found');
    this.child = spawn(process.execPath, [join(bin, script)], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.closed = false;
    this.failure = null;
    this.pending = null;
    this.stderr = '';
    this.child.stderr.on('data', (data) => { this.stderr = (this.stderr + data).slice(-2000); });
    this.child.stdin.on('error', (error) => this.fail(error));
    this.child.on('error', (error) => this.fail(error));
    this.child.on('exit', (code) => {
      if (!this.closed) this.fail(new Error(`Stockfish exited (${code}): ${this.stderr}`));
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => {
      if (this.pending?.matches(line)) {
        const pending = this.pending;
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(line);
      }
    });
  }

  fail(error) {
    this.failure = error;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
  }

  command(command, matches, timeout = 10_000) {
    if (this.closed || this.failure) return Promise.reject(this.failure ?? new Error('Engine closed'));
    if (this.pending) return Promise.reject(new Error('Engine command already in progress'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new Error('Stockfish command timed out'));
        this.close();
      }, timeout);
      this.pending = { matches, resolve, reject, timer };
      this.child.stdin.write(command + '\n');
    });
  }

  async init() {
    await this.command('uci', (line) => line === 'uciok');
    this.child.stdin.write(`setoption name Hash value 16\nsetoption name Skill Level value ${this.level.skill}\nucinewgame\n`);
    await this.command('isready', (line) => line === 'readyok');
  }

  async bestMove(moves) {
    const position = `position startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`;
    this.child.stdin.write(position + '\n');
    const line = await this.command(
      `go depth ${this.level.depth} movetime ${this.level.moveTime}`,
      (output) => output.startsWith('bestmove '),
    );
    const move = line.split(/\s+/)[1];
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) throw new Error(`Invalid engine move: ${move}`);
    return { from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('Engine closed'));
    this.lines.close();
    this.child.kill('SIGTERM');
  }
}
