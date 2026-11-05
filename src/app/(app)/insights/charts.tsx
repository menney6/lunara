"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Moon } from "lucide-react";
import { PHASE_META } from "@/lib/cycle";
import type { Phase } from "@/lib/types";
import { Badge, Card, Segmented } from "@/components/ui";

/* =========================================================================
   Insights charts — every recharts consumer lives here (client-only).
   All series are pre-computed by the server page and passed in as plain
   serialisable data. Each chart guards against empty input so it can never
   render a crash, only a friendly placeholder.
   ========================================================================= */

export interface ChartDatum {
  label: string;
  value: number;
}

export interface SymptomDatum {
  name: string;
  count: number;
}

export interface PhaseDatum {
  phase: Phase;
  label: string;
  color: string;
  avg: number | null;
  n: number;
}

export interface MoodPoint {
  label: string;
  mood: number;
}

export interface BinDatum {
  label: string;
  count: number;
}

/* ------------------------------------------------------------ chart tokens */

const TICK = { fontSize: 10.5, fill: "#9d96a4" } as const;
const AXIS_LINE = { stroke: "#f1e6e1" } as const;
const GRID = { stroke: "#f1e6e1", strokeDasharray: "4 4", vertical: false } as const;
const GRID_H = { stroke: "#f1e6e1", strokeDasharray: "4 4", horizontal: false } as const;
const Y_AXIS = { axisLine: false, tickLine: false, tick: TICK } as const;

const AXIS_TEXT = { fontSize: 10, fill: "#9d96a4" } as const;

function xTitle(value: string) {
  return { value, position: "bottom" as const, style: AXIS_TEXT };
}

function yTitle(value: string) {
  return { value, angle: -90 as const, position: "insideLeft" as const, offset: 6, style: AXIS_TEXT };
}

/* --------------------------------------------------------------- tooltip */

interface TipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: TipEntry[];
}

function BrandTooltip({ active, label, payload }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      {label !== undefined && (
        <p className="mb-0.5 text-[11.5px] font-medium text-ink-faint">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          {entry.color ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
          ) : null}
          <span>{entry.name ?? "Value"}:</span>
          <span className="font-semibold text-plum">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- placeholder */

function ChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="grid h-[180px] place-items-center rounded-2xl border border-dashed border-line-strong bg-cream-deep/60 px-6 text-center">
      <p className="max-w-[30ch] text-[13px] leading-relaxed text-ink-faint">{message}</p>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{children}</p>;
}

/* ==================================================== cycle trends (range) */

type Range = "3" | "6" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "3", label: "Last 3" },
  { value: "6", label: "Last 6" },
  { value: "all", label: "All time" },
];

function takeLast<T>(items: T[], range: Range): T[] {
  if (range === "all") return items;
  return items.slice(-Number(range));
}

