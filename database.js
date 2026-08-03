'use strict';

const Database = require('better-sqlite3');
const path = require('path');

// ─── INISIALISASI DATABASE ────────────────────────────────────────────────────
// DB_PATH bisa diset via env variable untuk deployment (Railway, Render, Fly.io)
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, 'Pengvisualisasi Datamu.sqlite');
const db = new Database(DB_PATH);

// Aktifkan WAL mode agar performa lebih baik
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SKEMA DATABASE ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT UNIQUE NOT NULL,
    email          TEXT UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS data_files (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    file_name      TEXT NOT NULL,
    original_name  TEXT NOT NULL,
    column_names   TEXT NOT NULL,
    inv_config     TEXT DEFAULT '{}',
    row_count      INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS data_rows (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id        INTEGER NOT NULL,
    row_index      INTEGER NOT NULL,
    row_data       TEXT NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES data_files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    file_id        INTEGER,
    file_name      TEXT NOT NULL,
    action_type    TEXT NOT NULL,
    description    TEXT NOT NULL,
    rows_affected  INTEGER DEFAULT 0,
    rows_skipped   INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (file_id)  REFERENCES data_files(id)  ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_data_rows_file_id    ON data_rows(file_id);
  CREATE INDEX IF NOT EXISTS idx_data_files_user_id   ON data_files(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_log_file_id ON activity_log(file_id);
`);

console.log(`[DB] Database terhubung: ${DB_PATH}`);

module.exports = db;
