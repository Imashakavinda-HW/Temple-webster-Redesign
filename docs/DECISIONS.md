# How this prototype was built, and why

This document walks through the build in the order it happened. Each step says **what** was done, **why**, and **where to look in the code**, so you can explain it in your own words. The "Say it like this" lines are short summaries you can use when presenting.

---

## Step 0: Starting point

The original was one HTML file. It had all the CSS and JavaScript inline, and it used the browser's `localStorage` as its "database". That's fine for a click-through mock-up, but it has three problems for a *secure* e-business solution:

1. **Everything runs in the customer's browser.** Anyone can open DevTools and change prices, skip the consent check, or make themselves an admin.
2. **The "database" is per browser.** The admin analytics only saw one person's activity.
3. **Security features were cosmetic.** The MFA code was hard-coded (`482913`), and the password "hash" was a simple string checksum that anyone could reverse or collide.

> **Say it like this:** "The original proved the design. The rebuild moves every trust decision to a server the customer can't tamper with, and stores data in a real database."

---

## Step 1: Architecture: three tiers

| Tier | Choice | Why this and not something else |
|---|---|---|
| Presentation | **React** (built with **Vite**) | The design has repeated pieces (product cards, security badges, consent boxes). React components let us write each once and reuse it. Vite is the current standard React build tool and is much faster than the older Create React App. |
| Application | **Node.js + Express** | Same language (JavaScript) as the front-end. Express is the most widely used Node web framework, it's minimal, and it's easy to explain. Version 5 automatically catches errors thrown in route handlers. |
| Data | **SQLite** via `better-sqlite3` | A real SQL database stored in a single file. There's no server to install, so an examiner can run the project with just `npm install`. It supports transactions, foreign keys and constraints. For production we'd move to PostgreSQL, and the SQL would barely change. |

**Monorepo with npm workspaces:** `client/` and `server/` live in one repository. A single `npm install` at the root installs both, and `npm run dev` starts both at once (using `concurrently`).

**Development vs presentation mode:**
- In `npm run dev`, Vite serves React on port 5173 and *proxies* `/api` calls to Express on port 3001 (`client/vite.config.js`). The browser therefore sees one origin, so cookies work and we don't need CORS (which would be another thing to secure).
- In `npm start`, Express serves the compiled React files itself (`server/src/index.js`, bottom). That gives one server and one port, which is how it would be deployed.

> **Say it like this:** "A classic three-tier architecture: React for presentation, an Express REST API for business logic and security, and SQLite for persistence."

---

## Step 2: Database design (`server/src/schema.sql`)

Eight tables:

| Table | Purpose |
|---|---|
| `products` | The 9 seeded products, with delivery estimate (`eta_min`/`eta_max` business days) and real `stock` |
| `users` | Customers and admins, with the password stored as a bcrypt hash, a `role`, and the timestamp of their privacy consent |
| `mfa_challenges` | One-time 2FA codes (hashed), with expiry time and attempt counter |
| `orders` | One row per order. `user_id` is NULL for guest checkout. |
| `order_items` | The products in each order (one-to-many from `orders`) |
| `order_status_history` | Timeline of every status change for each order (added in Step 8) |
| `return_requests` | Self-service returns and problem reports (added in Step 8) |
| `events` | Web-analytics log (visit, add to cart, checkout start, consent, order) |

Key decisions:
- **Money is stored in integer cents** (`129900`, not `1299.00`). Floating-point numbers can't represent some decimals exactly (in JavaScript, `0.1 + 0.2 = 0.30000000000000004`). Integers avoid rounding errors in totals.
- **`order_items` stores a snapshot** of the product name and the price actually charged. If a price changes later, old orders still show what the customer paid.
- **Normalised**: `order_items` is a separate table rather than a text list inside `orders`. That lets us run the "best sellers" query with SQL.
- **CHECK constraints** (e.g. `quantity BETWEEN 1 AND 20`, `role IN ('customer','admin')`, `protection_added IN (0,1)`) form a second line of defence. Even if the API had a bug, the database would refuse bad data.
- **Consent is recorded with a timestamp** (`privacy_consent_at`) on both users and orders. Under the Privacy Act you should be able to show *when* someone consented.
- **Foreign keys** are switched on (`db.js`), because SQLite leaves them off by default.
- **Order numbers start at #1001**, matching the original design.

