const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ensureAuth, ensureAdmin } = require('./auth');

const router = express.Router();

router.get('/admin/users', ensureAuth, ensureAdmin, async (req, res) => {
  const users = await query('SELECT id, username, email, role, is_active, created_at FROM app_users ORDER BY id DESC');

  const rows = users.rows
    .map((u) => `<tr><td>${u.id}</td><td>${u.username}</td><td>${u.email}</td><td>${u.role}</td><td>${u.is_active ? 'Yes' : 'No'}</td></tr>`)
    .join('');

  res.send(`
    <h1>User Management</h1>
    <p>Create portal users. No public sign-up exists.</p>
    <form method="post" action="/admin/users">
      <label>Username</label><br><input name="username" required><br>
      <label>Email</label><br><input name="email" type="email" required><br>
      <label>Password</label><br><input name="password" type="password" required><br>
      <label>Role</label><br>
      <select name="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select><br><br>
      <button type="submit">Create User</button>
    </form>
    <hr>
    <table border="1" cellpadding="6">
      <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <form method="post" action="/logout" style="margin-top:16px;"><button type="submit">Log out</button></form>
  `);
});

router.post('/admin/users', ensureAuth, ensureAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  const role = String(req.body.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';

  if (!username || !email || !password) {
    res.status(400).send('Username, email, and password are required.');
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  await query(
    'INSERT INTO app_users (username, email, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = username',
    [username, email, hash, role]
  );

  res.redirect('/admin/users');
});

module.exports = router;
