import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import RateLimit from 'express-rate-limit';
import { buildRouteManifest } from './api/routeManifest.js';
import { requestLogger, consoleLogger, errorLogger } from './middleware/logging.js';
import { notFoundHandler, errorHandler } from './core/index.js';
import { getConfig } from './config.js';
import {
  createCorsOptions,
  generalRateLimiter,
  requestTimeout,
  responseCompression,
  securityHeaders,
} from './middleware/hardening.js';

const config = getConfig();

const authLimiter = RateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later'
});

export function createApp() {
  const app = express();
  const routeManifest = buildRouteManifest({ authLimiter });
  app.locals.routeManifest = routeManifest.map(({ path, category }) => ({ path, category }));
  app.set('trust proxy', config.isProduction ? 1 : false);

  // ═════════════════════════════════════════════════════════════
  // LOGGING (First middleware - log everything)
  // ═════════════════════════════════════════════════════════════
  app.use(requestLogger);
  if (config.isDevelopment) {
    app.use(consoleLogger);
  }

  // Attach a correlation id so audit and error logs can be tied back to a single request.
  app.use((req, res, next) => {
    const correlationIdHeader = req.headers['x-correlation-id'];
    const correlationId = typeof correlationIdHeader === 'string' && correlationIdHeader.trim()
      ? correlationIdHeader
      : randomUUID();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });

  // Reduce compression-based bandwidth costs without changing route semantics.
  app.use(responseCompression);

  // Harden browser-facing headers against clickjacking, sniffing, and unsafe framing.
  app.use(securityHeaders);

  // ═════════════════════════════════════════════════════════════
  // CORS Configuration
  // ═════════════════════════════════════════════════════════════
  // Reject unexpected browser origins in production instead of silently widening cross-origin access.
  app.use(cors(createCorsOptions()));

  // Fail slow or stuck requests deterministically so worker threads and sockets do not linger indefinitely.
  app.use(requestTimeout());

  // ═════════════════════════════════════════════════════════════
  // BODY PARSING & REQUEST HANDLING
  // ═════════════════════════════════════════════════════════════
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ═════════════════════════════════════════════════════════════
  // GENERAL RATE LIMITING (All endpoints)
  // ═════════════════════════════════════════════════════════════
  // Slow down unauthenticated bursts before they reach route handlers and external integrations.
  app.use('/api/', generalRateLimiter);

  // ═════════════════════════════════════════════════════════════
  // API ROUTE REGISTRATION
  // ═════════════════════════════════════════════════════════════
  for (const entry of routeManifest) {
    const { path, router, middlewares = [] } = entry;
    app.use(path, ...middlewares, router);
  }

  // Provide a simple root endpoint so service checks to "/" do not hit the 404 pipeline.
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'Rally Forge Backend API',
      health: '/api/health',
      routes: app.locals.routeManifest,
    });
  });

  // ═════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═════════════════════════════════════════════════════════════
  app.use(errorLogger);

  // ═════════════════════════════════════════════════════════════
  // 404 + GLOBAL ERROR HANDLERS (Must be last)
  // ═════════════════════════════════════════════════════════════
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

