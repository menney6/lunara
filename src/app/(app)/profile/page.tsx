import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { formatDate, titleCase } from "@/lib/format";
import { getSettings } from "@/lib/queries";
import { ProfileIdentityCard, SettingsNav, SignOutRow } from "./profile-client";

export const dynamic = "force-dynamic";

/** Small labelled figure used by the cycle snapshot grid. */
function Snapshot({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-cream-deep/60 px-3.5 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 font-display text-[17px] font-semibold leading-tight text-ink">
        {value}
        {unit && (
          <span className="ml-1 font-sans text-[12px] font-medium text-ink-faint">{unit}</span>
        )}
      </dd>
    </div>
  );
}

function SummaryRow({ label, tone, value }: { label: string; tone: "lavender" | "pink"; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-cream-deep/60 px-3.5 py-3">
      <span className="text-[13.5px] text-ink-soft">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-2.5 py-1 text-[13px] font-medium text-lavender-deep transition-colors hover:bg-lavender-mist hover:text-plum"
    >
      Edit
    </Link>
  );
}

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = getSettings(user.id);
  const name = settings.display_name.trim() || user.name;
  const memberSince = formatDate(user.created_at.slice(0, 10), { month: "long", year: "numeric" });

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        eyebrow="Your space"
        title="Profile"
        subtitle="Your cycle, preferences and account — all in one place."
      />

      {/* ---------------------------------------------------- identity */}
      <ProfileIdentityCard name={name} email={user.email} memberSince={memberSince} />

      {/* ---------------------------------------------- cycle snapshot */}
      <Card>
        <SectionHeading title="Cycle snapshot" action={<EditLink href="/profile/cycle" />} />
        <dl className="grid grid-cols-2 gap-2.5">
          <Snapshot label="Cycle length" value={String(settings.cycle_length)} unit="days" />
          <Snapshot label="Period length" value={String(settings.period_length)} unit="days" />
          <Snapshot label="Regularity" value={titleCase(settings.regularity)} />
          <Snapshot
            label="Last period"
            value={settings.last_period ? formatDate(settings.last_period) : "Not set"}
          />
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
          Predictions, phases and insights are all calculated from these four numbers.
        </p>
      </Card>

      {/* ------------------------------------------------ goals & status */}
      <Card>
        <SectionHeading title="Goals & status" action={<EditLink href="/profile/cycle" />} />
        <div className="space-y-2.5">
          <SummaryRow
            label="Current goal"
            tone="lavender"
            value={settings.goal ? titleCase(settings.goal) : "Not set"}
          />
          <SummaryRow
            label="Pregnancy status"
            tone="pink"
            value={titleCase(settings.pregnancy_status)}
          />
        </div>
      </Card>

      {/* ------------------------------------------------------ settings */}
      <div>
        <SectionHeading title="Settings" />
        <SettingsNav />
      </div>

      <SignOutRow />

      {/* -------------------------------------------------------- footer */}
      <footer className="flex flex-col items-center gap-1.5 pb-1 pt-2 text-center">
        <Logo size={26} />
        <p className="text-[12px] font-medium text-ink-faint">Lunara · v1.0</p>
        <p className="text-[11.5px] text-ink-faint">Your data stays yours.</p>
      </footer>
    </div>
  );
}