**Seeding (`server/src/seed.js`):** on every server start, the seed step fills the tables only if they are empty. It inserts the 9 products and one admin account. `npm run seed` wipes the data and re-seeds.

> **Say it like this:** "The schema is normalised, stores money as integer cents, snapshots prices on each order line, and uses constraints so the database itself refuses invalid data."

---

## Step 3: Security layer on the server

### 3.1 Passwords: bcrypt (`routes/auth.js`)
Passwords are hashed with **bcrypt at cost factor 12**. bcrypt is *deliberately slow* (about 250 ms per hash) and adds a random **salt** to each one. Two users with the same password therefore get different hashes, and an attacker who steals the database can't use pre-computed tables to crack them. The admin page shows the stored hashes (`$2b$12$...`) as evidence that no plain-text passwords are kept.

### 3.2 Multi-factor authentication (`routes/auth.js`, `components/MfaModal.jsx`)
Login is split into two requests:
1. `POST /api/auth/login` checks the password. If it's correct, the server generates a **random 6-digit code** using `crypto.randomInt`, which is cryptographically secure, unlike `Math.random`. It stores only the code's **SHA-256 hash** with a **5-minute expiry**, and returns a random challenge ID.
2. `POST /api/auth/mfa/verify` checks the code. After **5 wrong attempts** the challenge is locked. A code works **once only**.

Only after step 2 does the server create a session. A stolen password alone is not enough.

In a real deployment the code would be emailed or sent by SMS. A prototype has no mail server, so the code is printed to the server console and shown in the dialog as "Demo code". `SHOW_MFA_CODE=false` turns this off.

Other details:
- **Same error for wrong email and wrong password** ("Invalid email or password"), so attackers can't find out which emails have accounts. If the email doesn't exist, the server still runs a bcrypt comparison against a dummy hash, so the response takes the same time either way.
- **Constant-time comparison** (`crypto.timingSafeEqual`) for the code, so response timing doesn't leak how many digits were right.
- **Rate limiting**: at most 20 authentication attempts per IP address every 15 minutes (`express-rate-limit`). This blocks brute-force attacks.

### 3.3 Sessions: signed JWT in an httpOnly cookie (`middleware/auth.js`)
After MFA, the server sets a cookie containing a **JSON Web Token** signed with a secret key.
- `httpOnly`: page JavaScript can't read it, so even an XSS bug can't steal the session.
- `SameSite=Strict`: the browser won't send it with requests from other websites. This defends against **CSRF**.
- **Signed**: if a user edits the token (say, to change their role to admin), the signature no longer matches and it's rejected.
- **Expires in 2 hours**.
- `secure` is switched on when the site is served over HTTPS (`COOKIE_SECURE=true`).
- On every request, the user is re-read from the database, so a deleted account loses access immediately.

*Why not localStorage (as in the original)?* Anything in localStorage can be read by any script on the page, and the original even stored the "session" there as plain JSON that anyone could edit.

### 3.4 Role-based access control
`requireAdmin` guards every `/api/admin/*` route. If you're not signed in you get **401**. A signed-in customer gets **403**. The Analytics page in React only *displays* the result: the protection is on the server, because a front-end check can always be bypassed.

