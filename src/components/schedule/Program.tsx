"use client";

import { useMemo } from "react";
import { ArrowUpRight, CircleCheck, CircleAlert } from "lucide-react";
import { Chip, Em, KpiStrip, Narrative } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { cx, daysBetween, fmtDate } from "@/lib/format";
import { dayNum } from "@/lib/schedule/calendar";
import { compute, type Result } from "@/lib/schedule/cpm";
import { healthChecks, healthScore } from "@/lib/schedule/health";
import type { Schedule } from "@/lib/schedule/types";
import { TODAY } from "@/mock/org";
import { PROJECTS, type Project } from "@/mock/projects";
import { FloatText, INK, plural, shortDate, SOURCE_LABEL, Variance } from "./parts";
import { useSchedule } from "./state";

interface Line {
  p: Project;
  s: Schedule | null;
  r: Result | null;
  baseline: string;
  finish: string;
  slip: number;
  health: { passed: number; of: number } | null;
  /** Key milestones whose schedule date differs from the project record's forecast. */
  drift: number;
  keys: number;
  driver: string | null;
}

interface Upcoming {
  key: string;
  projectId: string;
  code: string;
  name: string;
  date: string;
  slip: number | null;
  from: "Schedule" | "Record";
}

const WINDOW = 90;

