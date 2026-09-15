"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltip, GRID } from "@/components/charts/chartKit";
import { Bar, Badge, Chip, Legend } from "@/components/ui/data";
import { chain } from "@/lib/budget";
import { cx, daysBetween, fmtDate, money, monthLabel, num, pct } from "@/lib/format";
import { upcomingExpiries } from "@/lib/selectors";
import { contingencyFor } from "@/mock/finance";
import { TODAY } from "@/mock/org";
import { COMMISSIONING, CX_STAGES, PROCUREMENT, SAFETY_MONTHLY, SAFETY_TARGET_TRIR, WARRANTIES } from "@/mock/operations";
import { PROJECTS, projectById } from "@/mock/projects";
import { PROPERTIES, propertyById } from "@/mock/properties";

export type Section = "Real Estate" | "Capital Equipment Projects" | "Construction Projects";
export const SECTIONS: Section[] = ["Real Estate", "Capital Equipment Projects", "Construction Projects"];

export interface WidgetDef {
  id: string;
  title: string;
  section: Section;
  info: string;
  wide?: boolean;
  render: () => ReactNode;
}

const shortName = (n: string) =>
  n
    .replace("Harborline ", "")
    .replace(" Medical Office Building", " MOB")
    .replace(" Medical Office", " MOB")
    .replace("Ambulatory Surgery Center", "ASC")
    .replace(" Primary & Urgent Care", " Care")
    .replace(" Administrative Campus", " Admin")
    .replace("Regional Hospital", "Hospital");

/* ---------------------------------------------------------------- Real Estate */

function Occupancy() {
  const rows = PROPERTIES.filter((p) => p.grossSf > 0 && p.ownership !== "Leased").sort((a, b) => a.occupancy - b.occupancy);
  return (
    <ul className="space-y-2">
      {rows.map((p) => (
        <li key={p.id} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-3">
          <Link href={`/portfolio/?property=${p.id}`} className="truncate text-sm text-ink hover:text-accent-ink">
            {shortName(p.name)}
          </Link>
          <Bar value={p.occupancy} max={1} height="h-5" color={p.occupancy < 0.85 ? "var(--c-amber-400)" : "var(--c-cobalt-600)"} label={pct(p.occupancy)} darkLabel={p.occupancy < 0.85} />
        </li>
      ))}
    </ul>
  );
}

