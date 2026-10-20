import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function openDatabase(dataDir = process.env.DATA_DIR || path.join(root, '.data')) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const filename = path.join(dataDir, 'ouvidoria.sqlite');
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY,
      protocol TEXT NOT NULL UNIQUE,
      access_key_hash TEXT NOT NULL,
      anonymous INTEGER NOT NULL CHECK(anonymous IN (0, 1)),
      name TEXT,
      email TEXT,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
      resolution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      CHECK(anonymous = 0 OR (name IS NULL AND email IS NULL))
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  return db;
}

export function complaintView(row, admin = false) {
  const result = {
    protocol: row.protocol,
    anonymous: Boolean(row.anonymous),
    category: row.category,
    subject: row.subject,
    description: row.description,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
  if (admin) Object.assign(result, { id: row.id, name: row.name, email: row.email });
  return result;
}
