/**
 * HTTP Request Logging Middleware
 * Logs all incoming requests to console and file
 */

import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config.js';
import { createLogger as createCoreLogger } from '../core/logging/logger.js';

const config = getConfig();

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'token',
  'authorization',
  'apiKey',
  'ssn',
  'email',
  'phone',
  'dob',
]);

function maskString(value) {
  const text = String(value || '');
  if (!text) return text;

  let masked = text;
  masked = masked.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '***-**-****');
  masked = masked.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '***@***');
  masked = masked.replace(/\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '(***) ***-****');
  return masked;
}

function maskSensitive(meta) {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }

  if (Array.isArray(meta)) {
    return meta.map((item) => maskSensitive(item));
  }

  const output = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowered = String(key).toLowerCase();
    if (SENSITIVE_KEYS.has(lowered)) {
      output[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string') {
      output[key] = maskString(value);
      continue;
    }

    output[key] = maskSensitive(value);
  }

  return output;
}

// Ensure logs directory exists
const logsDir = config.logging.dir;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for different log levels
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

/**
 * Custom Morgan token for user identification
 */
morgan.token('veteranId', (req) => {
  return req.veteranId || 'anonymous';
});

/**
 * Custom Morgan format with veteranId
 */
const morganFormat = ':remote-addr - :veteranId [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

/**
 * Skip function: Don't log health checks or static assets
 */
const skipHealthChecks = (req) => {
  return req.path === '/api/health' || /\.(css|js|png|jpg|gif|ico)$/i.test(req.path || '');
};

/**
 * Access logging middleware
 */
export const requestLogger = morgan(morganFormat, {
  stream: accessLogStream,
  skip: skipHealthChecks
});

/**
 * Console logging for development
 */
export const consoleLogger = morgan(morganFormat, {
  skip: skipHealthChecks
});

/**
 * Error logging middleware
 * Logs 4xx and 5xx responses
 */
export const errorLogger = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    level: 'ERROR',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode || 500,
    message: maskString(err.message),
    stack: config.isDevelopment ? err.stack : undefined,
    veteranId: req.veteranId || 'anonymous',
    userAgent: req.headers['user-agent'],
    query: maskSensitive(req.query),
    params: maskSensitive(req.params),
  };

  // Write to error log
  fs.appendFileSync(
    path.join(logsDir, 'error.log'),
    JSON.stringify(errorLog) + '\n'
  );

  // Also log to console in development
  if (config.isDevelopment) {
    console.error('❌ ERROR:', errorLog);
  }

  next(err);
};

/**
 * Structured logging utility for application logs
 */
export const createLogger = (moduleName) => {
  const base = createCoreLogger(moduleName);

  return {
    info: (message, data = {}) => base.info(maskString(message), maskSensitive(data)),
    warn: (message, data = {}) => base.warn(maskString(message), maskSensitive(data)),
    warning: (message, data = {}) => base.warn(maskString(message), maskSensitive(data)),
    error: (message, errorOrMeta = {}, data = {}) => {
      if (errorOrMeta instanceof Error) {
        base.error(maskString(message), {
          errorMessage: maskString(errorOrMeta.message),
          errorStack: errorOrMeta.stack,
          ...maskSensitive(data),
        });
        return;
      }

      base.error(maskString(message), {
        ...maskSensitive(errorOrMeta || {}),
        ...maskSensitive(data),
      });
    },
    debug: (message, data = {}) => base.debug(maskString(message), maskSensitive(data)),
  };
};

export const logger = createLogger('application');
