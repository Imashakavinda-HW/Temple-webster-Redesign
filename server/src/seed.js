// Seeds the 9 catalogue products and one administrator account.
// Runs automatically on server start (only fills empty tables), or manually with
// `npm run seed`, which wipes all data and starts fresh.
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { db } from './db.js';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@templewebster.demo';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin#2026';

// [id, name, category, price $, icon, eta min days, eta max days, stock, rating, reviews, tag, description]
// Stock levels are deliberately varied so the demo shows "In stock", "Only N left" and "Out of stock".
const products = [
  [1, 'Hamptons Slip-Cover Sofa', 'Living', 1299, '🛋️', 5, 8, 24, 4.7, 212, 'Bestseller',
    'A generous three-seat linen sofa on a solid timber frame. Removable, washable slip-covers in five tones.'],
  [2, 'Solid Oak Dining Table', 'Living', 899, '🍽️', 7, 10, 8, 4.6, 98, null,
    'Seats six comfortably. Crafted from solid oak with a hand-rubbed natural finish.'],
  [3, 'Upholstered Linen Bed', 'Bedroom', 749, '🛏️', 6, 9, 15, 4.8, 341, 'Editor’s Pick',
    'A softly upholstered linen bed frame with a solid slat base — no box spring required.'],
  [4, 'Bedside Tables (Pair)', 'Bedroom', 279, '🗄️', 4, 6, 3, 4.5, 76, null,
    'Two-drawer bedside tables with soft-close runners and a warm timber veneer.'],
  [5, 'Rattan Lounge Set', 'Outdoor', 1599, '🪑', 8, 12, 5, 4.4, 54, null,
    'A weather-resistant four-piece rattan set with plush, quick-dry cushions.'],
  [6, 'Ceramic Table Lamp', 'Décor', 129, '💡', 3, 5, 40, 4.6, 188, null,
    'A hand-thrown ceramic base beneath a natural linen shade. Warm, ambient light.'],
  [7, 'Hand-Tufted Wool Rug', 'Décor', 349, '🟫', 4, 7, 0, 4.7, 156, null,
    'A dense, hand-tufted wool rug (2×3m) in a soft, neutral palette.'],
  [8, 'Ergonomic Studio Chair', 'Office', 459, '🪑', 3, 5, 18, 4.5, 203, null,
    'Adjustable lumbar support and a breathable mesh back for long working days.'],
  [9, 'Electric Standing Desk', 'Office', 699, '🖥️', 5, 8, 12, 4.6, 91, 'New',
    'A whisper-quiet electric height-adjustable desk with memory presets (140cm).'],
];

// Puts stock back to the seeded levels (used by the admin "Reset demo data" button).
export function restoreStock() {
  const update = db.prepare('UPDATE products SET stock = ? WHERE id = ?');
  for (const p of products) update.run(p[7], p[0]);
}

export function seed({ reset = false } = {}) {
  const run = db.transaction(() => {
    if (reset) {
      db.exec(`DELETE FROM return_requests; DELETE FROM order_status_history; DELETE FROM order_items;
               DELETE FROM orders; DELETE FROM events; DELETE FROM mfa_challenges; DELETE FROM users;
               DELETE FROM products;
               UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'orders';
               UPDATE sqlite_sequence SET seq = 0 WHERE name <> 'orders';`);
    }

    if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
      const insert = db.prepare(`INSERT INTO products
        (id, name, category, price_cents, icon, eta_min, eta_max, stock, rating, review_count, tag, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const [id, name, cat, dollars, icon, min, max, stock, rating, reviews, tag, desc] of products) {
        insert.run(id, name, cat, dollars * 100, icon, min, max, stock, rating, reviews, tag, desc);
      }
      console.log(`Seeded ${products.length} products.`);
    }

    if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
      db.prepare(`INSERT INTO users (name, email, password_hash, role, privacy_consent_at)
                  VALUES (?, ?, ?, 'admin', datetime('now'))`)
        .run('Store Administrator', ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASSWORD, 12));
      console.log(`Created admin account: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    }
  });
  run();
}

// Allow `node src/seed.js --reset` from the command line.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed({ reset: process.argv.includes('--reset') });
  console.log('Database ready.');
}
