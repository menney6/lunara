"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, ChevronRight } from "lucide-react";
import { useToast } from "@/components/toast";
import { Badge, Callout, Card, SectionHeading, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { NotificationKind } from "@/lib/types";

export interface NotificationItem {
  kind: NotificationKind;
  label: string;
  blurb: string;
  enabled: boolean;
  hour: number;
}

/** Reminder hours offered in the picker: 08:00 → 21:00. */
const HOURS = Array.from({ length: 14 }, (_, index) => index + 8);

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Keeps the stored hour selectable even when it sits outside the range. */
function optionsFor(hour: number): number[] {
  return hour >= HOURS[0] && hour <= HOURS[HOURS.length - 1] ? HOURS : [hour, ...HOURS];
}

/* ------------------------------------------------------------ switch */

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-45",
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

/* ---------------------------------------------------------- the client */

export function NotificationsClient({
  masterEnabled,
  items,
}: {
  masterEnabled: boolean;
  items: NotificationItem[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [master, setMaster] = useState(masterEnabled);
  const [rows, setRows] = useState<NotificationItem[]>(items);
  const [error, setError] = useState("");
  const [savingKind, setSavingKind] = useState<NotificationKind | null>(null);

  const activeCount = rows.filter((row) => row.enabled).length;

  async function toggleMaster() {
    const next = !master;
    setMaster(next);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications_enabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMaster(!next);
        setError(data.error ?? "Couldn't update your reminders.");
        return;
      }
      toast(next ? "Reminders on" : "Reminders paused");
      router.refresh();
    } catch {
      setMaster(!next);
      setError("Network error — check your connection and try again.");
    }
  }

  async function updatePref(kind: NotificationKind, patch: { enabled?: boolean; hour?: number }) {
    const previous = rows;
    setRows((current) =>
      current.map((row) => (row.kind === kind ? { ...row, ...patch } : row)),
    );
    setError("");
    setSavingKind(kind);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
          ...(patch.hour === undefined ? {} : { hour: patch.hour }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRows(previous);
        setError(data.error ?? "Couldn't save that reminder.");
        return;
      }
      toast("Preference saved");
    } catch {
      setRows(previous);
      setError("Network error — check your connection and try again.");
    } finally {
      setSavingKind(null);
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

      {/* -------------------------------------------------- master switch */}
      <Card>
        <div className="flex items-center gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
            <Bell className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-medium text-ink">All reminders</p>
            <p className="text-[12.5px] text-ink-faint">
              One switch for every reminder below.
            </p>
          </div>
          <Toggle
            checked={master}
            onChange={() => void toggleMaster()}
            label="All reminders"
          />
        </div>
      </Card>

      <Callout kind="info">
        <strong className="font-semibold">Delivered in-app.</strong> Reminders appear inside
        Lunara at the hour you pick. This build doesn&apos;t configure a push provider yet, so
        nothing is sent to your lock screen or inbox — your choices are saved and ready the
        moment push is switched on.
      </Callout>

      {/* --------------------------------------------------------- list */}
      <section>
        <SectionHeading
          title="Reminder types"
          action={
            master ? (
              <Badge tone="lavender">{activeCount} of {rows.length} on</Badge>
            ) : (
              <Badge>Paused</Badge>
            )
          }
        />
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-line">
            {rows.map((row) => {
              const show = row.enabled && master;
              return (
                <div
                  key={row.kind}
                  className={cn("px-4 py-3.5 transition-opacity", !master && "opacity-60")}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-ink">{row.label}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                        {row.blurb}
                      </p>
                    </div>
                    <Toggle
                      checked={row.enabled}
                      disabled={!master}
                      onChange={(value) => void updatePref(row.kind, { enabled: value })}
                      label={row.label}
                    />
                  </div>

                  {show && (
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <label
                        htmlFor={`hour-${row.kind}`}
                        className="shrink-0 text-[12px] font-medium text-ink-faint"
                      >
                        Remind at
                      </label>
                      <div className="relative w-36">
                        <Select
                          id={`hour-${row.kind}`}
                          value={String(row.hour)}
                          onChange={(e) =>
                            void updatePref(row.kind, { hour: Number(e.target.value) })
                          }
                        >
                          {optionsFor(row.hour).map((hour) => (
                            <option key={hour} value={hour}>
                              {hourLabel(hour)}
                            </option>
                          ))}
                        </Select>
                        <ChevronRight
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-ink-faint"
                          aria-hidden
                        />
                      </div>
                      {savingKind === row.kind && (
                        <span className="text-[12px] text-ink-faint" role="status">
                          Saving…
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
