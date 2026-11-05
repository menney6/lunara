import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { one, query, run } from "./db";
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH } from "./cycle";
import type { SessionUser, UserSettings } from "./types";

const SESSION_COOKIE = "lunara_session";
const SESSION_DAYS = 30;

/* ------------------------------------------------------------ passwords */

function derive(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = derive(password, salt);
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, , , , saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = derive(password, Buffer.from(saltB64, "base64"));
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function expiryDate(days = SESSION_DAYS): string {
  return new Date(Date.now() + days * 86_400_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

/* -------------------------------------------------------------- sessions */

export async function createSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const ua = (await headers()).get("user-agent") ?? "";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "";

  run(
    "INSERT INTO sessions (token_hash, user_id, user_agent, ip, expires_at) VALUES (?,?,?,?,?)",
    sha256(token),
    userId,
    ua,
    ip,
    expiryDate(),
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
  jar.delete(SESSION_COOKIE);
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  status: "active" | "suspended";
  password_hash: string;
  created_at: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = one<UserRow>(
    `SELECT u.id, u.email, u.name, u.status, u.password_hash, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    sha256(token),
  );
  if (!row || row.status !== "active") return null;

  return { id: row.id, email: row.email, name: row.name, status: row.status, created_at: row.created_at };
}

export class AuthRedirect extends Error {
  constructor(public to: string) {
    super(`Redirect to ${to}`);
  }
}

export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) throw new AuthRedirect("/login");
  return user;
});

/* ------------------------------------------------------------- settings */

const DEFAULT_SETTINGS = {
  display_name: "",
  dob: null as string | null,
  last_period: null as string | null,
  cycle_length: DEFAULT_CYCLE_LENGTH,
  period_length: DEFAULT_PERIOD_LENGTH,
  regularity: "unknown",
  pregnancy_status: "none",
  goal: null as string | null,
};

/** Lazily creates the settings row so every new account has valid defaults. */
export function ensureSettings(userId: number): UserSettings {
  const existing = one<UserSettings>("SELECT * FROM settings WHERE user_id = ?", userId);
  if (existing) return existing;

  run(
    `INSERT INTO settings (user_id, display_name, cycle_length, period_length)
     VALUES (?,?,?,?)`,
    userId,
    DEFAULT_SETTINGS.display_name,
    DEFAULT_SETTINGS.cycle_length,
    DEFAULT_SETTINGS.period_length,
  );
  return one<UserSettings>("SELECT * FROM settings WHERE user_id = ?", userId)!;
}

export const getSettings = cache((userId: number): UserSettings => ensureSettings(userId));

/** Full onboarding is only complete once a period start date exists. */
export function hasCycleData(settings: UserSettings): boolean {
  return Boolean(settings.last_period);
}

export { SESSION_COOKIE };
