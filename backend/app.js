import express from 'express';
import cors from 'cors';
import RateLimit from 'express-rate-limit';
import scannerRouter from './api/scanner.js';
import compensationRouter from './api/compensation.js';
import financialRouter from './api/financial.js';
import healthRouter from './api/health.js';
import strsRouter from './api/strs.js';
import militaryRouter from './api/military.js';
import knowledgeRouter from './api/knowledge.js';
import casesRouter from './api/cases.js';
import intelligenceRouter from './api/intelligence.js';
import stateBenefitsRouter from './api/stateBenefits.js';
import authRouter from './api/auth.js';
import { requestLogger, consoleLogger, errorLogger } from './middleware/logging.js';
import { getConfig } from './config.js';

const config = getConfig();

// Rate limiters for different endpoints
const apiLimiter = RateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = RateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later'
});

export function createApp() {
  const app = express();

  // ═════════════════════════════════════════════════════════════
  // LOGGING (First middleware - log everything)
  // ═════════════════════════════════════════════════════════════
  app.use(requestLogger);
  if (config.isDevelopment) {
    app.use(consoleLogger);
  }

  // ═════════════════════════════════════════════════════════════
  // CORS Configuration
  // ═════════════════════════════════════════════════════════════
  app.use(cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // ═════════════════════════════════════════════════════════════
  // BODY PARSING & REQUEST HANDLING
  // ═════════════════════════════════════════════════════════════
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ═════════════════════════════════════════════════════════════
  // GENERAL RATE LIMITING (All endpoints)
  // ═════════════════════════════════════════════════════════════
  app.use('/api/', apiLimiter);

  // ═════════════════════════════════════════════════════════════
  // HEALTH CHECK (No auth required)
  // ═════════════════════════════════════════════════════════════
  app.use('/api/health', healthRouter);

  // ═════════════════════════════════════════════════════════════
  // AUTHENTICATION ROUTES (No auth required - entry point)
  // ═════════════════════════════════════════════════════════════
  app.use('/api/auth', authLimiter, authRouter);

  // ═════════════════════════════════════════════════════════════
  // PROTECTED ROUTES (Auth required)
  // ═════════════════════════════════════════════════════════════
  app.use('/api/scanner', scannerRouter);
  app.use('/api/strs', strsRouter);
  app.use('/api/compensation', compensationRouter);
  app.use('/api/financial', financialRouter);
  app.use('/api/military', militaryRouter);
  app.use('/api/cases', casesRouter);
  app.use('/api', intelligenceRouter);
  app.use('/api/state-benefits', stateBenefitsRouter);
  app.use('/api', knowledgeRouter);

  // ═════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═════════════════════════════════════════════════════════════
  app.use(errorLogger);

  // ═════════════════════════════════════════════════════════════
  // 404 Handler (Last middleware)
  // ═════════════════════════════════════════════════════════════
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
      method: req.method
    });
  });

  // ═════════════════════════════════════════════════════════════
  // GLOBAL ERROR HANDLER (Must be last)
  // ═════════════════════════════════════════════════════════════
  app.use((err, req, res, _next) => {
    console.error('❌ Unhandled error:', err);

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
      success: false,
      error: message,
      ...(config.isDevelopment && { stack: err.stack })
    });
  });

  return app;
}

