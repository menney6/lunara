import { cn } from "@/lib/cn";
import { PHASE_META, ovulationDay } from "@/lib/cycle";
import type { CycleState, Phase } from "@/lib/types";

/* -------------------------------------------------------------------------
   Circular cycle visualisation.
   The ring is split into four arcs sized by how many days each phase lasts,
   with a marker showing where today sits. All artwork here is original.
   ------------------------------------------------------------------------- */

interface Segment {
  phase: Phase;
  days: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function buildSegments(state: CycleState): Segment[] {
  const { cycleLength, periodLength } = state;
  const ov = ovulationDay(cycleLength, periodLength);

  const segments: Segment[] = [
    { phase: "menstrual", days: periodLength },
    { phase: "follicular", days: Math.max(0, ov - 1 - periodLength) },
    { phase: "ovulation", days: 1 },
    { phase: "luteal", days: Math.max(0, cycleLength - ov) },
  ];

  // Guard against pathological inputs collapsing a phase to zero days.
  return segments.filter((s) => s.days > 0);
}

export function CycleRing({
  state,
  size = 248,
  className,
  caption,
}: {
  state: CycleState;
  size?: number;
  className?: string;
  caption?: string;
}) {
  const segments = buildSegments(state);
  const total = segments.reduce((sum, s) => sum + s.days, 0) || state.cycleLength;

  const CX = 120;
  const CY = 120;
  const R = 96;
  const GAP_DEG = 2.2;

  let cursor = 0;
  const arcs = segments.map((seg) => {
    const sweep = (seg.days / total) * 360;
    const from = cursor + GAP_DEG / 2;
    const to = cursor + sweep - GAP_DEG / 2;
    cursor += sweep;
    return { phase: seg.phase, path: arcPath(CX, CY, R, from, Math.max(from + 0.6, to)) };
  });

  const todayAngle = ((state.cycleDay - 1) / state.cycleLength) * 360;
  const [markerX, markerY] = polar(CX, CY, R, todayAngle);
  const [innerMarkerX, innerMarkerY] = polar(CX, CY, R - 26, todayAngle);

  const meta = PHASE_META[state.phase];
  const circumference = 2 * Math.PI * R;

  return (
    <div
      className={cn("relative mx-auto", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Cycle day ${state.cycleDay} of ${state.cycleLength}. Current phase: ${meta.label}. ${caption ?? ""}`}
    >
      <svg viewBox="0 0 240 240" width={size} height={size} className="block">
        <defs>
          <filter id="ringShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#68466f" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* Faint guide ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R - 26}
          fill="none"
          stroke="#f1e6e1"
          strokeWidth="1.5"
          strokeDasharray="3 7"
        />

        {/* Phase arcs */}
        <g filter="url(#ringShadow)">
          {arcs.map((arc) => (
            <path
              key={arc.phase}
              d={arc.path}
              fill="none"
              stroke={PHASE_META[arc.phase].color}
              strokeWidth="17"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Progress arc — how far through the current cycle */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#68466f"
          strokeWidth="17"
          strokeLinecap="round"
          opacity="0.14"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - state.progress)}
          transform={`rotate(-90 ${CX} ${CY})`}
        />

        {/* Today marker */}
        <circle cx={markerX} cy={markerY} r="11" fill="#fff9f6" />
        <circle cx={markerX} cy={markerY} r="7" fill="#68466f" />
        <circle cx={innerMarkerX} cy={innerMarkerY} r="3.4" fill={meta.color} opacity="0.75" />
      </svg>

      {/* Centre readout */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
          style={{ backgroundColor: meta.tint, color: "#68466f" }}
        >
          {meta.label}
        </span>

        <span className="mt-1.5 font-display text-[42px] font-semibold leading-none tracking-[-0.03em] text-ink">
          {state.cycleDay}
        </span>
        <span className="mt-0.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-faint">
          of {state.cycleLength} days
        </span>

        <span className="mt-2 max-w-[62%] text-[12.5px] font-medium leading-tight text-plum">
          {caption ??
            (state.daysUntilPeriod === 0
              ? "Period expected today"
              : `Period in ${state.daysUntilPeriod} day${state.daysUntilPeriod === 1 ? "" : "s"}`)}
        </span>
      </div>
    </div>
  );
}

/** Compact horizontal phase legend used under the ring. */
export function PhaseLegend({ active }: { active?: Phase }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {(Object.keys(PHASE_META) as Phase[]).map((phase) => {
        const meta = PHASE_META[phase];
        const on = active === phase;
        return (
          <li
            key={phase}
            className={cn(
              "flex items-center gap-1.5 text-[11.5px] transition-opacity",
              on ? "font-semibold text-ink opacity-100" : "text-ink-soft opacity-80",
            )}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}