export function Program() {
  const { all, currentFor, gotoProject, startNew, project } = useSchedule();

  const lines = useMemo<Line[]>(
    () =>
      PROJECTS.map((p) => {
        const s = currentFor(p.id);
        if (!s) return { p, s: null, r: null, baseline: p.baselineFinish, finish: p.forecastFinish, slip: daysBetween(p.baselineFinish, p.forecastFinish), health: null, drift: 0, keys: 0, driver: null };
        const r = compute(s);
        const keyed = r.list.filter((c) => c.a.key);
        const drift = keyed.filter((c) => {
          const m = p.milestones.find((x) => x.name === c.a.key);
          return m && (m.actual ?? m.forecast) !== c.finish;
        }).length;
        const next = r.list.filter((c) => c.longest && c.status !== "complete").sort((a, b) => a.es - b.es)[0];
        const baseline = r.blFinish ?? p.baselineFinish;
        return { p, s, r, baseline, finish: r.finish, slip: daysBetween(baseline, r.finish), health: healthScore(healthChecks(s, r)), drift, keys: keyed.length, driver: next ? `${next.a.code} ${next.a.name}` : null };
      }),
    [all, currentFor], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const upcoming = useMemo<Upcoming[]>(() => {
    const end = dayNum(TODAY) + WINDOW;
    const out: Upcoming[] = [];
    for (const l of lines) {
      if (l.r) {
        for (const c of l.r.list) {
          if (c.a.type === "task" || c.status === "complete" || !(c.a.key || c.longest)) continue;
          if (dayNum(c.finish) < dayNum(TODAY) || dayNum(c.finish) > end) continue;
          out.push({ key: `${l.p.id}-${c.a.id}`, projectId: l.p.id, code: l.p.code, name: c.a.key ?? c.a.name, date: c.finish, slip: c.a.bl ? dayNum(c.finish) - dayNum(c.a.bl.f) : null, from: "Schedule" });
        }
      } else {
        for (const m of l.p.milestones) {
          if (m.actual || dayNum(m.forecast) < dayNum(TODAY) || dayNum(m.forecast) > end) continue;
          out.push({ key: `${l.p.id}-${m.name}`, projectId: l.p.id, code: l.p.code, name: m.name, date: m.forecast, slip: daysBetween(m.baseline, m.forecast), from: "Record" });
        }
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [lines]);

  const scheduled = lines.filter((l) => l.s);
  const late = lines.filter((l) => l.slip > 0);
  const worst = [...lines].sort((a, b) => b.slip - a.slip)[0]!;
  const soon = upcoming.filter((u) => dayNum(u.date) <= dayNum(TODAY) + 30);
  const stale = scheduled.filter((l) => daysBetween(l.s!.dataDate, TODAY) > 35);
  const negFloat = scheduled.filter((l) => (l.r!.finishFloat ?? 0) < 0);
  const max = Math.max(10, ...lines.map((l) => Math.abs(l.slip)));

  return (
    <div className="space-y-5">
      <KpiStrip
        items={[
          { label: "Forecast late", accent: INK.critical, value: `${late.length} of ${lines.length}`, sub: "Projects finishing after their baseline" },
          { label: "Furthest behind", accent: INK.critical, value: worst.slip > 0 ? `${worst.slip} days` : "None", sub: worst.slip > 0 ? `${worst.p.code} · ${worst.p.name}` : "Every project is on or ahead of baseline" },
          { label: "Behind contract completion", accent: "var(--c-amber-400)", value: `${negFloat.length} of ${scheduled.length}`, chip: negFloat.length ? <Chip tone="neg">Negative float</Chip> : undefined, sub: "Detailed schedules with negative float on the finish" },
          { label: "Key milestones, 30 days", accent: "var(--c-sky-400)", value: soon.length, sub: `${soon.filter((u) => (u.slip ?? 0) > 0).length} forecast late · ${upcoming.length} in ${WINDOW} days` },
          { label: "Detailed schedules", accent: "var(--c-navy-500)", value: `${scheduled.length} of ${lines.length}`, chip: stale.length ? <Chip tone="warn">{stale.length} stale</Chip> : undefined, sub: stale.length ? `No update in 35+ days: ${stale.map((l) => l.p.code).join(", ")}` : "Every schedule is updated within 35 days" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Finish against baseline" info="Detailed schedules report their calculated finish against their own baseline. Projects without one report the project record's forecast and baseline finish.">
          <Narrative>
            <Em tone={late.length ? "neg" : "pos"}>{late.length}</Em> of {lines.length} projects forecast finishing after baseline.
            {worst.slip > 0 && (
              <>
                {" "}
                <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => gotoProject(worst.p.id)}>
                  {worst.p.code}
                </button>{" "}
                is furthest out at <Em tone="neg">{worst.slip} days</Em>
                {worst.driver ? <>, and its longest path runs through {worst.driver}</> : null}.
              </>
            )}{" "}
            {upcoming.length ? (
              <>
                <Em>{upcoming.length}</Em> key {upcoming.length === 1 ? "milestone falls" : "milestones fall"} in the next {WINDOW} days.
              </>
            ) : null}
          </Narrative>
          <ul className="mt-5 space-y-1.5" aria-label="Finish variance by project">
            {[...lines]
              .sort((a, b) => b.slip - a.slip)
              .map((l) => (
                <li key={l.p.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                  <button type="button" onClick={() => gotoProject(l.p.id)} className="num truncate text-left text-xs font-semibold text-ink-2 hover:text-accent-ink" title={l.p.name}>
                    {l.p.code}
                  </button>
                  <div className="relative h-4" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                    {l.slip !== 0 && (
                      <span
                        className="absolute top-0.5 h-3 rounded-xs"
                        style={{
                          left: l.slip > 0 ? "50%" : `${50 - (Math.abs(l.slip) / max) * 50}%`,
                          width: `${Math.max(0.6, (Math.abs(l.slip) / max) * 50)}%`,
                          background: l.slip > 0 ? INK.critical : INK.done,
                        }}
                      />
                    )}
                  </div>
                  <Variance days={l.slip} short className="text-right text-xs" />
                </li>
              ))}
          </ul>
          <p className="mt-3 flex justify-between text-2xs text-ink-3" aria-hidden>
            <span>Ahead</span>
            <span>Behind</span>
          </p>
        </Panel>

        <Panel title={`Key milestones, next ${WINDOW} days`} info="Key and longest-path milestones from each project's current schedule, or the project record's milestones where there is no detailed schedule.">
          {upcoming.length ? (
            <ul className="-mx-2 max-h-[22rem] overflow-y-auto">
              {upcoming.map((u) => (
                <li key={u.key}>
                  <button type="button" onClick={() => gotoProject(u.projectId)} className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2">
                    <span className="num w-14 shrink-0 text-xs font-semibold text-ink">{shortDate(u.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{u.name}</span>
                      <span className="block text-xs text-ink-3">
                        {u.code} · {u.from === "Schedule" ? "Detailed schedule" : "Project record"}
                      </span>
                    </span>
                    <Variance days={u.slip} short className="shrink-0 text-xs" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No key milestones fall in the next {WINDOW} days.</p>
          )}
        </Panel>
      </div>

      <Panel title="Projects" flush actions={<span className="text-xs text-ink-3">Float is in working days; variance in calendar days</span>}>
        <div className="scroll-x">
          <table className="dt">
            <thead>
              <tr>
                <th>Project</th>
                <th>Schedule</th>
                <th className="r">Baseline finish</th>
                <th className="r">Forecast finish</th>
                <th className="r">Variance</th>
                <th className="r">Float</th>
                <th>Longest path</th>
                <th>Health</th>
                <th>Project record</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.p.id} data-selected={project === l.p.id}>
                  <td className="max-w-[16rem]">
                    <div className="num text-xs font-semibold text-ink-3">{l.p.code}</div>
                    <div className="truncate font-semibold text-ink">{l.p.name}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    {l.s ? (
                      <>
                        <div className="text-ink">{l.s.name}</div>
                        <div className={cx("text-xs", daysBetween(l.s.dataDate, TODAY) > 35 ? "font-semibold text-warn-ink" : "text-ink-3")}>
                          {SOURCE_LABEL[l.s.source.kind]} · data date {shortDate(l.s.dataDate)}
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-3">Milestones only</span>
                    )}
                  </td>
                  <td className="r num">{fmtDate(l.baseline)}</td>
                  <td className="r num font-semibold text-ink">{fmtDate(l.finish)}</td>
                  <td className="r">
                    <Variance days={l.slip} short />
                  </td>
                  <td className="r">{l.r ? <FloatText tf={l.r.finishFloat} /> : <span className="text-ink-4">—</span>}</td>
                  <td className="max-w-[16rem]">{l.driver ? <span className="block truncate text-xs text-ink-2" title={l.driver}>{l.driver}</span> : <span className="text-ink-4">—</span>}</td>
                  <td>{l.health ? <Chip tone={l.health.passed === l.health.of ? "pos" : l.health.of - l.health.passed > 3 ? "neg" : "warn"}>{`${l.health.passed}/${l.health.of} pass`}</Chip> : <span className="text-ink-4">—</span>}</td>
                  <td className="whitespace-nowrap">
                    {l.s ? (
                      l.keys === 0 ? (
                        <span className="text-xs text-ink-3">No key milestones mapped</span>
                      ) : l.drift ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-warn-ink">
                          <CircleAlert className="size-3.5" aria-hidden />
                          {plural(l.drift, "milestone differs", "milestones differ")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-pos-ink">
                          <CircleCheck className="size-3.5" aria-hidden />
                          {plural(l.keys, "milestone ties", "milestones tie")}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-ink-3">Source</span>
                    )}
                  </td>
                  <td className="r whitespace-nowrap">
                    {l.s ? (
                      <Button size="sm" variant="ghost" icon={<ArrowUpRight className="size-3.5" aria-hidden />} onClick={() => gotoProject(l.p.id)}>
                        Open
                      </Button>
                    ) : (
                      <Button size="sm" variant="tint" onClick={() => startNew(l.p.id)}>
                        Build
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
