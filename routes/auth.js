const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session.user) {
    res.redirect('/login');
    return;
  }
  next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    res.status(403).send('Forbidden');
    return;
  }
  next();
}

router.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/');
    return;
  }

  res.send(`
    <h1>LGE2026 Secure Portal</h1>
    <form method="post" action="/login">
      <label>Username or Email</label><br>
      <input name="identifier" required><br><br>
      <label>Password</label><br>
      <input type="password" name="password" required><br><br>
      <button type="submit">Sign In</button>
    </form>
  `);
});

router.post('/login', async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '').trim();

  if (!identifier || !password) {
    res.status(400).send('Identifier and password are required.');
    return;
  }

  const result = await query(
    'SELECT id, username, email, password_hash, role, is_active FROM app_users WHERE username = $1 OR email = $1 LIMIT 1',
    [identifier]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) {
    res.status(401).send('Invalid credentials.');
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).send('Invalid credentials.');
    return;
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  res.redirect('/');
});

router.post('/logout', ensureAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = {
  router,
  ensureAuth,
  ensureAdmin
};
