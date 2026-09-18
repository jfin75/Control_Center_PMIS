"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltip, GRID } from "@/components/charts/chartKit";
import { EmptyState, Em, Legend, Narrative } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { cx, fmtDate, money, monthLabel, pct } from "@/lib/format";
import { aging, ballInCourt, byDiscipline, kpis, LIVE_STAGES, reviewerPerformance, SIDE_LABEL, stageCounts, STAGES, volume, type Row, type Side, type Stage } from "@/lib/rfis";
import { projectById } from "@/mock/projects";
import { PRIORITIES } from "@/mock/rfis";
import { BallCell, days, DueCell, ImpactChips, plural, projectCode, StageBadge } from "./parts";
import { useRfis } from "./state";

export function Dashboard() {
  const { rows, project } = useRfis();
  const k = kpis(rows);
  const p = project === "all" ? null : projectById(project)!;
  const projects = new Set(rows.map((x) => x.r.projectId)).size;
  const oldest = rows.filter((x) => x.late > 0).sort((a, b) => b.late - a.late)[0];

  if (!k.issued && !k.drafts) {
    return (
      <div className="panel">
        <EmptyState title="No RFIs yet">This project starts its RFI log when construction begins.</EmptyState>
      </div>
    );
  }

  return (
    <>
      <Panel className="mb-5">
        <Narrative className="max-w-[88ch]">
          {p ? <>On {p.name}, </> : <>Across {projects} project logs, </>}
          <Em>{k.open}</Em> {k.open === 1 ? "RFI is" : "RFIs are"} open
          {k.overdue > 0 ? (
            <>
              , <Em tone="neg">{k.overdue} past the requested response date</Em>
            </>
          ) : null}
          {k.info > 0 ? (
            <>
              , and <Em>{k.info}</Em> back with the contractor for more information
            </>
          ) : null}
          . Reviewers took <Em>{k.avgReview.toFixed(1)} days</Em> on average to answer over the last 90 days, <Em tone={k.onTimeRate >= 0.7 ? "pos" : "neg"}>{pct(k.onTimeRate)}</Em> within the time requested.{" "}
          <Em>{k.answered}</Em> answered {k.answered === 1 ? "RFI waits" : "RFIs wait"} on the Owner to close
          {k.answeredStale > 0 ? (
            <>
              , <Em tone="neg">{k.answeredStale}</Em> for more than a week
            </>
          ) : null}
          .{" "}
          {k.exposure > 0 ? (
            <>
              Answers carry <Em tone="neg">{money(k.exposure, { compact: true })}</Em> of cost exposure
              {k.unlinked > 0 ? (
                <>
                  , <Em tone="neg">{plural(k.unlinked, "confirmed impact")}</Em> without a PCO
                </>
              ) : null}
              .
            </>
          ) : (
            <>No RFI carries a cost impact.</>
          )}{" "}
          {oldest && (
            <>
              The longest overdue is {oldest.number}, {oldest.r.subject.charAt(0).toLowerCase() + oldest.r.subject.slice(1)}
              {p ? "" : <> on {projectById(oldest.r.projectId)!.name}</>}, <Em tone="neg">{days(oldest.late)}</Em> late with {oldest.ball?.name}.
            </>
          )}
        </Narrative>
      </Panel>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <StatusBreakdown />
        <BallInCourt />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <Volume />
        <Aging />
      </div>
      <Attention />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <Reviewers />
        <Disciplines />
      </div>
    </>
  );
}

function StageBar({ counts, label }: { counts: Record<Stage, number>; label: string }) {
  const total = LIVE_STAGES.reduce((a, s) => a + counts[s], 0);
  return (
    <div role="img" aria-label={`${label}: ${LIVE_STAGES.map((s) => `${counts[s]} ${STAGES[s].short.toLowerCase()}`).join(", ")}`} className="flex h-3 w-full overflow-hidden rounded-xs bg-sunk">
      {LIVE_STAGES.map((s) =>
        counts[s] ? (
          <span
            key={s}
            className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] border-r-2 border-surface last:border-r-0"
            style={{ width: `${(counts[s] / Math.max(1, total)) * 100}%`, background: STAGES[s].color }}
          />
        ) : null,
      )}
    </div>
  );
}

