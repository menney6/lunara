import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Index() {
  const user = await getSessionUser();
  if (!user) redirect("/welcome");

  const settings = getSettings(user.id);
  redirect(settings.onboarding_complete && settings.last_period ? "/home" : "/onboarding");
}
