/**
 * backend/data/access/FileSystemDataSource.js
 *
 * Centralized file-system data access with async I/O, error wrapping, and
 * JSON helpers. Replaces scattered fs.readFile/writeFile/JSON.parse calls
 * found across 15+ backend files.
 *
 * Usage:
 *   import FileSystemDataSource from '../data/access/FileSystemDataSource.js';
 *   const fs = new FileSystemDataSource(baseDir);
 *   const data = await fs.readJson('rates/2024.json');
 *   await fs.writeJson('output/result.json', data);
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createLogger } from '../../core/logging/logger.js';
import { Errors } from '../../core/errors/AppError.js';

const log = createLogger('fs-data-source');

export default class FileSystemDataSource {
  /**
   * @param {string} baseDir  Absolute base directory for all relative paths
   */
  constructor(baseDir = '') {
    this.baseDir = baseDir;
  }

  // ── Path helpers ────────────────────────────────────────────────────────────

  resolve(relativePath) {
    return this.baseDir ? path.join(this.baseDir, relativePath) : relativePath;
  }

  // ── Existence Checks ────────────────────────────────────────────────────────

  exists(relativePath) {
    return existsSync(this.resolve(relativePath));
  }

  async existsAsync(relativePath) {
    try {
      await access(this.resolve(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  // ── Text I/O ────────────────────────────────────────────────────────────────

  /**
   * Read a text file.
   * @param {string} relativePath
   * @param {string} [encoding='utf-8']
   * @returns {Promise<string>}
   */
  async readText(relativePath, encoding = 'utf-8') {
    const fullPath = this.resolve(relativePath);
    try {
      return await readFile(fullPath, encoding);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw Errors.notFound(`File: ${fullPath}`);
      }
      log.error('readText failed', { path: fullPath, error: err.message });
      throw Errors.internal(`Failed to read file: ${err.message}`);
    }
  }

  /**
   * Write a text file, creating parent directories as needed.
   * @param {string} relativePath
   * @param {string} content
   */
  async writeText(relativePath, content) {
    const fullPath = this.resolve(relativePath);
    try {
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf-8');
    } catch (err) {
      log.error('writeText failed', { path: fullPath, error: err.message });
      throw Errors.internal(`Failed to write file: ${err.message}`);
    }
  }

  // ── JSON I/O ────────────────────────────────────────────────────────────────

  /**
   * Read and parse a JSON file.
   * @param {string} relativePath
   * @returns {Promise<any>}
   */
  async readJson(relativePath) {
    const text = await this.readText(relativePath);
    try {
      return JSON.parse(text);
    } catch (err) {
      const fullPath = this.resolve(relativePath);
      log.error('JSON parse failed', { path: fullPath, error: err.message });
      throw Errors.internal(`Invalid JSON in file ${fullPath}: ${err.message}`);
    }
  }

  /**
   * Serialize and write a JSON file (pretty-printed).
   * @param {string} relativePath
   * @param {any} data
   * @param {number} [indent=2]
   */
  async writeJson(relativePath, data, indent = 2) {
    const json = JSON.stringify(data, null, indent);
    await this.writeText(relativePath, json);
  }

  /**
   * Read JSON or return a default value if file does not exist.
   * @param {string} relativePath
   * @param {any} defaultValue
   * @returns {Promise<any>}
   */
  async readJsonOrDefault(relativePath, defaultValue = null) {
    const exists = await this.existsAsync(relativePath);
    if (!exists) return defaultValue;
    return this.readJson(relativePath);
  }

  // ── Synchronous JSON (for legacy callers during migration) ──────────────────

  /**
   * Synchronous read + parse — prefer async methods where possible.
   * Retained to support existing synchronous code during incremental migration.
   * @param {string} relativePath
   * @returns {any}
   */
  readJsonSync(relativePath) {
    const fullPath = this.resolve(relativePath);
    try {
      const content = readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw Errors.notFound(`File: ${fullPath}`);
      }
      throw Errors.internal(`Failed to read file synchronously: ${err.message}`);
    }
  }
}
