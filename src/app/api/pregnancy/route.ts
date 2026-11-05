import { NextResponse } from "next/server";
import { GESTATION_DAYS, addDays, diffDays, dueDateFromStart, parseISO, toISO } from "@/lib/cycle";
import { getSessionUser } from "@/lib/auth";
import { endPregnancy, savePregnancy } from "@/lib/queries";
import { isIsoDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Tracking cannot start later than ~43 weeks after the last period. */
const MAX_START_AGE_DAYS = 300;
/** A due date may already be up to ~3 weeks in the past (a late, normal birth). */
const OVERDUE_GRACE_DAYS = 20;
/** How far apart the two supplied dates may sit before we call them inconsistent. */
const DUE_DATE_TOLERANCE_DAYS = 14;

function badRequest(errors: Record<string, string>) {
  return NextResponse.json(
    { error: Object.values(errors)[0], fields: errors },
    { status: 400 },
  );
}

/**
 * Start (or restart) pregnancy tracking for the signed-in user.
 *
 * The body may carry `start_date` (LMP), `due_date`, or both:
 *  - only one side is sent → the other is derived (LMP + 280 days = due date);
 *  - both are sent → they are cross-checked (due − start must be 280 ± 14 days)
 *    and stored exactly as given.
 * `confirmed_due_date` is optional, validated against the same plausible window,
 * and never derived. Every write is scoped to `user.id`.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const today = new Date();
  const todayISO = toISO(today);
  const earliestStart = toISO(addDays(today, -MAX_START_AGE_DAYS));
  const earliestDue = toISO(addDays(today, -OVERDUE_GRACE_DAYS));
  const latestDue = toISO(addDays(today, GESTATION_DAYS));

  const errors: Record<string, string> = {};

  const rawStart = body.start_date === undefined || body.start_date === null ? "" : String(body.start_date);
  const rawDue = body.due_date === undefined || body.due_date === null ? "" : String(body.due_date);

  if (!rawStart && !rawDue) {
    errors.start_date = "Provide a last period date or a due date.";
  }

  let start = "";
  if (rawStart) {
    if (!isIsoDate(rawStart)) errors.start_date = "Enter a valid date.";
    else if (rawStart > todayISO) errors.start_date = "The last period date can't be in the future.";
    else if (rawStart < earliestStart) {
      errors.start_date = "That date is more than 300 days ago — check the date.";
    } else start = rawStart;
  }

  let due = "";
  if (rawDue) {
    if (!isIsoDate(rawDue)) errors.due_date = "Enter a valid date.";
    else if (rawDue > latestDue) errors.due_date = "That due date is too far in the future.";
    else if (rawDue < earliestDue) errors.due_date = "That due date has already passed by more than 3 weeks.";
    else due = rawDue;
  }

  // Cross-check only when both dates are individually valid — a derived side is
  // always exactly GESTATION_DAYS away, so the gap only ever comes from input.
  if (start && due) {
    const gap = diffDays(parseISO(due), parseISO(start));
    if (Math.abs(gap - GESTATION_DAYS) > DUE_DATE_TOLERANCE_DAYS) {
      errors.due_date = "A due date is usually about 280 days after the last period — check both dates.";
    }
  } else if (!start && due) {
    start = toISO(addDays(parseISO(due), -GESTATION_DAYS));
  } else if (start && !due) {
    due = dueDateFromStart(start);
  }

  let confirmed: string | null = null;
  const rawConfirmed =
    body.confirmed_due_date === undefined || body.confirmed_due_date === null
      ? ""
      : String(body.confirmed_due_date);
  if (rawConfirmed) {
    if (!isIsoDate(rawConfirmed)) errors.confirmed_due_date = "Enter a valid date.";
    else if (rawConfirmed < earliestDue || rawConfirmed > latestDue) {
      errors.confirmed_due_date = "Enter a due date within a plausible window.";
    } else confirmed = rawConfirmed;
  }

  if (Object.keys(errors).length > 0) return badRequest(errors);

  const pregnancy = savePregnancy(user.id, {
    start_date: start,
    due_date: due,
    confirmed_due_date: confirmed,
  });

  return NextResponse.json({ ok: true, pregnancy });
}

/** End pregnancy tracking. 404 when there is no active record to end. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const ended = endPregnancy(user.id);
  if (!ended) {
    return NextResponse.json({ error: "No active pregnancy to end." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
