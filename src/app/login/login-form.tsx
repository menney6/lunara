"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validate";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmNote, setConfirmNote] = useState<"invalid" | "needed" | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendDevLink, setResendDevLink] = useState<string | null>(null);

  // Arriving from a confirmation link that was invalid, expired or reused.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirm") === "invalid") setConfirmNote("invalid");
  }, []);

  async function onResend() {
    if (resendState === "sending") return;
    setFormError("");
    setResendState("sending");
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; devLink?: string | null };
      if (!res.ok) {
        setFormError(data.error ?? "Enter a valid email address.");
        setResendState("idle");
        return;
      }
      setResendDevLink(data.devLink ?? null);
      setResendState("sent");
    } catch {
      setResendState("idle");
      setFormError("Network error — check your connection and try again.");
    }
  }

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
      const data = (await res.json()) as { error?: string; next?: string; needsConfirmation?: boolean };

      if (!res.ok) {
        if (data.needsConfirmation) setConfirmNote("needed");
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
      {confirmNote && (
        <div className="rounded-2xl border border-lavender-soft bg-lavender-mist px-4 py-4">
          <p className="text-[13px] leading-relaxed text-plum">
            {confirmNote === "invalid"
              ? "That confirmation link is invalid or expired."
              : "Your email address still needs to be confirmed before you can sign in."}
          </p>
          {resendState === "sent" ? (
            <div className="mt-2.5 space-y-2 border-t border-lavender-soft pt-2.5">
              <p className="text-[12.5px] leading-relaxed text-plum/85">
                If that address has an unconfirmed account, a fresh link is on its way.
              </p>
              {resendDevLink && (
                <Link
                  href={resendDevLink}
                  className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-[13px] font-medium text-plum shadow-soft hover:brightness-[1.03]"
                >
                  Open confirmation link
                </Link>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resendState === "sending"}
              className="mt-2.5 inline-flex h-9 items-center rounded-xl bg-white px-4 text-[13px] font-medium text-plum shadow-soft hover:brightness-[1.03] disabled:opacity-60"
            >
              {resendState === "sending" ? "Sending…" : "Email me a new link"}
            </button>
          )}
        </div>
      )}

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
