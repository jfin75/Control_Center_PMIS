"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Star, Trash2 } from "lucide-react";
import { AXIS, GRID } from "@/components/charts/chartKit";
import { Badge, Chip, Em, EmptyState, Legend, Narrative } from "@/components/ui/data";
import { Button, IconButton } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { cx, fmtDate } from "@/lib/format";
import { dayNum, isoOf } from "@/lib/schedule/calendar";
import { CHANGE_KINDS, compare, type ChangeKind } from "@/lib/schedule/compare";
import { compute } from "@/lib/schedule/cpm";
import { healthChecks, healthScore } from "@/lib/schedule/health";
import { isSeeded } from "@/lib/schedule/store";
import { FloatText, INK, plural, shortDate, SOURCE_LABEL, Variance, whoName } from "./parts";
import { useSchedule } from "./state";

export function Updates() {
  const { versions, project, s } = useSchedule();
  if (project === "all" || !s) {
    return (
      <div className="panel">
        <EmptyState title="Pick a project to see its updates">Each project keeps its schedule versions: the baseline submission, every monthly update, and what you build here.</EmptyState>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Versions />
      {versions.length > 1 ? (
        <Compare />
      ) : (
        <div className="panel">
          <EmptyState title="One version so far">Import next month’s update, or use New schedule › Next update, to compare what changed.</EmptyState>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Versions and the finish trend
 * ------------------------------------------------------------------------- */

function Versions() {
  const { versions, currentId, openVersion, makeCurrent, remove, s } = useSchedule();
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 4000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const rows = useMemo(
    () =>
      versions.map((v) => {
        const r = compute(v);
        return { v, r, health: healthScore(healthChecks(v, r)) };
      }),
    [versions],
  );
  const asc = [...rows].reverse();
  const first = asc[0]!;
  const last = asc[asc.length - 1]!;
  const moved = dayNum(last.r.finish) - dayNum(first.r.finish);
  const data = asc.map((x) => ({ dd: dayNum(x.v.dataDate), finish: dayNum(x.r.finish), name: x.v.name }));
  const bl = last.r.blFinish ? dayNum(last.r.blFinish) : null;
  const dl = last.v.deadline ? dayNum(last.v.deadline) : null;
  const ys = [...data.map((d) => d.finish), ...(bl ? [bl] : []), ...(dl ? [dl] : [])];
  const span = Math.max(30, Math.max(...ys) - Math.min(...ys));
  const lo = Math.min(...ys) - span * 0.15;
  const hi = Math.max(...ys) + span * 0.15;
  // One tick per month start (fewer on long spans), so labels never repeat.
  const yTicks: number[] = [];
  for (let m = new Date(lo * 86_400_000), n = 0; n < 120; n++) {
    const first = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + n, 1) / 86_400_000;
    if (first > hi) break;
    if (first >= lo) yTicks.push(first);
  }
  const step = Math.max(1, Math.ceil(yTicks.length / 5));

  return (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Panel title="Finish date by update" info="Each point is one version's calculated finish, plotted at its data date. A rising line means the finish keeps moving out.">
        {rows.length > 1 ? (
          <>
            <Narrative className="text-md leading-7">
              Across {plural(rows.length, "update")}, the finish moved <Em tone={moved > 0 ? "neg" : "pos"}>{moved === 0 ? "not at all" : `${Math.abs(moved)} days ${moved > 0 ? "later" : "earlier"}`}</Em>, to {fmtDate(last.r.finish)}.
            </Narrative>
            <div className="mt-4 h-52" role="img" aria-label={`Finish date by update: ${asc.map((x) => `${x.v.name} ${fmtDate(x.r.finish)}`).join("; ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="dd" type="number" domain={["dataMin - 10", "dataMax + 10"]} tickFormatter={(v: number) => shortDate(isoOf(v))} {...AXIS} />
                  <YAxis type="number" domain={[lo, hi]} ticks={yTicks.filter((_, i) => i % step === 0)} tickFormatter={(v: number) => fmtDate(isoOf(Math.round(v)), "month")} width={72} {...AXIS} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
                      if (!active || !d) return null;
                      return (
                        <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised">
                          <div className="font-semibold text-ink">{d.name}</div>
                          <div className="text-ink-2">Data date {fmtDate(isoOf(d.dd))}</div>
                          <div className="num font-semibold text-ink">Finish {fmtDate(isoOf(d.finish))}</div>
                        </div>
                      );
                    }}
                  />
                  {bl && <ReferenceLine y={bl} stroke={INK.baseline} strokeDasharray="4 3" />}
                  {dl && dl !== bl && <ReferenceLine y={dl} stroke={INK.deadline} strokeDasharray="2 3" />}
                  <Line dataKey="finish" stroke="var(--c-cobalt-600)" strokeWidth={2} dot={{ r: 4, fill: "var(--c-cobalt-600)" }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Legend
              className="mt-2"
              items={[
                { label: "Calculated finish", color: "var(--c-cobalt-600)" },
                ...(bl ? [{ label: "Baseline finish", color: INK.baseline, dashed: true }] : []),
                ...(dl && dl !== bl ? [{ label: "Contract completion", color: INK.deadline, dashed: true }] : []),
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-ink-2">The trend starts with the second update.</p>
        )}
      </Panel>

      <Panel title="Versions" flush>
        <div className="scroll-x">
          <table className="dt">
            <thead>
              <tr>
                <th>Version</th>
                <th className="r">Data date</th>
                <th className="r">Finish</th>
                <th className="r">Moved</th>
                <th className="r">Float</th>
                <th>Health</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => {
                const prev = rows[i + 1];
                const cur = x.v.id === currentId;
                return (
                  <tr key={x.v.id} data-selected={x.v.id === s?.id}>
                    <td className="min-w-[14rem]">
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        {x.v.name}
                        {cur && <Badge tone="accent">Current</Badge>}
                      </div>
                      <div className="max-w-[22rem] truncate text-xs text-ink-3" title={x.v.source.label}>
                        {SOURCE_LABEL[x.v.source.kind]} · {whoName(x.v.source.by)}, {shortDate(x.v.source.at)}
                        {x.v.source.label ? ` · ${x.v.source.label}` : ""}
                      </div>
                    </td>
                    <td className="r num whitespace-nowrap">{fmtDate(x.v.dataDate)}</td>
                    <td className="r num whitespace-nowrap font-semibold text-ink">{fmtDate(x.r.finish)}</td>
                    <td className="r">{prev ? <Variance days={dayNum(x.r.finish) - dayNum(prev.r.finish)} short /> : <span className="text-xs text-ink-3">First</span>}</td>
                    <td className="r">
                      <FloatText tf={x.r.finishFloat} />
                    </td>
                    <td>
                      <Chip tone={x.health.passed === x.health.of ? "pos" : x.health.of - x.health.passed > 3 ? "neg" : "warn"}>{`${x.health.passed}/${x.health.of}`}</Chip>
                    </td>
                    <td className="r whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={<ArrowRight className="size-3.5" aria-hidden />} onClick={() => openVersion(x.v.id)}>
                          Open
                        </Button>
                        {!cur && (
                          <IconButton label="Make this the current schedule" onClick={() => makeCurrent(x.v.id)}>
                            <Star className="size-4" aria-hidden />
                          </IconButton>
                        )}
                        <Button
                          size="sm"
                          variant={confirm === x.v.id ? "danger" : "ghost"}
                          icon={<Trash2 className="size-3.5" aria-hidden />}
                          onClick={() => {
                            if (confirm !== x.v.id) return setConfirm(x.v.id);
                            remove(x.v.id);
                            setConfirm(null);
                          }}
                          title={isSeeded(x.v.id) ? "Hide this seeded version (Reset brings it back)" : "Delete this version from this browser"}
                        >
                          {confirm === x.v.id ? "Confirm" : <span className="sr-only">Delete {x.v.name}</span>}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * What changed between two versions
 * ------------------------------------------------------------------------- */

const KIND_ORDER: ChangeKind[] = ["slipped", "gained", "added", "deleted", "duration", "logic", "constraint", "actuals", "renamed"];

function Compare() {
  const { versions, s, openDetail } = useSchedule();
  const later = s!;
  const olderList = versions.filter((v) => dayNum(v.dataDate) < dayNum(later.dataDate) || (v.dataDate === later.dataDate && v.id !== later.id));
  const [aId, setAId] = useState<string>(olderList[0]?.id ?? "");
  const [only, setOnly] = useState<ChangeKind | null>(null);
  useEffect(() => setAId(olderList[0]?.id ?? ""), [later.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = versions.find((v) => v.id === aId);
  const cmp = useMemo(() => (a ? compare(a, later) : null), [a, later]);

  if (!olderList.length || !a || !cmp) {
    return (
      <div className="panel">
        <EmptyState title="Nothing earlier to compare with">This is the earliest version. Open a later one to see what changed since.</EmptyState>
      </div>
    );
  }
  const list = only ? cmp.changes.filter((c) => c.kinds.includes(only)) : cmp.changes;
  const lpSlips = cmp.changes.filter((c) => c.longest && c.kinds.includes("slipped")).length;

  return (
    <Panel
      title="What changed"
      info="Activities are matched by ID. Moves are calendar days on each activity's finish."
      actions={
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <label htmlFor="compare-a" className="text-xs text-ink-3">
            Compare
          </label>
          <select id="compare-a" className="field h-7 text-xs" value={aId} onChange={(e) => setAId(e.target.value)}>
            {olderList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-3">with</span>
          <span className="text-xs font-semibold text-ink">{later.name}</span>
        </div>
      }
    >
      <Narrative className="text-md leading-7">
        From {a.name} to {later.name}, the finish moved <Em tone={cmp.finishMoved > 0 ? "neg" : cmp.finishMoved < 0 ? "pos" : "accent"}>{cmp.finishMoved === 0 ? "0 days" : `${Math.abs(cmp.finishMoved)} days ${cmp.finishMoved > 0 ? "later" : "earlier"}`}</Em>.{" "}
        {plural(cmp.changes.length, "activity", "activities")} changed{lpSlips ? (
          <>
            , and <Em tone="neg">{lpSlips}</Em> of the slips are on the longest path
          </>
        ) : null}
        {cmp.counts.actuals ? (
          <>
            . <Em tone="neg">{plural(cmp.counts.actuals, "activity", "activities")}</Em> had actual dates rewritten after they were reported
          </>
        ) : null}
        .
      </Narrative>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter changes">
        <button type="button" onClick={() => setOnly(null)} aria-pressed={!only} className={cx("rounded-sm px-2 py-1 text-xs font-semibold", !only ? "bg-accent-tint text-accent-ink" : "bg-sunk text-ink-2 hover:text-ink")}>
          All · {cmp.changes.length}
        </button>
        {KIND_ORDER.filter((k) => cmp.counts[k]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setOnly(only === k ? null : k)}
            aria-pressed={only === k}
            className={cx("rounded-sm px-2 py-1 text-xs font-semibold", only === k ? "bg-accent-tint text-accent-ink" : "bg-sunk text-ink-2 hover:text-ink")}
          >
            {CHANGE_KINDS[k].label} · {cmp.counts[k]}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="scroll-x -mx-5 mt-4">
          <table className="dt compact">
            <thead>
              <tr>
                <th>ID</th>
                <th>Activity</th>
                <th>Changes</th>
                <th className="r">Finish</th>
                <th className="r">Moved</th>
                <th className="r">Duration</th>
                <th>Predecessors</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 400).map((c) => (
                <tr key={c.code} className={cx(c.id && "row-link cursor-pointer")} onClick={() => c.id && openDetail(c.id)}>
                  <td className="num whitespace-nowrap">
                    {c.code}
                    {c.longest && (
                      <span className="ml-1 text-neg-ink" title="On the longest path">
                        ◆<span className="sr-only"> on the longest path</span>
                      </span>
                    )}
                  </td>
                  <td className="max-w-[18rem]">
                    <span className="block truncate text-ink" title={c.name}>
                      {c.name}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.kinds.map((k) => (
                        <Badge key={k} tone={CHANGE_KINDS[k].tone} dot={false}>
                          {CHANGE_KINDS[k].label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="r num whitespace-nowrap">
                    {c.before && c.after && c.before.finish !== c.after.finish ? (
                      <>
                        <span className="text-ink-3">{shortDate(c.before.finish)} → </span>
                        {shortDate(c.after.finish)}
                      </>
                    ) : (
                      shortDate((c.after ?? c.before)!.finish)
                    )}
                  </td>
                  <td className="r">{c.moved !== null ? <Variance days={c.moved} short /> : <span className="text-ink-4">—</span>}</td>
                  <td className="r num whitespace-nowrap">{c.before && c.after && c.before.dur !== c.after.dur ? `${c.before.dur} → ${c.after.dur}` : (c.after ?? c.before)!.dur}</td>
                  <td className="max-w-[16rem]">
                    {c.before && c.after && c.before.preds !== c.after.preds ? (
                      <span className="block truncate text-xs" title={`${c.before.preds || "none"} → ${c.after.preds || "none"}`}>
                        <span className="text-ink-3 line-through">{c.before.preds || "none"}</span> {c.after.preds || "none"}
                      </span>
                    ) : (
                      <span className="block truncate text-xs text-ink-3">{(c.after ?? c.before)!.preds}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 400 && <p className="px-5 py-2 text-xs text-ink-3">Showing the first 400 of {list.length}. Filter by kind to narrow.</p>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-2">No activity changed between these versions.</p>
      )}
    </Panel>
  );
}
