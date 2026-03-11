/**
 * backend/data/repositories/VeteranRepository.js
 *
 * Repository for veteran profile documents stored in MongoDB.
 * Wraps MongoDataSource and provides named, typed operations.
 *
 * Supersedes direct usage of database/models/veteran.js and
 * database/models/onboarding.js in service files.
 */

import MongoDataSource from '../access/MongoDataSource.js';
import { cacheGet, cacheSet, cacheDel } from '../access/RedisDataSource.js';
import { Errors } from '../../core/errors/AppError.js';
import { createLogger } from '../../core/logging/logger.js';

const log = createLogger('veteran-repository');

const CACHE_TTL = 300; // seconds
const cacheKey = (id) => `veteran:${id}`;

const veteransDs = new MongoDataSource('veterans');
const onboardingDs = new MongoDataSource('onboarding_results');

export class VeteranRepository {
  // ── Veteran CRUD ─────────────────────────────────────────────────────────────

  async create(profileData) {
    const veteran = await veteransDs.insertOne(profileData);
    log.info('Veteran created', { id: veteran.id });
    return veteran;
  }

  async findById(id) {
    const cached = await cacheGet(cacheKey(id));
    if (cached) return cached;

    const veteran = await veteransDs.findById(id);
    if (veteran) await cacheSet(cacheKey(id), veteran, CACHE_TTL);
    return veteran;
  }

  async findByVAFileNumber(vaFileNumber) {
    return veteransDs.findOne({ vaFileNumber });
  }

  async findAll(filter = {}) {
    return veteransDs.find(filter);
  }

  async update(id, updates) {
    const veteran = await veteransDs.updateById(id, updates);
    await cacheDel(cacheKey(id));
    return veteran;
  }

  async delete(id) {
    const ok = await veteransDs.deleteById(id);
    await cacheDel(cacheKey(id));
    return ok;
  }

  // ── Onboarding ───────────────────────────────────────────────────────────────

  async saveOnboarding(veteranId, onboardingResult) {
    const record = await onboardingDs.insertOne({ veteranId, onboardingResult });
    log.info('Onboarding saved', { veteranId });
    return record;
  }

  async getLatestOnboarding(veteranId) {
    const docs = await onboardingDs.find({ veteranId }, {
      sort: { createdAt: -1 },
      limit: 1,
    });
    return docs[0] ?? null;
  }

  async requireById(id) {
    const veteran = await this.findById(id);
    if (!veteran) throw Errors.notFound(`Veteran ${id}`);
    return veteran;
  }
}

export default new VeteranRepository();
