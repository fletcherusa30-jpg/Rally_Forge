/**
 * HTTP Request Logging Middleware
 * Logs all incoming requests to console and file
 */

import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config.js';

const config = getConfig();

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

const errorLogStream = fs.createWriteStream(
  path.join(logsDir, 'error.log'),
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
  return req.path === '/api/health' || req.path.match(/\.(css|js|png|jpg|gif|ico)$/);
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
    message: err.message,
    stack: err.stack,
    veteranId: req.veteranId || 'anonymous',
    userAgent: req.headers['user-agent']
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
export const createLogger = (module) => {
  const logFile = path.join(logsDir, `${module}.log`);

  return {
    info: (message, data = {}) => {
      const log = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        module,
        message,
        ...data
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
      if (config.isDevelopment) console.log('ℹ️ ', message, data);
    },

    warning: (message, data = {}) => {
      const log = {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        module,
        message,
        ...data
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
      console.warn('⚠️ ', message, data);
    },

    error: (message, error, data = {}) => {
      const log = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        module,
        message,
        errorMessage: error?.message,
        errorStack: error?.stack,
        ...data
      };
      fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
      console.error('❌ ', message, error?.message);
    },

    debug: (message, data = {}) => {
      if (config.isDevelopment) {
        const log = {
          timestamp: new Date().toISOString(),
          level: 'DEBUG',
          module,
          message,
          ...data
        };
        fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
        console.debug('🐛 ', message, data);
      }
    }
  };
};

export const logger = createLogger('application');
