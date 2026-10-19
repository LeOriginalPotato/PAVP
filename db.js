const mysql = require('mysql2/promise');
const { getConfigValue } = require('./config');

const MYSQL_URL_HINT = 'mysql://USER:PASSWORD@localhost:3306/DBNAME';

const connectionString = getConfigValue('DATABASE_URL');
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

function connectionOptionsFromDatabaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl).trim());
  } catch (error) {
    throw new Error(`DATABASE_URL must be a MariaDB/MySQL URL like ${MYSQL_URL_HINT}`);
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (scheme === 'postgres' || scheme === 'postgresql') {
    throw new Error(`DATABASE_URL uses PostgreSQL. Use a MariaDB/MySQL URL: ${MYSQL_URL_HINT}`);
  }
  if (scheme !== 'mysql' && scheme !== 'mariadb') {
    throw new Error(`DATABASE_URL must start with mysql:// (example: ${MYSQL_URL_HINT})`);
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!parsed.hostname || !database) {
    throw new Error(`DATABASE_URL must include a host and database name: ${MYSQL_URL_HINT}`);
  }

  const port = parsed.port ? Number(parsed.port) : 3306;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DATABASE_URL port must be a number. MariaDB on this host listens on 3306.');
  }

  let user = '';
  let password = '';
  try {
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch (error) {
    throw new Error('DATABASE_URL user or password is not valid URL encoding. Encode reserved characters, for example @ as %40.');
  }

  if (!user) {
    throw new Error(`DATABASE_URL must include a username: ${MYSQL_URL_HINT}`);
  }

  return {
    host: parsed.hostname,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: false
  };
}

const pool = mysql.createPool(connectionOptionsFromDatabaseUrl(connectionString));

function normalizeResult(result) {
  if (Array.isArray(result)) {
    return {
      rows: result,
      insertId: 0,
      affectedRows: result.length
    };
  }

  return {
    rows: [],
    insertId: Number(result && result.insertId ? result.insertId : 0),
    affectedRows: Number(result && result.affectedRows ? result.affectedRows : 0)
  };
}

async function query(text, params = []) {
  const [result] = await pool.query(text, params);
  return normalizeResult(result);
}

async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const client = {
      async query(text, params = []) {
        const [result] = await connection.query(text, params);
        return normalizeResult(result);
      }
    };
    const result = await handler(client);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // The original statement error is the one callers need.
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction
};
