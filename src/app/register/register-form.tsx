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
      const data = (await res.json()) as { error?: string; next?: string };

      if (!res.ok) {
        setFormError(data.error ?? "Unable to create your account.");
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
