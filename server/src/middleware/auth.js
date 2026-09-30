// Session handling: after a successful password + 2FA login the server issues a
// signed JWT inside an httpOnly cookie.
//  - httpOnly  → JavaScript in the page cannot read it, so an XSS bug can't steal it.
//  - SameSite=Strict → the browser won't send it on requests from other sites (CSRF defence).
//  - Signed    → the user can't edit their role or id without the server noticing.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const COOKIE = 'tw_session';
const SESSION_HOURS = 2;

// In a real deployment JWT_SECRET comes from the environment. For the prototype we
// fall back to a random secret per server start (everyone is simply logged out on restart).
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET not set — using a random per-run secret.');

export function startSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true', // turn on when served over HTTPS
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict' });
}

// Attaches req.user if a valid session cookie is present; never blocks the request.
// Used by routes that work for both guests and signed-in customers (e.g. checkout).
export function optionalAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, SECRET);
      // Re-read the user from the database so a deleted account loses access immediately.
      req.user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(sub) || undefined;
    } catch {
      /* expired or tampered token → treat as guest */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    next();
  });
}

// Role-based access control for the analytics/admin area.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    next();
  });
}
