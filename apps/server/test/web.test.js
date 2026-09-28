import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackend } from '../src/server.js';

const secret = 'hosting-test-secret-with-at-least-32-characters';

test('production hosting serves the SPA, protects API paths and permits its own origin', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-chess-web-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, '_expo'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Memory Chess</title><div id="root"></div>');
  await writeFile(join(directory, '_expo', 'app.js'), 'console.log("memory-chess");');
  const backend = createBackend({ secret, webDist: directory, publicClientUrl: 'https://memory-chess.example', origins: [], trustProxyHops: 1 });
  t.after(() => backend.close());
  await new Promise((resolve) => backend.httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${backend.httpServer.address().port}`;
  assert.equal(backend.app.get('trust proxy'), 1);
  for (const path of ['/', '/play?room=123456']) {
    const response = await fetch(base + path, { headers: { Accept: 'text/html', Origin: 'https://memory-chess.example' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://memory-chess.example');
    assert.match(await response.text(), /Memory Chess/);
  }
  const asset = await fetch(base + '/_expo/app.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  const api = await fetch(base + '/api/missing', { headers: { Accept: 'text/html' } });
  assert.equal(api.status, 404);
  assert.equal((await api.json()).error.code, 'NOT_FOUND');
  assert.equal((await fetch(base + '/_expo/missing.js')).status, 404);
  const foreign = await fetch(base + '/', { headers: { Origin: 'https://other.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
});

test('hosting rejects a missing build and invalid proxy configuration', () => {
  assert.throws(() => createBackend({ secret, webDist: '/missing-memory-chess-build' }), /Web build missing/);
  assert.throws(() => createBackend({ secret, trustProxyHops: -1 }), /TRUST_PROXY_HOPS/);
});
