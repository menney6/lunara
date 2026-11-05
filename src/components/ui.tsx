"use client";

import { cn } from "@/lib/cn";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Info,
  Lightbulb,
  Loader2,
  X,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/* =========================================================== buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "text-white gradient-plum shadow-[0_8px_22px_-10px_rgba(104,70,111,0.75)] hover:shadow-[0_12px_28px_-10px_rgba(104,70,111,0.85)] hover:brightness-[1.06] active:brightness-95",
  secondary:
    "bg-lavender-mist text-plum hover:bg-lavender-soft/70 border border-lavender-soft/60",
  ghost: "text-ink-soft hover:text-plum hover:bg-lavender-mist/70",
  outline: "bg-card text-ink border border-line-strong hover:border-lavender hover:text-plum",
  danger: "bg-danger-soft text-danger border border-danger/25 hover:bg-danger hover:text-white",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-6 text-[15px] rounded-2xl gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200 select-none",
        "disabled:opacity-55 disabled:pointer-events-none",
        "active:scale-[0.985]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({
  className,
  label,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid place-items-center size-10 rounded-full text-ink-soft",
        "hover:bg-lavender-mist hover:text-plum transition-colors",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ============================================================ surfaces */

export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("surface p-4 sm:p-5", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 mb-3", className)}>
      <h2 className="font-display text-[17px] font-semibold text-ink tracking-[-0.01em]">
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ============================================================= fields */

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}

export function Field({ label, htmlFor, hint, error, children, optional }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink-soft"
      >
        {label}
        {optional && <span className="text-[11px] text-ink-faint font-normal">optional</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-danger" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full bg-card border border-line-strong rounded-2xl px-4 text-[15px] text-ink " +
  "placeholder:text-ink-faint transition-colors outline-none " +
  "focus:border-lavender focus:ring-4 focus:ring-lavender-mist " +
  "disabled:bg-cream-deep disabled:text-ink-faint";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(CONTROL, "h-12", invalid && "border-danger focus:ring-danger-soft focus:border-danger", className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, "py-3 min-h-24 resize-y", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, "h-12 appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
    );
  },
);

/* ============================================================= chips */

export function Chip({
  active,
  onClick,
  children,
  tone = "lavender",
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "lavender" | "pink";
  className?: string;
}) {
  const activeTone =
    tone === "pink"
      ? "bg-pink-mist border-pink text-plum shadow-[inset_0_0_0_1px_rgba(232,168,184,0.55)]"
      : "bg-lavender-mist border-lavender-soft text-plum shadow-[inset_0_0_0_1px_rgba(169,139,212,0.5)]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 h-9 text-[13.5px] font-medium transition-all duration-200",
        active
          ? cn(activeTone, "scale-[1.02]")
          : "bg-card border-line-strong text-ink-soft hover:border-lavender hover:text-plum",
        className,
      )}
    >
      {active && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lavender" | "pink" | "success" | "warning" | "plum";
  className?: string;
}) {
  const tones = {
    neutral: "bg-cream-deep text-ink-soft",
    lavender: "bg-lavender-mist text-plum",
    pink: "bg-pink-mist text-plum",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    plum: "gradient-plum text-white",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium tracking-[0.01em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ====================================================== segmented control */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex gap-1 rounded-full bg-cream-deep p-1 border border-line", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 h-9 rounded-full px-3 text-[13.5px] font-medium transition-all duration-200",
              active
                ? "bg-card text-plum shadow-[0_2px_8px_-3px_rgba(104,70,111,0.35)]"
                : "text-ink-soft hover:text-plum",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================= states */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface flex flex-col items-center justify-center text-center px-6 py-10 gap-2.5",
        className,
      )}
    >
      {icon && (
        <div className="grid place-items-center size-12 rounded-full bg-lavender-mist text-lavender-deep mb-1">
          {icon}
        </div>
      )}
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      <p className="text-[13.5px] text-ink-soft leading-relaxed max-w-[34ch]">{description}</p>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center py-14", className)}>
      <Loader2 className="size-6 text-lavender animate-spin" aria-label="Loading" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} />;
}

/* ======================================================== callout */

export function Callout({
  kind = "info",
  children,
  className,
}: {
  kind?: "info" | "warn" | "tip";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-lavender-mist text-plum border-lavender-soft/50",
    warn: "bg-warning-soft text-[#9a6524] border-warning/30",
    tip: "bg-success-soft text-[#3f7d5f] border-success/30",
  } as const;
  const Icon = kind === "warn" ? AlertCircle : kind === "tip" ? Lightbulb : Info;

  return (
    <div className={cn("flex gap-2.5 rounded-2xl border px-3.5 py-3 text-[13px] leading-relaxed", styles[kind], className)}>
      <Icon className="size-4 shrink-0 mt-0.5" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ============================================================= sheet */

/** Bottom sheet used for day detail, logging and confirmations. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-plum-deep/45 backdrop-blur-[2px] animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col
                   bg-cream rounded-t-[28px] sm:rounded-[28px] shadow-float animate-slide-up sm:animate-scale-in
                   border border-line overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="sm:hidden absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
          <h2 className="font-display text-[17px] font-semibold text-ink pt-1">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="size-9 -mr-1.5">
            <X className="size-4.5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-cream/95 backdrop-blur px-5 py-4 space-y-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================== toast */

export function Toast({
  message,
  visible,
  onDismiss,
}: {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 2600);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 animate-fade-up"
    >
      <div className="flex items-center gap-2 rounded-full bg-plum text-white px-4 py-2.5 text-[13.5px] font-medium shadow-float">
        <Check className="size-4" aria-hidden />
        {message}
      </div>
    </div>
  );
}

/* ======================================================= link row */

export function LinkRow({
  icon,
  label,
  description,
  onClick,
  danger,
  trailing,
}: {
  icon?: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
        "hover:bg-lavender-mist/60",
        danger && "hover:bg-danger-soft",
      )}
    >
      {icon && (
        <span className={cn("grid place-items-center size-9 rounded-full shrink-0", danger ? "bg-danger-soft text-danger" : "bg-lavender-mist text-lavender-deep")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] font-medium", danger ? "text-danger" : "text-ink")}>
          {label}
        </span>
        {description && (
          <span className="block text-[12.5px] text-ink-faint truncate">{description}</span>
        )}
      </span>
      {trailing ?? <ChevronRight className="size-4 text-ink-faint shrink-0" aria-hidden />}
    </button>
  );
}
