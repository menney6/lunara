-- Lunara — signup email confirmation.
--
-- users.email_confirmed_at:
--   * DEFAULT marks every pre-existing account confirmed (backfill).
--   * Registrations that enforce confirmation insert NULL explicitly, and
--     the value is set by GET /api/auth/confirm when the link is opened.
--
-- Keep in sync with src/lib/db.ts, which applies the same statements on
-- first use of each process.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_confirmed_at TEXT
  DEFAULT (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'));

CREATE TABLE IF NOT EXISTS email_confirmations (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
