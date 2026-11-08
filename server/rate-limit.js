// server/rate-limit.js - small in-memory fixed-window limiter keyed by client IP
'use strict';

function rateLimit({ windowMs, max, name }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Periodically drop expired windows so the map does not grow forever.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, v] of hits) if (v.resetAt <= now) hits.delete(ip);
  }, windowMs);
  sweeper.unref();

  return function (req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count++;
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: `Too many ${name || 'requests'}. Try again later.` });
    }
    next();
  };
}

module.exports = { rateLimit };
