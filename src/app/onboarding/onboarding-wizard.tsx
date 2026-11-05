"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Baby,
  CalendarDays,
  Check,
  HeartHandshake,
  Leaf,
  Moon,
  Sparkles,
  Stethoscope,
  Waves,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, Chip, Field, Input } from "@/components/ui";
import type { HealthGoal, PregnancyStatus, Regularity, UserSettings } from "@/lib/types";
import { toISO } from "@/lib/cycle";

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

interface StepDef {
  key: string;
  optional?: boolean;
  skippable?: boolean;
}

const STEPS: StepDef[] = [
  { key: "intro" },
  { key: "name", optional: true, skippable: true },
  { key: "dob", optional: true, skippable: true },
  { key: "last_period" },
  { key: "cycle_length" },
  { key: "period_length" },
  { key: "regularity" },
  { key: "pregnancy", skippable: true },
  { key: "goal", skippable: true },
];

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

const GOAL_OPTIONS: { value: HealthGoal; title: string; icon: typeof Leaf }[] = [
  { value: "track_cycle", title: "Track my cycle", icon: CalendarDays },
  { value: "get_pregnant", title: "Get pregnant", icon: Baby },
  { value: "avoid_pregnant", title: "Understand my fertile window", icon: Waves },
  { value: "symptoms", title: "Log symptoms & mood", icon: Activity },
  { value: "understand_body", title: "Understand my body", icon: Sparkles },
  { value: "manage_condition", title: "Manage a condition", icon: Stethoscope },
  { value: "pregnancy_tracking", title: "Follow my pregnancy", icon: HeartHandshake },
];

const todayISO = toISO(new Date());

export function OnboardingWizard({
  initial,
  fallbackName,
}: {
  initial: UserSettings;
  fallbackName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<Draft>({
    display_name: initial.display_name || fallbackName || "",
    dob: initial.dob ?? "",
    last_period: initial.last_period ?? "",
    cycle_length: initial.cycle_length,
    period_length: initial.period_length,
    regularity: initial.regularity,
    pregnancy_status: initial.pregnancy_status,
    goal: initial.goal,
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const current = STEPS[step];
  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const isLast = step === STEPS.length - 1;

  const stepTitle = useMemo(() => {
    switch (current.key) {
      case "name": return "What should we call you?";
      case "dob": return "When were you born?";
      case "last_period": return "When did your last period start?";
      case "cycle_length": return "How long is your cycle?";
      case "period_length": return "How long does a period last?";
      case "regularity": return "How regular are your cycles?";
      case "pregnancy": return "Where are you right now?";
      case "goal": return "What brings you to Lunara?";
      default: return "";
    }
  }, [current.key]);

  function validateCurrent(): string | null {
    if (current.key === "last_period") {
      if (!draft.last_period) return "Pick a date — an approximate one is fine.";
      if (draft.last_period > todayISO) return "That date is in the future.";
    }
    if (current.key === "dob" && draft.dob && draft.dob > todayISO) {
      return "That date is in the future.";
    }
    return null;
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          dob: draft.dob || null,
          onboarding_complete: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your setup.");
        setSaving(false);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
      setSaving(false);
    }
  }

  function next() {
    const problem = validateCurrent();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    if (isLast) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  function skip() {
    if (!current.skippable) return;
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 gradient-warm" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-lavender-soft/40 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-6 pt-5">
        {/* ---------------------------------------------------------- header */}
        <header className="shrink-0">
          <div className="flex items-center justify-between">
            <Logo size={30} />
            <span className="text-[12.5px] font-medium tabular-nums text-ink-faint">
              {step + 1} of {STEPS.length}
            </span>
          </div>
          <div
            className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/80"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full gradient-brand rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {/* ------------------------------------------------------------ body */}
        <div key={current.key} className="flex-1 overflow-y-auto py-7 animate-fade-up">
          {current.key === "intro" ? (
            <IntroStep />
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-lavender-deep shadow-soft">
                {current.optional ? "Optional" : "Required"}
              </span>
              <h1 className="mt-3 font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink">
                {stepTitle}
              </h1>
              <div className="mt-6">{renderStepBody()}</div>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger"
            >
              {error}
            </p>
          )}
        </div>

        {/* --------------------------------------------------------- footer */}
        <footer className="shrink-0 space-y-2.5 pt-1">
          <Button size="lg" block onClick={next} loading={saving}>
            {isLast ? "Finish setup" : "Continue"}
            {!isLast && !saving && <ArrowRight className="size-4" aria-hidden />}
          </Button>
          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <Button variant="ghost" size="md" onClick={back} className="flex-1">
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
            )}
            {current.skippable && (
              <Button variant="ghost" size="md" onClick={skip} className="flex-1">
                Skip for now
              </Button>
            )}
          </div>
        </footer>
      </div>
    </main>
  );

  /* ------------------------------------------------------ step renderers */

  function renderStepBody(): ReactNode {
    switch (current.key) {
      case "name":
        return (
          <Field label="Your name" htmlFor="ob-name" hint="Used for your greeting — you can change it later.">
            <Input
              id="ob-name"
              value={draft.display_name}
              placeholder="Amara"
              autoComplete="given-name"
              onChange={(e) => set("display_name", e.target.value)}
            />
          </Field>
        );

      case "dob":
        return (
          <Field
            label="Date of birth"
            htmlFor="ob-dob"
            hint="Helps tailor education content. Leave blank to skip."
          >
            <Input
              id="ob-dob"
              type="date"
              max={todayISO}
              value={draft.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </Field>
        );

      case "last_period":
        return (
          <div className="space-y-4">
            <Field
              label="First day of bleeding"
              htmlFor="ob-lmp"
              hint="Not sure of the exact day? An approximate date works — you can correct it later."
            >
              <Input
                id="ob-lmp"
                type="date"
                max={todayISO}
                value={draft.last_period}
                onChange={(e) => set("last_period", e.target.value)}
              />
            </Field>
            <div className="rounded-2xl border border-lavender-soft bg-lavender-mist px-4 py-3 text-[13px] leading-relaxed text-plum">
              This date is the anchor for every prediction Lunara makes — periods,
              ovulation and your fertile window all project from it.
            </div>
          </div>
        );

      case "cycle_length":
        return (
          <Stepper
            value={draft.cycle_length}
            min={18}
            max={60}
            unit="days"
            onChange={(v) => set("cycle_length", v)}
            hint="Count from the first day of one period to the day before the next. The typical average is 28 days."
          />
        );

      case "period_length":
        return (
          <Stepper
            value={draft.period_length}
            min={1}
            max={15}
            unit="days"
            onChange={(v) => set("period_length", v)}
            hint="How many days of bleeding you usually have. Most people land between 3 and 7."
          />
        );

      case "regularity":
        return (
          <div className="space-y-2.5">
            {REGULARITY_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                active={draft.regularity === opt.value}
                onClick={() => set("regularity", opt.value)}
                title={opt.title}
                desc={opt.desc}
              />
            ))}
          </div>
        );

      case "pregnancy":
        return (
          <div className="space-y-2.5">
            {PREGNANCY_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                active={draft.pregnancy_status === opt.value}
                onClick={() => set("pregnancy_status", opt.value)}
                title={opt.title}
                desc={opt.desc}
              />
            ))}
          </div>
        );

      case "goal":
        return (
          <div className="flex flex-wrap gap-2.5">
            {GOAL_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.goal === opt.value}
                onClick={() => set("goal", draft.goal === opt.value ? null : opt.value)}
              >
                <opt.icon className="size-3.5" aria-hidden />
                {opt.title}
              </Chip>
            ))}
          </div>
        );

      default:
        return null;
    }
  }
}

