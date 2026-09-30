import { Router } from 'express';
import { db } from '../db.js';

export const DELIVERY_OPTIONS = {
  standard:   { label: 'Standard (5–8 business days)',       cents: 0 },
  express:    { label: 'Express (2–3 business days)',        cents: 2900 },
  whiteglove: { label: 'White-glove + assembly (7–10 days)', cents: 7900 },
};
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
  eta: r.eta,
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
  res.json({ delivery: DELIVERY_OPTIONS, protectionCents: PROTECTION_CENTS, paymentMethods: PAYMENT_METHODS });
});

export default router;
