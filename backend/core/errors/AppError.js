/**
 * backend/core/errors/AppError.js
 *
 * Canonical application error class and error-handling middleware.
 * Consolidates: backend/utils/errors.js (AppError, asyncHandler, errorHandler)
 *
 * Adds:
 *  - isOperational flag (safe to surface to client vs programmer bugs)
 *  - Typed error factory helpers
 *  - Structured error logging with correlation ID
 */

import { createLogger } from '../logging/logger.js';

const log = createLogger('error-handler');

// ── AppError ───────────────────────────────────────────────────────────────────

export class AppError extends Error {
  /**
   * @param {string} message       Human-readable message
   * @param {number} statusCode    HTTP status (400, 401, 403, 404, 409, 422, 500...)
   * @param {string} code          Machine-readable error code e.g. 'not_found'
   * @param {object|null} details  Extra context to include in API response
   * @param {boolean} isOperational  true = expected/handled; false = programmer bug
   */
  constructor(message, statusCode = 500, code = 'internal_error', details = null, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }
}

// ── Typed Factories ────────────────────────────────────────────────────────────

export const Errors = {
  badRequest:   (msg, details) => new AppError(msg, 400, 'bad_request', details),
  unauthorized: (msg)          => new AppError(msg || 'Authentication required', 401, 'unauthorized'),
  forbidden:    (msg)          => new AppError(msg || 'Access denied', 403, 'forbidden'),
  notFound:     (resource)     => new AppError(`${resource} not found`, 404, 'not_found'),
  conflict:     (msg, details) => new AppError(msg, 409, 'conflict', details),
  unprocessable:(msg, details) => new AppError(msg, 422, 'unprocessable_entity', details),
  internal:     (msg)          => new AppError(msg || 'Internal server error', 500, 'internal_error', null, false),
  serviceUnavailable: (msg)    => new AppError(msg || 'Service temporarily unavailable', 503, 'service_unavailable'),
};

// ── Async Wrapper ──────────────────────────────────────────────────────────────

/**
 * Wraps an async route handler so thrown errors are forwarded to Express's error pipeline.
 * Eliminates the try/catch boilerplate in every route.
 *
 * @param {Function} handler  async (req, res, next) => void
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// ── Error-handling Middleware ──────────────────────────────────────────────────

/**
 * Express error-handling middleware. Mount LAST in app.js.
 *
 * Logs error details server-side, returns only safe info to client.
 */
export const errorHandler = (err, req, res, _next) => {
  // Attach correlation ID from request if available
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || undefined;

  const statusCode = err.statusCode || 500;
  const code = err.code || 'internal_error';
  const isOperational = err.isOperational !== false;

  // Log server-side with full detail
  if (statusCode >= 500) {
    log.error('Unhandled error', {
      code,
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      correlationId,
      veteranId: req.veteranId,
    });
  } else {
    log.warn('Client error', {
      code,
      statusCode,
      message: err.message,
      method: req.method,
      path: req.path,
      correlationId,
    });
  }

  // Only include stack trace in development on non-operational errors
  const responseBody = {
    success: false,
    error: {
      code,
      message: isOperational ? err.message : 'An unexpected error occurred',
      details: err.details || null,
    },
  };

  if (correlationId) {
    responseBody.correlationId = correlationId;
  }

  res.status(statusCode).json(responseBody);
};

/**
 * Handle 404 for routes not matched by any router.
 * Mount BEFORE errorHandler.
 */
export const notFoundHandler = (req, _res, next) => {
  next(Errors.notFound(`Route ${req.method} ${req.path}`));
};
