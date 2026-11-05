import type {
  CycleProfile,
  CycleState,
  Phase,
  PregnancyRecord,
  Regularity,
} from "./types";

/* =========================================================================
   Lunara cycle engine
   -------------------------------------------------------------------------
   Everything here produces ESTIMATES derived from dates the user logged.
   Ovulation and fertile-window output is a statistical projection built on a
   typical 14-day luteal phase — it is never a medical fact and must never be
   presented as contraception or pregnancy prevention.
   ========================================================================= */

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

export const MIN_CYCLE_LENGTH = 18;
export const MAX_CYCLE_LENGTH = 60;
export const MIN_PERIOD_LENGTH = 1;
export const MAX_PERIOD_LENGTH = 15;

/** Typical luteal phase length used to project ovulation backwards from the
 *  next period. This is the standard population assumption. */
export const LUTEAL_PHASE_LENGTH = 14;

/** Sperm can survive roughly 5 days; the egg survives about 24 hours. */
export const FERTILE_DAYS_BEFORE = 5;
export const FERTILE_DAYS_AFTER = 1;

export const GESTATION_DAYS = 280;

export const PHASE_META: Record<
  Phase,
  { label: string; short: string; color: string; tint: string; blurb: string }
> = {
  menstrual: {
    label: "Menstrual",
    short: "Period",
    color: "#e8a8b8",
    tint: "#fdeef2",
    blurb: "Your uterine lining is shedding. Rest, hydrate and be gentle with yourself.",
  },
  follicular: {
    label: "Follicular",
    short: "Follicular",
    color: "#a98bd4",
    tint: "#efe8f9",
    blurb: "Oestrogen is rising and energy typically builds. A great window for new starts.",
  },
  ovulation: {
    label: "Ovulation",
    short: "Ovulation",
    color: "#f2c078",
    tint: "#fdf3e4",
    blurb: "An egg is estimated to have been released. This is your most fertile window.",
  },
  luteal: {
    label: "Luteal",
    short: "Luteal",
    color: "#8b7bb8",
    tint: "#f0edf8",
    blurb: "Progesterone rises then falls. PMS symptoms often appear in this phase.",
  },
};

/* ------------------------------------------------------------- date utils */

/** Local-midnight date from a `YYYY-MM-DD` string. */
export function parseISO(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `YYYY-MM-DD` in local time — never `toISOString()`, which shifts by zone. */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Whole days from `b` to `a` (positive when `a` is later). DST-safe. */
export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISO(a) === toISO(b);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* --------------------------------------------------------- cycle arithmetic */

/** Ovulation is projected to sit one typical luteal phase before the next period. */
export function ovulationDay(cycleLength: number, periodLength: number): number {
  const earliest = periodLength + 1;
  const latest = cycleLength - 1;
  return clamp(cycleLength - LUTEAL_PHASE_LENGTH, earliest, latest);
}

export function phaseForDay(
  cycleDay: number,
  cycleLength: number,
  periodLength: number,
): Phase {
  const ovulation = ovulationDay(cycleLength, periodLength);
  if (cycleDay <= periodLength) return "menstrual";
  if (cycleDay < ovulation) return "follicular";
  if (cycleDay === ovulation) return "ovulation";
  return "luteal";
}

/* --------------------------------------------------- historical averaging */

/**
 * Mean gap between recorded period starts. Gaps outside 15–60 days are treated
 * as outliers (missed or mistimed logs) and discarded before averaging.
 */
export function averageCycleLength(starts: string[]): number | null {
  const sorted = [...starts].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(parseISO(sorted[i]), parseISO(sorted[i - 1]));
    if (gap >= 15 && gap <= 60) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
}

/** Mean number of bleeding days across logged periods. */
export function averagePeriodLength(periods: { start_date: string; end_date: string | null }[]): number | null {
  const durations = periods
    .map((p) => (p.end_date ? diffDays(parseISO(p.end_date), parseISO(p.start_date)) + 1 : null))
    .filter((n): n is number => n !== null && n >= 1 && n <= 15);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length);
}

export function clampCycleLength(value: number): number {
  return clamp(Math.round(value) || DEFAULT_CYCLE_LENGTH, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH);
}

export function clampPeriodLength(value: number): number {
  return clamp(Math.round(value) || DEFAULT_PERIOD_LENGTH, MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH);
}

/* ----------------------------------------------------------- profile build */

export interface ProfileInput {
  /** `last_period` from onboarding / settings. */
  lastPeriod: string | null;
  /** Every recorded period start, ascending order not required. */
  periodStarts: string[];
  periods: { start_date: string; end_date: string | null }[];
  cycleLength: number;
  periodLength: number;
  regularity: Regularity;
}

