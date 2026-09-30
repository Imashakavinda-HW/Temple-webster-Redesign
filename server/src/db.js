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

db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

// Order numbers start at #1001 (like the original design), not #1.
db.prepare(`INSERT INTO sqlite_sequence (name, seq)
            SELECT 'orders', 1000 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'orders')`).run();

export const dbFile = dbPath;
