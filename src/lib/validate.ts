/* Shared, dependency-free validation used by both the forms (client) and the
   API routes (server) so the two can never disagree about what is valid. */

export interface FieldErrors {
  [field: string]: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Rejects dates too far in either direction (typo protection). */
export function isPlausibleDate(value: string): boolean {
  if (!isIsoDate(value)) return false;
  const year = Number(value.slice(0, 4));
  const now = new Date().getFullYear();
  return year >= 1900 && year <= now + 1;
}

export const MIN_PASSWORD = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[a-zA-Z]/.test(password)) return "Include at least one letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  return null;
}

export function validateRegister(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.name.trim().length < 2) errors.name = "Please enter your name.";
  if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
  const pw = passwordProblem(input.password);
  if (pw) errors.password = pw;
  if (input.confirm !== input.password) errors.confirm = "Passwords do not match.";
  return errors;
}

export function validateLogin(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
  if (!input.password) errors.password = "Enter your password.";
  return errors;
}

export function validateCycle(input: {
  cycle_length: number;
  period_length: number;
  last_period: string | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.cycle_length < 18 || input.cycle_length > 60) {
    errors.cycle_length = "Choose a cycle length between 18 and 60 days.";
  }
  if (input.period_length < 1 || input.period_length > 15) {
    errors.period_length = "Choose a period length between 1 and 15 days.";
  }
  if (input.last_period !== null) {
    if (!isIsoDate(input.last_period)) errors.last_period = "Enter a valid date.";
    else if (parseDate(input.last_period) > addDays(new Date(), 1)) {
      errors.last_period = "That date is in the future.";
    }
  }
  return errors;
}

/* ------------------------------------------------------ tiny date helpers */

/** Local-midnight parse — mirrors cycle.ts without importing it (keeps this
 *  module safe to bundle into client components). */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
