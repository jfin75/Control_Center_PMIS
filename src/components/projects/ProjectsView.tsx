"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Badge, Legend } from "@/components/ui/data";
import { Segmented } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/Panel";
import { chain } from "@/lib/budget";
import { cx, fmtDate, money, pct } from "@/lib/format";
import { finishSlip } from "@/lib/selectors";
import { person } from "@/mock/org";
import { PROJECTS, SCHEDULE_STATUS, type Phase, type ScheduleStatus } from "@/mock/projects";
import { propertyById } from "@/mock/properties";

const PHASES: Phase[] = ["Preconstruction", "Design", "Procurement", "Construction", "Closeout"];

export function ProjectsView() {
  const [status, setStatus] = useState<"all" | ScheduleStatus>("all");
  const [phase, setPhase] = useState<"all" | Phase>("all");
  const [sort, setSort] = useState<"risk" | "budget" | "finish">("risk");

  const list = useMemo(() => {
    const rank: Record<ScheduleStatus, number> = { delayed: 0, "at-risk": 1, "on-schedule": 2 };
    return PROJECTS.filter((p) => status === "all" || p.status === status)
      .filter((p) => phase === "all" || p.phase === phase)
      .sort((a, b) =>
        sort === "risk" ? rank[a.status] - rank[b.status] || chain(a.totals).H - chain(b.totals).H : sort === "budget" ? chain(b.totals).C - chain(a.totals).C : a.forecastFinish < b.forecastFinish ? -1 : 1,
      );
  }, [status, phase, sort]);

  const count = (s: ScheduleStatus) => PROJECTS.filter((p) => p.status === s).length;

  return (
    <>
      <PageHeader
        title="Projects"
        meta={`${PROJECTS.length} approved, active capital projects`}
        actions={
          <>
            <label htmlFor="phase" className="sr-only">
              Phase
            </label>
            <select id="phase" className="field" value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)}>
              <option value="all">All phases</option>
              {PHASES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <label htmlFor="sort" className="sr-only">
              Sort
            </label>
            <select id="sort" className="field" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="risk">Sort: most at risk</option>
              <option value="budget">Sort: largest budget</option>
              <option value="finish">Sort: finishing soonest</option>
            </select>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter by schedule status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: PROJECTS.length },
            { value: "on-schedule", label: "On schedule", count: count("on-schedule") },
            { value: "at-risk", label: "Critical path risk", count: count("at-risk") },
            { value: "delayed", label: "Delayed", count: count("delayed") },
          ]}
        />
        <Legend
          items={[
            { label: "Actual (paid)", color: "var(--c-teal-500)" },
            { label: "Committed", color: "var(--c-cobalt-500)" },
            { label: "Approved budget", color: "var(--line-strong)" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-ink-2">No projects match these filters.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((p) => {
            const c = chain(p.totals);
            const st = SCHEDULE_STATUS[p.status];
            const pm = person(p.pmId);
            const slip = finishSlip(p);
            const scale = Math.max(c.C, c.G);
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}/`} className="panel group flex h-full flex-col p-5 transition-[box-shadow,border-color] duration-[var(--dur)] hover:border-line-strong hover:shadow-raised">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-md leading-snug font-semibold text-ink group-hover:text-accent-ink">{p.name}</h2>
                      <p className="mt-1 truncate text-xs text-ink-3">
                        <span className="num font-semibold text-ink-2">{p.code}</span> · {p.phase} · {propertyById(p.propertyId)?.name}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>

                  <div className="mt-5 mb-5">
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="text-ink-3">Committed vs. actual</span>
                      <span className="num text-ink-2">
                        <span className="font-bold text-ink">{money(c.D, { compact: true })}</span> committed · <span className="font-bold text-ink">{money(c.I, { compact: true })}</span> paid
                      </span>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-xs bg-sunk" role="img" aria-label={`${pct(c.D / c.C)} of approved budget committed, ${pct(c.I / c.C)} paid`}>
                      <span className="absolute inset-y-0 left-0 bg-cobalt" style={{ width: `${(c.D / scale) * 100}%` }} />
                      <span className="absolute inset-y-0 left-0 bg-teal" style={{ width: `${(c.I / scale) * 100}%` }} />
                      {c.G > c.C && <span className="absolute inset-y-0 w-0.5 bg-neg" style={{ left: `${(c.C / scale) * 100}%` }} title="Approved budget line" />}
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs">
                      <span className="num text-ink-3">Approved {money(c.C, { compact: true })}</span>
                      <span className={cx("num font-semibold", c.H < 0 ? "text-neg-ink" : "text-pos-ink")}>
                        {c.H < 0 ? "Over " : "Under "}
                        {money(Math.abs(c.H), { compact: true })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={pm.name} tone={pm.tone} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{pm.name}</span>
                        <span className="block text-2xs text-ink-3">Lead PM</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-sm font-semibold text-ink">{fmtDate(p.forecastFinish, "month")}</span>
                      <span className={cx("num block text-2xs", slip > 0 ? "font-semibold text-neg-ink" : "text-ink-3")}>{slip > 0 ? `${slip} days late` : "Forecast finish"}</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
