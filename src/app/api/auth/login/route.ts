import { NextResponse } from "next/server";
import { createSession, ensureSettings, verifyPassword } from "@/lib/auth";
import { one } from "@/lib/db";
import { absoluteUrl, emails, sendMail } from "@/lib/mail";
import { hasErrors, validateLogin } from "@/lib/validate";

export const dynamic = "force-dynamic";

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  status: string;
  email_confirmed_at: string | null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const errors = validateLogin({ email, password });
  if (hasErrors(errors)) {
    return NextResponse.json(
      { error: Object.values(errors)[0], fields: errors },
      { status: 400 },
    );
  }

  const user = await one<UserRow>(
    "SELECT id, email, name, password_hash, status, email_confirmed_at FROM users WHERE email = ?",
    email,
  );

  // Constant-shape response: never reveals whether the address is registered.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }
  // Registered but never opened the confirmation link: no session yet.
  if (user.email_confirmed_at === null) {
    return NextResponse.json(
      {
        error: "Confirm your email address first — open the link we sent you.",
        needsConfirmation: true,
      },
      { status: 403 },
    );
  }

  const settings = await ensureSettings(user.id);

  await createSession(user.id);

  // Login notification — fire-and-forget so a slow mail server never delays
  // sign-in (sendMail never throws). Demo mode just logs the attempt.
  const device = (req.headers.get("user-agent") ?? "Unknown device").slice(0, 120);
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "Unknown";
  const time = new Date().toISOString().replace("T", " ").slice(0, 19);
  void sendMail({
    ...emails.newLogin({
      name: user.name,
      time,
      device,
      ip,
      resetUrl: absoluteUrl(req, "/forgot-password"),
    }),
    to: user.email,
  });

  return NextResponse.json({
    ok: true,
    next: settings.onboarding_complete ? "/home" : "/onboarding",
  });
}
