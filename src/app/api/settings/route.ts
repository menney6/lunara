import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/queries";
import { isIsoDate, isPlausibleDate, validateCycle } from "@/lib/validate";
import type { Regularity, HealthGoal, PregnancyStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const REGULARITY: Regularity[] = ["regular", "somewhat", "irregular", "unknown"];
const PREGNANCY: PregnancyStatus[] = ["none", "trying", "pregnant", "postpartum", "not_sure"];
const GOALS: HealthGoal[] = [
  "track_cycle",
  "get_pregnant",
  "avoid_pregnant",
  "symptoms",
  "understand_body",
  "manage_condition",
  "pregnancy_tracking",
];

/** Whitelisted, individually sanitised — never passes raw client keys to SQL. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  if ("display_name" in body) {
    patch.display_name = String(body.display_name ?? "").trim().slice(0, 80);
  }
  if ("dob" in body) {
    const dob = body.dob === null || body.dob === "" ? null : String(body.dob);
    if (dob !== null && !isPlausibleDate(dob)) errors.dob = "Enter a valid date.";
    else patch.dob = dob;
  }
  if ("last_period" in body) {
    const lp = body.last_period === null || body.last_period === "" ? null : String(body.last_period);
    if (lp !== null && !isIsoDate(lp)) errors.last_period = "Enter a valid date.";
    else if (lp !== null && lp > new Date().toISOString().slice(0, 10)) {
      errors.last_period = "That date is in the future.";
    } else patch.last_period = lp;
  }
  if ("cycle_length" in body) patch.cycle_length = Number(body.cycle_length);
  if ("period_length" in body) patch.period_length = Number(body.period_length);

  if ("regularity" in body && typeof body.regularity === "string") {
    if (REGULARITY.includes(body.regularity as Regularity)) patch.regularity = body.regularity;
    else errors.regularity = "Choose an option.";
  }
  if ("pregnancy_status" in body && typeof body.pregnancy_status === "string") {
    if (PREGNANCY.includes(body.pregnancy_status as PregnancyStatus)) {
      patch.pregnancy_status = body.pregnancy_status;
    } else errors.pregnancy_status = "Choose an option.";
  }
  if ("goal" in body) {
    const goal = body.goal === null || body.goal === "" ? null : String(body.goal);
    if (goal !== null && !GOALS.includes(goal as HealthGoal)) errors.goal = "Choose an option.";
    else patch.goal = goal;
  }

  for (const flag of ["notifications_enabled", "privacy_lock", "share_analytics", "onboarding_complete"] as const) {
    if (flag in body) patch[flag] = body[flag] ? 1 : 0;
  }
  if ("theme" in body && typeof body.theme === "string") {
    patch.theme = body.theme.slice(0, 24);
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: Object.values(errors)[0], fields: errors },
      { status: 400 },
    );
  }

  // Cross-field cycle validation runs once both numbers are resolved.
  const current = await getSettings(user.id);
  const cycleCheck = validateCycle({
    cycle_length: Number(patch.cycle_length ?? current.cycle_length),
    period_length: Number(patch.period_length ?? current.period_length),
    last_period: ("last_period" in patch ? (patch.last_period as string | null) : current.last_period),
  });
  if (Object.keys(cycleCheck).length > 0) {
    return NextResponse.json(
      { error: Object.values(cycleCheck)[0], fields: cycleCheck },
      { status: 400 },
    );
  }

  const settings = await updateSettings(user.id, patch);
  return NextResponse.json({ ok: true, settings });
}
