/**
 * Configuration Management
 * Loads and validates environment variables
 * Centralizes all configuration in one place
 */

// @ts-check

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local if it exists
const envFile = path.join(__dirname, '.env.local');
dotenv.config({ path: envFile });

/**
 * @typedef {object} BackendConfig
 * @property {number} port
 * @property {string} nodeEnv
 * @property {boolean} isProduction
 * @property {boolean} isDevelopment
 * @property {{ url: string, poolSize: number, idleTimeout: number }} database
 * @property {{ origins: string[] }} cors
 * @property {{ host: string, port: number, password?: string }} redis
 * @property {{ secret: string, expiresIn: string, refreshExpiresIn: string }} jwt
 * @property {{ anthropic: string | null, vaApi: string | null }} apiKeys
 * @property {{ aiAnalysis: boolean, vaIntegration: boolean }} features
 * @property {{ level: string, dir: string }} logging
 * @property {{ windowMs: number, maxRequests: number }} rateLimit
 * @property {{ maxFileSizeMB: number, maxFileSizeBytes: number }} upload
 */

/** @type {BackendConfig | undefined} */
let cachedConfig;

/**
 * Validate required environment variables
 * @param {string} key
 * @returns {string | null}
 */
const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠️  Missing environment variable: ${key}`);
    return null;
  }
  return value;
};

/**
 * Parse comma-separated string into array
 * @param {string | undefined} str
 * @returns {string[]}
 */
const parseArray = (str) => {
  if (!str) return [];
  return str.split(',').map((/** @type {string} */ s) => s.trim()).filter(Boolean);
};

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * @returns {BackendConfig}
 */
function buildConfig() {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  const isDevelopment = env === 'development';
  const maxFileSizeMB = parseInteger(process.env.MAX_FILE_SIZE_MB, 50);

  return {
    port: parseInteger(process.env.PORT, 4000),
    nodeEnv: env,
    isProduction,
    isDevelopment,
    database: {
      url: requireEnv('DATABASE_URL') || 'postgresql://postgres:devpassword@localhost:5432/rally_forge',
      poolSize: isProduction ? 20 : 5,
      idleTimeout: 30000
    },
    cors: {
      origins: parseArray(process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInteger(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'development-secret-not-for-production',
      expiresIn: '24h',
      refreshExpiresIn: '7d'
    },
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY || null,
      vaApi: process.env.VA_API_KEY || null
    },
    features: {
      aiAnalysis: process.env.ENABLE_AI_ANALYSIS === 'true',
      vaIntegration: process.env.ENABLE_VA_INTEGRATION === 'true'
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      dir: process.env.LOG_DIR || 'logs'
    },
    rateLimit: {
      windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 900000),
      maxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
    },
    upload: {
      maxFileSizeMB,
      maxFileSizeBytes: maxFileSizeMB * 1024 * 1024
    }
  };
}

/**
 * Get configuration object
 */
export const getConfig = () => {
  cachedConfig ??= buildConfig();
  return cachedConfig;
};

// Validate critical config on startup
export const validateConfig = () => {
  const config = getConfig();
  
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }

  if (!config.jwt.secret || config.jwt.secret.includes('development')) {
    console.warn('⚠️  JWT_SECRET using development fallback - INSECURE FOR PRODUCTION');
  }

  return config;
};
