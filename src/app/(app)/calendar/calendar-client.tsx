"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplet,
  HeartPulse,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  PHASE_META,
  WEEKDAYS,
  buildMonthGrid,
  describeDay,
  diffDays,
  parseISO,
  toISO,
  type DayInfo,
  type MonthCell,
} from "@/lib/cycle";
import {
  capList,
  formatDate,
  formatDateLong,
  monthLabel,
  pluralize,
  relativeDay,
  titleCase,
} from "@/lib/format";
import { cn } from "@/lib/cn";
import { isIsoDate } from "@/lib/validate";
import type { CycleProfile, DailyLog, Period } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Input,
  SectionHeading,
  Sheet,
} from "@/components/ui";

/* --------------------------------------------------------------- helpers */

const FLOWS = ["light", "medium", "heavy"] as const;
type FlowOption = (typeof FLOWS)[number];

interface PeriodForm {
  id: number | null;
  start: string;
  end: string;
  flow: FlowOption | "";
}

type View =
  | { kind: "day"; date: string }
  | { kind: "period"; period: Period | null }
  | { kind: "delete"; period: Period; from: string }
  | null;

interface CalendarClientProps {
  profile: CycleProfile;
  periods: Period[];
  logs: DailyLog[];
}

/** `#rrggbb` → `rgba(...)` so theme hex tokens can carry an opacity. */
function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseLog(log: DailyLog): {
  physical: string[];
  emotional: string[];
  mood_score: number | null;
  energy: number | null;
  sleep_quality: number | null;
  water: number | null;
  note: string;
} {
  const safe = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    physical: safe(log.physical),
    emotional: safe(log.emotional),
    mood_score: log.mood_score,
    energy: log.energy,
    sleep_quality: log.sleep_quality,
    water: log.water,
    note: log.note ?? "",
  };
}

function periodRange(period: Period): string {
  return period.end_date
    ? `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`
    : `Started ${formatDate(period.start_date)}`;
}

function periodDuration(period: Period): string {
  if (!period.end_date) return "End date not set";
  const days =
    diffDays(parseISO(period.end_date), parseISO(period.start_date)) + 1;
  return pluralize(days, "day");
}

/** Which logged period (if any) covers this date. */
function findPeriod(periods: Period[], date: string): Period | null {
  return (
    periods.find(
      (p) => date >= p.start_date && date <= (p.end_date ?? p.start_date),
    ) ?? null
  );
}

/* =============================================================== screen */

