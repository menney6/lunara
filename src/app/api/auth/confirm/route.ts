import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { one, run, SQL_NOW } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/confirm?token=...
 *
 * Consumes a single-use signup-confirmation link: marks the account confirmed,
 * signs the user in (confirmation is also their first session) and lands them
 * on onboarding. Invalid, expired or already-used links bounce to
 * /login?confirm=invalid, where the form offers a resend.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const hash = token ? crypto.createHash("sha256").update(token).digest("hex") : "";

  const record = hash
    ? await one<{ user_id: number }>(
        `SELECT user_id FROM email_confirmations WHERE token_hash = ? AND used_at IS NULL AND expires_at > ${SQL_NOW}`,
        hash,
      )
    : null;

  if (!record) {
    return NextResponse.redirect(new URL("/login?confirm=invalid", req.url));
  }

  await run(
    `UPDATE users SET email_confirmed_at = COALESCE(email_confirmed_at, ${SQL_NOW}) WHERE id = ?`,
    record.user_id,
  );
  await run(`UPDATE email_confirmations SET used_at = ${SQL_NOW} WHERE token_hash = ?`, hash);

  await createSession(record.user_id);
  return NextResponse.redirect(new URL("/onboarding", req.url));
}
