/**
 * backend/data/access/PostgresDataSource.js
 *
 * Thin wrapper over the existing cp_schema/db.js pg Pool.
 * Provides a typed query interface for the CP (Compensation & Pension) schema.
 *
 * This does NOT replace database/cp_schema/db.js — it wraps it so repositories
 * can use a consistent API, including automatic client release and error mapping.
 */

import { createLogger } from '../../core/logging/logger.js';
import { Errors } from '../../core/errors/AppError.js';

const log = createLogger('postgres-data-source');

let _pool = null;
let _Pool = null;

async function getPool() {
  if (!_pool) {
    if (!_Pool) {
      try {
        ({ Pool: _Pool } = await import('pg'));
      } catch (err) {
        log.error('Postgres driver is unavailable', { error: err.message });
        throw Errors.internal('Postgres driver is not installed. Add the pg package to enable PostgreSQL access.');
      }
    }

    const connectionString = process.env.DATABASE_URL
      || (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE
        ? `postgresql://${process.env.PGUSER}${process.env.PGPASSWORD ? `:${process.env.PGPASSWORD}` : ''}@${process.env.PGHOST}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE}`
        : null);

    if (!connectionString) {
      throw Errors.internal('Postgres configuration missing. Set DATABASE_URL or PGHOST/PGUSER/PGDATABASE (and optional PGPASSWORD/PGPORT).');
    }

    _pool = new _Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    _pool.on('error', (err) => {
      log.error('Idle postgres client error', { error: err.message });
    });
  }
  return _pool;
}

export default class PostgresDataSource {
  /**
   * @param {string} tableName  Postgres table name
   */
  constructor(tableName) {
    this.tableName = tableName;
  }

  // ── Raw query ────────────────────────────────────────────────────────────────

  static async query(sql, params = []) {
    try {
      const pool = await getPool();
      const result = await pool.query(sql, params);
      return result;
    } catch (err) {
      log.error('Query failed', { sql: sql.slice(0, 120), error: err.message });
      throw Errors.internal(`Database query error: ${err.message}`);
    }
  }

  /** Run multiple statements inside a single transaction. */
  static async transaction(callback) {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      log.error('Transaction rolled back', { error: err.message });
      if (err.statusCode) throw err;
      throw Errors.internal(`Transaction error: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async findById(id) {
    const { rows } = await PostgresDataSource.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async findOne(where = {}) {
    const { clauses, values } = buildWhere(where);
    const { rows } = await PostgresDataSource.query(
      `SELECT * FROM ${this.tableName}${clauses} LIMIT 1`,
      values
    );
    return rows[0] ?? null;
  }

  async find(where = {}, { orderBy = 'id', limit, offset } = {}) {
    const { clauses, values } = buildWhere(where);
    let sql = `SELECT * FROM ${this.tableName}${clauses} ORDER BY ${orderBy}`;
    if (limit != null) sql += ` LIMIT ${Number(limit)}`;
    if (offset != null) sql += ` OFFSET ${Number(offset)}`;
    const { rows } = await PostgresDataSource.query(sql, values);
    return rows;
  }

  async insertOne(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await PostgresDataSource.query(
      `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return rows[0];
  }

  async updateById(id, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await PostgresDataSource.query(
      `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );
    if (!rows[0]) throw Errors.notFound(`Row ${id} in ${this.tableName}`);
    return rows[0];
  }

  async deleteById(id) {
    const { rowCount } = await PostgresDataSource.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
  }

  async count(where = {}) {
    const { clauses, values } = buildWhere(where);
    const { rows } = await PostgresDataSource.query(
      `SELECT COUNT(*) AS n FROM ${this.tableName}${clauses}`,
      values
    );
    return Number(rows[0]?.n ?? 0);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWhere(where) {
  const entries = Object.entries(where);
  if (entries.length === 0) return { clauses: '', values: [] };
  const values = [];
  const parts = entries.map(([key, val]) => {
    values.push(val);
    return `${key} = $${values.length}`;
  });
  return { clauses: ` WHERE ${parts.join(' AND ')}`, values };
}
