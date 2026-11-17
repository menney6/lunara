import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { ALL_NOTIFICATIONS, getNotificationPrefs, getSettings } from "@/lib/queries";
import { NotificationsClient, type NotificationItem } from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user.id);
  const prefs = await getNotificationPrefs(user.id);
  const byKind = new Map(prefs.map((pref) => [pref.kind, pref]));

  const items: NotificationItem[] = ALL_NOTIFICATIONS.map(({ kind, label, blurb }) => {
    const pref = byKind.get(kind);
    return {
      kind,
      label,
      blurb,
      enabled: (pref?.enabled ?? 1) === 1,
      hour: pref?.hour ?? 9,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reminders"
        title="Notifications"
        subtitle="Choose which gentle nudges you'd like, and the hour they arrive."
      />
      <NotificationsClient masterEnabled={settings.notifications_enabled === 1} items={items} />
    </div>
  );
}
