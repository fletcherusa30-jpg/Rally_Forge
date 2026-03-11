/**
 * backend/data/repositories/BenefitsRepository.js
 *
 * Repository for computed benefits results stored in MongoDB.
 * Wraps MongoDataSource and provides named, cached operations.
 *
 * Supersedes direct usage of database/models/benefitsCache.js in services.
 */

import MongoDataSource from '../access/MongoDataSource.js';
import { cacheGet, cacheSet, cacheDel } from '../access/RedisDataSource.js';
import { createLogger } from '../../core/logging/logger.js';

const log = createLogger('benefits-repository');

const CACHE_TTL = 600;
const cacheKey = (veteranId) => `benefits:${veteranId}`;

const benefitsDs = new MongoDataSource('benefits_cache');

export class BenefitsRepository {
  async saveResult(veteranId, benefitsResult) {
    const record = await benefitsDs.insertOne({ veteranId, benefitsResult });
    await cacheDel(cacheKey(veteranId));
    log.info('Benefits result saved', { veteranId });
    return record;
  }

  async getLatestResult(veteranId) {
    const cached = await cacheGet(cacheKey(veteranId));
    if (cached) return cached;

    const docs = await benefitsDs.find({ veteranId }, {
      sort: { createdAt: -1 },
      limit: 1,
    });
    const doc = docs[0] ?? null;
    if (doc) await cacheSet(cacheKey(veteranId), doc, CACHE_TTL);
    return doc;
  }

  async invalidate(veteranId) {
    await benefitsDs.collection.deleteMany({ veteranId });
    await cacheDel(cacheKey(veteranId));
    log.info('Benefits cache invalidated', { veteranId });
  }

  async listByVeteran(veteranId) {
    return benefitsDs.find({ veteranId });
  }
}

export default new BenefitsRepository();
