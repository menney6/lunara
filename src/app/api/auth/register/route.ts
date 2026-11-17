import { NextResponse } from "next/server";
import { createSession, ensureSettings, hashPassword } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { confirmationRequired, sendConfirmationEmail } from "@/lib/mail";
import { hasErrors, validateRegister } from "@/lib/validate";
import { updateSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface UserRow {
  id: number;
  email: string;
  name: string;
  email_confirmed_at: string | null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? password);

  const errors = validateRegister({ name, email, password, confirm });
  if (hasErrors(errors)) {
    return NextResponse.json(
      { error: Object.values(errors)[0], fields: errors },
      { status: 400 },
    );
  }

  const existing = await one<UserRow>(
    "SELECT id, email, name, email_confirmed_at FROM users WHERE email = ?",
    email,
  );
  if (existing) {
    // An unconfirmed account can't sign in — issue a fresh confirmation link
    // rather than leaving the user at a dead end.
    if (existing.email_confirmed_at === null) {
      const devLink = await sendConfirmationEmail(req, existing.id, email, existing.name);
      return NextResponse.json(
        {
          error:
            "An account with that email already exists. Check your inbox for the confirmation link.",
          devLink,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const confirmFirst = confirmationRequired();
  const res = confirmFirst
    ? await run(
        "INSERT INTO users (email, password_hash, name, email_confirmed_at) VALUES (?,?,?,NULL) RETURNING id",
        email,
        hashPassword(password),
        name,
      )
    : await run(
        "INSERT INTO users (email, password_hash, name) VALUES (?,?,?) RETURNING id",
        email,
        hashPassword(password),
        name,
      );

  const userId = Number(res.lastInsertRowid);
  await ensureSettings(userId);
  await updateSettings(userId, { display_name: name });

  // Signup confirmation: no session until the emailed link is opened.
  if (confirmFirst) {
    const devLink = await sendConfirmationEmail(req, userId, email, name);
    return NextResponse.json({ ok: true, needsConfirmation: true, devLink });
  }

  await createSession(userId);

  return NextResponse.json({ ok: true, next: "/onboarding" });
}
