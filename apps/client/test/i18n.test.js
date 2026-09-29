import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const localesDir = new URL('../src/i18n/locales/', import.meta.url);
const [en, vi] = await Promise.all(['en.json', 'vi.json'].map(async (file) =>
  JSON.parse(await readFile(new URL(file, localesDir), 'utf8')),
));

function leafPaths(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? leafPaths(child, path)
      : [path];
  });
}

test('English and Vietnamese dictionaries expose the same translation keys', () => {
  assert.deepEqual(leafPaths(vi).sort(), leafPaths(en).sort());
});

test('English is the default copy and required chess terms are present', () => {
  assert.match(en.game.resign, /Resign/i);
  assert.match(en.game.reasons.timeout, /Time out/i);
  assert.match(en.menu.findMatch, /Find Match/i);
  assert.match(en.game.lastMove, /Opponent's Last Move/i);
});
