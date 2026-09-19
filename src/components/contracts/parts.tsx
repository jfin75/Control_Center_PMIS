"use client";

import type { ReactNode } from "react";
import { Badge, Chip, Meter } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/overlay";
import { cx, money, pct } from "@/lib/format";
import { MOD_STATUS, modStatusLabel, STATUS, type ModRow, type Row } from "@/lib/contracts";
import { CATEGORIES, MOD_TYPES, ORDER_NAME, STRUCTURES, type Category, type Contract, type Mod } from "@/mock/contracts";
import { projectById } from "@/mock/projects";
import { plural } from "@/components/submittals/parts";

export { days, MiniFact, plural, shortDate } from "@/components/submittals/parts";

export function StatusBadge({ c }: { c: Contract }) {
  const st = STATUS[c.status];
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

export function ModStatusBadge({ m }: { m: Mod }) {
  return <Badge tone={MOD_STATUS[m.status].tone}>{modStatusLabel(m)}</Badge>;
}

/** The change type's letters, with its name on hover and for screen readers. */
export function ModTypeTag({ m, full }: { m: Pick<Mod, "type">; full?: boolean }) {
  const t = MOD_TYPES[m.type];
  if (full) return <span className="text-xs text-ink-2">{t.label}</span>;
  return (
    <Tooltip label={t.label}>
      <span tabIndex={0} className="num inline-flex h-5 items-center rounded-xs bg-sunk px-1.5 text-2xs font-bold text-ink-2">
        {m.type}
        <span className="sr-only"> ({t.label})</span>
      </span>
    </Tooltip>
  );
}

export function CategoryLabel({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORIES[category].color }} />
      {CATEGORIES[category].short}
    </span>
  );
}

/** "A/E · Task order" for a row. */
export function kindLabel(r: Row): string {
  const s = r.t.structure === "task" ? ORDER_NAME[r.t.category].name : STRUCTURES[r.t.structure].label;
  return `${CATEGORIES[r.t.category].short} · ${s}`;
}

/** Current value with how it got there; a master's ceiling with what's been released. */
export function ValueCell({ r }: { r: Row }) {
  if (r.t.structure === "master") {
    const used = r.current ? r.released / r.current : 0;
    return (
      <div className="ml-auto w-36">
        <div className="num text-right text-ink">{money(r.current, { compact: true })}</div>
        <Meter
          className="mt-1"
          max={Math.max(1, r.current)}
          label="Ceiling used"
          segments={[
            { value: r.released, color: "var(--c-cobalt-600)", label: `${money(r.released, { compact: true })} released` },
            { value: r.inFlight, color: "var(--c-sky-400)", label: `${money(r.inFlight, { compact: true })} in progress` },
          ]}
        />
        <div className={cx("num mt-0.5 text-right text-xs", used >= 0.8 ? "font-semibold text-warn-ink" : "text-ink-3")}>{pct(used)} released</div>
      </div>
    );
  }
  return (
    <div className="text-right whitespace-nowrap">
      <div className="num text-ink">{money(r.current)}</div>
      {r.approved !== 0 ? (
        <div className="num text-xs text-ink-3">
          {money(r.original, { compact: true })} <span className={r.approved > 0 ? "text-neg-ink" : "text-pos-ink"}>{money(r.approved, { compact: true, signed: true })}</span>
        </div>
      ) : (
        <div className="text-xs text-ink-3">No changes</div>
      )}
    </div>
  );
}

export function PendingCell({ r }: { r: Row }) {
  if (!r.pendingCount) return <span className="text-ink-4">—</span>;
  return (
    <div className="text-right whitespace-nowrap">
      <div className="num font-semibold text-warn-ink">{money(r.pending, { compact: true })}</div>
      <div className="text-xs text-ink-3">{plural(r.pendingCount, "open change")}</div>
    </div>
  );
}

/** Proposed or approved amount for a change, with the schedule days beside it. */
export function ModAmount({ x }: { x: ModRow }) {
  const m = x.m;
  const approved = m.status === "approved";
  const amt = approved ? m.approvedAmount : m.amount;
  const days = approved ? m.approvedDays : m.days;
  return (
    <div className="text-right whitespace-nowrap">
      <div className={cx("num", approved ? "font-semibold text-ink" : m.status === "open" || m.status === "priced" ? "text-ink" : "text-ink-3")}>
        {amt === null || amt === undefined ? "TBD" : money(amt)}
      </div>
      <div className="num text-xs text-ink-3">
        {approved ? "approved" : m.status === "priced" ? "priced" : m.status === "open" || m.status === "draft" ? "estimate" : "last figure"}
        {days ? ` · ${days} d` : ""}
      </div>
    </div>
  );
}

export function WaitingCell({ x }: { x: ModRow }) {
  if (!x.waiting) return <span className="text-ink-4">—</span>;
  return (
    <div className="max-w-[13rem] min-w-0">
      <div className="truncate text-sm text-ink">{x.waiting.name}</div>
      <div className="truncate text-xs text-ink-3">{x.waiting.why}</div>
    </div>
  );
}

export const projectCode = (id: string | null) => (id ? (projectById(id)?.code ?? id) : "Program");

/** A small section heading inside a panel or drawer. */
export function SubHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  );
}

/** Tab label with a count of what's still missing there. */
export function TabLabel({ label, missing }: { label: string; missing: number }) {
  return (
    <>
      {label}
      {missing > 0 && (
        <Chip tone="warn" className="ml-0.5">
          {missing}
          <span className="sr-only"> missing</span>
        </Chip>
      )}
    </>
  );
}