export function CalendarClient({ profile, periods, logs }: CalendarClientProps) {
  const router = useRouter();
  const toast = useToast();

  const today = new Date();
  const todayISO = toISO(today);

  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [view, setView] = useState<View>(null);
  const [form, setForm] = useState<PeriodForm>({
    id: null,
    start: "",
    end: "",
    flow: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const logByDate = useMemo(() => {
    const map = new Map<string, DailyLog>();
    for (const log of logs) map.set(log.date, log);
    return map;
  }, [logs]);

  const marks = useMemo(() => ({ periods }), [periods]);
  const grid = buildMonthGrid(cursor.year, cursor.month, profile, marks, today);

  const dayView = view && view.kind === "day" ? view : null;
  const selectedDate = dayView?.date ?? null;
  const selectedInfo: DayInfo | null = selectedDate
    ? describeDay(parseISO(selectedDate), profile, marks, today)
    : null;
  const selectedPhase =
    selectedInfo && selectedInfo.phase ? PHASE_META[selectedInfo.phase] : null;
  const dayPeriod = selectedDate ? findPeriod(periods, selectedDate) : null;
  const dayLog = selectedDate ? logByDate.get(selectedDate) ?? null : null;
  const parsedLog = dayLog ? parseLog(dayLog) : null;
  const dayTags = parsedLog
    ? [...parsedLog.emotional, ...parsedLog.physical]
    : [];

  /* ------------------------------------------------------ month motion */

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  /* -------------------------------------------------------- period form */

  function openNewPeriod(startDate: string) {
    setForm({ id: null, start: startDate, end: "", flow: "" });
    setErrors({});
    setView({ kind: "period", period: null });
  }

  function openEditPeriod(period: Period) {
    setForm({
      id: period.id,
      start: period.start_date,
      end: period.end_date ?? "",
      flow: period.flow ?? "",
    });
    setErrors({});
    setView({ kind: "period", period });
  }

  function validateForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.start) errs.start = "Choose the first day of your period.";
    else if (!isIsoDate(form.start)) errs.start = "Enter a valid date.";
    else if (form.start > todayISO) errs.start = "The start date can't be in the future.";

    if (form.end) {
      if (!isIsoDate(form.end)) errs.end = "Enter a valid date.";
      else if (form.end > todayISO) errs.end = "The end date can't be in the future.";
      else if (!errs.start && form.end < form.start) {
        errs.end = "The end date must be on or after the start date.";
      }
    }
    return errs;
  }

  async function submitPeriod() {
    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id ?? undefined,
          start_date: form.start,
          end_date: form.end || undefined,
          flow: form.flow || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; fields?: Record<string, string> }
        | null;

      if (!res.ok) {
        const fields = data?.fields ?? {};
        const mapped: Record<string, string> = {};
        if (fields.start_date) mapped.start = fields.start_date;
        if (fields.end_date) mapped.end = fields.end_date;
        if (fields.flow) mapped.flow = fields.flow;
        setErrors(
          Object.keys(mapped).length > 0
            ? mapped
            : { form: data?.error ?? "Couldn't save this period. Try again." },
        );
        return;
      }

      toast("Period logged");
      setView(null);
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: number) {
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/periods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setErrors({ form: data?.error ?? "Couldn't delete this period. Try again." });
        return;
      }
      toast("Period log deleted");
      setView(null);
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------- render */

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Menstrual calendar"
          title="Calendar"
          subtitle="Tap any day to see what's logged — and what's only estimated."
          action={
            <Button size="sm" onClick={() => openNewPeriod(todayISO)}>
              <Plus className="size-4" aria-hidden />
              Log
            </Button>
          }
        />
      </div>

      {!profile.anchor && (
        <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <Callout kind="info">
            Log your first period to unlock cycle predictions. Day counts,
            ovulation and your fertile window appear once there's a date to
            anchor to.
          </Callout>
        </div>
      )}

      {/* ------------------------------------------------------ calendar */}
      <Card
        className="animate-fade-up rounded-[28px] p-3 sm:p-5"
        style={{ animationDelay: "80ms" }}
      >
        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-1">
          <div className="flex items-center gap-0.5 justify-self-start">
            <IconButton
              label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="size-9"
            >
              <ChevronLeft className="size-4.5" aria-hidden />
            </IconButton>
            <IconButton
              label="Next month"
              onClick={() => shiftMonth(1)}
              className="size-9"
            >
              <ChevronRight className="size-4.5" aria-hidden />
            </IconButton>
          </div>
          <h2 className="text-center font-display text-[17px] font-semibold tracking-[-0.01em] text-ink sm:text-[19px]">
            {monthLabel(cursor.year, cursor.month)}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setCursor({ year: today.getFullYear(), month: today.getMonth() })
            }
            className="justify-self-end px-2.5"
          >
            Today
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {week.map((cell, ci) => (
                <DayCell
                  key={ci}
                  cell={cell}
                  selected={selectedDate}
                  onSelect={(date) => setView({ kind: "day", date })}
                />
              ))}
            </div>
          ))}
        </div>

        {/* legend */}
        <div className="mt-4 border-t border-line px-1 pt-3.5">
          <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
            What the colours mean
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2.5">
            <LegendItem
              swatch={
                <span
                  className="size-3.5 rounded-[5px]"
                  style={{ backgroundColor: PHASE_META.menstrual.color }}
                />
              }
              label="Logged period"
            />
            <LegendItem
              swatch={
                <span
                  className="size-3.5 rounded-[5px] border border-dashed"
                  style={{
                    borderColor: PHASE_META.menstrual.color,
                    backgroundColor: "rgba(232,168,184,0.35)",
                  }}
                />
              }
              label="Predicted period · estimate"
            />
            <LegendItem
              swatch={
                <span
                  className="relative grid size-3.5 place-items-center rounded-[5px]"
                  style={{
                    backgroundColor: "rgba(242,192,120,0.32)",
                    boxShadow: "inset 0 0 0 1px rgba(242,192,120,0.75)",
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: PHASE_META.ovulation.color }}
                  />
                </span>
              }
              label="Ovulation · estimate"
            />
            <LegendItem
              swatch={
                <span
                  className="size-3.5 rounded-[5px]"
                  style={{
                    backgroundColor: "rgba(242,192,120,0.16)",
                    boxShadow: "inset 0 0 0 1px rgba(242,192,120,0.55)",
                  }}
                />
              }
              label="Fertile window · estimate"
            />
            <LegendItem
              swatch={
                <span className="size-3.5 rounded-[5px] bg-card outline-2 outline-offset-1 outline-plum" />
              }
              label="Today"
            />
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
            Solid marks are things you logged. Everything outlined or dotted is
            a projection — an estimate, never a certainty.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------------- history */}
      <section className="animate-fade-up" style={{ animationDelay: "140ms" }}>
        <SectionHeading
          title="Cycle history"
          action={
            periods.length > 0 ? (
              <span className="text-[12.5px] font-medium text-ink-faint">
                {pluralize(periods.length, "period", "periods")}
              </span>
            ) : undefined
          }
        />

        {periods.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" aria-hidden />}
            title="No periods logged yet"
            description="Logged periods show up here with their dates, length and flow — and they power every prediction on this page."
            action={
              <Button size="sm" onClick={() => openNewPeriod(todayISO)}>
                <Plus className="size-4" aria-hidden />
                Log a period
              </Button>
            }
          />
        ) : (
          <Card className="divide-y divide-line p-0">
            {periods.map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => openEditPeriod(period)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-lavender-mist/60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-mist text-pink-deep">
                  <Droplet className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {periodRange(period)}
                  </span>
                  <span className="block text-[12.5px] text-ink-faint">
                    {periodDuration(period)} · {period.start_date.slice(0, 4)}
                  </span>
                </span>
                <Badge tone={period.flow ? "pink" : "neutral"} className="shrink-0">
                  {period.flow ? titleCase(period.flow) : "Flow not set"}
                </Badge>
              </button>
            ))}
          </Card>
        )}
      </section>

      {/* --------------------------------------------------- disclaimer */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <Callout kind="info">
          <strong>Estimates, not medical facts.</strong> Predicted period,
          ovulation and fertile-window markers are projections built from the
          dates you log and a typical 14-day luteal phase. They are not a
          diagnosis, not confirmation that ovulation occurred, and{" "}
          <strong>not a contraceptive method</strong>.
        </Callout>
      </div>

      {/* ================================================== day detail sheet */}
      <Sheet
        open={Boolean(dayView)}
        onClose={() => setView(null)}
        title={dayView ? formatDateLong(dayView.date) : "Day details"}
        footer={
          dayView && selectedDate ? (
            <div className="space-y-2">
              {dayPeriod ? (
                <Button
                  block
                  variant="secondary"
                  onClick={() => dayPeriod && openEditPeriod(dayPeriod)}
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit period
                </Button>
              ) : (
                <Button block onClick={() => openNewPeriod(selectedDate)}>
                  <Droplet className="size-4" aria-hidden />
                  Log period starting here
                </Button>
              )}
              <div className="flex gap-2">
                <Link href={`/check-in?date=${selectedDate}`} className="flex-1">
                  <Button block variant="outline">
                    <HeartPulse className="size-4" aria-hidden />
                    {dayLog ? "Edit check-in" : "Daily check-in"}
                  </Button>
                </Link>
                {dayPeriod && (
                  <Button
                    block
                    variant="danger"
                    onClick={() => {
                      setErrors({});
                      setView({ kind: "delete", period: dayPeriod, from: selectedDate });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {dayView && selectedInfo && (
          <div className="space-y-4">
            {/* cycle position */}
            <div
              className="rounded-3xl border p-4"
              style={
                selectedPhase
                  ? {
                      backgroundColor: selectedPhase.tint,
                      borderColor: `${selectedPhase.color}55`,
                    }
                  : {
                      backgroundColor: "var(--color-cream-deep)",
                      borderColor: "var(--color-line-strong)",
                    }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                    Cycle day
                  </p>
                  <p className="font-display text-[28px] font-semibold leading-tight text-ink">
                    {selectedInfo.cycleDay ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                    Phase
                  </p>
                  <p className="mt-1 flex items-center justify-end gap-1.5 text-[14.5px] font-semibold text-plum">
                    {selectedPhase && (
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: selectedPhase.color }}
                        aria-hidden
                      />
                    )}
                    {selectedPhase ? selectedPhase.label : "No estimate yet"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-plum/85">
                {selectedPhase
                  ? selectedPhase.blurb
                  : "Log a period start and Lunara can project this day's phase."}
              </p>
            </div>

            {/* markers */}
            <div className="flex flex-wrap gap-2">
              {selectedInfo.isToday && <Badge tone="lavender">Today</Badge>}
              {selectedInfo.actualPeriod && (
                <Badge tone="pink">
                  <Droplet className="size-3" aria-hidden />
                  Logged period day
                </Badge>
              )}
              {selectedInfo.predictedPeriod && (
                <Badge tone="neutral">Predicted period · estimate</Badge>
              )}
              {selectedInfo.ovulation && (
                <Badge tone="warning">
                  <Sparkles className="size-3" aria-hidden />
                  Estimated ovulation
                </Badge>
              )}
              {selectedInfo.fertile && (
                <Badge tone="warning">Estimated fertile day</Badge>
              )}
              {!selectedInfo.actualPeriod &&
                !selectedInfo.predictedPeriod &&
                !selectedInfo.ovulation &&
                !selectedInfo.fertile && (
                  <Badge tone="neutral">No period markers</Badge>
                )}
              {relativeDay(selectedInfo.date, today) !== "Today" && (
                <Badge tone="neutral">{relativeDay(selectedInfo.date, today)}</Badge>
              )}
            </div>

            {(selectedInfo.predictedPeriod ||
              selectedInfo.ovulation ||
              selectedInfo.fertile) && (
              <Callout kind="info">
                This marker is projected from the dates you've logged — an
                estimate of what to expect, not something confirmed.
              </Callout>
            )}

            {/* daily log summary */}
            <div className="rounded-3xl border border-line bg-card p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  Daily check-in
                </p>
                {parsedLog && <Badge tone="success">Logged</Badge>}
              </div>

              {parsedLog ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {parsedLog.mood_score ? (
                      <Badge tone="lavender">Mood {parsedLog.mood_score}/5</Badge>
                    ) : null}
                    {parsedLog.energy ? (
                      <Badge tone="lavender">Energy {parsedLog.energy}/5</Badge>
                    ) : null}
                    {parsedLog.sleep_quality ? (
                      <Badge tone="neutral">Sleep {parsedLog.sleep_quality}/5</Badge>
                    ) : null}
                    {parsedLog.water ? (
                      <Badge tone="neutral">Water {parsedLog.water} cups</Badge>
                    ) : null}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-ink">
                    {dayTags.length > 0
                      ? capList(dayTags, 6).join(", ")
                      : "No symptoms logged"}
                  </p>
                  {parsedLog.note && (
                    <p className="rounded-2xl bg-cream-deep px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                      {parsedLog.note}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[13.5px] leading-relaxed text-ink-soft">
                  No check-in for this date yet. A quick one helps your insights
                  take shape.
                </p>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* ================================================ period form sheet */}
      <Sheet
        open={view?.kind === "period"}
        onClose={() => setView(null)}
        title={view?.kind === "period" && view.period ? "Edit period" : "Log a period"}
        footer={
          view?.kind === "period" ? (
            <div className="space-y-2">
              <Button block loading={saving} onClick={submitPeriod}>
                Save period
              </Button>
              <Button block variant="ghost" onClick={() => setView(null)}>
                Cancel
              </Button>
            </div>
          ) : null
        }
      >
        {view?.kind === "period" && (
          <div className="space-y-4">
            {errors.form && <Callout kind="warn">{errors.form}</Callout>}

            <Field
              label="First day of bleeding"
              htmlFor="period-start"
              error={errors.start}
              hint="The day your flow began."
            >
              <Input
                id="period-start"
                type="date"
                max={todayISO}
                value={form.start}
                invalid={Boolean(errors.start)}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </Field>

            <Field
              label="Last day of bleeding"
              htmlFor="period-end"
              optional
              error={errors.end}
              hint={
                form.start
                  ? `From ${formatDate(form.start)}. Leave empty if it's still ongoing.`
                  : "Leave empty if it's still ongoing."
              }
            >
              <Input
                id="period-end"
                type="date"
                min={form.start || undefined}
                max={todayISO}
                value={form.end}
                invalid={Boolean(errors.end)}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </Field>

            <Field
              label="Flow"
              optional
              error={errors.flow}
              hint="How heavy it felt — you can change this later."
            >
              <div className="flex flex-wrap gap-2 pt-0.5">
                {FLOWS.map((flow) => (
                  <Chip
                    key={flow}
                    tone="pink"
                    active={form.flow === flow}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        flow: prev.flow === flow ? "" : flow,
                      }))
                    }
                  >
                    {titleCase(flow)}
                  </Chip>
                ))}
              </div>
            </Field>

            <p className="text-[12.5px] leading-relaxed text-ink-faint">
              Logged periods power every prediction on this page and stay private
              to your account.
            </p>
          </div>
        )}
      </Sheet>

      {/* ============================================== delete confirm sheet */}
      <Sheet
        open={view?.kind === "delete"}
        onClose={() => setView(null)}
        title="Delete period log?"
        footer={
          view?.kind === "delete" ? (
            <div className="space-y-2">
              <Button
                block
                variant="danger"
                loading={saving}
                onClick={() => confirmDelete(view.period.id)}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete log
              </Button>
              <Button
                block
                variant="ghost"
                onClick={() => setView({ kind: "day", date: view.from })}
              >
                Keep it
              </Button>
            </div>
          ) : null
        }
      >
        {view?.kind === "delete" && (
          <div className="space-y-3">
            <div className="rounded-3xl border border-line bg-card p-4">
              <p className="text-[14.5px] font-medium text-ink">
                {periodRange(view.period)}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-faint">
                {periodDuration(view.period)} ·{" "}
                {view.period.flow ? titleCase(view.period.flow) : "Flow not set"}
              </p>
            </div>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              This removes the log and recalculates your predictions from what's
              left. It can't be undone.
            </p>
            {errors.form && <Callout kind="warn">{errors.form}</Callout>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* =============================================================== day cell */

function DayCell({
  cell,
  selected,
  onSelect,
}: {
  cell: MonthCell;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const { date, info } = cell;
  if (!date || !info) {
    return <div className="aspect-square w-full" aria-hidden />;
  }

  const phase = info.phase ? PHASE_META[info.phase] : null;
  const isSelected = selected === info.date;

  let bg: string | undefined;
  let borderClass = "";
  let numberClass = info.isPast ? "text-ink-soft" : "text-ink";

  if (info.actualPeriod) {
    // Logged bleeding: solid dusty-pink fill.
    bg = PHASE_META.menstrual.color;
    numberClass = "font-semibold text-plum-deep";
  } else if (info.predictedPeriod) {
    // Projected bleeding: same pink, faded and dashed so it never reads as fact.
    bg = "rgba(232,168,184,0.35)";
    borderClass = "border border-dashed border-pink";
    numberClass = "font-medium text-plum";
  } else if (info.ovulation) {
    bg = "rgba(242,192,120,0.32)";
    borderClass = "border border-[#f2c078]/75";
    numberClass = "font-medium text-ink";
  } else if (info.fertile) {
    bg = "rgba(242,192,120,0.16)";
    borderClass = "border border-[#f2c078]/45";
    numberClass = "text-ink";
  } else if (phase) {
    // Subtle phase tint so the month reads as a gradient of the cycle.
    bg = withAlpha(phase.tint, 0.6);
  }

  if (info.isToday) numberClass = "font-semibold text-plum";

  const labels: string[] = [];
  if (info.actualPeriod) labels.push("logged period day");
  else if (info.predictedPeriod) labels.push("predicted period day, an estimate");
  if (info.ovulation) labels.push("estimated ovulation day");
  else if (info.fertile) labels.push("estimated fertile day");
  if (info.isToday) labels.push("today");
  if (info.cycleDay) labels.push(`cycle day ${info.cycleDay}`);

  return (
    <button
      type="button"
      onClick={() => onSelect(info.date)}
      aria-label={`${formatDateLong(info.date)}${
        labels.length > 0 ? `, ${labels.join(", ")}` : ""
      }`}
      aria-current={info.isToday ? "date" : undefined}
      className={cn(
        "relative flex aspect-square w-full items-center justify-center rounded-[14px] text-[13.5px] leading-none",
        "transition-transform duration-150 hover:scale-[1.06] active:scale-95",
        borderClass,
        numberClass,
        info.isToday && "outline-2 outline-offset-1 outline-plum",
        isSelected &&
          !info.isToday &&
          "shadow-[inset_0_0_0_1.5px_rgba(134,101,194,0.75)]",
      )}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <span>{date.getDate()}</span>
      {info.ovulation && (
        <span
          className="absolute bottom-1.5 size-1.5 rounded-full"
          style={{ backgroundColor: PHASE_META.ovulation.color }}
          aria-hidden
        />
      )}
    </button>
  );
}

/* ================================================================ legend */

function LegendItem({
  swatch,
  label,
}: {
  swatch: React.ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
      <span className="grid shrink-0 place-items-center">{swatch}</span>
      {label}
    </li>
  );
}
