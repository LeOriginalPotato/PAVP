# LGE 2026 Voters Portal (Separate Repo)

Secure Node.js + MariaDB portal for South Africa LGE 2026 voters-roll access on `lge2026.pa-atwork.org`.

## Core Requirements Covered
- Separate project/repository from existing apps
- Node.js implementation for cPanel deployment
- MariaDB/MySQL storage
- Strict authentication (no public registration)
- Admin-managed user accounts only
- Search by any voter field (ID Number prioritized)
- Filterable statistics (ward/area counts)
- Large CSV import workflow for very big files

## 1) Setup
1. Copy `config.local.example.json` to `config.local.json`.
2. Fill settings in `config.local.json`:
   - `DATABASE_URL` (`mysql://USER:PASSWORD@localhost:3306/DBNAME`; percent-encode reserved characters in the password)
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `ALLOWED_HOSTS` (example: `lge2026.pa-atwork.org`)
3. Install dependencies:
   - `npm install`

## 2) Database Schema
Schema auto-applies at startup from `sql/schema.sql` and creates `app_users`, `voters_roll`, and `import_jobs` when they are missing.

## 3) Run App
- `npm start`
- Open `/login`
- First admin account is auto-created from `config.local.json` values if not already present.

## 4) Import 98GB CSV
Use CLI mode (SSH/cPanel terminal), not browser upload:

- `node app.js import-csv /absolute/path/to/LGE2026.csv`

or set `CSV_FILE_PATH` in `config.local.json` and run:

- `npm run import`

Import progress is tracked in `import_jobs` table.

## 5) Search + Statistics
- `/search` supports query against all major columns
- Exact ID match is ranked first
- `/stats` supports grouping and filter combinations:
  - group by ward, municipality, town, province, etc.
  - optional filter column + value
  - displays voter counts per selected category

## 6) cPanel deployment
The host database is MariaDB on `localhost:3306`. `DATABASE_URL` is enough; `config.local.json` is optional and is used only for keys that are not set in the environment.

1. Set `DATABASE_URL` to `mysql://USER:PASSWORD@localhost:3306/DBNAME`. Host `localhost` uses the local MariaDB socket when that socket exists, so a cPanel user granted at `localhost` can connect. Host `127.0.0.1` uses TCP instead.
2. Deploy this revision (it must include `config.js`, `db.js`, `sql/schema.sql`, and `package.json`) and run `npm install` in the application root.
3. Restart the Node.js app (`npm start` runs `node app.js`).
4. Startup applies `sql/schema.sql`. Confirm `app_users`, `voters_roll`, and `import_jobs` exist, then open `/health`.

## 7) Local Config File Example
Copy `config.local.example.json` to `config.local.json` and replace the placeholder values.

## 8) Manual Git Init (if terminal git is unavailable)
If `git` is unavailable in this automation terminal, run this locally/in cPanel shell:

- `git init`
- `git add .`
- `git commit -m "Initial commit for LGE2026 voters portal"`

