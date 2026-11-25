import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleAuthStatus,
  handleHealth,
  handleLogin,
  handleSetup,
  handleVerify,
} from './api/_lib/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    void handleHealth(req, res);
  });

  app.get('/api/admin/auth-status', (req, res) => {
    void handleAuthStatus(req, res);
  });

  app.post('/api/admin/setup', (req, res) => {
    void handleSetup(req, res);
  });

  app.post('/api/admin/login', (req, res) => {
    void handleLogin(req, res);
  });

  app.get('/api/admin/verify', (req, res) => {
    void handleVerify(req, res);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
