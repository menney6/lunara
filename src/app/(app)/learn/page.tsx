import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { countArticles, listArticles } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui";
import { LearnClient } from "./learn-client";

export const dynamic = "force-dynamic";

/** Learn hub — every signed-in screen reads from the seeded `articles` table. */
export default async function LearnPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const articles = await listArticles();
  const total = await countArticles();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Understand your body, gently"
        subtitle="Plain-language guides on periods, hormones, fertility and more — written to be read in a few quiet minutes."
        action={<Badge tone="lavender">{total} articles</Badge>}
      />

      <LearnClient articles={articles} total={total} />
    </div>
  );
}
