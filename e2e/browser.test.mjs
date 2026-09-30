// Browser end-to-end test + accessibility audit. Run with `npm run test:e2e` (see e2e/run.mjs).
// It shops the site like a real customer and an admin, in both themes, at desktop and phone
// sizes, and runs axe-core (WCAG 2.0/2.1/2.2 A+AA + best practice) on every page.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const B = process.env.BASE_URL || 'http://localhost:3001';
const out = process.env.SCREENSHOTS || null; // set to a folder to save screenshots
if (out) fs.mkdirSync(out, { recursive: true });
const axeSrc = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g|40[01349]/.test(m.text() + (m.location()?.url || ''))) errors.push('console: ' + m.text()); });
const log = (...a) => console.log(...a);
const shot = (name, fullPage = false) => (out ? page.screenshot({ path: `${out}/${name}`, fullPage }) : null);
let pass = 0;
const check = (cond, msg) => { if (!cond) { errors.push('FAIL: ' + msg); log('  ✗', msg); } else { pass++; log('  ✓', msg); } };
const toastHas = (t) => page.waitForFunction((x) => document.querySelector('.toast')?.textContent.includes(x), t, { timeout: 5000 }).then(() => true).catch(() => false);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2713}\u{2605}\u{2661}\u{2665}\u{21BB}]/u;
const a11y = {}; const emojiPages = [];
async function audit(name) {
  await page.mouse.move(0, 0); await page.waitForTimeout(2500); // let animations settle
  const text = await page.evaluate(() => document.body.innerText);
  if (EMOJI.test(text)) emojiPages.push(name + ': ' + text.match(EMOJI)[0]);
  await page.addScriptTag({ content: axeSrc });
  a11y[name] = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
    .violations.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' — ' + (n.any[0]?.message || n.all[0]?.message || '')).join(' | ')}`));
}
const focusedIsVisible = () => page.evaluate(() => {
  const el = document.activeElement; const r = el.getBoundingClientRect();
  const h = document.querySelector('header.top'); const hb = getComputedStyle(h).position === 'sticky' ? h.getBoundingClientRect().bottom : 0;
  return r.top >= hb - 1 && r.bottom <= innerHeight + 1;
});

log('HOME & CATALOGUE');
await page.goto(B); await page.waitForSelector('.card .nm');
check(await page.locator('.card').count() === 9, '9 products');
check(await page.locator('.card .art svg').count() === 9, 'product art is SVG (9 icons)');
check(await page.locator('.rooms .room').count() === 5, 'shop-by-room: 5 rooms');
check((await page.title()).startsWith('Temple & Webster'), 'home page title');
check(await page.locator('.nav >> text=Analytics').count() === 0, 'Analytics hidden from guests');
check((await page.locator('.card').nth(6).locator('.stock').textContent()) === 'Out of stock', 'rug Out of stock');
check((await page.locator('.card').nth(3).locator('.stock').textContent()) === 'Only 3 left', 'bedside Only 3 left');
await audit('home'); await shot(`1-home.png`, true);
await page.keyboard.press('Tab');
check((await page.evaluate(() => document.activeElement.textContent)) === 'Skip to main content', 'skip link first Tab stop');
await page.click('text=Explore the collection'); await page.waitForTimeout(900);
check(await page.evaluate(() => document.activeElement.id === 'collectionTitle' && document.getElementById('collectionTitle').getBoundingClientRect().top < innerHeight / 2 && scrollY > 300), 'Explore button scrolls to collection and moves focus');
await page.click('.rooms >> text=Office'); await page.waitForURL(/cat=Office/); await page.waitForTimeout(150);
check(await page.locator('.card').count() === 2, 'room tile Office → 2 products');
check((await page.locator('.cats a[aria-current=page]').textContent()) === 'Office', 'active category marked');
check((await page.title()).startsWith('Office'), 'category page title');
await page.fill('.search input', 'desk'); await page.waitForTimeout(150);
check(await page.locator('.card').count() === 1, 'search desk → 1');
check(await page.locator('.search input').evaluate((el) => el === document.activeElement), 'search box keeps focus while typing');
await page.fill('.search input', 'zzz'); await page.waitForTimeout(150);
check(await page.locator('text=No pieces match').count() === 1, 'empty state with action');

log('SCROLL RESTORATION + ROUTE FOCUS');
await page.goto(B); await page.waitForSelector('.card .nm');
await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' })); await page.waitForTimeout(300);
const y0 = await page.evaluate(() => scrollY);
await page.locator('.card .nm').nth(4).click(); await page.waitForSelector('.crumbs');
check(await page.evaluate(() => scrollY) === 0, 'new page starts at top');
check(await page.evaluate(() => document.activeElement.tagName) === 'H1', 'focus moved to page heading after navigation');
check((await page.title()).startsWith('Rattan Lounge Set'), 'product page title');
await page.goBack(); await page.waitForSelector('.card .nm'); await page.waitForTimeout(300);
const y1 = await page.evaluate(() => scrollY);
check(Math.abs(y1 - y0) < 5, `Back restores scroll position (${y0} → ${y1})`);

log('PRODUCT');
await page.goto(B + '/product/9'); await page.waitForSelector('.crumbs');
check((await page.locator('.crumbs li').allTextContents()).join('>') === 'Collection>Office>Electric Standing Desk', 'breadcrumb Collection > Office > product');
await page.fill('#pcProduct', '3171'); await page.waitForSelector('.est-result');
check(/Arrives .* to 3171 VIC \(Metro\)/.test(await page.locator('.est-result').textContent()), 'delivery estimate 3171');
await page.click('.savebig'); check(await toastHas('Saved for later'), 'save for later');
check((await page.locator('.savebig').getAttribute('aria-pressed')) === 'true', 'save button reports pressed state');
await audit('product'); await shot(`2-product.png`);
await page.click('button:has-text("Add to cart")'); check(await toastHas('added'), 'add desk');
await page.goto(B + '/product/1'); await page.waitForSelector('.crumbs'); await page.click('button:has-text("Add to cart")');
await page.goto(B + '/product/4'); await page.waitForSelector('.crumbs'); for (let i = 0; i < 4; i++) await page.click('button:has-text("Add to cart")');
check(await toastHas('Only 3 available'), 'cannot exceed stock');
await page.goto(B + '/saved'); await page.waitForSelector('.card'); check(await page.locator('.card').count() === 1, 'saved page'); await audit('saved');

log('CART + UNDO');
await page.goto(B + '/cart'); await page.waitForSelector('.cartline');
check((await page.inputValue('#pcCart')) === '3171', 'postcode remembered');
await page.waitForSelector('text=different warehouses'); check(true, 'split-shipment notice');
const before = await page.locator('.cartline').count();
await page.click('button[aria-label="Remove Hamptons Slip-Cover Sofa"]');
check(await page.locator('.cartline').count() === before - 1, 'item removed');
await page.click('.toast-action'); await page.waitForTimeout(200);
check(await page.locator('.cartline').count() === before, 'Undo restores the item');
check((await page.locator('.cartline .nm').nth(1).textContent()) === 'Hamptons Slip-Cover Sofa', 'Undo keeps original position');
await audit('cart'); await shot(`3-cart.png`, true);

log('CHECKOUT');
await page.click('text=Proceed to checkout'); await page.waitForSelector('#coConsent');
check(!(await page.isChecked('#coAddon')) && !(await page.isChecked('#coConsent')), 'add-on & consent unticked');
await page.click('button:has-text("& place order")');
await page.waitForSelector('.error-summary');
check(await page.evaluate(() => document.activeElement.classList.contains('error-summary')), 'error summary receives focus');
const probs = await page.locator('.error-summary li').count();
check(probs === 7, `summary lists all 7 missing fields (${probs})`);
check((await page.getAttribute('#coName', 'aria-invalid')) === 'true' && (await page.getAttribute('#coName', 'aria-describedby')) === 'coName-error', 'field linked to its error');
await audit('checkout-errors'); await shot(`4a-checkout-errors.png`, true);
await page.click('.error-summary a >> nth=0');
check(await page.evaluate(() => document.activeElement.id) === 'coName', 'summary link jumps to field');
check(await focusedIsVisible(), 'focused field not hidden under sticky header');
await page.fill('#coName', 'Guest Tester'); await page.fill('#coEmail', 'guest@example.com'); await page.fill('#coAddr', '58 Princess Ave, Springvale VIC');
await page.fill('#ccNum', '4242424242424242'); await page.fill('#ccExp', '1229'); await page.fill('#ccCvc', '123');
check((await page.inputValue('#ccNum')) === '4242 4242 4242 4242' && (await page.inputValue('#ccExp')) === '12/29', 'card number & expiry auto-formatted');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.focus('#coName');
check(await focusedIsVisible(), 'focus-not-obscured after scrolling (scroll-padding)');
await page.fill('#coPostcode', '0870'); await page.waitForTimeout(400);
check(await page.locator('#coDelivery option[value=express]').isDisabled(), 'express disabled for remote');
await page.fill('#coPostcode', '3171'); await page.waitForTimeout(400);
await page.check('#coTogether'); await page.check('#coAddon');
check(await page.locator('.step li.done').count() === 2, 'steps: details + delivery complete, payment pending consent');
await page.check('#coConsent');
check(await page.locator('.step li.done').count() === 3, 'steps: all complete');
check((await page.locator('.totrow.grand span').last().textContent()) === '$2,839', 'total $2,839');
await audit('checkout'); await shot(`4-checkout.png`, true);
await page.click('button:has-text("& place order")'); await page.waitForSelector('text=confirmed');
check(await page.evaluate(() => scrollY) === 0, 'confirmation starts at top');
check(/arrives/.test(await page.locator('.pill').textContent()), 'confirmation shows dates');
await audit('confirmation'); await shot(`5-confirmation.png`);

log('TRACK + RETURN');
await page.click('text=Track this order'); await page.waitForSelector('.timeline');
check(await page.locator('.timeline li.done').count() === 1, 'timeline Confirmed');
await page.click('text=Report a problem or start a return'); await page.click('button:has-text("Submit request")');
check((await page.locator('#rtReason-error').textContent()).includes('Choose what happened'), 'return reason inline error');
await page.selectOption('#rtReason', 'damaged'); await page.fill('#rtDetails', 'Desk leg scratched'); await page.click('button:has-text("Submit request")');
await page.waitForSelector('text=Australian Consumer Law'); check(true, 'return request ACL resolution');
await audit('track'); await shot(`6-track.png`, true);

log('ADMIN (MFA)');
await page.goto(B + '/analytics'); await page.waitForSelector('text=Administrator access required');
await page.goto(B + '/account'); await page.waitForSelector('#liEmail');
await page.click('form button:has-text("Sign in")');
check((await page.locator('#liEmail-error').textContent()).includes('Enter your email'), 'sign-in empty fields inline errors');
await audit('account-signin');
await page.fill('#liEmail', 'admin@templewebster.demo'); await page.fill('#liPass', 'wrong-pass');
await page.click('form button:has-text("Sign in")'); await page.waitForSelector('form .error');
check((await page.locator('form .error').textContent()).includes('Invalid email or password'), 'wrong password inline error');
await page.fill('#liPass', 'Admin#2026');
await page.click('.pw-toggle >> nth=0'); check((await page.getAttribute('#liPass', 'type')) === 'text', 'password show toggle');
await page.click('.pw-toggle >> nth=0'); check((await page.getAttribute('#liPass', 'type')) === 'password', 'password hide toggle');
await page.click('form button:has-text("Sign in")'); await page.waitForSelector('#mfaCode');
check(await page.evaluate(() => document.activeElement.id) === 'mfaCode', 'focus moves into MFA dialog');
for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
check(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'focus trapped in dialog');
await audit('mfa'); await shot(`7-mfa.png`);
const code = (await page.locator('.modal .hint').first().textContent()).match(/\d{6}/)[0];
await page.fill('#mfaCode', code); await page.click('text=Verify & Sign In'); await page.waitForSelector('text=My account');
check(await page.locator('.nav a.active').count() === 1, 'current nav item highlighted');
await page.click('.nav >> text=Analytics'); await page.waitForSelector('.kpi');
await page.click('button:has-text("Mark “Dispatched”")'); await page.waitForSelector('button:has-text("Mark “In transit”")');
check(true, 'admin advanced order'); check(await page.locator('text=Desk leg scratched').count() === 1, 'admin sees return');
await audit('analytics'); await shot(`8-analytics.png`, true);
await page.goto(B + '/account'); await page.click('button:has-text("Sign out")'); await page.waitForTimeout(300);

log('CUSTOMER ACCOUNT + PRIVACY');
await page.goto(B + '/account'); await page.waitForSelector('#regName');
await page.fill('#regName', 'Jane Smith'); await page.fill('#regEmail', 'jane@example.com'); await page.fill('#regPass', 'password123');
await page.check('#regConsent'); await page.click('button:has-text("Create account")');
await page.waitForSelector('#regPass-error');
check((await page.locator('#regPass-error').textContent()).includes('too common'), 'leaked password: inline error on the password field');
await page.fill('#regPass', 'Linen-Sofa-42'); await page.click('button:has-text("Create account")');
check(await toastHas('Account created'), 'account created');
check(await page.evaluate(() => document.activeElement.id) === 'liPass', 'focus moves to sign-in password');
await page.fill('#liPass', 'Linen-Sofa-42'); await page.click('form button:has-text("Sign in")'); await page.waitForSelector('#mfaCode');
await page.fill('#mfaCode', '000000'); await page.click('text=Verify & Sign In');
await page.waitForSelector('.modal .error'); check((await page.locator('.modal .error').textContent()).includes('4 attempt'), 'MFA wrong code countdown');
const code2 = (await page.locator('.modal .hint').first().textContent()).match(/\d{6}/)[0];
await page.fill('#mfaCode', code2); await page.click('text=Verify & Sign In'); await page.waitForSelector('text=Privacy centre');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download my data')]);
const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
check(json.profile.email === 'jane@example.com' && !JSON.stringify(json).includes('$2b$'), 'data export, no hash');
await audit('account'); await shot(`9-account.png`, true);
await page.click('text=Delete my account'); await page.click('text=Permanently delete');
check((await page.locator('#delPass-error').textContent()).includes('Enter your password'), 'delete needs password (inline)');
await page.fill('#delPass', 'Linen-Sofa-42'); await page.click('text=Permanently delete');
check(await toastHas('deleted'), 'account deleted');

log('THEMES');
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(B); await page.waitForSelector('.card .nm');
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'Daylight (Hearth & Hollow) is the default theme');
check(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(255, 255, 255)', 'Daylight background is white');
check(await page.evaluate(() => getComputedStyle(document.querySelector('.card .art')).backgroundColor) === 'rgb(239, 231, 220)', 'product tile uses Hearth & Hollow tint');
await shot('11-daylight-home.png', true);
await page.click('.theme-toggle');
check((await page.getAttribute('.theme-toggle', 'aria-pressed')) === 'true', 'toggle reports pressed');
await page.goto(B, { waitUntil: 'domcontentloaded' });
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Evening choice remembered and applied before the app loads (no flash)');
await page.waitForSelector('.card .nm');
check(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(15, 13, 12)', 'Evening background is the original dark');
await audit('EVENING home'); await shot('12-evening-home.png', true);
for (const [name, url, sel] of [['EVENING product', '/product/1', '.crumbs'], ['EVENING saved', '/saved', 'h1'], ['EVENING track', '/track', 'h1'], ['EVENING about', '/about', 'h1']]) {
  await page.goto(B + url); await page.waitForSelector(sel); await audit(name);
}
await page.goto(B + '/account'); await page.waitForSelector('#liEmail'); await page.click('form button:has-text("Sign in")'); await audit('EVENING account errors');
await page.goto(B + '/product/6'); await page.waitForSelector('.crumbs'); await page.click('button:has-text("Add to cart")');
await page.goto(B + '/checkout'); await page.waitForSelector('#coConsent'); await page.click('button:has-text("& place order")'); await page.waitForSelector('.error-summary');
await audit('EVENING checkout errors'); await shot('13-evening-checkout.png', true);
await page.click('.theme-toggle');
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'toggle back to Daylight');

log('OTHER PAGES');
await page.goto(B + '/about'); await page.waitForSelector('h1'); await audit('about');
await page.goto(B + '/nope'); await page.waitForSelector('h1'); await audit('404');
check((await page.title()).startsWith('Page not found'), '404 title');

log('MOBILE / LANDSCAPE / REDUCED MOTION');
for (const [w, h] of [[375, 812], [390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const p of ['/', '/product/1', '/cart', '/checkout', '/track', '/account', '/saved']) {
    await page.goto(B + p); await page.waitForTimeout(250);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 0) check(false, `overflow ${w}x${h} ${p} (${ov}px)`);
  }
  check(true, `no horizontal scroll at ${w}×${h} on 7 pages`);
}
await page.setViewportSize({ width: 390, height: 844 }); await page.goto(B + '/account'); await page.waitForSelector('#liEmail');
check(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('liEmail')).fontSize)) >= 16, 'mobile inputs ≥16px (no iOS zoom)');
check(await page.evaluate(() => getComputedStyle(document.querySelector('header.top')).position) === 'static', 'mobile header not sticky');
const small = await page.evaluate(() => [...document.querySelectorAll('.nav a, .cats a, button, .qbtn')].filter((e) => e.offsetParent)
  .map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 24).length);
check(small === 0, `mobile nav/buttons ≥44px tall (${small} too small)`);
await page.goto(B); await shot(`10-mobile.png`); await audit('mobile-home');
const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
const rp = await rm.newPage(); await rp.goto(B); await rp.waitForSelector('.btn');
check(await rp.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionDuration.split(',').every((d) => parseFloat(d) === 0)), 'reduced motion: transitions off');
await rm.close();

log('\nACCESSIBILITY (axe: WCAG 2.0/2.1/2.2 A+AA + best practice):');
for (const [k, v] of Object.entries(a11y)) log(`  ${k}: ${v.length ? v.join('\n        ') : '0 violations'}`);
log('\nEMOJI ON SCREEN:', emojiPages.length ? emojiPages : 'none');
log(`\nCHECKS PASSED: ${pass}`);
log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
const a11yFailures = Object.values(a11y).reduce((n, v) => n + v.length, 0);
process.exitCode = errors.length || a11yFailures || emojiPages.length ? 1 : 0;
