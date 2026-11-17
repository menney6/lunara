/**
 * Seeds the Lunara database with a fully-populated demo account so the
 * dashboard, calendar, insights and charts all have realistic data to show.
 *
 * Idempotent — re-running rebuilds the demo account's records from scratch.
 * Usage: npm run db:seed   (loads SUPABASE_DB_URL from .env.local)
 */
import crypto from "node:crypto";
import { closeDb, one, run } from "../src/lib/db.ts";
import { dueDateFromStart, toISO, addDays, parseISO } from "../src/lib/cycle.ts";

/** Mirrors src/lib/auth.ts so the seed never loads Next-only modules. */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function iso(daysAgo: number): string {
  return toISO(addDays(new Date(), -daysAgo));
}

const EMAIL = "demo@lunara.app";
const PASSWORD = "lunara1234";
const CYCLE = 29;
const PERIOD = 5;

/* ------------------------------------------------------------- demo user */

const existing = await one<{ id: number }>("SELECT id FROM users WHERE email = ?", EMAIL);

if (existing) {
  // Cascade clears settings/periods/logs/pregnancy/notifications.
  await run("DELETE FROM users WHERE id = ?", existing.id);
}

const inserted = await run(
  "INSERT INTO users (email, password_hash, name, status) VALUES (?,?,'Amara','active') RETURNING id",
  EMAIL,
  hashPassword(PASSWORD),
);
const userId = Number(inserted.lastInsertRowid);

/* --------------------------------------------------------------- settings */

// Anchor the cycle 9 days ago so the demo lands mid-cycle on day 10,
// with the fertile window just opening — the most interesting state to show.
await run(
  `INSERT INTO settings
     (user_id, display_name, dob, last_period, cycle_length, period_length,
      regularity, pregnancy_status, goal, notifications_enabled, privacy_lock,
      share_analytics, onboarding_complete)
   VALUES (?,?,?,?,?,?, 'regular', 'none', 'track_cycle', 1, 1, 0, 1)`,
  userId,
  "Amara",
  "1996-04-18",
  iso(9),
  CYCLE,
  PERIOD,
);

/* ---------------------------------------------------------------- periods */

// Six logged cycles: the most recent one plus five before it, with slight
// natural variation so the trend charts have something real to plot.
const cycleLengths = [29, 28, 30, 29, 27, 29];
const flow = ["medium", "heavy", "medium", "light", "medium", "medium"];

let cursor = 9;
for (let i = 0; i < cycleLengths.length; i++) {
  const start = iso(cursor);
  await run(
    `INSERT INTO periods (user_id, start_date, end_date, flow, symptoms, note)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (user_id, start_date) DO NOTHING`,
    userId,
    start,
    toISO(addDays(parseISO(start), PERIOD - 1)),
    flow[i],
    i % 2 === 0 ? "Cramps,Fatigue,Bloating" : "Headaches,Breast tenderness",
    i === 0 ? "Started on time again." : "",
  );
  cursor += cycleLengths[i + 1] ?? cycleLengths[i];
}

/* ------------------------------------------------------------- daily logs */

const PHYSICAL = [
  "Cramps", "Headaches", "Acne", "Bloating",
  "Breast tenderness", "Fatigue", "Back pain", "Appetite changes",
];
const EMOTIONAL = ["Happy", "Sad", "Anxious", "Irritable", "Calm", "Emotional", "Stressed"];
const DISCHARGE = ["None", "Dry", "Creamy", "Egg-white", "Spotting"];
const EXERCISE = ["None", "Light", "Moderate", "Intense", "Yoga", "Walk"];

function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

// 28 days of check-ins so every insight chart has a meaningful series.
for (let d = 27; d >= 0; d--) {
  const dayIndex = 27 - d;
  const cycleDay = ((d - 9) % CYCLE + CYCLE) % CYCLE; // cycle day for that date

  const physical: string[] = [];
  const emotional: string[] = [];

  // Symptoms that genuinely track with cycle position.
  if (cycleDay <= 3) physical.push("Cramps", "Fatigue");
  if (cycleDay >= 12 && cycleDay <= 15) physical.push("Bloating");
  if (cycleDay >= 20 && cycleDay <= 26) {
    physical.push("Breast tenderness", "Appetite changes");
    emotional.push("Irritable");
  }
  if (cycleDay === 0) emotional.push("Happy");

  // A little extra variety so the frequency chart isn't uniform.
  if (dayIndex % 4 === 0) physical.push(pick(PHYSICAL, dayIndex));
  if (dayIndex % 3 === 0) emotional.push(pick(EMOTIONAL, dayIndex + 2));
  if (dayIndex % 5 === 0) physical.push("Acne");

  const mood =
    cycleDay >= 20 && cycleDay <= 26 ? 2 + (dayIndex % 2) : cycleDay <= 3 ? 3 : 4 + (dayIndex % 2);

  await run(
    `INSERT INTO daily_logs
       (user_id, date, physical, emotional, discharge, sleep_quality, energy,
        sexual_activity, exercise, water, mood_score, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (user_id, date) DO NOTHING`,
    userId,
    iso(d),
    JSON.stringify([...new Set(physical)]),
    JSON.stringify([...new Set(emotional)]),
    pick(DISCHARGE, dayIndex),
    2 + (dayIndex % 4),
    Math.max(1, Math.min(5, mood)),
    dayIndex % 6 === 0 ? "Protected" : "None",
    pick(EXERCISE, dayIndex),
    6 + (dayIndex % 4),
    mood,
    dayIndex === 0 ? "Feeling good today." : "",
  );
}

/* -------------------------------------------------- notification defaults */

const kinds = [
  "period_upcoming", "fertile_window", "ovulation",
  "daily_checkin", "pregnancy_update", "weekly_insight",
];
for (const kind of kinds) {
  await run(
    `INSERT INTO notification_prefs (user_id, kind, enabled, hour)
     VALUES (?,?,?,9)
     ON CONFLICT(user_id, kind) DO NOTHING`,
    userId,
    kind,
    kind === "pregnancy_update" ? 0 : 1,
  );
}

const periods = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM periods WHERE user_id = ?", userId))?.n ?? 0);
const logs = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM daily_logs WHERE user_id = ?", userId))?.n ?? 0);
const articles = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM articles"))?.n ?? 0);

console.log("");
console.log("  Lunara database seeded");
console.log("  ─────────────────────");
console.log(`  Demo account : ${EMAIL}  (password: ${PASSWORD})`);
console.log(`  Periods      : ${periods}`);
console.log(`  Daily logs   : ${logs}`);
console.log(`  Articles     : ${articles}`);
console.log("");
console.log("  Due date helper verified: " + dueDateFromStart(iso(9)));
console.log("");

// Release the pool so the script can exit.
await closeDb();
