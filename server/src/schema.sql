-- Temple & Webster prototype — database schema (SQLite)
-- Money is stored as INTEGER cents to avoid floating-point rounding errors.
-- Every CHECK constraint is a second line of defence behind the API's validation.

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  category      TEXT    NOT NULL CHECK (category IN ('Living','Bedroom','Outdoor','Décor','Office')),
  price_cents   INTEGER NOT NULL CHECK (price_cents > 0),
  icon          TEXT    NOT NULL,
  eta           TEXT    NOT NULL,            -- delivery estimate shown on every product
  rating        REAL    NOT NULL,
  review_count  INTEGER NOT NULL,
  tag           TEXT,
  description   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash      TEXT NOT NULL,          -- bcrypt hash, never the password itself
  role               TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  privacy_consent_at TEXT NOT NULL,          -- when the user actively ticked consent
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per login attempt that passed the password step and now needs a 2FA code.
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id         TEXT    PRIMARY KEY,            -- random UUID handed to the browser
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT    NOT NULL,               -- SHA-256 of the 6-digit code
  expires_at INTEGER NOT NULL,               -- epoch milliseconds
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = guest checkout
  customer_name      TEXT    NOT NULL,
  email              TEXT    NOT NULL,
  address            TEXT    NOT NULL,
  delivery_option    TEXT    NOT NULL,
  delivery_label     TEXT    NOT NULL,
  delivery_cents     INTEGER NOT NULL,
  protection_added   INTEGER NOT NULL DEFAULT 0 CHECK (protection_added IN (0,1)),  -- opt-in add-on
  protection_cents   INTEGER NOT NULL DEFAULT 0,
  subtotal_cents     INTEGER NOT NULL,
  total_cents        INTEGER NOT NULL,
  payment_method     TEXT    NOT NULL,
  payment_token      TEXT    NOT NULL,       -- token from the (mock) gateway — never card data
  card_last4         TEXT,
  privacy_consent_at TEXT    NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'Confirmed',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  product_name     TEXT    NOT NULL,         -- snapshot, so history survives product edits
  unit_price_cents INTEGER NOT NULL,         -- snapshot of the price actually charged
  quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20)
);

-- Web-analytics events that power the admin funnel.
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL CHECK (type IN ('visit','add_to_cart','checkout_start','consent_given','order_placed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user  ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_events_type  ON events(type);
