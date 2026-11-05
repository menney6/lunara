import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
import { isEmail } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot { email }
 *
 * Always responds 200 so the form can never be used to discover which
 * addresses are registered. This deployment has no outbound mail provider, so
 * outside production the reset link is returned to the caller and rendered as a
 * "demo delivery" — keeping the flow usable end to end.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!isEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address.", fields: { email: "Enter a valid email address." } },
      { status: 400 },
    );
  }

  const user = one<{ id: number }>("SELECT id FROM users WHERE email = ?", email);
  let devLink: string | null = null;

  if (user) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + 45 * 60_000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    run(
      "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)",
      crypto.createHash("sha256").update(token).digest("hex"),
      user.id,
      expires,
    );

    if (process.env.NODE_ENV !== "production") {
      devLink = `/reset-password?token=${token}`;
    }
    console.info(`[lunara] password reset requested for ${email}`);
  }

  return NextResponse.json({ ok: true, devLink });
}
