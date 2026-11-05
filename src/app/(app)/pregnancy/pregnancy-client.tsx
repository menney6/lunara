"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Apple,
  ArrowLeft,
  Baby,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  Heart,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import {
  GESTATION_DAYS,
  addDays,
  dueDateFromStart,
  getPregnancyState,
  parseISO,
  toISO,
  type PregnancyState,
} from "@/lib/cycle";
import { formatDate, formatDateLong, pluralize, relativeDay } from "@/lib/format";
import { isIsoDate, type FieldErrors } from "@/lib/validate";
import { cn } from "@/lib/cn";
import type { PregnancyRecord } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  IconButton,
  Input,
  LinkRow,
  SectionHeading,
  Segmented,
  Sheet,
} from "@/components/ui";

/* =========================================================================
   Pregnancy mode — setup + dashboard.
   Every date here is an ESTIMATE built from the dates the user entered
   (Naegele's rule: LMP + 280 days). Development copy is general education
   about typical pregnancies, never a medical fact about this one.
   ========================================================================= */

export interface LogRow {
  date: string;
  tags: string[];
  mood: number | null;
}

type Props =
  | { mode: "setup"; defaultLmp: string | null }
  | { mode: "active"; record: PregnancyRecord; state: PregnancyState; logs: LogRow[] };

type DateMode = "lmp" | "due";

/* ------------------------------------------------------------- week data */

interface WeekFact {
  from: number;
  /** `null` = open-ended (the last entry runs to 40+ weeks). */
  to: number | null;
  /** Size comparison, or `null` when nothing is visible yet. */
  size: string | null;
  baby: string;
  you: string;
}

/**
 * Curated, range-keyed development notes covering every week 1–40.
 * Sizes are the familiar fruit-and-veg comparisons — always approximate.
 */
const WEEK_FACTS: WeekFact[] = [
  {
    from: 1,
    to: 3,
    size: null,
    baby: "Day one is counted from your last period, so there is nothing to see yet. Ovulation usually happens around week 2, and fertilisation soon after.",
    you: "You may not notice anything yet — or you might already feel unusually tired, tender or emotional.",
  },
  {
    from: 4,
    to: 5,
    size: "a poppy seed",
    baby: "The neural tube — the beginning of the brain and spinal cord — is forming, and a tiny heartbeat starts to flicker.",
    you: "A missed period is often the first sign. Sore breasts and tiredness are common companions.",
  },
  {
    from: 6,
    to: 7,
    size: "a blueberry",
    baby: "Arm and leg buds are lengthening into the first shapes of limbs, and the beginnings of a face are appearing.",
    you: "Nausea may begin, and smells can suddenly feel very strong. Small, frequent snacks often help.",
  },
  {
    from: 8,
    to: 9,
    size: "an olive",
    baby: "Fingers and toes are separating, and your baby is already wriggling — far too small for you to feel it yet.",
    you: "Fatigue can peak around now. Rest when you can, and keep taking folic acid.",
  },
  {
    from: 10,
    to: 11,
    size: "a fig",
    baby: "Vital organs are taking shape, and tiny tooth buds are forming beneath the gums.",
    you: "Many people start to feel a little steadier as the first trimester settles in.",
  },
  {
    from: 12,
    to: 13,
    size: "a lime",
    baby: "Fingerprints are forming, and your baby can make tiny fists — and even little hiccups.",
    you: "Nausea often eases around now. You might notice your clothes feeling a little snugger.",
  },
  {
    from: 14,
    to: 15,
    size: "an apple",
    baby: "Legs are growing faster than arms, and your baby is practising all kinds of small movements.",
    you: "Energy commonly returns — a welcome window before your bump really shows.",
  },
  {
    from: 16,
    to: 17,
    size: "an avocado",
    baby: "The skeleton is strengthening from soft cartilage into bone, and the nervous system is wiring up.",
    you: "A small bump may be starting to appear. The first fluttering sensations — called quickening — can be close.",
  },
  {
    from: 18,
    to: 19,
    size: "a mango",
    baby: "Ears are in place, and your baby can start to hear — including your voice and heartbeat.",
    you: "Skin may feel itchy as it stretches, and your appetite can pick up again.",
  },
  {
    from: 20,
    to: 21,
    size: "a banana",
    baby: "Around halfway, growth shifts towards weight gain, and fine protective hair begins to cover the scalp.",
    you: "This is often a golden stretch — energy is good and movements are easier to notice each day.",
  },
  {
    from: 22,
    to: 23,
    size: "a grapefruit",
    baby: "Lungs are practising breathing movements, and taste buds are developing.",
    you: "Practice contractions may begin. Sipping water and changing position usually settles them.",
  },
  {
    from: 24,
    to: 25,
    size: "an ear of corn",
    baby: "Growth is rapid — the face is fully formed and your baby now responds to sound and light.",
    you: "Your mid-pregnancy scan usually happens around weeks 18–21, and a glucose screening may be offered around now.",
  },
  {
    from: 26,
    to: 27,
    size: "a head of cauliflower",
    baby: "The lungs are branching out, and your baby is adding a layer of fat beneath the skin for warmth.",
    you: "Backache and leg cramps can appear as your centre of gravity shifts. Warm baths and gentle stretching help many people.",
  },
  {
    from: 28,
    to: 29,
    size: "an aubergine",
    baby: "Eyes can open and close now, and your baby is beginning to experience sleep cycles.",
    you: "Third-trimester tiredness is real. A short afternoon rest is maintenance, not indulgence.",
  },
  {
    from: 30,
    to: 31,
    size: "a head of cabbage",
    baby: "The brain is growing quickly, and your baby is practising sucking and swallowing.",
    you: "Heartburn may show up as your stomach gets squeezed. Smaller, more frequent meals often help.",
  },
  {
    from: 32,
    to: 33,
    size: "a pineapple",
    baby: "Fingernails and toenails are visible, and your baby is settling into a head-down position more often.",
    you: "Sleep can get trickier — a pillow between the knees relieves the pressure for many people.",
  },
  {
    from: 34,
    to: 35,
    size: "a honeydew melon",
    baby: "Lungs are nearly ready, and your baby is filling out, losing that wrinkly new-born look.",
    you: "You may feel a burst of nesting energy. Rest while you can and keep appointments in view.",
  },
  {
    from: 36,
    to: 37,
    size: "a small pumpkin",
    baby: "Full term is close — your baby is practising breathing, sucking and blinking for the outside world.",
    you: "Practice contractions may become more noticeable. Note their pattern and mention it to your care team.",
  },
  {
    from: 38,
    to: null,
    size: "a mini watermelon",
    baby: "Your baby is now considered full term and ready to meet you whenever they choose to arrive.",
    you: "Rest, trust your care team, and remember that due dates are estimates — only about 1 in 20 babies arrive on the predicted day.",
  },
];

