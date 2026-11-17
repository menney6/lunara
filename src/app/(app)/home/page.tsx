import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  Droplets,
  HeartPulse,
  Moon,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import {
  getCycleStateFor,
  getLog,
  getSettings,
  listPeriods,
  recentLogs,
} from "@/lib/queries";
import { PHASE_META, toISO } from "@/lib/cycle";
import { capList, formatDate } from "@/lib/format";
import { CycleRing, PhaseLegend } from "@/components/cycle-ring";
import { Badge, Button, Callout, Card, SectionHeading } from "@/components/ui";
import type { DailyLog, ParsedDailyLog } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function parseLog(log: DailyLog): ParsedDailyLog {
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
    discharge: log.discharge,
    sleep_quality: log.sleep_quality,
    energy: log.energy,
    sexual_activity: log.sexual_activity,
    exercise: log.exercise,
    water: log.water,
    mood_score: log.mood_score,
    note: log.note ?? "",
  };
}

/** Phase-aware guidance — educational, never diagnostic. */
function insightFor(phase: string, checkedIn: boolean): { title: string; body: string } {
  if (checkedIn) {
    return {
      title: "You're all checked in",
      body: "Come back tomorrow — or review how today compares in Insights.",
    };
  }
  switch (phase) {
    case "menstrual":
      return {
        title: "Rest is productive too",
        body: "Iron and temperature can dip during bleeding. Warmth, hydration and easy movement all help many people.",
      };
    case "follicular":
      return {
        title: "Energy is usually building",
        body: "Rising oestrogen often brings better mood and stamina — a good window for demanding tasks.",
      };
    case "ovulation":
      return {
        title: "Your most fertile days",
        body: "This is an estimate based on your cycle length, not a confirmation that ovulation occurred.",
      };
    default:
      return {
        title: "Progesterone is on the rise",
        body: "Bloating, appetite changes and mood shifts are common now. Tracking makes the pattern easier to predict.",
      };
  }
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user.id);
  const state = await getCycleStateFor(user.id);
  const periods = await listPeriods(user.id);
  const todayISO = toISO(new Date());
  const log = await getLog(user.id, todayISO);
  const parsed = log ? parseLog(log) : null;
  const recent = await recentLogs(user.id, 5);

  const name = settings.display_name || user.name || "there";
  const phase = state ? PHASE_META[state.phase] : null;
  const insight = state ? insightFor(state.phase, Boolean(log)) : null;

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------------- greeting */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-soft">{greeting()},</p>
          <h1 className="truncate font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {name}
          </h1>
        </div>
        <Link
          href="/profile"
          aria-label="Open profile"
          className="grid size-11 shrink-0 place-items-center rounded-full gradient-brand font-display text-[15px] font-semibold text-white shadow-soft transition hover:brightness-[1.05]"
        >
          {name.charAt(0).toUpperCase()}
        </Link>
      </header>

      {state && phase ? (
        <>
          {/* ---------------------------------------------------- cycle ring */}
          <Card className="relative overflow-hidden rounded-[28px] p-5">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 size-52 rounded-full opacity-70 blur-2xl"
              style={{ backgroundColor: phase.tint }}
            />
            <div className="relative">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12.5px] font-medium uppercase tracking-[0.09em] text-ink-faint">
                  Your cycle
                </span>
                <Badge tone="lavender">
                  {state.confidence === "high"
                    ? "Strong estimate"
                    : state.confidence === "moderate"
                      ? "Estimate"
                      : "Rough estimate"}
                </Badge>
              </div>

              <CycleRing state={state} className="my-2" />

              <PhaseLegend active={state.phase} />
            </div>
          </Card>

          {/* -------------------------------------------------------- stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<CalendarCheck2 className="size-4" aria-hidden />}
              label="Next period"
              value={formatDate(state.nextPeriod)}
              sub={
                state.daysUntilPeriod === 0
                  ? "Expected today"
                  : `in ${state.daysUntilPeriod} day${state.daysUntilPeriod === 1 ? "" : "s"}`
              }
              tone="pink"
            />
            <StatCard
              icon={<Sparkles className="size-4" aria-hidden />}
              label="Ovulation"
              value={formatDate(state.ovulation)}
              sub="estimated"
              tone="lavender"
            />
          </div>

          <Card className="flex items-center gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
              <Droplets className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium uppercase tracking-[0.07em] text-ink-faint">
                Fertile window
              </p>
              <p className="truncate text-[15px] font-semibold text-ink">
                {formatDate(state.fertileStart)} – {formatDate(state.fertileEnd)}
              </p>
            </div>
            {state.isFertile && <Badge tone="warning">Now</Badge>}
          </Card>

          {/* ------------------------------------------------ phase blurb */}
          <div
            className="rounded-[24px] border p-4"
            style={{ backgroundColor: phase.tint, borderColor: `${phase.color}55` }}
          >
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
              <span className="text-[13px] font-semibold text-plum">
                {phase.label} phase · day {state.cycleDay}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-plum/85">{phase.blurb}</p>
          </div>

          {/* --------------------------------------------------- daily insight */}
          {insight && (
            <Card>
              <SectionHeading
                title="Today's insight"
                action={
                  <Link
                    href="/learn"
                    className="text-[12.5px] font-medium text-lavender-deep hover:text-plum"
                  >
                    Learn more
                  </Link>
                }
              />
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
                  <Sun className="size-[17px]" aria-hidden />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">{insight.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{insight.body}</p>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <EmptyCycle />
      )}

      {/* ---------------------------------------------------------- check-in */}
      <Card className="gradient-plum relative overflow-hidden rounded-[28px] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/12 blur-xl"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-medium uppercase tracking-[0.09em] text-white/70">
                Daily check-in
              </p>
              <h2 className="mt-1 font-display text-[19px] font-semibold leading-snug">
                {log ? "You've checked in today" : "How are you feeling today?"}
              </h2>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/18">
              {log ? (
                <Moon className="size-[18px]" aria-hidden />
              ) : (
                <HeartPulse className="size-[18px]" aria-hidden />
              )}
            </span>
          </div>

          {parsed && (parsed.physical.length > 0 || parsed.emotional.length > 0) ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">
              Logged:{" "}
              {capList([...parsed.emotional, ...parsed.physical], 4).join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/80">
              Symptoms, mood, sleep and energy — it takes about thirty seconds.
            </p>
          )}

          <Link href="/check-in" className="mt-4 block">
            <Button
              block
              className="bg-white text-plum hover:bg-white/92 shadow-[0_10px_26px_-14px_rgba(0,0,0,0.6)]"
            >
              {log ? "Edit today's log" : "Start check-in"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </Card>

      {/* --------------------------------------------------- quick logging */}
      <section>
        <SectionHeading title="Log in one tap" />
        <div className="flex flex-wrap gap-2.5">
          {[
            { label: "Cramps", query: "physical=Cramps", icon: Zap },
            { label: "Low mood", query: "emotional=Sad", icon: Moon },
            { label: "Good energy", query: "energy=5", icon: Sun },
            { label: "Water", query: "water=8", icon: Droplets },
          ].map((q) => (
            <Link key={q.label} href={`/check-in?${q.query}`}>
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13.5px] font-medium text-ink-soft transition hover:border-lavender hover:text-plum">
                <q.icon className="size-4 text-lavender-deep" aria-hidden />
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- recent */}
      <section>
        <SectionHeading
          title="Recent check-ins"
          action={
            <Link href="/insights" className="text-[12.5px] font-medium text-lavender-deep hover:text-plum">
              View insights
            </Link>
          }
        />
        {recent.length > 0 ? (
          <Card className="divide-y divide-line p-0">
            {recent.map((row) => {
              const p = parseLog(row);
              const tags = [...p.emotional, ...p.physical];
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="w-[62px] shrink-0 text-[13px] font-medium text-ink-soft">
                    {formatDate(row.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {tags.length > 0 ? capList(tags, 3).join(", ") : "No symptoms logged"}
                  </span>
                  {p.mood_score && (
                    <span className="shrink-0 rounded-full bg-pink-mist px-2.5 py-1 text-[11.5px] font-medium text-plum">
                      Mood {p.mood_score}/5
                    </span>
                  )}
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="py-6 text-center">
            <p className="text-[13.5px] text-ink-soft">
              No check-ins yet. Your first one starts the pattern.
            </p>
            <Link href="/check-in" className="mt-3 inline-block">
              <Button size="sm" variant="secondary">
                Check in now
              </Button>
            </Link>
          </Card>
        )}
      </section>

      <Callout kind="info">
        Predictions are estimates built from the dates you log and a typical
        14-day luteal phase. They are <strong>not medical facts</strong> and must
        never be used as contraception or to confirm ovulation.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------ sub-blocks */

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "pink" | "lavender";
}) {
  const bg = tone === "pink" ? "bg-pink-mist text-pink-deep" : "bg-lavender-mist text-lavender-deep";
  return (
    <Card className="p-4">
      <span className={`grid size-9 place-items-center rounded-full ${bg}`}>{icon}</span>
      <p className="mt-2.5 text-[12px] font-medium uppercase tracking-[0.07em] text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 font-display text-[19px] font-semibold leading-tight text-ink">
        {value}
      </p>
      <p className="text-[12.5px] text-ink-soft">{sub}</p>
    </Card>
  );
}

function EmptyCycle() {
  return (
    <Card className="rounded-[28px] py-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
        <CalendarCheck2 className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-[19px] font-semibold text-ink">
        Add your last period
      </h2>
      <p className="mx-auto mt-1.5 max-w-[32ch] text-[13.5px] leading-relaxed text-ink-soft">
        Once you log a period start, Lunara can project your cycle, ovulation
        and fertile window.
      </p>
      <Link href="/calendar" className="mt-5 inline-block">
        <Button>Open calendar</Button>
      </Link>
    </Card>
  );
}
