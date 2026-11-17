"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { hasErrors, passwordProblem, validateRegister, type FieldErrors } from "@/lib/validate";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateRegister({ name, email, password, confirm });
    setErrors(found);
    setFormError("");
    if (hasErrors(found)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirm }),
      });
      const data = (await res.json()) as {
        error?: string;
        next?: string;
        needsConfirmation?: boolean;
        devLink?: string | null;
      };

      if (data.devLink) setDevLink(data.devLink);

      if (!res.ok) {
        // A retry on an unconfirmed account returns a fresh confirmation link.
        if (data.devLink) setSent(true);
        setFormError(data.error ?? "Unable to create your account.");
        return;
      }
      if (data.needsConfirmation) {
        setSent(true);
        return;
      }
      router.push(data.next ?? "/onboarding");
      router.refresh();
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Live hint that tightens as the user types.
  const pwHint = password ? (passwordProblem(password) ?? "Looks good.") : undefined;

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-success/30 bg-success-soft px-4 py-4">
          <p className="text-[14px] font-medium text-[#3f7d5f]">Check your email.</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#3f7d5f]/85">
            We sent a confirmation link to <span className="font-medium">{email}</span>. Open it to
            activate your account — you can sign in once it&apos;s confirmed.
          </p>
        </div>

        {devLink && (
          <div className="rounded-2xl border border-lavender-soft bg-lavender-mist px-4 py-4">
            <p className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-lavender-deep">
              Demo delivery
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-plum">
              No mail provider is configured in this environment, so the link is shown here instead.
            </p>
            <Link
              href={devLink}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-white px-4 text-[13.5px] font-medium text-plum shadow-soft hover:brightness-[1.03]"
            >
              Open confirmation link
            </Link>
          </div>
        )}

        <Link href="/login" className="block">
          <Button variant="secondary" size="lg" block>
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger"
        >
          {formError}
        </div>
      )}

      <Field label="First name" htmlFor="reg-name" error={errors.name}>
        <Input
          id="reg-name"
          autoComplete="given-name"
          placeholder="Amara"
          value={name}
          invalid={Boolean(errors.name)}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Email address" htmlFor="reg-email" error={errors.email}>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          invalid={Boolean(errors.email)}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="reg-password"
        error={errors.password}
        hint={pwHint && !errors.password ? "8+ characters with a letter and a number." : undefined}
      >
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          invalid={Boolean(errors.password)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirm}>
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat it"
          value={confirm}
          invalid={Boolean(errors.confirm)}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" block loading={loading}>
        Create account
      </Button>

      <p className="pt-1 text-center text-[13.5px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-lavender-deep hover:text-plum">
          Sign in
        </Link>
      </p>
    </form>
  );
}