function StatusBreakdown() {
  const { rows, project, setProject } = useRfis();
  const byProject = project === "all";
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const x of rows) {
      if (x.stage === "draft" || x.stage === "void") continue;
      const key = byProject ? x.r.projectId : x.r.discipline;
      m.set(key, [...(m.get(key) ?? []), x]);
    }
    return [...m.entries()].map(([key, rs]) => ({ key, rows: rs, counts: stageCounts(rs) })).sort((a, b) => b.rows.length - a.rows.length);
  }, [rows, byProject]);

  return (
    <Panel
      title={byProject ? "Status by project" : "Status by discipline"}
      info={byProject ? "Every issued RFI falls in one stage, so each bar sums to the project's log. Pick a project to see it by discipline." : "Issued RFIs grouped by discipline."}
      actions={<Legend items={LIVE_STAGES.map((s) => ({ label: STAGES[s].short, color: STAGES[s].color }))} />}
    >
      <ul className="space-y-1">
        {groups.map((g) => {
          const pr = byProject ? projectById(g.key)! : null;
          const label = pr ? pr.name : g.key;
          const open = g.counts.awaiting + g.counts.info + g.counts.answered;
          const body = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{label}</span>
                <span className="num block truncate text-xs text-ink-3">
                  {pr ? `${pr.code} · ` : ""}
                  {(["awaiting", "info", "answered"] as Stage[])
                    .filter((s) => g.counts[s])
                    .map((s) => `${g.counts[s]} ${STAGES[s].short.toLowerCase()}`)
                    .join(" · ") || "All closed"}
                </span>
              </span>
              <StageBar counts={g.counts} label={label} />
              <span className="num text-right">
                <span className="block text-sm font-bold text-ink">{open}</span>
                <span className="block text-xs text-ink-3">of {g.rows.length}</span>
              </span>
            </>
          );
          const cls = "grid w-full grid-cols-[minmax(0,15rem)_minmax(6rem,1fr)_4rem] items-center gap-4 rounded-md px-2 py-2 text-left";
          return (
            <li key={g.key}>
              {pr ? (
                <button type="button" onClick={() => setProject(g.key)} className={cx(cls, "hover:bg-surface-2")} aria-label={`Show ${label}`}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function BallInCourt() {
  const { rows } = useRfis();
  const all = ballInCourt(rows);
  const max = Math.max(1, ...all.map((b) => b.count));
  const sides: Side[] = ["design", "owner", "contractor"];
  const COLOR: Record<Side, string> = { design: "var(--c-cobalt-500)", owner: "var(--c-sky-400)", contractor: "var(--c-amber-400)" };

  return (
    <Panel title="Ball in court" info="Who has to act next on every issued RFI that isn't closed. Reviewers owe answers, the Owner closes answered RFIs, and the contractor owes information when a reviewer asks. Late counts answers past due and answers waiting more than a week to close.">
      {!all.length ? (
        <p className="text-sm text-ink-2">Every issued RFI is closed.</p>
      ) : (
        <div className="space-y-4">
          {sides.map((side) => {
            const list = all.filter((b) => b.side === side);
            if (!list.length) return null;
            const total = list.reduce((a, b) => a + b.count, 0);
            return (
              <section key={side} aria-label={SIDE_LABEL[side]}>
                <div className="mb-1.5 flex items-baseline justify-between border-b border-line-soft pb-1">
                  <h3 className="text-xs font-semibold text-ink-2">{side === "owner" ? "Owner (to close or answer)" : side === "design" ? "Design team (to answer)" : "Contractor (to provide information)"}</h3>
                  <span className="num text-xs text-ink-3">{plural(total, "RFI")}</span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((b) => (
                    <li key={b.id} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3">
                      <span className="truncate text-sm text-ink" title={b.name}>
                        {b.name}
                      </span>
                      <span className="flex h-2.5 overflow-hidden rounded-xs" role="img" aria-label={`${b.name}: ${b.count} RFIs, ${b.late} late`}>
                        <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${((b.count - b.late) / max) * 100}%`, background: COLOR[side] }} />
                        {b.late > 0 && <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.late / max) * 100}%`, background: "var(--c-coral-500)" }} />}
                      </span>
                      <span className="num text-right text-xs">
                        <span className="font-bold text-ink">{b.count}</span>
                        {b.late > 0 && <span className="font-semibold text-neg-ink"> · {b.late} late</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <Legend
            items={[
              { label: "Design team", color: COLOR.design },
              { label: "Owner", color: COLOR.owner },
              { label: "Contractor", color: COLOR.contractor },
              { label: "Late", color: "var(--c-coral-500)" },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}

const SERIES = [
  { key: "issued", name: "Issued", color: "var(--c-navy-500)" },
  { key: "closed", name: "Closed", color: "var(--c-teal-500)" },
  { key: "backlog", name: "Open at month end", color: "var(--c-coral-500)" },
] as const;

function Volume() {
  const { rows } = useRfis();
  const data = useMemo(() => volume(rows), [rows]);
  const names = new Map<string, string>(SERIES.map((s) => [s.key, s.name]));
  const last3 = data.slice(-4, -1);
  const avgIssued = last3.length ? last3.reduce((a, d) => a + d.issued, 0) / last3.length : 0;
  const avgClosed = last3.length ? last3.reduce((a, d) => a + d.closed, 0) / last3.length : 0;

  return (
    <Panel
      title="RFI volume"
      info="RFIs issued and closed each month over the last 18 months, with the RFIs still open (not closed) at each month end. The current month runs to today."
      actions={<Legend items={SERIES.map((s) => ({ label: s.name, color: s.color, dashed: s.key === "backlog" }))} />}
    >
      <p className="mb-3 text-sm text-ink-2">
        Over the last three full months, <span className="num font-bold text-ink">{avgIssued.toFixed(1)}</span> issued and <span className="num font-bold text-ink">{avgClosed.toFixed(1)}</span> closed a month
        {avgIssued > avgClosed + 0.5 ? (
          <>
            ; the backlog is <span className="font-bold text-neg-ink">growing</span>
          </>
        ) : avgClosed > avgIssued + 0.5 ? (
          <>
            ; the backlog is <span className="font-bold text-pos-ink">shrinking</span>
          </>
        ) : (
          <>; the backlog is holding steady</>
        )}
        .
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => monthLabel(m)} minTickGap={16} />
            <YAxis {...AXIS} width={36} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--sunk)" }}
              content={(tp) => (
                <ChartTooltip
                  active={tp.active}
                  payload={(tp.payload as never[] | undefined)?.map((x: { dataKey?: string }) => ({ ...(x as object), name: names.get(String(x.dataKey)) })) as never}
                  label={tp.label as string}
                  labelFormat={(l) => fmtDate(String(l), "month")}
                  format={(v) => plural(v, "RFI")}
                />
              )}
            />
            <Bar dataKey="issued" fill="var(--c-navy-500)" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="closed" fill="var(--c-teal-500)" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Line dataKey="backlog" type="monotone" stroke="var(--c-coral-500)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Aging() {
  const { rows } = useRfis();
  const bands = aging(rows);
  const max = Math.max(1, ...bands.map((b) => b.onTime + b.overdue + b.info));
  const open = rows.filter((x) => x.stage === "awaiting" || x.stage === "info");
  const avg = open.length ? open.reduce((a, x) => a + (x.daysOpen ?? 0), 0) / open.length : 0;

  return (
    <Panel
      title="Open RFI aging"
      info="Unanswered RFIs by days since issue. Past due means the requested response time, set by priority, has run out."
      actions={
        <Legend
          items={[
            { label: "Within time", color: "var(--c-cobalt-500)" },
            { label: "Past due", color: "var(--c-coral-500)" },
            { label: "With contractor", color: "var(--c-amber-400)" },
          ]}
        />
      }
    >
      {!open.length ? (
        <p className="text-sm text-ink-2">No RFI is waiting on an answer.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">
            <span className="num font-bold text-ink">{open.length}</span> unanswered, open <span className="num font-bold text-ink">{avg.toFixed(0)} days</span> on average.
          </p>
          <ul className="space-y-2.5">
            {bands.map((b) => (
              <li key={b.label} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3">
                <span className="num text-xs text-ink-2">{b.label}</span>
                <span className="flex h-5 overflow-hidden rounded-xs bg-sunk" role="img" aria-label={`${b.label}: ${b.onTime} within time, ${b.overdue} past due, ${b.info} with the contractor`}>
                  <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.onTime / max) * 100}%`, background: "var(--c-cobalt-500)" }} />
                  <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.overdue / max) * 100}%`, background: "var(--c-coral-500)" }} />
                  <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.info / max) * 100}%`, background: "var(--c-amber-400)" }} />
                </span>
                <span className="num text-right text-xs">
                  <span className="font-bold text-ink">{b.onTime + b.overdue + b.info}</span>
                  {b.overdue > 0 && <span className="font-semibold text-neg-ink"> · {b.overdue} late</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** Past-due answers and answers the Owner hasn't closed in a week: the RFIs that slow the field down. */
function Attention() {
  const { rows, project, openRfi } = useRfis();
  const list = rows.filter((x) => x.late > 0 || (x.waitingClose ?? 0) > 7).sort((a, b) => b.late - a.late || (b.waitingClose ?? 0) - (a.waitingClose ?? 0));
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 8);

  return (
    <Panel
      title="Needs attention"
      info="RFIs past their requested response date, then answered RFIs the Owner has held more than a week without closing."
      flush
      actions={list.length > 8 ? <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${list.length}`}</Button> : undefined}
    >
      {!list.length ? (
        <p className="border-t border-line-soft px-5 py-6 text-sm text-ink-2">Nothing is overdue, and every answer has been closed within a week.</p>
      ) : (
        <div className="scroll-x border-t border-line-soft">
          <table className="dt min-w-[60rem]">
            <thead>
              <tr>
                <th className="min-w-[20rem]">RFI</th>
                <th>Status</th>
                <th>Ball in court</th>
                <th>Dates</th>
                <th>Priority</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.r.id} className="row-link cursor-pointer" onClick={() => openRfi(x.r.id)}>
                  <td>
                    <button
                      type="button"
                      className="text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRfi(x.r.id);
                      }}
                    >
                      <span className="block font-semibold text-ink">{x.r.subject}</span>
                      <span className="num block text-xs text-ink-3">
                        {x.number}
                        {project === "all" && ` · ${projectCode(x.r.projectId)}`}
                      </span>
                    </button>
                  </td>
                  <td>
                    <StageBadge x={x} />
                  </td>
                  <td>
                    <BallCell x={x} />
                  </td>
                  <td>
                    <DueCell x={x} />
                  </td>
                  <td className="text-sm text-ink-2">{PRIORITIES[x.r.priority].label}</td>
                  <td>
                    <ImpactChips x={x} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Reviewers() {
  const { rows } = useRfis();
  const list = reviewerPerformance(rows);
  return (
    <Panel
      title="Reviewer response"
      info="Days each reviewer held an RFI before answering, forwarding, or asking the contractor for information, across the whole log. Within time compares each hold with the response time the RFI's priority asks for. Time the contractor spends answering a request isn't counted."
      flush
    >
      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[40rem]">
          <thead>
            <tr>
              <th>Reviewer</th>
              <th className="r">Answered</th>
              <th className="r">Avg days held</th>
              <th className="w-44">Within time</th>
              <th className="r">Holding now</th>
              <th className="r">Past due</th>
            </tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.id}>
                <td>
                  <div className="font-semibold text-ink">{g.name}</div>
                  <div className="text-xs text-ink-3">
                    {SIDE_LABEL[g.side]}
                    {g.forwarded > 0 && ` · forwarded ${g.forwarded}`}
                  </div>
                </td>
                <td className="r text-ink-2">{g.answered}</td>
                <td className="r font-semibold text-ink">{g.avgDays.toFixed(1)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunk" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${g.onTime * 100}%`, background: g.onTime >= 0.7 ? "var(--c-teal-500)" : g.onTime >= 0.5 ? "var(--c-amber-400)" : "var(--c-coral-500)" }} />
                    </span>
                    <span className={cx("num w-10 text-right text-xs font-bold", g.onTime >= 0.7 ? "text-pos-ink" : g.onTime >= 0.5 ? "text-warn-ink" : "text-neg-ink")}>{pct(g.onTime)}</span>
                  </div>
                </td>
                <td className="r text-ink-2">{g.openNow || "–"}</td>
                <td className={cx("r font-semibold", g.overdueNow ? "text-neg-ink" : "text-ink-4")}>{g.overdueNow || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Disciplines() {
  const { rows } = useRfis();
  const list = byDiscipline(rows);
  const max = Math.max(1, ...list.map((d) => d.total));
  return (
    <Panel title="By discipline" info="Issued RFIs by discipline: where the documents raise the most questions, how many are still open or awaiting close, and the cost exposure their answers carry." flush>
      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[32rem]">
          <thead>
            <tr>
              <th>Discipline</th>
              <th className="w-36">RFIs</th>
              <th className="r">Not closed</th>
              <th className="r">Overdue</th>
              <th className="r">Exposure</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.discipline}>
                <td className="font-semibold text-ink">{d.discipline}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-xs" aria-hidden>
                      <span className="block h-full rounded-xs bg-[var(--c-navy-500)]" style={{ width: `${(d.total / max) * 100}%` }} />
                    </span>
                    <span className="num w-8 text-right text-xs font-bold text-ink">{d.total}</span>
                  </div>
                </td>
                <td className="r text-ink-2">{d.open || "–"}</td>
                <td className={cx("r font-semibold", d.overdue ? "text-neg-ink" : "text-ink-4")}>{d.overdue || "–"}</td>
                <td className="r text-ink-2">{d.exposure ? money(d.exposure, { compact: true }) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
