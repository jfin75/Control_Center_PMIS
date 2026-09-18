"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltip, GRID } from "@/components/charts/chartKit";
import { Chip, Em, KpiStrip, Legend, Narrative } from "@/components/ui/data";
import { Button, IconButton, Segmented } from "@/components/ui/controls";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/Panel";
import { downloadCsv } from "@/lib/exporters";
import { fmtDate, monthLabel, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { computeWorkload, EMPTY_PLAN, peakGap, peakOf, pmOf, teamAt, WEEKS, WINDOW, WORK_ITEMS, type Plan } from "@/lib/workload";
import { AT_CAPACITY, PM_STAFF, PROJECT_HOURS_PER_FTE } from "@/mock/workload";
import { AssignPanel } from "./AssignPanel";
import { hrs, PHASE_GROUPS } from "./parts";
import { StaffCard } from "./StaffCard";

const PRESETS = [
  { value: "0", label: "Now" },
  { value: "13", label: "+3 mo" },
  { value: "26", label: "+6 mo" },
  { value: "39", label: "+9 mo" },
];

const PM_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-6)", "var(--series-7)"];
const UNASSIGNED_COLOR = "var(--c-slate-400)";

const fte = (h: number) => (h / PROJECT_HOURS_PER_FTE).toFixed(1);
const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function WorkloadView() {
  const [plan, setPlan] = useStoredState<Plan>("cc.workload.v1", EMPTY_PLAN);
  const [week, setWeek] = useState(0);
  const [pmFilter, setPmFilter] = useState("all");

  const wl = useMemo(() => computeWorkload(plan), [plan]);
  const t = teamAt(wl, week);
  const peak = peakGap(wl);
  const staffCount = PM_STAFF.length;

  const barMax = Math.max(...wl.staff.map((s) => Math.max(s.load[week] ?? 0, s.capacity[week] ?? 0)), 1) * 1.08;
  const sparkMax = Math.max(...wl.staff.flatMap((s) => [...s.load, ...s.capacity]), 1);
  const unassignedAhead = peakOf(wl.unassignedLoad.slice(week));
  const when = week === 0 ? "this week" : `the week of ${fmtDate(WEEKS[week]!, "short")}`;

  const over = wl.staff.filter((s) => (s.load[week] ?? 0) > (s.capacity[week] ?? 0));
  const open = wl.staff.filter((s) => (s.capacity[week] ?? 0) > 0 && (s.load[week] ?? 0) < (s.capacity[week] ?? 0) * AT_CAPACITY);

  const chartData = WEEKS.map((w, i) => ({
    week: w,
    ...Object.fromEntries(wl.staff.map((s) => [s.personId, s.load[i]])),
    unassigned: wl.unassignedLoad[i],
    capacity: wl.staff.reduce((a, s) => a + (s.capacity[i] ?? 0), 0),
  }));
  const monthTicks = WEEKS.filter((w, i) => i === 0 || w.slice(5, 7) !== WEEKS[i - 1]!.slice(5, 7));
  const names = new Map<string, string>([...wl.staff.map((s) => [s.personId, s.person.name] as const), ["unassigned", "Unassigned"], ["capacity", "Project capacity"]]);

  const activeProjects = WORK_ITEMS.filter((i) => i.kind === "project").length;
  const requests = WORK_ITEMS.filter((i) => i.kind === "planning").length;
  const presetValue = PRESETS.some((p) => Number(p.value) === week) ? String(week) : "custom";

  const exportCsv = () =>
    downloadCsv(
      `pm-workload-${WEEKS[week]}.csv`,
      ["Project", "Code", "Type", "Project manager", "Phase (week of " + WEEKS[week] + ")", "Hours/week", "Peak hours/week", "Budget", "Start", "Finish"],
      WORK_ITEMS.map((i) => {
        const h = wl.staff.flatMap((s) => s.items).concat(wl.unassigned).find((a) => a.item.id === i.id)?.hours ?? i.weekly;
        const pm = pmOf(i, plan);
        return [i.name, i.kind === "project" ? i.code : "", i.kind === "project" ? "Active project" : "Planning request", pm ? (names.get(pm) ?? pm) : "Unassigned", i.phases[week] ?? "", h[week] ?? 0, peakOf(h), Math.round(i.budget), i.start, i.finish];
      }),
    );

  const reassign = (personId: string) => {
    setPmFilter(personId);
    document.getElementById("assign")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        title="Workload"
        meta={`${staffCount} project managers · ${activeProjects} active projects · ${requests} planning requests · Owner PM hours per week`}
        actions={
          <>
            <div className="flex items-center gap-1">
              <IconButton label="Previous week" variant="secondary" disabled={week === 0} onClick={() => setWeek((w) => Math.max(0, w - 1))}>
                <ChevronLeft className="size-4" aria-hidden />
              </IconButton>
              <span className="num min-w-[9.5rem] text-center text-sm font-semibold text-ink" aria-live="polite">
                Week of {fmtDate(WEEKS[week]!)}
              </span>
              <IconButton label="Next week" variant="secondary" disabled={week === WEEKS.length - 1} onClick={() => setWeek((w) => Math.min(WEEKS.length - 1, w + 1))}>
                <ChevronRight className="size-4" aria-hidden />
              </IconButton>
            </div>
            <Segmented label="Jump to" value={presetValue} onChange={(v) => setWeek(Number(v))} options={PRESETS} />
            <Button icon={<Download className="size-3.5" aria-hidden />} onClick={exportCsv}>
              Export
            </Button>
          </>
        }
      />

      <KpiStrip
        className="mb-5"
        items={[
          {
            label: "Team utilization",
            value: pct(t.assigned / Math.max(1, t.capacity)),
            sub: `${hrs(t.assigned)} h assigned of ${hrs(t.capacity)} h project capacity`,
          },
          {
            label: "Over-assigned",
            value: `${hrs(t.over)} h/wk`,
            chip: t.over > 0 ? <Chip tone="neg">{fte(t.over)} FTE</Chip> : undefined,
            sub: t.overCount ? `${t.overCount} of ${staffCount} PMs over capacity` : "No PM is over capacity",
          },
          {
            label: "FTE shortfall",
            value: `${Math.max(0, t.netGapFte).toFixed(1)} FTE`,
            chip: peak.fte > 0 ? <Chip tone={t.netGapFte > 0 ? "neg" : "warn"}>Peak {peak.fte.toFixed(1)}</Chip> : undefined,
            sub:
              t.netGapFte > 0
                ? `Demand exceeds the whole team; peak ${peak.fte.toFixed(1)} FTE from ${fmtDate(WEEKS[peak.week]!, "short")}`
                : `${(-t.netGapFte).toFixed(1)} FTE spare ${when}; ${peak.fte > 0 ? `${peak.fte.toFixed(1)} FTE short from ${fmtDate(WEEKS[peak.week]!, "month")}` : "no shortfall in 12 months"}`,
          },
          {
            label: "Unassigned work",
            value: `${hrs(t.unassigned)} h/wk`,
            chip: wl.unassigned.length ? <Chip tone="warn">{wl.unassigned.length} need PM</Chip> : undefined,
            sub: !wl.unassigned.length
              ? "Every project has a PM"
              : unassignedAhead > t.unassigned
                ? `Rising to ${hrs(unassignedAhead)} h/wk as requests enter design`
                : `Highest in ${when} for the rest of the horizon`,
          },
          {
            label: "Open capacity",
            value: `${hrs(t.spare)} h/wk`,
            sub: open.length ? `${open.length} ${open.length === 1 ? "PM" : "PMs"} under 85% utilization` : "Nobody under 85% utilization",
          },
        ]}
      />

      <Panel
        title="Demand vs. capacity, next 12 months"
        info={`Stacked projected hours by PM plus unassigned work, against the team's project capacity (40 h less 15% non-project time, net of holidays and approved leave). Peaks use a ${WINDOW}-week average. Click a week to inspect it.`}
        className="mb-8"
        actions={
          <Legend
            items={[
              ...wl.staff.map((s, i) => ({ label: s.person.name, color: PM_COLORS[i % PM_COLORS.length]! })),
              { label: "Unassigned", color: UNASSIGNED_COLOR },
              { label: "Capacity", color: "var(--ink)", dashed: true },
            ]}
          />
        }
      >
        <Narrative className="mb-4 max-w-[80ch] text-md leading-7">
          In the week of {fmtDate(WEEKS[week]!, "short")}, the PM team carries <Em>{hrs(t.assigned)} h</Em> of project work against <Em>{hrs(t.capacity)} h</Em> of capacity.{" "}
          {over.length ? (
            <>
              {list(over.map((s) => s.person.name))} {over.length === 1 ? "is" : "are"} <Em tone="neg">{hrs(t.over)} h over</Em> ({fte(t.over)} FTE)
              {open.length ? <>, while {list(open.map((s) => s.person.name))} {open.length === 1 ? "has" : "have"} room — rebalance before hiring.</> : "."}{" "}
            </>
          ) : (
            <>No one is over capacity. </>
          )}
          {peak.fte > 0 ? (
            <>
              Demand peaks in the {WINDOW} weeks from {fmtDate(WEEKS[peak.week]!)} at <Em tone="neg">{peak.fte.toFixed(1)} FTE</Em> beyond the whole team, a gap reassignment alone can’t close.
            </>
          ) : (
            <>The team can absorb every assigned and unassigned project through {fmtDate(WEEKS[WEEKS.length - 1]!, "month")}.</>
          )}
        </Narrative>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
              onClick={(e) => {
                const i = Number(e?.activeTooltipIndex);
                if (Number.isInteger(i) && i >= 0) setWeek(i);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid {...GRID} />
              <XAxis dataKey="week" {...AXIS} ticks={monthTicks} tickFormatter={(w: string) => monthLabel(w)} minTickGap={12} />
              <YAxis {...AXIS} width={44} tickFormatter={(v: number) => `${v} h`} />
              <Tooltip
                cursor={{ fill: "var(--accent-wash)" }}
                content={(p) => (
                  <ChartTooltip
                    active={p.active}
                    payload={(p.payload as never[] | undefined)?.map((x: { dataKey?: string }) => ({ ...(x as object), name: names.get(String(x.dataKey)) })) as never}
                    label={p.label as string}
                    labelFormat={(l) => `Week of ${fmtDate(String(l))}`}
                    format={(v) => `${hrs(v)} h`}
                  />
                )}
              />
              {wl.staff.map((s, i) => (
                <Area
                  key={s.personId}
                  dataKey={s.personId}
                  stackId="load"
                  type="stepAfter"
                  stroke={PM_COLORS[i % PM_COLORS.length]}
                  fill={PM_COLORS[i % PM_COLORS.length]}
                  fillOpacity={0.85}
                  strokeWidth={0}
                  isAnimationActive={false}
                />
              ))}
              <Area dataKey="unassigned" stackId="load" type="stepAfter" stroke={UNASSIGNED_COLOR} strokeDasharray="4 3" fill={UNASSIGNED_COLOR} fillOpacity={0.3} isAnimationActive={false} />
              <Line dataKey="capacity" type="stepAfter" stroke="var(--ink)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <ReferenceLine x={WEEKS[week]} stroke="var(--accent)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <SectionTitle aside={<Legend items={PHASE_GROUPS.map((g) => ({ label: g.label, color: g.color }))} />}>Project managers</SectionTitle>
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {wl.staff.map((s) => (
          <StaffCard key={s.personId} s={s} week={week} barMax={barMax} sparkMax={sparkMax} onReassign={() => reassign(s.personId)} />
        ))}
      </div>

      <AssignPanel wl={wl} plan={plan} setPlan={setPlan} week={week} pmFilter={pmFilter} setPmFilter={setPmFilter} />
    </>
  );
}