/* ------------------------------------------------------------- sub-steps */

function IntroStep() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative mb-6 grid size-32 place-items-center rounded-full bg-white shadow-ring">
        <Moon className="size-14 text-lavender-deep" strokeWidth={1.4} aria-hidden />
        <span className="absolute -right-1 top-2 grid size-9 place-items-center rounded-full bg-pink text-white shadow-soft">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
      </div>
      <h1 className="font-display text-[27px] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Let&apos;s make it yours
      </h1>
      <p className="mt-3 max-w-[32ch] text-[14.5px] leading-relaxed text-ink-soft">
        Eight quick questions so Lunara can tailor your predictions, insights and
        education to your body.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <span className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-plum shadow-soft">
          Takes about a minute
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-plum shadow-soft">
          Skip anything you&apos;re unsure of
        </span>
      </div>
      <p className="mt-7 flex items-center gap-1.5 text-[12.5px] text-ink-faint">
        <Leaf className="size-3.5" aria-hidden />
        Your answers stay private to your account.
      </p>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  unit,
  onChange,
  hint,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
  hint: string;
}) {
  const clamped = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-white px-5 py-4 shadow-soft">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(clamped(value - 1))}
          disabled={value <= min}
          className="grid size-11 place-items-center rounded-full bg-lavender-mist text-plum transition hover:bg-lavender-soft disabled:opacity-35"
        >
          <span className="text-xl leading-none">−</span>
        </button>

        <div className="text-center">
          <div className="font-display text-[38px] font-semibold leading-none tabular-nums text-ink">
            {value}
          </div>
          <div className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            {unit}
          </div>
        </div>

        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(clamped(value + 1))}
          disabled={value >= max}
          className="grid size-11 place-items-center rounded-full bg-lavender-mist text-plum transition hover:bg-lavender-soft disabled:opacity-35"
        >
          <span className="text-xl leading-none">+</span>
        </button>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={`Value: ${value} ${unit}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-cream-dark accent-[#a98bd4]"
      />

      <p className="text-[13px] leading-relaxed text-ink-soft">{hint}</p>
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
      className={
        "w-full flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 " +
        (active
          ? "border-lavender bg-lavender-mist shadow-[inset_0_0_0_1px_rgba(169,139,212,0.55)]"
          : "border-line bg-white hover:border-lavender-soft")
      }
    >
      <span
        className={
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors " +
          (active ? "border-lavender bg-lavender text-white" : "border-line-strong")
        }
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
