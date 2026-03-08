/**
 * Configuration Management
 * Loads and validates environment variables
 * Centralizes all configuration in one place
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local if it exists
const envFile = path.join(__dirname, '.env.local');
dotenv.config({ path: envFile });

/**
 * Validate required environment variables
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
 */
const parseArray = (str) => {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
};

/**
 * Get configuration object
 */
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  const isDevelopment = env === 'development';

  return {
    // Server
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: env,
    isProduction,
    isDevelopment,

    // Database
    database: {
      url: requireEnv('DATABASE_URL') || 'postgresql://postgres:devpassword@localhost:5432/rally_forge',
      poolSize: isProduction ? 20 : 5,
      idleTimeout: 30000
    },

    // CORS
    cors: {
      origins: parseArray(process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    },

    // Redis (for job queue)
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined
    },

    // JWT Authentication
    jwt: {
      secret: process.env.JWT_SECRET || 'development-secret-not-for-production',
      expiresIn: '24h',
      refreshExpiresIn: '7d'
    },

    // API Keys
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY || null,
      vaApi: process.env.VA_API_KEY || null
    },

    // Feature Flags
    features: {
      aiAnalysis: process.env.ENABLE_AI_ANALYSIS === 'true',
      vaIntegration: process.env.ENABLE_VA_INTEGRATION === 'true'
    },

    // Logging
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      dir: process.env.LOG_DIR || 'logs'
    },

    // Rate Limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    },

    // File Upload
    upload: {
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
      maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024
    }
  };
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
