import { NextResponse } from "next/server";
import { destroySession, getSessionUser, verifyPassword } from "@/lib/auth";
import { one, query, run } from "@/lib/db";
import { getNotificationPrefs, getSettings, listPeriods } from "@/lib/queries";
import type { DailyLog, SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type FieldErrors = Record<string, string>;

/**
 * GET — full account export for the signed-in user: settings, periods,
 * daily logs and notification preferences. Everything is scoped by `user.id`.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const settings = getSettings(user.id);
  const periods = listPeriods(user.id);
  const logs = query<DailyLog>(
    "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date",
    user.id,
  );
  const notifications = getNotificationPrefs(user.id);

  return NextResponse.json({ settings, periods, logs, notifications });
}

/**
 * Shared delete flow: password confirmation first, then the typed email (or the
 * word DELETE), then the irreversible delete. The user row cascades to every
 * related table, and the session cookie is cleared.
 */
async function deleteAccount(user: SessionUser, body: Record<string, unknown> | null) {
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";

  if (!password) {
    return NextResponse.json(
      { error: "Enter your password.", fields: { password: "Enter your password." } satisfies FieldErrors },
      { status: 400 },
    );
  }

  const row = one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    user.id,
  );
  if (!row) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!verifyPassword(password, row.password_hash)) {
    return NextResponse.json(
      {
        error: "Password is incorrect.",
        fields: { password: "Password is incorrect." } satisfies FieldErrors,
      },
      { status: 400 },
    );
  }

  const emailMatches = confirm.toLowerCase() === user.email.toLowerCase();
  const typedDelete = confirm.toUpperCase() === "DELETE";
  if (!emailMatches && !typedDelete) {
    return NextResponse.json(
      {
        error: `Type ${user.email} or DELETE to confirm.`,
        fields: {
          confirm: `Type ${user.email} or DELETE to confirm.`,
        } satisfies FieldErrors,
      },
      { status: 400 },
    );
  }

  // Cascades to settings, periods, daily_logs, notification_prefs, pregnancy
  // and sessions — every table references users(id) ON DELETE CASCADE.
  run("DELETE FROM users WHERE id = ?", user.id);
  await destroySession();

  return NextResponse.json({ ok: true });
}

/** `POST /api/account` with `{ action: "delete", password, confirm }`. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.action !== "delete") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return deleteAccount(user, body);
}

/** `DELETE /api/account` with `{ password, confirm }`. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  return deleteAccount(user, body);
}
