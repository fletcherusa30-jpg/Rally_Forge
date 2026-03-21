import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { getConfig } from '../config.js';

const config = getConfig();

const HARDENING_CONFIG = {
  rateLimit: {
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
    scannerMaxRequests: 20,
  },
  security: {
    maxBodySize: '10mb',
    maxFileSize: config.upload.maxFileSizeBytes,
    allowedOrigins: config.cors.origins,
  },
  validation: {
    allowedFileTypes: ['application/pdf'],
  },
  performance: {
    requestTimeout: 60_000,
  }
};

export const generalRateLimiter = rateLimit({
  windowMs: HARDENING_CONFIG.rateLimit.windowMs,
  max: HARDENING_CONFIG.rateLimit.maxRequests,
  message: 'Too many requests, please try again later',
  skip: (req) => {
    const requestPath = req.path || '';
    return requestPath === '/health' || requestPath.startsWith('/audit/');
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const scannerRateLimiter = rateLimit({
  windowMs: HARDENING_CONFIG.rateLimit.windowMs,
  max: HARDENING_CONFIG.rateLimit.scannerMaxRequests,
  message: {
    success: false,
    error: 'Scanner rate limit exceeded. Please wait before scanning again.',
  },
  keyGenerator: (/** @type {import('express').Request & { user?: { id?: string } }} */ req) => {
    // Use IPv6-safe IP key + user identifier if available
    return `${ipKeyGenerator(req)}:${req.user?.id || 'anon'}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const securityHeaders = helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: config.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
});

export function requestTimeout(timeout = HARDENING_CONFIG.performance.requestTimeout) {
  return (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res, /** @type {import('express').NextFunction} */ next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request took longer than ${timeout / 1000} seconds`
        });
      }
    }, timeout);

    timer.unref?.();
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

export function createCorsOptions() {
  return {
    origin(/** @type {string | undefined} */ origin, /** @type {(err: Error | null, allow?: boolean) => void} */ callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (config.isDevelopment && /^https?:\/\/localhost(?::\d+)?$/i.test(origin)) {
        callback(null, true);
        return;
      }

      if (HARDENING_CONFIG.security.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

export const responseCompression = compression({ threshold: 1024 });

export function validateFileUpload(req, res, next) {
  if (!req.file) {
    return next();
  }
  
  const file = req.file;

  if (file.size > HARDENING_CONFIG.security.maxFileSize) {
    return res.status(413).json({
      success: false,
      error: `File too large. Maximum size: ${HARDENING_CONFIG.security.maxFileSize / 1024 / 1024}MB`,
    });
  }

  if (!HARDENING_CONFIG.validation.allowedFileTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: `Invalid file type. Allowed: ${HARDENING_CONFIG.validation.allowedFileTypes.join(', ')}`,
    });
  }

  const filename = file.originalname.toLowerCase();
  if (filename.split('.').length > 2) {
    console.warn('[Security] Suspicious double extension detected:', filename);
  }

  if (file.mimetype === 'application/pdf') {
    const magicNumber = file.buffer.slice(0, 5).toString();
    if (!magicNumber.startsWith('%PDF-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PDF file. File does not match PDF format.',
      });
    }
  }

  next();
}

export default {
  createCorsOptions,
  generalRateLimiter,
  requestTimeout,
  responseCompression,
  securityHeaders,
  scannerRateLimiter,
  validateFileUpload,
  HARDENING_CONFIG,
};

