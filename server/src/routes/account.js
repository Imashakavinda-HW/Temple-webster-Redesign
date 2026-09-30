// Privacy centre: customers can download everything we hold about them (APP 12 — access
// to personal information) and delete their account (APP 11.2 — destroy information that
// is no longer needed). Both require an active, MFA-verified session.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { requireAuth, endSession } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/export', (req, res) => {
  const profile = db.prepare(`SELECT id, name, email, role, privacy_consent_at AS privacyConsentAt, created_at AS createdAt
                              FROM users WHERE id = ?`).get(req.user.id);
  const orders = db.prepare(`SELECT id, customer_name AS name, email, address, postcode, delivery_label AS delivery,
                                    est_from AS estFrom, est_to AS estTo, subtotal_cents AS subtotalCents,
                                    delivery_cents AS deliveryCents, protection_cents AS protectionCents,
                                    total_cents AS totalCents, payment_method AS paymentMethod, card_last4 AS cardLast4,
                                    status, privacy_consent_at AS privacyConsentAt, created_at AS createdAt
                             FROM orders WHERE user_id = ? ORDER BY id`).all(req.user.id);
  const itemsFor = db.prepare('SELECT product_name AS name, unit_price_cents AS unitPriceCents, quantity FROM order_items WHERE order_id = ?');
  const historyFor = db.prepare('SELECT status, note, created_at AS at FROM order_status_history WHERE order_id = ? ORDER BY id');
  const returnsFor = db.prepare('SELECT reason, details, status, created_at AS at FROM return_requests WHERE order_id = ?');

  const data = {
    exportedAt: new Date().toISOString(),
    notice: 'All personal information Temple & Webster (demo) holds about you. Your password is stored only as a one-way hash and is not included. Card numbers are never stored.',
    profile,
    orders: orders.map((o) => ({ ...o, items: itemsFor.all(o.id), history: historyFor.all(o.id), returns: returnsFor.all(o.id) })),
  };
  res.setHeader('Content-Disposition', `attachment; filename="my-data-${profile.id}.json"`);
  res.json(data);
});

// Deleting an account needs the password again, so an unattended signed-in laptop isn't enough.
router.post('/delete', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), (req, res) => {
  const user = db.prepare('SELECT id, role, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (user.role === 'admin') return res.status(400).json({ error: 'Administrator accounts can’t be deleted here.' });
  if (typeof req.body.password !== 'string' || !bcrypt.compareSync(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: 'Password is incorrect.' });
  }
  // Orders keep their row (ON DELETE SET NULL) because Australian tax law requires
  // transaction records for 5 years; the login, profile and 2FA data are removed now.
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  endSession(res);
  res.json({ ok: true });
});

export default router;
