"use client";

import { Badge, Chip } from "@/components/ui/data";
import { cx, daysBetween, money } from "@/lib/format";
import { projectParties, sideOf, STAGES, type Row, whoName, whoRole, SIDE_LABEL } from "@/lib/rfis";
import { TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { designTeam, PRIORITIES, type RfiPriority, type Who } from "@/mock/rfis";
import { days, shortDate } from "@/components/submittals/parts";

export { days, MiniFact, plural, shortDate } from "@/components/submittals/parts";

export const whoKey = (w: Who) => `${w.kind}:${w.id}`;
export const fromKey = (k: string): Who => {
  const [kind, id] = k.split(":") as ["firm" | "staff", string];
  return { kind, id };
};

export function StageBadge({ x }: { x: Row }) {
  const st = STAGES[x.stage];
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

export function PriorityBadge({ p, quiet }: { p: RfiPriority; quiet?: boolean }) {
  if (quiet && (p === "normal" || p === "low")) return <span className="text-xs text-ink-3">{PRIORITIES[p].label}</span>;
  return (
    <Badge tone={PRIORITIES[p].tone} dot={p === "urgent" || p === "high"}>
      {PRIORITIES[p].label}
    </Badge>
  );
}

/** Cost and schedule impact in one compact chip set. */
export function ImpactChips({ x, className }: { x: Row; className?: string }) {
  const { costImpact, costEstimate, scheduleImpact, scheduleDays, changeRef } = x.r;
  if (costImpact === "none" && scheduleImpact === "none") return null;
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-1", className)}>
      {costImpact !== "none" && (
        <Chip tone={costImpact === "yes" ? "neg" : "warn"}>
          {costImpact === "yes" ? "" : "~"}
          {costEstimate ? money(costEstimate, { compact: true }) : "Cost TBD"}
        </Chip>
      )}
      {scheduleImpact !== "none" && (
        <Chip tone={scheduleImpact === "yes" ? "neg" : "warn"}>
          {scheduleImpact === "yes" ? "" : "~"}
          {scheduleDays ? `${scheduleDays} d` : "Days TBD"}
        </Chip>
      )}
      {changeRef && <Chip tone="neutral">{changeRef}</Chip>}
    </span>
  );
}

/** What the row owes next and by when, with lateness spelled out. */
export function DueCell({ x }: { x: Row }) {
  const r = x.r;
  let label: string;
  let date: string | null;
  let sub: { text: string; tone: "neg" | "warn" | "quiet" } | null = null;
  if (x.stage === "draft") [label, date] = ["Created", r.created];
  else if (x.stage === "awaiting") {
    [label, date] = ["Due", r.due];
    const left = r.due ? daysBetween(TODAY, r.due) : 0;
    sub = x.late > 0 ? { text: `${days(x.late)} late`, tone: "neg" } : left === 0 ? { text: "Due today", tone: "warn" } : { text: `in ${days(left)}`, tone: left <= 2 ? "warn" : "quiet" };
  } else if (x.stage === "info") {
    const req = [...r.entries].reverse().find((e) => e.kind === "request");
    [label, date] = ["Asked", req?.date ?? null];
    if (req) sub = { text: `${days(daysBetween(req.date, TODAY))} with contractor`, tone: "quiet" };
  } else if (x.stage === "answered") {
    [label, date] = ["Answered", x.answeredOn];
    if (x.waitingClose !== null) sub = { text: `${days(x.waitingClose)} to close`, tone: x.waitingClose > 7 ? "warn" : "quiet" };
  } else if (x.stage === "closed") {
    [label, date] = ["Closed", r.closed];
    if (x.daysOpen !== null) sub = { text: `open ${days(x.daysOpen)}`, tone: "quiet" };
  } else [label, date] = ["Void", r.closed];
  return (
    <div className="whitespace-nowrap">
      <div className="num text-ink">
        <span className="text-xs text-ink-3">{label} </span>
        {date ? shortDate(date) : "—"}
      </div>
      {sub && <div className={cx("num text-xs", sub.tone === "neg" ? "font-semibold text-neg-ink" : sub.tone === "warn" ? "font-semibold text-warn-ink" : "text-ink-3")}>{sub.text}</div>}
    </div>
  );
}

export function BallCell({ x }: { x: Row }) {
  if (!x.ball) return <span className="text-ink-4">—</span>;
  return (
    <div className="max-w-[13rem] min-w-0">
      <div className="truncate text-sm text-ink">{x.ball.name}</div>
      <div className="truncate text-xs text-ink-3">{x.ball.why}</div>
    </div>
  );
}

/** Reviewers who can answer: the design team and consultants, then Owner staff. */
export function reviewerOptions(projectId: string): Who[] {
  const p = projectById(projectId);
  if (!p) return [];
  return [...designTeam(p), ...p.team.filter((t) => t.kind === "staff").map((t) => ({ kind: "staff" as const, id: t.refId }))];
}

/** A select of project parties grouped by side. */
export function WhoSelect({
  projectId,
  value,
  onChange,
  options,
  extra = [],
  id,
  className,
  invalid,
}: {
  projectId: string;
  value: Who | null;
  onChange: (w: Who) => void;
  options?: Who[];
  extra?: Who[];
  id?: string;
  className?: string;
  invalid?: boolean;
}) {
  const list = options ?? projectParties(projectId, extra);
  const groups = (["owner", "design", "contractor"] as const).map((side) => ({ side, items: list.filter((w) => sideOf(w) === side) })).filter((g) => g.items.length);
  return (
    <select id={id} className={cx("field w-full", className)} value={value ? whoKey(value) : ""} aria-invalid={invalid || undefined} onChange={(e) => onChange(fromKey(e.target.value))}>
      {!value && <option value="">Choose…</option>}
      {groups.map((g) => (
        <optgroup key={g.side} label={SIDE_LABEL[g.side]}>
          {g.items.map((w) => (
            <option key={whoKey(w)} value={whoKey(w)}>
              {whoName(w)} — {whoRole(w, projectId)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Initials disc tinted by side, for the thread. */
export function WhoDot({ w, className }: { w: Who; className?: string }) {
  const side = sideOf(w);
  const initials = whoName(w)
    .split(/\s+/)
    .filter((s) => /^[A-Z]/.test(s))
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold",
        side === "owner" ? "bg-accent-tint text-accent-ink" : side === "design" ? "bg-[var(--c-teal-100)] text-[var(--c-teal-700)]" : "bg-sunk text-ink-2",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export const projectCode = (id: string) => projectById(id)?.code ?? id;
