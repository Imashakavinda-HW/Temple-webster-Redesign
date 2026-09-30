// Runs the browser test against a fresh copy of the site:
//   1. starts the built server on a spare port with a throw-away database
//   2. runs e2e/browser.test.mjs
//   3. stops the server and deletes the temporary database
// Your normal demo database is never touched.
// Needs `npm run build` first, and a Chromium browser (`npx playwright install chromium`).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(root, 'client/dist/index.html'))) {
  console.error('Build the site first: npm run build');
  process.exit(1);
}

const port = Number(process.env.E2E_PORT) || 3107;
const dbPath = path.join(os.tmpdir(), `tw-e2e-${process.pid}.db`);
const server = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'e2e-secret' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

const cleanup = () => {
  server.kill();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
};

// Wait until the server says it is listening.
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Server did not start within 30 s')), 30_000);
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('API listening')) { clearTimeout(timer); resolve(); }
  });
  server.on('exit', (code) => reject(new Error(`Server exited early (code ${code})`)));
}).catch((err) => { console.error(err.message); cleanup(); process.exit(1); });

const test = spawn(process.execPath, ['e2e/browser.test.mjs'], {
  cwd: root,
  env: { ...process.env, BASE_URL: `http://localhost:${port}` },
  stdio: 'inherit',
});
test.on('exit', (code) => { cleanup(); process.exit(code ?? 1); });
