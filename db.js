const { Pool } = require('pg');
const { getConfigValue } = require('./config');

const connectionString = getConfigValue('DATABASE_URL');
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const sslEnabled = String(getConfigValue('PG_SSL', '')).toLowerCase() === 'true';

const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction
};
