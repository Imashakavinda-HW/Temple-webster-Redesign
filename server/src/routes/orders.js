// Checkout, order history, tracking and returns.
// The browser sends only *what* it wants (product ids + quantities and the options chosen).
// Every price, fee, stock check and delivery date is worked out here from the database,
// so a user editing the page or the request cannot change what they pay.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import * as v from '../validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { PROTECTION_CENTS } from './products.js';
import { DELIVERY_OPTIONS, estimateDelivery } from '../delivery.js';
import { consumePaymentToken } from './mockGateway.js';
import { recordEvent } from './events.js';

const router = Router();

const orderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });

export const STATUSES = ['Confirmed', 'Dispatched', 'In transit', 'Out for delivery', 'Delivered'];

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

  // 3. Items: look up every product, use the database price, and check real stock.
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) {
    throw new v.ValidationError('Your cart is empty.');
  }
  const findProduct = db.prepare('SELECT id, name, price_cents, eta_min, eta_max, stock FROM products WHERE id = ?');
  const lines = b.items.map((it) => {
    const product = findProduct.get(v.int(it?.productId, 'Product', { min: 1, max: 1e9 }));
    if (!product) throw new v.ValidationError('A product in your cart is no longer available.');
    const qty = v.int(it.qty, 'Quantity', { min: 1, max: 20 });
    if (qty > product.stock) {
      throw new v.ValidationError(product.stock === 0
        ? `Sorry, ${product.name} has just sold out. Please remove it from your cart.`
        : `Sorry, only ${product.stock} × ${product.name} left. Please reduce the quantity.`, 409);
    }
    return { product, qty };
  });

  // 4. Delivery: postcode → zone → fee and a dated delivery window.
  if (!Object.hasOwn(DELIVERY_OPTIONS, b.deliveryOption)) throw new v.ValidationError('Choose a delivery option.');
  const estimate = estimateDelivery({ postcode: b.postcode, lines, option: b.deliveryOption });
  if (!estimate) throw new v.ValidationError('Please enter a valid 4-digit Australian postcode.');
  const delivery = estimate.options[b.deliveryOption];
  if (!delivery.available) throw new v.ValidationError(`${delivery.label} delivery isn't available to ${estimate.postcode}.`);
  // Combining only applies when items would otherwise arrive on different days.
  const deliverTogether = b.deliverTogether === true && estimate.splitShipment;

  // 5. The optional add-on is added ONLY if the customer sent exactly `true`.
  //    Anything else (missing, "yes", 1) means not added. Opt-in by design.
  const protection = b.protection === true;

  const subtotal = lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  const protectionCents = protection ? PROTECTION_CENTS : 0;
  const total = subtotal + delivery.cents + protectionCents;

  // 6. Payment: accept a one-time token from the gateway — never card details.
  const payment = consumePaymentToken(b.paymentToken);
  if (!payment) {
    return res.status(402).json({ error: 'Payment authorisation expired or invalid. Please try again.' });
  }

  // 7. Save everything atomically: either all of it is written or none of it is.
  const order = db.transaction(() => {
    // Stock is decremented with a guarded UPDATE. If two people buy the last item at the
    // same moment, only one UPDATE matches `stock >= ?`; the other rolls back.
    const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    for (const l of lines) {
      if (takeStock.run(l.qty, l.product.id, l.qty).changes !== 1) {
        throw new v.ValidationError(`Sorry, ${l.product.name} sold out while you were checking out.`, 409);
      }
    }

    const { lastInsertRowid: orderId } = db.prepare(`INSERT INTO orders
      (user_id, customer_name, email, address, postcode, delivery_zone, est_from, est_to, deliver_together,
       delivery_option, delivery_label, delivery_cents, protection_added, protection_cents,
       subtotal_cents, total_cents, payment_method, payment_token, card_last4, privacy_consent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      req.user?.id ?? null, name, email, address, estimate.postcode, estimate.zone, delivery.from, delivery.to,
      deliverTogether ? 1 : 0, b.deliveryOption, delivery.label, delivery.cents, protection ? 1 : 0, protectionCents,
      subtotal, total, payment.method, b.paymentToken, payment.last4);

    const addItem = db.prepare(`INSERT INTO order_items
      (order_id, product_id, product_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)`);
    for (const l of lines) addItem.run(orderId, l.product.id, l.product.name, l.product.price_cents, l.qty);

    db.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'Confirmed', ?)`)
      .run(orderId, 'Order received and payment authorised. Confirmation emailed.');
    recordEvent('order_placed');

    return {
      id: Number(orderId), email, totalCents: total, delivery: delivery.label, status: 'Confirmed',
      estFrom: delivery.from, estTo: delivery.to, deliverTogether, postcode: estimate.postcode,
    };
  })();

  console.log(`[mock email] Order #${order.id} confirmed → ${email}`);
  res.status(201).json({ order });
});

