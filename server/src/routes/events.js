// Web-analytics events. The browser may report only harmless page-level events.
// "consent_given" and "order_placed" are recorded by the server itself inside the
// order route, so those funnel numbers cannot be faked from the browser.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';

const CLIENT_EVENTS = new Set(['visit', 'add_to_cart', 'checkout_start']);
const insertEvent = db.prepare('INSERT INTO events (type) VALUES (?)');

export const recordEvent = (type) => insertEvent.run(type);

const router = Router();

router.post('/', rateLimit({ windowMs: 60 * 1000, limit: 120 }), (req, res) => {
  if (!CLIENT_EVENTS.has(req.body.type)) return res.status(400).json({ error: 'Unknown event.' });
  recordEvent(req.body.type);
  res.status(204).end();
});

export default router;