### 3.5 Input validation (`validate.js`)
Every field is type-checked, trimmed and length-limited on the server. Emails are format-checked, passwords must be 8–72 characters (72 is bcrypt's limit), and quantities must be whole numbers from 1 to 20. Request bodies are capped at 10 KB.

### 3.6 SQL injection
Every query is a **prepared statement** with `?` placeholders, e.g. `db.prepare('SELECT * FROM users WHERE email = ?').get(email)`. User input is never pasted into SQL text, so it can't change the query.

### 3.7 Security headers: Helmet (`index.js`)
- **Content-Security-Policy**: only scripts from our own site can run, and fonts can only come from Google Fonts. This is a strong defence against XSS.
- `X-Frame-Options` / `frame-ancestors 'none'`: the site can't be embedded in another page (prevents clickjacking).
- `X-Content-Type-Options: nosniff`, and the `X-Powered-By` header is removed so attackers aren't told what server software we use.

React adds XSS protection too: it escapes all text it renders by default. The original design used `innerHTML` with template strings, which is exactly how XSS usually happens.

### 3.8 Error handling
A central error handler returns clear messages for validation errors. Anything unexpected is logged on the server, and the user sees only "Something went wrong". No stack traces or internal details leak out.

> **Say it like this:** "Defence in depth: bcrypt-hashed passwords, two-factor login, signed httpOnly cookies, server-side role checks, validated input, parameterised SQL, rate limiting and a strict Content-Security-Policy."

---

## Step 4: Checkout and mock payment (`routes/orders.js`, `routes/mockGateway.js`)

### 4.1 The server decides the price
The browser sends only **product IDs and quantities**, plus the options chosen. The server looks up each price in the database, adds the delivery fee and the add-on, and calculates the total itself. We tested this by sending a fake `"price": 1` in the request. It was ignored and the correct total was charged.

The delivery and add-on prices shown on the checkout page also come from the server (`GET /api/checkout/options`), so the page and the final charge can never disagree.

### 4.2 Required privacy consent
- The checkbox starts **unticked** (`consent: false` in `Checkout.jsx`).
- React checks it first, for a friendly message.
- **The server checks it again** (`privacyConsent !== true` → 400). This happens *before* any other data is processed, so disabling the checkbox with DevTools doesn't help.
- The consent time is stored on the order (`privacy_consent_at`).

### 4.3 Opt-in add-on ("Protect your purchase", $4)
- Starts **unticked**.
- The server adds it **only if the request contains exactly `true`**. A missing value, `"yes"` or `1` all mean "not added". The default can never be "charged".
- This follows the ACCC's guidance against pre-ticked boxes (a "dark pattern"). The admin page shows how many customers actually opted in.

### 4.4 Mock payment with tokenisation
Real online shops meet **PCI DSS** by never handling card numbers themselves. The card goes to a payment provider (Stripe, Braintree and so on), which returns a one-time **token**. We simulate that:
1. The browser sends the card details to `/mock-gateway/tokenize`. This is a separate router standing in for the external provider. It checks the number with the **Luhn algorithm** (the check-digit formula all card numbers use), the expiry date and the CVC, then returns a token like `tok_4d68...`.
2. The browser sends **only the token** to `/api/orders`.
3. The order stores the token, the method and the last 4 digits. **No card number or CVC is ever saved or logged.**
4. Tokens are single-use and expire after 15 minutes, so a captured token can't be replayed (we tested this).

Test cards: `4242 4242 4242 4242` is approved and `4000 0000 0000 0002` is declined. This shows error handling in the demo. PayPal, Afterpay and Zip are approved instantly (a real site would redirect to the provider).

### 4.5 Atomic save
The order and its items are written in one **database transaction**. If anything fails halfway, nothing is saved, so you never get half an order.

### 4.6 Guest checkout and tracking
- No account is needed. `user_id` is simply NULL.
- `/track` looks up an order only when **both the order number and the email match**. Guessing order numbers reveals nothing, and the endpoint is rate-limited.

> **Say it like this:** "The browser says *what* it wants. The server decides *what it costs*. Card data goes to the payment provider, and we only keep a token. That's how we meet PCI DSS."

---

## Step 5: Front-end (React) (`client/src`)

### 5.1 Matching the design exactly
The first version copied the original `<style>` block into `styles.css` so every colour, font and spacing matched, and converted the HTML to JSX with the same class names. In Step 10 the stylesheet was rebuilt around colour tokens. The original dark and gold design is still available exactly as the **Evening** theme, and the new **Daylight** theme uses the Hearth & Hollow colours.

### 5.2 Components (reuse)
| Component | Used on |
|---|---|
| `SecureBadge` (gold 🔒 panel) | Product page, sign-in, checkout, MFA dialog, confirmation |
| `ConsentCheckbox` | Registration **and** checkout: the same component, so the rule "never pre-ticked" lives in one place |
| `ProductCard` | Home grid |
| `MfaModal` | The second login step |
| `Header` / `Footer` | Every page |

### 5.3 State (React Context)
- `ShopContext`: the catalogue (loaded once from the API) and the cart. **The cart stores only product IDs and quantities** in localStorage, and names and prices are always looked up from the catalogue. Editing localStorage therefore can't change a price, and the server re-prices anyway.
- `AuthContext`: who is signed in. It asks the server (`/api/auth/me`) because the session cookie is httpOnly and can't be read by the page.
- `ToastContext`: the gold notification pill.

### 5.4 Routing (React Router)
Each page has a real URL (`/product/3`, `/checkout`, `/analytics`...), so the back button, bookmarks and refresh all work. Search and category are kept in the URL too (`/?cat=Office&q=desk`).

### 5.5 Accessibility
Inputs have `<label htmlFor>`, the MFA dialog has `role="dialog"`, toasts use `aria-live`, and form fields use `autoComplete` hints (such as `one-time-code` and `cc-number`) so password managers and phones can autofill.

---

## Step 6: Admin analytics (`routes/admin.js`, `pages/Admin.jsx`)

**How data is collected:** the `events` table logs each step of the funnel.
- `visit` is counted **once per browser session** (the original counted every page refresh, which inflated visits).
- `add_to_cart` and `checkout_start` are reported by the browser.
- `consent_given` and `order_placed` are recorded **by the server itself** inside the order route, so these key numbers can't be faked from the browser. The events endpoint only accepts the three harmless event types.

**What the dashboard shows** (computed with SQL such as `SELECT type, COUNT(*) FROM events GROUP BY type`):
- KPIs: visits, orders, revenue, conversion rate
- Conversion funnel bars, cart-abandonment rate, consent-capture rate, add-on opt-in rate
- Best-selling products (a `GROUP BY` over `order_items`)
- Live tables of products, customers (with bcrypt hashes) and orders (with guest/account type and only the card's last 4 digits)

**Access:** admin only, and the admin must pass MFA like everyone else.

> **Say it like this:** "The analytics read live from the database. The funnel shows where customers drop off, which is what we'd use to justify changes in Part C."

---

## Step 7: Testing performed

Testing was run as a loop: build, test, fix whatever failed, then run everything again until it all passed.

**1. Automated API tests: `npm test` (15 tests, all passing).** File: `server/test/api.test.js`. They start the real server against a throw-away database and check:

| Test | Expected result |
|---|---|
| Order without privacy consent | Rejected (400) |
| Tampered price in request (`"price": 1`) | Ignored; correct total charged |
| Add-on sent as `"yes"` instead of `true` | Not added |
| Invalid card (fails Luhn), declined card, expired card | Rejected |
| Payment token reused | Rejected (402) |
| Buying an out-of-stock item, or more than the stock | Rejected (409); stock decrements after a sale |
| Express delivery to a remote postcode, invalid postcodes | Rejected |
| Tracking with the wrong email | Not found (404) |
| Second open return request for the same order | Rejected (409) |
| Common password (`password123`), missing consent, duplicate email | Rejected |
| Unknown email vs wrong password | **Identical** error messages |
| MFA: wrong code, reused code | Rejected; session cookie is `HttpOnly` + `SameSite=Strict` |
| Guest / customer on admin routes; forged cookie | 401 / 403 / treated as guest |
| Order status going backwards | Rejected |
| Data export | Contains no password hash |
| Account deletion with the wrong password | Rejected |
| Security headers, malformed JSON, 20 KB body | CSP present, 400, 413 |

**2. Browser end-to-end test (79 checks after Step 9, all passing).** An automated Chromium browser shops the site like a customer: browse, filter, search, estimate delivery, save items, try to exceed stock, check out (including trying without consent), track the order, report damage, sign in as admin with MFA, dispatch the order, register a customer, fail MFA once, download their data and delete the account. It also checks that phones (390 px wide) never get a sideways scrollbar.

**3. Accessibility audit: 0 violations (15 Daylight pages + 7 Evening pages, WCAG 2.2 AA after Step 9).** The browser test runs **axe-core** (the industry-standard checker) against WCAG 2.1 A/AA and best-practice rules on every page. The first run found real problems, and all were fixed:
- headings skipped levels
- links in text were identified only by colour (they're now underlined)
- the announcement bar was outside a landmark
- clickable text was not reachable by keyboard (now real buttons and links)
- category links overflowed on phones (a bug also present in the original design)

Visible keyboard focus, a "Skip to main content" link and reduced-motion support were also added.

An interesting finding: the test tool's attempt to inject its own script was **blocked by our Content-Security-Policy**. That's exactly how the CSP protects real users from injected scripts. (The test browser had to be told to bypass it.)

**4. `npm audit`: 0 known vulnerabilities in dependencies.**

---

## Step 8: Beating the real Temple & Webster site

The full comparison, with sources, is in [`COMPETITOR-ANALYSIS.md`](COMPETITOR-ANALYSIS.md). In short, the real site's reviews complain about **uncertainty**: surprise delivery costs, rejected postcodes, split deliveries, "in stock" items that weren't, and chasing couriers for updates. Each feature below targets one of those complaints:

| Feature | Decision and reasoning |
|---|---|
| **Delivery estimator** (`server/src/delivery.js`) | The postcode is mapped to a zone (metro / regional / remote) using Australian postcode ranges. Each product has an `eta_min`/`eta_max` in business days, the zone adds days, and a weekend-skipping calculation turns that into **real dates**. It is computed on the server so the product page, cart, checkout and the saved order all agree. |
| **Honest stock** | A `stock` column plus a guarded `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?` inside the order transaction. If two customers race for the last item, only one update matches and the other order rolls back, so it's impossible to oversell. |
| **Deliver together** | The cart detects when items have different delivery windows. Customers can opt in (unticked by default, free) to one delivery on the latest date. The server ignores the option when it doesn't apply. |
| **Order timeline** | A new `order_status_history` table logs every status with a timestamp and note. Statuses can only move forward. Each change is "sent" to the customer (mock email/SMS), so they never need to chase. |
| **Self-service returns** | `return_requests` table. The server decides the reply based on the Australian Consumer Law: damaged or faulty goods get free pickup plus a replacement or refund. Change of mind is allowed within 30 days, with a refund to the original payment method. Only one open request per order is allowed. |
| **Privacy centre** | *Download my data* implements APP 12 (access). *Delete my account* implements APP 11.2 (destroy what's no longer needed). It needs the password again. Order records are kept (unlinked) because tax law requires 5 years. |
| **Leaked-password blocking** | Following NIST SP 800-63B: block known-bad passwords rather than force awkward symbol rules. |
| **Analytics link hidden for non-admins** | The server already blocks them (401/403). Hiding the link simply avoids showing customers a page they can't use. |
| **Schema versioning** | `PRAGMA user_version` records the schema version, so an older database file is rebuilt automatically after an upgrade. |

## Step 9: UI/UX audit with the UI/UX Pro Max skill

The whole interface was audited with the open-source UI/UX Pro Max skill (119 UX rules, in priority order). The full list of findings and fixes is in [`DESIGN-AUDIT.md`](DESIGN-AUDIT.md). The headline changes:
- **SVG icons instead of emoji**: emoji look different on every device and can't be styled.
- **Focus management**: focus moves to each new page's heading; the dialog traps focus; the sticky header can't hide the focused field.
- **Accessible forms**: an error summary that receives focus, plus an error message next to each field; required-field markers; show/hide password; Undo.
- **Performance**: pages load on demand, and placeholder cards show while products load.
- **Navigation**: the current page is highlighted; a breadcrumb; the Back button restores your scroll position.

> **Say it like this:** "We audited the UI against a 119-rule UX checklist, fixed every gap, and proved it with an automated loop: 85 browser checks and zero WCAG 2.2 violations in both themes."

---

## Step 10: Daylight and Evening themes

The **Daylight** theme uses the colours and line-art pictures of the Hearth & Hollow reference design. It's white and teal, close to the real Temple & Webster site, and it's the default. The original dark and gold design became the **Evening** theme.

Decisions:
- **Semantic colour tokens**: components use names like `--accent-text`, and each theme supplies the values. Adding a third theme would mean one new block of tokens, not touching every component.
- **Contrast measured, not assumed**: some reference colours failed WCAG. The clearest example is white text on its teal, at 3.75:1. Darker shades were used for text, and the lighter shades kept for decoration. The table is in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).
- **No flash of the wrong theme**: a tiny script in the page head applies the saved choice before anything is drawn. It's a separate file because the Content-Security-Policy blocks inline scripts.
- **One set of drawings, two colourings**: the product drawings use `currentColor`. They sit on pastel tiles in Daylight and are drawn in gold on dark in Evening.

---

## Step 11: Product photos and design polish

**Photos.** Each product has an `image` name in the database (schema v4). Photos go through `scripts/optimise-photos.mjs`:
- **Square crops.** Shop product grids (including the real Temple & Webster's) use squares. "Attention" cropping keeps the most interesting part of the photo in frame.
- **WebP in two sizes, 480 and 960px.** The browser downloads the small one on phones and the large one on sharp screens (`srcset`/`sizes`).
- **Width and height attributes**, so the page reserves space and nothing jumps while photos load.
- **Lazy loading** for photos further down the page. The first row and the product page photo load immediately.

**Where the photos come from.** All ten photos (nine products plus the home-page banner) are free Pexels photos. Each was picked to match its product description (a white linen sofa on a timber frame, a timber bedside table with drawers, a ceramic lamp with a linen shade, a cream wool rug) and checked by eye after cropping. The rug photo is cropped from a wider living-room shot so the rug fills the frame. Every photographer is credited in `docs/IMAGE-CREDITS.md`, with a link to the original. The Pexels License allows free commercial use without asking; credit is given anyway as good practice.

**Never a broken image.** The server only advertises a photo once its file exists, and if a photo fails to load, the line drawing appears instead.

**Polish:**
- the phone menu is now a proper **Menu** button (a disclosure: `aria-expanded`, closes on Escape or when a link is tapped)
- "You may also like" on product pages
- photo thumbnails in the cart
- the product photo stays in view while you scroll the details (desktop)
- a gentle zoom on hover, and a banner photo that sits below the headline on phones

> **Say it like this:** "Photos are optimised automatically: square crops, modern WebP format, two sizes for different screens, and lazy loading. If a photo is ever missing, the site falls back to its line drawing instead of a broken image."

---

## Step 12: Known limitations (be upfront about these in your presentation)

| Limitation | What production would do |
|---|---|
| The MFA code is shown on screen | Send it by email or SMS, or use an authenticator app (TOTP) |
| The mock gateway runs on our own server | Use Stripe Elements / Braintree hosted fields, so the card never touches our server at all |
| Plain HTTP on localhost | HTTPS with TLS certificates (then set `COOKIE_SECURE=true`) |
| SQLite single file | PostgreSQL / MySQL with backups and replication |
| The JWT secret is random per start (unless `JWT_SECRET` is set) | A secret stored in a secrets manager |
| Rate limits and payment tokens are kept in memory | Redis, so they're shared across multiple servers |
| No email verification at registration | Send a verification link before activating the account |
| Postcode zones are a simplified table; public holidays aren't counted | The carrier's zone file / API and a state holiday calendar |
| Status updates and notifications are triggered manually by an admin | Courier tracking webhooks update statuses automatically |
| Product photos are free stock photos, not the actual products sold | The supplier's own product photography, served from a CDN |
