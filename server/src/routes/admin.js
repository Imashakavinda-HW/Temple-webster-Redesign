// Admin analytics. Every route here sits behind requireAdmin (see index.js), so only a
// signed-in user with role = 'admin' (who has also passed 2FA) can read it.
import { Router } from 'express';
import { db } from '../db.js';
import { toProduct } from './products.js';

const router = Router();

router.get('/analytics', (_req, res) => {
  // One GROUP BY query turns the raw event log into funnel counts.
  const counts = Object.fromEntries(
    db.prepare('SELECT type, COUNT(*) AS n FROM events GROUP BY type').all().map((r) => [r.type, r.n]),
  );
  const metrics = {
    visits: counts.visit || 0,
    addToCart: counts.add_to_cart || 0,
    checkoutStart: counts.checkout_start || 0,
    consentGiven: counts.consent_given || 0,
    ordersPlaced: counts.order_placed || 0,
  };
  const { revenue, protectionUptake } = db.prepare(
    'SELECT COALESCE(SUM(total_cents), 0) AS revenue, COALESCE(SUM(protection_added), 0) AS protectionUptake FROM orders',
  ).get();

  const products = db.prepare('SELECT * FROM products ORDER BY id').all().map(toProduct);

  const customers = db.prepare(`SELECT id, name, email, role, password_hash AS passwordHash, created_at AS createdAt
                                FROM users ORDER BY id`).all();

  const orders = db.prepare(`SELECT o.id, o.email, o.total_cents AS totalCents, o.delivery_label AS delivery,
                                    o.status, o.payment_method AS paymentMethod, o.card_last4 AS cardLast4,
                                    o.protection_added AS protection, o.user_id IS NULL AS guest,
                                    (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS itemCount
                             FROM orders o ORDER BY o.id DESC`).all();

  const topProducts = db.prepare(`SELECT product_name AS name, SUM(quantity) AS units, SUM(quantity * unit_price_cents) AS revenueCents
                                  FROM order_items GROUP BY product_id ORDER BY units DESC LIMIT 5`).all();

  res.json({ metrics, revenueCents: revenue, protectionUptake, products, customers, orders, topProducts });
});

// Clears demo activity (orders, events, customer accounts) but keeps products and admins.
router.post('/reset', (_req, res) => {
  db.transaction(() => {
    db.exec(`DELETE FROM order_items; DELETE FROM orders; DELETE FROM events; DELETE FROM mfa_challenges;
             DELETE FROM users WHERE role = 'customer';
             UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'orders';`);
  })();
  res.json({ ok: true });
});

export default router;
