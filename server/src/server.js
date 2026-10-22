import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database/db.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable security headers & CORS
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:5173']
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-simulated-email'],
}));

// Clean any redundant duplicate slashes (e.g. //documents -> /documents)
app.use((req, res, next) => {
  req.url = req.url.replace(/\/{2,}/g, '/');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
initDatabase();

// Mount API routes under /api (Standard)
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents/:id/permissions', permissionRoutes);
app.use('/api/audit-logs', auditRoutes);

// Fallback aliases in case client calls without /api prefix
app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);
app.use('/audit-logs', auditRoutes);

// Health check endpoints
app.get(['/', '/api', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'TrustVault Core Engine',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[TrustVault Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

export { app };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  app.listen(PORT, () => {
    console.log(`[TrustVault Server] Running securely on http://localhost:${PORT}`);
  });
}
