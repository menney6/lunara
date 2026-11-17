import { NextResponse } from "next/server";
import { toISO } from "@/lib/cycle";
import { getSessionUser } from "@/lib/auth";
import {
  deletePeriod,
  getPeriod,
  savePeriod,
  syncAnchorFromHistory,
} from "@/lib/queries";
import { isIsoDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

const FLOWS = ["light", "medium", "heavy"] as const;
type Flow = (typeof FLOWS)[number];

function badRequest(errors: Record<string, string>) {
  return NextResponse.json(
    { error: Object.values(errors)[0], fields: errors },
    { status: 400 },
  );
}

/** Create or update a period log. Idempotent on (user_id, start_date). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const todayISO = toISO(new Date());
  const errors: Record<string, string> = {};

  const start = String(body.start_date ?? "");
  if (!isIsoDate(start)) errors.start_date = "Enter a valid date.";
  else if (start > todayISO) errors.start_date = "The start date can't be in the future.";

  let end: string | null = null;
  const rawEnd =
    body.end_date === undefined || body.end_date === null ? "" : String(body.end_date);
  if (rawEnd) {
    if (!isIsoDate(rawEnd)) errors.end_date = "Enter a valid date.";
    else if (rawEnd > todayISO) errors.end_date = "The end date can't be in the future.";
    else if (rawEnd < start && !errors.start_date) {
      errors.end_date = "The end date must be on or after the start date.";
    } else if (!errors.start_date) end = rawEnd;
  }

  let flow: Flow | null = null;
  const rawFlow =
    body.flow === undefined || body.flow === null ? "" : String(body.flow);
  if (rawFlow) {
    if ((FLOWS as readonly string[]).includes(rawFlow)) flow = rawFlow as Flow;
    else errors.flow = "Choose a flow.";
  }

  let id: number | null = null;
  if (body.id !== undefined && body.id !== null && String(body.id) !== "") {
    id = Number(body.id);
    if (!Number.isInteger(id)) errors.id = "Invalid period.";
  }

  if (Object.keys(errors).length > 0) return badRequest(errors);

  // Ownership first: an id belonging to another account is a 404, never a write.
  if (id !== null) {
    const existing = await getPeriod(user.id, id);
    if (!existing) return NextResponse.json({ error: "Period not found." }, { status: 404 });
    // savePeriod upserts on start_date, so a moved first day must drop the old row.
    if (existing.start_date !== start) await deletePeriod(user.id, id);
  }

  const period = await savePeriod(user.id, { start_date: start, end_date: end, flow });
  await syncAnchorFromHistory(user.id);

  return NextResponse.json({ ok: true, period });
}

/** Remove one period log, then re-anchor the projection to what is left. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const fromQuery = new URL(req.url).searchParams.get("id");
  const raw =
    body && body.id !== undefined && body.id !== null && String(body.id) !== ""
      ? String(body.id)
      : fromQuery;

  const id = Number(raw);
  if (!raw || !Number.isInteger(id)) {
    return NextResponse.json({ error: "Provide a period id." }, { status: 400 });
  }

  const period = await getPeriod(user.id, id);
  if (!period) return NextResponse.json({ error: "Period not found." }, { status: 404 });

  await deletePeriod(user.id, id);
  await syncAnchorFromHistory(user.id);

  return NextResponse.json({ ok: true });
}
