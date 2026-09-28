import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';

export function mountWeb(app, directory) {
  if (!directory) return;
  const root = resolve(directory);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error('Web build missing. Run pnpm build:web before setting SERVE_WEB=true.');
  app.use(express.static(root, { index: false, maxAge: '1h' }));
  // Return the Expo SPA for browser navigation, never for a missing asset/API.
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/_expo/') || /\.[^/]+$/.test(req.path) || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
