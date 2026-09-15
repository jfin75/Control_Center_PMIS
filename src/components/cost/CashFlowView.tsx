"use client";

import { useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltip, GRID, moneyTick } from "@/components/charts/chartKit";
import { Em, Legend, Narrative } from "@/components/ui/data";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { cx, fmtDate, money, monthLabel, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { cashFlow } from "@/mock/finance";
import { TODAY } from "@/mock/org";
import { PROJECTS } from "@/mock/projects";
import { CostFrame, useProjectParam } from "./CostFrame";

const NOW_MONTH = `${TODAY.slice(0, 7)}-01`;

export function CashFlowView() {
  const [project, setProject] = useProjectParam();
  const [mode, setMode] = useState<"cumulative" | "monthly">("cumulative");
  const data = cashFlow(project);
  const past = data.filter((d) => d.actualCum !== null);
  const last = past[past.length - 1];
  const plannedToDate = last?.plannedCum ?? 0;
  const actualToDate = last?.actualCum ?? 0;
  const next12 = data.filter((d) => d.month >= NOW_MONTH).slice(0, 12);
  const next12Total = next12.reduce((a, d) => a + (d.forecast ?? 0), 0);
  const gap = actualToDate / Math.max(1, plannedToDate) - 1;

  // Behind-plan contributors, for the narrative.
  const laggards = PROJECTS.filter((p) => project === "all" || p.id === project)
    .map((p) => {
      const s = cashFlow(p.id).filter((d) => d.actualCum !== null);
      const l = s[s.length - 1];
      return { p, gap: l ? (l.actualCum ?? 0) - l.plannedCum : 0 };
    })
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 2)
    .filter((x) => x.gap < 0);

  const chartData = data.map((d) => ({ ...d, planned: d.planned || null }));

  const exportCsv = () =>
    downloadCsv(
      `cash-flow-${project}.csv`,
      ["Month", "Planned (monthly)", "Actual (monthly)", "Forecast (monthly)", "Planned (cumulative)", "Actual (cumulative)", "Forecast (cumulative)"],
      data.map((d) => [d.month.slice(0, 7), d.planned, d.actual ?? "", d.forecast ?? "", d.plannedCum, d.actualCum ?? "", d.forecastCum ?? ""]),
    );

  return (
    <CostFrame onExport={exportCsv}>
      <Panel className="mb-5">
        <Narrative>
          Through {fmtDate(last?.month ?? TODAY, "month")}, <Em>{money(actualToDate, { compact: true })}</Em> has been paid against a <Em>{money(plannedToDate, { compact: true })}</Em> baseline —
          spend is running{" "}
          <Em tone={gap < -0.1 ? "neg" : "accent"}>
            {pct(Math.abs(gap))} {gap < 0 ? "behind" : "ahead of"}
          </Em>{" "}
          plan{laggards.length ? <>, mostly {laggards.map((l) => l.p.name).join(" and ")}</> : null}. The next 12 months forecast <Em>{money(next12Total, { compact: true })}</Em>.
        </Narrative>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Panel
          title="Cash flow S-curve"
          info="Planned baseline spends the approved budget (C) over the baseline schedule. Actuals are payments (I). Forecast spreads the remaining EAC (G − I) to the forecast finish."
          actions={
            <Segmented
              label="Chart mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "cumulative", label: "Cumulative" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          }
        >
          <Legend
            className="mb-3"
            items={[
              { label: "Planned baseline", color: "var(--c-navy-500)", dashed: mode === "cumulative" },
              { label: "Actual (paid)", color: "var(--c-cobalt-500)" },
              { label: "12-month forecast", color: "var(--c-sky-400)", dashed: mode === "cumulative" },
            ]}
          />
          <div className="h-[22rem]">
            <ResponsiveContainer width="100%" height="100%" debounce={120}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tickFormatter={moneyTick} {...AXIS} width={60} />
                <Tooltip content={<ChartTooltip labelFormat={(l) => fmtDate(String(l), "month")} />} cursor={{ fill: "var(--accent-wash)" }} />
                <ReferenceLine x={NOW_MONTH} stroke="var(--ink-3)" strokeDasharray="3 3" label={{ value: "Today", position: "insideTopLeft", fill: "var(--ink-2)", fontSize: 11, fontWeight: 600 }} />
                {mode === "cumulative" ? (
                  <>
                    <Line type="monotone" dataKey="plannedCum" name="Planned baseline" stroke="var(--c-navy-500)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="actualCum" name="Actual (paid)" stroke="var(--c-cobalt-500)" strokeWidth={3.5} fill="var(--c-cobalt-500)" fillOpacity={0.1} dot={false} connectNulls={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="forecastCum" name="Forecast" stroke="var(--c-sky-400)" strokeWidth={3} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="actual" name="Actual (paid)" fill="var(--c-cobalt-500)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="forecast" name="Forecast" fill="var(--c-sky-400)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line type="monotone" dataKey="planned" name="Planned baseline" stroke="var(--c-navy-500)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Next 12 months" flush>
          <table className="dt compact">
            <thead>
              <tr>
                <th>Month</th>
                <th className="r">Forecast</th>
                <th className="r">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {next12.map((d) => (
                <tr key={d.month}>
                  <td className="num font-semibold text-ink">{fmtDate(d.month, "month")}</td>
                  <td className="r">{money(d.forecast ?? 0, { compact: true })}</td>
                  <td className="r text-ink-2">{money(d.forecastCum ?? 0, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="r num">{money(next12Total, { compact: true })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Panel>
      </div>

      {project === "all" && <QuarterTable onPick={setProject} />}
    </CostFrame>
  );
}

function QuarterTable({ onPick }: { onPick: (id: string) => void }) {
  // Fiscal quarters (FY starts July): Q2 FY27 = Oct–Dec 2026, etc.
  const quarters = [
    { label: "Q1 FY27", months: ["2026-09-01"], note: "Sep only" },
    { label: "Q2 FY27", months: ["2026-10-01", "2026-11-01", "2026-12-01"] },
    { label: "Q3 FY27", months: ["2027-01-01", "2027-02-01", "2027-03-01"] },
    { label: "Q4 FY27", months: ["2027-04-01", "2027-05-01", "2027-06-01"] },
    { label: "Q1 FY28", months: ["2027-07-01", "2027-08-01", "2027-09-01"] },
  ];
  const rows = PROJECTS.map((p) => {
    const cf = cashFlow(p.id);
    const q = quarters.map((qq) => cf.filter((d) => qq.months.includes(d.month)).reduce((a, d) => a + (d.forecast ?? 0), 0));
    return { p, q, total: q.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.flatMap((r) => r.q), 1);
  const totals = quarters.map((_, i) => rows.reduce((a, r) => a + r.q[i]!, 0));

  return (
    <Panel className="mt-5" title="Forecast spend by fiscal quarter" info="For Treasury draw planning. Cell shading scales with spend." flush>
      <div className="scroll-x">
        <table className="dt min-w-[52rem]">
          <thead>
            <tr>
              <th>Project</th>
              {quarters.map((q) => (
                <th key={q.label} className="r">
                  {q.label}
                  {q.note && <span className="block font-normal">{q.note}</span>}
                </th>
              ))}
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id} className="row-link cursor-pointer" onClick={() => onPick(r.p.id)}>
                <td>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onPick(r.p.id); }} className="text-left font-semibold text-ink hover:text-accent-ink">
                    {r.p.name}
                  </button>
                </td>
                {r.q.map((v, i) => (
                  <td key={i} className="r">
                    <span
                      className={cx("inline-block min-w-16 rounded-xs px-2 py-0.5", v === 0 && "text-ink-4")}
                      style={{ background: v ? `color-mix(in srgb, var(--c-cobalt-500) ${Math.round((v / max) * 38) + 6}%, transparent)` : undefined }}
                    >
                      {v ? money(v, { compact: true }) : "–"}
                    </span>
                  </td>
                ))}
                <td className="r font-semibold text-ink">{money(r.total, { compact: true })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Program</td>
              {totals.map((t, i) => (
                <td key={i} className="r num">
                  {money(t, { compact: true })}
                </td>
              ))}
              <td className="r num">{money(totals.reduce((a, b) => a + b, 0), { compact: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}
