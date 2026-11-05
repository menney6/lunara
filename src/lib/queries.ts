import { one, query, run } from "./db";
import { CATEGORIES } from "./content.ts";
import {
  buildProfile,
  clampCycleLength,
  clampPeriodLength,
  getCycleState,
} from "./cycle";
import { ensureSettings } from "./auth";
import type {
  Article,
  ArticleCategory,
  CycleProfile,
  CycleState,
  DailyLog,
  NotificationKind,
  NotificationPref,
  Period,
  PregnancyRecord,
  UserSettings,
} from "./types";

/* =========================================================================
   Data access. Every function in this file takes an explicit `userId` and
   filters on it, so a record belonging to another account can never be read
   or written by accident.
   ========================================================================= */

/* ------------------------------------------------------------- settings */

export function getSettings(userId: number): UserSettings {
  return ensureSettings(userId);
}

export function updateSettings(
  userId: number,
  patch: Partial<
    Pick<
      UserSettings,
      | "display_name"
      | "dob"
      | "last_period"
      | "cycle_length"
      | "period_length"
      | "regularity"
      | "pregnancy_status"
      | "goal"
      | "notifications_enabled"
      | "theme"
      | "privacy_lock"
      | "share_analytics"
      | "onboarding_complete"
    >
  >,
): UserSettings {
  const keys = Object.keys(patch);
  if (keys.length > 0) {
    const assignments = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
    run(
      `UPDATE settings SET ${assignments}, updated_at = datetime('now') WHERE user_id = ?`,
      ...values,
      userId,
    );
  }
  return getSettings(userId);
}

/* -------------------------------------------------------------- periods */

export function listPeriods(userId: number): Period[] {
  return query<Period>(
    "SELECT * FROM periods WHERE user_id = ? ORDER BY start_date DESC",
    userId,
  );
}

export function getPeriod(userId: number, id: number): Period | null {
  return one<Period>("SELECT * FROM periods WHERE id = ? AND user_id = ?", id, userId);
}

export interface PeriodInput {
  start_date: string;
  end_date?: string | null;
  flow?: "light" | "medium" | "heavy" | null;
  symptoms?: string;
  note?: string;
}

/** Idempotent — logging the same start date twice updates the existing row. */
export function savePeriod(userId: number, input: PeriodInput): Period {
  const end = input.end_date && input.end_date >= input.start_date ? input.end_date : null;
  run(
    `INSERT INTO periods (user_id, start_date, end_date, flow, symptoms, note)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id, start_date) DO UPDATE SET
       end_date = excluded.end_date,
       flow = excluded.flow,
       symptoms = excluded.symptoms,
       note = excluded.note`,
    userId,
    input.start_date,
    end,
    input.flow ?? null,
    input.symptoms ?? "",
    input.note ?? "",
  );
  return one<Period>(
    "SELECT * FROM periods WHERE user_id = ? AND start_date = ?",
    userId,
    input.start_date,
  )!;
}

export function deletePeriod(userId: number, id: number): boolean {
  return run("DELETE FROM periods WHERE id = ? AND user_id = ?", id, userId).changes > 0;
}

/** Deletes every log for a given date (used when a period entry is removed). */
export function deletePeriodByDate(userId: number, start: string): boolean {
  return run("DELETE FROM periods WHERE user_id = ? AND start_date = ?", userId, start).changes > 0;
}

/* ----------------------------------------------------------- daily logs */

export function getLog(userId: number, date: string): DailyLog | null {
  return one<DailyLog>("SELECT * FROM daily_logs WHERE user_id = ? AND date = ?", userId, date);
}

export function listLogs(userId: number, from: string, to: string): DailyLog[] {
  return query<DailyLog>(
    "SELECT * FROM daily_logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date",
    userId,
    from,
    to,
  );
}

/** Most recent `limit` logged days, newest first. */
export function recentLogs(userId: number, limit = 60): DailyLog[] {
  return query<DailyLog>(
    "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT ?",
    userId,
    limit,
  );
}

export interface DailyLogInput {
  date: string;
  physical: string[];
  emotional: string[];
  discharge?: string | null;
  sleep_quality?: number | null;
  energy?: number | null;
  sexual_activity?: string | null;
  exercise?: string | null;
  water?: number | null;
  mood_score?: number | null;
  note?: string;
}

export function saveDailyLog(userId: number, input: DailyLogInput): DailyLog {
  run(
    `INSERT INTO daily_logs
       (user_id, date, physical, emotional, discharge, sleep_quality, energy,
        sexual_activity, exercise, water, mood_score, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       physical = excluded.physical,
       emotional = excluded.emotional,
       discharge = excluded.discharge,
       sleep_quality = excluded.sleep_quality,
       energy = excluded.energy,
       sexual_activity = excluded.sexual_activity,
       exercise = excluded.exercise,
       water = excluded.water,
       mood_score = excluded.mood_score,
       note = excluded.note,
       updated_at = datetime('now')`,
    userId,
    input.date,
    JSON.stringify(input.physical ?? []),
    JSON.stringify(input.emotional ?? []),
    input.discharge ?? null,
    input.sleep_quality ?? null,
    input.energy ?? null,
    input.sexual_activity ?? null,
    input.exercise ?? null,
    input.water ?? null,
    input.mood_score ?? null,
    input.note ?? "",
  );
  return getLog(userId, input.date)!;
}

export function deleteDailyLog(userId: number, date: string): boolean {
  return run("DELETE FROM daily_logs WHERE user_id = ? AND date = ?", userId, date).changes > 0;
}

/* ------------------------------------------------------------ pregnancy */

