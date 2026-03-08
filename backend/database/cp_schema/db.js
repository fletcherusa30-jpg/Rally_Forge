import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rally_forge',
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();

