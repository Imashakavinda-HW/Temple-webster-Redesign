// Admin analytics and order management. Every route here sits behind requireAdmin
// (see index.js), so only a signed-in user with role = 'admin' who has passed 2FA can use it.
import { Router } from 'express';
import { db } from '../db.js';
import { toProduct } from './products.js';
import { STATUSES } from './orders.js';
import { restoreStock } from '../seed.js';
import { ValidationError } from '../validate.js';

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
  const totals = db.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS revenue,
                                    COALESCE(SUM(protection_added), 0) AS protectionUptake,
                                    COALESCE(SUM(deliver_together), 0) AS deliverTogether,
                                    COALESCE(SUM(user_id IS NULL), 0) AS guestOrders
                             FROM orders`).get();

  const products = db.prepare('SELECT * FROM products ORDER BY id').all().map(toProduct);

  const customers = db.prepare(`SELECT id, name, email, role, password_hash AS passwordHash, created_at AS createdAt
                                FROM users ORDER BY id`).all();

  const orders = db.prepare(`SELECT o.id, o.email, o.total_cents AS totalCents, o.delivery_label AS delivery,
                                    o.status, o.payment_method AS paymentMethod, o.card_last4 AS cardLast4,
                                    o.protection_added AS protection, o.user_id IS NULL AS guest,
                                    o.postcode, o.delivery_zone AS zone, o.est_from AS estFrom, o.est_to AS estTo,
                                    (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS itemCount
                             FROM orders o ORDER BY o.id DESC`).all();

  const topProducts = db.prepare(`SELECT product_name AS name, SUM(quantity) AS units, SUM(quantity * unit_price_cents) AS revenueCents
                                  FROM order_items GROUP BY product_id ORDER BY units DESC LIMIT 5`).all();

  const returns = db.prepare(`SELECT r.id, r.order_id AS orderId, r.reason, r.details, r.status, r.created_at AS createdAt, o.email
                              FROM return_requests r JOIN orders o ON o.id = r.order_id ORDER BY r.id DESC`).all();

  res.json({
    metrics, revenueCents: totals.revenue, protectionUptake: totals.protectionUptake,
    deliverTogether: totals.deliverTogether, guestOrders: totals.guestOrders,
    products, customers, orders, topProducts, returns, statuses: STATUSES,
  });
});

// Move an order to its next status. Each change is logged in the history table and the
// customer is notified, so they never have to chase an update.
router.post('/orders/:id/status', (req, res) => {
  const order = db.prepare('SELECT id, email, status FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const next = req.body.status;
  if (!STATUSES.includes(next) || STATUSES.indexOf(next) <= STATUSES.indexOf(order.status)) {
    throw new ValidationError('Status can only move forward.');
  }
  const note = `Status changed to “${next}”. Customer notified by email and SMS.`;
  db.transaction(() => {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(next, order.id);
    db.prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, next, note);
  })();
  console.log(`[mock email/SMS] Order #${order.id} is now "${next}" → ${order.email}`);
  res.json({ ok: true });
});

// Clears demo activity (orders, events, customer accounts) and restores stock.
// Products and admin accounts are kept.
router.post('/reset', (_req, res) => {
  db.transaction(() => {
    db.exec(`DELETE FROM return_requests; DELETE FROM order_status_history; DELETE FROM order_items;
             DELETE FROM orders; DELETE FROM events; DELETE FROM mfa_challenges;
             DELETE FROM users WHERE role = 'customer';
             UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'orders';`);
    restoreStock();
  })();
  res.json({ ok: true });
});

export default router;
