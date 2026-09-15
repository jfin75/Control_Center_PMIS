"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge, KpiStrip, type Tone } from "@/components/ui/data";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { cx, fmtDate, money, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { INVOICES, PAY_APPS, g702, linesFor, type Invoice, type PayApp } from "@/mock/finance";
import { contractor } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { CostFrame, useProjectParam } from "./CostFrame";

const STATUS_TONE: Record<Invoice["status"], Tone> = {
  Received: "neutral",
  "In approval": "warn",
  Approved: "info",
  Paid: "pos",
  Disputed: "neg",
};

const APP_STEPS: PayApp["status"][] = ["Draft", "Submitted", "Under review", "Approved", "Paid"];

export function ActualsView() {
  const [project] = useProjectParam();
  const [status, setStatus] = useState<"all" | Invoice["status"]>("all");
  const code = useSearchParams().get("code");
  const invoices = INVOICES.filter((i) => (project === "all" || i.projectId === project) && (!code || i.code === code));
  const gcCode = !code || code === "3.02" || code === "3.03";
  const apps = gcCode ? PAY_APPS.filter((a) => project === "all" || a.projectId === project) : [];
  // Payments to Date (I) for the filtered scope, from the budget lines — the ledger must reconcile to it.
  const scopeI = linesFor(project).filter((l) => !code || l.code === code).reduce((a, l) => a + l.I, 0);
  const [appId, setAppId] = useState<string | null>(null);
  const app = apps.find((a) => a.id === appId) ?? apps[0] ?? null;

  const shown = useMemo(() => (status === "all" ? invoices : invoices.filter((i) => i.status === status)), [invoices, status]);
  const sum = (f: (i: Invoice) => number, xs = invoices) => xs.reduce((a, i) => a + f(i), 0);
  const retainage = apps.reduce((a, x) => a + g702(x).retainage, 0);
  const inApproval = invoices.filter((i) => i.status === "In approval" || i.status === "Received");
  const counts = (s: Invoice["status"]) => invoices.filter((i) => i.status === s).length;

  const exportCsv = () =>
    downloadCsv(
      "invoice-ledger.csv",
      ["Invoice", "Project", "Vendor", "Cost code", "Date", "Invoiced", "Approved", "Paid", "Status", "Pay app", "Workday ref"],
      shown.map((i) => [i.id, projectById(i.projectId)!.code, i.vendor, i.code, i.date, i.invoiced, i.approved, i.paid, i.status, i.payApp ?? "", i.workdayRef ?? ""]),
    );

  return (
    <CostFrame onExport={exportCsv}>
      <KpiStrip
        className="mb-5"
        items={[
          { label: code ? `Invoiced to date · ${code}` : "Invoiced to date", value: money(sum((i) => i.invoiced), { compact: true }), sub: `${invoices.length} invoices` },
          { label: "Approved, awaiting payment", value: money(sum((i) => (i.status === "Approved" ? i.approved : 0)), { compact: true }), sub: `${counts("Approved")} invoices` },
          { label: "Paid to date", value: money(sum((i) => i.paid), { compact: true }), sub: "Equals I, Payments to Date" },
          { label: "Retainage held", value: apps.length ? money(retainage, { compact: true }) : "—", sub: apps.length ? `${apps.length} open contracts at 5%` : "No retainage on this code" },
          { label: "Waiting on review", value: inApproval.length, sub: money(sum((i) => i.invoiced, inApproval), { compact: true }) },
        ]}
      />

      {!gcCode ? null : app ? (
        <PayAppPanel app={app} apps={apps} onPick={setAppId} />
      ) : (
        <Panel title="Pay application">
          <p className="text-sm text-ink-2">No construction contract has been let on this project yet. Pay applications appear once a base contract (3.02) is committed.</p>
        </Panel>
      )}

      <Panel
        className="mt-5"
        title="Invoice ledger"
        info="Supplier invoices and pay applications from Workday, invoiced → approved → paid."
        flush
        actions={
          <>
          {code && (
            <Link href={`/cost/actuals/${project === "all" ? "" : `?project=${project}`}`} className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-accent-tint px-2 text-xs font-semibold text-accent-ink hover:bg-[var(--c-cobalt-200)]">
              Cost code {code}
              <X className="size-3" aria-label="Clear cost code filter" />
            </Link>
          )}
          <Segmented
            size="sm"
            label="Filter invoices by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: invoices.length },
              { value: "In approval", label: "In approval", count: counts("In approval") + counts("Received") },
              { value: "Approved", label: "Approved", count: counts("Approved") },
              { value: "Paid", label: "Paid", count: counts("Paid") },
              { value: "Disputed", label: "Disputed", count: counts("Disputed") },
            ]}
          />
          </>
        }
      >
        <div className="scroll-x max-h-[34rem] overflow-y-auto">
          <table className="dt min-w-[64rem]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vendor</th>
                {project === "all" && <th>Project</th>}
                <th>Code</th>
                <th>Date</th>
                <th className="r">Invoiced</th>
                <th className="r">Approved</th>
                <th className="r">Paid</th>
                <th>Status</th>
                <th>Workday</th>
              </tr>
            </thead>
            <tbody>
              {(status === "In approval" ? invoices.filter((i) => i.status === "In approval" || i.status === "Received") : shown).map((i) => (
                <tr key={i.id}>
                  <td className="num font-semibold whitespace-nowrap text-ink">
                    {i.id}
                    {i.payApp && <div className="text-2xs font-normal text-ink-3">{i.payApp}</div>}
                  </td>
                  <td className="max-w-[16rem] truncate">{i.vendor}</td>
                  {project === "all" && <td className="num text-ink-2">{projectById(i.projectId)!.code}</td>}
                  <td className="num text-ink-2">{i.code}</td>
                  <td className="num whitespace-nowrap text-ink-2">{fmtDate(i.date, "short")}</td>
                  <td className="r">{money(i.invoiced)}</td>
                  <td className="r">{i.approved ? money(i.approved) : <span className="text-ink-4">–</span>}</td>
                  <td className="r">{i.paid ? money(i.paid) : <span className="text-ink-4">–</span>}</td>
                  <td>
                    <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                  </td>
                  <td className="num text-xs text-ink-3">{i.workdayRef ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={project === "all" ? 7 : 6} className="text-ink">
                  Paid to date{code ? ` on ${code}` : ""}
                  <span className={cx("ml-2 text-xs font-semibold", sum((i) => i.paid) === scopeI ? "text-pos-ink" : "text-neg-ink")}>
                    {sum((i) => i.paid) === scopeI ? "✓ reconciles to I, Payments to Date" : `differs from I (${money(scopeI)})`}
                  </span>
                </td>
                <td className="r num">{money(sum((i) => i.paid))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </CostFrame>
  );
}

function PayAppPanel({ app, apps, onPick }: { app: PayApp; apps: PayApp[]; onPick: (id: string) => void }) {
  const s = g702(app);
  const p = projectById(app.projectId)!;
  const firm = contractor(app.contractorId);
  const stepIdx = APP_STEPS.indexOf(app.status);
  const lines: Array<[string, string, number, boolean?]> = [
    ["1", "Original contract sum", s.originalContract],
    ["2", "Net change by change orders", s.netChanges],
    ["3", "Contract sum to date (1 + 2)", s.contractSum, true],
    ["4", "Total completed & stored to date", s.completed],
    ["5", `Retainage (${pct(app.retainagePct)} of completed work)`, s.retainage],
    ["6", "Total earned less retainage (4 − 5)", s.earnedLessRet],
    ["7", "Less previous certificates for payment", s.previousCerts],
    ["8", "Current payment due (6 − 7)", s.currentDue, true],
    ["9", "Balance to finish, including retainage (3 − 6)", s.balanceToFinish],
  ];

  return (
    <Panel
      title={`Pay application #${app.number}`}
      info="G702/G703-style application and certificate for payment, with the continuation sheet below."
      actions={
        apps.length > 1 ? (
          <>
            <label htmlFor="payapp" className="sr-only">
              Pay application
            </label>
            <select id="payapp" className="field" value={app.id} onChange={(e) => onPick(e.target.value)}>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {projectById(a.projectId)!.code} · {contractor(a.contractorId).name} · #{a.number}
                </option>
              ))}
            </select>
          </>
        ) : undefined
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{firm.name}</span> · {p.name} · period to {fmtDate(app.periodTo)}
        </p>
        <ol className="flex items-center gap-1" aria-label="Approval progress">
          {APP_STEPS.map((st, i) => {
            const done = i < stepIdx;
            const cur = i === stepIdx;
            return (
              <li key={st} className="flex items-center gap-1" aria-current={cur ? "step" : undefined}>
                <span
                  className={cx(
                    "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-2xs font-bold whitespace-nowrap",
                    done && "bg-pos-tint text-pos-ink",
                    cur && "bg-accent text-white",
                    !done && !cur && "bg-sunk text-ink-3",
                  )}
                >
                  {done && <Check className="size-3" aria-hidden />}
                  {st}
                </span>
                {i < APP_STEPS.length - 1 && <span aria-hidden className={cx("h-px w-3", i < stepIdx ? "bg-pos" : "bg-line-strong")} />}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <dl className="grid w-full max-w-xl divide-y divide-line-soft self-start border-y border-line xl:block xl:max-w-none">
          {lines.map(([n, label, v, strong]) => (
            <div key={n} className={cx("flex items-baseline gap-3 px-1 py-2", strong && "bg-surface-2")}>
              <dt className="flex min-w-0 flex-1 gap-2 text-sm text-ink-2">
                <span className="num w-3 shrink-0 text-2xs font-bold text-accent-ink">{n}</span>
                <span className={cx(strong && "font-semibold text-ink")}>{label}</span>
              </dt>
              <dd className={cx("num text-sm", strong ? "font-bold text-ink" : "font-semibold text-ink")}>{money(v)}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-ink">Continuation sheet</h3>
          <div className="scroll-x max-h-[25rem] overflow-y-auto">
            <table className="dt compact min-w-[52rem]">
              <thead>
                <tr>
                  <th>A · Item</th>
                  <th>B · Description of work</th>
                  <th className="r">C · Scheduled value</th>
                  <th className="r">G · Completed & stored</th>
                  <th className="r">G ÷ C</th>
                  <th className="r">H · Balance</th>
                  <th className="r">D · Previous</th>
                  <th className="r">E · This period</th>
                  <th className="r">F · Stored</th>
                </tr>
              </thead>
              <tbody>
                {app.lines.map((l) => {
                  const g = l.previous + l.thisPeriod + l.stored;
                  return (
                    <tr key={l.item}>
                      <td className="num text-ink-3">{l.item}</td>
                      <td className="max-w-[13rem] truncate text-ink" title={l.description}>{l.description}</td>
                      <td className="r">{money(l.scheduled)}</td>
                      <td className="r font-semibold text-ink">{money(g)}</td>
                      <td className="r">{pct(g / l.scheduled)}</td>
                      <td className="r text-ink-2">{money(l.scheduled - g)}</td>
                      <td className="r text-ink-2">{money(l.previous)}</td>
                      <td className="r text-ink-2">{money(l.thisPeriod)}</td>
                      <td className="r text-ink-2">{l.stored ? money(l.stored) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}
