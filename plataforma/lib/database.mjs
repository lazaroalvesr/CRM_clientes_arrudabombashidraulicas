import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function database(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'arruda.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);`);
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=1').get()) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','seller')), active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE TABLE attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE companies (id TEXT PRIMARY KEY, identity TEXT NOT NULL UNIQUE, cnpj TEXT UNIQUE, name TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, segment TEXT NOT NULL, size TEXT NOT NULL, phone TEXT NOT NULL, whatsapp TEXT NOT NULL, website TEXT NOT NULL, source_url TEXT NOT NULL, structure TEXT NOT NULL, pumping INTEGER, fleet INTEGER, branches INTEGER, verified_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id));
      CREATE INDEX idx_companies_region_segment ON companies(state,segment,city);
      CREATE TABLE leads (company_id TEXT PRIMARY KEY REFERENCES companies(id), saved_by TEXT NOT NULL REFERENCES users(id), saved_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Novo', notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit (id INTEGER PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL);
      INSERT INTO migrations VALUES(1);
      COMMIT;`);
  }
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=2').get()) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE leads ADD COLUMN equipment_interest TEXT NOT NULL DEFAULT '';
      ALTER TABLE leads ADD COLUMN contact_result TEXT NOT NULL DEFAULT '';
      ALTER TABLE leads ADD COLUMN last_contact_at TEXT;
      ALTER TABLE leads ADD COLUMN next_contact_at TEXT;
      CREATE TABLE lead_activities (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL REFERENCES companies(id), user_id TEXT NOT NULL REFERENCES users(id), equipment_interest TEXT NOT NULL DEFAULT '', contact_result TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE INDEX idx_lead_activities_company ON lead_activities(company_id, created_at DESC);
      INSERT INTO migrations VALUES(2);
      COMMIT;`);
  }
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=3').get()) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE whatsapp_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL REFERENCES companies(id), message_id TEXT UNIQUE, direction TEXT NOT NULL CHECK(direction IN ('in','out')), body TEXT NOT NULL, user_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
      CREATE INDEX idx_whatsapp_messages_company ON whatsapp_messages(company_id, created_at DESC);
      INSERT INTO migrations VALUES(3);
      COMMIT;`);
  }
  return db;
}
