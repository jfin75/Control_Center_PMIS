"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Avatar, Badge, type Tone } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/overlay";
import { cx, fmtDate, pct } from "@/lib/format";
import { leaveNote, peakUtil, statusOf, WEEKS, type LoadStatus, type StaffLoad } from "@/lib/workload";
import { hrs, phaseColor, WeekBars } from "./parts";

const STATUS: Record<LoadStatus, { tone: Tone; label: (over: number) => string }> = {
  over: { tone: "neg", label: (d) => `Over by ${hrs(d)} h` },
  at: { tone: "warn", label: () => "At capacity" },
  available: { tone: "pos", label: (d) => `${hrs(-d)} h open` },
};

export function StaffCard({
  s,
  week,
  barMax,
  sparkMax,
  onReassign,
}: {
  s: StaffLoad;
  week: number;
  /** Shared hour scale so bars compare across cards. */
  barMax: number;
  sparkMax: number;
  onReassign: () => void;
}) {
  const load = s.load[week] ?? 0;
  const cap = s.capacity[week] ?? 0;
  const util = cap > 0 ? load / cap : load > 0 ? Number.POSITIVE_INFINITY : 0;
  const status = statusOf(util);
  const live = s.items.filter((a) => (a.hours[week] ?? 0) > 0).sort((a, b) => b.hours[week]! - a.hours[week]!);
  const later = s.items.filter((a) => (a.hours[week] ?? 0) === 0 && a.hours.slice(week).some((h) => h > 0));
  const peak = peakUtil(s.load, s.capacity);
  const note = leaveNote(s.personId, WEEKS[week]!);
  const overLimit = live.length > s.maxProjects;
  const headingId = `pm-${s.personId}`;

  return (
    <article aria-labelledby={headingId} className="panel flex min-w-0 flex-col">
      <header className="flex items-start gap-3 px-5 pt-4 pb-3">
        <Avatar name={s.person.name} tone={s.person.tone} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="truncate text-md font-semibold text-ink">
            {s.person.name}
          </h3>
          <p className="truncate text-xs text-ink-3">
            {s.person.title} · <span className="num">{s.fte.toFixed(1)}</span> FTE
          </p>
        </div>
        <Badge tone={STATUS[status].tone}>{STATUS[status].label(load - cap)}</Badge>
      </header>

      <div className="flex-1 space-y-4 px-5 pb-4">
        {/* Hours this week against capacity */}
        <div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs text-ink-3">
              <span className="num block text-[1.625rem] leading-9 font-semibold tracking-[-0.02em] text-ink">
                {hrs(load)}
                <span className="ml-1 text-sm font-semibold text-ink-3">h/wk</span>
              </span>
              of <span className="num font-semibold text-ink-2">{hrs(cap)} h</span> project capacity{note && <> · {note}</>}
            </p>
            <p className={cx("num text-right text-xl font-semibold", status === "over" ? "text-neg-ink" : status === "at" ? "text-warn-ink" : "text-pos-ink")}>
              {Number.isFinite(util) ? pct(util) : "—"}
              <span className="block text-2xs font-semibold text-ink-3">utilized</span>
            </p>
          </div>
          <div className="relative mt-2 flex h-6 overflow-hidden rounded-xs bg-sunk" role="img" aria-label={`${hrs(load)} of ${hrs(cap)} hours: ${live.map((a) => `${a.item.name} ${hrs(a.hours[week]!)} h`).join(", ") || "no project work"}`}>
            {live.map((a) => (
              <Tooltip key={a.item.id} label={`${a.item.name} · ${hrs(a.hours[week]!)} h`}>
                <span
                  tabIndex={-1}
                  className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] border-r-2 border-surface last:border-r-0"
                  style={{ width: `${(a.hours[week]! / barMax) * 100}%`, background: phaseColor(a.item.phases[week]) }}
                />
              </Tooltip>
            ))}
            <span aria-hidden className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${Math.min(1, cap / barMax) * 100}% - 1px)` }} />
          </div>
          <div className="relative mt-1 h-4 text-2xs font-semibold text-ink-3">
            <span className="num absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(0.92, Math.max(0.08, cap / barMax)) * 100}%` }}>
              Capacity {hrs(cap)} h
            </span>
          </div>
        </div>

        {/* Project count against the PMO limit */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1" role="img" aria-label={`${live.length} active projects, limit ${s.maxProjects}`}>
            {Array.from({ length: Math.max(s.maxProjects, live.length) }, (_, i) => {
              const a = live[i];
              return (
                <span
                  key={i}
                  className={cx("size-3.5 rounded-full", !a && "border-[1.5px] border-dashed border-line-strong", a && i >= s.maxProjects && "ring-2 ring-neg ring-offset-1 ring-offset-surface")}
                  style={a ? { background: phaseColor(a.item.phases[week]) } : undefined}
                />
              );
            })}
          </div>
          <p className={cx("text-xs", overLimit ? "font-semibold text-neg-ink" : "text-ink-2")}>
            <span className="num font-bold text-ink">{live.length}</span> {live.length === 1 ? "project" : "projects"} of {s.maxProjects} limit
          </p>
        </div>

        {live.length ? (
          <ul className="space-y-1.5">
            {live.map((a) => (
              <li key={a.item.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: phaseColor(a.item.phases[week]) }} />
                <Link href={a.item.href} className="min-w-0 flex-1 truncate text-ink hover:text-accent-ink">
                  {a.item.name}
                </Link>
                <span className="shrink-0 text-2xs text-ink-3">{a.item.phases[week]}</span>
                <span className="num w-10 shrink-0 text-right text-xs font-bold text-ink">{hrs(a.hours[week]!)} h</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No project work this week.</p>
        )}
        {later.length > 0 && (
          <p className="text-xs text-ink-3">
            Starting later:{" "}
            {later.map((a, i) => (
              <span key={a.item.id}>
                {i > 0 && ", "}
                <span className="text-ink-2">{a.item.name}</span> ({fmtDate(WEEKS[a.hours.findIndex((h, w) => w >= week && h > 0)]!, "short")})
              </span>
            ))}
          </p>
        )}

        {/* Twelve-month projection */}
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-2xs font-semibold text-ink-3">
            <span>Next 12 months</span>
            <span className={cx("num", peak.util > 1 && "text-neg-ink")}>
              Peak {pct(peak.util)} · 4 wks from {fmtDate(WEEKS[peak.week]!, "short")}
            </span>
          </div>
          <WeekBars
            values={s.load}
            capacity={s.capacity}
            max={sparkMax}
            marker={week}
            className="h-12"
            label={`${s.person.name}'s projected weekly hours for the next 12 months, peaking at ${pct(peak.util)} of capacity`}
          />
          <div className="mt-1 flex justify-between text-2xs text-ink-3">
            <span>{fmtDate(WEEKS[0]!, "month")}</span>
            <span>{fmtDate(WEEKS[WEEKS.length - 1]!, "month")}</span>
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-2.5">
        <span className="text-xs text-ink-3">
          <span className="num font-semibold text-ink-2">{s.items.length}</span> assignments in the next year
        </span>
        <Button size="sm" variant="ghost" icon={<ArrowDown className="size-3.5" aria-hidden />} onClick={onReassign}>
          Reassign work
        </Button>
      </footer>
    </article>
  );
}
