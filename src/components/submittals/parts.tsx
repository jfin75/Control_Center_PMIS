"use client";

import type { ReactNode } from "react";
import { Badge, Chip } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/overlay";
import { addDays, cx, fmtDate } from "@/lib/format";
import { BUCKET_ORDER, BUCKETS, STATUS, type Bucket, type Row } from "@/lib/submittals";
import { TODAY } from "@/mock/org";
import { ACTION_ORDER, RESUBMIT_DAYS, REVIEW_ACTIONS, type Party, type ReviewAction } from "@/mock/submittals";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const days = (n: number) => plural(Math.abs(n), "day");

/** "Oct 5" this year, "May 3, 2027" in any other, so short dates never lose their year. */
export const shortDate = (iso: string) => fmtDate(iso, iso.slice(0, 4) === TODAY.slice(0, 4) ? "short" : "long");

export function StatusBadge({ r }: { r: Row }) {
  const st = STATUS[r.status];
  return (
    <Badge tone={st.tone}>
      {r.status === "draft" ? `Draft ${r.draft?.number ?? ""}` : st.label}
    </Badge>
  );
}

/** The stamp a reviewer puts on a returned submittal: code plus words. */
export function ActionBadge({ action, short }: { action: ReviewAction; short?: boolean }) {
  const a = REVIEW_ACTIONS[action];
  return (
    <Badge tone={a.tone} dot={false}>
      <span className="num font-bold">{a.code}</span>
      {!short && <span className="font-semibold">{a.label}</span>}
    </Badge>
  );
}

/** What the row owes next and by when, with lateness spelled out. */
export function NextDate({ r }: { r: Row }) {
  let label: string;
  let date: string | null;
  if (r.bucket === "toSubmit") [label, date] = ["Submit by", r.submitBy];
  else if (r.bucket === "open") [label, date] = ["Due", r.last!.due];
  else if (r.bucket === "rejected") [label, date] = ["Resubmit by", addDays(r.last!.returned!, RESUBMIT_DAYS)];
  else [label, date] = ["Closed", r.closedOn];
  return (
    <div className="whitespace-nowrap">
      <div className="num text-ink">
        <span className="text-xs text-ink-3">{label} </span>
        {date ? shortDate(date) : "—"}
      </div>
      {r.late > 0 && <div className="num text-xs font-semibold text-neg-ink">{days(r.late)} late</div>}
    </div>
  );
}

/** Float against the approval needed to hold the on-site date. */
export function FloatChip({ r }: { r: Row }) {
  if (r.bucket === "closed" || r.s.leadWeeks === 0) return null;
  if (r.float >= 0) return <Chip tone="pos">+{r.float} d float</Chip>;
  return <Chip tone="neg">{r.float} d late for site</Chip>;
}

/** 100% stacked bar across the four buckets, with the counts in the label. */
export function BucketBar({ counts, className, label }: { counts: Record<Bucket, number>; className?: string; label: string }) {
  const total = BUCKET_ORDER.reduce((a, b) => a + counts[b], 0);
  return (
    <div
      role="img"
      aria-label={`${label}: ${BUCKET_ORDER.map((b) => `${counts[b]} ${BUCKETS[b].short.toLowerCase()}`).join(", ")}`}
      className={cx("flex h-3 w-full overflow-hidden rounded-xs bg-sunk", className)}
    >
      {BUCKET_ORDER.map((b) =>
        counts[b] ? (
          <span
            key={b}
            className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] border-r-2 border-surface last:border-r-0"
            style={{ width: `${(counts[b] / Math.max(1, total)) * 100}%`, background: BUCKETS[b].color }}
          />
        ) : null,
      )}
    </div>
  );
}

export function PartyLine({ name, role, className }: { name: string; role?: string; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="truncate text-sm text-ink">{name}</div>
      {role && <div className="truncate text-xs text-ink-3">{role}</div>}
    </div>
  );
}

export const partyRole = (p: Party) => (p.kind === "staff" ? "Owner review" : p.role);

/** Reviewer route picker: checkboxes in route order, numbered as they will review. */
export function RoutePicker({
  options,
  value,
  onChange,
  names,
  invalid,
}: {
  options: Party[];
  value: Party[];
  onChange: (v: Party[]) => void;
  names: (p: Party) => string;
  invalid?: boolean;
}) {
  const on = new Set(value.map((p) => p.id));
  const ordered = options.filter((o) => on.has(o.id));
  return (
    <fieldset aria-invalid={invalid || undefined}>
      <legend className="text-sm font-semibold text-ink">Review route</legend>
      <p className="text-xs text-ink-3">Consultants first, then the lead design reviewer, then the Owner. The most restrictive action governs.</p>
      <ul className="mt-2 space-y-1">
        {options.map((o) => {
          const i = ordered.findIndex((x) => x.id === o.id);
          return (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={on.has(o.id)}
                  onChange={(e) => onChange(e.target.checked ? options.filter((x) => on.has(x.id) || x.id === o.id) : value.filter((x) => x.id !== o.id))}
                />
                <span className={cx("num inline-flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold", i >= 0 ? "bg-accent-tint text-accent-ink" : "bg-sunk text-ink-4")}>
                  {i >= 0 ? i + 1 : "–"}
                </span>
                <PartyLine name={names(o)} role={partyRole(o)} />
              </label>
            </li>
          );
        })}
      </ul>
      {invalid && <p className="mt-1 text-xs font-medium text-neg-ink">Pick at least one reviewer.</p>}
    </fieldset>
  );
}

/** Radio cards for the five action codes. */
export function ActionPicker({ value, onChange, name }: { value: ReviewAction | null; onChange: (a: ReviewAction) => void; name: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Action</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTION_ORDER.map((code) => {
          const a = REVIEW_ACTIONS[code];
          const on = value === code;
          return (
            <label
              key={code}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-[var(--dur-fast)]",
                on ? "border-accent bg-accent-wash" : "border-line-strong hover:border-slate hover:bg-surface-2",
              )}
            >
              <input type="radio" name={name} className="mt-0.5 size-4 accent-[var(--accent)]" checked={on} onChange={() => onChange(code)} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="num">{code}</span> {a.label}
                </span>
                <span className="block text-xs text-ink-3">
                  {a.long}
                  {!a.closes && " · stays open"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A labelled fact for the drawer headers. */
export function MiniFact({ label, children, tip }: { label: string; children: ReactNode; tip?: string }) {
  const dt = <dt className="text-xs text-ink-3">{label}</dt>;
  return (
    <div className="min-w-0">
      {tip ? (
        <Tooltip label={tip}>
          <dt tabIndex={0} className="w-fit cursor-help text-xs text-ink-3 underline decoration-line-strong decoration-dotted underline-offset-2">
            {label}
          </dt>
        </Tooltip>
      ) : (
        dt
      )}
      <dd className="num mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
