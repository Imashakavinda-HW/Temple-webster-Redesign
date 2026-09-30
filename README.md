# Temple & Webster: Secure E-commerce Prototype

A full-stack rebuild of the single-file design prototype (`docs/original-design.html`) for the BIT363 assignment:

| Layer     | Technology                         | Folder     |
|-----------|------------------------------------|------------|
| Front-end | React 19 + React Router, built with Vite | `client/` |
| Back-end  | Node.js + Express 5 REST API       | `server/`  |
| Database  | SQLite (via `better-sqlite3`)      | `server/data/temple-webster.db` (created automatically) |

**Features:** product catalogue (9 seeded products) with search and categories · cart · guest checkout · checkout with a **required privacy-consent checkbox** · a **visible payment-security badge** · **MFA (2-step) login** · **delivery ETAs** on every product · **opt-in add-on** (never pre-ticked) · **mock payment gateway** with tokenisation · **admin analytics** read from the database.

**Improvements over the real templeandwebster.com.au:** a postcode **delivery estimator with real dates and costs before checkout** · **honest stock levels** that can't be oversold · a free **"deliver everything together"** option · an **order-tracking timeline** with automatic customer notifications · **self-service returns / problem reports** under the ACL · a **privacy centre** (download or delete my data) · **leaked-password blocking** · a **wishlist** · **0 accessibility violations** (WCAG 2.1 AA) · **automated tests**.

Documents for your presentation:
- **[`docs/DECISIONS.md`](docs/DECISIONS.md)**: every design and security decision, step by step.
- **[`docs/COMPETITOR-ANALYSIS.md`](docs/COMPETITOR-ANALYSIS.md)**: how this compares with the real Temple & Webster site, with sources.

---

## 1. Requirements

- **Node.js 22 or newer** (check with `node -v`). Download it from https://nodejs.org (choose "LTS").
- That's all. SQLite is bundled inside the `better-sqlite3` package, so you don't install a database server.

## 2. Download the code

**Option A: ZIP (no Git needed)**
1. Open the repository on GitHub: `https://github.com/imashakavinda-hw/temple-webster-redesign`
2. Switch the branch dropdown (top-left, usually says `main`) to **`claude/inspiring-archimedes-a0zfrq`**.
3. Click the green **Code** button, then **Download ZIP**. Unzip it anywhere.

**Option B: Git**
```bash
git clone -b claude/inspiring-archimedes-a0zfrq https://github.com/imashakavinda-hw/temple-webster-redesign.git
cd temple-webster-redesign
```

## 3. Run it (preview)

Open a terminal in the project folder (the one containing this README):

```bash
npm install        # installs client + server dependencies in one go (npm workspaces)
npm run dev        # starts the API (port 3001) and the React dev server (port 5173)
```

Then open **http://localhost:5173** in your browser. The database is created and seeded on first start.

**Presentation mode** (one server, the way it would be deployed):
```bash
npm run build      # compiles the React app into client/dist
npm start          # Express serves the API *and* the built site
```
Then open **http://localhost:3001**.

**Run the automated tests:** `npm test` runs 15 API tests (security rules, checkout, stock, delivery, MFA, roles, privacy) against a throw-away database. Your demo data isn't touched.

**Reset everything:** stop the server, then run `npm run seed`. This wipes the database and re-seeds the products and the admin account. You can also use the **Reset demo data** button on the Analytics page.

## 4. Demo walkthrough

| What to show | How |
|---|---|
| Catalogue, search, categories, ETAs | Home page. Type "desk", or click **Office**. |
| Honest stock | The wool rug is **Out of stock** (button disabled). Bedside tables show **Only 3 left**, and you can't add a 4th. |
| Delivery estimator | On any product page, type postcode **3171** (metro), **2650** (regional) or **0870** (remote: $49 surcharge, no express). You'll see real dates. |
| Combined delivery | Put the sofa and the lamp in the cart. The cart warns they ship separately, and checkout offers "Deliver everything together (free)". |
| Wishlist | Tap ♡ on any product, then open **Saved**. |
| Guest checkout | Add items, then **Cart**, then **Proceed to checkout**. Fill in name, email and address. |
| Required consent | Click **Pay & place order** without ticking consent. You get a warning and the server also rejects it. |
| Opt-in add-on | "Protect your purchase" starts **unticked**. Tick it and the $4 appears in the total. |
| Mock payment | Test card **4242 4242 4242 4242**, any future expiry (e.g. `12/29`), any CVC. Card **4000 0000 0000 0002** is declined. |
| MFA login | **Account**: register, then sign in. A 6-digit code is required (shown on screen as "Demo code" because no email server exists). |
| Order tracking + returns | **Track Order**, or the button on the confirmation page. It shows the status timeline. Then use **Report a problem or start a return**. |
| Proactive updates | As admin, open **Analytics** and click **Mark "Dispatched"** on an order. The customer's timeline updates, with a notification note. |
| Privacy centre | Sign in as a customer, then go to **Account**: **Download my data** (JSON) or **Delete my account** (needs your password). |
| Password rules | Try registering with `password123`. It's rejected as a leaked password. |
| Admin analytics | Sign in as the admin (below) and open **Analytics**. |

