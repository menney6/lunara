"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/toast";
import { Button, Callout, Card, Field, Input, SectionHeading } from "@/components/ui";
import { MIN_PASSWORD, hasErrors, passwordProblem, type FieldErrors } from "@/lib/validate";

function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line-strong bg-card text-ink-soft transition-colors hover:border-lavender hover:text-plum"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </Field>
  );
}

export function SecurityClient() {
  const router = useRouter();
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const found: FieldErrors = {};
    if (!current) found.current_password = "Enter your current password.";
    const weak = passwordProblem(next);
    if (weak) found.new_password = weak;
    if (!confirm) found.confirm = "Repeat your new password.";
    else if (confirm !== next) found.confirm = "Passwords do not match.";

    if (hasErrors(found)) {
      setErrors(found);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fields?: FieldErrors;
      };

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setFormError(data.error ?? "Couldn't change your password.");
        return;
      }

      setDone(true);
      toast("Password updated");
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5 animate-fade-up">
        <Card className="flex flex-col items-center px-6 py-9 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success shadow-soft">
            <Check className="size-6" strokeWidth={2.6} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">
            Password updated
          </h2>
          <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-soft">
            Every other device has been signed out, and this one is back with a fresh session.
            You&apos;ll need the new password next time you sign in.
          </p>
          <div className="mt-5 w-full max-w-xs">
            <Button
              type="button"
              block
              onClick={() => {
                router.push("/profile");
                router.refresh();
              }}
            >
              Back to profile
            </Button>
          </div>
        </Card>
      </div>
    );
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

      <section>
        <SectionHeading title="Update your password" />
        <Card className="space-y-4">
          <PasswordInput
            id="sec-current"
            label="Current password"
            value={current}
            onChange={setCurrent}
            error={errors.current_password}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <PasswordInput
            id="sec-new"
            label="New password"
            value={next}
            onChange={setNext}
            error={errors.new_password}
            hint={`At least ${MIN_PASSWORD} characters, including a letter and a number.`}
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <PasswordInput
            id="sec-confirm"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Card>
      </section>

      <Callout kind="warn">
        Changing your password signs out every other device immediately. If you ever forget it,
        you can reset it from the sign-in screen.
      </Callout>

      <Button type="submit" size="lg" block loading={saving}>
        Update password
      </Button>
    </form>
  );
}
