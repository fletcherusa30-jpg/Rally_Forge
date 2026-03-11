/**
 * backend/data/access/RedisDataSource.js
 *
 * Optional Redis (ioredis) wrapper for caching.
 * Degrades gracefully when Redis is unavailable — cache misses are returned
 * instead of errors, matching the existing pattern in pdfQueue.js.
 *
 * Uses the same redis config block as backend/config.js.
 */

import { createLogger } from '../../core/logging/logger.js';
import { getConfig } from '../../config.js';

const log = createLogger('redis-data-source');

// Lazy import so the app starts even when ioredis is absent (development)
let Redis = null;
async function getRedisClass() {
  if (!Redis) {
    try {
      const mod = await import('ioredis');
      Redis = mod.default ?? mod;
    } catch {
      Redis = null;
    }
  }
  return Redis;
}

let _client = null;
let _unavailable = false;

async function getClient() {
  if (_unavailable) return null;
  if (_client && _client.status === 'ready') return _client;

  const RedisClass = await getRedisClass();
  if (!RedisClass) {
    if (!_unavailable) {
      log.warn('ioredis module not found — Redis cache disabled');
      _unavailable = true;
    }
    return null;
  }

  if (_client) return _client;

  const config = getConfig();
  _client = new RedisClass({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    connectTimeout: 3_000,
    retryStrategy: (times) => {
      if (times > 3) {
        _unavailable = true;
        _client = null;
        log.warn('Redis unavailable after retries — cache disabled');
        return null; // stop retrying
      }
      return Math.min(times * 200, 1_000);
    },
    lazyConnect: true,
  });

  _client.on('error', (err) => {
    log.warn('Redis client error', { message: err.message });
  });

  try {
    await _client.connect();
  } catch {
    _unavailable = true;
    _client = null;
  }

  return _client;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a JSON-serialisable value. Returns `false` (silently) when Redis is unavailable.
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlSeconds=300]
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
  const client = await getClient();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch (err) {
    log.warn('cacheSet failed', { key, error: err.message });
    return false;
  }
}

/**
 * Retrieve a cached value. Returns `null` on miss or when Redis is unavailable.
 * @param {string} key
 */
export async function cacheGet(key) {
  const client = await getClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    log.warn('cacheGet failed', { key, error: err.message });
    return null;
  }
}

/**
 * Delete one or more keys. No-op when Redis is unavailable.
 * @param {...string} keys
 */
export async function cacheDel(...keys) {
  const client = await getClient();
  if (!client) return false;
  try {
    await client.del(...keys);
    return true;
  } catch (err) {
    log.warn('cacheDel failed', { keys, error: err.message });
    return false;
  }
}

/**
 * Cache-aside pattern: return cached value or call `loader`, cache, and return result.
 * Falls through to `loader` when Redis is unavailable.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {number} [ttlSeconds=300]
 * @returns {Promise<T>}
 */
export async function cacheWrap(key, loader, ttlSeconds = 300) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export default { cacheSet, cacheGet, cacheDel, cacheWrap };
