import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

/** Guard for every signed-in screen: session first, then onboarding state. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user.id);
  if (!settings.onboarding_complete) redirect("/onboarding");

  return (
    <>
      <div className="mx-auto min-h-dvh w-full max-w-xl px-4 pb-32 pt-4 sm:px-6">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
