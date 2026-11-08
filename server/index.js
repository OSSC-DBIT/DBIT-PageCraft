// server/index.js - DBIT PageCraft self-hosted server
// Serves the static app from ./public and exposes a small JSON API:
//   POST /api/generations          public (rate limited, validated) analytics insert
//   POST /api/admin/login          admin sign-in (sets httpOnly session cookie)
//   POST /api/admin/logout         clears the session cookie
//   GET  /api/admin/me             current admin session
//   GET  /api/admin/generations    analytics rows (admin only)
//   GET  /api/health               liveness + database check
'use strict';

const path    = require('path');
const express = require('express');

const db   = require('./db');
const auth = require('./auth');
const { rateLimit } = require('./rate-limit');
const { validateGeneration } = require('./validate');

const PORT        = Number(process.env.PORT || 3000);
const HOST        = process.env.HOST || '0.0.0.0';
const APP_ENV     = process.env.APP_ENV || 'production';   // production | staging | development
const PUBLIC_DIR  = path.join(__dirname, '..', 'public');
const TRUST_PROXY = process.env.TRUST_PROXY || '';
const MAX_ROWS    = Number(process.env.ADMIN_MAX_ROWS || 5000);

const app = express();
app.disable('x-powered-by');

// Behind nginx / Caddy / Traefik set TRUST_PROXY=1 so req.ip and req.secure
// come from X-Forwarded-* headers. Accepts a hop count or an express value
// such as "loopback".
if (TRUST_PROXY) {
  app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
}

// ── Security headers ─────────────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

app.use((req, res, next) => {
  res.set('Content-Security-Policy', CSP);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  // Keep staging / dev deployments out of search engines.
  if (APP_ENV !== 'production') res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// ── API ──────────────────────────────────────────────────────────────────────
const api = express.Router();
api.use(express.json({ limit: '16kb' }));
api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

api.get('/health', async (req, res) => {
  try {
    await db.ping();
    res.json({ status: 'ok', db: 'ok', env: APP_ENV, version: process.env.APP_VERSION || null, time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});

api.post('/generations',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 60, name: 'exports' }),
  async (req, res) => {
    const v = validateGeneration(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    try {
      await db.insertGeneration(v.record);
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error('[api] insert failed:', err.message);
      res.status(500).json({ error: 'Could not record generation' });
    }
  }
);

api.post('/admin/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, name: 'login attempts' }),
  (req, res) => {
    if (!auth.configured) return res.status(503).json({ error: 'Admin login is not configured on this server' });
    const { email, password } = req.body || {};
    if (!auth.verifyCredentials(email, password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    auth.setSessionCookie(req, res, auth.createToken(String(email).trim().toLowerCase()));
    res.json({ email: String(email).trim().toLowerCase() });
  }
);

api.post('/admin/logout', (req, res) => {
  auth.clearSessionCookie(req, res);
  res.json({ ok: true });
});

api.get('/admin/me', (req, res) => {
  const session = auth.sessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'Not signed in' });
  res.json({ email: session.email, expiresAt: new Date(session.exp).toISOString() });
});

api.get('/admin/generations', auth.requireAdmin, async (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 1000;
  limit = Math.min(limit, MAX_ROWS);
  try {
    const rows = await db.listGenerations(limit);
    res.json({ rows, limit });
  } catch (err) {
    console.error('[api] list failed:', err.message);
    res.status(500).json({ error: 'Could not load generations' });
  }
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

// JSON parse errors and anything thrown inside the API.
api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err && err.type === 'entity.too.large')   return res.status(413).json({ error: 'Payload too large' });
  console.error('[api] error:', err);
  res.status(500).json({ error: 'Internal error' });
});

app.use('/api', api);

// ── Static site ──────────────────────────────────────────────────────────────
// `extensions: ['html']` gives clean URLs: /admin -> admin.html, /project-report -> project-report.html
app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  extensions: ['html'],
  dotfiles: 'allow',      // needed for /.well-known/security.txt
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      res.set('Cache-Control', 'no-cache');
    } else {
      // css/js are versioned with ?v= query strings, images rarely change
      res.set('Cache-Control', 'public, max-age=86400');
    }
  },
}));

// Custom 404 page for everything else.
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) return res.sendFile(path.join(PUBLIC_DIR, '404.html'));
  res.type('txt').send('Not found');
});

// ── Start ────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await db.migrate();
  } catch (err) {
    console.error('[db] Could not reach the database:', err.message);
    process.exit(1);
  }
  const server = app.listen(PORT, HOST, () => {
    console.log(`[server] DBIT PageCraft (${APP_ENV}) listening on http://${HOST}:${PORT}`);
    if (!auth.configured) console.warn('[server] Admin dashboard disabled (see [auth] message above).');
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => db.pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
})();
