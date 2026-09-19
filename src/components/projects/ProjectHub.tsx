"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, Mail, Phone } from "lucide-react";
import { Avatar, Badge, Em, KpiStrip, Narrative, type Tone } from "@/components/ui/data";
import { Segmented, Tabs } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { chain } from "@/lib/budget";
import { cx, daysBetween, fmtDate, money, num, pct } from "@/lib/format";
import { finishSlip, milestoneSlip } from "@/lib/selectors";
import { contractor, person, TODAY } from "@/mock/org";
import { SCHEDULE_STATUS, projectById, type Risk } from "@/mock/projects";
import { CONTRACTS } from "@/mock/contracts";
import { propertyById } from "@/mock/properties";
import { RFI_PROJECT_IDS } from "@/mock/rfis";
import { REGISTER_PROJECT_IDS } from "@/mock/submittals";

type Tab = "overview" | "team" | "milestones" | "risks";

export function ProjectHub({ id }: { id: string }) {
  const p = projectById(id)!;
  const c = chain(p.totals);
  const st = SCHEDULE_STATUS[p.status];
  const prop = propertyById(p.propertyId)!;
  const pm = person(p.pmId);
  const [tab, setTab] = useState<Tab>("overview");
  const slip = finishSlip(p);
  const openRisks = p.risks.filter((r) => r.status !== "Closed");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-ink-3">
        <Link href="/projects/" className="font-semibold hover:text-accent-ink">
          Projects
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="num" aria-current="page">
          {p.code}
        </span>
      </nav>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            <Link href={`/portfolio/?property=${prop.id}`} className="font-semibold text-accent-ink hover:underline">
              {prop.name}
            </Link>
            <span className="text-ink-4">·</span>
            {p.phase}
            <span className="text-ink-4">·</span>
            PM {pm.name}
            <span className="text-ink-4">·</span>
            {p.funding}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          {REGISTER_PROJECT_IDS.includes(p.id) && (
            <Link href={`/submittals/?project=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
              Submittals <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
          {RFI_PROJECT_IDS.includes(p.id) && (
            <Link href={`/rfis/?project=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
              RFIs <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
          {CONTRACTS.some((c) => c.projectId === p.id) && (
            <Link href={`/contracts/?project=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
              Contracts <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
          <Link href={`/cost/?project=${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
            Cost detail <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <KpiStrip
        className="mb-5"
        items={[
          { label: "Approved budget (C)", value: money(c.C, { compact: true }), sub: `Original ${money(c.A, { compact: true })}` },
          { label: "Forecast at completion (G)", value: money(c.G, { compact: true }), sub: <span className={c.H < 0 ? "font-semibold text-neg-ink" : "font-semibold text-pos-ink"}>{c.H < 0 ? "Over" : "Under"} by {money(Math.abs(c.H), { compact: true })}</span> },
          { label: "Paid to date (I)", value: money(c.I, { compact: true }), sub: `${pct(c.K)} of committed` },
          { label: "Physical complete", value: pct(p.physicalComplete), sub: `SPI ${num(p.spi, 2)}` },
          { label: "Forecast finish", value: fmtDate(p.forecastFinish, "month"), sub: slip > 0 ? <span className="font-semibold text-neg-ink">{slip} days behind baseline</span> : "On baseline" },
        ]}
      />

      <div className="mb-5">
        <Tabs
          idBase="hub"
          label="Project sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "team", label: `Team · ${p.team.length}` },
            { value: "milestones", label: `Milestones · ${p.milestones.length}` },
            { value: "risks", label: `Risk log · ${openRisks.length} open` },
          ]}
        />
      </div>

      <div id="hub-panel" role="tabpanel" aria-labelledby={`hub-tab-${tab}`}>
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-5">
              <Panel title="Scope">
                <Narrative className="!text-md !leading-7 text-ink-2">{p.summary}</Narrative>
                <p className="mt-4 text-sm text-ink-2">
                  <Em>{pct(c.D / c.C)}</Em> of the approved budget is committed; <Em>{money(c.F, { compact: true })}</Em> is still to be let. {p.pending.length > 0 && (
                    <>
                      <Em>{p.pending.length}</Em> pending change{p.pending.length > 1 ? "s" : ""} worth <Em>{money(p.pending.reduce((a, x) => a + x.amount, 0), { compact: true })}</Em> await decision.
                    </>
                  )}
                </p>
              </Panel>
              <MilestoneTimeline id={id} compact />
            </div>
            <div className="grid content-start gap-5">
              <Panel title="Top risks">
                <ul className="space-y-3">
                  {[...openRisks].sort((a, b) => b.probability * b.impact - a.probability * a.impact).slice(0, 3).map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <ScoreChip r={r} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{r.title}</div>
                        <div className="text-xs text-ink-3">
                          {r.category} · {r.costExposure ? money(r.costExposure, { compact: true }) : "No cost"} · {r.scheduleDays ? `${r.scheduleDays} days` : "No delay"}
                        </div>
                      </div>
                    </li>
                  ))}
                  {!openRisks.length && <li className="text-sm text-ink-2">No open risks.</li>}
                </ul>
              </Panel>
              <Panel title="Safety">
                <dl className="grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-ink-3">Hours</dt>
                    <dd className="num text-lg font-semibold text-ink">{num(p.safety.hoursWorked / 1000, 1)}K</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Recordables</dt>
                    <dd className={cx("num text-lg font-semibold", p.safety.recordables ? "text-neg-ink" : "text-ink")}>{p.safety.recordables}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Near misses</dt>
                    <dd className="num text-lg font-semibold text-ink">{p.safety.nearMisses}</dd>
                  </div>
                </dl>
              </Panel>
            </div>
          </div>
        )}

        {tab === "team" && (
          <Panel title="Team directory" flush>
            <div className="scroll-x">
              <table className="dt min-w-[44rem]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role on project</th>
                    <th>Organization</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {p.team.map((m) => {
                    if (m.kind === "staff") {
                      const s = person(m.refId);
                      return (
                        <tr key={m.refId + m.role}>
                          <td>
                            <span className="flex items-center gap-2.5">
                              <Avatar name={s.name} tone={s.tone} size="sm" />
                              <span>
                                <span className="block font-semibold text-ink">{s.name}</span>
                                <span className="block text-xs text-ink-3">{s.title}</span>
                              </span>
                            </span>
                          </td>
                          <td>{m.role}</td>
                          <td className="text-ink-2">Harborline Health</td>
                          <td>
                            <span className="flex flex-col gap-0.5 text-xs">
                              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 text-accent-ink hover:underline">
                                <Mail className="size-3" aria-hidden />
                                {s.email}
                              </a>
                              <a href={`tel:${s.phone.replace(/\D/g, "")}`} className="num inline-flex items-center gap-1.5 text-ink-2">
                                <Phone className="size-3" aria-hidden />
                                {s.phone}
                              </a>
                            </span>
                          </td>
                        </tr>
                      );
                    }
                    const f = contractor(m.refId);
                    return (
                      <tr key={m.refId + m.role}>
                        <td>
                          <span className="flex items-center gap-2.5">
                            <Avatar name={f.name} tone={8} size="sm" />
                            <span className="font-semibold text-ink">{f.name}</span>
                          </span>
                        </td>
                        <td>{m.role}</td>
                        <td className="text-ink-2">
                          {f.kind} · {f.city}
                        </td>
                        <td className="text-xs text-ink-3">{f.trade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === "milestones" && <MilestoneTimeline id={id} />}

        {tab === "risks" && <RiskLog id={id} />}
      </div>
    </>
  );
}

function ScoreChip({ r }: { r: Risk }) {
  const s = r.probability * r.impact;
  const tone: Tone = s >= 15 ? "neg" : s >= 8 ? "warn" : "neutral";
  return (
    <span className={cx("num inline-flex size-9 shrink-0 flex-col items-center justify-center rounded-md text-sm leading-none font-bold", tone === "neg" ? "bg-neg-tint text-neg-ink" : tone === "warn" ? "bg-warn-tint text-warn-ink" : "bg-sunk text-ink-2")}>
      {s}
      <span className="sr-only"> risk score</span>
    </span>
  );
}

function MilestoneTimeline({ id, compact = false }: { id: string; compact?: boolean }) {
  const p = projectById(id)!;
  const ms = p.milestones;
  const dates = ms.flatMap((m) => [m.baseline, m.forecast, m.actual].filter(Boolean) as string[]).concat(TODAY);
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(1, daysBetween(min, max));
  const xp = (d: string) => Math.min(100, Math.max(0, (daysBetween(min, d) / span) * 100));
  const x = (d: string) => `${xp(d)}%`;
  const y0 = Number(min.slice(0, 4));
  const y1 = Number(max.slice(0, 4));
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => String(y0 + i)).filter((y) => xp(`${y}-01-01`) > 2 && xp(`${y}-01-01`) < 98);

  return (
    <Panel
      title="Milestone timeline"
      info="Hollow diamond: baseline. Filled diamond: forecast or actual. Line shows slip."
      actions={
        <span className="flex items-center gap-3 text-2xs font-semibold text-ink-2">
          <span className="flex items-center gap-1.5">
            <Diamond hollow /> Baseline
          </span>
          <span className="flex items-center gap-1.5">
            <Diamond color="var(--c-cobalt-500)" /> Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <Diamond color="var(--c-teal-500)" /> Complete
          </span>
        </span>
      }
    >
      <div className="relative">
        <div className="grid grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)_4.5rem] gap-x-4">
          <div />
          <div className="relative mb-2 h-4 text-2xs text-ink-3">
            <span className="num absolute left-0">{fmtDate(min, "month")}</span>
            {years.map((y) => (
              <span key={y} className="num absolute -translate-x-1/2 font-semibold" style={{ left: x(`${y}-01-01`) }}>
                {y}
              </span>
            ))}
          </div>
          <div className="text-right text-2xs font-semibold text-ink-3">Slip</div>
          {ms.map((m) => {
            const s = milestoneSlip(m);
            const done = !!m.actual;
            const end = m.actual ?? m.forecast;
            const a = m.baseline < end ? m.baseline : end;
            const b = m.baseline < end ? end : m.baseline;
            return (
              <div key={m.name} className="contents">
                <div className={cx("min-w-0 border-t border-line-soft", compact ? "py-2" : "py-2.5")}>
                  <div className="truncate text-sm font-semibold text-ink">{m.name}</div>
                  <div className="num text-xs text-ink-3">{done ? `Done ${fmtDate(m.actual!)}` : `Forecast ${fmtDate(m.forecast)}`}</div>
                </div>
                <div className="relative border-t border-line-soft">
                  <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})`, background: s > 0 ? "var(--c-coral-500)" : "var(--c-teal-500)", opacity: 0.6 }} />
                  <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x(m.baseline) }}>
                    <Diamond hollow />
                  </span>
                  <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x(end) }}>
                    <Diamond color={done ? "var(--c-teal-500)" : s > 0 ? "var(--c-coral-500)" : "var(--c-cobalt-500)"} />
                  </span>
                </div>
                <div className={cx("num border-t border-line-soft text-right text-sm font-semibold", compact ? "py-2" : "py-2.5", s > 0 ? "text-neg-ink" : s < 0 ? "text-pos-ink" : "text-ink-3")}>
                  <span className="relative top-1">{s === 0 ? "—" : `${s > 0 ? "+" : ""}${s}d`}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Today marker spans the chart column */}
        <div className="pointer-events-none absolute inset-y-0 grid w-full grid-cols-[minmax(10rem,16rem)_minmax(0,1fr)_4.5rem] gap-x-4" aria-hidden>
          <div />
          <div className="relative">
            <span className="absolute top-5 bottom-0 w-px bg-accent" style={{ left: x(TODAY) }} />
            <span className="absolute top-0 -translate-x-1/2 rounded-xs bg-accent px-1 text-[0.625rem] font-bold text-white" style={{ left: x(TODAY) }}>
              Today
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Diamond({ color, hollow }: { color?: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className="block size-2.5 rotate-45 rounded-[1.5px]"
      style={hollow ? { border: "2px solid var(--c-navy-500)", background: "var(--surface)" } : { background: color }}
    />
  );
}

function RiskLog({ id }: { id: string }) {
  const p = projectById(id)!;
  const [filter, setFilter] = useState<"open" | "all">("open");
  const risks = p.risks.filter((r) => filter === "all" || r.status !== "Closed").sort((a, b) => b.probability * b.impact - a.probability * a.impact);
  const cell = (pr: number, im: number) => p.risks.filter((r) => r.status !== "Closed" && r.probability === pr && r.impact === im);
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Panel title="Heat map" info="Open risks by probability (rows) and impact (columns).">
        <div className="grid grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1" role="table" aria-label="Open risks by probability (rows, 5 high) and impact (columns, 5 high)">
          {[5, 4, 3, 2, 1].map((pr) => (
            <div key={pr} className="contents" role="row">
              <span className="num flex items-center text-2xs font-semibold text-ink-3" role="rowheader">
                {pr}
              </span>
              {[1, 2, 3, 4, 5].map((im) => {
                const s = pr * im;
                const n = cell(pr, im).length;
                return (
                  <span
                    key={im}
                    role="cell"
                    aria-label={`Probability ${pr}, impact ${im}: ${n} risks`}
                    className={cx(
                      "num flex aspect-square items-center justify-center rounded-xs text-sm font-bold",
                      s >= 15 ? "bg-neg-tint text-neg-ink" : s >= 8 ? "bg-warn-tint text-warn-ink" : "bg-sunk text-ink-3",
                      n > 0 && "ring-2 ring-inset ring-current",
                    )}
                  >
                    {n || ""}
                  </span>
                );
              })}
            </div>
          ))}
          <span />
          {[1, 2, 3, 4, 5].map((im) => (
            <span key={im} className="num text-center text-2xs font-semibold text-ink-3">
              {im}
            </span>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-2xs text-ink-3">
          <span>↑ Probability</span>
          <span>Impact →</span>
        </div>
      </Panel>
      <Panel
        title="Risk log"
        flush
        actions={
          <Segmented
            size="sm"
            label="Show risks"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open" },
              { value: "all", label: "All" },
            ]}
          />
        }
      >
        <div className="scroll-x">
          <table className="dt min-w-[52rem]">
            <thead>
              <tr>
                <th>Score</th>
                <th>Risk</th>
                <th>Owner</th>
                <th className="r">Cost exposure</th>
                <th className="r">Delay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td className="w-16">
                    <ScoreChip r={r} />
                  </td>
                  <td>
                    <div className="font-semibold text-ink">{r.title}</div>
                    <div className="mt-0.5 max-w-[34rem] text-xs text-ink-2">
                      <span className="font-semibold text-ink-3">{r.id} · {r.category} · </span>
                      {r.mitigation}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{person(r.ownerId).name}</td>
                  <td className="r">{r.costExposure ? money(r.costExposure) : "–"}</td>
                  <td className="r">{r.scheduleDays ? `${r.scheduleDays}d` : "–"}</td>
                  <td>
                    <Badge tone={r.status === "Open" ? "neg" : r.status === "Mitigating" ? "warn" : r.status === "Watching" ? "info" : "pos"}>{r.status}</Badge>
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
