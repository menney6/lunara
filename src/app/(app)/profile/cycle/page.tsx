import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { CycleForm } from "./cycle-form";

export const dynamic = "force-dynamic";

export default async function CycleSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // SQLite rows have a null prototype — spread into a plain object before it
  // crosses the server → client boundary.
  const settings = { ...(await getSettings(user.id)) };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cycle settings"
        title="Your cycle"
        subtitle="The numbers and choices every prediction is built on. Change anything — it saves instantly."
      />
      <CycleForm settings={settings} />
    </div>
  );
}
