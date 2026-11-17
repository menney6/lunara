import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteDailyLog, saveDailyLog, type DailyLogInput } from "@/lib/queries";
import { isIsoDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

/* Caps applied to anything that arrives from the client so a single account
   can never write oversized rows into daily_logs. */
const MAX_LIST_ITEMS = 30;
const MAX_ITEM_LENGTH = 60;
const MAX_TEXT_LENGTH = 40;
const MAX_NOTE_LENGTH = 4000;
const MAX_WATER = 30;

type FieldErrors = Record<string, string>;

/** Accepts a list of short strings, drops everything else, dedupes. `null` means
 *  "the client sent something that is not a list" (a validation error). */
function readList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const out: string[] = [];
  for (const raw of value) {
    if (out.length >= MAX_LIST_ITEMS) break;
    if (typeof raw !== "string") continue;
    const item = raw.trim().slice(0, MAX_ITEM_LENGTH);
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Integer 1–5, `null` when unset. Out-of-range values are rejected, never
 *  silently rewritten — the DB CHECK constraints allow only 1..5 or NULL. */
function readScale(value: unknown, field: string, errors: FieldErrors): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) {
    errors[field] = "Choose a value between 1 and 5.";
    return null;
  }
  return n;
}

/** Glasses of water: a whole number between 0 and 30, or `null` when unset. */
function readWater(value: unknown, errors: FieldErrors): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_WATER) {
    errors.water = `Choose between 0 and ${MAX_WATER} glasses.`;
    return null;
  }
  return Math.round(n);
}

/** Trimmed, length-capped free text. Anything non-string becomes `null`. */
function readText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors: FieldErrors = {};

  const date = String(body.date ?? "");
  if (!isIsoDate(date)) errors.date = "Choose a valid date.";

  const physical = readList(body.physical);
  const emotional = readList(body.emotional);
  if (physical === null) errors.physical = "Physical symptoms must be a list.";
  if (emotional === null) errors.emotional = "Emotional symptoms must be a list.";

  const sleep_quality = readScale(body.sleep_quality, "sleep_quality", errors);
  const energy = readScale(body.energy, "energy", errors);
  const mood_score = readScale(body.mood_score, "mood_score", errors);
  const water = readWater(body.water, errors);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: Object.values(errors)[0], fields: errors },
      { status: 400 },
    );
  }

  const input: DailyLogInput = {
    date,
    physical: physical ?? [],
    emotional: emotional ?? [],
    discharge: readText(body.discharge, MAX_TEXT_LENGTH),
    sleep_quality,
    energy,
    sexual_activity: readText(body.sexual_activity, MAX_TEXT_LENGTH),
    exercise: readText(body.exercise, MAX_TEXT_LENGTH),
    water,
    mood_score,
    note: readText(body.note, MAX_NOTE_LENGTH) ?? "",
  };

  const log = await saveDailyLog(user.id, input);
  return NextResponse.json({ ok: true, log });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isIsoDate(date)) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }

  const removed = await deleteDailyLog(user.id, date);
  if (!removed) {
    return NextResponse.json(
      { error: "No check-in found for that date." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
