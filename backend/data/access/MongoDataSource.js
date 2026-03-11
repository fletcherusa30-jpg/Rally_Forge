/**
 * backend/data/access/MongoDataSource.js
 *
 * Thin wrapper over the existing database/mongo.js connection.
 * Provides a consistent interface for MongoDB operations used across services.
 *
 * This does NOT replace database/mongo.js — it wraps it so repositories
 * can use a consistent API without importing mongo internals directly.
 */

import { getDb, connectToMongo } from '../../database/mongo.js';
import { ObjectId } from 'mongodb';
import { createLogger } from '../../core/logging/logger.js';
import { Errors } from '../../core/errors/AppError.js';

const log = createLogger('mongo-data-source');

export default class MongoDataSource {
  /**
   * @param {string} collectionName  MongoDB collection name
   */
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  // ── Connection ───────────────────────────────────────────────────────────────

  get collection() {
    return getDb().collection(this.collectionName);
  }

  static async connect(options = {}) {
    return connectToMongo(
      process.env.MONGO_URL,
      process.env.MONGO_DB,
      options
    );
  }

  // ── ID helpers ───────────────────────────────────────────────────────────────

  static toObjectId(id) {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    try {
      return new ObjectId(String(id));
    } catch {
      throw Errors.badRequest(`Invalid ID format: ${id}`);
    }
  }

  normalizeId(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id?.toString(), ...rest };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async findById(id) {
    try {
      const _id = MongoDataSource.toObjectId(id);
      const doc = await this.collection.findOne({ _id });
      return this.normalizeId(doc);
    } catch (err) {
      if (err.code === 'bad_request') throw err;
      log.error('findById failed', { collection: this.collectionName, id, error: err.message });
      throw Errors.internal(`Database error in findById: ${err.message}`);
    }
  }

  async findOne(filter = {}) {
    try {
      const doc = await this.collection.findOne(filter);
      return this.normalizeId(doc);
    } catch (err) {
      log.error('findOne failed', { collection: this.collectionName, error: err.message });
      throw Errors.internal(`Database error in findOne: ${err.message}`);
    }
  }

  async find(filter = {}, options = {}) {
    try {
      const cursor = this.collection.find(filter, options);
      const docs = await cursor.toArray();
      return docs.map(d => this.normalizeId(d));
    } catch (err) {
      log.error('find failed', { collection: this.collectionName, error: err.message });
      throw Errors.internal(`Database error in find: ${err.message}`);
    }
  }

  async insertOne(data) {
    try {
      const now = new Date();
      const doc = {
        _id: new ObjectId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      await this.collection.insertOne(doc);
      return this.normalizeId(doc);
    } catch (err) {
      log.error('insertOne failed', { collection: this.collectionName, error: err.message });
      throw Errors.internal(`Database error in insertOne: ${err.message}`);
    }
  }

  async updateById(id, updates) {
    try {
      const _id = MongoDataSource.toObjectId(id);
      const result = await this.collection.findOneAndUpdate(
        { _id },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!result) throw Errors.notFound(`Document ${id} in ${this.collectionName}`);
      return this.normalizeId(result);
    } catch (err) {
      if (err.code === 'not_found') throw err;
      log.error('updateById failed', { collection: this.collectionName, id, error: err.message });
      throw Errors.internal(`Database error in updateById: ${err.message}`);
    }
  }

  async deleteById(id) {
    try {
      const _id = MongoDataSource.toObjectId(id);
      const result = await this.collection.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (err) {
      log.error('deleteById failed', { collection: this.collectionName, id, error: err.message });
      throw Errors.internal(`Database error in deleteById: ${err.message}`);
    }
  }

  async count(filter = {}) {
    try {
      return await this.collection.countDocuments(filter);
    } catch (err) {
      log.error('count failed', { collection: this.collectionName, error: err.message });
      throw Errors.internal(`Database error in count: ${err.message}`);
    }
  }
}
