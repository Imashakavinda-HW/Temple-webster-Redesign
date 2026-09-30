import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { DELIVERY_OPTIONS, ZONES, estimateDelivery } from '../delivery.js';

export const PROTECTION_CENTS = 400;
export const PAYMENT_METHODS = {
  card:     'Credit / Debit card (Visa, Mastercard)',
  paypal:   'PayPal',
  afterpay: 'Afterpay — 4 interest-free instalments',
  zip:      'Zip Pay',
};

// Convert a database row (snake_case) to the JSON shape the front-end uses.
export const toProduct = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  priceCents: r.price_cents,
  icon: r.icon,
  etaMin: r.eta_min,
  etaMax: r.eta_max,
  eta: `${r.eta_min}–${r.eta_max} business days`,
  stock: r.stock,
  rating: r.rating,
  reviewCount: r.review_count,
  tag: r.tag,
  description: r.description,
});

const router = Router();

router.get('/products', (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY id').all().map(toProduct));
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json(toProduct(row));
});

// Checkout prices come from the server so the browser and the order total never disagree.
router.get('/checkout/options', (_req, res) => {
  res.json({ delivery: DELIVERY_OPTIONS, zones: ZONES, protectionCents: PROTECTION_CENTS, paymentMethods: PAYMENT_METHODS });
});

// GET /api/delivery/estimate?postcode=3171&items=1:2,9:1&option=standard
// Used on the product page, the cart and checkout, so fees and dates are visible early.
router.get('/delivery/estimate', rateLimit({ windowMs: 60 * 1000, limit: 120 }), (req, res) => {
  const find = db.prepare('SELECT id, eta_min, eta_max FROM products WHERE id = ?');
  const lines = String(req.query.items || '').split(',').slice(0, 50).map((pair) => {
    const [id, qty] = pair.split(':').map(Number);
    const product = Number.isInteger(id) ? find.get(id) : undefined;
    return product && Number.isInteger(qty) && qty > 0 ? { product, qty } : null;
  }).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'No items to estimate.' });

  const estimate = estimateDelivery({ postcode: req.query.postcode, lines, option: req.query.option });
  if (!estimate) return res.status(400).json({ error: 'Please enter a valid 4-digit Australian postcode.' });
  res.json(estimate);
});

export default router;
