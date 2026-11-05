import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ARTICLES } from "./content.ts";

/* Where the SQLite file lives. Defaults to ./data next to the app, but hosts
   with a mounted persistent disk (Render, Railway, a VPS) set LUNARA_DATA_DIR
   to the mount point so records survive redeploys. */
const DATA_DIR = process.env.LUNARA_DATA_DIR
  ? path.resolve(process.env.LUNARA_DATA_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = process.env.LUNARA_DB_FILE
  ? path.resolve(process.env.LUNARA_DB_FILE)
  : path.join(DATA_DIR, "lunara.db");

/* -------------------------------------------------------------------------
   Lunara schema
   Every health record is keyed to `user_id` and every read path in
   src/lib/queries.ts filters by the authenticated user, so one account can
   never observe another account's cycle or symptom data.
   ------------------------------------------------------------------------- */
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  dob TEXT,
  last_period TEXT,
  cycle_length INTEGER NOT NULL DEFAULT 28,
  period_length INTEGER NOT NULL DEFAULT 5,
  regularity TEXT NOT NULL DEFAULT 'unknown'
    CHECK (regularity IN ('regular','somewhat','irregular','unknown')),
  pregnancy_status TEXT NOT NULL DEFAULT 'none'
    CHECK (pregnancy_status IN ('none','trying','pregnant','postpartum','not_sure')),
  goal TEXT CHECK (goal IS NULL OR goal IN (
    'track_cycle','get_pregnant','avoid_pregnant','symptoms',
    'understand_body','manage_condition','pregnancy_tracking')),
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'lavender',
  privacy_lock INTEGER NOT NULL DEFAULT 1,
  share_analytics INTEGER NOT NULL DEFAULT 0,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  flow TEXT CHECK (flow IS NULL OR flow IN ('light','medium','heavy')),
  symptoms TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, start_date)
);
CREATE INDEX IF NOT EXISTS ix_periods_user ON periods(user_id, start_date);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  physical TEXT NOT NULL DEFAULT '[]',
  emotional TEXT NOT NULL DEFAULT '[]',
  discharge TEXT,
  sleep_quality INTEGER CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
  sexual_activity TEXT,
  exercise TEXT,
  water INTEGER,
  mood_score INTEGER CHECK (mood_score IS NULL OR mood_score BETWEEN 1 AND 5),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS ix_logs_user_date ON daily_logs(user_id, date);

CREATE TABLE IF NOT EXISTS pregnancy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  confirmed_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'period_upcoming','fertile_window','ovulation','daily_checkin',
    'pregnancy_update','weekly_insight')),
  enabled INTEGER NOT NULL DEFAULT 1,
  hour INTEGER NOT NULL DEFAULT 9 CHECK (hour BETWEEN 0 AND 23),
  UNIQUE (user_id, kind)
);

CREATE TABLE IF NOT EXISTS articles (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL DEFAULT 4,
  tags TEXT NOT NULL DEFAULT '[]',
  art TEXT NOT NULL DEFAULT 'lavender',
  body TEXT NOT NULL DEFAULT '[]',
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

type Row = Record<string, unknown>;

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(SCHEMA);
  seedArticles(_db);
  if (typeof globalThis !== "undefined") {
    (globalThis as Record<string, unknown>).__lunaraDb = _db;
  }
  return _db;
}

/** Educational content lives in the database so the Learn hub is a real table. */
function seedArticles(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  if (Number(row.n) > 0) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO articles
       (slug, title, summary, category, reading_minutes, tags, art, body)
     VALUES (?,?,?,?,?,?,?,?)`,
  );
  for (const a of ARTICLES) {
    insert.run(
      a.slug,
      a.title,
      a.summary,
      a.category,
      a.reading_minutes,
      JSON.stringify(a.tags),
      a.art,
      JSON.stringify(a.body),
    );
  }
}

/**
 * node:sqlite returns rows with a null prototype. React's RSC serializer
 * rejects those when they cross into a Client Component, so every row is
 * copied into a plain object here rather than at each call site.
 */
function plainify<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function query<T = Row>(sql: string, ...params: unknown[]): T[] {
  const stmt: StatementSync = getDb().prepare(sql);
  const rows = stmt.all(...(params as never[])) as unknown[];
  return rows.map(plainify<T>);
}

export function one<T = Row>(sql: string, ...params: unknown[]): T | null {
  const stmt: StatementSync = getDb().prepare(sql);
  const row = stmt.get(...(params as never[]));
  return row === undefined || row === null ? null : plainify<T>(row);
}

export function run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
  const stmt: StatementSync = getDb().prepare(sql);
  const res = stmt.run(...(params as never[]));
  return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
}

/** Wrap a raw sqlite row (null prototype) into a plain object. */
export function plain<T>(row: T | null): T | null {
  return row ? ({ ...row } as T) : null;
}

/** True when any account exists — used to decide whether to seed a demo user. */
export function hasUsers(): boolean {
  const row = one<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  return Number(row?.n ?? 0) > 0;
}
