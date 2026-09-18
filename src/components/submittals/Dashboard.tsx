"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltip, GRID } from "@/components/charts/chartKit";
import { EmptyState, Em, Legend, Narrative } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { addDays, cx, fmtDate, monthLabel, pct } from "@/lib/format";
import {
  aging,
  ballInCourt,
  BUCKET_ORDER,
  BUCKETS,
  bucketCounts,
  burnup,
  kpis,
  reviewerPerformance,
  SIDE_LABEL,
  type Row,
  type Side,
} from "@/lib/submittals";
import { csiName } from "@/mock/costCodes";
import { TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { ACTION_ORDER, REVIEW_ACTIONS } from "@/mock/submittals";
import { ActionBadge, BucketBar, days, FloatChip, plural, StatusBadge, shortDate } from "./parts";
import { useSubmittals } from "./state";

const DIVISION_NAMES: Record<string, string> = { "11": "Equipment", "14": "Conveying Equipment" };
const divisionName = (d: string) => DIVISION_NAMES[d] ?? csiName(d);

export function Dashboard() {
  const { rows, project } = useSubmittals();
  const k = kpis(rows);
  const p = project === "all" ? null : projectById(project)!;
  const projects = new Set(rows.map((r) => r.s.projectId)).size;
  const worst = k.atRisk[0];

  if (!rows.length) {
    return (
      <div className="panel">
        <EmptyState title="No submittal register yet">This project starts its register when construction documents are issued.</EmptyState>
      </div>
    );
  }

  return (
    <>
      <Panel className="mb-5">
        <Narrative className="max-w-[88ch]">
          {p ? <>On {p.name}, </> : <>Across {projects} project registers, </>}
          <Em>
            {k.closed} of {k.total}
          </Em>{" "}
          submittals are closed (<Em tone="pos">{pct(k.pctComplete)}</Em>). <Em>{k.open}</Em> {k.open === 1 ? "is" : "are"} in review
          {k.openOverdue > 0 ? (
            <>
              , <Em tone="neg">{k.openOverdue} past due</Em>
            </>
          ) : null}
          ; <Em>{k.rejected}</Em> came back rejected or marked revise and resubmit and wait on the contractor
          {k.rejectedLate > 0 ? (
            <>
              , <Em tone="neg">{k.rejectedLate}</Em> beyond the 14-day resubmittal window
            </>
          ) : null}
          . <Em>{k.toSubmit}</Em> {k.toSubmit === 1 ? "is" : "are"} still to be submitted
          {k.toSubmitLate > 0 ? (
            <>
              , <Em tone="neg">{k.toSubmitLate} behind the submittal schedule</Em>
            </>
          ) : null}
          .{" "}
          {worst ? (
            <>
              <Em tone="neg">{plural(k.atRisk.length, "open item")}</Em> {k.atRisk.length === 1 ? "is" : "are"} forecast to be approved too late to hold {k.atRisk.length === 1 ? "its" : "their"} need-by
              date{k.atRisk.length === 1 ? "" : "s"}; the furthest behind is {worst.s.title.charAt(0).toLowerCase() + worst.s.title.slice(1)}
              {p ? "" : <> on {projectById(worst.s.projectId)!.name}</>}, <Em tone="neg">{days(worst.float)}</Em> short.
            </>
          ) : (
            <>No open item is forecast to miss the date it is needed on site.</>
          )}
        </Narrative>
      </Panel>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <StatusBreakdown />
        <BallInCourt />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <Progress />
        <Aging />
      </div>
      <ScheduleRisk />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[7fr_5fr]">
        <Reviewers />
        <Outcomes />
      </div>
    </>
  );
}

function StatusBreakdown() {
  const { rows, project, setProject } = useSubmittals();
  const byProject = project === "all";
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const key = byProject ? r.s.projectId : r.s.section.slice(0, 2);
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()].map(([key, rs]) => ({ key, rows: rs, counts: bucketCounts(rs) })).sort((a, b) => (byProject ? b.rows.length - a.rows.length : a.key.localeCompare(b.key)));
  }, [rows, byProject]);

  return (
    <Panel
      title={byProject ? "Status by project" : "Status by division"}
      info={byProject ? "Every register item falls in exactly one bucket, so each bar sums to the project's register. Pick a project to see it by CSI division." : "Register items grouped by CSI MasterFormat division."}
      actions={<Legend items={BUCKET_ORDER.map((b) => ({ label: BUCKETS[b].short, color: BUCKETS[b].color }))} />}
    >
      <ul className="space-y-1">
        {groups.map((g) => {
          const pr = byProject ? projectById(g.key)! : null;
          const label = pr ? pr.name : `${g.key} ${divisionName(g.key)}`;
          const body = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{label}</span>
                <span className="num block truncate text-xs text-ink-3">
                  {pr ? `${pr.code} · ` : ""}
                  {BUCKET_ORDER.filter((b) => b !== "closed" && g.counts[b])
                    .map((b) => `${g.counts[b]} ${BUCKETS[b].short.toLowerCase()}`)
                    .join(" · ") || "All closed"}
                </span>
              </span>
              <BucketBar counts={g.counts} label={label} />
              <span className="num text-right">
                <span className="block text-sm font-bold text-ink">{pct(g.counts.closed / g.rows.length)}</span>
                <span className="block text-xs text-ink-3">
                  {g.counts.closed}/{g.rows.length}
                </span>
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
  const { rows } = useSubmittals();
  const all = ballInCourt(rows);
  const max = Math.max(1, ...all.map((b) => b.total));
  const [expanded, setExpanded] = useState(false);
  const sides: Side[] = ["contractor", "design", "owner"];

  return (
    <Panel title="Ball in court" info="Who has to act next on every item that is not closed. Contractors hold items to submit and resubmit; reviewers hold items in review. Late counts items past the deadline that applies to them.">
      {!all.length ? (
        <p className="text-sm text-ink-2">Every item on the register is closed.</p>
      ) : (
        <div className="space-y-4">
          {sides.map((side) => {
            const list = all.filter((b) => b.side === side);
            if (!list.length) return null;
            const shown = expanded || side !== "contractor" ? list : list.slice(0, 5);
            const total = list.reduce((a, b) => a + b.total, 0);
            return (
              <section key={side} aria-label={SIDE_LABEL[side]}>
                <div className="mb-1.5 flex items-baseline justify-between border-b border-line-soft pb-1">
                  <h3 className="text-xs font-semibold text-ink-2">{SIDE_LABEL[side]}</h3>
                  <span className="num text-xs text-ink-3">{plural(total, "item")}</span>
                </div>
                <ul className="space-y-1.5">
                  {shown.map((b) => (
                    <li key={b.id} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3">
                      <span className="truncate text-sm text-ink" title={b.name}>
                        {b.name}
                      </span>
                      <span
                        className="flex h-2.5 overflow-hidden rounded-xs"
                        role="img"
                        aria-label={`${b.name}: ${b.total} items, ${b.late} late`}
                      >
                        <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${((b.total - b.late) / max) * 100}%`, background: side === "contractor" ? "var(--c-slate-400)" : "var(--c-cobalt-500)" }} />
                        {b.late > 0 && <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.late / max) * 100}%`, background: "var(--c-coral-500)" }} />}
                      </span>
                      <span className="num text-right text-xs">
                        <span className="font-bold text-ink">{b.total}</span>
                        {b.late > 0 && <span className="font-semibold text-neg-ink"> · {b.late} late</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {side === "contractor" && list.length > 5 && (
                  <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1.5 text-xs font-semibold text-accent-ink hover:underline">
                    {expanded ? "Show fewer" : `Show ${list.length - 5} more contractors`}
                  </button>
                )}
              </section>
            );
          })}
          <Legend
            items={[
              { label: "With contractor", color: "var(--c-slate-400)" },
              { label: "With reviewer", color: "var(--c-cobalt-500)" },
              { label: "Late", color: "var(--c-coral-500)" },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}

const SERIES = [
  { key: "planned", name: "Planned to submit", color: "var(--c-slate-400)" },
  { key: "submitted", name: "Submitted", color: "var(--c-navy-500)" },
  { key: "closed", name: "Closed", color: "var(--c-teal-500)" },
] as const;

function Progress() {
  const { rows } = useSubmittals();
  const data = useMemo(() => burnup(rows), [rows]);
  const plannedNow = rows.filter((r) => r.submitBy <= TODAY).length;
  const submittedNow = rows.filter((r) => r.s.revisions.length).length;
  const closedNow = rows.filter((r) => r.bucket === "closed").length;
  const gap = plannedNow - submittedNow;
  const todayMonth = data.find((d) => d.month >= TODAY)?.month;
  const names = new Map<string, string>(SERIES.map((s) => [s.key, s.name]));

  return (
    <Panel
      title="Submittal progress"
      info="Cumulative items planned to be submitted (from each item's submit-by date) against first submittals and closures, by month end."
      actions={<Legend items={SERIES.map((s) => ({ label: s.name, color: s.color, dashed: s.key === "planned" }))} />}
    >
      <p className="mb-3 text-sm text-ink-2">
        <span className="num font-bold text-ink">{submittedNow}</span> submitted against <span className="num font-bold text-ink">{plannedNow}</span> planned by today
        {gap > 0 ? (
          <>
            , <span className="num font-bold text-neg-ink">{gap} behind</span> the submittal schedule
          </>
        ) : (
          <>, on or ahead of the submittal schedule</>
        )}
        ; <span className="num font-bold text-ink">{closedNow}</span> closed.
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" {...AXIS} tickFormatter={(m: string) => monthLabel(m)} minTickGap={24} />
            <YAxis {...AXIS} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={(tp) => (
                <ChartTooltip
                  active={tp.active}
                  payload={(tp.payload as never[] | undefined)?.map((x: { dataKey?: string }) => ({ ...(x as object), name: names.get(String(x.dataKey)) })) as never}
                  label={tp.label as string}
                  labelFormat={(l) => `End of ${fmtDate(String(l), "month")}`}
                  format={(v) => `${v} items`}
                />
              )}
            />
            {todayMonth && <ReferenceLine x={todayMonth} stroke="var(--accent)" strokeWidth={1.5} label={{ value: "Today", position: "insideTopRight", fill: "var(--accent-ink)", fontSize: 11, fontWeight: 600 }} />}
            {SERIES.map((s) => (
              <Line key={s.key} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={s.key === "planned" ? 1.75 : 2.25} strokeDasharray={s.key === "planned" ? "5 4" : undefined} dot={false} connectNulls={false} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Aging() {
  const { rows } = useSubmittals();
  const bands = aging(rows);
  const max = Math.max(1, ...bands.map((b) => b.onTime + b.overdue));
  const open = rows.filter((r) => r.bucket === "open");
  const avg = open.length ? open.reduce((a, r) => a + (r.daysInReview ?? 0), 0) / open.length : 0;

  return (
    <Panel
      title="Review aging"
      info="Items in review by days since transmittal. Past due means the whole review period has run out; the contractual period depends on the submittal type."
      actions={
        <Legend
          items={[
            { label: "Within period", color: "var(--c-cobalt-500)" },
            { label: "Past due", color: "var(--c-coral-500)" },
          ]}
        />
      }
    >
      {!open.length ? (
        <p className="text-sm text-ink-2">Nothing is in review.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">
            <span className="num font-bold text-ink">{open.length}</span> in review for <span className="num font-bold text-ink">{avg.toFixed(0)} days</span> on average.
          </p>
          <ul className="space-y-2.5">
            {bands.map((b) => (
              <li key={b.label} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3">
                <span className="num text-xs text-ink-2">{b.label}</span>
                <span className="flex h-5 overflow-hidden rounded-xs bg-sunk" role="img" aria-label={`${b.label}: ${b.onTime} within period, ${b.overdue} past due`}>
                  <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.onTime / max) * 100}%`, background: "var(--c-cobalt-500)" }} />
                  <span className="h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)]" style={{ width: `${(b.overdue / max) * 100}%`, background: "var(--c-coral-500)" }} />
                </span>
                <span className="num text-right text-xs">
                  <span className="font-bold text-ink">{b.onTime + b.overdue}</span>
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

function ScheduleRisk() {
  const { rows, openItem, project } = useSubmittals();
  const risk = kpis(rows).atRisk;
  const [all, setAll] = useState(false);
  const shown = all ? risk : risk.slice(0, 8);

  return (
    <Panel
      title="Need-date risk"
      info="Open items with a fabrication or delivery lead time whose forecast approval lands after the latest approval that still holds the date they are needed on site. Forecast approval is the review due date for items in review, the resubmittal window plus a review period for rejected items, and the submit-by date plus a review period for items not yet submitted."
      flush
      actions={risk.length > 8 ? <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${risk.length}`}</Button> : undefined}
    >
      {!risk.length ? (
        <p className="border-t border-line-soft px-5 py-6 text-sm text-ink-2">No open item is forecast to miss its need-by date.</p>
      ) : (
        <div className="scroll-x border-t border-line-soft">
          <table className="dt min-w-[60rem]">
            <thead>
              <tr>
                <th className="min-w-[18rem]">Submittal</th>
                <th>Status</th>
                <th>Ball in court</th>
                <th className="r">Lead</th>
                <th>Approval needed</th>
                <th>Forecast approval</th>
                <th className="r">Float</th>
                <th>Needed on site</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.s.id} className="row-link cursor-pointer" onClick={() => openItem(r.s.id)}>
                  <td>
                    <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openItem(r.s.id); }}>
                      <span className="block font-semibold text-ink">{r.s.title}</span>
                      <span className="num block text-xs text-ink-3">
                        {r.number}
                        {project === "all" && ` · ${projectById(r.s.projectId)!.code}`}
                      </span>
                    </button>
                  </td>
                  <td>
                    <StatusBadge r={r} />
                  </td>
                  <td className="text-sm text-ink-2">{r.ball?.name}</td>
                  <td className="r text-ink-2">{r.s.leadWeeks} wk</td>
                  <td className="num whitespace-nowrap text-ink-2">{shortDate(r.approvalNeeded)}</td>
                  <td className="num whitespace-nowrap font-semibold text-ink">{shortDate(r.forecastApproval)}</td>
                  <td className="r">
                    <FloatChip r={r} />
                  </td>
                  <td className="num whitespace-nowrap text-ink-2">{fmtDate(r.s.requiredOnSite)}</td>
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
  const { rows } = useSubmittals();
  const list = reviewerPerformance(rows);
  return (
    <Panel
      title="Reviewer turnaround"
      info="Days each reviewer held a submittal before passing it on, across every revision on the register. Each reviewer's share of the review period: specialty consultants 30%, lead design reviewer 50%, Owner 25%, rescaled to the reviewers on the route."
      flush
    >
      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[40rem]">
          <thead>
            <tr>
              <th>Reviewer</th>
              <th className="r">Reviews</th>
              <th className="r">Avg days held</th>
              <th className="w-44">Within share</th>
              <th className="r">Holding now</th>
              <th className="r">Past share</th>
            </tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.id}>
                <td>
                  <div className="font-semibold text-ink">{g.name}</div>
                  <div className="text-xs text-ink-3">{g.role}</div>
                </td>
                <td className="r text-ink-2">{g.completed}</td>
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

function Outcomes() {
  const { rows } = useSubmittals();
  const since = addDays(TODAY, -365);
  const returned = rows.flatMap((r) => r.s.revisions.filter((v) => v.action && v.returned! >= since));
  const counts = ACTION_ORDER.map((a) => ({ a, n: returned.filter((v) => v.action === a).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const bounced = returned.filter((v) => !REVIEW_ACTIONS[v.action!].closes).length;

  return (
    <Panel title="Review outcomes" info={`Governing action on every revision returned since ${fmtDate(since)}.`}>
      {!returned.length ? (
        <p className="text-sm text-ink-2">Nothing returned in the last 12 months.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-2">
            <span className="num font-bold text-ink">{returned.length}</span> returns in the last 12 months;{" "}
            <span className="num font-bold text-neg-ink">{pct(bounced / returned.length)}</span> went back for resubmittal.
          </p>
          <ul className="space-y-2">
            {counts.map(({ a, n }) => (
              <li key={a} className="grid grid-cols-[minmax(0,11rem)_1fr_4rem] items-center gap-3">
                <ActionBadge action={a} />
                <span className="h-2.5 overflow-hidden rounded-xs" aria-hidden>
                  <span className="block h-full origin-left animate-[grow-x_var(--dur-slow)_var(--ease-out)] rounded-xs" style={{ width: `${(n / max) * 100}%`, background: TONE_FILL[REVIEW_ACTIONS[a].tone] }} />
                </span>
                <span className="num text-right text-xs">
                  <span className="font-bold text-ink">{n}</span> <span className="text-ink-3">{pct(n / returned.length)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

const TONE_FILL = { pos: "var(--c-teal-500)", warn: "var(--c-amber-400)", neg: "var(--c-coral-500)", info: "var(--c-sky-400)" } as const;

