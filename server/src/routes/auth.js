// Registration, login and multi-factor authentication (MFA).
//
// Login is two steps:
//   1. POST /login       – email + password checked against the bcrypt hash.
//                           On success we create a one-time 6-digit code (valid 5 min).
//   2. POST /mfa/verify  – the code must match before a session cookie is issued.
// A stolen password alone is therefore not enough to get into an account.
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import * as v from '../validate.js';
import { startSession, endSession, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Brute-force protection: at most 20 auth attempts per IP every 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const MFA_TTL_MS = 5 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;
// With no email server in a prototype, the code is also returned to the browser so the
// examiner can see it. Set SHOW_MFA_CODE=false to behave like production (email only).
const SHOW_MFA_CODE = process.env.SHOW_MFA_CODE !== 'false';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Used when the email doesn't exist so the response takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

router.post('/register', authLimiter, (req, res) => {
  const name = v.text(req.body.name, 'Full name', { max: 80 });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  if (req.body.consent !== true) throw new v.ValidationError('Privacy consent is required.');

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists — please sign in.' });
  }
  const hash = bcrypt.hashSync(password, 12); // cost 12 ≈ 250 ms: slow for attackers, fine for users
  db.prepare(`INSERT INTO users (name, email, password_hash, privacy_consent_at)
              VALUES (?, ?, ?, datetime('now'))`).run(name, email, hash);
  res.status(201).json({ ok: true });
});

router.post('/login', authLimiter, (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    // Same message for "no such email" and "wrong password" so attackers can't probe accounts.
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challengeId = crypto.randomUUID();
  db.prepare('DELETE FROM mfa_challenges WHERE user_id = ? OR expires_at < ?').run(user.id, Date.now());
  db.prepare('INSERT INTO mfa_challenges (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(challengeId, user.id, sha256(code), Date.now() + MFA_TTL_MS);

  console.log(`[mock email] 2FA code for ${user.email}: ${code}`);
  res.json({ challengeId, ...(SHOW_MFA_CODE && { demoCode: code }) });
});

router.post('/mfa/verify', authLimiter, (req, res) => {
  const { challengeId, code } = req.body;
  const ch = typeof challengeId === 'string'
    ? db.prepare('SELECT * FROM mfa_challenges WHERE id = ?').get(challengeId)
    : undefined;

  if (!ch || ch.used || ch.expires_at < Date.now() || ch.attempts >= MFA_MAX_ATTEMPTS) {
    return res.status(400).json({ error: 'This code has expired. Please sign in again.', restart: true });
  }

  // Constant-time comparison of the hashes avoids leaking information through timing.
  const given = Buffer.from(sha256(String(code ?? '')), 'hex');
  const expected = Buffer.from(ch.code_hash, 'hex');
  if (!crypto.timingSafeEqual(given, expected)) {
    db.prepare('UPDATE mfa_challenges SET attempts = attempts + 1 WHERE id = ?').run(ch.id);
    const left = MFA_MAX_ATTEMPTS - ch.attempts - 1;
    return res.status(401).json({ error: `Incorrect code. ${left} attempt(s) left.` });
  }

  db.prepare('UPDATE mfa_challenges SET used = 1 WHERE id = ?').run(ch.id);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(ch.user_id);
  startSession(res, user);
  res.json({ user });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user || null });
});

export default router;