/**
 * Picks the freshest anchor (most recent recorded period start on or before
 * today, otherwise the onboarding date) and upgrades the cycle length to a
 * historical average once enough real cycles exist.
 */
export function buildProfile(input: ProfileInput, today = new Date()): CycleProfile {
  const history = input.periodStarts
    .filter((s) => diffDays(today, parseISO(s)) >= 0)
    .sort((a, b) => diffDays(parseISO(b), parseISO(a)));

  const anchor = history[0] ?? input.lastPeriod;
  const fromHistory = averageCycleLength(input.periodStarts);
  const historyCount = input.periodStarts.length;

  // Only trust the historical average once we have at least 3 real cycles.
  const cycleLength =
    fromHistory !== null && historyCount >= 3 ? fromHistory : input.cycleLength;

  const periodFromHistory = averagePeriodLength(input.periods);
  const periodLength =
    periodFromHistory !== null && input.periods.length >= 2
      ? periodFromHistory
      : input.periodLength;

  return {
    anchor: anchor ?? "",
    cycleLength: clampCycleLength(cycleLength),
    periodLength: clampPeriodLength(periodLength),
    regularity: input.regularity,
    historyCount,
  };
}

export function confidenceFor(profile: CycleProfile): CycleState["confidence"] {
  if (profile.regularity === "irregular") return "low";
  if ((profile.historyCount ?? 0) >= 6) return "high";
  if ((profile.historyCount ?? 0) >= 3 || profile.regularity === "regular") return "moderate";
  return "low";
}

/* ------------------------------------------------------ cycle day lookups */

export interface CycleDayInfo {
  cycleDay: number;
  cycleStart: Date;
}

/** Projects any past or future date back onto the cycle anchored at `profile.anchor`. */
export function cycleDayFor(date: Date, profile: CycleProfile): CycleDayInfo | null {
  if (!profile.anchor) return null;
  const anchor = parseISO(profile.anchor);
  const elapsed = diffDays(date, anchor);
  if (elapsed < 0) return null;
  const cycles = Math.floor(elapsed / profile.cycleLength);
  const cycleStart = addDays(anchor, cycles * profile.cycleLength);
  return { cycleDay: diffDays(date, cycleStart) + 1, cycleStart };
}

/** Full state for "today". Returns null before the anchor date or with no data. */
export function getCycleState(profile: CycleProfile, today = new Date()): CycleState | null {
  const info = cycleDayFor(today, profile);
  if (!info) return null;

  const { cycleDay, cycleStart } = info;
  const { cycleLength, periodLength } = profile;
  const nextPeriod = addDays(cycleStart, cycleLength);
  const ovDay = ovulationDay(cycleLength, periodLength);
  const ovulation = addDays(cycleStart, ovDay - 1);
  const fertileStart = addDays(ovulation, -FERTILE_DAYS_BEFORE);
  const fertileEnd = addDays(ovulation, FERTILE_DAYS_AFTER);

  return {
    cycleDay,
    cycleLength,
    periodLength,
    phase: phaseForDay(cycleDay, cycleLength, periodLength),
    cycleStart: toISO(cycleStart),
    nextPeriod: toISO(nextPeriod),
    daysUntilPeriod: diffDays(nextPeriod, today),
    ovulation: toISO(ovulation),
    fertileStart: toISO(fertileStart),
    fertileEnd: toISO(fertileEnd),
    isOnPeriod: cycleDay <= periodLength,
    isFertile: toISO(today) >= toISO(fertileStart) && toISO(today) <= toISO(fertileEnd),
    isOvulationDay: toISO(today) === toISO(ovulation),
    progress: clamp((cycleDay - 1) / cycleLength, 0, 1),
    confidence: confidenceFor(profile),
  };
}

/* ------------------------------------------------------------- day marking */

export interface DayInfo {
  date: string;
  cycleDay: number | null;
  phase: Phase | null;
  isToday: boolean;
  isPast: boolean;
  /** Bleeding actually logged for this date. */
  actualPeriod: boolean;
  /** Period day projected by the engine (and not already logged). */
  predictedPeriod: boolean;
  ovulation: boolean;
  fertile: boolean;
  /** Start of a logged period — drawn with a solid marker. */
  periodStart: boolean;
  /** End of a logged period. */
  periodEnd: boolean;
}

export interface DayMarks {
  periods: { start_date: string; end_date: string | null }[];
}