**Admin account:** `admin@templewebster.demo` / `Admin#2026`. The MFA code is shown in the dialog and printed in the server terminal. The **Analytics** link only appears in the menu once you're signed in as admin (you can also go straight to `/analytics`).

## 5. Configuration (optional)

Set these as environment variables before starting the server:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API port |
| `JWT_SECRET` | random each start | Secret that signs session cookies. Set it to keep users signed in across restarts. |
| `SHOW_MFA_CODE` | `true` | Set to `false` to hide the demo code (production behaviour) |
| `COOKIE_SECURE` | `false` | Set to `true` when served over HTTPS |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | see above | Admin account created on first seed |
| `DB_PATH` | `server/data/temple-webster.db` | Database file location |

## 6. Project structure

```
├── package.json            root scripts (dev / build / start / seed), npm workspaces
├── docs/
│   ├── DECISIONS.md        step-by-step explanation of every decision
│   ├── COMPETITOR-ANALYSIS.md  comparison with the real templeandwebster.com.au
│   └── original-design.html the original single-file prototype
├── server/
│   └── src/
│       ├── index.js        entry point: seeds the database and starts the server
│       ├── app.js          Express app: security headers, routes, serves the built client
│       ├── delivery.js     postcode → zone → delivery fee and real dates
│       ├── db.js           opens SQLite, applies schema.sql
│       ├── schema.sql      tables: products, users, mfa_challenges, orders, order_items,
│       │                   order_status_history, return_requests, events
│       ├── seed.js         9 products + admin account
│       ├── validate.js     input validation helpers
│       ├── middleware/auth.js   JWT cookie sessions, requireAuth, requireAdmin
│       └── routes/
│           ├── products.js     catalogue, checkout options, delivery estimate
│           ├── auth.js         register, login, MFA verify, logout
│           ├── mockGateway.js  mock payment provider (card → token)
│           ├── orders.js       place order (server-side pricing + stock), my orders, tracking, returns
│           ├── account.js      privacy centre: export my data, delete my account
│           ├── events.js       analytics events
│           └── admin.js        analytics, order status updates, returns queue (admin only)
│   └── test/api.test.js    automated API tests (npm test)
└── client/
    ├── index.html, vite.config.js
    └── src/
        ├── main.jsx, App.jsx    providers + routes
        ├── styles.css           the original design's CSS, unchanged
        ├── lib/                 api.js (fetch wrapper), format.js (money)
        ├── context/             ShopContext (catalogue + cart), AuthContext, ToastContext
        ├── components/          Header, Footer, ProductCard, SecureBadge, ConsentCheckbox, MfaModal,
        │                        DeliveryEstimate, StockBadge
        └── pages/               Home, Product, Cart, Checkout, Confirmation, Account, Track, Saved, About, Admin
```

## 7. API summary

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/products`, `/api/products/:id` | public | Catalogue |
| GET | `/api/checkout/options` | public | Delivery / add-on prices |
| GET | `/api/delivery/estimate?postcode=&items=` | public | Delivery fee + dates for a postcode |
| POST | `/api/auth/register` | public | Create an account (consent required) |
| POST | `/api/auth/login` | public | Password step. Returns an MFA challenge. |
| POST | `/api/auth/mfa/verify` | public | Code step. Sets the session cookie. |
| POST | `/api/auth/logout`, GET `/api/auth/me` | any | Session |
| POST | `/mock-gateway/tokenize` | public | Mock payment provider: card → token |
| POST | `/api/orders` | guest or customer | Place an order |
| GET | `/api/orders/mine` | signed in | Order history |
| GET | `/api/orders/track?orderId=&email=` | public | Tracking + status timeline |
| POST | `/api/orders/:id/returns` | order owner | Report a problem / start a return |
| GET | `/api/account/export`, POST `/api/account/delete` | signed in | Privacy centre |
| POST | `/api/events` | public | Analytics events |
| GET | `/api/admin/analytics`, POST `/api/admin/reset` | admin | Dashboard / reset |
| POST | `/api/admin/orders/:id/status` | admin | Advance order status (notifies customer) |

> **Prototype notice:** payments are simulated and no money moves. Don't enter a real card number.
