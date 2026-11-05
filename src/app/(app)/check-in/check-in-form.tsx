"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  Droplets,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Input,
  LinkRow,
  SectionHeading,
  Select,
  Sheet,
  Textarea,
} from "@/components/ui";
import { PHASE_META, getCycleState, parseISO } from "@/lib/cycle";
import { capList, formatDateLong, relativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { hasErrors, isIsoDate, type FieldErrors } from "@/lib/validate";
import type { CycleProfile, ParsedDailyLog } from "@/lib/types";

/* ------------------------------------------------------------ option lists */

const PHYSICAL = [
  "Cramps",
  "Headaches",
  "Acne",
  "Bloating",
  "Breast tenderness",
  "Fatigue",
  "Back pain",
  "Appetite changes",
] as const;

const EMOTIONAL = [
  "Happy",
  "Sad",
  "Anxious",
  "Irritable",
  "Calm",
  "Emotional",
  "Stressed",
] as const;

const DISCHARGE = ["None", "Dry", "Creamy", "Egg-white", "Spotting", "Other"] as const;

const SEXUAL_ACTIVITY = [
  "None",
  "Protected",
  "Unprotected",
  "Solo",
  "Prefer not to say",
] as const;

const EXERCISE = ["None", "Light", "Moderate", "Intense", "Yoga", "Walk"] as const;

const MOOD_EMOJI = ["😣", "🙁", "😐", "🙂", "😄"] as const;
const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"] as const;
const SLEEP_LABELS = ["Restless", "Poor", "Okay", "Good", "Deep"] as const;
const ENERGY_LABELS = ["Drained", "Low", "Steady", "Rested", "Full"] as const;

const MAX_NOTE = 1000;
const MAX_WATER = 30;

/* ------------------------------------------------------------------ types */

export interface CheckInPrefill {
  physical: string[];
  emotional: string[];
  energy: number | null;
  water: number | null;
}

interface CheckInFormProps {
  /** ISO date the screen opened on (defaults to today, may come from ?date=). */
  date: string;
  todayISO: string;
  minDate: string;
  /** Parsed logs for the picker window, keyed by ISO date. */
  logs: Record<string, ParsedDailyLog>;
  profile: CycleProfile;
  prefill: CheckInPrefill;
}

interface Draft {
  physical: string[];
  emotional: string[];
  mood_score: number | null;
  sleep_quality: number | null;
  energy: number | null;
  discharge: string | null;
  sexual_activity: string | null;
  exercise: string | null;
  water: number | null;
  note: string;
}

type PendingAction =
  | { kind: "delete" }
  | { kind: "date"; date: string };

/* -------------------------------------------------------------- pure data */

const EMPTY_DRAFT: Draft = {
  physical: [],
  emotional: [],
  mood_score: null,
  sleep_quality: null,
  energy: null,
  discharge: null,
  sexual_activity: null,
  exercise: null,
  water: null,
  note: "",
};

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asScale(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

function asWater(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_WATER
    ? Math.round(value)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, 60);
  return text || null;
}

/** Row → editable draft, tolerating malformed stored values. */
function fromLog(log: ParsedDailyLog | null): Draft {
  if (!log) return EMPTY_DRAFT;
  return {
    physical: asList(log.physical),
    emotional: asList(log.emotional),
    mood_score: asScale(log.mood_score),
    sleep_quality: asScale(log.sleep_quality),
    energy: asScale(log.energy),
    discharge: asText(log.discharge),
    sexual_activity: asText(log.sexual_activity),
    exercise: asText(log.exercise),
    water: asWater(log.water),
    note: typeof log.note === "string" ? log.note : "",
  };
}

/** Adds prefilled symptoms (case-insensitive match against the known list) and
 *  overrides the scales the quick-log link explicitly named. */
function applyPrefill(draft: Draft, prefill: CheckInPrefill): Draft {
  return {
    ...draft,
    physical: mergeOptions(draft.physical, prefill.physical, PHYSICAL),
    emotional: mergeOptions(draft.emotional, prefill.emotional, EMOTIONAL),
    energy: prefill.energy ?? draft.energy,
    water: prefill.water ?? draft.water,
  };
}

function mergeOptions(
  current: string[],
  incoming: string[],
  allowed: readonly string[],
): string[] {
  const next = [...current];
  for (const raw of incoming) {
    const match = allowed.find((option) => option.toLowerCase() === raw.trim().toLowerCase());
    if (match && !next.includes(match)) next.push(match);
  }
  return next;
}

function isEmpty(draft: Draft): boolean {
  return (
    draft.physical.length === 0 &&
    draft.emotional.length === 0 &&
    draft.mood_score === null &&
    draft.sleep_quality === null &&
    draft.energy === null &&
    draft.discharge === null &&
    draft.sexual_activity === null &&
    draft.exercise === null &&
    draft.water === null &&
    draft.note.trim() === ""
  );
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

/** Order-insensitive so re-ticking a symptom in another order isn't "dirty". */
function isSameDraft(a: Draft, b: Draft): boolean {
  return (
    sameList(a.physical, b.physical) &&
    sameList(a.emotional, b.emotional) &&
    a.mood_score === b.mood_score &&
    a.sleep_quality === b.sleep_quality &&
    a.energy === b.energy &&
    a.discharge === b.discharge &&
    a.sexual_activity === b.sexual_activity &&
    a.exercise === b.exercise &&
    a.water === b.water &&
    a.note.trim() === b.note.trim()
  );
}

/** Exactly the DailyLogInput shape the API expects. */
function toPayload(draft: Draft, date: string) {
  return {
    date,
    physical: draft.physical,
    emotional: draft.emotional,
    discharge: draft.discharge,
    sleep_quality: draft.sleep_quality,
    energy: draft.energy,
    sexual_activity: draft.sexual_activity,
    exercise: draft.exercise,
    water: draft.water,
    mood_score: draft.mood_score,
    note: draft.note,
  };
}

function summarise(draft: Draft): string {
  const bits: string[] = [];
  if (draft.mood_score) bits.push(`Mood ${draft.mood_score}/5`);
  const symptoms = draft.physical.length + draft.emotional.length;
  if (symptoms) bits.push(`${symptoms} symptom${symptoms === 1 ? "" : "s"}`);
  if (draft.sleep_quality) bits.push(`Sleep ${draft.sleep_quality}/5`);
  if (draft.energy) bits.push(`Energy ${draft.energy}/5`);
  if (draft.water !== null) bits.push(`${draft.water} glass${draft.water === 1 ? "" : "es"}`);
  if (bits.length === 0 && draft.note.trim()) bits.push("Note added");
  return bits.length ? capList(bits, 3).join(" · ") : "Nothing logged yet";
}

/* =========================================================== the form */

export function CheckInForm({
  date: initialDate,
  todayISO,
  minDate,
  logs: initialLogs,
  profile,
  prefill,
}: CheckInFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [logMap, setLogMap] = useState(initialLogs);
  const [date, setDate] = useState(initialDate);
  const [draft, setDraft] = useState<Draft>(() =>
    applyPrefill(fromLog(initialLogs[initialDate] ?? null), prefill),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [errorNonce, setErrorNonce] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const existing = logMap[date] ?? null;

  // Quick-log links (?physical=Cramps&energy=5…) apply on mount and again if a
  // client-side navigation reuses this component with a different query string.
  const prefillKey = JSON.stringify(prefill);
  useEffect(() => {
    setDraft((current) => applyPrefill(current, prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  // Always bring a failure banner into view, even when the message repeats.
  useEffect(() => {
    if (errorNonce === 0) return;
    bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errorNonce]);

  const cycleState = useMemo(
    () => getCycleState(profile, parseISO(date)),
    [profile, date],
  );
  const phase = cycleState ? PHASE_META[cycleState.phase] : null;
  const relative = relativeDay(date);
  const dirty = !isSameDraft(draft, fromLog(existing));
  const blocked = attempted && isEmpty(draft);
  const summary = summarise(draft);

  /* ------------------------------------------------------------- editing */

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function toggleSymptom(kind: "physical" | "emotional", value: string) {
    setDraft((current) => {
      const list = current[kind];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return kind === "physical" ? { ...current, physical: next } : { ...current, emotional: next };
    });
  }

  function showError(message: string) {
    setFormError(message);
    setErrorNonce((n) => n + 1);
  }

  function applyDate(next: string) {
    setDate(next);
    setDraft(fromLog(logMap[next] ?? null));
    setErrors({});
    setFormError("");
    setAttempted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Date changes are intercepted when the current day has unsaved edits. */
  function requestDate(next: string) {
    if (!isIsoDate(next) || next === date || next > todayISO || next < minDate) return;
    if (dirty) setPending({ kind: "date", date: next });
    else applyDate(next);
  }

  /* -------------------------------------------------------------- saving */

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setFormError("");
    setErrors({});

    const found: FieldErrors = {};
    if (draft.note.length > MAX_NOTE) {
      found.note = `Keep your note under ${MAX_NOTE.toLocaleString("en-GB")} characters.`;
    }
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    if (isEmpty(draft)) return; // surfaced above the save bar

    setSaving(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft, date)),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fields?: FieldErrors;
      };

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        showError(data.error ?? "Unable to save your check-in.");
        return;
      }

      toast("Check-in saved");
      router.push("/home");
      router.refresh();
    } catch {
      showError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------- deleting */

  async function deleteCheckIn() {
    setDeleting(true);
    setFormError("");
    try {
      const res = await fetch(`/api/checkin?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        showError(data.error ?? "Unable to delete this check-in.");
        setPending(null);
        return;
      }

      setLogMap((current) => {
        const next = { ...current };
        delete next[date];
        return next;
      });
      setDraft(fromLog(null));
      setErrors({});
      setAttempted(false);
      setPending(null);
      toast("Check-in deleted");
    } catch {
      showError("Network error — check your connection and try again.");
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "delete") {
      void deleteCheckIn();
      return;
    }
    const next = pending.date;
    setPending(null);
    applyDate(next);
  }

  /* --------------------------------------------------------------- render */

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6 animate-fade-up">
        {formError && (
          <div
            ref={bannerRef}
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        {/* ------------------------------------------------------- date card */}
        <Card className="gradient-warm relative overflow-hidden rounded-[28px] border-lavender/40 p-4 sm:p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full bg-white/70 blur-xl"
          />
          <div className="relative space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-lavender-deep">
                  Check-in for
                </p>
                <h2 className="mt-1 font-display text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                  {formatDateLong(date)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={relative === "Today" ? "plum" : "neutral"}>{relative}</Badge>
                  {existing && (
                    <Badge tone="success">
                      <Pencil className="size-3" aria-hidden />
                      Editing
                    </Badge>
                  )}
                  {cycleState && phase && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-plum"
                      style={{ backgroundColor: phase.tint }}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: phase.color }}
                        aria-hidden
                      />
                      {phase.label} · day {cycleState.cycleDay}
                    </span>
                  )}
                </div>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-lavender-deep shadow-soft">
                <CalendarDays className="size-[18px]" aria-hidden />
              </span>
            </div>

            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label
                  htmlFor="checkin-date"
                  className="block text-[11.5px] font-medium uppercase tracking-[0.07em] text-ink-faint"
                >
                  Change date
                </label>
                <Input
                  id="checkin-date"
                  type="date"
                  value={date}
                  min={minDate}
                  max={todayISO}
                  onChange={(e) => requestDate(e.target.value)}
                  className="bg-white/90"
                />
              </div>
              {date !== todayISO && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="h-12 shrink-0"
                  onClick={() => requestDate(todayISO)}
                >
                  Today
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------- friendly empty */}
        {!existing && (
          <div className="flex items-start gap-3 rounded-[24px] border border-lavender-soft/60 bg-lavender-mist px-4 py-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-lavender-deep shadow-soft">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-plum">Nothing logged yet</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-plum/80">
                Tap whatever applies — you can skip anything and edit this day whenever
                you like.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ physical symptoms */}
        <section>
          <SectionHeading
            title="Physical symptoms"
            action={
              draft.physical.length > 0 ? (
                <Badge tone="lavender">{draft.physical.length} selected</Badge>
              ) : undefined
            }
          />
          <Card>
            <div className="flex flex-wrap gap-2.5">
              {PHYSICAL.map((option) => (
                <Chip
                  key={option}
                  active={draft.physical.includes(option)}
                  onClick={() => toggleSymptom("physical", option)}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </Card>
        </section>

        {/* ---------------------------------------------- emotional symptoms */}
        <section>
          <SectionHeading
            title="Emotional symptoms"
            action={
              draft.emotional.length > 0 ? (
                <Badge tone="pink">{draft.emotional.length} selected</Badge>
              ) : undefined
            }
          />
          <Card>
            <div className="flex flex-wrap gap-2.5">
              {EMOTIONAL.map((option) => (
                <Chip
                  key={option}
                  tone="pink"
                  active={draft.emotional.includes(option)}
                  onClick={() => toggleSymptom("emotional", option)}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </Card>
        </section>

        {/* --------------------------------------------------------------- mood */}
        <section>
          <SectionHeading
            title="Mood"
            action={
              draft.mood_score ? (
                <Badge tone="pink">{MOOD_LABELS[draft.mood_score - 1]}</Badge>
              ) : (
                <Badge>Not set</Badge>
              )
            }
          />
          <Card>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {MOOD_EMOJI.map((emoji, index) => {
                const value = index + 1;
                const active = draft.mood_score === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Mood ${value} of 5 — ${MOOD_LABELS[index]}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        mood_score: current.mood_score === value ? null : value,
                      }))
                    }
                    className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 transition"
                  >
                    <span
                      className={cn(
                        "grid size-12 place-items-center rounded-2xl text-[21px] leading-none transition-all duration-200 sm:size-13",
                        active
                          ? "gradient-brand scale-[1.04] text-white shadow-soft"
                          : "bg-cream-deep group-hover:bg-lavender-mist",
                      )}
                    >
                      {emoji}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium transition-colors",
                        active ? "text-plum" : "text-ink-faint",
                      )}
                    >
                      {MOOD_LABELS[index]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-center text-[12px] text-ink-faint">
              5 is great, 1 is rough — tap again to clear.
            </p>
          </Card>
        </section>

        {/* ----------------------------------------------------- other tracking */}
        <section>
          <SectionHeading title="Other tracking" />
          <Card className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vaginal discharge" htmlFor="ck-discharge">
                <Select
                  id="ck-discharge"
                  value={draft.discharge ?? ""}
                  onChange={(e) => patch({ discharge: e.target.value || null })}
                >
                  <option value="">Not set</option>
                  {DISCHARGE.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Sexual activity" htmlFor="ck-sexual">
                <Select
                  id="ck-sexual"
                  value={draft.sexual_activity ?? ""}
                  onChange={(e) => patch({ sexual_activity: e.target.value || null })}
                >
                  <option value="">Not set</option>
                  {SEXUAL_ACTIVITY.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Exercise" htmlFor="ck-exercise">
                <Select
                  id="ck-exercise"
                  value={draft.exercise ?? ""}
                  onChange={(e) => patch({ exercise: e.target.value || null })}
                >
                  <option value="">Not set</option>
                  {EXERCISE.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <ScalePicker
                label="Sleep quality"
                value={draft.sleep_quality}
                hints={SLEEP_LABELS}
                onChange={(n) =>
                  setDraft((current) => ({
                    ...current,
                    sleep_quality: current.sleep_quality === n ? null : n,
                  }))
                }
              />
              <ScalePicker
                label="Energy levels"
                value={draft.energy}
                hints={ENERGY_LABELS}
                onChange={(n) =>
                  setDraft((current) => ({
                    ...current,
                    energy: current.energy === n ? null : n,
                  }))
                }
              />
            </div>

            <div className="border-t border-line pt-5">
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-cream-deep/70 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-lavender-deep shadow-soft">
                    <Droplets className="size-[17px]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">Water intake</p>
                    <p className="text-[12px] text-ink-faint">
                      {draft.water === null
                        ? "Not logged"
                        : `${draft.water} glass${draft.water === 1 ? "" : "es"}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label="One glass less"
                    disabled={draft.water === null || draft.water <= 0}
                    onClick={() => patch({ water: Math.max(0, (draft.water ?? 0) - 1) })}
                    className="grid size-10 place-items-center rounded-full bg-white text-plum shadow-soft transition hover:bg-lavender-mist disabled:opacity-35"
                  >
                    <span className="text-xl leading-none">−</span>
                  </button>
                  <span className="w-9 text-center font-display text-[22px] font-semibold tabular-nums text-ink">
                    {draft.water ?? "—"}
                  </span>
                  <button
                    type="button"
                    aria-label="One glass more"
                    disabled={draft.water !== null && draft.water >= MAX_WATER}
                    onClick={() => patch({ water: Math.min(MAX_WATER, (draft.water ?? 0) + 1) })}
                    className="grid size-10 place-items-center rounded-full bg-white text-plum shadow-soft transition hover:bg-lavender-mist disabled:opacity-35"
                  >
                    <span className="text-xl leading-none">+</span>
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[12px] text-ink-faint">
                  A glass is about 250 ml — eight is roughly 2 litres.
                </p>
                {draft.water !== null && (
                  <button
                    type="button"
                    onClick={() => patch({ water: null })}
                    className="shrink-0 text-[12px] font-medium text-ink-faint transition hover:text-danger"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* ------------------------------------------------------------- notes */}
        <section>
          <SectionHeading title="Notes" />
          <Card>
            <Field
              label="Anything else?"
              htmlFor="ck-note"
              optional
              error={errors.note}
              hint="Appetite, stress, medication, dreams — whatever stands out."
            >
              <Textarea
                id="ck-note"
                rows={4}
                maxLength={MAX_NOTE}
                value={draft.note}
                placeholder="Today I felt…"
                onChange={(e) => patch({ note: e.target.value })}
              />
            </Field>
            <p className="mt-1.5 text-right text-[11.5px] tabular-nums text-ink-faint">
              {draft.note.length}/{MAX_NOTE}
            </p>
          </Card>
        </section>

        {/* ----------------------------------------------------- delete + trust */}
        {existing && (
          <Card className="overflow-hidden p-0">
            <LinkRow
              danger
              icon={<Trash2 className="size-4" aria-hidden />}
              label="Delete this check-in"
              description={`Removes everything logged for ${formatDateLong(date)}`}
              onClick={() => setPending({ kind: "delete" })}
              trailing={<Trash2 className="size-4 shrink-0 text-danger" aria-hidden />}
            />
          </Card>
        )}

        <p className="flex items-center justify-center gap-1.5 px-2 text-center text-[12.5px] text-ink-faint">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Check-ins are private to your account.
        </p>

        {/* ------------------------------------------------------ sticky save */}
        <div className="sticky bottom-[68px] z-30 pb-2 pt-1">
          <div className="flex items-center gap-3 rounded-[22px] border border-line bg-card/95 px-3 py-2.5 shadow-float backdrop-blur-xl">
            <div className="min-w-0 flex-1 pl-1.5">
              <p
                className={cn(
                  "truncate text-[13.5px] font-semibold",
                  blocked ? "text-danger" : "text-ink",
                )}
              >
                {blocked
                  ? "Add at least one detail"
                  : existing
                    ? "Update your check-in"
                    : "Save your check-in"}
              </p>
              <p
                className={cn(
                  "truncate text-[12px]",
                  blocked ? "text-danger/85" : "text-ink-faint",
                )}
              >
                {blocked ? "Pick a symptom, mood or add a note." : summary}
              </p>
            </div>
            <Button type="submit" size="lg" loading={saving} className="shrink-0">
              Save
            </Button>
          </div>
        </div>
      </form>

      {/* ------------------------------------------------------ confirm sheet */}
      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending?.kind === "delete" ? "Delete this check-in?" : "Discard unsaved changes?"
        }
        footer={
          pending?.kind === "delete" ? (
            <>
              <Button
                type="button"
                variant="danger"
                block
                loading={deleting}
                onClick={confirmPending}
              >
                Delete check-in
              </Button>
              <Button type="button" variant="ghost" block onClick={() => setPending(null)}>
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button type="button" block onClick={confirmPending}>
                Discard & switch day
              </Button>
              <Button type="button" variant="ghost" block onClick={() => setPending(null)}>
                Keep editing
              </Button>
            </>
          )
        }
      >
        <p className="pb-2 text-[14px] leading-relaxed text-ink-soft">
          {pending?.kind === "delete"
            ? `This removes everything you logged for ${formatDateLong(date)}. It can't be undone.`
            : `You have unsaved changes for ${formatDateLong(date)}. Switching days will discard them.`}
        </p>
      </Sheet>
    </>
  );
}

/* ---------------------------------------------------------- sub-components */

/** Compact 1–5 picker used for sleep and energy. Tap the active value to clear. */
function ScalePicker({
  label,
  value,
  hints,
  onChange,
}: {
  label: string;
  value: number | null;
  hints: readonly string[];
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className="truncate text-[12.5px] font-medium text-plum">
          {value ? `${hints[value - 1]} · ${value}/5` : "Not set"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              aria-label={`${label}: ${n} of 5, ${hints[n - 1]}`}
              onClick={() => onChange(n)}
              className={cn(
                "grid h-11 place-items-center rounded-2xl border font-display text-[16px] font-semibold transition-all duration-200",
                active
                  ? "gradient-plum scale-[1.03] border-transparent text-white shadow-soft"
                  : "border-line-strong bg-white text-ink-soft hover:border-lavender hover:text-plum",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

