"use client";

import { useMemo, useState } from "react";
import { CornerDownRight, Download, Search } from "lucide-react";
import { Bar, Em, Narrative } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { downloadCsv } from "@/lib/exporters";
import { cx, money } from "@/lib/format";
import { IN_PROGRESS, isLive, isMaster, isPending, kpis, STATUS, type Row } from "@/lib/contracts";
import { CATEGORIES, CATEGORY_ORDER, STRUCTURE_ORDER, STRUCTURES, type Category, type Structure } from "@/mock/contracts";
import { CategoryLabel, kindLabel, PendingCell, plural, projectCode, shortDate, StatusBadge, ValueCell } from "./parts";
import { useContracts } from "./state";

type Filter = "all" | "progress" | "executed" | "closed";
type Sort = "number" | "value" | "pending" | "end";

const matches = (r: Row, f: Filter) => (f === "all" ? true : f === "progress" ? IN_PROGRESS.includes(r.c.status) : r.c.status === f);

export function Register() {
  return (
    <div className="space-y-5">
      <Overview />
      <Table />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Overview: the exposure sentence, value by category, and what needs a hand
 * ------------------------------------------------------------------------- */

function Overview() {
  const { rows, modRows, openContract, openMod } = useContracts();
  const k = kpis(rows);
  const pending = modRows.filter((x) => isPending(x.m) && x.t.structure !== "master").sort((a, b) => b.value - a.value);
  const biggest = pending[0];
  const byCat = CATEGORY_ORDER.map((cat) => {
    const list = rows.filter((r) => r.t.category === cat && !isMaster(r) && isLive(r));
    return { cat, value: list.reduce((a, r) => a + r.current, 0), count: list.length };
  });
  const max = Math.max(1, ...byCat.map((x) => x.value));

  // What needs someone: drafts ready (or not) for review, contracts waiting on Legal or signatures, priced changes waiting on the Owner, and masters near their ceiling.
  const attention = [
    ...rows
      .filter((r) => IN_PROGRESS.includes(r.c.status))
      .map((r) => ({
        key: r.c.id,
        onOpen: () => openContract(r.c.id),
        title: `${r.c.number} ${r.c.title}`,
        why: r.c.status === "draft" ? (r.missing.length ? `Draft · ${plural(r.missing.length, "blank or exhibit")} to finish` : "Draft · ready for Legal review") : STATUS[r.c.status].label,
        tone: r.c.status === "draft" && r.missing.length ? "warn" : "accent",
      })),
    ...pending
      .filter((x) => x.m.status === "priced" || (x.age ?? 0) > 21)
      .slice(0, 6)
      .map((x) => ({
        key: x.m.id,
        onOpen: () => openMod(x.m.id),
        title: `${x.number} ${x.m.title}`,
        why: `${x.m.status === "priced" ? `Priced at ${money(x.value, { compact: true })}` : `Open ${x.age} days`} · ${x.c.number}`,
        tone: x.m.status === "priced" ? "accent" : "warn",
      })),
    ...rows
      .filter((r) => isMaster(r) && isLive(r) && r.current > 0 && (r.released + r.inFlight) / r.current >= 0.75)
      .map((r) => ({ key: r.c.id, onOpen: () => openContract(r.c.id), title: `${r.c.number} ${r.c.title}`, why: `${Math.round(((r.released + r.inFlight) / r.current) * 100)}% of ceiling used`, tone: "warn" })),
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title="Commitments and change exposure" info="Executed contracts and orders only. Masters carry a ceiling, not a commitment: their value is the orders released under them.">
        <Narrative>
          <Em>{plural(k.executed, "executed contract")}</Em> commit <Em>{money(k.committed, { compact: true })}</Em>. Approved changes added <Em tone={k.approved > 0 ? "neg" : "pos"}>{money(k.approved, { compact: true })}</Em>
          {k.original ? ` (${((k.approved / k.original) * 100).toFixed(1)}% over original)` : ""}, and <Em tone="neg">{money(k.pending, { compact: true })}</Em> is pending in {plural(k.pendingCount, "open change")}
          {biggest ? (
            <>
              , led by{" "}
              <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => openMod(biggest.m.id)}>
                {biggest.number}
              </button>{" "}
              on {biggest.c.number} ({money(biggest.value, { compact: true })})
            </>
          ) : null}
          .
        </Narrative>
        <ul className="mt-5 space-y-2.5">
          {byCat.map((x) => (
            <li key={x.cat} className="grid grid-cols-[8.5rem_minmax(0,1fr)_4.5rem] items-center gap-3">
              <CategoryLabel category={x.cat} />
              <Bar value={x.value} max={max} color={CATEGORIES[x.cat].color} label={money(x.value, { compact: true })} inside={false} height="h-4" />
              <span className="num text-right text-xs text-ink-3">{plural(x.count, "contract")}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Needs attention" info="Contracts still being drafted, reviewed, or signed; priced or aging changes waiting on the Owner; and masters with less than a quarter of their ceiling left.">
        {attention.length ? (
          <ul className="-mx-2 max-h-[19rem] overflow-y-auto">
            {attention.map((a) => (
              <li key={a.key}>
                <button type="button" onClick={a.onOpen} className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-surface-2">
                  <span aria-hidden className={cx("mt-1.5 size-2 shrink-0 rounded-full", a.tone === "warn" ? "bg-warn" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{a.title}</span>
                    <span className="block text-xs text-ink-3">{a.why}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">Nothing is waiting. Every contract is executed and no priced change is sitting with the Owner.</p>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The register table
 * ------------------------------------------------------------------------- */

function Table() {
  const { rows, project, openContract } = useContracts();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [structure, setStructure] = useState<"all" | Structure>("all");
  const [sort, setSort] = useState<Sort>("number");

  const counts = useMemo(
    () => ({
      all: rows.length,
      progress: rows.filter((r) => matches(r, "progress")).length,
      executed: rows.filter((r) => r.c.status === "executed").length,
      closed: rows.filter((r) => r.c.status === "closed").length,
    }),
    [rows],
  );

  const needle = q.trim().toLowerCase();
  const base = rows
    .filter((r) => matches(r, filter))
    .filter((r) => category === "all" || r.t.category === category)
    .filter((r) => structure === "all" || r.t.structure === structure)
    .filter((r) => !needle || `${r.c.number} ${r.c.title} ${r.counterparty} ${r.project?.code ?? ""} ${r.project?.name ?? ""} ${r.t.name} ${r.parent?.number ?? ""}`.toLowerCase().includes(needle));

  // Numbers sort masters ahead of their orders; under a number sort, orders sit right beneath their master.
  const cmp = (a: Row, b: Row) => {
    if (sort === "value") return b.current - a.current;
    if (sort === "pending") return b.pending - a.pending || b.pendingCount - a.pendingCount;
    if (sort === "end") return (a.end ?? "9999").localeCompare(b.end ?? "9999");
    return a.c.number.localeCompare(b.c.number, undefined, { numeric: true });
  };
  const shown = [...base].sort(cmp);
  const nested = sort === "number" && structure === "all";

  const exportCsv = () =>
    downloadCsv(
      `contracts-${project === "all" ? "all" : projectCode(project)}.csv`,
      ["Number", "Title", "Template", "Category", "Structure", "Project", "Master", "Counterparty", "Status", "Executed", "Ends", "Original", "Approved changes", "Current", "Pending changes", "Open changes", "Budget line"],
      shown.map((r) => [
        r.c.number,
        r.c.title,
        r.t.name,
        CATEGORIES[r.t.category].label,
        STRUCTURES[r.t.structure].label,
        r.project?.code ?? "Program",
        r.parent?.number ?? "",
        r.counterparty,
        STATUS[r.c.status].label,
        r.c.executed ?? "",
        r.end ?? "",
        r.original,
        r.approved,
        r.current,
        r.pending,
        r.pendingCount,
        r.c.code,
      ]),
    );

  return (
    <Panel
      title="Contract register"
      info="Every contract, master agreement, and order. Current value is the original plus executed change orders, ASRs, and amendments; pending changes are not in it yet."
      flush
      actions={
        <>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Sort by
            <select className="field w-36" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="number">Number</option>
              <option value="value">Current value</option>
              <option value="pending">Pending changes</option>
              <option value="end">End date</option>
            </select>
          </label>
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={exportCsv}>
            CSV
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<Filter>
            label="Status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "progress", label: "In progress", count: counts.progress },
              { value: "executed", label: "Executed", count: counts.executed },
              { value: "closed", label: "Closed", count: counts.closed },
            ]}
          />
        </div>
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search the register</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field w-full pl-8" placeholder="Number, title, firm, or project" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Type
          <select className="field w-40" value={category} onChange={(e) => setCategory(e.target.value as "all" | Category)}>
            <option value="all">All types</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Structure
          <select className="field w-36" value={structure} onChange={(e) => setStructure(e.target.value as "all" | Structure)}>
            <option value="all">Any</option>
            {STRUCTURE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STRUCTURES[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[72rem]">
          <thead>
            <tr>
              <th className="min-w-[20rem]">Contract</th>
              <th>Counterparty</th>
              {project === "all" && <th>Project</th>}
              <th>Status</th>
              <th>Ends</th>
              <th className="r">Current value</th>
              <th className="r">Pending changes</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const child = nested && !!r.parent && shown.some((x) => x.c.id === r.parent!.id);
              return (
                <tr key={r.c.id} className="row-link cursor-pointer" onClick={() => openContract(r.c.id)}>
                  <td>
                    <div className={cx("flex items-start gap-1.5", child && "pl-4")}>
                      {child && <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-ink-4" aria-hidden />}
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          openContract(r.c.id);
                        }}
                      >
                        <span className="block font-semibold text-ink">{r.c.title}</span>
                        <span className="num block text-xs text-ink-3">
                          <span className="font-semibold text-accent-ink">{r.c.number}</span> · {kindLabel(r)}
                          {r.parent && !child && ` · under ${r.parent.number}`}
                          {r.t.structure === "master" && ` · ${plural(r.children.length, "order")}`}
                        </span>
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="max-w-[14rem] min-w-0">
                      <div className="truncate text-sm text-ink">{r.counterparty}</div>
                      <CategoryLabel category={r.t.category} />
                    </div>
                  </td>
                  {project === "all" && <td className="num whitespace-nowrap text-ink-2">{r.project?.code ?? <span className="text-ink-3">Program</span>}</td>}
                  <td>
                    <StatusBadge c={r.c} />
                    {r.c.status === "draft" && r.missing.length > 0 && <div className="mt-0.5 text-xs text-warn-ink">{plural(r.missing.length, "item")} to fill</div>}
                  </td>
                  <td className="num whitespace-nowrap text-ink-2">{r.end ? shortDate(r.end) : "—"}</td>
                  <td className="r">
                    <ValueCell r={r} />
                  </td>
                  <td className="r">
                    <PendingCell r={r} />
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-ink-2">
                  No contracts match these filters.{" "}
                  <button
                    type="button"
                    className="font-semibold text-accent-ink hover:underline"
                    onClick={() => {
                      setFilter("all");
                      setQ("");
                      setCategory("all");
                      setStructure("all");
                    }}
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-xs text-ink-3">
          <span className="num">
            {plural(shown.length, "contract")} · {money(shown.filter((r) => !isMaster(r) && isLive(r)).reduce((a, r) => a + r.current, 0))} committed · {money(shown.filter((r) => !isMaster(r)).reduce((a, r) => a + r.pending, 0))} pending
          </span>
        </div>
      )}
    </Panel>
  );
}
