"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Database, Lock, LogOut, Pencil, Ruler, Shield } from "lucide-react";
import { useToast } from "@/components/toast";
import { Button, Card, Field, Input, LinkRow } from "@/components/ui";

/* ==================================================== identity card */

export function ProfileIdentityCard({
  name,
  email,
  memberSince,
}: {
  name: string;
  email: string;
  memberSince: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const initial = (name || email).trim().charAt(0).toUpperCase() || "L";

  function startEditing() {
    setValue(name);
    setError("");
    setEditing(true);
  }

  function cancel() {
    setValue(name);
    setError("");
    setEditing(false);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a name.");
      return;
    }
    if (trimmed.length > 80) {
      setError("Keep your name under 80 characters.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your name.");
        return;
      }
      setEditing(false);
      toast("Name updated");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gradient-warm relative overflow-hidden rounded-[28px] border-lavender/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full bg-white/70 blur-xl"
      />
      <div className="relative flex items-center gap-4">
        <span
          aria-hidden
          className="gradient-brand grid size-14 shrink-0 place-items-center rounded-full font-display text-[22px] font-semibold text-white shadow-soft"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">
              {name || "Your profile"}
            </h2>
            {!editing && (
              <button
                type="button"
                aria-label="Edit display name"
                onClick={startEditing}
                className="grid size-8 shrink-0 place-items-center rounded-full text-lavender-deep transition-colors hover:bg-white hover:text-plum"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <p className="truncate text-[13px] text-ink-soft">{email}</p>
          <p className="mt-0.5 text-[12px] text-ink-faint">Member since {memberSince}</p>
        </div>
      </div>

      {editing && (
        <div className="relative mt-4 space-y-2.5 border-t border-white/80 pt-3.5">
          <Field label="Display name" htmlFor="profile-name" error={error}>
            <Input
              id="profile-name"
              value={value}
              maxLength={80}
              autoFocus
              placeholder="Your name"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") cancel();
              }}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={saving} onClick={() => void save()}>
              Save name
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ======================================================= settings nav */

const NAV_ROWS = [
  {
    href: "/profile/cycle",
    label: "Cycle settings",
    description: "Cycle & period length, regularity, goals",
    icon: Ruler,
  },
  {
    href: "/profile/notifications",
    label: "Notifications",
    description: "Reminders and the hour they arrive",
    icon: Bell,
  },
  {
    href: "/profile/privacy",
    label: "Privacy",
    description: "Privacy lock and analytics choices",
    icon: Shield,
  },
  {
    href: "/profile/security",
    label: "Security",
    description: "Change your password",
    icon: Lock,
  },
  {
    href: "/profile/data",
    label: "Data & storage",
    description: "Export or delete your data",
    icon: Database,
  },
] as const;

export function SettingsNav() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-line">
        {NAV_ROWS.map((row) => (
          <LinkRow
            key={row.href}
            icon={<row.icon className="size-4" aria-hidden />}
            label={row.label}
            description={row.description}
            onClick={() => router.push(row.href)}
          />
        ))}
      </div>
    </Card>
  );
}

/* ========================================================== sign out */

export function SignOutRow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, drop the client-side session state.
    } finally {
      router.push("/welcome");
      router.refresh();
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <LinkRow
        danger
        icon={<LogOut className="size-4" aria-hidden />}
        label={busy ? "Signing out…" : "Sign out"}
        description="Ends your session on this device"
        onClick={() => void signOut()}
        trailing={<LogOut className="size-4 shrink-0 text-danger" aria-hidden />}
      />
    </Card>
  );
}
