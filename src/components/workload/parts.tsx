import { cx } from "@/lib/format";
import type { WorkPhase } from "@/mock/workload";

/** Phase is the one color encoding inside staff cards and the assignment table. */
export const PHASE_GROUPS: Array<{ label: string; color: string; phases: WorkPhase[] }> = [
  { label: "Planning", color: "var(--c-slate-400)", phases: ["Intake", "Conceptual", "Feasibility", "Estimating"] },
  { label: "Preconstruction", color: "var(--c-sky-400)", phases: ["Preconstruction"] },
  { label: "Design", color: "var(--c-cobalt-500)", phases: ["Design"] },
  { label: "Procurement", color: "var(--c-teal-500)", phases: ["Procurement"] },
  { label: "Construction", color: "var(--c-navy-500)", phases: ["Construction"] },
  { label: "Closeout", color: "var(--c-amber-400)", phases: ["Closeout"] },
];

export function phaseColor(phase: WorkPhase | null | undefined): string {
  if (!phase) return "var(--line-strong)";
  return PHASE_GROUPS.find((g) => g.phases.includes(phase))?.color ?? "var(--c-slate-400)";
}

export const hrs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Weekly column sparkline. Load inside capacity is cobalt, load beyond it is
 * coral, capacity is a stepped line. The selected week is drawn at full weight.
 */
export function WeekBars({
  values,
  capacity,
  max,
  marker,
  label,
  className,
  color = "var(--c-cobalt-500)",
}: {
  values: number[];
  capacity?: number[];
  max: number;
  marker?: number;
  label: string;
  className?: string;
  color?: string;
}) {
  const n = values.length;
  const W = n * 10;
  const H = 100;
  const y = (v: number) => H - (Math.min(v, max) / Math.max(1, max)) * H;
  const cap = capacity
    ? capacity.map((c, i) => `${i === 0 ? "M" : "L"}${i * 10},${y(c)} L${i * 10 + 10},${y(c)}`).join(" ")
    : null;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cx("block w-full overflow-visible", className)}>
      {values.map((v, i) => {
        const c = capacity?.[i] ?? Number.POSITIVE_INFINITY;
        const within = Math.min(v, c);
        const faded = marker !== undefined && i !== marker;
        return (
          <g key={i} opacity={faded ? 0.7 : 1}>
            {within > 0 && <rect x={i * 10 + 1} width={8} y={y(within)} height={H - y(within)} fill={color} />}
            {v > c && <rect x={i * 10 + 1} width={8} y={y(v)} height={y(c) - y(v)} fill="var(--c-coral-500)" />}
          </g>
        );
      })}
      {cap && <path d={cap} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />}
      {marker !== undefined && <rect x={marker * 10} width={10} y={0} height={H} fill="var(--accent)" opacity={0.08} />}
    </svg>
  );
}
