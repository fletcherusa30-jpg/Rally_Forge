/**
 * Rally Forge Backend Hardening Patch
 * =====================================
 * 
 * Comprehensive security and reliability improvements for the VA Scanner backend
 * 
 * Installation:
 * 1. npm install express-rate-limit helmet express-validator compression
 * 2. Import this module in backend/app.js
 * 3. Apply middleware: app.use(hardeningMiddleware)
 * 
 * @version 1.0.0
 * @date 2026-02-21
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import compression from 'compression';

// ============================================================================
// CONFIGURATION
// ============================================================================

const HARDENING_CONFIG = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,         // limit each IP to 100 requests per windowMs
    scannerMaxRequests: 20,   // stricter limit for scanner endpoints
  },
  security: {
    maxBodySize: '10mb',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedOrigins: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://rallyforge.app',
      'https://www.rallyforge.app'
    ],
  },
  validation: {
    minTextLength: 20,
    maxTextLength: 1000000, // 1MB text
    allowedFileTypes: ['application/pdf'],
  },
  performance: {
    requestTimeout: 60000, // 60 seconds
    scanTimeout: 120000,   // 2 minutes for scanning
  }
};

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * General API rate limiter
 */
export const generalRateLimiter = rateLimit({
  windowMs: HARDENING_CONFIG.rateLimit.windowMs,
  max: HARDENING_CONFIG.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[Security] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(HARDENING_CONFIG.rateLimit.windowMs / 1000 / 60) + ' minutes'
    });
  }
});

/**
 * Strict rate limiter for scanner endpoints
 */
export const scannerRateLimiter = rateLimit({
  windowMs: HARDENING_CONFIG.rateLimit.windowMs,
  max: HARDENING_CONFIG.rateLimit.scannerMaxRequests,
  message: {
    success: false,
    error: 'Scanner rate limit exceeded. Please wait before scanning again.',
  },
  keyGenerator: (req) => {
    // Use IPv6-safe IP key + user identifier if available
    return `${ipKeyGenerator(req)}:${req.user?.id || 'anon'}`;
  },
  handler: (req, res) => {
    console.warn(`[Security] Scanner rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many scan requests. Maximum ' + HARDENING_CONFIG.rateLimit.scannerMaxRequests + ' scans per 15 minutes.',
    });
  }
});

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Helmet configuration for security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Needed for React dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for dev compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
});

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Sanitize text input
 */
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');
  
  // Remove control characters except newlines, tabs, and carriage returns
  sanitized = Array.from(sanitized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return !(code < 32 && code !== 9 && code !== 10 && code !== 13) && code !== 127;
    })
    .join('');
  
  // Limit length
  if (sanitized.length > HARDENING_CONFIG.validation.maxTextLength) {
    sanitized = sanitized.substring(0, HARDENING_CONFIG.validation.maxTextLength);
  }
  
  return sanitized;
}

/**
 * Validate scan text request
 */
export const validateScanText = [
  body('text')
    .exists().withMessage('Text field is required')
    .isString().withMessage('Text must be a string')
    .trim()
    .isLength({ min: HARDENING_CONFIG.validation.minTextLength })
    .withMessage(`Text must be at least ${HARDENING_CONFIG.validation.minTextLength} characters`)
    .isLength({ max: HARDENING_CONFIG.validation.maxTextLength })
    .withMessage(`Text must be less than ${HARDENING_CONFIG.validation.maxTextLength} characters`)
    .customSanitizer(value => sanitizeText(value)),
];

/**
 * Validation error handler
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.warn('[Validation] Request failed validation:', {
      ip: req.ip,
      path: req.path,
      errors: errors.array()
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      }))
    });
  }
  
  next();
}

// ============================================================================
// REQUEST TIMEOUT
// ============================================================================

/**
 * Request timeout middleware
 */
export function requestTimeout(timeout = HARDENING_CONFIG.performance.requestTimeout) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error('[Timeout] Request exceeded timeout:', {
          method: req.method,
          path: req.path,
          timeout: timeout
        });
        
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request took longer than ${timeout / 1000} seconds`
        });
      }
    }, timeout);
    
    // Clear timeout on response finish
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
}

// ============================================================================
// CORS HARDENING
// ============================================================================

/**
 * Strict CORS configuration
 */
