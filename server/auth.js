// server/auth.js - single-admin login with a signed, httpOnly session cookie
'use strict';

const crypto = require('crypto');

const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_HOURS  = Number(process.env.SESSION_HOURS || 8);
const COOKIE_NAME    = 'pc_session';

function checkConfig() {
  const missing = [];
  if (!ADMIN_EMAIL)    missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (!SESSION_SECRET) missing.push('SESSION_SECRET');
  if (missing.length) {
    console.error(`[auth] Missing required env: ${missing.join(', ')}. The admin dashboard is disabled until these are set.`);
    return false;
  }
  if (SESSION_SECRET.length < 32) {
    console.warn('[auth] SESSION_SECRET is short. Use at least 32 random characters.');
  }
  return true;
}

const configured = checkConfig();

// Constant-time comparison of two strings of possibly different lengths.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyCredentials(email, password) {
  if (!configured) return false;
  const okEmail = safeEqual((email || '').trim().toLowerCase(), ADMIN_EMAIL);
  const okPass  = safeEqual(password || '', ADMIN_PASSWORD);
  return okEmail && okPass;
}

function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function createToken(email) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const nonce = crypto.randomBytes(8).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ email, exp, nonce })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!configured || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    if ((data.email || '').toLowerCase() !== ADMIN_EMAIL) return null;
    return { email: data.email, exp: data.exp };
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch { /* malformed cookie value, ignore */ }
  }
  return out;
}

function isSecure(req) {
  if (process.env.COOKIE_SECURE === 'true')  return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure(req),
    path: '/',
    maxAge: SESSION_HOURS * 3600 * 1000,
  });
}

function clearSessionCookie(req, res) {
  res.cookie(COOKIE_NAME, '', { httpOnly: true, sameSite: 'strict', secure: isSecure(req), path: '/', maxAge: 0 });
}

function sessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME]);
}

// Express middleware: 401 unless a valid admin session cookie is present.
function requireAdmin(req, res, next) {
  const session = sessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'Not signed in' });
  req.admin = session;
  next();
}

module.exports = {
  configured,
  verifyCredentials,
  createToken,
  setSessionCookie,
  clearSessionCookie,
  sessionFromRequest,
  requireAdmin,
};
