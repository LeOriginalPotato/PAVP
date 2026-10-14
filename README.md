# LGE 2026 Voters Portal (Separate Repo)

Secure Node.js + PostgreSQL portal for South Africa LGE 2026 voters-roll access on `lge2026.pa-atwork.org`.

## Core Requirements Covered
- Separate project/repository from existing apps
- Node.js implementation for cPanel deployment
- PostgreSQL storage
- Strict authentication (no public registration)
- Admin-managed user accounts only
- Search by any voter field (ID Number prioritized)
- Filterable statistics (ward/area counts)
- Large CSV import workflow for very big files

## 1) Setup
1. Copy `.env.example` to `.env`
2. Fill all variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
3. Install dependencies:
   - `npm install`

## 2) Database Schema
Schema auto-applies at startup from `sql/schema.sql`.

You can also run manually in PostgreSQL if needed.

## 3) Run App
- `npm start`
- Open `/login`
- First admin account is auto-created from env values if not already present.

## 4) Import 98GB CSV
Use CLI mode (SSH/cPanel terminal), not browser upload:

- `node app.js import-csv /absolute/path/to/LGE2026.csv`

or set env var `CSV_FILE_PATH` and run:

- `npm run import`

Import progress is tracked in `import_jobs` table.

## 5) Search + Statistics
- `/search` supports query against all major columns
- Exact ID match is ranked first
- `/stats` supports grouping and filter combinations:
  - group by ward, municipality, town, province, etc.
  - optional filter column + value
  - displays voter counts per selected category

## 6) cPanel Deployment Notes
- Create Node.js app in cPanel
- Set application root to this project directory
- Startup file: `app.js`
- Configure environment variables in cPanel UI
- Ensure PostgreSQL remote access/network permissions are enabled
- Install dependencies from cPanel terminal: `npm install`

## 7) Manual Git Init (if terminal git is unavailable)
If `git` is unavailable in this automation terminal, run this locally/in cPanel shell:

- `git init`
- `git add .`
- `git commit -m "Initial commit for LGE2026 voters portal"`