export function strictCors(req, res, next) {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && HARDENING_CONFIG.security.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Production: strict origin checking
    console.warn('[Security] Rejected request from unauthorized origin:', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '600'); // 10 minutes
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Safe error response (don't leak stack traces in production)
 */
export function safeErrorResponse(err, req, res) {
  const isDev = process.env.NODE_ENV === 'development';
  
  console.error('[Error Handler]', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  
  const response = {
    success: false,
    error: err.message || 'Internal server error',
  };
  
  // Only include stack in development
  if (isDev) {
    response.stack = err.stack;
    response.details = err.details;
  }
  
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json(response);
}

// ============================================================================
// REQUEST LOGGING
// ============================================================================

/**
 * Enhanced request logger with security markers
 */
export function securityLogger(req, res, next) {
  const start = Date.now();
  
  // Log request
  console.log('[Request]', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length'),
  });
  
  // Detect suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,           // Path traversal
    /<script/i,         // XSS attempt
    /union.*select/i,   // SQL injection
    /javascript:/i,     // XSS attempt
    /eval\(/i,          // Code injection
  ];
  
  const pathAndQuery = req.path + (req.query ? JSON.stringify(req.query) : '');
  const bodyStr = req.body ? JSON.stringify(req.body).substring(0, 500) : '';
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(pathAndQuery) || pattern.test(bodyStr)) {
      console.warn('[Security Alert] Suspicious pattern detected:', {
        pattern: pattern.source,
        ip: req.ip,
        path: req.path,
      });
    }
  }
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    console.log('[Response]', {
      requestId: req.requestId,
      status: res.statusCode,
      duration: duration + 'ms',
    });
    
    // Alert on slow requests
    if (duration > 5000) {
      console.warn('[Performance] Slow request detected:', {
        path: req.path,
        duration: duration + 'ms',
      });
    }
  });
  
  next();
}

// ============================================================================
// FILE UPLOAD HARDENING
// ============================================================================

/**
 * Validate uploaded file
 */
export function validateFileUpload(req, res, next) {
  if (!req.file) {
    return next();
  }
  
  const file = req.file;
  
  // Check file size
  if (file.size > HARDENING_CONFIG.security.maxFileSize) {
    return res.status(413).json({
      success: false,
      error: `File too large. Maximum size: ${HARDENING_CONFIG.security.maxFileSize / 1024 / 1024}MB`,
    });
  }
  
  // Check mime type
  if (!HARDENING_CONFIG.validation.allowedFileTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: `Invalid file type. Allowed: ${HARDENING_CONFIG.validation.allowedFileTypes.join(', ')}`,
    });
  }
  
  // Check for double extension (suspicious)
  const filename = file.originalname.toLowerCase();
  if (filename.split('.').length > 2) {
    console.warn('[Security] Suspicious double extension detected:', filename);
  }
  
  // Basic magic number validation for PDF
  if (file.mimetype === 'application/pdf') {
    const magicNumber = file.buffer.slice(0, 5).toString();
    if (!magicNumber.startsWith('%PDF-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PDF file. File does not match PDF format.',
      });
    }
  }
  
  console.log('[File Upload] Validated:', {
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  });
  
  next();
}

// ============================================================================
// COMBINED HARDENING MIDDLEWARE
// ============================================================================

/**
 * Apply all hardening measures
 */
export function applyHardening(app) {
  console.log('[Security] Applying backend hardening patch...');
  
  // 1. Compression
  app.use(compression());
  
  // 2. Security headers
  app.use(securityHeaders);
  
  // 3. Strict CORS
  app.use(strictCors);
  
  // 4. Request logging
  app.use(securityLogger);
  
  // 5. General rate limiting
  app.use('/api', generalRateLimiter);
  
  // 6. Scanner-specific rate limiting
  app.use('/api/scanner', scannerRateLimiter);
  
  // 7. Request timeout
  app.use(requestTimeout());
  
  console.log('[Security] Backend hardening applied ✅');
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  applyHardening,
  generalRateLimiter,
  scannerRateLimiter,
  securityHeaders,
  validateScanText,
  handleValidationErrors,
  sanitizeText,
  requestTimeout,
  strictCors,
  safeErrorResponse,
  securityLogger,
  validateFileUpload,
  HARDENING_CONFIG,
};

