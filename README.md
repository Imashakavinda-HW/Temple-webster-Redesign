# Temple & Webster: Secure E-commerce Prototype

A full-stack rebuild of the single-file design prototype (`docs/original-design.html`) for the BIT363 assignment:

| Layer     | Technology                         | Folder     |
|-----------|------------------------------------|------------|
| Front-end | React 19 + React Router, built with Vite | `client/` |
| Back-end  | Node.js + Express 5 REST API       | `server/`  |
| Database  | SQLite (via `better-sqlite3`)      | `server/data/temple-webster.db` (created automatically) |

**Features:** product catalogue (9 seeded products) with search and categories · cart · guest checkout · checkout with a **required privacy-consent checkbox** · a **visible payment-security badge** · **MFA (2-step) login** · **delivery ETAs** on every product · **opt-in add-on** (never pre-ticked) · **mock payment gateway** with tokenisation · guest order tracking · **admin analytics** read from the database.

The file **[`docs/DECISIONS.md`](docs/DECISIONS.md)** explains every design and security decision step by step, for your presentation.

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

**Reset everything:** stop the server, then run `npm run seed`. This wipes the database and re-seeds the products and the admin account. You can also use the **Reset demo data** button on the Analytics page.

## 4. Demo walkthrough

| What to show | How |
|---|---|
| Catalogue, search, categories, ETAs | Home page. Type "desk", or click **Office**. |
| Guest checkout | Add items, then **Cart**, then **Proceed to checkout**. Fill in name, email and address. |
| Required consent | Click **Pay & place order** without ticking consent. You get a warning and the server also rejects it. |
| Opt-in add-on | "Protect your purchase" starts **unticked**. Tick it and the $4 appears in the total. |
| Mock payment | Test card **4242 4242 4242 4242**, any future expiry (e.g. `12/29`), any CVC. Card **4000 0000 0000 0002** is declined. |
| MFA login | **Account**: register, then sign in. A 6-digit code is required (shown on screen as "Demo code" because no email server exists). |
| Order tracking | Footer: **Track an order**, using the order number and email. |
| Admin analytics | Sign in as the admin (below) and open **Analytics**. |

**Admin account:** `admin@templewebster.demo` / `Admin#2026`. The MFA code is shown in the dialog and printed in the server terminal.

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
│   └── original-design.html the original single-file prototype
├── server/
│   └── src/
│       ├── index.js        Express app: security headers, routes, serves the built client
│       ├── db.js           opens SQLite, applies schema.sql
│       ├── schema.sql      tables: products, users, mfa_challenges, orders, order_items, events
│       ├── seed.js         9 products + admin account
│       ├── validate.js     input validation helpers
│       ├── middleware/auth.js   JWT cookie sessions, requireAuth, requireAdmin
│       └── routes/
│           ├── products.js     catalogue + checkout options (delivery prices, add-on price)
│           ├── auth.js         register, login, MFA verify, logout
│           ├── mockGateway.js  mock payment provider (card → token)
│           ├── orders.js       place order (server-side pricing), my orders, guest tracking
│           ├── events.js       analytics events
│           └── admin.js        analytics + database views (admin only)
└── client/
    ├── index.html, vite.config.js
    └── src/
        ├── main.jsx, App.jsx    providers + routes
        ├── styles.css           the original design's CSS, unchanged
        ├── lib/                 api.js (fetch wrapper), format.js (money)
        ├── context/             ShopContext (catalogue + cart), AuthContext, ToastContext
        ├── components/          Header, Footer, ProductCard, SecureBadge, ConsentCheckbox, MfaModal
        └── pages/               Home, Product, Cart, Checkout, Confirmation, Account, Track, About, Admin
```

## 7. API summary

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/products`, `/api/products/:id` | public | Catalogue |
| GET | `/api/checkout/options` | public | Delivery / add-on prices |
| POST | `/api/auth/register` | public | Create an account (consent required) |
| POST | `/api/auth/login` | public | Password step. Returns an MFA challenge. |
| POST | `/api/auth/mfa/verify` | public | Code step. Sets the session cookie. |
| POST | `/api/auth/logout`, GET `/api/auth/me` | any | Session |
| POST | `/mock-gateway/tokenize` | public | Mock payment provider: card → token |
| POST | `/api/orders` | guest or customer | Place an order |
| GET | `/api/orders/mine` | signed in | Order history |
| GET | `/api/orders/track?orderId=&email=` | public | Guest tracking |
| POST | `/api/events` | public | Analytics events |
| GET | `/api/admin/analytics`, POST `/api/admin/reset` | admin | Dashboard / reset |

> **Prototype notice:** payments are simulated and no money moves. Don't enter a real card number.
