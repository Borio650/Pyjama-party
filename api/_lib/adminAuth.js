import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString('hex');

// In-memory cache of claimed passcode hash (persisted in Firestore when ADMIN_PASSCODE is unset)
let cachedClaimedHash = null;

// Basic brute-force protection per IP within a container
const loginAttempts = new Map();

function loadFirebaseConfig() {
  const candidates = [
    path.resolve(__dirname, '../../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.projectId && parsed?.firestoreDatabaseId && parsed?.apiKey) {
          return parsed;
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export function getConfiguredEnvPasscode() {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function getSigningKey() {
  const envSession = process.env.SESSION_SECRET;
  if (typeof envSession === 'string' && envSession.length >= 16) {
    return envSession;
  }
  const envPass = getConfiguredEnvPasscode();
  if (envPass.length > 0) {
    return crypto
      .createHmac('sha256', envPass)
      .update('pyjama-party-session-signing-v1')
      .digest('hex');
  }
  return EPHEMERAL_FALLBACK_KEY;
}

function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPasscodeAgainstHash(passcode, stored) {
  const candidate = crypto.scryptSync(passcode, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function verifyEnvPasscode(submitted, envPass) {
  const a = crypto.createHash('sha256').update(submitted.trim()).digest();
  const b = crypto.createHash('sha256').update(envPass).digest();
  return crypto.timingSafeEqual(a, b);
}

async function readClaimedHashFromFirestore() {
  if (cachedClaimedHash) return cachedClaimedHash;
  const cfg = loadFirebaseConfig();
  if (!cfg) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}` +
    `/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/app_auth/dashboard` +
    `?key=${encodeURIComponent(cfg.apiKey)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const doc = await res.json();
    const salt = doc?.fields?.salt?.stringValue;
    const hash = doc?.fields?.hash?.stringValue;
    if (
      typeof salt === 'string' &&
      /^[a-f0-9]{32}$/.test(salt) &&
      typeof hash === 'string' &&
      /^[a-f0-9]{128}$/.test(hash)
    ) {
      cachedClaimedHash = { salt, hash };
      return cachedClaimedHash;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveClaimedHashToFirestore(stored) {
  const cfg = loadFirebaseConfig();
  if (!cfg) {
    return { saved: false, alreadyExists: false };
  }

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}` +
    `/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents:commit` +
    `?key=${encodeURIComponent(cfg.apiKey)}`;

  const docName = `projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/app_auth/dashboard`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: docName,
              fields: {
                salt: { stringValue: stored.salt },
                hash: { stringValue: stored.hash },
              },
            },
            updateTransforms: [
              {
                fieldPath: 'created_at',
                setToServerValue: 'REQUEST_TIME',
              },
            ],
            currentDocument: { exists: false },
          },
        ],
      }),
    });

    if (res.ok) {
      cachedClaimedHash = stored;
      return { saved: true, alreadyExists: false };
    }

    const errText = await res.text().catch(() => '');
    if (res.status === 409 || errText.includes('ALREADY_EXISTS')) {
      return { saved: false, alreadyExists: true };
    }
    return { saved: false, alreadyExists: false };
  } catch {
    return { saved: false, alreadyExists: false };
  }
}

export function issueBearerToken() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifyBearerToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
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

export function sendJson(res, statusCode, payload) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload);
    return;
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total <= 65536) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function getClientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export async function handleHealth(_req, res) {
  sendJson(res, 200, { ok: true });
}

export async function handleAuthStatus(_req, res) {
  const hasEnv = getConfiguredEnvPasscode().length > 0;
  if (hasEnv) {
    sendJson(res, 200, { configured: true, needsSetup: false });
    return;
  }
  const stored = await readClaimedHashFromFirestore();
  const configured = stored !== null;
  sendJson(res, 200, { configured, needsSetup: !configured });
}

export async function handleSetup(req, res) {
  if (req.method && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Méthode non autorisée.' });
    return;
  }

  if (getConfiguredEnvPasscode().length > 0) {
    sendJson(res, 409, {
      error: 'Le mot de passe administrateur est déjà configuré.',
    });
    return;
  }

  const existing = await readClaimedHashFromFirestore();
  if (existing !== null) {
    sendJson(res, 409, {
      error: 'Le mot de passe administrateur est déjà configuré.',
    });
    return;
  }

  const body = await readJsonBody(req);
  const passcode = typeof body?.passcode === 'string' ? body.passcode.trim() : '';
  if (passcode.length < 4 || passcode.length > 100) {
    sendJson(res, 400, {
      error: 'Le mot de passe doit contenir entre 4 et 100 caractères.',
    });
    return;
  }

  const hashed = hashPasscode(passcode);
  const result = await saveClaimedHashToFirestore(hashed);
  if (result.alreadyExists) {
    sendJson(res, 409, {
      error: 'Le mot de passe administrateur est déjà configuré.',
    });
    return;
  }
  if (!result.saved) {
    // Fallback to in-memory cache if Firestore was unreachable, so preview stays usable
    cachedClaimedHash = hashed;
  }

  const token = issueBearerToken();
  sendJson(res, 200, { token });
}

export async function handleLogin(req, res) {
  if (req.method && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Méthode non autorisée.' });
    return;
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && record.resetAt > now && record.count >= 12) {
    sendJson(res, 429, {
      error: 'Trop de tentatives. Veuillez patienter une minute avant de réessayer.',
    });
    return;
  }

  const envPass = getConfiguredEnvPasscode();
  let storedHash = null;
  if (envPass.length === 0) {
    storedHash = await readClaimedHashFromFirestore();
    if (storedHash === null) {
      sendJson(res, 412, {
        error: 'Mot de passe non encore initialisé.',
        needsSetup: true,
      });
      return;
    }
  }

  const body = await readJsonBody(req);
  const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
  if (!passcode.trim()) {
    sendJson(res, 400, { error: 'Veuillez saisir le mot de passe.' });
    return;
  }

  const ok =
    envPass.length > 0
      ? verifyEnvPasscode(passcode, envPass)
      : verifyPasscodeAgainstHash(passcode.trim(), storedHash);

  if (!ok) {
    const nextCount = record && record.resetAt > now ? record.count + 1 : 1;
    loginAttempts.set(ip, { count: nextCount, resetAt: now + 60_000 });
    sendJson(res, 401, { error: 'Mot de passe incorrect.' });
    return;
  }

  loginAttempts.delete(ip);
  const token = issueBearerToken();
  sendJson(res, 200, { token });
}

export async function handleVerify(req, res) {
  const authHeader = req.headers?.authorization || '';
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    sendJson(res, 401, { valid: false });
    return;
  }
  const token = authHeader.slice(7);
  if (!verifyBearerToken(token)) {
    sendJson(res, 401, { valid: false });
    return;
  }
  sendJson(res, 200, { valid: true });
}
