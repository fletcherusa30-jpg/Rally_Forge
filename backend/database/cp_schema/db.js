const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rally_forge',
});

exports.query = (text, params) => pool.query(text, params);
exports.getClient = () => pool.connect();
