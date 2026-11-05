import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { addDays, toISO } from "@/lib/cycle";
import { getCycleProfile, listLogs, listPeriods } from "@/lib/queries";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  // Defensive: the (app) layout already guards the session.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const periods = listPeriods(user.id);
  const profile = getCycleProfile(user.id);

  // Load a generous window of check-ins so any day the user taps can be
  // summarised without a second round-trip. Nothing can be logged in the future.
  const today = new Date();
  const earliest = periods.reduce(
    (acc, p) => (p.start_date < acc ? p.start_date : acc),
    toISO(addDays(today, -365)),
  );
  const logs = listLogs(user.id, earliest, toISO(today));

  return <CalendarClient profile={profile} periods={periods} logs={logs} />;
}
