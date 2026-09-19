"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, CircleDashed, Diamond } from "lucide-react";
import { Chip } from "@/components/ui/data";
import { cx } from "@/lib/format";
import type { Calc } from "@/lib/schedule/cpm";
import type { SourceKind } from "@/lib/schedule/types";
import { person } from "@/mock/org";

export { days, plural, shortDate } from "@/components/submittals/parts";

/** Bar and marker colors, one meaning each. */
export const INK = {
  done: "var(--c-teal-500)",
  todo: "var(--c-cobalt-500)",
  critical: "var(--c-coral-500)",
  baseline: "var(--c-amber-400)",
  summary: "var(--c-navy-500)",
  dataDate: "var(--accent)",
  deadline: "var(--c-coral-500)",
} as const;

export const SOURCE_LABEL: Record<SourceKind, string> = {
  native: "Built here",
  template: "From a template",
  "p6-xer": "P6 XER",
  "p6-xml": "P6 XML",
  "msp-xml": "MS Project XML",
  csv: "CSV",
};

export const whoName = (id: string) => {
  try {
    return person(id).name;
  } catch {
    return id;
  }
};

/** "+12 days late", "3 days early", "On baseline", colored and worded. */
export function Variance({ days: n, short, className }: { days: number | null | undefined; short?: boolean; className?: string }) {
  if (n === null || n === undefined) return <span className={cx("text-ink-4", className)}>—</span>;
  if (n === 0) return <span className={cx("text-ink-3", className)}>{short ? "0 d" : "On baseline"}</span>;
  const late = n > 0;
  return (
    <span className={cx("num font-semibold whitespace-nowrap", late ? "text-neg-ink" : "text-pos-ink", className)}>
      {short ? `${late ? "+" : "−"}${Math.abs(n)} d` : `${Math.abs(n)} ${Math.abs(n) === 1 ? "day" : "days"} ${late ? "late" : "early"}`}
    </span>
  );
}

/** Total float in working days; negative is set in coral with a minus sign. */
export function FloatText({ tf, className }: { tf: number | null | undefined; className?: string }) {
  if (tf === null || tf === undefined) return <span className={cx("text-ink-4", className)}>—</span>;
  return <span className={cx("num whitespace-nowrap", tf < 0 ? "font-semibold text-neg-ink" : tf === 0 ? "font-semibold text-ink" : "text-ink-2", className)}>{tf < 0 ? `−${Math.abs(tf)}` : tf}</span>;
}

/** Status as a glyph plus hidden words, for the narrow first grid column. */
export function StatusGlyph({ c }: { c: Calc }) {
  if (c.status === "complete")
    return (
      <span title="Complete" className="text-pos-ink">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Complete</span>
      </span>
    );
  if (c.longest)
    return (
      <span title={c.status === "active" ? "In progress, on the longest path" : "On the longest path"} className="text-neg-ink">
        <Diamond className="size-3" fill="currentColor" aria-hidden />
        <span className="sr-only">{c.status === "active" ? "In progress, on the longest path" : "On the longest path"}</span>
      </span>
    );
  if (c.status === "active")
    return (
      <span title="In progress" className="text-accent-ink">
        <CircleDashed className="size-3.5" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">In progress</span>
      </span>
    );
  return <span className="sr-only">Not started</span>;
}

export function StatusChip({ c }: { c: Calc }) {
  if (c.status === "complete") return <Chip tone="pos">Complete</Chip>;
  if (c.status === "active") return <Chip tone="accent">In progress · {c.pct}%</Chip>;
  return <Chip>Not started</Chip>;
}

/**
 * A text or number field that commits on Enter or blur and reverts on Escape,
 * so typing a name doesn't write an undo step per keystroke.
 */
export function CommitInput({
  value,
  onCommit,
  className,
  select,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onCommit: (v: string) => void; select?: boolean }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const cancel = useRef(false);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (select) ref.current?.select();
  }, [select]);
  return (
    <input
      ref={ref}
      {...rest}
      className={className}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => {
        if (cancel.current) {
          cancel.current = false;
          setV(value);
        } else if (v !== value) onCommit(v);
        rest.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          cancel.current = true;
          e.currentTarget.blur();
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
}

/** Label above a control, for dialog and drawer forms. */
export function Field({ label, hint, children, className, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
