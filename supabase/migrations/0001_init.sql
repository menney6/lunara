-- Lunara — initial schema (PostgreSQL / Supabase).
-- Port of the original node:sqlite schema. Keep in sync with the SCHEMA
-- constant in src/lib/db.ts, which re-applies this on boot as a safety net.
--
-- Conventions preserved from the SQLite original:
--   * ids are INTEGER (SERIAL) so they stay JS numbers, like AUTOINCREMENT
--   * timestamps are TEXT in UTC 'YYYY-MM-DD HH:MM:SS', exactly what
--     SQLite's datetime('now') produced, so existing string comparisons
--     (e.g. sessions.expires_at > now) keep working unchanged
--   * JSON arrays are stored as TEXT, hydrated by src/lib/queries.ts
--   * booleans are INTEGER 0/1
--   * email is citext, matching SQLite's COLLATE NOCASE

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  email_confirmed_at TEXT DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
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
  id SERIAL PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS periods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  flow TEXT CHECK (flow IS NULL OR flow IN ('light','medium','heavy')),
  symptoms TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
  UNIQUE (user_id, start_date)
);
CREATE INDEX IF NOT EXISTS ix_periods_user ON periods(user_id, start_date);

CREATE TABLE IF NOT EXISTS daily_logs (
  id SERIAL PRIMARY KEY,
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
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS ix_logs_user_date ON daily_logs(user_id, date);

CREATE TABLE IF NOT EXISTS pregnancy (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  confirmed_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  id SERIAL PRIMARY KEY,
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
  published_at TEXT NOT NULL DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))
);