// Order history for the signed-in customer.
router.get('/mine', requireAuth, (req, res) => {
  const orders = db.prepare(`SELECT id, email, total_cents AS totalCents, delivery_label AS delivery, status,
                                    est_from AS estFrom, est_to AS estTo, created_at AS createdAt
                             FROM orders WHERE user_id = ? ORDER BY id DESC`).all(req.user.id);
  res.json({ orders });
});

// Finds an order for tracking/returns. A signed-in owner can use just the id; a guest must
// supply the matching email, so nobody can look up someone else's order by guessing numbers.
function findOwnedOrder(req, orderId, email) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) return null;
  const owner = req.user && order.user_id === req.user.id;
  const emailMatches = typeof email === 'string' && email.trim().toLowerCase() === order.email.toLowerCase();
  return owner || emailMatches ? order : null;
}

router.get('/track', trackLimiter, optionalAuth, (req, res) => {
  const o = findOwnedOrder(req, req.query.orderId, req.query.email);
  if (!o) return res.status(404).json({ error: 'We couldn’t find an order with those details.' });

  const items = db.prepare(`SELECT product_name AS name, quantity AS qty FROM order_items WHERE order_id = ?`).all(o.id);
  const history = db.prepare(`SELECT status, note, created_at AS at FROM order_status_history
                              WHERE order_id = ? ORDER BY id`).all(o.id);
  const returns = db.prepare(`SELECT reason, resolution, status, created_at AS at FROM return_requests
                              WHERE order_id = ? ORDER BY id`).all(o.id);
  res.json({
    order: {
      id: o.id, status: o.status, delivery: o.delivery_label, totalCents: o.total_cents, createdAt: o.created_at,
      estFrom: o.est_from, estTo: o.est_to, deliverTogether: !!o.deliver_together, postcode: o.postcode,
      items, history, returns, steps: STATUSES,
    },
  });
});

// Self-service returns / problem reports. The resolution shown to the customer is
// decided here, based on the Australian Consumer Law.
const RESOLUTIONS = {
  damaged:        'Covered by the Australian Consumer Law. We’ll arrange a free pickup and send a replacement or give a full refund — your choice. No need to keep the packaging.',
  faulty:         'Covered by the Australian Consumer Law. We’ll arrange a free pickup and a repair, replacement or full refund.',
  missing_parts:  'We’ll dispatch the missing parts free of charge within 2 business days, or refund the item if you prefer.',
  wrong_item:     'Sorry! We’ll collect the wrong item for free and send the right one at no cost.',
  change_of_mind: 'Change-of-mind returns are accepted within 30 days in original condition. We’ll email a return label and refund your original payment method (not store credit) once it arrives.',
};

router.post('/:id/returns', trackLimiter, optionalAuth, (req, res) => {
  const o = findOwnedOrder(req, req.params.id, req.body.email);
  if (!o) return res.status(404).json({ error: 'We couldn’t find an order with those details.' });
  if (!Object.hasOwn(RESOLUTIONS, req.body.reason)) throw new v.ValidationError('Please choose a reason.');
  const details = typeof req.body.details === 'string' ? req.body.details.trim().slice(0, 500) : '';

  const ageDays = (Date.now() - new Date(`${o.created_at}Z`).getTime()) / 86_400_000;
  if (req.body.reason === 'change_of_mind' && ageDays > 30) {
    throw new v.ValidationError('Change-of-mind returns must be requested within 30 days.');
  }
  if (db.prepare(`SELECT 1 FROM return_requests WHERE order_id = ? AND status = 'Requested'`).get(o.id)) {
    throw new v.ValidationError('There is already an open request for this order — our team will be in touch.', 409);
  }

  const resolution = RESOLUTIONS[req.body.reason];
  db.prepare('INSERT INTO return_requests (order_id, reason, details, resolution) VALUES (?, ?, ?, ?)')
    .run(o.id, req.body.reason, details, resolution);
  console.log(`[mock email] Return/problem report for order #${o.id} received → ${o.email}`);
  res.status(201).json({ resolution });
});

export default router;
