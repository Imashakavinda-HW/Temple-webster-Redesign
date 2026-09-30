// Express entry point: security middleware, API routes, and (after `npm run build`)
// the compiled React app served from the same origin.
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbFile } from './db.js';
import { seed } from './seed.js';
import { requireAdmin } from './middleware/auth.js';
import productRoutes from './routes/products.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import eventRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';
import gatewayRoutes from './routes/mockGateway.js';

seed(); // fills an empty database with the 9 products and the admin account

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Security headers: Content-Security-Policy (only our own scripts may run; fonts from
// Google only), clickjacking protection, no MIME sniffing, hides "X-Powered-By".
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      // Local demo runs on plain http://localhost; re-enable this once served over HTTPS.
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(express.json({ limit: '10kb' })); // small body limit blocks oversized payload attacks
app.use(cookieParser());

app.use('/api', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/mock-gateway', gatewayRoutes);
app.use(['/api', '/mock-gateway'], (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built React app (client/dist) if it exists — one server, one port.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Central error handler: validation errors return their message; anything unexpected is
// logged on the server and the user sees a generic message (no stack traces leak out).
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}  (database: ${dbFile})`);
  if (fs.existsSync(clientDist)) console.log(`Shop available at http://localhost:${PORT}`);
});
