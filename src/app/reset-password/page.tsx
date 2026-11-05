"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Field, Input } from "@/components/ui";
import { passwordProblem } from "@/lib/validate";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof fieldErrors = {};
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    if (confirm !== password) next.confirm = "Passwords do not match.";
    setFieldErrors(next);
    setError("");
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to reset your password.");
        return;
      }
      router.push(data.next ?? "/login?reset=1");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-4 text-[13.5px] text-danger">
          This reset link is incomplete. Request a new one.
        </div>
        <Link href="/forgot-password" className="block">
          <Button variant="secondary" size="lg" block>
            Request a new link
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger"
        >
          {error}
        </div>
      )}

      <Field label="New password" htmlFor="reset-password" error={fieldErrors.password}>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a new password"
          value={password}
          invalid={Boolean(fieldErrors.password)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="reset-confirm" error={fieldErrors.confirm}>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat it"
          value={confirm}
          invalid={Boolean(fieldErrors.confirm)}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" block loading={loading}>
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Pick something you don't use elsewhere. You'll be signed out everywhere."
      backHref="/login"
      backLabel="Back to sign in"
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
