"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check } from "lucide-react";
import { useToast } from "@/components/toast";
import {
  Button,
  Callout,
  Card,
  Chip,
  Field,
  Input,
  LinkRow,
  SectionHeading,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
  toISO,
} from "@/lib/cycle";
import { hasErrors, isPlausibleDate, validateCycle, type FieldErrors } from "@/lib/validate";
import type { HealthGoal, PregnancyStatus, Regularity, UserSettings } from "@/lib/types";

/* ------------------------------------------------------- option lists */

const REGULARITY_OPTIONS: { value: Regularity; title: string; desc: string }[] = [
  { value: "regular", title: "Like clockwork", desc: "Mine vary by a few days at most" },
  { value: "somewhat", title: "Mostly regular", desc: "They shift a little month to month" },
  { value: "irregular", title: "Quite irregular", desc: "Hard to predict when they'll arrive" },
  { value: "unknown", title: "I'm not sure", desc: "I haven't tracked them yet" },
];

const PREGNANCY_OPTIONS: { value: PregnancyStatus; title: string; desc: string }[] = [
  { value: "none", title: "Not pregnant", desc: "Just tracking my cycle" },
  { value: "trying", title: "Trying to conceive", desc: "Hoping to get pregnant" },
  { value: "pregnant", title: "Currently pregnant", desc: "I'd like pregnancy tracking" },
  { value: "postpartum", title: "Postpartum", desc: "Recovering after a birth" },
  { value: "not_sure", title: "Not sure yet", desc: "I'll decide later" },
];

const GOAL_OPTIONS: { value: HealthGoal; title: string }[] = [
  { value: "track_cycle", title: "Track my cycle" },
  { value: "get_pregnant", title: "Get pregnant" },
  { value: "avoid_pregnant", title: "Understand my fertile window" },
  { value: "symptoms", title: "Log symptoms & mood" },
  { value: "understand_body", title: "Understand my body" },
  { value: "manage_condition", title: "Manage a condition" },
  { value: "pregnancy_tracking", title: "Follow my pregnancy" },
];

const todayISO = toISO(new Date());

interface Draft {
  display_name: string;
  dob: string;
  last_period: string;
  cycle_length: number;
  period_length: number;
  regularity: Regularity;
  pregnancy_status: PregnancyStatus;
  goal: HealthGoal | null;
}

function toDraft(settings: UserSettings): Draft {
  return {
    display_name: settings.display_name,
    dob: settings.dob ?? "",
    last_period: settings.last_period ?? "",
    cycle_length: settings.cycle_length,
    period_length: settings.period_length,
    regularity: settings.regularity,
    pregnancy_status: settings.pregnancy_status,
    goal: settings.goal,
  };
}

/* ============================================================ the form */

