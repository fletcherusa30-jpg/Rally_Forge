/**
 * backend/core/index.js
 *
 * Barrel export for the core layer.
 * Import from here wherever you need core primitives.
 *
 * @example
 * import { createLogger, AppError, Errors, asyncHandler, errorHandler } from '../core/index.js';
 */

export { createLogger, logger } from './logging/logger.js';
export { AppError, Errors, asyncHandler, errorHandler, notFoundHandler } from './errors/AppError.js';
