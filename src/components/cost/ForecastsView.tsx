"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, AXIS, GRID, moneyTick } from "@/components/charts/chartKit";
import { Badge, Em, KpiStrip, Legend, Narrative } from "@/components/ui/data";
import { Panel } from "@/components/ui/Panel";
import { chain, sumChain } from "@/lib/budget";
import { cx, fmtDate, money, monthLabel, num, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { finishSlip } from "@/lib/selectors";
import { contingencyFor, forecastHistory } from "@/mock/finance";
import { PROJECTS, SCHEDULE_STATUS } from "@/mock/projects";
import { CostFrame, useProjectParam } from "./CostFrame";

export function ForecastsView() {
  const [project, setProject] = useProjectParam();
  const projects = project === "all" ? PROJECTS : PROJECTS.filter((p) => p.id === project);
  const t = sumChain(projects.map((p) => p.totals));
  const etc = t.G - t.I;
  const history = forecastHistory(project);
  const buckets = contingencyFor(project);
  const spi = projects.reduce((a, p) => a + p.spi * chain(p.totals).C, 0) / Math.max(1, t.C);

  const [likelihood, setLikelihood] = useState(70);
  const [realization, setRealization] = useState(35);
  const cOriginal = buckets.reduce((a, b) => a + b.original, 0);
  const cDrawn = buckets.reduce((a, b) => a + b.drawn, 0);
  const pending = buckets.reduce((a, b) => a + b.pending, 0);
  const risks = projects.flatMap((p) => p.risks.filter((r) => r.status !== "Closed"));
  const riskWeighted = risks.reduce((a, r) => a + r.costExposure * (r.probability / 5), 0);
  const expPending = pending * (likelihood / 100);
  const expRisk = riskWeighted * (realization / 100);
  const available = Math.max(0, cOriginal - cDrawn);
  const after = available - expPending - expRisk;
  const coverage = available / Math.max(1, expPending + expRisk);

  const exportCsv = () =>
    downloadCsv(
      "forecasts.csv",
      ["Project", "Approved (C)", "Forecast at completion (G)", "Variance (H)", "Estimate to complete (G−I)", "Paid (I)", "SPI", "Physical complete", "Baseline finish", "Forecast finish", "Slip (days)"],
      projects.map((p) => {
        const c = chain(p.totals);
        return [p.name, c.C, c.G, c.H, c.G - c.I, c.I, p.spi, p.physicalComplete, p.baselineFinish, p.forecastFinish, finishSlip(p)];
      }),
    );

  return (
    <CostFrame onExport={exportCsv}>
      <KpiStrip
        className="mb-5"
        items={[
          { label: "Estimate at completion (G)", value: money(t.G, { compact: true }), sub: `vs ${money(t.C, { compact: true })} approved` },
          { label: "Estimate to complete (G − I)", value: money(etc, { compact: true }), sub: `${pct(etc / t.G)} of EAC still to pay` },
          { label: "Variance at completion (H)", value: <span className={t.H < 0 ? "text-neg-ink" : undefined}>{money(t.H, { compact: true })}</span>, sub: pct(t.H / t.C, 1) + " of approved" },
          { label: "Contingency available", value: money(available, { compact: true }), sub: `${pct(available / Math.max(1, cOriginal))} of ${money(cOriginal, { compact: true })} carried` },
          { label: "Schedule (SPI)", value: num(spi, 2), sub: spi < 0.95 ? "Behind plan, budget-weighted" : "Budget-weighted", chip: <Badge tone={spi < 0.9 ? "neg" : spi < 0.98 ? "warn" : "pos"} dot={false}>{spi < 0.9 ? "Behind" : spi < 0.98 ? "Watch" : "On plan"}</Badge> },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Estimate at completion trend" info="Monthly EAC snapshots. The step line is the approved budget (C); both lines step up when a newly approved project enters the program." actions={<Legend items={[{ label: "EAC", color: "var(--c-cobalt-500)" }, { label: "Approved budget", color: "var(--c-navy-500)", dashed: true }]} />}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" debounce={120}>
              <ComposedChart data={history} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickFormatter={moneyTick} {...AXIS} width={56} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip labelFormat={(l) => fmtDate(String(l), "month")} />} cursor={{ stroke: "var(--line-strong)" }} />
                <Line type="stepAfter" dataKey="approved" name="Approved budget" stroke="var(--c-navy-500)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="eac" name="EAC" stroke="var(--c-cobalt-500)" strokeWidth={3} fill="var(--c-cobalt-500)" fillOpacity={0.08} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Contingency exposure model" info="Expected draw = pending changes × approval likelihood + open-risk exposure (probability-weighted) × realization.">
          <Narrative className="!text-md !leading-7">
            {after >= 0 ? (
              <>
                Contingency covers expected exposure <Em tone="pos">{num(coverage, 1)}×</Em>, leaving <Em>{money(after, { compact: true })}</Em> after an expected draw of{" "}
                <Em>{money(expPending + expRisk, { compact: true })}</Em>.
              </>
            ) : (
              <>
                Expected draw of <Em>{money(expPending + expRisk, { compact: true })}</Em> exceeds available contingency by <Em tone="neg">{money(-after, { compact: true })}</Em>. Owner’s reserve or a budget increase will be needed.
              </>
            )}
          </Narrative>

          <div className="mt-4 flex h-8 overflow-hidden rounded-xs bg-sunk" role="img" aria-label="Contingency allocation">
            {[
              { v: cDrawn, c: "var(--c-navy-500)", l: "Drawn" },
              { v: expPending, c: "var(--c-amber-400)", l: "Expected from PCOs" },
              { v: expRisk, c: "var(--c-orange-400)", l: "Expected from risks" },
              { v: Math.max(0, after), c: "var(--c-teal-500)", l: "Remaining" },
            ].map((s) => (
              <span key={s.l} title={`${s.l}: ${money(s.v)}`} className="h-full not-last:border-r-2 not-last:border-surface" style={{ width: `${(s.v / Math.max(cOriginal, cDrawn + expPending + expRisk)) * 100}%`, background: s.c }} />
            ))}
          </div>
          <Legend
            className="mt-2"
            items={[
              { label: `Drawn ${money(cDrawn, { compact: true })}`, color: "var(--c-navy-500)" },
              { label: `PCOs ${money(expPending, { compact: true })}`, color: "var(--c-amber-400)" },
              { label: `Risks ${money(expRisk, { compact: true })}`, color: "var(--c-orange-400)" },
              { label: `Remaining ${money(Math.max(0, after), { compact: true })}`, color: "var(--c-teal-500)" },
            ]}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Slider label="Pending PCO approval likelihood" value={likelihood} onChange={setLikelihood} note={`${money(pending, { compact: true })} pending across ${projects.reduce((a, p) => a + p.pending.length, 0)} PCOs`} />
            <Slider label="Open risk realization" value={realization} onChange={setRealization} note={`${money(riskWeighted, { compact: true })} probability-weighted, ${risks.length} open risks`} />
          </div>

          <table className="dt compact mt-5">
            <thead>
              <tr>
                <th>Bucket</th>
                <th className="r">Carried</th>
                <th className="r">Drawn</th>
                <th className="r">Pending</th>
                <th className="r">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.bucket}>
                  <td>
                    <span className="font-semibold text-ink">{b.bucket}</span> <span className="num text-xs text-ink-3">{b.code}</span>
                  </td>
                  <td className="r">{money(b.original, { compact: true })}</td>
                  <td className="r">{money(b.drawn, { compact: true })}</td>
                  <td className="r">{money(b.pending, { compact: true })}</td>
                  <td className={cx("r font-semibold", b.remaining < 0 ? "text-neg-ink" : "text-ink")}>{money(b.remaining, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="mt-5" title="Forecast by project" flush>
        <div className="scroll-x">
          <table className="dt min-w-[60rem]">
            <thead>
              <tr>
                <th>Project</th>
                <th className="r">Approved (C)</th>
                <th className="r">EAC (G)</th>
                <th className="r">Variance (H)</th>
                <th className="r">ETC (G − I)</th>
                <th className="r">SPI</th>
                <th className="r">Physical</th>
                <th>Forecast finish</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const c = chain(p.totals);
                const slip = finishSlip(p);
                const st = SCHEDULE_STATUS[p.status];
                return (
                  <tr key={p.id} className="row-link cursor-pointer" onClick={() => setProject(p.id)}>
                    <td>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProject(p.id); }} className="text-left font-semibold text-ink hover:text-accent-ink">
                        {p.name}
                      </button>
                      <div className="text-xs text-ink-3">{p.code}</div>
                    </td>
                    <td className="r">{money(c.C, { compact: true })}</td>
                    <td className="r font-semibold text-ink">{money(c.G, { compact: true })}</td>
                    <td className={cx("r font-semibold", c.H < 0 ? "text-neg-ink" : "text-pos-ink")}>{money(c.H, { compact: true, signed: true })}</td>
                    <td className="r">{money(c.G - c.I, { compact: true })}</td>
                    <td className={cx("r font-semibold", p.spi < 0.9 ? "text-neg-ink" : p.spi < 0.98 ? "text-warn-ink" : "text-ink")}>{num(p.spi, 2)}</td>
                    <td className="r">{pct(p.physicalComplete)}</td>
                    <td className="whitespace-nowrap">
                      <span className="num">{fmtDate(p.forecastFinish)}</span>
                      {slip > 0 && <span className="num ml-1.5 text-xs font-semibold text-neg-ink">+{slip}d</span>}
                    </td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </CostFrame>
  );
}

function Slider({ label, value, onChange, note }: { label: string; value: number; onChange: (v: number) => void; note: string }) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="num text-sm font-bold text-ink">
          {value}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--accent)]"
      />
      <p className="mt-1 text-2xs text-ink-3">{note}</p>
    </div>
  );
}
