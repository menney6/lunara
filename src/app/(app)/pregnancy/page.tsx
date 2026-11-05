import { redirect } from "next/navigation";
import { getPregnancyState } from "@/lib/cycle";
import { getSessionUser } from "@/lib/auth";
import { getPregnancy, getSettings, recentLogs } from "@/lib/queries";
import PregnancyClient, { type LogRow } from "./pregnancy-client";

export const dynamic = "force-dynamic";

/** `physical` / `emotional` are JSON strings in the row — parse defensively. */
function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default async function PregnancyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const pregnancy = getPregnancy(user.id);

  // No active record → the warm setup panel instead of a dashboard.
  if (!pregnancy) {
    const settings = getSettings(user.id);
    return <PregnancyClient mode="setup" defaultLmp={settings.last_period} />;
  }

  const logs: LogRow[] = recentLogs(user.id, 6).map((row) => ({
    date: row.date,
    tags: [...parseTags(row.emotional), ...parseTags(row.physical)],
    mood: row.mood_score,
  }));

  return (
    <PregnancyClient
      mode="active"
      record={pregnancy}
      state={getPregnancyState(pregnancy)}
      logs={logs}
    />
  );
}
