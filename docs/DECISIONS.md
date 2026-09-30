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

Six tables:

| Table | Purpose |
|---|---|
| `products` | The 9 seeded products, including the `eta` delivery estimate |
| `users` | Customers and admins, with the password stored as a bcrypt hash, a `role`, and the timestamp of their privacy consent |
| `mfa_challenges` | One-time 2FA codes (hashed), with expiry time and attempt counter |
| `orders` | One row per order. `user_id` is NULL for guest checkout. |
| `order_items` | The products in each order (one-to-many from `orders`) |
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
The original `<style>` block was copied **unchanged** into `styles.css`, so every colour, font, spacing and hover effect is identical. That includes the dark and gold palette, Cormorant Garamond headings and Inter body text. A few small additions (card input grid, error box) are clearly marked at the bottom of the file. The HTML was converted to JSX with the same class names.

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

End-to-end tests were run against the running app (API calls plus an automated browser):

| Test | Result |
|---|---|
| 9 products load; category and search filters work | ✅ |
| Order without consent | ✅ Rejected by the browser **and** the server |
| Add-on and consent checkboxes start unticked | ✅ |
| Tampered price in request (`"price": 1`) | ✅ Ignored; correct total charged |
| Add-on sent as `"yes"` instead of `true` | ✅ Not added |
| Invalid card number (fails Luhn) / declined test card | ✅ Rejected with a clear message |
| Payment token reused | ✅ Rejected |
| Wrong MFA code | ✅ Rejected, attempts counted down |
| Customer tries admin API | ✅ 403 |
| Not signed in, tries admin API | ✅ 401 |
| Guest tracking with the wrong email | ✅ Not found |
| Security headers present (CSP, nosniff, frame protection) | ✅ |
| `npm install` security audit | ✅ 0 vulnerabilities |

---

## Step 8: Known limitations (be upfront about these in your presentation)

| Limitation | What production would do |
|---|---|
| The MFA code is shown on screen | Send it by email or SMS, or use an authenticator app (TOTP) |
| The mock gateway runs on our own server | Use Stripe Elements / Braintree hosted fields, so the card never touches our server at all |
| Plain HTTP on localhost | HTTPS with TLS certificates (then set `COOKIE_SECURE=true`) |
| SQLite single file | PostgreSQL / MySQL with backups and replication |
| The JWT secret is random per start (unless `JWT_SECRET` is set) | A secret stored in a secrets manager |
| Rate limits and payment tokens are kept in memory | Redis, so they're shared across multiple servers |
| No email verification at registration | Send a verification link before activating the account |
| Product images are emoji (as in the original design) | Real photography served from a CDN |
