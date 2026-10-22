import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support persistent volume path in production (e.g. Render Disk mounted at /var/data or /data)
const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'trustvault.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'owner', 'viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL UNIQUE,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      permission_level TEXT NOT NULL CHECK(permission_level IN ('read', 'edit')),
      granted_by INTEGER NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(document_id, user_id),
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(granted_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      document_id INTEGER,
      document_title TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'DENIED')),
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_doc_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_doc_deleted ON documents(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_perm_doc_user ON document_permissions(document_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_doc ON audit_logs(document_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
  `);

  // Seed default personas if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `);

    const salt = bcrypt.genSaltSync(10);
    insertUser.run('admin@trustvault.internal', bcrypt.hashSync('Admin123!', salt), 'Chief Compliance Admin', 'admin');
    insertUser.run('owner@trustvault.internal', bcrypt.hashSync('Owner123!', salt), 'Sarah Connor (Document Owner)', 'owner');
    insertUser.run('viewer@trustvault.internal', bcrypt.hashSync('Viewer123!', salt), 'David Miller (External Auditor / Viewer)', 'viewer');
    console.log('[TrustVault DB] Initialized database with demo users: admin, owner, viewer.');
  }
}