function factFor(week: number): WeekFact {
  const w = Math.min(Math.max(week, 1), 40);
  return (
    WEEK_FACTS.find((f) => w >= f.from && w <= (f.to ?? Number.POSITIVE_INFINITY)) ??
    WEEK_FACTS[WEEK_FACTS.length - 1]
  );
}

function sizeLine(week: number, fact: WeekFact): string {
  if (!fact.size) {
    return `At ${week} weeks, everything is still microscopic — nothing is visible to the naked eye yet.`;
  }
  return `At ${week} weeks, your baby is about the size of ${fact.size}.`;
}

/* -------------------------------------------------------- milestone data */

interface Milestone {
  week: number;
  title: string;
  note: string;
}

const MILESTONES: Milestone[] = [
  {
    week: 13,
    title: "First trimester ends",
    note: "Nausea often eases and your energy starts to return — many people share their news around now.",
  },
  {
    week: 20,
    title: "Halfway — anatomy scan",
    note: "The mid-pregnancy scan checks how your baby is growing, usually offered between 18 and 21 weeks.",
  },
  {
    week: 24,
    title: "Viability milestone",
    note: "A landmark week. Your care team will talk you through the support available from here.",
  },
  {
    week: 27,
    title: "Second trimester ends",
    note: "You're entering the final stretch — the third trimester begins next week.",
  },
  {
    week: 28,
    title: "Third trimester begins",
    note: "Growth accelerates and appointments tend to become more frequent.",
  },
  {
    week: 37,
    title: "Full term",
    note: "From this point a birth at any time is considered full term rather than early.",
  },
  {
    week: 40,
    title: "Your estimated due date",
    note: "An estimate from your dates, not a deadline — babies arrive on their own schedule.",
  },
];

/* ------------------------------------------------------- education cards */

interface EduCard {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  points: string[];
  urgent?: boolean;
}

