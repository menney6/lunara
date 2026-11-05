import { NextResponse } from "next/server";
import { createSession, ensureSettings, hashPassword } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { hasErrors, validateRegister } from "@/lib/validate";
import { updateSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface UserRow {
  id: number;
  email: string;
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

  const existing = one<UserRow>("SELECT id, email FROM users WHERE email = ?", email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const res = run("INSERT INTO users (email, password_hash, name) VALUES (?,?,?)", email, hashPassword(password), name);

  const userId = Number(res.lastInsertRowid);
  ensureSettings(userId);
  updateSettings(userId, { display_name: name });

  await createSession(userId);

  return NextResponse.json({ ok: true, next: "/onboarding" });
}
