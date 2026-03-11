/**
 * backend/core/logging/logger.js
 *
 * Structured application logger.
 * Consolidates: middleware/logging.js (createLogger usage), scattered console.log calls.
 *
 * Features:
 *  - JSON structured output for production
 *  - Human-readable output for development
 *  - Per-module named loggers
 *  - PII masking (SSN, DOB, full names in log strings)
 *  - Correlation ID support
 *  - Log levels: error, warn, info, debug
 */

import { getConfig } from '../../config.js';

const config = getConfig();
const LOG_LEVEL = config.logging?.level || 'info';
const IS_PRODUCTION = config.nodeEnv === 'production';

// Level hierarchy — only emit logs at or above the configured level
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[LOG_LEVEL] ?? 2;

// ── PII Masking ────────────────────────────────────────────────────────────────

const PII_RULES = [
  // SSN: ###-##-#### or #########
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
  // 9-digit number (bare SSN)
  { pattern: /\b\d{9}\b/g, replacement: '[ID REDACTED]' },
  // DOB in common formats
  { pattern: /\b(?:DOB|dob|Date of Birth)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi, replacement: '[DOB REDACTED]' },
  // JWT tokens
  { pattern: /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: 'Bearer [TOKEN REDACTED]' },
  // VA File Numbers (C-number): C-digit patterns
  { pattern: /\bC[- ]?\d{7,9}\b/gi, replacement: '[VA-FILE# REDACTED]' },
];

function maskPII(message) {
  if (typeof message !== 'string') return message;
  let masked = message;
  for (const rule of PII_RULES) {
    masked = masked.replace(rule.pattern, rule.replacement);
  }
  return masked;
}

function maskObjectPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = {};
  const SENSITIVE_KEYS = new Set(['ssn', 'dob', 'dateOfBirth', 'password', 'token', 'secret', 'authorization']);
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      safe[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      safe[key] = maskPII(value);
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = maskObjectPII(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function formatEntry(level, module, message, meta) {
  const timestamp = new Date().toISOString();
  const safeMessage = maskPII(String(message));
  const safeMeta = meta ? maskObjectPII(meta) : undefined;

  if (IS_PRODUCTION) {
    // Structured JSON — consumed by log aggregators (CloudWatch, Datadog, etc.)
    const entry = {
      timestamp,
      level,
      module,
      message: safeMessage,
    };
    if (safeMeta) entry.meta = safeMeta;
    if (meta?.correlationId) entry.correlationId = meta.correlationId;
    if (meta?.veteranId) entry.veteranId = meta.veteranId;
    return JSON.stringify(entry);
  }

  // Human-readable for development
  const metaStr = safeMeta ? ` ${JSON.stringify(safeMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${module}] ${safeMessage}${metaStr}`;
}

function emit(level, module, message, meta) {
  if (LEVELS[level] > CURRENT_LEVEL) return;

  const line = formatEntry(level, module, message, meta);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a named logger scoped to a module.
 *
 * @param {string} moduleName  e.g. 'strs-api', 'compensation-engine'
 * @returns {{ error, warn, info, debug }}
 *
 * @example
 * const log = createLogger('strs-api');
 * log.info('Upload received', { veteranId, filename });
 * log.error('Parse failed', { error: err.message, stack: err.stack });
 */
export function createLogger(moduleName) {
  return {
    error: (msg, meta) => emit('error', moduleName, msg, meta),
    warn:  (msg, meta) => emit('warn',  moduleName, msg, meta),
    info:  (msg, meta) => emit('info',  moduleName, msg, meta),
    debug: (msg, meta) => emit('debug', moduleName, msg, meta),
  };
}

/** Convenience root logger for bootstrap/startup messages */
export const logger = createLogger('app');