const EDUCATION: EduCard[] = [
  {
    key: "vitamins",
    title: "Folic acid & prenatal vitamins",
    blurb: "A daily 400µg tablet, ideally from before conception",
    icon: Sparkles,
    points: [
      "Take folic acid (400 micrograms) every day — most beneficial when started before pregnancy and continued through the first trimester.",
      "A prenatal vitamin can top up iodine, iron and vitamin D; your care team will tell you what's right for you.",
      "Supplements support a healthy pregnancy — they don't replace a varied diet.",
    ],
  },
  {
    key: "scans",
    title: "Scans & appointments",
    blurb: "Your antenatal schedule, from dating scan to growth checks",
    icon: CalendarDays,
    points: [
      "Your care team will offer a schedule of antenatal appointments, blood tests and scans throughout pregnancy.",
      "Typical scans include an early dating scan, the mid-pregnancy anatomy scan around 18–21 weeks, and growth checks later on.",
      "Write your questions down before you go — appointments pass quickly.",
    ],
  },
  {
    key: "food",
    title: "Food safety",
    blurb: "What to enjoy, what to skip, and how much caffeine is fine",
    icon: Apple,
    points: [
      "Avoid unpasteurised soft cheeses, and raw or undercooked meat and fish — these carry a small risk of infection.",
      "Wash fruit and vegetables well and reheat leftovers until piping hot.",
      "Keep caffeine to around 200mg a day (about two mugs of coffee) and avoid alcohol entirely.",
    ],
  },
  {
    key: "movement",
    title: "Pelvic floor & gentle movement",
    blurb: "Daily exercises and movement that serve you well",
    icon: Dumbbell,
    points: [
      "Pelvic floor exercises, done daily, support you through pregnancy and into recovery.",
      "Gentle movement — walking, swimming, prenatal yoga — suits most people unless a clinician advises otherwise.",
      "Stop and rest if you feel dizzy, breathless or in pain, and mention it at your next appointment.",
    ],
  },
  {
    key: "warning",
    title: "Warning signs to watch for",
    blurb: "When to contact your maternity team straight away",
    icon: AlertTriangle,
    urgent: true,
    points: [
      "Seek medical care straight away if you have vaginal bleeding, severe abdominal pain, fluid leaking from the vagina, a severe headache, changes in your vision, or your baby's movements slow down or stop.",
      "Trust your instincts — if something feels wrong, contact your midwife, obstetrician or maternity assessment unit, day or night.",
      "This is general education, not a diagnosis. Only your care team can advise on your pregnancy.",
    ],
  },
];

/* ------------------------------------------------------------- helpers */

/** Mirrors the API's rules so the form never submits a date we'd reject. */
function validateDates(mode: DateMode, lmp: string, due: string): FieldErrors {
  const errors: FieldErrors = {};
  const today = new Date();
  const earliestLmp = toISO(addDays(today, -300));
  const earliestDue = toISO(addDays(today, -20));
  const latestDue = toISO(addDays(today, GESTATION_DAYS));

  if (mode === "lmp") {
    if (!lmp) errors.lmp = "Enter the first day of your last period.";
    else if (!isIsoDate(lmp)) errors.lmp = "Enter a valid date.";
    else if (lmp > toISO(today)) errors.lmp = "That date is in the future.";
    else if (lmp < earliestLmp) errors.lmp = "That's more than 300 days ago — check the date.";
  } else {
    if (!due) errors.due = "Enter your estimated due date.";
    else if (!isIsoDate(due)) errors.due = "Enter a valid date.";
    else if (due > latestDue) errors.due = "That due date is too far in the future.";
    else if (due < earliestDue) errors.due = "That due date passed more than 3 weeks ago — check the date.";
  }

  return errors;
}

const TRIMESTER: Record<PregnancyState["trimester"], { label: string; tone: "pink" | "lavender" | "plum" }> = {
  1: { label: "First trimester", tone: "pink" },
  2: { label: "Second trimester", tone: "lavender" },
  3: { label: "Third trimester", tone: "plum" },
};

function daysToGoLine(state: PregnancyState): string {
  if (state.daysRemaining > 0) return `${pluralize(state.daysRemaining, "day")} to go`;
  if (state.daysRemaining === 0) return "Due today";
  return `${pluralize(-state.daysRemaining, "day")} past your estimated due date`;
}

/* ========================================================================= */

