import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Consistent top-of-screen heading used across the five main tabs. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[12.5px] font-medium uppercase tracking-[0.1em] text-lavender-deep">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[27px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
