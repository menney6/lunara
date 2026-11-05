import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { SecurityClient } from "./security-client";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Security"
        title="Change password"
        subtitle={`Signed in as ${user.email}. Pick something you don't use anywhere else.`}
      />
      <SecurityClient />
    </div>
  );
}