export default function PregnancyClient(props: Props) {
  if (props.mode === "setup") return <SetupPanel defaultLmp={props.defaultLmp} />;
  return <ActiveDashboard record={props.record} state={props.state} logs={props.logs} />;
}

/* =========================================================== setup panel */

function SetupPanel({ defaultLmp }: { defaultLmp: string | null }) {
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<DateMode>("lmp");
  const [lmp, setLmp] = useState(defaultLmp ?? "");
  const [due, setDue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // The date you didn't type is derived: LMP + 280 = due date.
  const derivedDue = mode === "lmp" ? (isIsoDate(lmp) ? dueDateFromStart(lmp) : "") : due;
  const derivedLmp =
    mode === "due" ? (isIsoDate(due) ? toISO(addDays(parseISO(due), -GESTATION_DAYS)) : "") : lmp;

  const fieldErrors = validateDates(mode, lmp, due);
  // Errors appear once the user has engaged: a value is present, or they tried
  // to save. An untouched empty field never shouts at them.
  const engaged = submitted || (mode === "lmp" ? lmp.length > 0 : due.length > 0);
  const shown: FieldErrors = engaged ? { ...fieldErrors, ...serverErrors } : {};
  const canPreview =
    Object.keys(fieldErrors).length === 0 && isIsoDate(derivedLmp) && isIsoDate(derivedDue);

  const preview: PregnancyState | null = canPreview
    ? getPregnancyState({
        id: 0,
        user_id: 0,
        start_date: derivedLmp,
        due_date: derivedDue,
        confirmed_due_date: null,
        status: "active",
        created_at: "",
      })
    : null;

  function switchMode(next: DateMode) {
    if (next === mode) return;
    // Carry the calculated date across so nothing the user typed is lost.
    if (next === "due" && derivedDue) setDue(derivedDue);
    if (next === "lmp" && derivedLmp) setLmp(derivedLmp);
    setMode(next);
    setServerErrors({});
    setFormError("");
  }

  function editLmp(value: string) {
    setLmp(value);
    setServerErrors({});
    setFormError("");
  }

  function editDue(value: string) {
    setDue(value);
    setServerErrors({});
    setFormError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    setFormError("");
    setServerErrors({});
    try {
      const res = await fetch("/api/pregnancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: derivedLmp, due_date: derivedDue }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; fields?: Record<string, string> }
        | null;

      if (!res.ok) {
        const fields = data?.fields ?? {};
        const mapped: FieldErrors = {};
        if (fields.start_date) mapped.lmp = fields.start_date;
        if (fields.due_date) mapped.due = fields.due_date;
        if (fields.confirmed_due_date) mapped.lmp = fields.confirmed_due_date;
        setServerErrors(mapped);
        setFormError(
          Object.keys(mapped).length > 0 ? "" : (data?.error ?? "Couldn't start tracking. Try again."),
        );
        return;
      }

      // The dashboard is driven by the pregnancy record; the flag keeps the
      // profile screen in step. A failure here must not lose the record.
      try {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pregnancy_status: "pregnant" }),
        });
      } catch {
        /* non-fatal */
      }

      toast("Pregnancy tracking started");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pregnancy mode"
        title="Track your pregnancy"
        subtitle="Week-by-week tracking, your estimated due date and gentle development updates — all in one calm place."
        action={
          <Link href="/profile" aria-label="Back to profile">
            <IconButton label="Back to profile">
              <ArrowLeft className="size-5" />
            </IconButton>
          </Link>
        }
      />

      {/* What pregnancy mode gives them */}
      <Card className="rounded-[28px] animate-fade-up">
        <ul className="space-y-3.5">
          {[
            {
              icon: CalendarDays,
              title: "Your week, counted for you",
              body: "A live counter of weeks and days, plus how long is left until your estimated due date.",
            },
            {
              icon: Baby,
              title: "Weekly development updates",
              body: "What your baby is likely developing this week, and what you may be feeling.",
            },
            {
              icon: Heart,
              title: "Milestones & prenatal guidance",
              body: "A timeline of what's ahead, plus short lessons on scans, nutrition and warning signs.",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
                <item.icon className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <form onSubmit={submit} className="space-y-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Card className="rounded-[28px] space-y-4">
          <Segmented<DateMode>
            options={[
              { value: "lmp", label: "Last period date" },
              { value: "due", label: "Due date" },
            ]}
            value={mode}
            onChange={switchMode}
          />

          {mode === "lmp" ? (
            <Field
              label="First day of your last period"
              htmlFor="lmp"
              hint={defaultLmp ? "Prefilled from your cycle settings — change it if that's not right." : "An approximate date is fine."}
              error={shown.lmp}
            >
              <Input
                id="lmp"
                type="date"
                value={lmp}
                invalid={Boolean(shown.lmp)}
                max={toISO(new Date())}
                onChange={(e) => editLmp(e.target.value)}
              />
            </Field>
          ) : (
            <Field
              label="Estimated due date"
              htmlFor="due"
              hint="From your scan letter, or wherever your care team wrote it."
              error={shown.due}
            >
              <Input
                id="due"
                type="date"
                value={due}
                invalid={Boolean(shown.due)}
                onChange={(e) => editDue(e.target.value)}
              />
            </Field>
          )}

          <Field
            label={mode === "lmp" ? "Estimated due date" : "First day of your last period"}
            hint="Calculated from the date above (LMP + 280 days)."
          >
            <Input
              type="date"
              readOnly
              disabled
              value={mode === "lmp" ? derivedDue : derivedLmp}
              placeholder="—"
            />
          </Field>
        </Card>

        {/* Live "how far along" preview */}
        {preview ? (
          <div className="rounded-[24px] border border-lavender-soft/60 bg-lavender-mist/70 px-4 py-3.5 animate-fade-in">
            <p className="text-[11.5px] font-medium uppercase tracking-[0.09em] text-lavender-deep">
              How far along are you?
            </p>
            <p className="mt-1 font-display text-[27px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {preview.week} {preview.week === 1 ? "week" : "weeks"}{" "}
              <span className="text-[17px] font-medium text-ink-soft">{preview.day} days</span>
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-plum">
              {TRIMESTER[preview.trimester].label} · {daysToGoLine(preview)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              Estimated due {formatDateLong(preview.dueDate)}
            </p>
          </div>
        ) : (
          <p className="px-1 text-[13px] leading-relaxed text-ink-faint">
            Enter {mode === "lmp" ? "the first day of your last period" : "your due date"} above and
            we’ll show you how far along you’d be — before you save anything.
          </p>
        )}

        {formError && <Callout kind="warn">{formError}</Callout>}

        <div className="space-y-2.5">
          <Button type="submit" size="lg" block loading={saving}>
            Start pregnancy tracking
          </Button>
          <Link href="/profile" className="block">
            <Button type="button" variant="outline" block>
              Maybe later — I’m not pregnant
            </Button>
          </Link>
        </div>
      </form>

      <div className="animate-fade-up" style={{ animationDelay: "140ms" }}>
        <Callout kind="info">
          <strong>Dates are estimates.</strong> Naegele’s rule simply adds 280 days (40 weeks) to
          the first day of your last period — it assumes a 28-day cycle, which isn’t true for
          everyone. Only a clinician can confirm your dates, usually with an ultrasound. Everything
          in pregnancy mode is general education, not medical advice.
        </Callout>
      </div>
    </div>
  );
}

/* ========================================================== active view */

function ActiveDashboard({
  record,
  state,
  logs,
}: {
  record: PregnancyRecord;
  state: PregnancyState;
  logs: LogRow[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [weekSheet, setWeekSheet] = useState<number | null>(null);
  const [eduSheet, setEduSheet] = useState<EduCard | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [exitError, setExitError] = useState("");

  const fact = factFor(state.week);
  const trimester = TRIMESTER[state.trimester];
  const start = parseISO(record.start_date);

  // Current week plus the next four, never past 40.
  const firstStripWeek = Math.min(Math.max(state.week, 1), 40);
  const stripWeeks = Array.from(
    { length: Math.min(5, 41 - firstStripWeek) },
    (_, i) => firstStripWeek + i,
  );

  const previewWeek = weekSheet ?? state.week;
  const previewFact = factFor(previewWeek);

  async function endTracking() {
    setEnding(true);
    setExitError("");
    try {
      const res = await fetch("/api/pregnancy", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setExitError(data?.error ?? "Couldn't end tracking. Try again.");
        return;
      }

      try {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pregnancy_status: "postpartum" }),
        });
      } catch {
        /* non-fatal — the record is already ended */
      }

      toast("Pregnancy tracking ended");
      setConfirmEnd(false);
      router.push("/home");
      router.refresh();
    } catch {
      setExitError("Something went wrong. Please try again.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pregnancy mode"
        title="Your pregnancy"
        subtitle="Estimated dates and general education — your care team is the authority on your health."
      />

      {/* ---------------------------------------------------------- hero */}
      <Card className="relative overflow-hidden rounded-[28px] border-lavender-soft/70 gradient-warm animate-fade-up">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-lavender-mist/90 blur-2xl"
        />
        <div className="relative flex items-center gap-4 sm:gap-6">
          <PregnancyRing progress={state.progress} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={trimester.tone}>{trimester.label}</Badge>
              {record.confirmed_due_date && <Badge tone="success">Dates confirmed</Badge>}
            </div>
            <p className="mt-2 font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[38px]">
              {state.week}{" "}
              <span className="text-[18px] font-medium text-ink-soft">
                {state.week === 1 ? "week" : "weeks"}
              </span>
            </p>
            <p className="font-display text-[20px] font-medium leading-tight text-plum">
              {state.day} {state.day === 1 ? "day" : "days"}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft">
              <Clock className="size-3.5 shrink-0 text-lavender-deep" aria-hidden />
              {daysToGoLine(state)}
            </p>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl border border-line bg-card/85 px-3.5 py-3">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            Estimated due date
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">{formatDateLong(state.dueDate)}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {record.confirmed_due_date
              ? "Confirmed by your care team — it overrides the estimate."
              : `Counted from ${formatDate(record.start_date, { year: "numeric" })} (your last period) + 280 days.`}
          </p>
        </div>

        {state.isOverdue && (
          <div className="relative mt-3 rounded-2xl bg-pink-mist px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-plum">
              <strong>{pluralize(-state.daysRemaining, "day")} past your due date.</strong> Only
              about 1 in 20 babies arrive on the exact estimated day, so this is common and not a
              sign that anything is wrong. Stay in close touch with your care team.
            </p>
          </div>
        )}
      </Card>

      {/* -------------------------------------------- baby development */}
      <Card className="rounded-[28px] animate-fade-up" style={{ animationDelay: "70ms" }}>
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-pink-mist text-pink-deep animate-bob">
            <Baby className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium uppercase tracking-[0.09em] text-ink-faint">
              Baby development
            </p>
            <h2 className="font-display text-[18px] font-semibold text-ink">
              Week {state.week}
              {fact.to !== fact.from && fact.to ? ` · weeks ${fact.from}–${fact.to}` : ""}
            </h2>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-ink">{sizeLine(state.week, fact)}</p>

        <div className="mt-3 space-y-2.5">
          <div className="rounded-2xl bg-lavender-mist/70 px-3.5 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-lavender-deep">
              What’s developing
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-plum">{fact.baby}</p>
          </div>
          <div className="rounded-2xl bg-pink-mist px-3.5 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-pink-deep">
              How you might feel
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-plum">{fact.you}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setWeekSheet(state.week)}
          className="mt-3.5 inline-flex items-center gap-1 text-[13px] font-medium text-lavender-deep transition-colors hover:text-plum"
        >
          Read this week’s full update
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </Card>

      {/* ------------------------------------------------- weekly strip */}
      <section className="animate-fade-up" style={{ animationDelay: "130ms" }}>
        <SectionHeading
          title="Week by week"
          action={<span className="text-[12.5px] text-ink-faint">tap to preview</span>}
        />
        <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {stripWeeks.map((week) => {
            const f = factFor(week);
            const current = week === state.week;
            return (
              <button
                key={week}
                type="button"
                onClick={() => setWeekSheet(week)}
                className={cn(
                  "w-[104px] shrink-0 rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                  current
                    ? "border-lavender bg-lavender-mist shadow-soft"
                    : "border-line bg-card hover:border-lavender",
                )}
              >
                <span
                  className={cn(
                    "block text-[10.5px] font-semibold uppercase tracking-[0.08em]",
                    current ? "text-lavender-deep" : "text-ink-faint",
                  )}
                >
                  {current ? "This week" : "Week"}
                </span>
                <span className="mt-0.5 block font-display text-[21px] font-semibold leading-none text-ink">
                  {week}
                </span>
                <span className="mt-1.5 block truncate text-[12px] text-ink-soft">
                  {f.size ?? "microscopic"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------- symptoms/log */}
      <section className="animate-fade-up" style={{ animationDelay: "190ms" }}>
        <SectionHeading
          title="How you're feeling"
          action={
            <Link
              href="/check-in"
              className="text-[12.5px] font-medium text-lavender-deep hover:text-plum"
            >
              Check in
            </Link>
          }
        />
        <Card className="space-y-3.5">
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-mist text-lavender-deep">
              <Heart className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-ink">Log how you’re feeling</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                Symptoms, mood, sleep and energy — thirty seconds a day builds a picture you can
                share at your appointments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "Fatigue", query: "physical=Fatigue" },
              { label: "Back pain", query: "physical=Back%20pain" },
              { label: "Breast tenderness", query: "physical=Breast%20tenderness" },
              { label: "Appetite changes", query: "physical=Appetite%20changes" },
              { label: "Headaches", query: "physical=Headaches" },
              { label: "Emotional", query: "emotional=Emotional" },
              { label: "Calm", query: "emotional=Calm" },
            ].map((chip) => (
              <Link key={chip.label} href={`/check-in?${chip.query}`}>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-cream px-3.5 text-[13px] font-medium text-ink-soft transition hover:border-lavender hover:text-plum">
                  {chip.label}
                </span>
              </Link>
            ))}
          </div>

          <Link href="/check-in" className="block">
            <Button variant="secondary" block>
              Open check-in
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </Link>

          {logs.length > 0 && (
            <ul className="divide-y divide-line border-t border-line pt-1">
              {logs.slice(0, 4).map((row) => (
                <li key={row.date} className="flex items-center gap-3 py-2.5">
                  <span className="w-[62px] shrink-0 text-[13px] font-medium text-ink-soft">
                    {formatDate(row.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {row.tags.length > 0 ? row.tags.join(", ") : "No symptoms logged"}
                  </span>
                  {row.mood !== null && (
                    <span className="shrink-0 rounded-full bg-pink-mist px-2.5 py-1 text-[11.5px] font-medium text-plum">
                      Mood {row.mood}/5
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ------------------------------------------- prenatal education */}
      <section className="animate-fade-up" style={{ animationDelay: "250ms" }}>
        <SectionHeading
          title="Prenatal care"
          action={
            <Link
              href="/learn?category=pregnancy"
              className="text-[12.5px] font-medium text-lavender-deep hover:text-plum"
            >
              Learn more
            </Link>
          }
        />
        <Card className="divide-y divide-line p-0">
          {EDUCATION.map((item) => (
            <LinkRow
              key={item.key}
              icon={<item.icon className="size-[17px]" aria-hidden />}
              label={item.title}
              description={item.blurb}
              onClick={() => setEduSheet(item)}
              danger={item.urgent}
            />
          ))}
        </Card>
      </section>

      {/* -------------------------------------------------- milestones */}
      <section className="animate-fade-up" style={{ animationDelay: "310ms" }}>
        <SectionHeading title="Your milestones" />
        <Card>
          <ol className="relative">
            {MILESTONES.map((m, i) => {
              const date = toISO(addDays(start, m.week * 7));
              const reached = state.week >= m.week;
              return (
                <li key={m.week} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {i < MILESTONES.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[13px] top-7 bottom-0 w-px bg-line-strong"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid size-[27px] shrink-0 place-items-center rounded-full border-2",
                      reached
                        ? "border-lavender bg-lavender-mist text-lavender-deep"
                        : "border-line-strong bg-card text-ink-faint",
                    )}
                  >
                    {reached ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      <span className="size-1.5 rounded-full bg-ink-faint" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14.5px] font-semibold text-ink">{m.title}</p>
                      <Badge tone={reached ? "lavender" : "neutral"}>Week {m.week}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-faint">
                      {formatDate(date)} · {relativeDay(date)}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{m.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>

      {/* ------------------------------------------------- disclaimer */}
      <div className="animate-fade-up" style={{ animationDelay: "360ms" }}>
        <Callout kind="info">
          Week-by-week sizes and development notes are <strong>general education</strong> based on
          typical pregnancies — every baby grows differently, and dates here are estimates rather
          than medical facts. If you have any concerns, contact your care team.
        </Callout>
      </div>

      {/* ------------------------------------------------------- exit */}
      <Card
        className="animate-fade-up border-dashed border-line-strong bg-cream-deep/60"
        style={{ animationDelay: "400ms" }}
      >
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
            <Stethoscope className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-ink">End pregnancy tracking</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
              Baby’s arrival, or simply stepping away — you can stop tracking and keep every
              check-in you’ve logged. You can start again at any time.
            </p>
          </div>
        </div>
        <Button variant="danger" block className="mt-3.5" onClick={() => setConfirmEnd(true)}>
          End pregnancy tracking
        </Button>
      </Card>

      {/* --------------------------------------------- week sheet */}
      <Sheet
        open={weekSheet !== null}
        onClose={() => setWeekSheet(null)}
        title={`Week ${previewWeek} update`}
        footer={
          <Link href="/check-in" className="block">
            <Button block variant="secondary">
              Log how you’re feeling
            </Button>
          </Link>
        }
      >
        <div className="space-y-3.5">
          <p className="font-display text-[17px] font-semibold leading-snug text-ink">
            {sizeLine(previewWeek, previewFact)}
          </p>

          <div className="rounded-2xl bg-lavender-mist/70 px-3.5 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-lavender-deep">
              What’s developing
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-plum">{previewFact.baby}</p>
          </div>

          <div className="rounded-2xl bg-pink-mist px-3.5 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-pink-deep">
              How you might feel
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-plum">{previewFact.you}</p>
          </div>

          <Callout kind="info">
            An estimate for a typical pregnancy at {previewWeek} weeks — not a measurement of your
            baby. Growth and symptoms vary widely, and only your care team can assess your
            pregnancy.
          </Callout>
        </div>
      </Sheet>

      {/* ------------------------------------------ education sheet */}
      <Sheet
        open={eduSheet !== null}
        onClose={() => setEduSheet(null)}
        title={eduSheet?.title ?? "Prenatal care"}
        footer={
          <Link href="/learn?category=pregnancy" className="block">
            <Button block variant="secondary">
              Read more in Learn
            </Button>
          </Link>
        }
      >
        {eduSheet && (
          <div className="space-y-3.5">
            <ul className="space-y-3">
              {eduSheet.points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                      eduSheet.urgent ? "bg-danger-soft text-danger" : "bg-lavender-mist text-lavender-deep",
                    )}
                  >
                    {eduSheet.urgent ? (
                      <AlertTriangle className="size-3" aria-hidden />
                    ) : (
                      <Check className="size-3" aria-hidden />
                    )}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-ink-soft">{point}</p>
                </li>
              ))}
            </ul>

            {eduSheet.urgent && (
              <Callout kind="warn">
                <strong>Seek medical care promptly</strong> if anything above concerns you — it’s
                always better to check. This is general information and can’t assess your pregnancy;
                only your care team can do that.
              </Callout>
            )}
          </div>
        )}
      </Sheet>

      {/* ---------------------------------------- confirm end sheet */}
      <Sheet
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End pregnancy tracking?"
        footer={
          <div className="space-y-2">
            <Button block variant="danger" loading={ending} onClick={endTracking}>
              Yes, end tracking
            </Button>
            <Button block variant="outline" onClick={() => setConfirmEnd(false)} disabled={ending}>
              Keep tracking
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Your pregnancy record will be marked as ended and the mode will switch off. Every
            check-in you’ve logged stays exactly where it is, and you can start tracking again
            whenever you like.
          </p>
          {exitError && <Callout kind="warn">{exitError}</Callout>}
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------- progress ring */

function PregnancyRing({ progress, size = 148 }: { progress: number; size?: number }) {
  const R = 64;
  const circumference = 2 * Math.PI * R;
  const pct = Math.min(1, Math.max(0, progress));
  const rad = ((pct * 360 - 90) * Math.PI) / 180;
  const markerX = 80 + R * Math.cos(rad);
  const markerY = 80 + R * Math.sin(rad);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(pct * 100)}% through a 40-week pregnancy`}
    >
      <svg viewBox="0 0 160 160" width={size} height={size} className="block">
        <defs>
          <linearGradient id="pregnancyProgress" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b79ae0" />
            <stop offset="55%" stopColor="#a98bd4" />
            <stop offset="100%" stopColor="#e8a8b8" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={R} fill="none" stroke="#f1e6e1" strokeWidth="13" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="url(#pregnancyProgress)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 80 80)"
        />
        {pct > 0.02 && (
          <circle cx={markerX} cy={markerY} r="5.5" fill="#fff9f6" stroke="#a98bd4" strokeWidth="3" />
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[23px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {Math.round(pct * 100)}%
        </span>
        <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-faint">
          of 40 weeks
        </span>
      </div>
    </div>
  );
}