export function InsightsTrends({
  gaps,
  durations,
  average,
  durationAvg,
}: {
  gaps: ChartDatum[];
  durations: ChartDatum[];
  average: number | null;
  durationAvg: number | null;
}) {
  const [range, setRange] = useState<Range>("all");
  const gapSlice = takeLast(gaps, range);
  const durSlice = takeLast(durations, range);

  let gapDomain: [number, number] | undefined;
  if (gapSlice.length > 0) {
    const values = gapSlice.map((p) => p.value);
    const lo = Math.min(...values, average ?? Number.MAX_SAFE_INTEGER);
    const hi = Math.max(...values, average ?? Number.MIN_SAFE_INTEGER);
    gapDomain = [Math.max(0, lo - 3), hi + 3];
  }

  let durDomain: [number, number] | undefined;
  if (durSlice.length > 0) {
    const values = durSlice.map((p) => p.value);
    durDomain = [0, Math.max(...values, durationAvg ?? 0) + 1];
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Cycle trends</h3>
        <Badge tone="lavender">
          {gapSlice.length} of {gaps.length} cycle{gaps.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} className="mt-3 w-full" />

      {/* -------------------------------------------------- cycle length */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
          Cycle length
        </p>
        {average !== null && <Badge tone="lavender">Avg {average} days</Badge>}
      </div>

      {gapSlice.length === 0 || !gapDomain ? (
        <div className="mt-2">
          <ChartPlaceholder message="Log two period starts and each cycle's length will plot here." />
        </div>
      ) : (
        <div className="mt-1">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={gapSlice} margin={{ top: 14, right: 12, bottom: 28, left: 4 }}>
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="label"
                tick={TICK}
                axisLine={AXIS_LINE}
                tickLine={false}
                label={xTitle("Cycle #")}
              />
              <YAxis
                {...Y_AXIS}
                width={42}
                domain={gapDomain}
                label={yTitle("Days")}
              />
              <Tooltip content={<BrandTooltip />} cursor={{ stroke: "#cdbbe9", strokeDasharray: "4 4" }} />
              {average !== null && (
                <ReferenceLine
                  y={average}
                  stroke="#e8a8b8"
                  strokeDasharray="6 4"
                  label={{
                    value: `Avg ${average}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#d18498",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                name="Cycle length"
                stroke="#a98bd4"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#a98bd4", stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <Note>
        Each dot is the number of days between one period start and the next. Small ups and
        downs are completely expected — this is a record of what you logged, not a verdict on
        your health.
      </Note>

      <div className="my-4 border-t border-line" />

      {/* ----------------------------------------------- period duration */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
          Period duration
        </p>
        {durationAvg !== null && <Badge tone="pink">Avg {durationAvg} days</Badge>}
      </div>

      {durSlice.length === 0 || !durDomain ? (
        <div className="mt-2">
          <ChartPlaceholder message="Add an end date to a logged period and its bleeding days plot here." />
        </div>
      ) : (
        <div className="mt-1">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={durSlice} margin={{ top: 14, right: 12, bottom: 28, left: 4 }}>
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="label"
                tick={TICK}
                axisLine={AXIS_LINE}
                tickLine={false}
                label={xTitle("Cycle #")}
              />
              <YAxis {...Y_AXIS} width={42} domain={durDomain} label={yTitle("Days")} />
              <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(169,139,212,0.10)" }} />
              <Bar
                dataKey="value"
                name="Bleeding days"
                fill="#e8a8b8"
                radius={[8, 8, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <Note>
        How many days of bleeding you recorded for each period. Bleeding length can shift with
        stress, sleep and travel — the chart simply reflects the days you logged.
      </Note>
    </Card>
  );
}

/* ======================================================== symptom frequency */

export function SymptomChart({ data }: { data: SymptomDatum[] }) {
  if (data.length === 0) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Symptom frequency</h3>
        <div className="mt-3">
          <ChartPlaceholder message="Tick a physical symptom in your check-in and it will appear here." />
        </div>
      </Card>
    );
  }

  const height = Math.min(240, Math.max(180, data.length * 27));

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Symptom frequency</h3>
        <Badge tone="lavender">Top {data.length}</Badge>
      </div>

      <div className="mt-2">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
            <CartesianGrid {...GRID_H} />
            <XAxis type="number" hide allowDecimals={false} domain={[0, "auto"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={102}
              tick={{ fontSize: 11, fill: "#6a6371" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(169,139,212,0.10)" }} />
            <Bar
              dataKey="count"
              name="Days logged"
              fill="#a98bd4"
              radius={[0, 8, 8, 0]}
              barSize={14}
              maxBarSize={16}
              label={{ position: "right", fontSize: 11, fill: "#9d96a4" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">Bar length = number of check-ins</p>
      <Note>
        A tally of the physical symptoms you have ticked across your check-ins. It counts your
        own entries — useful to bring to a clinician, but it is not a diagnosis.
      </Note>
    </Card>
  );
}

/* ============================================================= mood (hero) */

export function MoodSection({ phaseData, trend }: { phaseData: PhaseDatum[]; trend: MoodPoint[] }) {
  const charted = phaseData.filter((d) => d.avg !== null);
  const totalLogged = phaseData.reduce((sum, d) => sum + d.n, 0);
  const hasPhase = charted.length > 0;
  const hasTrend = trend.length > 0;

  if (!hasPhase && !hasTrend) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Mood patterns</h3>
        <div className="mt-3">
          <ChartPlaceholder message="Log a mood score in your check-in and your patterns show up here." />
        </div>
      </Card>
    );
  }

  return (
    <Card className="gradient-warm border-lavender-soft p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/85 text-lavender-deep shadow-soft">
            <Moon className="size-[17px]" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-[16.5px] font-semibold text-ink">
              Mood across your cycle
            </h3>
            <p className="text-[12px] text-ink-faint">Average check-in score, 1–5</p>
          </div>
        </div>
        <Badge tone="pink">Highlight</Badge>
      </div>

      {hasPhase ? (
        <>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={charted} margin={{ top: 18, right: 10, bottom: 6, left: 4 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#6a6371" }}
                  axisLine={AXIS_LINE}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  {...Y_AXIS}
                  width={42}
                  domain={[0, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  label={yTitle("Mood")}
                />
                <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(169,139,212,0.10)" }} />
                <Bar
                  dataKey="avg"
                  name="Average mood"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                  label={{ position: "top", fontSize: 11, fontWeight: 600, fill: "#68466f" }}
                >
                  {charted.map((d) => (
                    <Cell key={d.phase} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {phaseData.map((d) => (
              <div
                key={d.phase}
                className="rounded-xl border border-line bg-white/75 px-1.5 py-2 text-center"
              >
                <span
                  className="mx-auto mb-1 block size-1.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <p className="font-display text-[15px] font-semibold leading-none text-ink">
                  {d.avg !== null ? d.avg.toFixed(1) : "—"}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-ink-faint">{d.label}</p>
              </div>
            ))}
          </div>

          <Note>
            Mood scores averaged for the {totalLogged} check-ins that had both a score and a
            known cycle day. Phases are estimated from your logged period dates, so read this
            as a gentle observation of how you have felt across your cycle — not a hormonal
            measurement.
          </Note>
        </>
      ) : (
        <>
          <div className="mt-3">
            <ChartPlaceholder message="Log a period start and your mood scores will group themselves by cycle phase." />
          </div>
          <Note>
            Phase averages need at least one logged period start so each check-in can be placed
            inside a cycle.
          </Note>
        </>
      )}

      {hasTrend && (
        <>
          <div className="my-4 border-t border-lavender-soft/70" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-plum/70">
              Last 30 days
            </p>
            <Badge tone="lavender">{trend.length} check-ins</Badge>
          </div>
          <div className="mt-1">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trend} margin={{ top: 14, right: 12, bottom: 28, left: 4 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#9d96a4" }}
                  axisLine={AXIS_LINE}
                  tickLine={false}
                  minTickGap={28}
                  label={xTitle("Date")}
                />
                <YAxis
                  {...Y_AXIS}
                  width={42}
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  label={yTitle("Mood")}
                />
                <Tooltip content={<BrandTooltip />} cursor={{ stroke: "#cdbbe9", strokeDasharray: "4 4" }} />
                <Line
                  type="monotone"
                  dataKey="mood"
                  name="Mood"
                  stroke="#68466f"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#68466f", stroke: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Note>
            Your mood score on each of the last 30 days you checked in. A gap means no check-in
            was recorded that day — a quiet patch, not a low mood.
          </Note>
        </>
      )}
    </Card>
  );
}

/* ============================================================ regularity */

export function RegularityChart({
  bins,
  variability,
}: {
  bins: BinDatum[];
  variability: number | null;
}) {
  if (bins.length === 0) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Cycle regularity</h3>
        <div className="mt-3">
          <ChartPlaceholder message="Once two cycles are logged, their spread appears here." />
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[16.5px] font-semibold text-ink">Cycle regularity</h3>
        {variability !== null && <Badge tone="success">±{variability} days</Badge>}
      </div>

      {variability !== null && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-[30px] font-semibold leading-none text-plum">
            ±{variability}
          </span>
          <span className="text-[13px] leading-snug text-ink-soft">
            days of spread between your
            <br />
            logged cycle lengths
          </span>
        </div>
      )}

      <div className="mt-3">
        <ResponsiveContainer width="100%" height={185}>
          <BarChart data={bins} margin={{ top: 14, right: 12, bottom: 28, left: 4 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9d96a4" }}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval={0}
              label={xTitle("Days between starts")}
            />
            <YAxis
              {...Y_AXIS}
              width={42}
              allowDecimals={false}
              domain={[0, maxCount + 1]}
              label={yTitle("Cycles")}
            />
            <Tooltip content={<BrandTooltip />} cursor={{ fill: "rgba(242,192,120,0.18)" }} />
            <Bar dataKey="count" name="Cycles" fill="#f2c078" radius={[8, 8, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Note>
        Each bar counts how many of your cycles fell in that length range. A tight cluster means
        your logged cycles have been similar in length; a wider spread simply means they have
        varied more. Cycle length naturally moves for many ordinary reasons.
      </Note>
    </Card>
  );
}
