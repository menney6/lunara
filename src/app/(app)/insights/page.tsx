import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, CalendarDays, Droplets, LineChart, Sparkles, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getSettings, listPeriods, recentLogs } from "@/lib/queries";
import {
  PHASE_META,
  addDays,
  averagePeriodLength,
  diffDays,
  parseISO,
  phaseForDay,
  summariseCycles,
  toISO,
} from "@/lib/cycle";
import { formatDayMonth, pluralize } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button, Callout, Card, EmptyState } from "@/components/ui";
import {
  InsightsTrends,
  MoodSection,
  RegularityChart,
  SymptomChart,
  type BinDatum,
  type ChartDatum,
  type MoodPoint,
  type PhaseDatum,
  type SymptomDatum,
} from "./charts";
import type { Phase } from "@/lib/types";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------- utilities */

/** Defensive JSON-array reader — the `physical` column may hold anything. */
function parseTagList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Observation wording only — never a diagnosis. */
function regularityFor(variability: number | null): { value: string; sub: string } {
  if (variability === null) {
    return { value: "Not enough data", sub: "Log 3+ cycles to see your spread" };
  }
  const sub = `±${variability} days between logged cycles`;
  if (variability <= 2) return { value: "Very regular", sub };
  if (variability <= 4) return { value: "Regular", sub };
  if (variability <= 6) return { value: "Somewhat irregular", sub };
  return { value: "Irregular", sub };
}

/** Histogram of cycle gaps, bucketed into at most ~6 friendly ranges. */
function buildBins(gaps: number[]): BinDatum[] {
  if (gaps.length === 0) return [];
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  const width = Math.max(1, Math.ceil((max - min + 1) / 5));
  const buckets = new Map<number, number>();
  for (const g of gaps) {
    const key = Math.floor(g / width) * width;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, count]) => ({
      label: width === 1 ? String(start) : `${start}–${start + width - 1}`,
      count,
    }));
}

