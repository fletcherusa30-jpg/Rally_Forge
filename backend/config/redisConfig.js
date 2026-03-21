/**
 * Central Redis configuration module.
 * Redis is OPTIONAL. The app starts normally when Redis is unavailable or
 * disabled. Connection is only attempted when REDIS_ENABLED=true.
 *
 * Exported surface:
 *   isRedisAvailable() → boolean
 *   getRedisClient()   → ioredis.Redis | null
 *   isRedisEnabled()   → boolean
 */

import Redis from 'ioredis';

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

let _client = null;
let _available = false;
let _initialized = false;
let _warningLogged = false;

function buildClientOptions() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 500, 3000);
    },
  };
}

function logDegraded(reason) {
  if (!_warningLogged) {
    _warningLogged = true;
    console.warn(
      `[RedisConfig] Redis not available — async PDF queue features degraded; synchronous flows remain healthy. (${reason})`
    );
  }
}

async function initRedis() {
  if (_initialized) return;
  _initialized = true;

  if (!REDIS_ENABLED) {
    console.log(
      '[RedisConfig] REDIS_ENABLED=false — Redis disabled; async PDF queue features degraded; synchronous flows remain healthy.'
    );
    return;
  }

  try {
    _client = new Redis(buildClientOptions());

    _client.on('ready', () => {
      _available = true;
      _warningLogged = false;
      console.log('[RedisConfig] Redis connected and ready.');
    });

    _client.on('error', (err) => {
      _available = false;
      logDegraded(err.message);
    });

    _client.on('close', () => {
      _available = false;
    });
  } catch (err) {
    _available = false;
    logDegraded(err.message);
  }
}

initRedis().catch(() => {});

/**
 * Returns true when Redis is connected and ready.
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return _available;
}

/**
 * Returns the ioredis client when available, or null when unavailable.
 * @returns {import('ioredis').Redis | null}
 */
export function getRedisClient() {
  return _available ? _client : null;
}

/**
 * Returns whether Redis is configured as enabled via REDIS_ENABLED env var.
 * @returns {boolean}
 */
export function isRedisEnabled() {
  return REDIS_ENABLED;
}