export function getPregnancy(userId: number): PregnancyRecord | null {
  return one<PregnancyRecord>(
    "SELECT * FROM pregnancy WHERE user_id = ? AND status = 'active'",
    userId,
  );
}

export function savePregnancy(
  userId: number,
  input: { start_date: string; due_date: string; confirmed_due_date?: string | null },
): PregnancyRecord {
  run(
    `INSERT INTO pregnancy (user_id, start_date, due_date, confirmed_due_date, status)
     VALUES (?,?,?,?, 'active')
     ON CONFLICT(user_id) DO UPDATE SET
       start_date = excluded.start_date,
       due_date = excluded.due_date,
       confirmed_due_date = excluded.confirmed_due_date,
       status = 'active'`,
    userId,
    input.start_date,
    input.due_date,
    input.confirmed_due_date ?? null,
  );
  return getPregnancy(userId)!;
}

export function endPregnancy(userId: number): boolean {
  return (
    run("UPDATE pregnancy SET status = 'ended' WHERE user_id = ? AND status = 'active'", userId)
      .changes > 0
  );
}

/* ----------------------------------------------------- notification prefs */

export const ALL_NOTIFICATIONS: { kind: NotificationKind; label: string; blurb: string }[] = [
  { kind: "period_upcoming", label: "Upcoming period", blurb: "A heads-up a few days before your period is expected." },
  { kind: "fertile_window", label: "Fertile window", blurb: "When your estimated fertile window opens." },
  { kind: "ovulation", label: "Ovulation estimate", blurb: "A reminder on your estimated ovulation day." },
  { kind: "daily_checkin", label: "Daily check-in", blurb: "A gentle nudge to log how you're feeling." },
  { kind: "pregnancy_update", label: "Pregnancy updates", blurb: "Weekly development updates while pregnant." },
  { kind: "weekly_insight", label: "Weekly insight", blurb: "A short summary of your patterns each week." },
];

export function getNotificationPrefs(userId: number): NotificationPref[] {
  const existing = query<NotificationPref>(
    "SELECT * FROM notification_prefs WHERE user_id = ?",
    userId,
  );
  if (existing.length === ALL_NOTIFICATIONS.length) return existing;

  // Fill in any missing kinds with sensible defaults (on, 09:00).
  for (const { kind } of ALL_NOTIFICATIONS) {
    run(
      `INSERT INTO notification_prefs (user_id, kind, enabled, hour)
       VALUES (?,?,1,9)
       ON CONFLICT(user_id, kind) DO NOTHING`,
      userId,
      kind,
    );
  }
  return query<NotificationPref>(
    "SELECT * FROM notification_prefs WHERE user_id = ? ORDER BY id",
    userId,
  );
}

export function setNotificationPref(
  userId: number,
  kind: NotificationKind,
  patch: { enabled?: number; hour?: number },
): void {
  const prefs = getNotificationPrefs(userId);
  const current = prefs.find((p) => p.kind === kind);
  if (!current) return;
  run(
    "UPDATE notification_prefs SET enabled = ?, hour = ? WHERE user_id = ? AND kind = ?",
    patch.enabled ?? current.enabled,
    patch.hour ?? current.hour,
    userId,
    kind,
  );
}

/* ------------------------------------------------------- cycle projection */

/**
 * Merges onboarding settings with recorded period history into the projection
 * input the cycle engine expects.
 */
export function getCycleProfile(userId: number): CycleProfile {
  const settings = getSettings(userId);
  const periods = listPeriods(userId);

  return buildProfile({
    lastPeriod: settings.last_period,
    periodStarts: periods.map((p) => p.start_date),
    periods: periods.map((p) => ({ start_date: p.start_date, end_date: p.end_date })),
    cycleLength: clampCycleLength(settings.cycle_length),
    periodLength: clampPeriodLength(settings.period_length),
    regularity: settings.regularity,
  });
}

export function getCycleStateFor(userId: number, today = new Date()): CycleState | null {
  return getCycleState(getCycleProfile(userId), today);
}

/**
 * Keeps `settings.last_period` pointing at the most recent recorded period so
 * the dashboard stays correct after a new period is logged.
 */
export function syncAnchorFromHistory(userId: number): void {
  const latest = one<{ start_date: string }>(
    "SELECT start_date FROM periods WHERE user_id = ? ORDER BY start_date DESC LIMIT 1",
    userId,
  );
  if (latest) updateSettings(userId, { last_period: latest.start_date });
}

/* -------------------------------------------------------------- articles */

function hydrateArticle(row: Record<string, unknown>): Article {
  return {
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    category: row.category as ArticleCategory,
    reading_minutes: Number(row.reading_minutes),
    tags: JSON.parse(String(row.tags ?? "[]")),
    art: String(row.art ?? "lavender"),
    body: JSON.parse(String(row.body ?? "[]")),
  };
}

export function listArticles(category?: ArticleCategory): Article[] {
  const rows = category
    ? query<Record<string, unknown>>(
        "SELECT * FROM articles WHERE category = ? ORDER BY reading_minutes",
        category,
      )
    : query<Record<string, unknown>>("SELECT * FROM articles ORDER BY reading_minutes");

  // Sort by the editorial topic order in content.ts (not alphabetically), so
  // the flagship "Menstrual health" reads first rather than "Endometriosis".
  const rank = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return rows
    .map(hydrateArticle)
    .sort(
      (a, b) =>
        (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) ||
        a.reading_minutes - b.reading_minutes,
    );
}

export function getArticle(slug: string): Article | null {
  const row = one<Record<string, unknown>>("SELECT * FROM articles WHERE slug = ?", slug);
  return row ? hydrateArticle(row) : null;
}

export function countArticles(): number {
  return Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM articles")?.n ?? 0);
}