/* ------------------------------------------------------------------ page */

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user.id);
  const periods = await listPeriods(user.id);
  const logs = await recentLogs(user.id, 400);
  const today = new Date();
  const todayISO = toISO(today);

  const summary = summariseCycles(
    periods.map((p) => ({ start_date: p.start_date, end_date: p.end_date })),
  );

  const sortedPeriods = [...periods].sort((a, b) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
  );

  /* ------------------------------------------------------ chart series */

  const gapPoints: ChartDatum[] = summary.gaps.map((days, i) => ({
    label: `#${i + 1}`,
    value: days,
  }));

  const durationPoints: ChartDatum[] = [];
  sortedPeriods.forEach((p, i) => {
    if (!p.end_date) return;
    const days = diffDays(parseISO(p.end_date), parseISO(p.start_date)) + 1;
    if (days >= 1 && days <= 15) durationPoints.push({ label: `#${i + 1}`, value: days });
  });

  const periodAvg = averagePeriodLength(periods);

  /* ------------------------------------------------------ symptom counts */

  const symptomCounts = new Map<string, number>();
  for (const log of logs) {
    for (const symptom of parseTagList(log.physical)) {
      symptomCounts.set(symptom, (symptomCounts.get(symptom) ?? 0) + 1);
    }
  }
  const symptoms: SymptomDatum[] = [...symptomCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name, count]) => ({
      name: name.length > 16 ? `${name.slice(0, 15)}…` : name,
      count,
    }));

  /* ------------------------------------------------- mood by cycle phase */

  interface LoggedCycle {
    start: string;
    next: string | null;
    length: number;
    periodLength: number;
  }

  const fallbackCycle = summary.average ?? settings.cycle_length;
  const cycleMeta: LoggedCycle[] = sortedPeriods.map((p, i) => {
    const next = i + 1 < sortedPeriods.length ? sortedPeriods[i + 1].start_date : null;
    const gap = next ? diffDays(parseISO(next), parseISO(p.start_date)) : null;
    const length = gap !== null && gap >= 15 && gap <= 60 ? gap : fallbackCycle;
    const duration = p.end_date
      ? diffDays(parseISO(p.end_date), parseISO(p.start_date)) + 1
      : null;
    const periodLength =
      duration !== null && duration >= 1 && duration <= 15 ? duration : settings.period_length;
    return { start: p.start_date, next, length, periodLength };
  });

  /** Phase of a logged date, derived from the real period interval it falls in. */
  function phaseOn(date: string): Phase | null {
    let match: LoggedCycle | null = null;
    for (const c of cycleMeta) {
      if (c.start > date) break;
      if (c.next === null || date < c.next) match = c;
    }
    if (!match) return null;
    const day = diffDays(parseISO(date), parseISO(match.start)) + 1;
    if (day < 1 || day > 90) return null;
    return phaseForDay(day, match.length, match.periodLength);
  }

  const phaseTotals: Record<Phase, { sum: number; n: number }> = {
    menstrual: { sum: 0, n: 0 },
    follicular: { sum: 0, n: 0 },
    ovulation: { sum: 0, n: 0 },
    luteal: { sum: 0, n: 0 },
  };
  for (const log of logs) {
    if (log.mood_score === null || log.mood_score === undefined) continue;
    const score = Number(log.mood_score);
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;
    const phase = phaseOn(log.date);
    if (!phase) continue;
    phaseTotals[phase].sum += score;
    phaseTotals[phase].n += 1;
  }

  const phaseOrder: Phase[] = ["menstrual", "follicular", "ovulation", "luteal"];
  const phaseData: PhaseDatum[] = phaseOrder.map((phase) => {
    const { sum, n } = phaseTotals[phase];
    return {
      phase,
      label: PHASE_META[phase].short,
      color: PHASE_META[phase].color,
      avg: n > 0 ? Math.round((sum / n) * 10) / 10 : null,
      n,
    };
  });

  /* --------------------------------------------------- mood trend (30d) */

  const from30 = toISO(addDays(today, -30));
  const moodTrend: MoodPoint[] = logs
    .filter((l) => l.date >= from30 && l.date <= todayISO && l.mood_score !== null)
    .map((l) => ({ date: l.date, label: formatDayMonth(l.date), mood: Number(l.mood_score) }))
    .filter((p) => Number.isFinite(p.mood) && p.mood >= 1 && p.mood <= 5)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(({ label, mood }) => ({ label, mood }));

  /* ------------------------------------------------------------- stats */

  const bins = buildBins(summary.gaps);
  const regularity = regularityFor(summary.variability);
  const cycleCount = summary.gaps.length;
  const avgCycle = summary.average ?? settings.cycle_length;
  const avgPeriod = periodAvg ?? settings.period_length;

  const recentGaps = summary.gaps.slice(-3);
  const recentAvg = recentGaps.length
    ? Math.round(recentGaps.reduce((sum, g) => sum + g, 0) / recentGaps.length)
    : null;
  const comparison =
    recentGaps.length >= 2 && summary.average !== null && recentAvg !== null
      ? {
          n: recentGaps.length,
          recent: recentAvg,
          overall: summary.average,
          diff: recentAvg - summary.average,
        }
      : null;

  const comparisonLine = !comparison
    ? ""
    : comparison.diff === 0
      ? `Your last ${pluralize(comparison.n, "cycle")} averaged ${comparison.recent} days — right in line with your ${comparison.overall}-day overall average.`
      : `Your last ${pluralize(comparison.n, "cycle")} averaged ${comparison.recent} days — ${Math.abs(comparison.diff)} day${Math.abs(comparison.diff) === 1 ? "" : "s"} ${comparison.diff > 0 ? "longer" : "shorter"} than your ${comparison.overall}-day overall average.`;

  const enoughPeriods = periods.length >= 2;
  const hasSymptoms = symptoms.length > 0;
  const hasMood = phaseData.some((d) => d.avg !== null) || moodTrend.length > 0;

  const stagger = (ms: number) => ({ animationDelay: `${ms}ms` });

  /* --------------------------------------------------------------- view */

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights & analytics"
        title="Your patterns, in plain language"
        subtitle="Charts built from the periods and check-ins you have logged — each one explained in a sentence or two."
      />

      <Callout kind="info" className="animate-fade-up">
        Everything here is an <strong>observation of your own logged data</strong> — not medical
        advice, a diagnosis, or a form of contraception. Cycle patterns shift for many ordinary
        reasons. If something concerns you, speak with a healthcare professional.
      </Callout>

      {/* ------------------------------------------------------ stat row */}
      <section className="grid grid-cols-2 gap-3" aria-label="Summary statistics">
        <StatCard
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Avg cycle length"
          value={`${avgCycle} days`}
          sub={summary.average !== null ? `across ${pluralize(cycleCount, "logged cycle")}` : "from your onboarding estimate"}
          tone="lavender"
          delay={0}
        />
        <StatCard
          icon={<Droplets className="size-4" aria-hidden />}
          label="Avg period"
          value={`${avgPeriod} days`}
          sub={periodAvg !== null ? "average days of bleeding" : "from your onboarding estimate"}
          tone="pink"
          delay={60}
        />
        <StatCard
          icon={<Activity className="size-4" aria-hidden />}
          label="Regularity"
          value={regularity.value}
          sub={regularity.sub}
          tone="amber"
          delay={120}
        />
        <StatCard
          icon={<LineChart className="size-4" aria-hidden />}
          label="Cycles logged"
          value={String(cycleCount)}
          sub={
            cycleCount > 0
              ? "complete cycles between starts"
              : "log a second period to start"
          }
          tone="lavender"
          delay={180}
        />
      </section>

      {/* -------------------------------------------- cycle trends / empty */}
      {enoughPeriods ? (
        <div className="animate-fade-up" style={stagger(240)}>
          <InsightsTrends
            gaps={gapPoints}
            durations={durationPoints}
            average={summary.average}
            durationAvg={periodAvg}
          />
        </div>
      ) : (
        <div className="animate-fade-up" style={stagger(240)}>
          <EmptyState
            icon={<Sparkles className="size-5" aria-hidden />}
            title="Insights grow with your history"
            description="Once you have logged a couple of period starts, Lunara charts your cycle length, duration and regularity here. Symptoms and mood patterns appear as soon as you have a few check-ins."
            action={
              <Link href="/calendar">
                <Button size="sm">Log a period</Button>
              </Link>
            }
          />
        </div>
      )}

      {/* -------------------------------------------------------- symptoms */}
      {hasSymptoms && (
        <div className="animate-fade-up" style={stagger(300)}>
          <SymptomChart data={symptoms} />
        </div>
      )}

      {/* ------------------------------------------------------------- mood */}
      {hasMood && (
        <div className="animate-fade-up" style={stagger(360)}>
          <MoodSection phaseData={phaseData} trend={moodTrend} />
        </div>
      )}

      {/* ------------------------------------------------------ regularity */}
      {bins.length > 0 && (
        <div className="animate-fade-up" style={stagger(420)}>
          <RegularityChart bins={bins} variability={summary.variability} />
        </div>
      )}

      {/* ------------------------------------------------------ comparison */}
      {comparison && (
        <Card
          className="gradient-warm animate-fade-up border-lavender-soft p-4 sm:p-5"
          style={stagger(480)}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/85 text-lavender-deep shadow-soft">
              <TrendingUp className="size-[17px]" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-[16.5px] font-semibold text-ink">
                Recent vs overall
              </h3>
              <p className="text-[12px] text-ink-faint">How your latest cycles are tracking</p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11.5px] font-medium uppercase tracking-[0.07em] text-ink-faint">
                Last {comparison.n} cycles
              </p>
              <p className="font-display text-[32px] font-semibold leading-none text-plum">
                {comparison.recent}
                <span className="ml-1 text-[14px] font-medium">days</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.07em] text-ink-faint">
                Overall average
              </p>
              <p className="font-display text-[32px] font-semibold leading-none text-ink">
                {comparison.overall}
                <span className="ml-1 text-[14px] font-medium">days</span>
              </p>
            </div>
          </div>

          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{comparisonLine}</p>
        </Card>
      )}

      <Callout kind="info" className="animate-fade-up">
        Phases, ovulation dates and averages on this page are estimates computed from the dates
        you logged. They describe your history — they do not predict or confirm ovulation, and
        they are never a substitute for medical advice.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------ stat cards */

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "lavender" | "pink" | "amber";
  delay: number;
}) {
  const bg =
    tone === "pink"
      ? "bg-pink-mist text-pink-deep"
      : tone === "amber"
        ? "bg-warning-soft text-warning"
        : "bg-lavender-mist text-lavender-deep";
  return (
    <Card className="animate-fade-up p-4" style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid size-9 place-items-center rounded-full ${bg}`}>{icon}</span>
      <p className="mt-2.5 text-[11.5px] font-medium uppercase tracking-[0.07em] text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-ink">
        {value}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{sub}</p>
    </Card>
  );
}
