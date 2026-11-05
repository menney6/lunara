import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { PrivacyClient } from "./privacy-client";

export const dynamic = "force-dynamic";

function countFor(userId: number, table: "periods" | "daily_logs"): number {
  const row = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`,
    userId,
  );
  return Number(row?.n ?? 0);
}

export default async function PrivacyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = getSettings(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Privacy"
        title="Privacy & data"
        subtitle="You decide what's locked, what's shared, and what stays entirely yours."
      />
      <PrivacyClient
        privacyLock={settings.privacy_lock === 1}
        shareAnalytics={settings.share_analytics === 1}
        counts={{
          periods: countFor(user.id, "periods"),
          logs: countFor(user.id, "daily_logs"),
        }}
      />
    </div>
  );
}