/** Annotates a single calendar date with logged + predicted cycle markers. */
export function describeDay(date: Date, profile: CycleProfile, marks: DayMarks, today = new Date()): DayInfo {
  const iso = toISO(date);
  const info = cycleDayFor(date, profile);
  const cycleDay = info?.cycleDay ?? null;
  const phase = info
    ? phaseForDay(info.cycleDay, profile.cycleLength, profile.periodLength)
    : null;

  let actualPeriod = false;
  let periodStart = false;
  let periodEnd = false;
  for (const p of marks.periods) {
    const start = p.start_date;
    const end = p.end_date ?? p.start_date;
    if (iso >= start && iso <= end) actualPeriod = true;
    if (iso === start) periodStart = true;
    if (iso === end && p.end_date) periodEnd = true;
  }

  const ovDay = ovulationDay(profile.cycleLength, profile.periodLength);
  const isOvulation = cycleDay === ovDay;
  const isFertile =
    cycleDay !== null && cycleDay >= ovDay - FERTILE_DAYS_BEFORE && cycleDay <= ovDay + FERTILE_DAYS_AFTER;
  const isPredictedPeriod =
    !actualPeriod && cycleDay !== null && cycleDay >= 1 && cycleDay <= profile.periodLength;

  return {
    date: iso,
    cycleDay,
    phase,
    isToday: isSameDay(date, today),
    isPast: diffDays(today, date) > 0,
    actualPeriod,
    predictedPeriod: isPredictedPeriod,
    ovulation: isOvulation,
    fertile: isFertile && !isOvulation,
    periodStart,
    periodEnd,
  };
}

/* ------------------------------------------------------------- calendar UI */

export interface MonthCell {
  date: Date | null;
  info: DayInfo | null;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weeks start on Monday. Leading/trailing cells are `null` padding. */
export function buildMonthGrid(year: number, month: number, profile: CycleProfile, marks: DayMarks, today = new Date()): MonthCell[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Mon = 0 … Sun = 6

  const cells: MonthCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ date: null, info: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, info: describeDay(date, profile, marks, today) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, info: null });

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ------------------------------------------------------------- pregnancy */

export function dueDateFromStart(startDate: string): string {
  return toISO(addDays(parseISO(startDate), GESTATION_DAYS));
}

export interface PregnancyState {
  week: number;
  day: number;
  totalDays: number;
  daysRemaining: number;
  dueDate: string;
  trimester: 1 | 2 | 3;
  progress: number;
  started: boolean;
  isOverdue: boolean;
}

export function getPregnancyState(record: PregnancyRecord, today = new Date()): PregnancyState {
  const start = parseISO(record.start_date);
  const dueDate = record.confirmed_due_date ?? record.due_date;
  const totalDays = diffDays(today, start);
  const due = parseISO(dueDate);
  const daysRemaining = diffDays(due, today);

  return {
    week: Math.max(0, Math.floor(totalDays / 7)),
    day: Math.max(0, totalDays % 7),
    totalDays,
    daysRemaining,
    dueDate,
    trimester: totalDays < 91 ? 1 : totalDays < 196 ? 2 : 3,
    progress: clamp(totalDays / GESTATION_DAYS, 0, 1),
    started: totalDays >= 0,
    isOverdue: daysRemaining < 0,
  };
}

/* ------------------------------------------------------ insight derivation */

export interface CycleSummary {
  count: number;
  average: number | null;
  shortest: number | null;
  longest: number | null;
  /** Standard deviation — a direct read on regularity. */
  variability: number | null;
  durations: number[];
  gaps: number[];
}

/** Turns raw period rows into the trend series the Insights screen plots. */
export function summariseCycles(periods: { start_date: string; end_date: string | null }[]): CycleSummary {
  const sorted = [...periods].sort((a, b) => diffDays(parseISO(a.start_date), parseISO(b.start_date)));

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(parseISO(sorted[i].start_date), parseISO(sorted[i - 1].start_date));
    if (gap >= 15 && gap <= 60) gaps.push(gap);
  }

  const durations = sorted
    .map((p) => (p.end_date ? diffDays(parseISO(p.end_date), parseISO(p.start_date)) + 1 : null))
    .filter((n): n is number => n !== null);

  const average = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const variance =
    gaps.length >= 2 && average !== null
      ? gaps.reduce((sum, g) => sum + (g - average) ** 2, 0) / gaps.length
      : null;

  return {
    count: sorted.length,
    average: average === null ? null : Math.round(average),
    shortest: gaps.length ? Math.min(...gaps) : null,
    longest: gaps.length ? Math.max(...gaps) : null,
    variability: variance === null ? null : Math.round(Math.sqrt(variance) * 10) / 10,
    durations,
    gaps,
  };
}
