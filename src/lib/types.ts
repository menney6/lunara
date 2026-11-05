/* ------------------------------------------------------------------ auth */

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  status: "active" | "suspended";
  created_at: string;
}

/* --------------------------------------------------------- user settings */

export type Regularity = "regular" | "somewhat" | "irregular" | "unknown";

export type PregnancyStatus =
  | "none"
  | "trying"
  | "pregnant"
  | "postpartum"
  | "not_sure";

export type HealthGoal =
  | "track_cycle"
  | "get_pregnant"
  | "avoid_pregnant"
  | "symptoms"
  | "understand_body"
  | "manage_condition"
  | "pregnancy_tracking";

export interface UserSettings {
  id: number;
  user_id: number;
  display_name: string;
  dob: string | null;
  /** ISO date of the first day of the most recent period (onboarding "LMP"). */
  last_period: string | null;
  cycle_length: number;
  period_length: number;
  regularity: Regularity;
  pregnancy_status: PregnancyStatus;
  goal: HealthGoal | null;
  notifications_enabled: number;
  theme: string;
  privacy_lock: number;
  share_analytics: number;
  onboarding_complete: number;
  created_at: string;
  updated_at: string;
}

/* ----------------------------------------------------------- period logs */

export interface Period {
  id: number;
  user_id: number;
  /** ISO date — first day of bleeding. */
  start_date: string;
  /** ISO date — last day of bleeding (inclusive). */
  end_date: string | null;
  flow: "light" | "medium" | "heavy" | null;
  symptoms: string;
  note: string;
  created_at: string;
}

/* -------------------------------------------------------- daily health log */

export interface DailyLog {
  id: number;
  user_id: number;
  /** ISO date (YYYY-MM-DD) — one log per user per day. */
  date: string;
  physical: string;
  emotional: string;
  discharge: string | null;
  sleep_quality: number | null;
  energy: number | null;
  sexual_activity: string | null;
  exercise: string | null;
  water: number | null;
  mood_score: number | null;
  note: string;
  created_at: string;
  updated_at: string;
}

/** Parsed shape of DailyLog JSON columns. */
export interface ParsedDailyLog {
  physical: string[];
  emotional: string[];
  discharge: string | null;
  sleep_quality: number | null;
  energy: number | null;
  sexual_activity: string | null;
  exercise: string | null;
  water: number | null;
  mood_score: number | null;
  note: string;
}

/* --------------------------------------------------------------- pregnancy */

export interface PregnancyRecord {
  id: number;
  user_id: number;
  /** ISO date the pregnancy is estimated to have started (conception-based). */
  start_date: string;
  /** ISO date of the estimated due date (start + 280 days). */
  due_date: string;
  /** Optional ultrasound-confirmed date, overrides estimate when present. */
  confirmed_due_date: string | null;
  status: "active" | "ended";
  created_at: string;
}

/* ----------------------------------------------------- notification prefs */

export type NotificationKind =
  | "period_upcoming"
  | "fertile_window"
  | "ovulation"
  | "daily_checkin"
  | "pregnancy_update"
  | "weekly_insight";

export interface NotificationPref {
  id: number;
  user_id: number;
  kind: NotificationKind;
  enabled: number;
  /** Hour of day (0-23) the reminder should fire. */
  hour: number;
}

/* ------------------------------------------------------------ cycle engine */

export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CycleProfile {
  /** ISO date of a known period start used as the projection anchor. */
  anchor: string;
  cycleLength: number;
  periodLength: number;
  /** User-declared cycle regularity — drives prediction confidence. */
  regularity?: Regularity;
  /** Number of recorded periods behind the current estimate. */
  historyCount?: number;
}

export interface CycleState {
  /** 1-based day within the current cycle. */
  cycleDay: number;
  cycleLength: number;
  periodLength: number;
  phase: Phase;
  /** ISO date the current cycle began. */
  cycleStart: string;
  /** ISO date of the next expected period start. */
  nextPeriod: string;
  daysUntilPeriod: number;
  /** ISO date ovulation is estimated to occur. */
  ovulation: string;
  /** Inclusive fertile window (7 days: ovulation −5 … +1). */
  fertileStart: string;
  fertileEnd: string;
  isOnPeriod: boolean;
  isFertile: boolean;
  isOvulationDay: boolean;
  /** 0–1 progress through the cycle, for the ring visualisation. */
  progress: number;
  /** Every estimate is an estimate — surfaced verbatim in the UI. */
  confidence: "high" | "moderate" | "low";
}

/* --------------------------------------------------------------- articles */

export type ArticleCategory =
  | "menstrual_health"
  | "ovulation"
  | "fertility"
  | "hormones"
  | "pregnancy"
  | "sexual_wellness"
  | "mental_health"
  | "pcos"
  | "endometriosis";

export interface Article {
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  reading_minutes: number;
  tags: string[];
  /** Gradient token used for the article card artwork. */
  art: string;
  body: ArticleBlock[];
}

export type ArticleBlock =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[] }
  | { t: "callout"; text: string; kind?: "info" | "warn" | "tip" };

/* ------------------------------------------------------------ api helpers */

export interface ApiError {
  error: string;
}
