"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { BrandMark } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/controls";
import { Badge } from "@/components/ui/data";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { chain } from "@/lib/budget";
import { cx, fmtDate, money, pct } from "@/lib/format";
import { downloadCsv, downloadExcel } from "@/lib/exporters";
import { milestoneSlip, upcomingExpiries } from "@/lib/selectors";
import { linesFor, cashFlow } from "@/mock/finance";
import { LEVEL1 } from "@/mock/costCodes";
import { ORG, TODAY } from "@/mock/org";
import { PROJECTS, SCHEDULE_STATUS } from "@/mock/projects";
import { REPORTS } from "@/mock/workspace";

type Cell = string | number;
interface ReportData {
  columns: string[];
  numeric: boolean[];
  rows: Cell[][];
  total?: Cell[];
  note: string;
}

function build(id: string): ReportData {
  switch (id) {
    case "exec-monthly": {
      const rows = PROJECTS.map((p) => {
        const c = chain(p.totals);
        return [p.code, p.name, c.A, c.B, c.C, c.D, c.G, c.H, c.I, Number.isFinite(c.K) ? c.K : 0, SCHEDULE_STATUS[p.status].label];
      });
      const sums = [2, 3, 4, 5, 6, 7, 8].map((i) => rows.reduce((a, r) => a + (r[i] as number), 0));
      return {
        columns: ["Code", "Project", "A Original", "B Adjust.", "C Approved", "D Committed", "G Forecast", "H Variance", "I Paid", "K % paid", "Schedule"],
        numeric: [false, false, true, true, true, true, true, true, true, true, false],
        rows,
        total: ["", "Program total", ...sums, sums[6]! / sums[3]!, ""],
        note: "Budget chain per the Owner’s Budget Summary Report. H negative = forecast overrun.",
      };
    }
    case "committed-actual": {
      const rows: Cell[][] = [];
      for (const p of PROJECTS) {
        for (const l of LEVEL1) {
          const ls = linesFor(p.id).filter((x) => x.level1 === l.name);
          const D = ls.reduce((a, x) => a + x.D, 0);
          const I = ls.reduce((a, x) => a + x.I, 0);
          if (D) rows.push([p.code, l.name, D, I, D - I, I / D]);
        }
      }
      const D = rows.reduce((a, r) => a + (r[2] as number), 0);
      const I = rows.reduce((a, r) => a + (r[3] as number), 0);
      return { columns: ["Project", "Level 1 classification", "Committed (D)", "Paid (I)", "Unpaid (D − I)", "K"], numeric: [false, false, true, true, true, true], rows, total: ["Total", "", D, I, D - I, I / D], note: "Only classifications with commitments are listed." };
    }
    case "change-log": {
      const rows: Cell[][] = [];
      for (const p of PROJECTS) {
        p.adjustments.filter((a) => a.classifier).forEach((a) => rows.push([p.code, a.description, a.classifier!, "Executed", a.amount, fmtDate(a.approved)]));
        p.pending.forEach((c) => rows.push([p.code, `${c.number} – ${c.title}`, c.classifier, c.status, c.amount, fmtDate(c.submitted)]));
      }
      return { columns: ["Project", "Change", "Classifier", "Status", "Amount", "Date"], numeric: [false, false, false, false, true, false], rows, total: ["Total", "", "", "", rows.reduce((a, r) => a + (r[4] as number), 0), ""], note: "OC Owner Change · AEO/EEO Architect/Engineer Error & Omission · LC Latent Condition · MISC." };
    }
    case "milestones": {
      const rows = PROJECTS.flatMap((p) => p.milestones.map((m) => [p.code, m.name, fmtDate(m.baseline), fmtDate(m.actual ?? m.forecast), m.actual ? "Complete" : "Forecast", milestoneSlip(m)] as Cell[]));
      return { columns: ["Project", "Milestone", "Baseline", "Actual / forecast", "State", "Slip (days)"], numeric: [false, false, false, false, false, true], rows, note: "Positive slip = later than baseline." };
    }
    case "lease-expiry": {
      const rows = upcomingExpiries(730).map((e) => [e.propertyName, e.tenant, e.suite, e.sf, fmtDate(e.expiry), e.daysOut, e.annualRent] as Cell[]);
      return { columns: ["Property", "Tenant", "Suite", "Area (sf)", "Expires", "Days out", "Annual rent"], numeric: [false, false, false, true, false, true, true], rows, total: ["Total", "", "", rows.reduce((a, r) => a + (r[3] as number), 0), "", "", rows.reduce((a, r) => a + (r[6] as number), 0)], note: "Third-party leases expiring within 24 months." };
    }
    default: {
      const cf = cashFlow("all").filter((d) => d.forecast !== null).slice(0, 12);
      return { columns: ["Month", "Forecast spend", "Cumulative"], numeric: [false, true, true], rows: cf.map((d) => [fmtDate(d.month, "month"), d.forecast ?? 0, d.forecastCum ?? 0]), total: ["Total", cf.reduce((a, d) => a + (d.forecast ?? 0), 0), ""], note: "Reconciles to remaining Forecast Cost at Completion (G − I)." };
    }
  }
}

