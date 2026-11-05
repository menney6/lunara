import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./logo";
import type { ReactNode } from "react";

/** Centred column shared by the sign-in and sign-up screens. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  backHref = "/welcome",
  backLabel = "Back",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 gradient-warm" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-24 size-72 rounded-full bg-lavender-soft/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 -right-24 size-64 rounded-full bg-pink-soft/50 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="-ml-2 grid size-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-plum"
            aria-label={backLabel}
          >
            <ArrowLeft className="size-[18px]" aria-hidden />
          </Link>
          <Logo size={30} />
          <span aria-hidden className="size-10" />
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-6">
            <h1 className="font-display text-[27px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer && (
          <p className="text-center text-[13.5px] text-ink-soft">{footer}</p>
        )}
      </div>
    </main>
  );
}
