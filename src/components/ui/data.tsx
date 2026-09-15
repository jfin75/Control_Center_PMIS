import type { ReactNode } from "react";
import { cx, initials } from "@/lib/format";

export type Tone = "pos" | "warn" | "neg" | "info" | "neutral" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  pos: "bg-pos-tint text-pos-ink",
  warn: "bg-warn-tint text-warn-ink",
  neg: "bg-neg-tint text-neg-ink",
  info: "bg-info-tint text-accent-ink",
  accent: "bg-accent-tint text-accent-ink",
  neutral: "bg-sunk text-ink-2",
};

const DOT_CLASS: Record<Tone, string> = {
  pos: "bg-pos",
  warn: "bg-warn",
  neg: "bg-neg",
  info: "bg-info",
  accent: "bg-accent",
  neutral: "bg-slate",
};

/** Status is always text plus color — never color alone. */
export function Badge({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex h-[1.375rem] shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold whitespace-nowrap", TONE_CLASS[tone], className)}>
      {dot && <span aria-hidden className={cx("size-1.5 rounded-full", DOT_CLASS[tone])} />}
      {children}
    </span>
  );
}

/** Small chip like the reference's "+0,2" delta. */
export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("num inline-flex items-center rounded-xs px-1.5 py-px text-2xs font-bold", TONE_CLASS[tone], className)}>{children}</span>;
}

export function Swatch({ color, className, shape = "square" }: { color: string; className?: string; shape?: "square" | "dot" }) {
  return <span aria-hidden className={cx("inline-block shrink-0", shape === "dot" ? "size-2.5 rounded-full" : "size-2.5 rounded-[2px]", className)} style={{ background: color }} />;
}

const AVATAR_TONES = [
  "",
  "bg-[var(--c-navy-500)] text-white",
  "bg-[var(--c-cobalt-600)] text-white",
  "bg-[var(--c-teal-100)] text-[var(--c-teal-700)]",
  "bg-[var(--c-amber-100)] text-[var(--c-amber-800)]",
  "bg-[var(--c-sky-100)] text-[var(--c-cobalt-800)]",
  "bg-[var(--c-coral-100)] text-[var(--c-coral-700)]",
  "bg-[var(--c-purple-100)] text-[var(--c-purple-700)]",
  "bg-sunk text-ink-2",
];

export function Avatar({ name, tone = 8, size = "md" }: { name: string; tone?: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" && "size-6 text-[0.625rem]",
        size === "md" && "size-8 text-2xs",
        size === "lg" && "size-11 text-sm",
        AVATAR_TONES[tone] ?? AVATAR_TONES[8],
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * The reference's horizontal bar: rounded, saturated, value printed inside
 * when there is room and beside it when there is not.
 */
export function Bar({
  value,
  max,
  color = "var(--c-cobalt-600)",
  label,
  height = "h-6",
  inside = true,
  darkLabel = false,
  className,
}: {
  value: number;
  max: number;
  color?: string;
  label?: ReactNode;
  height?: string;
  inside?: boolean;
  /** Use dark ink for the in-bar figure on light fills (amber, sky, teal). */
  darkLabel?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const roomy = pct > 0.28;
  return (
    <div className={cx("relative flex min-w-0 items-center", height, className)}>
      <div
        className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] rounded-xs"
        style={{ width: `${pct * 100}%`, background: color, minWidth: value > 0 ? 3 : 0 }}
      />
      {label !== undefined &&
        (inside && roomy ? (
          <span className={cx("num absolute left-2 text-2xs font-bold", darkLabel ? "text-ink" : "text-white")}>{label}</span>
        ) : (
          <span className="num ml-2 text-2xs font-bold text-ink-2">{label}</span>
        ))}
    </div>
  );
}

/** Thin two-part meter, e.g. committed vs. actual inside budget. */
export function Meter({
  segments,
  max,
  label,
  className,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  max: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${segments.map((s) => s.label).join(", ")}`}
      className={cx("relative flex h-2 w-full overflow-hidden rounded-full bg-sunk", className)}
    >
      {segments.map((s, i) => (
        <span
          key={i}
          className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] first:rounded-l-full"
          style={{ width: `${Math.max(0, Math.min(1, s.value / max)) * 100}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

/**
 * One panel, n cells separated by hairlines: the brief's KPI strip rendered as
 * a single instrument rather than a row of floating cards.
 */
export function KpiStrip({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; sub?: ReactNode; chip?: ReactNode; accent?: string }>;
  className?: string;
}) {
  return (
    <section aria-label="Key figures" className={cx("panel grid grid-cols-2 overflow-hidden sm:grid-cols-3", items.length >= 5 ? "xl:grid-cols-5" : "lg:grid-cols-4", className)}>
      {items.map((k) => (
        <div key={k.label} className="relative min-w-0 border-line-soft px-5 py-4 not-first:border-l max-sm:[&:nth-child(odd)]:border-l-0">
          <div className="flex items-start gap-2 text-xs text-ink-3">
            {k.accent && <span aria-hidden className="mt-[0.3rem] size-2 shrink-0 rounded-full" style={{ background: k.accent }} />}
            <span className="min-w-0">{k.label}</span>
            {k.chip}
          </div>
          <div className="num mt-1 truncate text-[1.625rem] leading-9 font-semibold tracking-[-0.02em] text-ink">{k.value}</div>
          {k.sub && <div className="mt-0.5 line-clamp-2 text-xs text-ink-2">{k.sub}</div>}
        </div>
      ))}
    </section>
  );
}

/**
 * The reference's signature sentence: plain language with the figures set in
 * bold cobalt ("51 deals for $34,254 were closed…").
 */
export function Narrative({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("max-w-[68ch] text-lg leading-8 text-ink [text-wrap:pretty]", className)}>{children}</p>;
}

export function Em({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "neg" | "pos" }) {
  return (
    <strong className={cx("num font-bold", tone === "accent" && "text-accent-ink", tone === "neg" && "text-neg-ink", tone === "pos" && "text-pos-ink")}>
      {children}
    </strong>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent-tint text-accent-ink">{icon}</div>}
      <p className="text-md font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Legend({ items, className }: { items: Array<{ label: string; color: string; dashed?: boolean }>; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-2xs font-semibold text-ink-2">
          {i.dashed ? (
            <span aria-hidden className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <Swatch color={i.color} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
