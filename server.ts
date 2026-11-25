import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral fallback signing key when SESSION_SECRET is not provided
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

interface SaltedHash {
  salt: string;
  hash: string;
}

// In-memory claimed passcode hash when ADMIN_PASSCODE env var is unset
let claimedAdminHash: SaltedHash | null = null;

// Basic brute-force protection per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function hashPasscode(passcode: string, saltHex?: string): SaltedHash {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPasscodeAgainstHash(passcode: string, stored: SaltedHash): boolean {
  const candidate = crypto.scryptSync(passcode, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function getConfiguredEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function verifySubmittedPasscode(submitted: string): boolean {
  const envPass = getConfiguredEnvPasscode();
  if (envPass.length > 0) {
    const a = crypto.createHash('sha256').update(submitted.trim()).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
  }
  if (claimedAdminHash) {
    return verifyPasscodeAgainstHash(submitted.trim(), claimedAdminHash);
  }
  return false;
}

function issueBearerToken(): string {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifyBearerToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return parsed?.role === 'admin' && typeof parsed?.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Prevent proxy or browser caching of API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/admin/auth-status', (_req, res) => {
    const hasEnv = getConfiguredEnvPasscode().length > 0;
    const configured = hasEnv || claimedAdminHash !== null;
    res.json({
      configured,
      needsSetup: !configured,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (getConfiguredEnvPasscode().length > 0 || claimedAdminHash !== null) {
      return res.status(409).json({
        error: 'Le mot de passe administrateur est déjà configuré.',
      });
    }

    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 4 || passcode.length > 100) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir entre 4 et 100 caractères.',
      });
    }

    claimedAdminHash = hashPasscode(passcode);
    const token = issueBearerToken();
    return res.json({ token });
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record && record.resetAt > now && record.count >= 12) {
      return res.status(429).json({
        error: 'Trop de tentatives. Veuillez patienter une minute avant de réessayer.',
      });
    }

    const envPass = getConfiguredEnvPasscode();
    if (envPass.length === 0 && claimedAdminHash === null) {
      return res.status(412).json({
        error: 'Mot de passe non encore initialisé.',
        needsSetup: true,
      });
    }

    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!passcode.trim()) {
      return res.status(400).json({ error: 'Veuillez saisir le mot de passe.' });
    }

    if (!verifySubmittedPasscode(passcode)) {
      const nextCount = record && record.resetAt > now ? record.count + 1 : 1;
      loginAttempts.set(ip, { count: nextCount, resetAt: now + 60_000 });
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    loginAttempts.delete(ip);
    const token = issueBearerToken();
    return res.json({ token });
  });

  app.get('/api/admin/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }
    const token = authHeader.slice(7);
    if (!verifyBearerToken(token)) {
      return res.status(401).json({ valid: false });
    }
    return res.json({ valid: true });
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
