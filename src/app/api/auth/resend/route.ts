import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/mail";
import { isEmail } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/resend { email }
 *
 * Re-issues the signup-confirmation link for an unconfirmed account. Always
 * responds 200 with the same shape so the form can never be used to discover
 * which addresses are registered; in demo mode the fresh link comes back so
 * the UI can render it.
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

  const user = await one<{ id: number; name: string; email_confirmed_at: string | null }>(
    "SELECT id, name, email_confirmed_at FROM users WHERE email = ?",
    email,
  );

  let devLink: string | null = null;
  if (user && user.email_confirmed_at === null) {
    devLink = await sendConfirmationEmail(req, user.id, email, user.name);
    console.info(`[lunara] confirmation link resent for ${email}`);
  }

  return NextResponse.json({ ok: true, devLink });
}