export function CycleForm({ settings }: { settings: UserSettings }) {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [saved, setSaved] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const found: FieldErrors = validateCycle({
      cycle_length: draft.cycle_length,
      period_length: draft.period_length,
      last_period: draft.last_period || null,
    });
    if (!draft.display_name.trim()) found.display_name = "Please enter a name.";
    if (draft.last_period && draft.last_period > todayISO) {
      found.last_period = "That date is in the future.";
    }
    if (draft.dob) {
      if (!isPlausibleDate(draft.dob)) found.dob = "Enter a valid date.";
      else if (draft.dob > todayISO) found.dob = "That date is in the future.";
    }
    if (hasErrors(found)) {
      setErrors(found);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.display_name.trim(),
          dob: draft.dob || null,
          last_period: draft.last_period || null,
          cycle_length: draft.cycle_length,
          period_length: draft.period_length,
          regularity: draft.regularity,
          pregnancy_status: draft.pregnancy_status,
          goal: draft.goal,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fields?: FieldErrors;
      };

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setFormError(data.error ?? "Couldn't save your cycle settings.");
        return;
      }

      setSaved(draft);
      toast("Settings saved");
      router.refresh();
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 animate-fade-up">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      <Callout kind="info">
        Every prediction in Lunara — periods, ovulation, fertile windows — is an{" "}
        <strong className="font-semibold">estimate</strong> built from these settings. Bodies
        change, and stress, travel and illness can shift a cycle. Treat the dates as a friendly
        guide, never a guarantee.
      </Callout>

      {/* ------------------------------------------------------ about you */}
      <section>
        <SectionHeading title="About you" />
        <Card className="space-y-4">
          <Field label="Display name" htmlFor="cy-name" error={errors.display_name}>
            <Input
              id="cy-name"
              value={draft.display_name}
              maxLength={80}
              placeholder="Your name"
              onChange={(e) => set("display_name", e.target.value)}
            />
          </Field>

          <Field
            label="Date of birth"
            htmlFor="cy-dob"
            optional
            hint="Helps us tailor education content. Leave blank to skip."
            error={errors.dob}
          >
            <Input
              id="cy-dob"
              type="date"
              max={todayISO}
              value={draft.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </Field>

          <Field
            label="First day of your last period"
            htmlFor="cy-lmp"
            hint="The anchor for every prediction — an approximate date works."
            error={errors.last_period}
          >
            <Input
              id="cy-lmp"
              type="date"
              max={todayISO}
              value={draft.last_period}
              onChange={(e) => set("last_period", e.target.value)}
            />
          </Field>
        </Card>
      </section>

      {/* -------------------------------------------------- typical cycle */}
      <section>
        <SectionHeading title="Your typical cycle" />
        <Card className="space-y-5">
          <Stepper
            label="Cycle length"
            hint="First day of one period to the day before the next. The typical average is 28 days."
            value={draft.cycle_length}
            min={MIN_CYCLE_LENGTH}
            max={MAX_CYCLE_LENGTH}
            error={errors.cycle_length}
            onChange={(value) => set("cycle_length", value)}
          />
          <div className="border-t border-line pt-5">
            <Stepper
              label="Period length"
              hint="How many days of bleeding you usually have. Most people land between 3 and 7."
              value={draft.period_length}
              min={MIN_PERIOD_LENGTH}
              max={MAX_PERIOD_LENGTH}
              error={errors.period_length}
              onChange={(value) => set("period_length", value)}
            />
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------ regularity */}
      <section>
        <SectionHeading title="How regular are your cycles?" />
        <Card className="space-y-2.5">
          {REGULARITY_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              active={draft.regularity === option.value}
              onClick={() => set("regularity", option.value)}
              title={option.title}
              desc={option.desc}
            />
          ))}
        </Card>
      </section>

      {/* --------------------------------------------------- pregnancy status */}
      <section>
        <SectionHeading title="Where are you right now?" />
        <Card className="space-y-2.5">
          {PREGNANCY_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              active={draft.pregnancy_status === option.value}
              onClick={() => set("pregnancy_status", option.value)}
              title={option.title}
              desc={option.desc}
            />
          ))}
        </Card>
      </section>

      {/* ----------------------------------------------------------- goal */}
      <section>
        <SectionHeading
          title="Your goal"
          action={
            draft.goal ? (
              <button
                type="button"
                onClick={() => set("goal", null)}
                className="text-[12.5px] font-medium text-ink-faint transition-colors hover:text-danger"
              >
                Clear
              </button>
            ) : undefined
          }
        />
        <Card>
          <div className="flex flex-wrap gap-2.5">
            {GOAL_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                tone="pink"
                active={draft.goal === option.value}
                onClick={() =>
                  set("goal", draft.goal === option.value ? null : option.value)
                }
              >
                {option.title}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
            Optional — this shapes which insights we surface first. Tap an active chip again to
            clear it.
          </p>
        </Card>
      </section>

      {/* --------------------------------------------------- log a period */}
      <Card className="overflow-hidden p-0">
        <LinkRow
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Log a period"
          description="Record a start date in the Calendar"
          onClick={() => router.push("/calendar")}
        />
      </Card>

      {/* ------------------------------------------------------ save bar */}
      <div className="sticky bottom-[68px] z-30 pb-2 pt-1">
        <div className="flex items-center gap-3 rounded-[22px] border border-line bg-card/95 px-3 py-2.5 shadow-float backdrop-blur-xl">
          <div className="min-w-0 flex-1 pl-1.5">
            <p
              className={cn(
                "truncate text-[13.5px] font-semibold",
                dirty ? "text-ink" : "text-success",
              )}
            >
              {dirty ? "You have unsaved changes" : "Everything is saved"}
            </p>
            <p className="truncate text-[12px] text-ink-faint">
              {dirty ? "Save to update your predictions." : "Your predictions are up to date."}
            </p>
          </div>
          <Button type="submit" size="lg" loading={saving} disabled={!dirty} className="shrink-0">
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------- sub-components */

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  const id = `stepper-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
          {label}
        </label>
        <span className="text-[12.5px] text-ink-faint">
          {min}–{max} days
        </span>
      </div>

      <div
        className={cn(
          "mt-2 flex items-center justify-between gap-3 rounded-2xl border bg-card px-3 py-2.5 shadow-soft",
          error ? "border-danger" : "border-line-strong",
        )}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => step(-1)}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-mist text-plum transition hover:bg-lavender-soft disabled:opacity-35"
        >
          <span className="text-xl leading-none">−</span>
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="font-display text-[27px] font-semibold leading-none tabular-nums text-ink">
            {value}
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            days
          </div>
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => step(1)}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-mist text-plum transition hover:bg-lavender-soft disabled:opacity-35"
        >
          <span className="text-xl leading-none">+</span>
        </button>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={`${label}: ${value} days`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-cream-dark accent-[#a98bd4]"
      />

      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12.5px] text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
        active
          ? "border-lavender bg-lavender-mist shadow-[inset_0_0_0_1px_rgba(169,139,212,0.55)]"
          : "border-line bg-white hover:border-lavender-soft",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
          active ? "border-lavender bg-lavender text-white" : "border-line-strong",
        )}
      >
        {active && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-medium text-ink">{title}</span>
        <span className="block text-[12.5px] text-ink-soft">{desc}</span>
      </span>
    </button>
  );
}
