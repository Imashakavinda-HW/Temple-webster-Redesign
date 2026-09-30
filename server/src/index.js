// Entry point: prepares the database, then starts the web server.
import fs from 'node:fs';
import { dbFile } from './db.js';
import { seed } from './seed.js';
import { app, clientDist } from './app.js';

seed(); // fills an empty database with the 9 products and the admin account

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}  (database: ${dbFile})`);
  if (fs.existsSync(clientDist)) console.log(`Shop available at http://localhost:${PORT}`);
});
