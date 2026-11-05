import { parseISO } from "./cycle";

/* Display formatting kept separate from the cycle engine so date maths stays
   free of locale concerns. */

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...opts,
  }).format(parseISO(iso));
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISO(iso));
}

export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(parseISO(iso));
}

export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(parseISO(iso));
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

/** "Today" / "Tomorrow" / "Yesterday" / "in N days" / "N days ago". */
export function relativeDay(iso: string, today = new Date()): string {
  const target = parseISO(iso);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - now.getTime()) / 86_400_000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export function daysWord(n: number): string {
  return `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Trims a list to `max` entries, appending "+N more" when cut. */
export function capList(items: string[], max = 4): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), `+${items.length - max} more`];
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
