const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConfigValue } = require('./config');

const LOCAL_MARIADB_SOCKETS = [
  '/var/lib/mysql/mysql.sock',
  '/var/run/mysqld/mysqld.sock',
  '/run/mysqld/mysqld.sock',
  '/tmp/mysql.sock'
];

const MYSQL_URL_HINT = 'mysql://USER:PASSWORD@localhost:3306/DBNAME';

const SOCKET_HINT = 'Set DATABASE_SOCKET to the host socket path (often /var/lib/mysql/mysql.sock), or contact hosting if that socket is not visible to the Node app.';

const connectionString = getConfigValue('DATABASE_URL');
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

let tcpFallback = null;

function readExplicitSocket() {
  const databaseSocket = String(getConfigValue('DATABASE_SOCKET', '')).trim();
  if (databaseSocket) {
    return { name: 'DATABASE_SOCKET', path: databaseSocket };
  }

  const mysqlSocket = String(getConfigValue('MYSQL_SOCKET', '')).trim();
  if (mysqlSocket) {
    return { name: 'MYSQL_SOCKET', path: mysqlSocket };
  }

  return null;
}

function assertExplicitSocket(explicitSocket) {
  const socketPath = explicitSocket.path;
  if (!path.isAbsolute(socketPath)) {
    throw new Error(`${explicitSocket.name} must be an absolute path to the MariaDB socket. TCP was not used.`);
  }

  let stat;
  try {
    stat = fs.statSync(socketPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`${explicitSocket.name}=${socketPath} is not visible to this app, so TCP was not used. ${SOCKET_HINT}`);
    }
    const reason = error && (error.code || error.message) ? (error.code || error.message) : 'unknown error';
    throw new Error(`${explicitSocket.name}=${socketPath} could not be opened (${reason}). TCP was not used. ${SOCKET_HINT}`);
  }

  if (!stat.isSocket()) {
    throw new Error(`${explicitSocket.name}=${socketPath} exists but is not a Unix socket. TCP was not used.`);
  }
}

function explainConnectionFailure(error) {
  if (!tcpFallback) {
    return error;
  }

  const nested = Array.isArray(error && error.errors) ? error.errors : [];
  const candidates = [error, ...nested].filter(Boolean);
  const connectError = candidates.find((item) => {
    const code = item.code;
    const message = String(item.message || '');
    return item.syscall === 'connect'
      || code === 'ECONNREFUSED'
      || code === 'ETIMEDOUT'
      || code === 'EHOSTUNREACH'
      || code === 'ENETUNREACH'
      || message.includes('ECONNREFUSED');
  });

  if (!connectError) {
    return error;
  }

  const originalMessage = String(connectError.message || error.message || error);
  const wrapped = new Error(
    `${originalMessage}. No MariaDB Unix socket was found in this app, and TCP ${tcpFallback.host}:${tcpFallback.port} failed. ${SOCKET_HINT}`
  );
  wrapped.code = connectError.code || error.code;
  if (connectError.errno || error.errno) {
    wrapped.errno = connectError.errno || error.errno;
  }
  wrapped.cause = error;
  return wrapped;
}

function connectionOptionsFromDatabaseUrl(rawUrl, explicitSocket) {
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

  const options = {
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: false
  };

  // An explicit socket skips TCP. cPanel grants the database user at localhost,
  // which is the Unix socket, and the Node container often cannot see the usual paths.
  if (explicitSocket) {
    assertExplicitSocket(explicitSocket);
    options.socketPath = explicitSocket.path;
    return options;
  }

  if (parsed.hostname === 'localhost') {
    const socketPath = LOCAL_MARIADB_SOCKETS.find((candidate) => fs.existsSync(candidate));
    if (socketPath) {
      options.socketPath = socketPath;
      return options;
    }
    tcpFallback = { host: '127.0.0.1', port };
    options.host = '127.0.0.1';
    options.port = port;
    return options;
  }

  options.host = parsed.hostname;
  options.port = port;
  return options;
}

const pool = mysql.createPool(connectionOptionsFromDatabaseUrl(connectionString, readExplicitSocket()));

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
  try {
    const [result] = await pool.query(text, params);
    return normalizeResult(result);
  } catch (error) {
    throw explainConnectionFailure(error);
  }
}

async function withTransaction(handler) {
  let connection;
  try {
    connection = await pool.getConnection();
  } catch (error) {
    throw explainConnectionFailure(error);
  }

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
