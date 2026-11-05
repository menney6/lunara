"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Download, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  Field,
  Input,
  SectionHeading,
  Sheet,
} from "@/components/ui";
import type { FieldErrors } from "@/lib/validate";

interface ExportResponse {
  settings?: unknown;
  periods?: unknown[];
  logs?: unknown[];
  notifications?: unknown[];
  error?: string;
}

interface DataClientProps {
  email: string;
  name: string;
  counts: { periods: number; logs: number };
}

export function DataClient({ email, name, counts }: DataClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [confirmError, setConfirmError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = password.length > 0 && confirm.trim().length > 0;

  /* ------------------------------------------------------------- export */

  async function exportData() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/account");
      const data = (await res.json().catch(() => ({}))) as ExportResponse;
      if (!res.ok) {
        setError(data.error ?? "Couldn't build your export.");
        return;
      }

      const payload = {
        app: "Lunara",
        version: "1.0",
        exported_at: new Date().toISOString(),
        account: { email, name },
        settings: data.settings ?? null,
        periods: data.periods ?? [],
        logs: data.logs ?? [],
        notifications: data.notifications ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lunara-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast("Export downloaded");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  /* ------------------------------------------------------------- delete */

  function openSheet() {
    setPassword("");
    setConfirm("");
    setFields({});
    setConfirmError("");
    setOpen(true);
  }

  async function runDelete() {
    setDeleting(true);
    setConfirmError("");
    setFields({});
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          password,
          confirm: confirm.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fields?: FieldErrors;
      };

      if (!res.ok) {
        if (data.fields) setFields(data.fields);
        setConfirmError(data.error ?? "Couldn't delete your account.");
        return;
      }

      setOpen(false);
      toast("Account deleted");
      router.push("/welcome");
      router.refresh();
    } catch {
      setConfirmError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  /* ------------------------------------------------------------- render */

  return (
    <div className="space-y-5 animate-fade-up">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* -------------------------------------------------------- export */}
      <section>
        <SectionHeading title="Export" />
        <Card className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Download everything Lunara holds about you as a single, readable JSON file — yours
            to keep, back up or move elsewhere.
          </p>

          <ul className="space-y-2">
            <IncludedRow label="Account settings" detail="Name, cycle, goals, privacy" />
            <IncludedRow
              label="Periods"
              detail={`${counts.periods} logged`}
            />
            <IncludedRow label="Check-ins" detail={`${counts.logs} logged`} />
            <IncludedRow label="Reminder preferences" detail="All six kinds & hours" />
          </ul>

          <Button
            type="button"
            size="lg"
            block
            loading={exporting}
            onClick={() => void exportData()}
          >
            <Download className="size-4" aria-hidden />
            Download JSON export
          </Button>

          <p className="text-center text-[12px] text-ink-faint">
            Saved straight to this device — nothing is emailed.
          </p>
        </Card>
      </section>

      {/* -------------------------------------------------- danger zone */}
      <section>
        <SectionHeading title="Danger zone" />
        <Card className="space-y-4">
          <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3.5">
            <p className="flex items-center gap-2 text-[14.5px] font-semibold text-danger">
              <Trash2 className="size-4" aria-hidden />
              Delete your account
            </p>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-danger/90">
              <li>• Every period, check-in, setting and reminder is erased immediately.</li>
              <li>• Your account and email are removed from Lunara for good.</li>
              <li>• This can&apos;t be undone — export a copy first if you want one.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              block
              loading={exporting}
              onClick={() => void exportData()}
            >
              <Download className="size-4" aria-hidden />
              Export first
            </Button>
            <Button type="button" variant="danger" block onClick={openSheet}>
              <Trash2 className="size-4" aria-hidden />
              Delete my account
            </Button>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------- confirm deletion */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        footer={
          <>
            <Button
              type="button"
              variant="danger"
              block
              loading={deleting}
              disabled={!canDelete}
              onClick={() => void runDelete()}
            >
              Delete forever
            </Button>
            <Button
              type="button"
              variant="ghost"
              block
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Keep my account
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runDelete();
          }}
          className="space-y-4 pb-1"
        >
          <p className="text-[14px] leading-relaxed text-ink-soft">
            This permanently removes <strong className="font-semibold text-ink">{email}</strong>{" "}
            and all of your data: {counts.periods}{" "}
            {counts.periods === 1 ? "period" : "periods"}, {counts.logs}{" "}
            {counts.logs === 1 ? "check-in" : "check-ins"}, your settings and reminder
            preferences. There is no undo and no backup we can restore for you.
          </p>

          {confirmError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[13px] leading-relaxed text-danger"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{confirmError}</span>
            </div>
          )}

          <Field label="Your password" htmlFor="del-password" error={fields.password}>
            <Input
              id="del-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              invalid={Boolean(fields.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field
            label={`Type ${email} or DELETE`}
            htmlFor="del-confirm"
            error={fields.confirm}
            hint="Exactly as shown above, to prove you mean it."
          >
            <Input
              id="del-confirm"
              autoComplete="off"
              placeholder={email}
              value={confirm}
              invalid={Boolean(fields.confirm)}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {/* Hidden submit so Enter confirms from either field. */}
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
        </form>
      </Sheet>
    </div>
  );
}

function IncludedRow({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-2xl border border-line bg-cream-deep/60 px-3.5 py-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
        <Check className="size-3" strokeWidth={3.5} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{label}</span>
      <span className="shrink-0 text-[12.5px] text-ink-faint">{detail}</span>
    </li>
  );
}
