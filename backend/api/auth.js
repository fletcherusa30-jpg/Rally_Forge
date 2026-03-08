/**
 * Authentication API Routes
 * Handles login, logout, token refresh
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  authenticateToken,
  comparePassword
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { validateRequest, loginSchema } from '../validation/schemas.js';

const router = express.Router();
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

/**
 * POST /api/auth/login
 * Local file-backed authentication mode
 */
router.post('/login', 
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validatedData;

    const users = await loadLocalUsers();
    const user = users.find((entry) => {
      return String(entry?.email || '').toLowerCase() === email.toLowerCase();
    });

    if (!user || user.active === false) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const passwordOk = await comparePassword(password, String(user.passwordHash || ''));
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
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
        role
      }
    });
  })
);

/**
 * POST /api/auth/logout
 * (Frontend removes token from localStorage)
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // In production with DB, could blacklist the token
  // For now, just confirm
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * POST /api/auth/refresh
 * Exchange refresh token for new access token
 */
router.post('/refresh', asyncHandler((req, res) => {
  refreshAccessToken(req, res);
}));

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', 
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      user: {
        veteranId: req.user.veteranId,
        role: req.user.role,
        expiresAt: new Date(req.user.exp * 1000).toISOString()
      }
    });
  })
);

/**
 * POST /api/auth/verify
 * Verify if token is still valid
 */
router.post('/verify',
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      valid: true,
      user: {
        veteranId: req.user.veteranId,
        role: req.user.role
      }
    });
  })
);

export default router;
