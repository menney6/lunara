import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { one, run, SQL_NOW } from "@/lib/db";
import { passwordProblem } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** POST /api/auth/reset { token, password } — consumes a single-use token. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  const problem = passwordProblem(password);
  if (problem) {
    return NextResponse.json({ error: problem, fields: { password: problem } }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await one<{ user_id: number; expires_at: string; used_at: string | null }>(
    "SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
    hash,
  );

  const valid = record && !record.used_at && new Date(`${record.expires_at}Z`) > new Date();

  if (!valid || !record) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  await run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), record.user_id);
  await run(`UPDATE password_resets SET used_at = ${SQL_NOW} WHERE token_hash = ?`, hash);
  // A changed password ends every existing session for that account.
  await run("DELETE FROM sessions WHERE user_id = ?", record.user_id);

  return NextResponse.json({ ok: true, next: "/login?reset=1" });
}
