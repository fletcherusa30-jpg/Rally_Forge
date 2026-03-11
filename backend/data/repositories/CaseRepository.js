/**
 * backend/data/repositories/CaseRepository.js
 *
 * Repository for CAVC precedential case data stored in the knowledge base
 * JSON index and markdown files.
 *
 * Wraps FileSystemDataSource and provides typed, cached operations.
 * Supersedes direct fs usage in services/caseLookupService.js.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FileSystemDataSource from '../access/FileSystemDataSource.js';
import { cacheGet, cacheSet } from '../access/RedisDataSource.js';
import { Errors } from '../../core/errors/AppError.js';
import { createLogger } from '../../core/logging/logger.js';

const log = createLogger('case-repository');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.resolve(__dirname, '../../../knowledge');
const CASES_INDEX = 'cases_index.json';
const CACHE_TTL = 600;

const fsDs = new FileSystemDataSource(KNOWLEDGE_DIR);

export class CaseRepository {
  // ── Index ────────────────────────────────────────────────────────────────────

  async getIndex() {
    const cached = await cacheGet('case:index');
    if (cached) return cached;

    const index = await fsDs.readJsonOrDefault(CASES_INDEX, []);
    await cacheSet('case:index', index, CACHE_TTL);
    log.debug('Case index loaded', { count: index.length });
    return index;
  }

  // ── Lookups ──────────────────────────────────────────────────────────────────

  async findById(caseId) {
    const index = await this.getIndex();
    const caseData = index.find((c) => c.caseId === caseId);
    if (!caseData) return null;
    return { ...caseData, url: `/${caseData.filePath}` };
  }

  async requireById(caseId) {
    const c = await this.findById(caseId);
    if (!c) throw Errors.notFound(`Case ${caseId}`);
    return c;
  }

  async findAll() {
    return this.getIndex();
  }

  async findByYear(year) {
    const index = await this.getIndex();
    return index.filter((c) => c.year === String(year) || c.year === Number(year));
  }

  async findByTopic(topic) {
    const index = await this.getIndex();
    const topicLower = topic.toLowerCase();
    return index.filter(
      (c) =>
        c.topic?.toLowerCase().includes(topicLower) ||
        c.tags?.some((t) => t.toLowerCase().includes(topicLower))
    );
  }

  async search(query) {
    const index = await this.getIndex();
    const q = query.toLowerCase();
    return index.filter(
      (c) =>
        c.caseId?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q) ||
        c.topic?.toLowerCase().includes(q)
    );
  }

  // ── Full content ─────────────────────────────────────────────────────────────

  async getCaseContent(caseId) {
    const caseData = await this.requireById(caseId);
    const cacheK = `case:content:${caseId}`;
    const cached = await cacheGet(cacheK);
    if (cached) return cached;

    const content = await fsDs.readText(caseData.filePath);
    await cacheSet(cacheK, content, CACHE_TTL);
    return content;
  }

  // ── Timeline ─────────────────────────────────────────────────────────────────

  async getTimeline() {
    const index = await this.getIndex();
    const byYear = {};
    for (const c of index) {
      const y = String(c.year ?? 'unknown');
      (byYear[y] ??= []).push(c);
    }
    return byYear;
  }
}

export default new CaseRepository();
