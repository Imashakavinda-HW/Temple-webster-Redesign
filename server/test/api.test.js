// Automated API tests: run with `npm test` from the project root.
// They start the real Express app against a throw-away database and check every security
// rule and business rule end to end (Node's built-in test runner, no extra packages).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `tw-test-${process.pid}.db`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = 'test-secret';

let server;
let base;

before(async () => {
  const { seed } = await import('../src/seed.js');
  seed();
  const { app } = await import('../src/app.js');
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
});

// --- helpers ---------------------------------------------------------------
async function call(url, { method = 'GET', body, cookie, raw } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data, headers: res.headers, cookie: setCookie ? setCookie.split(';')[0] : null };
}

const CARD = { method: 'card', cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvc: '123' };
const token = async () => (await call('/mock-gateway/tokenize', { method: 'POST', body: CARD })).data.token;

const guestOrder = async (overrides = {}) => call('/api/orders', {
  method: 'POST',
  body: {
    items: [{ productId: 1, qty: 1 }], name: 'Guest Tester', email: 'guest@example.com',
    address: '58 Princess Ave, Springvale VIC', postcode: '3171', deliveryOption: 'standard',
    privacyConsent: true, paymentToken: await token(), ...overrides,
  },
});

async function signIn(email, password) {
  const login = await call('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200, 'password step should pass');
  const verify = await call('/api/auth/mfa/verify', {
    method: 'POST', body: { challengeId: login.data.challengeId, code: login.data.demoCode },
  });
  assert.equal(verify.status, 200, 'MFA step should pass');
  return verify.cookie;
}

// --- catalogue & delivery ------------------------------------------------------
test('catalogue: 9 seeded products with prices in cents, ETAs and stock', async () => {
  const { data } = await call('/api/products');
  assert.equal(data.length, 9);
  assert.equal(data[0].priceCents, 129900);
  assert.equal(data[0].eta, '5–8 business days');
  assert.ok(data.every((p) => Number.isInteger(p.stock)));
});

test('delivery: postcode gives zone, fee and real dates; bad postcodes are rejected early', async () => {
  const metro = await call('/api/delivery/estimate?postcode=3171&items=1:1,9:1');
  assert.equal(metro.data.state, 'VIC');
  assert.equal(metro.data.zone, 'metro');
  assert.equal(metro.data.options.standard.cents, 0);
  assert.match(metro.data.options.standard.from, /^\d{4}-\d{2}-\d{2}$/);

  const remote = await call('/api/delivery/estimate?postcode=0870&items=1:1');
  assert.equal(remote.data.zone, 'remote');
  assert.equal(remote.data.options.express.available, false);
  assert.equal(remote.data.options.standard.cents, 4900);

  assert.equal((await call('/api/delivery/estimate?postcode=99&items=1:1')).status, 400);
  assert.equal((await call('/api/delivery/estimate?postcode=9999&items=1:1')).status, 400);
});

test('delivery: dates skip weekends', async () => {
  const { addBusinessDays } = await import('../src/delivery.js');
  const friday = new Date(2026, 9, 2); // Fri 2 Oct 2026
  assert.equal(addBusinessDays(friday, 1).getDay(), 1); // → Monday
  assert.equal(addBusinessDays(friday, 5).getDate(), 9); // → Fri 9 Oct
});

// --- checkout rules --------------------------------------------------------------
test('checkout: privacy consent is required by the server', async () => {
  const res = await guestOrder({ privacyConsent: false });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /consent/i);
});

test('checkout: server re-prices everything and ignores client prices; add-on needs exactly true', async () => {
  const res = await guestOrder({
    items: [{ productId: 1, qty: 2, price: 1, priceCents: 1 }], deliveryOption: 'express', protection: 'yes',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.order.totalCents, 2 * 129900 + 2900); // no $4 add-on for "yes"
  assert.match(res.data.order.estFrom, /^\d{4}-\d{2}-\d{2}$/);

  const withAddon = await guestOrder({ protection: true });
  assert.equal(withAddon.data.order.totalCents, 129900 + 400);
});

test('payment: tokens are single-use; invalid and declined cards are refused', async () => {
  const t = await token();
  assert.equal((await guestOrder({ paymentToken: t })).status, 201);
  assert.equal((await guestOrder({ paymentToken: t })).status, 402);

  const bad = await call('/mock-gateway/tokenize', { method: 'POST', body: { ...CARD, cardNumber: '4242424242424241' } });
  assert.equal(bad.status, 400);
  const declined = await call('/mock-gateway/tokenize', { method: 'POST', body: { ...CARD, cardNumber: '4000000000000002' } });
  assert.equal(declined.status, 402);
  const expired = await call('/mock-gateway/tokenize', { method: 'POST', body: { ...CARD, expiry: '01/20' } });
  assert.equal(expired.status, 400);
});

test('stock: sold-out and over-quantity orders are refused; stock decrements', async () => {
  assert.equal((await guestOrder({ items: [{ productId: 7, qty: 1 }] })).status, 409); // rug: 0 in stock
  assert.equal((await guestOrder({ items: [{ productId: 4, qty: 4 }] })).status, 409); // bedside: 3 in stock

  const before = (await call('/api/products/4')).data.stock;
  assert.equal((await guestOrder({ items: [{ productId: 4, qty: 2 }] })).status, 201);
  assert.equal((await call('/api/products/4')).data.stock, before - 2);
});

test('delivery: express to a remote postcode is refused', async () => {
  const res = await guestOrder({ postcode: '0870', deliveryOption: 'express' });
  assert.equal(res.status, 400);
});

// --- tracking & returns ------------------------------------------------------------
test('tracking needs the matching email and shows a status timeline; returns work once', async () => {
  const id = 1001;
  assert.equal((await call(`/api/orders/track?orderId=${id}&email=someone@else.com`)).status, 404);
  const ok = await call(`/api/orders/track?orderId=${id}&email=GUEST@example.com`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.order.history[0].status, 'Confirmed');

  const wrong = await call(`/api/orders/${id}/returns`, { method: 'POST', body: { email: 'x@y.com', reason: 'damaged' } });
  assert.equal(wrong.status, 404);
  const r = await call(`/api/orders/${id}/returns`, { method: 'POST', body: { email: 'guest@example.com', reason: 'damaged' } });
  assert.equal(r.status, 201);
  assert.match(r.data.resolution, /Australian Consumer Law/);
  const dup = await call(`/api/orders/${id}/returns`, { method: 'POST', body: { email: 'guest@example.com', reason: 'faulty' } });
  assert.equal(dup.status, 409);
});

// --- accounts, MFA, roles --------------------------------------------------------------
test('registration: consent required, common passwords blocked, duplicates refused', async () => {
  const body = { name: 'Jane Smith', email: 'jane@example.com', password: 'Linen-Sofa-42', consent: true };
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { ...body, consent: false } })).status, 400);
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { ...body, password: 'password123' } })).status, 400);
  assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 201);
  assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 409);
});

