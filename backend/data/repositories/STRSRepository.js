/**
 * backend/data/repositories/STRSRepository.js
 *
 * Repository for STRS scan result artifacts.
 * Persists results to the backend/data/scans/ directory as JSON files
 * and maintains an in-memory index for the current process lifetime.
 *
 * Scan results are keyed by a generated scanId (veteranId + timestamp).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FileSystemDataSource from '../access/FileSystemDataSource.js';
import { createLogger } from '../../core/logging/logger.js';
import { Errors } from '../../core/errors/AppError.js';

const log = createLogger('strs-repository');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCANS_DIR = path.resolve(__dirname, '../../data/scans');
const fsDs = new FileSystemDataSource(SCANS_DIR);

export class STRSRepository {
  constructor() {
    this._index = new Map(); // scanId → metadata
  }

  /**
   * Persist a completed scan result.
   * @param {string} veteranId
   * @param {object} result   Structured STRS scan output
   * @returns {object}        Saved scan metadata
   */
  async saveScan(veteranId, result) {
    const scanId = `${veteranId}_${Date.now()}`;
    const metadata = {
      scanId,
      veteranId,
      scannedAt: new Date().toISOString(),
      conditionCount: result.diagnoses?.length ?? 0,
      pageCount: result.pages ?? 0,
    };

    await fsDs.writeJson(`${scanId}.json`, { metadata, result });
    this._index.set(scanId, metadata);
    log.info('STRS scan saved', { scanId, veteranId });
    return metadata;
  }

  /**
   * Load a full scan result by scanId.
   */
  async getScan(scanId) {
    const data = await fsDs.readJsonOrDefault(`${scanId}.json`, null);
    if (!data) throw Errors.notFound(`Scan ${scanId}`);
    return data;
  }

  /**
   * List scan metadata for a veteran (most recent first).
   * Loads from disk on first call per process.
   */
  async listByVeteran(veteranId) {
    await this._ensureIndex();
    return [...this._index.values()]
      .filter((m) => m.veteranId === veteranId)
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  async deleteScan(scanId) {
    try {
      const filePath = path.join(SCANS_DIR, `${scanId}.json`);
      const { unlink } = await import('node:fs/promises');
      await unlink(filePath);
    } catch {
      // Already gone
    }
    this._index.delete(scanId);
    log.info('Scan deleted', { scanId });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  async _ensureIndex() {
    if (this._index.size > 0) return;
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(SCANS_DIR).catch(() => []);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const data = await fsDs.readJsonOrDefault(file, null);
        if (data?.metadata?.scanId) {
          this._index.set(data.metadata.scanId, data.metadata);
        }
      }
    } catch (err) {
      log.warn('Failed to build scan index', { error: err.message });
    }
  }
}

export default new STRSRepository();
