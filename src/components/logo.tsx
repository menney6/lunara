import { cn } from "@/lib/cn";
import { PHASE_META } from "@/lib/cycle";

/* Lunara's mark: a ring split into four arcs, one per menstrual cycle phase,
   with a centre dot standing for the egg. Entirely original artwork. */

const R = 16;
const C = 2 * Math.PI * R;
const QUARTER = C / 4;
const GAP = 4.5;
const DASH = QUARTER - GAP;
const REST = C - DASH;

const ARC_COLORS = [
  PHASE_META.menstrual.color,
  PHASE_META.follicular.color,
  PHASE_META.ovulation.color,
  PHASE_META.luteal.color,
];

export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="Lunara"
    >
      <g strokeLinecap="round" strokeWidth="4.2">
        {ARC_COLORS.map((color, i) => (
          <circle
            key={color}
            cx="20"
            cy="20"
            r={R}
            stroke={color}
            strokeDasharray={`${DASH} ${REST}`}
            strokeDashoffset={-i * QUARTER}
            transform="rotate(-90 20 20)"
          />
        ))}
      </g>
      <circle cx="20" cy="20" r="5" fill="#68466f" />
      <circle cx="20" cy="20" r="1.9" fill="#fff9f6" />
    </svg>
  );
}

export function Logo({
  size = 34,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-display text-[19px] font-semibold tracking-[-0.02em] text-plum leading-none"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 0' }}
        >
          Lunara
        </span>
      )}
    </span>
  );
}
