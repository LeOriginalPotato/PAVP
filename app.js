require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { query, pool } = require('./db');
const { router: authRouter } = require('./routes/auth');
const adminRouter = require('./routes/admin');
const votersRouter = require('./routes/voters');
const { importCsv } = require('./services/importCsv');

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedHosts = String(process.env.ALLOWED_HOSTS || 'lge2026.pa-atwork.org')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const hostHeader = String(req.headers.host || '').toLowerCase();
  const hostname = hostHeader.split(':')[0];
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production' && isLocalHost) {
    next();
    return;
  }

  if (allowedHosts.includes(hostname)) {
    next();
    return;
  }

  res.status(403).send('Forbidden host.');
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  }
}));

app.use(authRouter);
app.use(adminRouter);
app.use(votersRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'lge2026-voters-portal' });
});

async function applySchema() {
  const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
}

async function ensureInitialAdmin() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();

  if (!username || !email || !password) {
    return;
  }

  const existing = await query('SELECT id FROM app_users WHERE username = $1 OR email = $2 LIMIT 1', [username, email]);
  if (existing.rows.length > 0) {
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await query(
    'INSERT INTO app_users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [username, email, hash, 'admin']
  );

  console.log('Initial admin user created from environment variables.');
}

async function runImportCli() {
  const fileArg = process.argv[3] || process.env.CSV_FILE_PATH;
  if (!fileArg) {
    console.error('Provide CSV file path: node app.js import-csv <path-to-file.csv>');
    process.exit(1);
  }

  await applySchema();
  const result = await importCsv(fileArg);
  console.log('Import completed:', result);
  await pool.end();
}

async function startServer() {
  await applySchema();
  await ensureInitialAdmin();

  app.listen(port, () => {
    console.log(`LGE2026 voters portal listening on port ${port}`);
  });
}

(async () => {
  try {
    const mode = String(process.argv[2] || '').trim().toLowerCase();
    if (mode === 'import-csv') {
      await runImportCli();
      return;
    }

    await startServer();
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
})();
