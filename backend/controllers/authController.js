import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  comparePassword,
} from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localUsersPath = path.join(__dirname, '..', 'data', 'localUsers.json');

let cachedUsers = null;

async function loadLocalUsers() {
  if (cachedUsers) {
    return cachedUsers;
  }

  try {
    const raw = await fs.readFile(localUsersPath, 'utf-8');
    const users = JSON.parse(raw);
    cachedUsers = Array.isArray(users) ? users : [];
    return cachedUsers;
  } catch {
    cachedUsers = [];
    return cachedUsers;
  }
}

export async function login(req, res) {
  const { email, password } = req.validatedData;

  const users = await loadLocalUsers();
  const user = users.find((entry) => {
    return String(entry?.email || '').toLowerCase() === email.toLowerCase();
  });

  if (!user || user.active === false) {
    return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  }

  const passwordOk = await comparePassword(password, String(user.passwordHash || ''));
  if (!passwordOk) {
    return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  }

  const veteranId = String(user.id || email.split('@')[0]).replace(/[^a-z0-9-]/g, '');
  const role = String(user.role || 'veteran');
  const accessToken = generateToken(veteranId, role);
  const refreshToken = generateRefreshToken(veteranId);

  res.json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: '24h',
    veteran: {
      id: veteranId,
      email: String(user.email || email),
      role,
    },
  });
}

export async function logout(_req, res) {
  res.json({ success: true, message: 'Logged out successfully' });
}

export function refresh(req, res) {
  refreshAccessToken(req, res);
}

export async function me(req, res) {
  res.json({
    success: true,
    user: {
      veteranId: req.user.veteranId,
      role: req.user.role,
      expiresAt: new Date(req.user.exp * 1000).toISOString(),
    },
  });
}

export async function verify(req, res) {
  res.json({
    success: true,
    valid: true,
    user: {
      veteranId: req.user.veteranId,
      role: req.user.role,
    },
  });
}
