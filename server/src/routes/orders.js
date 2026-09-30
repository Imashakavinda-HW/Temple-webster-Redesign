// Checkout. The browser sends only *what* it wants (product ids + quantities and the
// options chosen). Every price, fee and total is recalculated here from the database,
// so a user editing the page or the request cannot change what they pay.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import * as v from '../validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { DELIVERY_OPTIONS, PROTECTION_CENTS } from './products.js';
import { consumePaymentToken } from './mockGateway.js';
import { recordEvent } from './events.js';

const router = Router();

const orderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

router.post('/', orderLimiter, optionalAuth, (req, res) => {
  const b = req.body;

  // 1. Privacy consent is mandatory (Australian Privacy Principles). Checked first and
  //    on the server, so it cannot be bypassed by disabling the checkbox in the browser.
  if (b.privacyConsent !== true) {
    throw new v.ValidationError('Privacy consent is required before payment.');
  }
  recordEvent('consent_given');

  // 2. Customer details: from the session if signed in, otherwise from the guest form.
  const name = req.user ? req.user.name : v.text(b.name, 'Full name', { max: 80 });
  const email = req.user ? req.user.email : v.email(b.email);
  const address = v.text(b.address, 'Delivery address', { min: 5, max: 200 });

  // 3. Items: look up every product and use the database price.
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) {
    throw new v.ValidationError('Your cart is empty.');
  }
  const findProduct = db.prepare('SELECT id, name, price_cents FROM products WHERE id = ?');
  const lines = b.items.map((it) => {
    const product = findProduct.get(v.int(it?.productId, 'Product', { min: 1, max: 1e9 }));
    if (!product) throw new v.ValidationError('A product in your cart is no longer available.');
    return { product, qty: v.int(it.qty, 'Quantity', { min: 1, max: 20 }) };
  });

  // 4. Delivery and the optional add-on. Protection is added ONLY if the customer sent
  //    exactly `true` — anything else (missing, "yes", 1) means not added. Opt-in by design.
  if (!Object.hasOwn(DELIVERY_OPTIONS, b.deliveryOption)) throw new v.ValidationError('Choose a delivery option.');
  const delivery = DELIVERY_OPTIONS[b.deliveryOption];
  const protection = b.protection === true;

  const subtotal = lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  const protectionCents = protection ? PROTECTION_CENTS : 0;
  const total = subtotal + delivery.cents + protectionCents;

  // 5. Payment: accept a one-time token from the gateway — never card details.
  const payment = consumePaymentToken(b.paymentToken);
  if (!payment) {
    return res.status(402).json({ error: 'Payment authorisation expired or invalid. Please try again.' });
  }

  // 6. Save the order and its items atomically: either everything is written or nothing is.
  const order = db.transaction(() => {
    const { lastInsertRowid: orderId } = db.prepare(`INSERT INTO orders
      (user_id, customer_name, email, address, delivery_option, delivery_label, delivery_cents,
       protection_added, protection_cents, subtotal_cents, total_cents,
       payment_method, payment_token, card_last4, privacy_consent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      req.user?.id ?? null, name, email, address, b.deliveryOption, delivery.label, delivery.cents,
      protection ? 1 : 0, protectionCents, subtotal, total,
      payment.method, b.paymentToken, payment.last4);

    const addItem = db.prepare(`INSERT INTO order_items
      (order_id, product_id, product_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)`);
    for (const l of lines) addItem.run(orderId, l.product.id, l.product.name, l.product.price_cents, l.qty);

    recordEvent('order_placed');
    return { id: Number(orderId), email, totalCents: total, delivery: delivery.label, status: 'Confirmed' };
  })();

  res.status(201).json({ order });
});

// Order history for the signed-in customer.
router.get('/mine', requireAuth, (req, res) => {
  const orders = db.prepare(`SELECT id, total_cents AS totalCents, delivery_label AS delivery, status, created_at AS createdAt
                             FROM orders WHERE user_id = ? ORDER BY id DESC`).all(req.user.id);
  res.json({ orders });
});

// Guest order tracking: needs BOTH the order number and the matching email,
// so nobody can look up someone else's order by guessing numbers.
router.get('/track', trackLimiter, (req, res) => {
  const id = Number(req.query.orderId);
  const email = String(req.query.email || '').trim().toLowerCase();
  const order = db.prepare(`SELECT o.id, o.status, o.delivery_label AS delivery, o.total_cents AS totalCents,
                                   o.created_at AS createdAt, SUM(i.quantity) AS itemCount
                            FROM orders o JOIN order_items i ON i.order_id = o.id
                            WHERE o.id = ? AND lower(o.email) = ? GROUP BY o.id`).get(id, email);
  if (!order) return res.status(404).json({ error: 'We couldn’t find an order with those details.' });
  res.json({ order });
});

export default router;
