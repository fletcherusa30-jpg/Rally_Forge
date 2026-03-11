/**
 * Authentication API Routes
 * Handles login, logout, token refresh
 */

import express from 'express';
import {
  authenticateToken,
} from '../middleware/auth.js';
import { asyncHandler } from '../core/index.js';
import { validateRequest, loginSchema } from '../validation/schemas.js';
import {
  login,
  logout,
  refresh,
  me,
  verify,
} from '../controllers/authController.js';

const router = express.Router();
/**
 * POST /api/auth/login
 * Local file-backed authentication mode
 */
router.post('/login', 
  validateRequest(loginSchema),
  asyncHandler(login)
);

/**
 * POST /api/auth/logout
 * (Frontend removes token from localStorage)
 */
router.post('/logout', asyncHandler(logout));

/**
 * POST /api/auth/refresh
 * Exchange refresh token for new access token
 */
router.post('/refresh', asyncHandler(refresh));

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', 
  authenticateToken,
  asyncHandler(me)
);

/**
 * POST /api/auth/verify
 * Verify if token is still valid
 */
router.post('/verify',
  authenticateToken,
  asyncHandler(verify)
);

export default router;