function fmtCell(v: Cell, numeric: boolean, col: string): string {
  if (!numeric || typeof v !== "number") return String(v);
  if (col === "K" || col.includes("%")) return pct(v);
  if (/days|sf|Slip/i.test(col)) return v.toLocaleString("en-US");
  return money(v);
}

export function ReportsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("r") ?? REPORTS[0]!.id;
  const def = REPORTS.find((r) => r.id === id) ?? REPORTS[0]!;
  const data = build(def.id);
  const file = `${def.id}-${TODAY}`;

  return (
    <>
      <PageHeader title="Reports" meta="Standard Owner reports, built live from the same figures as every other view" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title="Catalog" flush className="no-print self-start">
          <ul className="px-2 pb-2">
            {REPORTS.map((r) => {
              const on = r.id === def.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-current={on || undefined}
                    onClick={() => router.replace(`${pathname}?r=${r.id}`, { scroll: false })}
                    className={cx("w-full rounded-md px-3 py-3 text-left transition-colors", on ? "bg-accent-tint" : "hover:bg-surface-2")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cx("text-sm font-semibold", on ? "text-accent-ink" : "text-ink")}>{r.name}</span>
                      <Badge tone="neutral" dot={false}>
                        {r.cadence}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-2">{r.description}</p>
                    <p className="mt-1.5 text-2xs text-ink-3">
                      {r.audience} · last run {fmtDate(r.lastRun, "short")}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <section className="panel print-area min-w-0" aria-labelledby="report-title">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="flex items-start gap-3">
              <BrandMark className="mt-0.5 size-8 shrink-0" />
              <div>
                <h2 id="report-title" className="text-xl font-semibold tracking-[-0.01em] text-ink">
                  {def.name}
                </h2>
                <p className="mt-0.5 text-xs text-ink-3">
                  {ORG.name} · {ORG.program} · generated {fmtDate(TODAY)} · synthetic demo data
                </p>
              </div>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <Button icon={<Printer className="size-3.5" aria-hidden />} onClick={() => window.print()}>
                PDF
              </Button>
              <Button icon={<FileText className="size-3.5" aria-hidden />} onClick={() => downloadCsv(`${file}.csv`, data.columns, data.total ? [...data.rows, data.total] : data.rows)}>
                CSV
              </Button>
              <Button variant="primary" icon={<FileSpreadsheet className="size-3.5" aria-hidden />} onClick={() => downloadExcel(`${file}.xls`, def.name, data.columns, data.total ? [...data.rows, data.total] : data.rows)}>
                Excel
              </Button>
            </div>
          </header>
          <div className="scroll-x max-h-[calc(100dvh-16rem)] overflow-y-auto">
            <table className="dt compact min-w-[48rem]">
              <thead>
                <tr>
                  {data.columns.map((c, i) => (
                    <th key={c} className={cx(data.numeric[i] && "r", i === 1 && "min-w-[13rem]")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((v, i) => (
                      <td key={i} className={cx(data.numeric[i] && "r whitespace-nowrap", i === 0 && "num whitespace-nowrap", i === 1 && "font-semibold text-ink", typeof v === "number" && v < 0 && data.numeric[i] && "text-neg-ink")}>
                        {fmtCell(v, data.numeric[i]!, data.columns[i]!)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.total && (
                <tfoot>
                  <tr>
                    {data.total.map((v, i) => (
                      <td key={i} className={cx(data.numeric[i] && "r num")}>
                        {v === "" ? "" : fmtCell(v, data.numeric[i]!, data.columns[i]!)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="border-t border-line px-6 py-3 text-xs text-ink-3">{data.note}</p>
        </section>
      </div>
    </>
  );
}
