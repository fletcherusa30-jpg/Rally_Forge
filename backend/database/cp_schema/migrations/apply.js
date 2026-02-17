const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rally_forge';

const migrations = [
  { version: '001', file: '01_cp_relational_schema.sql' }
];

async function applyMigrations() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const { version, file } of migrations) {
      const result = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (result.rows.length > 0) {
        console.log(`✓ Migration ${version} already applied.`);
        continue;
      }

      const sqlPath = path.join(__dirname, '..', file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`→ Applying migration ${version}: ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      console.log(`✓ Migration ${version} applied successfully.`);
    }

    console.log('\n✓ All migrations applied.');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  applyMigrations().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { applyMigrations };
