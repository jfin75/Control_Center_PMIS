"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { Badge, Chip } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { cx, fmtDate, money, pct } from "@/lib/format";
import { peakOf, peakUtil, suggestAssignments, WEEKS, type Assigned, type Plan, type StaffLoad, type Workload } from "@/lib/workload";
import { propertyById } from "@/mock/properties";
import { PHASE_HOURS, PROJECT_HOURS_PER_FTE, SIZE_BANDS } from "@/mock/workload";
import { hrs, phaseColor, WeekBars } from "./parts";

type Kind = "all" | "unassigned" | "project" | "planning";

interface Row extends Assigned {
  pmId: string | null;
}

export function AssignPanel({
  wl,
  plan,
  setPlan,
  week,
  pmFilter,
  setPmFilter,
}: {
  wl: Workload;
  plan: Plan;
  setPlan: (fn: (p: Plan) => Plan) => void;
  week: number;
  pmFilter: string;
  setPmFilter: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("all");
  const [unplaced, setUnplaced] = useState<string[] | null>(null);

  const rows: Row[] = useMemo(
    () => [...wl.staff.flatMap((s) => s.items.map((a) => ({ ...a, pmId: s.personId }))), ...wl.unassigned.map((a) => ({ ...a, pmId: null }))],
    [wl],
  );
  const counts = {
    all: rows.length,
    unassigned: rows.filter((r) => !r.pmId).length,
    project: rows.filter((r) => r.item.kind === "project").length,
    planning: rows.filter((r) => r.item.kind === "planning").length,
  };
  const shown = rows
    .filter((r) => (kind === "all" ? true : kind === "unassigned" ? !r.pmId : r.item.kind === kind))
    .filter((r) => (pmFilter === "all" ? true : r.pmId === pmFilter))
    .sort((a, b) => Number(!!a.pmId) - Number(!!b.pmId) || (b.hours[week] ?? 0) - (a.hours[week] ?? 0) || peakOf(b.hours) - peakOf(a.hours));
  const sparkMax = Math.max(...rows.map((r) => peakOf(r.hours)), 1);
  const weekTotal = shown.reduce((a, r) => a + (r.hours[week] ?? 0), 0);
  const changed = Object.keys(plan.assign).length + Object.keys(plan.scale).length;
  const staffName = (id: string | null) => wl.staff.find((s) => s.personId === id)?.person.name ?? "Unassigned";

  function assign(r: Row, pmId: string | null) {
    setPlan((p) => {
      const assignNext = { ...p.assign };
      if (pmId === r.item.basePmId) delete assignNext[r.item.id];
      else assignNext[r.item.id] = pmId;
      return { ...p, assign: assignNext };
    });
    const h = r.hours[week] ?? 0;
    toast(`${r.item.name} → ${staffName(pmId)}${h ? ` (${hrs(h)} h/wk)` : ""}`);
  }

  function rescale(r: Row, peak: number) {
    const model = peakOf(r.item.weekly);
    if (!model) return;
    setPlan((p) => {
      const scale = { ...p.scale };
      const f = peak / model;
      if (Math.abs(f - 1) < 0.001) delete scale[r.item.id];
      else scale[r.item.id] = f;
      return { ...p, scale };
    });
  }

  function suggest() {
    const res = suggestAssignments(plan);
    setPlan(() => res.plan);
    setUnplaced(res.unplaced);
    toast(res.placed.length ? `Assigned ${res.placed.length} ${res.placed.length === 1 ? "project" : "projects"} where capacity allows` : "No PM has room for the unassigned work");
  }

  // Clear the "couldn't place" note once someone assigns that work by hand.
  useEffect(() => {
    if (unplaced && unplaced.every((id) => !rows.some((r) => r.item.id === id && !r.pmId))) setUnplaced(null);
  }, [rows, unplaced]);

  const unplacedRows = rows.filter((r) => !r.pmId && unplaced?.includes(r.item.id));
  // Combined, not summed: these requests peak in different weeks.
  const unplacedPeak = peakOf(WEEKS.map((_, w) => unplacedRows.reduce((a, r) => a + (r.hours[w] ?? 0), 0)));

  return (
    <Panel
      id="assign"
      title="Assign projects"
      info={`Estimated Owner PM hours per week = phase standard × size factor × project-type factor. Phase standards: ${Object.entries(PHASE_HOURS)
        .map(([k, v]) => `${k} ${v} h`)
        .join(", ")}. Size: ${SIZE_BANDS.map((b) => `${b.label} ×${b.factor}`).join(", ")}. Edit the peak to override a project's estimate.`}
      flush
      actions={
        <>
          <Button variant="ghost" icon={<RotateCcw className="size-3.5" aria-hidden />} disabled={!changed} onClick={() => { setPlan(() => ({ assign: {}, scale: {} })); setUnplaced(null); toast("Assignments reset to the project records"); }}>
            Reset
          </Button>
          <Button variant="tint" icon={<Sparkles className="size-3.5" aria-hidden />} disabled={!counts.unassigned} onClick={suggest}>
            Suggest assignments
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<Kind>
            label="Show"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "unassigned", label: "Needs PM", count: counts.unassigned },
              { value: "project", label: "Active", count: counts.project },
              { value: "planning", label: "Planning", count: counts.planning },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Project manager
          <select className="field w-44" value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}>
            <option value="all">Everyone</option>
            {wl.staff.map((s) => (
              <option key={s.personId} value={s.personId}>
                {s.person.name}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-xs text-ink-3">
          Hours and phase for the week of <span className="font-semibold text-ink-2">{fmtDate(WEEKS[week]!)}</span>
        </p>
      </div>

      {unplaced && unplacedRows.length > 0 && (
        <p role="status" className="mx-5 mb-3 rounded-md bg-warn-tint px-3 py-2 text-xs text-warn-ink">
          <span className="font-bold">{unplacedRows.length} {unplacedRows.length === 1 ? "request doesn't" : "requests don't"} fit</span> without pushing a PM past capacity or their project limit: {unplacedRows.map((r) => r.item.name).join(", ")}. Together they peak at about{" "}
          <span className="num font-bold">{(unplacedPeak / PROJECT_HOURS_PER_FTE).toFixed(1)} FTE</span> of new capacity to hire, contract, or defer.
        </p>
      )}

      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[66rem]">
          <thead>
            <tr>
              <th className="min-w-[17rem]">Project</th>
              <th>Phase</th>
              <th className="r whitespace-nowrap">Wk of {fmtDate(WEEKS[week]!, "short")}</th>
              <th className="r w-24">Peak h/wk</th>
              <th className="min-w-[15rem]">Project manager</th>
              <th className="w-36">Effort, next 12 months</th>
              <th>Delivery window</th>
              <th className="r">Budget</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const h = r.hours[week] ?? 0;
              const phase = r.item.phases[week];
              const firstWeek = r.hours.findIndex((x) => x > 0);
              const changedPm = r.item.id in plan.assign;
              const scaled = r.item.id in plan.scale;
              const prop = propertyById(r.item.propertyId);
              return (
                <tr key={r.item.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link href={r.item.href} className="min-w-0 truncate font-semibold text-ink hover:text-accent-ink">
                        {r.item.name}
                      </Link>
                      {!r.pmId && <Badge tone="warn">Needs PM</Badge>}
                      {changedPm && r.pmId && <Chip tone="accent">Changed</Chip>}
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      {r.item.kind === "project" ? r.item.code : "Planning request"} · {prop?.name ?? "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {phase ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                        <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: phaseColor(phase) }} />
                        {phase}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">{firstWeek > week ? `Starts ${fmtDate(WEEKS[firstWeek]!, "short")}` : "Complete"}</span>
                    )}
                  </td>
                  <td className={cx("r font-bold", h ? "text-ink" : "text-ink-4")}>{hrs(h)}</td>
                  <td className="r">
                    <EffortInput value={peakOf(r.hours)} onCommit={(v) => rescale(r, v)} label={`Peak weekly hours for ${r.item.name}`} />
                    {scaled && (
                      <button type="button" onClick={() => rescale(r, peakOf(r.item.weekly))} className="mt-0.5 inline-flex items-center gap-1 text-2xs font-semibold text-accent-ink hover:underline">
                        <Undo2 className="size-3" aria-hidden />
                        Model {hrs(peakOf(r.item.weekly))}
                      </button>
                    )}
                  </td>
                  <td>
                    <select aria-label={`Project manager for ${r.item.name}`} className="field w-full" value={r.pmId ?? ""} onChange={(e) => assign(r, e.target.value || null)}>
                      <option value="">Unassigned</option>
                      {wl.staff.map((s) => (
                        <option key={s.personId} value={s.personId}>
                          {s.person.name} — {optionImpact(s, r, week)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <WeekBars values={r.hours} max={sparkMax} marker={week} className="h-6 w-32" label={`Weekly hours for ${r.item.name}, peaking at ${hrs(peakOf(r.hours))} h`} />
                  </td>
                  <td className="num whitespace-nowrap text-xs text-ink-2">
                    {fmtDate(r.item.start, "month")} – {fmtDate(r.item.finish, "month")}
                  </td>
                  <td className="r text-ink-2">{money(r.item.budget, { compact: true })}</td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-ink-2">
                  {kind === "unassigned" ? "Every project in the next 12 months has a PM." : "No projects match these filters."}
                </td>
              </tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="text-ink-2">
                  {shown.length} {shown.length === 1 ? "project" : "projects"}
                </td>
                <td className="r num">{hrs(weekTotal)}</td>
                <td colSpan={5} className="text-xs font-semibold text-ink-3">
                  h/wk · {(weekTotal / PROJECT_HOURS_PER_FTE).toFixed(1)} FTE
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Panel>
  );
}

/** What taking this project would do to a PM: this week's utilization if the work is live, otherwise their 4-week peak. */
function optionImpact(s: StaffLoad, r: Row, week: number): string {
  const cap = s.capacity[week] ?? 0;
  const now = cap ? (s.load[week] ?? 0) / cap : 0;
  const h = r.hours[week] ?? 0;
  if (s.personId === r.pmId) return `${pct(now)} (current)`;
  if (h > 0) return `${pct(now)} → ${pct(((s.load[week] ?? 0) + h) / Math.max(1, cap))}`;
  const before = peakUtil(s.load, s.capacity).util;
  const after = peakUtil(
    s.load.map((x, w) => x + (r.hours[w] ?? 0)),
    s.capacity,
  ).util;
  return `peak ${pct(before)} → ${pct(after)}`;
}

/** Commits on blur or Enter so a half-typed number never reshapes the forecast. */
function EffortInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(draft) * 2) / 2;
    if (draft.trim() === "" || !Number.isFinite(n) || n < 0) return setDraft(String(value));
    if (n !== value) onCommit(Math.min(60, n));
  };
  return (
    <input
      aria-label={label}
      type="number"
      inputMode="decimal"
      min={0}
      max={60}
      step={0.5}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(String(value));
      }}
      className="field num h-8 w-20 px-2 text-right"
    />
  );
}
