import postgres from "postgres";
import { ARTICLES } from "./content.ts";

/* -------------------------------------------------------------------------
   Lunara data layer — Supabase (PostgreSQL).

   This replaces the original node:sqlite driver. Supabase lives on the
   network, so every helper here is async; the SQL text stays the same shape
   as before (`?` placeholders are rewritten to Postgres `$n` on the way out).

   Connection: SUPABASE_DB_URL must hold the project's *Session pooler*
   connection string (port 5432). The session pooler — unlike the transaction
   pooler on 6543 — supports the prepared statements and multi-query
   transactions a long-lived Next.js server expects.

   Schema: SCHEMA below mirrors supabase/migrations/0001_init.sql and is
   re-applied (idempotently, all IF NOT EXISTS) on first use of each process,
   so a fresh deploy creates its own tables without a separate migration
   step. Keep the two files in sync.
   ------------------------------------------------------------------------- */

const SCHEMA = `
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

CREATE TABLE IF NOT EXISTS email_confirmations (
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
`;

/**
 * SQL expression matching SQLite's `datetime('now')` — UTC, second precision,
 * formatted exactly as the TEXT columns store timestamps. Use it anywhere the
 * old code wrote `datetime('now')` inline.
 */
export const SQL_NOW =
  "to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')";

type Row = Record<string, unknown>;

let _sql: postgres.Sql | null = null;
let _init: Promise<void> | null = null;

function getClient(): postgres.Sql {
  if (_sql) return _sql;
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "SUPABASE_DB_URL is not set. Add the Supabase Session pooler connection string " +
        "(Dashboard → Connect → Connection string → Session pooler) to .env.local " +
        "locally and to the Render environment in production.",
    );
  }
  _sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    // The pooler's certificate isn't issued for this hostname in Node's CA
    // store — this is equivalent to Postgres `sslmode=require` (encrypted,
    // unverified), which is what Supabase documents for pooler connections.
    ssl: { rejectUnauthorized: false },
    // Schema init runs IF NOT EXISTS on every boot; don't spam the logs with
    // the resulting "relation already exists, skipping" notices.
    onnotice: () => {},
  });
  return _sql;
}

/** Runs the idempotent schema + article seed once per process. */
function ensureInit(): Promise<void> {
  if (!_init) {
    _init = (async () => {
      const sql = getClient();
      // The schema contains no semicolons inside literals, so a naive split
      // is safe and keeps us independent of multi-statement protocol support.
      for (const part of SCHEMA.split(";")) {
        const stmt = part.trim();
        if (stmt) await sql.unsafe(stmt);
      }
      // Upgrade path for databases created before signup confirmation
      // existed: existing accounts are born confirmed (the column default
      // fills them in), while registrations that require confirmation insert
      // NULL explicitly. Idempotent — no-op once the column is there.
      await sql.unsafe(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at TEXT " +
          "DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))",
      );
      await seedArticles(sql);
    })().catch((err) => {
      _init = null; // allow a retry on the next query after a transient failure
      throw err;
    });
  }
  return _init;
}

/** Educational content lives in the database so the Learn hub is a real table. */
async function seedArticles(sql: postgres.Sql): Promise<void> {
  const rows = await sql.unsafe("SELECT COUNT(*) AS n FROM articles");
  if (Number((rows[0] as Row | undefined)?.n ?? 0) > 0) return;
  for (const a of ARTICLES) {
    await sql.unsafe(
      `INSERT INTO articles
         (slug, title, summary, category, reading_minutes, tags, art, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (slug) DO NOTHING`,
      [
        a.slug,
        a.title,
        a.summary,
        a.category,
        a.reading_minutes,
        JSON.stringify(a.tags),
        a.art,
        JSON.stringify(a.body),
      ] as never[],
    );
  }
}

/** SQLite used `?` placeholders; Postgres wants `$1..$n`. */
function toPostgres(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

/** Postgres has no `undefined` — mirror SQLite's null binding. */
function bind(params: unknown[]): never[] {
  return params.map((v) => (v === undefined ? null : v)) as never[];
}

/**
 * Rows are copied into plain objects: postgres.js result objects carry
 * prototype quirks that React's RSC serializer rejects when they cross into
 * a Client Component, so every row is normalized here rather than at each
 * call site (same contract the old sqlite layer had).
 */
export async function query<T = Row>(sqlText: string, ...params: unknown[]): Promise<T[]> {
  await ensureInit();
  const rows = await getClient().unsafe(toPostgres(sqlText), bind(params));
  return rows.map((row) => ({ ...row }) as T);
}

export async function one<T = Row>(sqlText: string, ...params: unknown[]): Promise<T | null> {
  const rows = await query<T>(sqlText, ...params);
  return rows[0] ?? null;
}

/**
 * Executes a write. `changes` counts rows returned by `RETURNING` — append
 * `RETURNING <col>` to UPDATE/DELETE statements whose result is inspected
 * (Postgres reports nothing otherwise). `lastInsertRowid` reads the `id` of a
 * `RETURNING id` row.
 */
export async function run(
  sqlText: string,
  ...params: unknown[]
): Promise<{ changes: number; lastInsertRowid: number }> {
  await ensureInit();
  const rows = await getClient().unsafe(toPostgres(sqlText), bind(params));
  return {
    changes: rows.length,
    lastInsertRowid: Number((rows[0] as Row | undefined)?.id ?? 0),
  };
}

/** True when any account exists — used to decide whether to seed a demo user. */
export async function hasUsers(): Promise<boolean> {
  const row = await one<{ n: string | number }>("SELECT COUNT(*) AS n FROM users");
  return Number(row?.n ?? 0) > 0;
}

/** Closes the pool — used by scripts (seed) so the process can exit. */
export async function closeDb(): Promise<void> {
  const sql = _sql;
  _sql = null;
  _init = null;
  if (sql) await sql.end({ timeout: 5 });
}