test('login: same error for unknown email and wrong password; MFA code required, single use', async () => {
  const unknown = await call('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'whatever1' } });
  const wrongPw = await call('/api/auth/login', { method: 'POST', body: { email: 'jane@example.com', password: 'nope-nope' } });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.data, wrongPw.data);

  const login = await call('/api/auth/login', { method: 'POST', body: { email: 'jane@example.com', password: 'Linen-Sofa-42' } });
  assert.equal(login.cookie, null, 'no session before MFA');
  const bad = await call('/api/auth/mfa/verify', { method: 'POST', body: { challengeId: login.data.challengeId, code: '000000' } });
  assert.equal(bad.status, 401);
  const good = await call('/api/auth/mfa/verify', { method: 'POST', body: { challengeId: login.data.challengeId, code: login.data.demoCode } });
  assert.equal(good.status, 200);
  assert.match(good.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(good.headers.get('set-cookie'), /SameSite=Strict/i);
  const reuse = await call('/api/auth/mfa/verify', { method: 'POST', body: { challengeId: login.data.challengeId, code: login.data.demoCode } });
  assert.equal(reuse.status, 400);
});

test('roles: guests get 401 and customers get 403 on admin routes', async () => {
  assert.equal((await call('/api/admin/analytics')).status, 401);
  const cookie = await signIn('jane@example.com', 'Linen-Sofa-42');
  assert.equal((await call('/api/admin/analytics', { cookie })).status, 403);
  assert.equal((await call('/api/auth/me', { cookie: 'tw_session=forged.token.value' })).data.user, null);
});

test('admin: analytics readable; order status only moves forward and is logged', async () => {
  const cookie = await signIn('admin@templewebster.demo', 'Admin#2026');
  const a = await call('/api/admin/analytics', { cookie });
  assert.equal(a.status, 200);
  assert.ok(a.data.metrics.ordersPlaced >= 4);
  assert.equal(a.data.returns.length, 1);

  assert.equal((await call('/api/admin/orders/1001/status', { method: 'POST', cookie, body: { status: 'Dispatched' } })).status, 200);
  assert.equal((await call('/api/admin/orders/1001/status', { method: 'POST', cookie, body: { status: 'Confirmed' } })).status, 400);
  const t = await call('/api/orders/track?orderId=1001&email=guest@example.com');
  assert.deepEqual(t.data.order.history.map((h) => h.status), ['Confirmed', 'Dispatched']);
});

test('privacy: data export has no password hash; deletion needs the password', async () => {
  const cookie = await signIn('jane@example.com', 'Linen-Sofa-42');
  const exp = await call('/api/account/export', { cookie });
  assert.equal(exp.status, 200);
  assert.equal(exp.data.profile.email, 'jane@example.com');
  assert.ok(!JSON.stringify(exp.data).includes('$2b$'), 'no bcrypt hash in export');

  assert.equal((await call('/api/account/delete', { method: 'POST', cookie, body: { password: 'wrong' } })).status, 401);
  assert.equal((await call('/api/account/delete', { method: 'POST', cookie, body: { password: 'Linen-Sofa-42' } })).status, 200);
  assert.equal((await call('/api/auth/me', { cookie })).data.user, null);
});

// --- transport-level protections ----------------------------------------------------------
test('security headers and input limits', async () => {
  const res = await call('/api/products');
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);

  const malformed = await call('/api/auth/login', { method: 'POST', raw: '{bad json', body: {} });
  assert.equal(malformed.status, 400);
  const huge = await call('/api/events', { method: 'POST', body: { type: 'visit', pad: 'x'.repeat(20_000) } });
  assert.equal(huge.status, 413);
  assert.equal((await call('/api/events', { method: 'POST', body: { type: 'order_placed' } })).status, 400);
});
