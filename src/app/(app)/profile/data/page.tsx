import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { DataClient } from "./data-client";

export const dynamic = "force-dynamic";

function countFor(userId: number, table: "periods" | "daily_logs"): number {
  const row = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`,
    userId,
  );
  return Number(row?.n ?? 0);
}

export default async function DataPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Data & storage"
        title="Your data"
        subtitle="Take a copy with you, or remove everything for good."
      />
      <DataClient
        email={user.email}
        name={user.name}
        counts={{
          periods: countFor(user.id, "periods"),
          logs: countFor(user.id, "daily_logs"),
        }}
      />
    </div>
  );
}