function Expiries() {
  const rows = upcomingExpiries(548).slice(0, 7);
  const atRisk = rows.reduce((a, r) => a + r.annualRent, 0);
  return (
    <>
      <p className="mb-3 text-xs text-ink-2">
        <span className="num font-bold text-ink">{money(atRisk, { compact: true })}</span> of annual rent expires in the next 18 months.
      </p>
      <table className="dt compact quiet">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Expires</th>
            <th className="r">Rent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tenant + r.suite}>
              <td>
                <div className="max-w-[9.5rem] truncate font-semibold text-ink">{r.tenant}</div>
                <div className="max-w-[9.5rem] truncate text-xs text-ink-3">{shortName(r.propertyName)}</div>
              </td>
              <td className="whitespace-nowrap">
                <div className="num text-ink">{fmtDate(r.expiry, "month")}</div>
                <div className={cx("num text-xs font-semibold", r.daysOut <= 120 ? "text-neg-ink" : r.daysOut <= 365 ? "text-warn-ink" : "text-ink-3")}>{r.daysOut} days</div>
              </td>
              <td className="r">{money(r.annualRent, { compact: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Noi() {
  const data = PROPERTIES.filter((p) => p.noi !== 0)
    .map((p) => ({ id: p.id, name: shortName(p.name), noi: p.noi }))
    .sort((a, b) => b.noi - a.noi);
  const total = data.reduce((a, d) => a + d.noi, 0);
  const pos = Math.max(...data.map((d) => d.noi), 1);
  const neg = Math.max(...data.map((d) => -d.noi), 0);
  const zero = (neg / (pos + neg)) * 100; // where the zero line sits, in % of the track
  return (
    <>
      <p className="mb-3 text-xs text-ink-2">
        Portfolio NOI <span className="num font-bold text-ink">{money(total, { compact: true })}</span> annualized. Land and leased-in sites carry cost.
      </p>
      <ul className="space-y-2">
        {data.map((d) => {
          const w = d.noi >= 0 ? (d.noi / (pos + neg)) * 100 : (-d.noi / (pos + neg)) * 100;
          const roomy = w > 26;
          return (
            <li key={d.id} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3">
              <Link href={`/portfolio/?property=${d.id}`} className="truncate text-sm text-ink hover:text-accent-ink">
                {d.name}
              </Link>
              <div className="relative h-5">
                {neg > 0 && <span aria-hidden className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${zero}%` }} />}
                <span
                  className="absolute inset-y-0 flex items-center rounded-xs"
                  style={{ left: d.noi >= 0 ? `${zero}%` : `${zero - w}%`, width: `${Math.max(w, 0.8)}%`, background: d.noi < 0 ? "var(--c-coral-500)" : "var(--c-cobalt-600)" }}
                >
                  {roomy && <span className={cx("num px-2 text-2xs font-bold", d.noi < 0 ? "text-ink" : "text-white")}>{money(d.noi, { compact: true })}</span>}
                </span>
                {!roomy && (
                  <span className="num absolute top-1/2 -translate-y-1/2 text-2xs font-bold text-ink-2" style={{ left: d.noi >= 0 ? `calc(${zero + w}% + 0.4rem)` : `calc(${zero}% + 0.4rem)` }}>
                    {money(d.noi, { compact: true })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ----------------------------------------------------- Capital Equipment */

function LeadTimes() {
  const rows = [...PROCUREMENT].sort((a, b) => b.currentWeeks - b.quotedWeeks - (a.currentWeeks - a.quotedWeeks));
  const max = Math.max(...rows.map((r) => r.currentWeeks));
  return (
    <>
      <Legend className="mb-3" items={[{ label: "Quoted lead time", color: "var(--c-cobalt-500)" }, { label: "Slip since order", color: "var(--c-coral-500)" }]} />
      <ul className="space-y-3">
        {rows.slice(0, 7).map((r) => {
          const slip = Math.max(0, r.currentWeeks - r.quotedWeeks);
          const late = daysBetween(r.needBy, r.eta);
          return (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{r.item}</span>
                {late > 0 && r.status !== "Delivered" ? <Chip tone="neg">{Math.round(late / 7)} wks late</Chip> : <Chip tone={r.status === "Delivered" ? "pos" : "neutral"}>{r.status}</Chip>}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex h-2.5 min-w-0 flex-1" role="img" aria-label={`${r.quotedWeeks} weeks quoted${slip ? `, ${slip} weeks slip` : ""}`}>
                  <span className="h-full rounded-l-xs" style={{ width: `${(r.quotedWeeks / max) * 100}%`, background: "var(--c-cobalt-500)", borderRadius: slip ? undefined : 3 }} />
                  {slip > 0 && <span className="h-full rounded-r-xs" style={{ width: `${(slip / max) * 100}%`, background: "var(--c-coral-500)" }} />}
                </div>
                <span className="num w-16 shrink-0 text-right text-2xs font-bold text-ink-2">
                  {r.currentWeeks} wks{slip > 0 && <span className="text-neg-ink"> +{slip}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const CX_COLOR: Record<string, string> = {
  "Not started": "var(--line-strong)",
  "Pre-functional": "var(--c-sky-400)",
  "Functional testing": "var(--c-cobalt-500)",
  "Issues open": "var(--c-coral-500)",
  Accepted: "var(--c-teal-500)",
};

function Commissioning() {
  const byProject = [...new Set(COMMISSIONING.map((c) => c.projectId))].map((id) => ({ id, systems: COMMISSIONING.filter((c) => c.projectId === id) }));
  const accepted = COMMISSIONING.filter((c) => c.stage === "Accepted").length;
  const issues = COMMISSIONING.reduce((a, c) => a + c.openIssues, 0);
  return (
    <>
      <p className="mb-3 text-xs text-ink-2">
        <span className="num font-bold text-ink">{accepted}</span> of {COMMISSIONING.length} systems accepted · <span className="num font-bold text-neg-ink">{issues}</span> open issues
      </p>
      <ul className="space-y-3">
        {byProject.map(({ id, systems }) => (
          <li key={id}>
            <div className="mb-1 flex items-baseline gap-3 text-sm">
              <Link href={`/projects/${id}/`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-accent-ink">
                {projectById(id)!.name}
              </Link>
              <span className="num shrink-0 text-xs whitespace-nowrap text-ink-3">{systems.length} systems</span>
            </div>
            <div className="flex h-3 gap-0.5" role="img" aria-label={systems.map((s) => `${s.system}: ${s.stage}`).join("; ")}>
              {CX_STAGES.flatMap((st) => systems.filter((s) => s.stage === st)).map((s) => (
                <span key={s.system} title={`${s.system} — ${s.stage}${s.openIssues ? `, ${s.openIssues} issues` : ""}`} className="h-full flex-1 first:rounded-l-xs last:rounded-r-xs" style={{ background: CX_COLOR[s.stage] }} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Legend className="mt-4" items={CX_STAGES.map((s) => ({ label: s, color: CX_COLOR[s]! }))} />
    </>
  );
}

function Warranties() {
  const rows = [...WARRANTIES].sort((a, b) => (a.end < b.end ? -1 : 1));
  return (
    <ul className="space-y-3">
      {rows.slice(0, 6).map((w) => {
        const total = daysBetween(w.start, w.end);
        const used = Math.min(total, Math.max(0, daysBetween(w.start, TODAY)));
        const left = daysBetween(TODAY, w.end);
        return (
          <li key={w.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink">{w.asset}</span>
              <Chip tone={left <= 30 ? "neg" : left <= 90 ? "warn" : "neutral"}>{left <= 0 ? "Expired" : `${left} days left`}</Chip>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-2 flex-1 rounded-full bg-sunk">
                <div className="h-full rounded-full" style={{ width: `${(used / total) * 100}%`, background: left <= 90 ? "var(--c-amber-400)" : "var(--c-teal-500)" }} />
              </div>
              <span className="num w-20 shrink-0 text-right text-2xs text-ink-3">ends {fmtDate(w.end, "month")}</span>
            </div>
            <div className="text-xs text-ink-3">
              {propertyById(w.propertyId)?.name} · {w.vendor}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------ Construction */

function Safety() {
  const data = SAFETY_MONTHLY.map((m, i, arr) => {
    const win = arr.slice(Math.max(0, i - 2), i + 1);
    const hrs = win.reduce((a, x) => a + x.hours, 0);
    const rec = win.reduce((a, x) => a + x.recordables, 0);
    return { month: m.month, trir: Number(((rec * 200_000) / hrs).toFixed(2)), nearMisses: m.nearMisses };
  });
  const hours = SAFETY_MONTHLY.reduce((a, m) => a + m.hours, 0);
  const rec = SAFETY_MONTHLY.reduce((a, m) => a + m.recordables, 0);
  const trir = (rec * 200_000) / hours;
  const days = Math.min(...PROJECTS.filter((p) => p.safety.hoursWorked > 0).map((p) => p.safety.daysSinceIncident));
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-ink-3">TRIR, 11 months</div>
          <div className={cx("num text-xl font-semibold", trir > SAFETY_TARGET_TRIR ? "text-neg-ink" : "text-ink")}>{num(trir, 2)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">Hours worked</div>
          <div className="num text-xl font-semibold text-ink">{num(hours / 1000, 0)}K</div>
        </div>
        <div>
          <div className="text-xs text-ink-3">Days since recordable</div>
          <div className="num text-xl font-semibold text-ink">{days}</div>
        </div>
      </div>
      <Legend className="mb-2" items={[{ label: "TRIR, 3-month rolling", color: "var(--c-navy-500)" }, { label: `Target ${SAFETY_TARGET_TRIR}`, color: "var(--c-coral-500)", dashed: true }]} />
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%" debounce={120}>
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS} minTickGap={20} />
            <YAxis {...AXIS} width={30} domain={[0, 4]} />
            <Tooltip content={<ChartTooltip format={(v) => num(v, 2)} labelFormat={(l) => fmtDate(String(l), "month")} />} />
            <ReferenceLine y={SAFETY_TARGET_TRIR} stroke="var(--c-coral-500)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="trir" name="TRIR (3-mo rolling)" stroke="var(--c-navy-500)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Contingency() {
  const rows = PROJECTS.map((p) => {
    const b = contingencyFor(p.id);
    const original = b.reduce((a, x) => a + x.original, 0);
    const drawn = b.reduce((a, x) => a + x.drawn, 0);
    const pending = b.reduce((a, x) => a + x.pending, 0);
    return { p, original, drawn, pending, used: (drawn + pending) / Math.max(1, original) };
  }).sort((a, b) => b.used - a.used);
  return (
    <>
      <Legend className="mb-3" items={[{ label: "Drawn", color: "var(--c-navy-500)" }, { label: "Pending", color: "var(--c-amber-400)" }, { label: "Remaining", color: "var(--line-strong)" }]} />
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.p.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.75rem] items-center gap-3">
            <span className="truncate text-sm text-ink">{r.p.name}</span>
            <div className="flex h-3 overflow-hidden rounded-xs bg-sunk" role="img" aria-label={`${pct(r.drawn / r.original)} drawn, ${pct(r.pending / r.original)} pending`}>
              <span style={{ width: `${Math.min(100, (r.drawn / r.original) * 100)}%`, background: "var(--c-navy-500)" }} />
              <span style={{ width: `${Math.min(100, (r.pending / r.original) * 100)}%`, background: "var(--c-amber-400)" }} />
            </div>
            <span className={cx("num text-right text-xs font-bold", r.used > 0.75 ? "text-neg-ink" : "text-ink-2")}>{pct(r.used)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Spi() {
  const rows = [...PROJECTS].sort((a, b) => a.spi - b.spi);
  const span = 0.25;
  return (
    <ul className="space-y-2.5">
      {rows.map((p) => {
        const d = Math.max(-span, Math.min(span, p.spi - 1));
        const w = (Math.abs(d) / span) * 50;
        return (
          <li key={p.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.75rem] items-center gap-3">
            <Link href={`/projects/${p.id}/`} className="truncate text-sm text-ink hover:text-accent-ink">
              {p.name}
            </Link>
            <div className="relative h-3" aria-hidden>
              <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
              <span className="absolute top-0.5 h-2 rounded-xs" style={{ left: d < 0 ? `${50 - w}%` : "50%", width: `${Math.max(w, 1)}%`, background: d < -0.1 ? "var(--c-coral-500)" : d < -0.02 ? "var(--c-amber-400)" : "var(--c-teal-500)" }} />
            </div>
            <span className={cx("num text-right text-xs font-bold", p.spi < 0.9 ? "text-neg-ink" : p.spi < 0.98 ? "text-warn-ink" : "text-ink-2")}>{num(p.spi, 2)}</span>
          </li>
        );
      })}
      <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.75rem] gap-3 pt-1 text-2xs text-ink-3">
        <span />
        <span className="flex justify-between">
          <span>0.75 behind</span>
          <span>1.00</span>
          <span>1.25 ahead</span>
        </span>
        <span />
      </li>
    </ul>
  );
}

export const WIDGETS: WidgetDef[] = [
  { id: "occupancy", title: "Occupancy by property", section: "Real Estate", info: "Occupied share of each building. Amber marks buildings under 85%.", render: () => <Occupancy /> },
  { id: "expiries", title: "Upcoming lease expiries", section: "Real Estate", info: "Third-party leases expiring in the next 18 months.", render: () => <Expiries /> },
  { id: "noi", title: "Property NOI", section: "Real Estate", info: "Annualized net operating income by property.", render: () => <Noi /> },
  { id: "leadtimes", title: "Procurement lead times", section: "Capital Equipment Projects", info: "Quoted vs. current manufacturer lead times for long-lead equipment.", render: () => <LeadTimes /> },
  { id: "cx", title: "Equipment commissioning", section: "Capital Equipment Projects", info: "Each segment is one system, ordered by commissioning stage.", render: () => <Commissioning /> },
  { id: "warranty", title: "Warranty lifecycles", section: "Capital Equipment Projects", info: "Share of each warranty term used; sorted by nearest expiry.", render: () => <Warranties /> },
  { id: "safety", title: "Safety incident rate", section: "Construction Projects", info: "Total recordable incident rate per 200,000 hours, 3-month rolling, all active sites.", render: () => <Safety /> },
  { id: "contingency", title: "Contingency drawdown", section: "Construction Projects", info: "Design + contractor contingency + owner’s reserve: drawn and pending as a share of what was carried.", render: () => <Contingency /> },
  { id: "spi", title: "Milestone schedule variance (SPI)", section: "Construction Projects", info: "Schedule performance index by project. Below 1.00 is behind plan.", render: () => <Spi /> },
];

export function SectionSummary({ section }: { section: Section }) {
  if (section === "Real Estate") {
    const occ = PROPERTIES.filter((p) => p.grossSf > 0 && p.ownership !== "Leased");
    const avg = occ.reduce((a, p) => a + p.occupancy * p.grossSf, 0) / occ.reduce((a, p) => a + p.grossSf, 0);
    return <Badge tone="neutral" dot={false}>Weighted occupancy {pct(avg)}</Badge>;
  }
  if (section === "Capital Equipment Projects") {
    const late = PROCUREMENT.filter((r) => r.status !== "Delivered" && daysBetween(r.needBy, r.eta) > 0).length;
    return <Badge tone={late ? "warn" : "pos"}>{late} items late to need-by</Badge>;
  }
  const behind = PROJECTS.filter((p) => p.spi < 0.95).length;
  const over = PROJECTS.filter((p) => chain(p.totals).H < 0).length;
  return (
    <span className="flex gap-1.5">
      <Badge tone={behind ? "warn" : "pos"}>{behind} behind schedule</Badge>
      <Badge tone={over ? "neg" : "pos"}>{over} over budget</Badge>
    </span>
  );
}
