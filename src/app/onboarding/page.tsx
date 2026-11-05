import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your cycle" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = getSettings(user.id);
  if (settings.onboarding_complete) redirect("/home");

  return <OnboardingWizard initial={settings} fallbackName={user.name} />;
}
