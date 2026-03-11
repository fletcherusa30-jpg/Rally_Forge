/**
 * backend/data/access/index.js
 *
 * Barrel export for the data access layer.
 * Consumers import from here, not from individual source files.
 *
 * Usage:
 *   import { FileSystemDataSource, MongoDataSource } from '../data/access/index.js';
 *   import { cacheWrap } from '../data/access/index.js';
 */

export { default as FileSystemDataSource } from './FileSystemDataSource.js';
export { default as MongoDataSource } from './MongoDataSource.js';
export { default as PostgresDataSource } from './PostgresDataSource.js';
export { cacheSet, cacheGet, cacheDel, cacheWrap } from './RedisDataSource.js';
