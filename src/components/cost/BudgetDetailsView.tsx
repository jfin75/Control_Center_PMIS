"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, FilePlus2, Search } from "lucide-react";
import { Badge, Chip } from "@/components/ui/data";
import { Button, Segmented, Switch } from "@/components/ui/controls";
import { Drawer, DrawerHeader, toast } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { CHAIN_COLUMNS, chain, sumChain, type Chain } from "@/lib/budget";
import { cx, money, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { CHANGE_CLASSIFIERS, CSI_DIVISIONS, LEVEL1, csiName, type ChangeClassifier } from "@/mock/costCodes";
import { linesFor, type BudgetLine } from "@/mock/finance";
import { projectById } from "@/mock/projects";
import { chainCell } from "./ChainTable";
import { CostFrame, useProjectParam } from "./CostFrame";

/** Column sets: the full A–K chain, or the slice one role reads. */
const COLUMN_SETS = {
  all: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"],
  budget: ["A", "B", "C", "F", "G", "H"],
  committed: ["C", "D", "E", "F", "G"],
  paid: ["C", "D", "I", "J", "K"],
} as const;
type ColumnSet = keyof typeof COLUMN_SETS;

interface Request {
  lineId: string;
  amount: number;
  reason: string;
  classifier: ChangeClassifier | "";
}

export function BudgetDetailsView() {
  const [project] = useProjectParam();
  const params = useSearchParams();
  const focusCode = params.get("code");
  const [q, setQ] = useState("");
  const [l1, setL1] = useState<string>("all");
  const [csi, setCsi] = useState<string>("all");
  const [hideZero, setHideZero] = useState(true);
  const [open, setOpen] = useState<Set<string>>(() => new Set(LEVEL1.map((l) => l.name)));
  const [detail, setDetail] = useState<BudgetLine | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [colSet, setColSet] = useState<ColumnSet>("all");
  const COLS = CHAIN_COLUMNS.filter((c) => (COLUMN_SETS[colSet] as readonly string[]).includes(c.key));

  const all = linesFor(project);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((l) => {
      if (l1 !== "all" && l.level1 !== l1) return false;
      if (csi !== "all" && l.csi !== csi) return false;
      if (hideZero && l.A === 0 && l.B === 0 && l.D === 0 && l.F === 0 && l.I === 0) return false;
      if (needle) {
        const hay = `${l.code} ${l.category} ${l.description ?? ""} ${l.po ?? ""} ${l.pr ?? ""} ${projectById(l.projectId)?.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, l1, csi, hideZero]);

  // Deep link from search: open and highlight the requested cost code.
  useEffect(() => {
    if (!focusCode) return;
    const lv = LEVEL1.find((l) => l.prefix === focusCode.split(".")[0]);
    setOpen((o) => new Set([...o, lv?.name ?? "", `code:${focusCode}`]));
    requestAnimationFrame(() => document.getElementById(`code-${focusCode}`)?.scrollIntoView({ block: "center" }));
  }, [focusCode]);

  const tree = LEVEL1.map((lv) => {
    const ls = filtered.filter((l) => l.level1 === lv.name);
    const codes = [...new Set(ls.map((l) => l.code))].sort();
    return {
      lv,
      chain: sumChain(ls),
      cats: codes.map((code) => {
        const leaves = ls.filter((l) => l.code === code);
        return { code, name: leaves[0]!.category, leaves, chain: sumChain(leaves) };
      }),
    };
  }).filter((n) => n.cats.length);
  const total = sumChain(filtered);

  const toggle = (k: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const leafLabel = (l: BudgetLine) => {
    const pr = projectById(l.projectId)!;
    if (project === "all") return l.description ? `${pr.code} · ${l.description}` : `${pr.code} · ${pr.name}`;
    return l.description ?? "Base line";
  };

  const exportCsv = () =>
    downloadCsv(
      `budget-details-${project}.csv`,
      ["Project", "Level 1", "Category", "Description", "Classifier", "CSI", "PR", "PO", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"],
      filtered.map((l) => {
        const c = chain(l);
        return [projectById(l.projectId)!.code, l.level1, `${l.code} ${l.category}`, l.description ?? "", l.classifier ?? "", l.csi ?? "", l.pr ?? "", l.po ?? "", c.A, c.B, c.C, c.D, c.E, c.F, c.G, c.H, c.I, c.J, Number.isFinite(c.K) ? c.K : ""];
      }),
    );

  return (
    <CostFrame onExport={exportCsv}>
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="field w-64 pl-8" placeholder="Search code, description, PO" aria-label="Search budget lines" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="l1">
            Level 1 classification
          </label>
          <select id="l1" className="field" value={l1} onChange={(e) => setL1(e.target.value)}>
            <option value="all">All classifications</option>
            {LEVEL1.map((l) => (
              <option key={l.name} value={l.name}>
                {l.prefix}. {l.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="csi">
            CSI MasterFormat division
          </label>
          <select id="csi" className="field" value={csi} onChange={(e) => setCsi(e.target.value)}>
            <option value="all">All CSI divisions</option>
            {CSI_DIVISIONS.map((d) => (
              <option key={d.id} value={d.id}>
                Div {d.id} – {d.name}
              </option>
            ))}
          </select>
          <div className="mx-1">
            <Switch checked={hideZero} onChange={setHideZero} label="Hide empty lines" />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Segmented
              size="sm"
              label="Columns"
              value={colSet}
              onChange={setColSet}
              options={[
                { value: "all", label: "A–K" },
                { value: "budget", label: "Budget" },
                { value: "committed", label: "Committed" },
                { value: "paid", label: "Paid" },
              ]}
            />
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set([...LEVEL1.map((l) => l.name), ...tree.flatMap((n) => n.cats.map((c) => `code:${c.code}`))]))}>
              Expand all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>
              Collapse all
            </Button>
          </div>
        </div>
        {csi !== "all" && (
          <p className="border-b border-line-soft bg-accent-wash px-4 py-2 text-xs text-accent-ink">
            CSI filter applies to Construction lines only. Showing Division {csi} – {csiName(csi)}.
          </p>
        )}

        <div className="scroll-x max-h-[calc(100dvh-17rem)] overflow-y-auto">
          <table className={cx("dt", colSet === "all" ? "min-w-[82rem]" : "min-w-[52rem]")} aria-label="Budget line items">
            <thead>
              <tr>
                <th className="sticky left-0 z-[3] min-w-[22rem] bg-surface">Code · Description</th>
                {COLS.map((c) => (
                  <th key={c.key} className="r" title={`${c.label}${c.formula ? ` = ${c.formula}` : ""}`}>
                    <span className="font-bold text-accent-ink">{c.letter}</span> <span className="font-semibold">{c.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tree.map((n) => {
                const lvOpen = open.has(n.lv.name);
                return (
                  <Fragment key={n.lv.name}>
                    <tr className="bg-surface-2">
                      <td className="sticky left-0 z-[1] bg-surface-2">
                        <button type="button" aria-expanded={lvOpen} onClick={() => toggle(n.lv.name)} className="flex items-center gap-2 text-left text-sm font-bold text-ink">
                          <ChevronRight className={cx("size-4 text-ink-3 transition-transform duration-[var(--dur-fast)]", lvOpen && "rotate-90")} aria-hidden />
                          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: n.lv.color }} />
                          {n.lv.prefix}. {n.lv.name}
                        </button>
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className="r font-bold text-ink">
                          {chainCell(n.chain, c.key, true)}
                        </td>
                      ))}
                    </tr>
                    {lvOpen &&
                      n.cats.map((cat) => {
                        const k = `code:${cat.code}`;
                        const catOpen = open.has(k);
                        const single = cat.leaves.length === 1 && !cat.leaves[0]!.description && project !== "all";
                        const focused = focusCode === cat.code;
                        return (
                          <Fragment key={cat.code}>
                            <tr id={`code-${cat.code}`} className={cx(single && "row-link cursor-pointer", focused && "[&>td]:!bg-accent-wash")} onClick={single ? () => setDetail(cat.leaves[0]!) : undefined}>
                              <td className="sticky left-0 z-[1] bg-surface pl-9">
                                {single ? (
                                  <button type="button" className="flex items-baseline gap-2 text-left" onClick={(e) => { e.stopPropagation(); setDetail(cat.leaves[0]!); }}>
                                    <span className="num w-9 text-xs font-bold text-ink-2">{cat.code}</span>
                                    <span className="text-sm font-semibold text-ink hover:text-accent-ink">{cat.name}</span>
                                  </button>
                                ) : (
                                  <button type="button" aria-expanded={catOpen} onClick={() => toggle(k)} className="flex items-baseline gap-2 text-left">
                                    <span className="num w-9 text-xs font-bold text-ink-2">{cat.code}</span>
                                    <span className="text-sm font-semibold text-ink">{cat.name}</span>
                                    <span className="flex items-center gap-0.5 text-xs text-ink-3">
                                      {cat.leaves.length}
                                      <ChevronRight className={cx("size-3 transition-transform", catOpen && "rotate-90")} aria-hidden />
                                    </span>
                                  </button>
                                )}
                              </td>
                              {COLS.map((c) => (
                                <td key={c.key} className="r">
                                  {chainCell(cat.chain, c.key)}
                                </td>
                              ))}
                            </tr>
                            {!single &&
                              catOpen &&
                              cat.leaves.map((l) => {
                                const c = chain(l);
                                const req = requests.filter((r) => r.lineId === l.id).length;
                                return (
                                  <tr key={l.id} className="row-link cursor-pointer" onClick={() => setDetail(l)}>
                                    <td className="sticky left-0 z-[1] bg-surface pl-[4.75rem]">
                                      <button type="button" className="flex flex-wrap items-center gap-1.5 text-left" onClick={(e) => { e.stopPropagation(); setDetail(l); }}>
                                        <span className="text-sm text-ink-2 hover:text-accent-ink">{leafLabel(l)}</span>
                                        {l.classifier && <Chip tone="warn">{l.classifier}</Chip>}
                                        {l.csi && <Chip tone="neutral">Div {l.csi}</Chip>}
                                        {req > 0 && <Chip tone="accent">{req} pending</Chip>}
                                      </button>
                                      {(l.po || l.pr) && <div className="num text-2xs text-ink-3">{l.po ?? l.pr}</div>}
                                    </td>
                                    {COLS.map((col) => (
                                      <td key={col.key} className="r text-ink-2">
                                        {chainCell(c, col.key)}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
              {!tree.length && (
                <tr>
                  <td colSpan={COLS.length + 1} className="py-10 text-center text-sm text-ink-2">
                    No budget lines match these filters. Clear the search or choose another division.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-surface">
              <tr>
                <td className="sticky left-0 z-[1] bg-surface">Total · {filtered.length} lines</td>
                {COLS.map((c) => (
                  <td key={c.key} className="r num bg-surface">
                    {chainCell(total, c.key, true)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Drawer open={!!detail} onClose={() => setDetail(null)} label="Budget line detail">
        {detail && (
          <LineDetail
            key={detail.id}
            line={detail}
            onClose={() => setDetail(null)}
            requests={requests.filter((r) => r.lineId === detail.id)}
            onRequest={(r) => {
              setRequests((xs) => [...xs, r]);
              toast("Funding adjustment sent for PM Leadership review");
            }}
          />
        )}
      </Drawer>
    </CostFrame>
  );
}

function LineDetail({ line, onClose, requests, onRequest }: { line: BudgetLine; onClose: () => void; requests: Request[]; onRequest: (r: Request) => void }) {
  const c: Chain = chain(line);
  const pr = projectById(line.projectId)!;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [classifier, setClassifier] = useState<ChangeClassifier | "">("");
  const [touched, setTouched] = useState(false);
  const amt = Number(amount.replace(/[$,\s]/g, ""));
  const amountErr = touched && (!amount || !Number.isFinite(amt) || amt === 0) ? "Enter a non-zero amount. Use a minus sign to deduct funding." : "";
  const reasonErr = touched && reason.trim().length < 8 ? "Describe why the budget should change (at least 8 characters)." : "";

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <h2 className="text-lg font-semibold text-ink">
          <span className="num text-accent-ink">{line.code}</span> {line.category}
        </h2>
        {line.description && <p className="mt-0.5 text-sm text-ink-2">{line.description}</p>}
        <p className="mt-0.5 text-xs text-ink-3">
          <span className="num font-semibold">{pr.code}</span> · {pr.name} · {line.level1}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {line.classifier && <Badge tone="warn">{CHANGE_CLASSIFIERS.find((x) => x.id === line.classifier)?.label}</Badge>}
          {line.csi && <Badge tone="neutral">Div {line.csi} – {csiName(line.csi)}</Badge>}
          {line.po && <Badge tone="accent" dot={false}>{line.po}</Badge>}
          {line.pr && <Badge tone="neutral" dot={false}>{line.pr}</Badge>}
        </div>
      </DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <table className="dt compact">
          <tbody>
            {CHAIN_COLUMNS.map((col) => (
              <tr key={col.key}>
                <td className="w-8 font-bold text-accent-ink">{col.letter}</td>
                <td>
                  <div className="text-sm text-ink">{col.label}</div>
                  <div className="text-2xs text-ink-3">{col.formula ? `= ${col.formula}` : col.source}</div>
                </td>
                <td className="r font-semibold text-ink">{col.key === "K" ? pct(c.K) : chainCell(c, col.key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {line.D > 0 && (
          <Link href={`/cost/actuals/?project=${line.projectId}&code=${line.code}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
            Invoices and payments for {line.code} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )}

        <form
          className="mt-6 border-t border-line pt-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!amount || !Number.isFinite(amt) || amt === 0 || reason.trim().length < 8) return;
            onRequest({ lineId: line.id, amount: amt, reason: reason.trim(), classifier });
            setAmount("");
            setReason("");
            setClassifier("");
            setTouched(false);
          }}
        >
          <h3 className="text-sm font-semibold text-ink">Request funding adjustment (B)</h3>
          <p className="mt-0.5 text-xs text-ink-3">Adds or deducts budget. Routed to PM Leadership; history is kept for Finance.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink-2">
              Amount (USD)
              <input
                className="field mt-1 w-full num"
                inputMode="decimal"
                placeholder="e.g. 25,000 or -10,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!amountErr}
                aria-describedby={amountErr ? "amt-err" : undefined}
              />
            </label>
            <label className="block text-xs font-semibold text-ink-2">
              Change classifier
              <select className="field mt-1 w-full" value={classifier} onChange={(e) => setClassifier(e.target.value as ChangeClassifier | "")}>
                <option value="">Not a change order</option>
                {CHANGE_CLASSIFIERS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.id} – {x.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {amountErr && (
            <p id="amt-err" className="mt-1.5 text-xs font-medium text-neg-ink">
              {amountErr}
            </p>
          )}
          <label className="mt-3 block text-xs font-semibold text-ink-2">
            Justification
            <textarea className="field mt-1 w-full" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonErr} aria-describedby={reasonErr ? "rsn-err" : undefined} />
          </label>
          {reasonErr && (
            <p id="rsn-err" className="mt-1.5 text-xs font-medium text-neg-ink">
              {reasonErr}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <Button type="submit" variant="primary" icon={<FilePlus2 className="size-3.5" aria-hidden />}>
              Submit for review
            </Button>
          </div>
        </form>

        {requests.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">Requests this session</h3>
            <ul className="space-y-2">
              {requests.map((r, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
                  <div className="min-w-0 text-sm text-ink-2">
                    {r.reason}
                    <div className="mt-0.5">
                      <Badge tone="warn">Pending PM Leadership review</Badge>
                    </div>
                  </div>
                  <span className={cx("num text-sm font-bold", r.amount < 0 ? "text-neg-ink" : "text-ink")}>{money(r.amount, { signed: true })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
