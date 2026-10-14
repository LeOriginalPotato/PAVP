const express = require('express');
const { query } = require('../db');
const { ensureAuth } = require('./auth');

const router = express.Router();

const searchableColumns = [
  'id_number',
  'surname',
  'full_name',
  'province',
  'municipality',
  'ward_id',
  'vd_number',
  'vr_section',
  'voter_status',
  'street_number',
  'street_name',
  'street_type',
  'place_number',
  'place_name',
  'house_number',
  'farm_name',
  'farm_number',
  'location',
  'suburb',
  'town',
  'res_postal_code'
];

router.get('/', ensureAuth, (req, res) => {
  res.send(`
    <h1>LGE 2026 Voters Roll Portal</h1>
    <p>Subdomain: lge2026.pa-atwork.org</p>
    <p>Primary lookup is ID Number, but all fields are searchable.</p>
    <ul>
      <li><a href="/search">Search Voters</a></li>
      <li><a href="/stats">Statistics Filters</a></li>
      <li><a href="/admin/users">User Management (Admin)</a></li>
    </ul>
    <form method="post" action="/logout"><button type="submit">Log out</button></form>
  `);
});

router.get('/search', ensureAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

  let results = [];
  if (q) {
    const whereClauses = searchableColumns.map((col) => `${col} ILIKE $1`);
    const sql = `
      SELECT province, municipality, ward_id, vd_number, vr_section, seq_no, id_number, surname, full_name, voter_status,
             street_number, street_name, street_type, place_number, place_name, house_number, farm_name, farm_number,
             location, suburb, town, res_postal_code
      FROM voters_roll
      WHERE (${whereClauses.join(' OR ')})
      ORDER BY CASE WHEN id_number = $2 THEN 0 ELSE 1 END, surname, full_name
      LIMIT ${limit};
    `;
    const dbResult = await query(sql, [`%${q}%`, q]);
    results = dbResult.rows;
  }

  const tableRows = results
    .map((r) => `
      <tr>
        <td>${r.id_number || ''}</td>
        <td>${r.surname || ''}</td>
        <td>${r.full_name || ''}</td>
        <td>${r.ward_id || ''}</td>
        <td>${r.municipality || ''}</td>
        <td>${r.town || ''}</td>
      </tr>
    `)
    .join('');

  res.send(`
    <h1>Search Voters</h1>
    <form method="get" action="/search">
      <input name="q" value="${q.replace(/"/g, '&quot;')}" placeholder="ID number, name, ward, municipality, town..." style="min-width:360px;" required>
      <button type="submit">Search</button>
    </form>
    <p>Matches: ${results.length}</p>
    <table border="1" cellpadding="6">
      <thead><tr><th>ID Number</th><th>Surname</th><th>Full Name</th><th>Ward</th><th>Municipality</th><th>Town</th></tr></thead>
      <tbody>${tableRows || '<tr><td colspan="6">No results.</td></tr>'}</tbody>
    </table>
    <p><a href="/">Back</a></p>
  `);
});

router.get('/stats', ensureAuth, async (req, res) => {
  const groupBy = String(req.query.groupBy || 'ward_id').trim();
  const filterColumn = String(req.query.filterColumn || '').trim();
  const filterValue = String(req.query.filterValue || '').trim();

  const allowedGroupings = ['ward_id', 'municipality', 'town', 'province', 'vd_number', 'suburb'];
  const allowedFilters = ['', 'ward_id', 'municipality', 'town', 'province', 'vd_number', 'suburb'];

  const safeGroupBy = allowedGroupings.includes(groupBy) ? groupBy : 'ward_id';
  const safeFilterColumn = allowedFilters.includes(filterColumn) ? filterColumn : '';

  const whereClause = safeFilterColumn && filterValue ? `WHERE ${safeFilterColumn} = $1` : '';
  const params = safeFilterColumn && filterValue ? [filterValue] : [];

  const sql = `
    SELECT COALESCE(NULLIF(${safeGroupBy}, ''), '(blank)') AS bucket, COUNT(*)::bigint AS total
    FROM voters_roll
    ${whereClause}
    GROUP BY bucket
    ORDER BY total DESC, bucket ASC
    LIMIT 500;
  `;

  const result = await query(sql, params);
  const rows = result.rows
    .map((r) => `<tr><td>${r.bucket}</td><td>${r.total}</td></tr>`)
    .join('');

  res.send(`
    <h1>Voters Statistics</h1>
    <p>Filter and count voters by area categories (ward, municipality, town, etc.).</p>

    <form method="get" action="/stats" style="margin-bottom:12px;">
      <label>Group by:</label>
      <select name="groupBy">
        ${allowedGroupings.map((g) => `<option value="${g}" ${safeGroupBy === g ? 'selected' : ''}>${g}</option>`).join('')}
      </select>

      <label>Filter column:</label>
      <select name="filterColumn">
        ${allowedFilters.map((f) => `<option value="${f}" ${safeFilterColumn === f ? 'selected' : ''}>${f || '(none)'}</option>`).join('')}
      </select>

      <label>Filter value:</label>
      <input name="filterValue" value="${filterValue.replace(/"/g, '&quot;')}" placeholder="e.g. 29200001">
      <button type="submit">Apply</button>
    </form>

    <table border="1" cellpadding="6">
      <thead><tr><th>${safeGroupBy}</th><th>Total Voters</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2">No data.</td></tr>'}</tbody>
    </table>

    <p><a href="/">Back</a></p>
  `);
});

module.exports = router;
