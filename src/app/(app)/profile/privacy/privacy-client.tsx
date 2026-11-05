"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Database, Lock, Shield } from "lucide-react";
import { useToast } from "@/components/toast";
import { Callout, Card, LinkRow, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------ switch */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200",
        checked ? "border-transparent gradient-brand" : "border-line-strong bg-cream-dark",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow-soft transition-all duration-200",
          checked ? "left-[25px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------ the page */

interface PrivacyClientProps {
  privacyLock: boolean;
  shareAnalytics: boolean;
  counts: { periods: number; logs: number };
}

export function PrivacyClient({ privacyLock, shareAnalytics, counts }: PrivacyClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [lock, setLock] = useState(privacyLock);
  const [analytics, setAnalytics] = useState(shareAnalytics);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"lock" | "analytics" | null>(null);

  async function update(key: "privacy_lock" | "share_analytics", value: boolean) {
    const rollback = key === "privacy_lock" ? !lock : !analytics;
    if (key === "privacy_lock") setLock(value);
    else setAnalytics(value);

    setError("");
    setSaving(key === "privacy_lock" ? "lock" : "analytics");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (key === "privacy_lock") setLock(rollback);
        else setAnalytics(rollback);
        setError(data.error ?? "Couldn't save that setting.");
        return;
      }
      toast("Privacy settings saved");
      router.refresh();
    } catch {
      if (key === "privacy_lock") setLock(rollback);
      else setAnalytics(rollback);
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------ controls */}
      <section>
        <SectionHeading title="Controls" />
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-line">
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
                  <Lock className="size-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 text-[14.5px] font-medium text-ink">Privacy lock</p>
                <Toggle
                  checked={lock}
                  onChange={(value) => void update("privacy_lock", value)}
                  label="Privacy lock"
                />
              </div>
              <p className="mt-2 pl-11 text-[12.5px] leading-relaxed text-ink-soft">
                Marks your account as private. Lunara keeps every screen behind your sign-in and
                never surfaces cycle details in previews — sensible whenever this phone might be
                picked up by someone else.
              </p>
              <p className="mt-1.5 pl-11 text-[11.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                {lock ? "On · recommended" : "Off"}
                {saving === "lock" && " · saving…"}
              </p>
            </div>

            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pink-mist text-pink-deep">
                  <Shield className="size-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 text-[14.5px] font-medium text-ink">
                  Share anonymous analytics
                </p>
                <Toggle
                  checked={analytics}
                  onChange={(value) => void update("share_analytics", value)}
                  label="Share anonymous analytics"
                />
              </div>
              <p className="mt-2 pl-11 text-[12.5px] leading-relaxed text-ink-soft">
                Aggregated, anonymised counts of which screens are used and where people get
                stuck. Your periods, symptoms, notes and identity are never included — and in
                this build nothing leaves your device yet; the toggle records your preference.
              </p>
              <p className="mt-1.5 pl-11 text-[11.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                {analytics ? "On" : "Off · recommended"}
                {saving === "analytics" && " · saving…"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* -------------------------------------------------- reassurance */}
      <Callout kind="tip">
        <strong className="font-semibold">Your data stays yours.</strong> Everything you log is
        stored in the app&apos;s own database on this project&apos;s server, scoped strictly to
        your account — no other user can read it, and it is never sold or shared with third
        parties. Export it or delete it whenever you like.
      </Callout>

      {/* ---------------------------------------------------- your data */}
      <section>
        <SectionHeading title="Your data" />
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-line bg-cream-deep/60 px-3.5 py-3">
              <p className="font-display text-[22px] font-semibold leading-none tabular-nums text-ink">
                {counts.periods}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-faint">
                {counts.periods === 1 ? "period logged" : "periods logged"}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-cream-deep/60 px-3.5 py-3">
              <p className="font-display text-[22px] font-semibold leading-none tabular-nums text-ink">
                {counts.logs}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-faint">
                {counts.logs === 1 ? "check-in logged" : "check-ins logged"}
              </p>
            </div>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Taken together with your settings and reminder preferences, that&apos;s everything
            Lunara holds about you.
          </p>
        </Card>

        <Card className="mt-3 overflow-hidden p-0">
          <LinkRow
            icon={<Database className="size-4" aria-hidden />}
            label="Data & storage"
            description="Download a full copy or delete your account"
            onClick={() => router.push("/profile/data")}
          />
        </Card>
      </section>
    </div>
  );
}
