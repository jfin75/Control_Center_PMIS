"use client";

import { Fragment } from "react";
import { Badge, Chip, Em, Narrative } from "@/components/ui/data";
import { Panel } from "@/components/ui/Panel";
import { chain, sumChain, type Chain } from "@/lib/budget";
import { cx, money, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { LEVEL1, CHANGE_CLASSIFIERS } from "@/mock/costCodes";
import { linesFor } from "@/mock/finance";
import { PROJECTS, projectById } from "@/mock/projects";
import { ChainTable } from "./ChainTable";
import { CostFrame, useProjectParam } from "./CostFrame";

export function CostSummaryView() {
  const [project, setProject] = useProjectParam();
  const projects = project === "all" ? PROJECTS : PROJECTS.filter((p) => p.id === project);
  const total = sumChain(projects.map((p) => p.totals));
  const pending = projects.flatMap((p) => p.pending.map((c) => ({ ...c, projectId: p.id })));
  const pendingTotal = pending.reduce((a, c) => a + c.amount, 0);
  const one = project === "all" ? null : projectById(project)!;

  // Rows: projects for the program view; Level 1 classifications for a single project.
  const rows =
    project === "all"
      ? PROJECTS.map((p) => ({ id: p.id, label: p.name, sub: p.code, chain: chain(p.totals) }))
      : LEVEL1.map((l) => {
          const ls = linesFor(project).filter((x) => x.level1 === l.name);
          return { id: l.name, label: `${l.prefix}. ${l.name}`, sub: `${ls.length} lines`, chain: sumChain(ls) };
        }).filter((r) => r.chain.C !== 0 || r.chain.D !== 0);

  const overruns = projects.filter((p) => chain(p.totals).H < 0);
  const overrunTotal = overruns.reduce((a, p) => a + chain(p.totals).H, 0);

  const exportCsv = () =>
    downloadCsv(
      `budget-summary-${project}.csv`,
      [project === "all" ? "Project" : "Level 1 Classification", "A Original Budget", "B Approved Adjustments", "C Total Approved", "D Commitments", "E Balance Remaining", "F Projected Remaining", "G Forecast at Completion", "H Projected Variance", "I Payments", "J Funds Remaining", "K % Complete of Commitment"],
      [...rows.map((r) => [String(r.label), r.chain.A, r.chain.B, r.chain.C, r.chain.D, r.chain.E, r.chain.F, r.chain.G, r.chain.H, r.chain.I, r.chain.J, Number.isFinite(r.chain.K) ? r.chain.K : ""]),
        ["Total", total.A, total.B, total.C, total.D, total.E, total.F, total.G, total.H, total.I, total.J, total.K]],
    );

  return (
    <CostFrame onExport={exportCsv}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <Narrative>
            {one ? (
              <>
                {one.name} has an approved budget of <Em>{money(total.C)}</Em>, <Em>{pct(total.D / total.C)}</Em> committed. It is forecast to finish at <Em>{money(total.G)}</Em>,{" "}
                {total.H < 0 ? (
                  <Em tone="neg">{money(-total.H)} over</Em>
                ) : (
                  <Em tone="pos">{money(total.H)} under</Em>
                )}{" "}
                the approved budget, with <Em>{money(pendingTotal)}</Em> in pending changes not yet in the forecast.
              </>
            ) : (
              <>
                The program’s <Em>{money(total.C, { compact: true })}</Em> approved budget is <Em>{pct(total.D / total.C)}</Em> committed and forecast to finish at <Em>{money(total.G, { compact: true })}</Em> —{" "}
                {total.H >= 0 ? <Em tone="pos">{money(total.H, { compact: true })} under</Em> : <Em tone="neg">{money(-total.H, { compact: true })} over</Em>}. But <Em tone="neg">{overruns.length} projects</Em> forecast overruns totaling{" "}
                <Em tone="neg">{money(-overrunTotal, { compact: true })}</Em>, and <Em>{money(pendingTotal, { compact: true })}</Em> of pending changes sit outside the forecast.
              </>
            )}
          </Narrative>
        </Panel>
        <Panel as="div">
          <div className="flex items-center gap-2 text-xs text-ink-3">
            Projected cost variance (H)
            <Chip tone={total.H < 0 ? "neg" : "pos"}>{pct(total.H / total.C, 1)}</Chip>
          </div>
          <div className={cx("num mt-1 text-[2rem] leading-10 font-semibold tracking-[-0.02em]", total.H < 0 ? "text-neg-ink" : "text-ink")}>{money(total.H, { compact: true })}</div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0.2, 0.4, 0.6, 0.8].map((t) => (
              <span key={t} className={cx("h-1 flex-1 rounded-full", total.D / total.C > t ? "bg-amber" : "bg-line")} />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-2">
            Approved {money(total.C, { compact: true })} − forecast {money(total.G, { compact: true })}
          </p>
        </Panel>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <ChainFunnel c={total} />
        <div className="grid gap-5">
          <VarianceList project={project} onPick={(id) => setProject(id)} />
          <PendingPanel pending={pending} total={pendingTotal} showProject={project === "all"} />
        </div>
      </div>

      <Panel
        className="mt-5"
        title="Budget Summary Report"
        info="Same eleven columns and formulas as the Owner’s Budget Summary Report (A–K)."
        flush
        actions={<span className="text-xs text-ink-3">{project === "all" ? "Select a project to drill in" : "By Level 1 classification"}</span>}
      >
        <ChainTable
          rows={rows}
          total={total}
          firstHeader={project === "all" ? "Project" : "Level 1 classification"}
          onRow={project === "all" ? (id) => setProject(id) : undefined}
        />
      </Panel>
    </CostFrame>
  );
}

/** The reference's conversion funnel, repurposed as the budget chain from A to I. */
function ChainFunnel({ c }: { c: Chain }) {
  const max = Math.max(c.C, c.G, c.A);
  const rows: Array<{ k: string; label: string; cap: string; v: number; color: string; share?: number }> = [
    { k: "A", label: "Original budget", cap: "Finance", v: c.A, color: "var(--c-navy-500)", share: c.A / c.C },
    { k: "B", label: "Approved adjustments", cap: "Funding actions", v: c.B, color: c.B < 0 ? "var(--c-coral-500)" : "var(--c-teal-500)" },
    { k: "C", label: "Total approved budget", cap: "A + B", v: c.C, color: "var(--c-cobalt-600)", share: 1 },
    { k: "D", label: "Commitments to date", cap: "Finance", v: c.D, color: "var(--c-cobalt-700)", share: c.D / c.C },
    { k: "F", label: "Projected remaining", cap: "PM forecast", v: c.F, color: "var(--c-sky-400)", share: c.F / c.C },
    { k: "G", label: "Forecast at completion", cap: "D + F", v: c.G, color: c.G > c.C ? "var(--c-coral-500)" : "var(--c-cobalt-600)", share: c.G / c.C },
    { k: "I", label: "Payments to date", cap: "Finance", v: c.I, color: "var(--c-teal-500)", share: c.I / c.C },
  ];
  const paid = c.I;
  const unpaid = Math.max(0, c.D - c.I);
  const uncommitted = Math.max(0, c.C - c.D);
  const whole = paid + unpaid + uncommitted;

  return (
    <Panel title="Budget chain" info="Bars share one scale. Percentages are of Total Approved Budget (C).">
      <div className="grid grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-3.5">
        <div className="text-2xs font-semibold text-ink-3">Measure</div>
        <div className="text-2xs font-semibold text-ink-3">Amount</div>
        <div className="text-right text-2xs font-semibold text-ink-3">of C</div>
        {rows.map((r) => {
          const w = Math.abs(r.v) / max;
          const text = money(r.v, { compact: true });
          const dark = ["sky", "teal", "amber", "coral"].some((c) => r.color.includes(c));
          return (
            <Fragment key={r.k}>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="w-3 text-2xs font-bold text-accent-ink">{r.k}</span>
                  <span className="truncate text-sm font-semibold text-ink">{r.label}</span>
                </div>
                <div className="pl-5 text-xs text-ink-3">{r.cap}</div>
              </div>
              <div className="flex h-9 items-center">
                <div
                  className="flex h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] items-center rounded-xs px-2.5"
                  style={{ width: `${Math.max(w * 100, r.v === 0 ? 0 : 1.5)}%`, background: r.color }}
                >
                  {w > 0.22 && <span className={cx("num text-xs font-bold", dark ? "text-ink" : "text-white")}>{text}</span>}
                </div>
                {w <= 0.22 && <span className="num ml-2 text-xs font-bold text-ink-2">{text}</span>}
              </div>
              <div className="num text-right text-sm font-bold text-ink">{r.share !== undefined ? pct(r.share) : ""}</div>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-ink">Where the approved budget stands</div>
            <div className="text-xs text-ink-3">% complete of commitment (K) = {pct(c.K)}</div>
          </div>
        </div>
        <div className="flex h-10 overflow-hidden rounded-xs" role="img" aria-label={`Paid ${pct(paid / whole)}, committed unpaid ${pct(unpaid / whole)}, uncommitted ${pct(uncommitted / whole)}`}>
          {[
            { label: "Paid", v: paid, cls: "bg-teal text-ink" },
            { label: "Unpaid commits", v: unpaid, cls: "bg-navy text-white" },
            { label: "Uncommitted", v: uncommitted, cls: "bg-sunk text-ink-2" },
          ].map((s) => (
            <div key={s.label} className={cx("flex min-w-0 items-center justify-between gap-2 px-3 text-xs font-bold not-last:border-r-2 not-last:border-surface", s.cls)} style={{ width: `${(s.v / whole) * 100}%` }}>
              {s.v / whole > 0.14 && (
                <>
                  <span className="truncate">{s.label}</span>
                  <span className="num">{pct(s.v / whole)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function VarianceList({ project, onPick }: { project: string | "all"; onPick: (id: string) => void }) {
  const items =
    project === "all"
      ? PROJECTS.map((p) => ({ id: p.id, label: p.name, sub: p.code, h: chain(p.totals).H, pick: true }))
      : LEVEL1.map((l) => ({ id: l.name, label: l.name, sub: `${l.prefix}.xx`, h: sumChain(linesFor(project).filter((x) => x.level1 === l.name)).H, pick: false })).filter((x) => x.h !== 0);
  const sorted = [...items].sort((a, b) => a.h - b.h);
  const max = Math.max(...sorted.map((i) => Math.abs(i.h)), 1);
  return (
    <Panel title={project === "all" ? "Projected variance by project" : "Projected variance by classification"} info="H = C − G. Negative is a forecast overrun.">
      <ul className="space-y-2.5">
        {sorted.map((i) => (
          <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_7rem_5.5rem] items-center gap-3">
            <div className="min-w-0">
              {i.pick ? (
                <button type="button" onClick={() => onPick(i.id)} className="block max-w-full truncate text-left text-sm font-semibold text-ink hover:text-accent-ink">
                  {i.label}
                </button>
              ) : (
                <span className="block truncate text-sm font-semibold text-ink">{i.label}</span>
              )}
              <span className="text-xs text-ink-3">{i.sub}</span>
            </div>
            <div className="relative flex h-3.5 items-center" aria-hidden>
              <span className="absolute left-1/2 h-full w-px bg-line-strong" />
              <span
                className="absolute h-2.5 rounded-xs"
                style={{
                  width: `${(Math.abs(i.h) / max) * 50}%`,
                  left: i.h < 0 ? `${50 - (Math.abs(i.h) / max) * 50}%` : "50%",
                  background: i.h < 0 ? "var(--c-coral-500)" : "var(--c-teal-500)",
                }}
              />
            </div>
            <div className={cx("num text-right text-sm font-bold", i.h < 0 ? "text-neg-ink" : "text-pos-ink")}>{money(i.h, { compact: true, signed: true })}</div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PendingPanel({
  pending,
  total,
  showProject,
}: {
  pending: Array<{ number: string; title: string; classifier: string; amount: number; status: string; funding: string; projectId: string }>;
  total: number;
  showProject: boolean;
}) {
  const sorted = [...pending].sort((a, b) => b.amount - a.amount);
  return (
    <Panel title="Pending changes" info="Potential change orders priced or under review. Not yet in commitments (D) or forecast (G)." actions={<span className="num text-md font-bold text-ink">{money(total)}</span>}>
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-2">No pending changes. New PCOs appear here as contractors submit them.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {sorted.slice(0, 6).map((c) => (
            <li key={c.projectId + c.number} className="flex items-start gap-3 py-2.5 first:pt-0">
              <Badge tone="neutral" dot={false} className="mt-0.5 w-12 justify-center" >
                <abbr title={CHANGE_CLASSIFIERS.find((x) => x.id === c.classifier)?.label} className="no-underline">{c.classifier}</abbr>
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{c.title}</div>
                <div className="truncate text-xs text-ink-3">
                  {c.number} · {c.status} · {c.funding}
                  {showProject && ` · ${projectById(c.projectId)?.code}`}
                </div>
              </div>
              <div className="num text-sm font-bold text-ink">{money(c.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
