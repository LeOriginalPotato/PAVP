CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voters_roll (
  id BIGSERIAL PRIMARY KEY,
  province TEXT,
  municipality TEXT,
  ward_id TEXT,
  vd_number TEXT,
  vr_section TEXT,
  seq_no TEXT,
  id_number TEXT,
  surname TEXT,
  full_name TEXT,
  voter_status TEXT,
  street_number TEXT,
  street_name TEXT,
  street_type TEXT,
  place_number TEXT,
  place_name TEXT,
  house_number TEXT,
  farm_name TEXT,
  farm_number TEXT,
  location TEXT,
  suburb TEXT,
  town TEXT,
  res_postal_code TEXT,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_voter_record UNIQUE (id_number, ward_id, vd_number, seq_no)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id BIGSERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  rows_processed BIGINT NOT NULL DEFAULT 0,
  rows_inserted BIGINT NOT NULL DEFAULT 0,
  rows_rejected BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_voters_id_number ON voters_roll (id_number);
CREATE INDEX IF NOT EXISTS idx_voters_surname ON voters_roll (surname);
CREATE INDEX IF NOT EXISTS idx_voters_full_name ON voters_roll (full_name);
CREATE INDEX IF NOT EXISTS idx_voters_ward_id ON voters_roll (ward_id);
CREATE INDEX IF NOT EXISTS idx_voters_municipality ON voters_roll (municipality);
CREATE INDEX IF NOT EXISTS idx_voters_town ON voters_roll (town);
CREATE INDEX IF NOT EXISTS idx_voters_province ON voters_roll (province);
CREATE INDEX IF NOT EXISTS idx_voters_vd_number ON voters_roll (vd_number);
