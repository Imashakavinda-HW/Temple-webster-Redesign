// Opens the SQLite database file and applies the schema.
// better-sqlite3 is synchronous, which keeps route code simple and is fast for a
// single-server prototype. Every query below uses prepared statements with `?`
// placeholders, which is what protects us from SQL injection.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(here, '..', 'data', 'temple-webster.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');  // better concurrency between reads and writes
db.pragma('foreign_keys = ON');   // SQLite leaves FK enforcement off unless asked

// Schema versioning: PRAGMA user_version records which schema version the file was built
// with. The prototype holds demo data only, so an out-of-date file is simply rebuilt.
const SCHEMA_VERSION = 3; // v3: product icons are SVG icon names instead of emoji
if (db.pragma('user_version', { simple: true }) < SCHEMA_VERSION) {
  const old = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (old.length) {
    db.pragma('foreign_keys = OFF');
    for (const { name } of old) db.exec(`DROP TABLE "${name}"`);
    db.pragma('foreign_keys = ON');
    console.log(`Database upgraded to schema v${SCHEMA_VERSION} (demo data was reset).`);
  }
}
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
db.pragma(`user_version = ${SCHEMA_VERSION}`);

// Order numbers start at #1001 (like the original design), not #1.
db.prepare(`INSERT INTO sqlite_sequence (name, seq)
            SELECT 'orders', 1000 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'orders')`).run();

export const dbFile = dbPath;
