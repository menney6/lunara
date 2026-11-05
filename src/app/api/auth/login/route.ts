import { NextResponse } from "next/server";
import { createSession, ensureSettings, verifyPassword } from "@/lib/auth";
import { one } from "@/lib/db";
import { hasErrors, validateLogin } from "@/lib/validate";

export const dynamic = "force-dynamic";

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  status: string;
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

  const user = one<UserRow>(
    "SELECT id, email, password_hash, status FROM users WHERE email = ?",
    email,
  );

  // Constant-shape response: never reveals whether the address is registered.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }

  const settings = ensureSettings(user.id);

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    next: settings.onboarding_complete ? "/home" : "/onboarding",
  });
}
