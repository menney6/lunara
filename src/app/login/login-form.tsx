"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validate";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateLogin({ email, password });
    setErrors(found);
    setFormError("");
    if (hasErrors(found)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; next?: string };

      if (!res.ok) {
        setFormError(data.error ?? "Unable to sign in. Please try again.");
        return;
      }
      router.push(data.next ?? "/home");
      router.refresh();
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
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

      <Field label="Email address" htmlFor="login-email" error={errors.email}>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          invalid={Boolean(errors.email)}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="login-password" error={errors.password}>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          invalid={Boolean(errors.password)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-[13px] font-medium text-lavender-deep hover:text-plum"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" block loading={loading}>
        Sign in
      </Button>

      <p className="pt-1 text-center text-[13.5px] text-ink-soft">
        New to Lunara?{" "}
        <Link href="/register" className="font-medium text-lavender-deep hover:text-plum">
          Create an account
        </Link>
      </p>
    </form>
  );
}
