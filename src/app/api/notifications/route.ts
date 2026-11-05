import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ALL_NOTIFICATIONS, setNotificationPref } from "@/lib/queries";
import type { NotificationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS = new Set<string>(ALL_NOTIFICATIONS.map((entry) => entry.kind));

type FieldErrors = Record<string, string>;

/**
 * Updates a single reminder preference for the signed-in account only.
 * Body: `{ kind, enabled?, hour? }` — at least one of `enabled` / `hour`.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors: FieldErrors = {};

  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!KINDS.has(kind)) errors.kind = "Unknown reminder type.";

  let enabled: number | undefined;
  if ("enabled" in body) {
    const value = body.enabled;
    if (value === true || value === false || value === 1 || value === 0) {
      enabled = value ? 1 : 0;
    } else {
      errors.enabled = "Choose on or off.";
    }
  }

  let hour: number | undefined;
  if ("hour" in body) {
    const value = Number(body.hour);
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      errors.hour = "Choose an hour between 0 and 23.";
    } else {
      hour = value;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: Object.values(errors)[0], fields: errors },
      { status: 400 },
    );
  }

  if (enabled === undefined && hour === undefined) {
    return NextResponse.json(
      { error: "Nothing to update.", fields: { kind: "Nothing to update." } },
      { status: 400 },
    );
  }

  setNotificationPref(user.id, kind as NotificationKind, { enabled, hour });
  return NextResponse.json({ ok: true });
}
