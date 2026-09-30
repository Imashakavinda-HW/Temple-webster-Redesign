// MOCK PAYMENT GATEWAY — stands in for a third-party provider such as Stripe or Braintree.
//
// In a real PCI DSS set-up the card number goes straight from the browser to the
// provider, which returns a one-time *token*. Our shop only ever sees that token.
// This router imitates that provider. It is mounted on a separate path
// (/mock-gateway) and deliberately never writes card data to the database or logs;
// the orders API accepts only a token and cannot receive a card number.
//
// No real money moves. Test cards:
//   4242 4242 4242 4242 → approved
//   4000 0000 0000 0002 → declined
import { Router } from 'express';
import crypto from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { PAYMENT_METHODS } from './products.js';
import { ValidationError } from '../validate.js';

const router = Router();
const TOKEN_TTL_MS = 15 * 60 * 1000;
const tokens = new Map(); // token -> { method, last4, brand, expires } (in memory, like a gateway's own store)

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 30 });

// Luhn checksum: the standard check digit algorithm used by all card numbers.
function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function expiryValid(exp) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(exp || '');
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const endOfMonth = new Date(year, month, 1); // first day of the following month
  return endOfMonth > new Date();
}

router.post('/tokenize', limiter, (req, res) => {
  const { method } = req.body;
  if (!Object.hasOwn(PAYMENT_METHODS, method)) throw new ValidationError('Choose a payment method.');

  let last4 = null;
  let brand = PAYMENT_METHODS[method];

  if (method === 'card') {
    const number = String(req.body.cardNumber || '').replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(number) || !luhnValid(number)) throw new ValidationError('Card number is invalid.');
    if (!expiryValid(req.body.expiry)) throw new ValidationError('Card expiry is invalid or in the past.');
    if (!/^\d{3,4}$/.test(String(req.body.cvc || ''))) throw new ValidationError('Security code (CVC) is invalid.');
    if (number === '4000000000000002') {
      return res.status(402).json({ error: 'Your card was declined (test card). Try 4242 4242 4242 4242.' });
    }
    last4 = number.slice(-4);
    brand = number.startsWith('4') ? 'Visa' : number.startsWith('5') ? 'Mastercard' : 'Card';
  }
  // For PayPal / Afterpay / Zip a real site would redirect to the provider; the mock approves instantly.

  const token = `tok_${crypto.randomBytes(12).toString('hex')}`;
  tokens.set(token, { method, last4, brand, expires: Date.now() + TOKEN_TTL_MS });
  res.json({ token, last4, brand });
});

// Called by the orders API. A token can be used once only.
export function consumePaymentToken(token) {
  const t = typeof token === 'string' ? tokens.get(token) : undefined;
  if (!t) return null;
  tokens.delete(token);
  return t.expires > Date.now() ? t : null;
}

export default router;
