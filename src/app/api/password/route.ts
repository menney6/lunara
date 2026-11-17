import { NextResponse } from "next/server";
import { createSession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { passwordProblem } from "@/lib/validate";

export const dynamic = "force-dynamic";

type FieldErrors = Record<string, string>;

/**
 * Changes the signed-in user's password.
 * Body: `{ current_password, new_password }`.
 * Every session for the account is invalidated, then a fresh one is issued for
 * this device so the user stays signed in here while all others are signed out.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";

  if (!currentPassword) {
    return NextResponse.json(
      {
        error: "Enter your current password.",
        fields: { current_password: "Enter your current password." } satisfies FieldErrors,
      },
      { status: 400 },
    );
  }

  const row = await one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    user.id,
  );
  if (!row) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!verifyPassword(currentPassword, row.password_hash)) {
    return NextResponse.json(
      {
        error: "Current password is incorrect.",
        fields: { current_password: "Current password is incorrect." } satisfies FieldErrors,
      },
      { status: 400 },
    );
  }

  const weak = passwordProblem(newPassword);
  if (weak) {
    return NextResponse.json(
      { error: weak, fields: { new_password: weak } } satisfies { error: string; fields: FieldErrors },
      { status: 400 },
    );
  }

  await run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(newPassword), user.id);

  // Invalidate every session for this account — including the one in use here.
  await run("DELETE FROM sessions WHERE user_id = ?", user.id);
  // Hand this device a brand-new session so only the other devices are signed out.
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
