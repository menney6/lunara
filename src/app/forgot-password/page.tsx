"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Field, Input } from "@/components/ui";
import { isEmail } from "@/lib/validate";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; devLink?: string | null };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSent(true);
      setDevLink(data.devLink ?? null);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new one."
      backHref="/login"
      backLabel="Back to sign in"
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-success/30 bg-success-soft px-4 py-4">
            <p className="text-[14px] font-medium text-[#3f7d5f]">
              If that address has an account, a reset link is on its way.
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#3f7d5f]/85">
              The link expires in 45 minutes.
            </p>
            {!devLink && (
              <p className="mt-2.5 border-t border-success/30 pt-2.5 text-[12.5px] leading-relaxed text-[#3f7d5f]/80">
                No email service is connected to this build, so nothing was
                actually sent. Run <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11.5px]">npm run dev</code>{" "}
                to have the reset link shown here instead.
              </p>
            )}
          </div>

          {devLink && (
            <div className="rounded-2xl border border-lavender-soft bg-lavender-mist px-4 py-4">
              <p className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-lavender-deep">
                Demo delivery
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-plum">
                No mail provider is configured in this environment, so the link is
                shown here instead.
              </p>
              <Link
                href={devLink}
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-white px-4 text-[13.5px] font-medium text-plum shadow-soft hover:brightness-[1.03]"
              >
                Open reset link
              </Link>
            </div>
          )}

          <Link href="/login" className="block">
            <Button variant="secondary" size="lg" block>
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] text-danger"
            >
              {error}
            </div>
          )}
          <Field label="Email address" htmlFor="forgot-email" error={error || undefined}>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              invalid={Boolean(error)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" block loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
