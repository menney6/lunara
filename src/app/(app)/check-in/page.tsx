import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCycleProfile, listLogs } from "@/lib/queries";
import { addDays, toISO } from "@/lib/cycle";
import { isIsoDate } from "@/lib/validate";
import { PageHeader } from "@/components/page-header";
import type { DailyLog, ParsedDailyLog } from "@/lib/types";
import { CheckInForm, type CheckInPrefill } from "./check-in-form";

export const dynamic = "force-dynamic";

/** How far back the date picker can travel — the window of logs shipped to the
 *  form so switching days never needs a round-trip. */
const HISTORY_DAYS = 365;

/** `physical` / `emotional` are JSON strings in the row — parse defensively. */
function parseLog(log: DailyLog): ParsedDailyLog {
  const safe = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    physical: safe(log.physical),
    emotional: safe(log.emotional),
    discharge: log.discharge,
    sleep_quality: log.sleep_quality,
    energy: log.energy,
    sexual_activity: log.sexual_activity,
    exercise: log.exercise,
    water: log.water,
    mood_score: log.mood_score,
    note: log.note ?? "",
  };
}

function clampDate(value: string, min: string, max: string): string {
  if (value > max) return max;
  if (value < min) return min;
  return value;
}

/** Comma-separated list from a quick-log link: `?physical=Cramps,Bloating`. */
function readListParam(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/** Single number from a quick-log link, ignored when out of range. */
function readNumberParam(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

interface CheckInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const todayISO = toISO(new Date());
  const minDate = toISO(addDays(new Date(), -HISTORY_DAYS));

  // Home deep-links land here: ?date=… plus optional one-tap prefills.
  const requested = typeof params.date === "string" ? params.date : "";
  const date = isIsoDate(requested) ? clampDate(requested, minDate, todayISO) : todayISO;

  const logs: Record<string, ParsedDailyLog> = {};
  for (const row of await listLogs(user.id, minDate, todayISO)) {
    logs[row.date] = parseLog(row);
  }

  const prefill: CheckInPrefill = {
    physical: readListParam(params.physical),
    emotional: readListParam(params.emotional),
    energy: readNumberParam(params.energy, 1, 5),
    water: readNumberParam(params.water, 0, 30),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Daily check-in"
        title="How are you feeling?"
        subtitle="Symptoms, mood, sleep and water — for today, or any day you missed."
      />
      <CheckInForm
        date={date}
        todayISO={todayISO}
        minDate={minDate}
        logs={logs}
        profile={await getCycleProfile(user.id)}
        prefill={prefill}
      />
    </div>
  );
}
