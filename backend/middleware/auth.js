/**
 * JWT Authentication Middleware
 * Handles token generation, validation, and refresh logic
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getConfig } from '../config.js';

const config = getConfig();

/**
 * Generate JWT token for a veteran
 */
export const generateToken = (veteranId, role = 'veteran', expiresIn = '24h') => {
  const payload = {
    veteranId,
    role,
    iat: Math.floor(Date.now() / 1000),
    type: 'access'
  };

  return jwt.sign(payload, config.jwt.secret, { expiresIn });
};

/**
 * Generate refresh token (longer expiration)
 */
export const generateRefreshToken = (veteranId) => {
  const payload = {
    veteranId,
    iat: Math.floor(Date.now() / 1000),
    type: 'refresh'
  };

  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Express middleware: Authenticate incoming requests
 * Extracts and validates Bearer token from Authorization header
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    req.veteranId = decoded.veteranId;
    next();
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Express middleware: Require specific role
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        requiredRole: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Hash password with bcrypt
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Optional Authentication: Pass if token present, continue if not
 * Useful for endpoints that work authenticated or anonymous
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      req.veteranId = decoded.veteranId;
    } catch {
      // Ignore auth errors for optional endpoints
      req.user = null;
    }
  }

  next();
};

/**
 * Token refresh endpoint logic
 */
export const refreshAccessToken = (req, res) => {
  const refreshToken = req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = generateToken(decoded.veteranId, decoded.role);

    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: '24h'
    });
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: error.message
    });
  }
};
