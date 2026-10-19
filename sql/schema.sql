CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_users_username (username),
  UNIQUE KEY uq_app_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS voters_roll (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  province VARCHAR(80) NULL,
  municipality VARCHAR(160) NULL,
  ward_id VARCHAR(40) NULL,
  vd_number VARCHAR(40) NULL,
  vr_section TEXT NULL,
  seq_no VARCHAR(40) NULL,
  id_number VARCHAR(40) NULL,
  surname VARCHAR(160) NULL,
  full_name VARCHAR(191) NULL,
  voter_status TEXT NULL,
  street_number TEXT NULL,
  street_name TEXT NULL,
  street_type TEXT NULL,
  place_number TEXT NULL,
  place_name TEXT NULL,
  house_number TEXT NULL,
  farm_name TEXT NULL,
  farm_number TEXT NULL,
  location TEXT NULL,
  suburb TEXT NULL,
  town VARCHAR(160) NULL,
  res_postal_code TEXT NULL,
  source_file TEXT NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_voter_record (id_number, ward_id, vd_number, seq_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS import_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  file_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  rows_processed BIGINT NOT NULL DEFAULT 0,
  rows_inserted BIGINT NOT NULL DEFAULT 0,
  rows_rejected BIGINT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  error_message TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

CREATE INDEX IF NOT EXISTS idx_voters_id_number ON voters_roll (id_number);
CREATE INDEX IF NOT EXISTS idx_voters_surname ON voters_roll (surname);
CREATE INDEX IF NOT EXISTS idx_voters_full_name ON voters_roll (full_name);
CREATE INDEX IF NOT EXISTS idx_voters_ward_id ON voters_roll (ward_id);
CREATE INDEX IF NOT EXISTS idx_voters_municipality ON voters_roll (municipality);
CREATE INDEX IF NOT EXISTS idx_voters_town ON voters_roll (town);
CREATE INDEX IF NOT EXISTS idx_voters_province ON voters_roll (province);
CREATE INDEX IF NOT EXISTS idx_voters_vd_number ON voters_roll (vd_number);
