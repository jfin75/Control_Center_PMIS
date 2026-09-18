"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Search, X } from "lucide-react";
import { Chip } from "@/components/ui/data";
import { Button, Segmented, Switch } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { addDays, cx } from "@/lib/format";
import { BUCKETS, bucketCounts, firmName, type Bucket, type Row } from "@/lib/submittals";
import { csiName } from "@/mock/costCodes";
import { projectById } from "@/mock/projects";
import { RESUBMIT_DAYS } from "@/mock/submittals";
import { FloatChip, NextDate, plural, StatusBadge, shortDate } from "./parts";
import { useSubmittals } from "./state";

type Filter = "all" | Bucket;
type Sort = "section" | "next" | "float";

const PAGE = 120;

/** Submit, resubmit, or leave alone: only these can go into a new package. */
export const packageable = (r: Row) => (r.bucket === "toSubmit" || r.bucket === "rejected") && !r.draft;

const nextDate = (r: Row) =>
  r.bucket === "toSubmit" ? r.submitBy : r.bucket === "open" ? r.last!.due : r.bucket === "rejected" ? addDays(r.last!.returned!, RESUBMIT_DAYS) : "9999";

export function Register() {
  const { rows, project, openItem, openPackage, openBuilder, pkgById } = useSubmittals();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [division, setDivision] = useState("all");
  const [holder, setHolder] = useState("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("section");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const counts = bucketCounts(rows);
  const divisions = useMemo(() => [...new Set(rows.map((r) => r.s.section.slice(0, 2)))].sort(), [rows]);
  const holders = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.ball) m.set(r.ball.id, r.ball.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => filter === "all" || r.bucket === filter)
    .filter((r) => division === "all" || r.s.section.startsWith(division))
    .filter((r) => holder === "all" || r.ball?.id === holder)
    .filter((r) => !lateOnly || r.late > 0 || (r.bucket !== "closed" && r.s.leadWeeks > 0 && r.float < 0))
    .filter((r) => !needle || `${r.number} ${r.s.title} ${r.s.sectionTitle} ${firmName(r.s.byId)} ${r.s.type}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "next") return nextDate(a).localeCompare(nextDate(b));
      if (sort === "float") return (a.bucket === "closed" ? 1e6 : a.float) - (b.bucket === "closed" ? 1e6 : b.float);
      return projectById(a.s.projectId)!.code.localeCompare(projectById(b.s.projectId)!.code) || a.s.section.localeCompare(b.s.section) || a.s.seq - b.s.seq;
    });

  const sel = rows.filter((r) => selected.has(r.s.id));
  const selProjects = new Set(sel.map((r) => r.s.projectId));
  const visibleEligible = shown.slice(0, limit).filter(packageable);
  const allOn = visibleEligible.length > 0 && visibleEligible.every((r) => selected.has(r.s.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const reset = () => {
    setFilter("all");
    setQ("");
    setDivision("all");
    setHolder("all");
    setLateOnly(false);
  };

  return (
    <Panel
      title="Submittal register"
      info="One line per required submittal, from the specifications. The revision shown is the one in review, or the one the contractor owes next."
      flush
      actions={
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Sort by
          <select className="field w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="section">Spec section</option>
            <option value="next">Next deadline</option>
            <option value="float">Float to need date</option>
          </select>
        </label>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<Filter>
            label="Status"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setLimit(PAGE);
            }}
            options={[
              { value: "all", label: "All", count: rows.length },
              { value: "toSubmit", label: "To submit", count: counts.toSubmit },
              { value: "open", label: "Open", count: counts.open },
              { value: "rejected", label: "Rejected", count: counts.rejected },
              { value: "closed", label: "Closed", count: counts.closed },
            ]}
          />
        </div>
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search the register</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field w-full pl-8" placeholder="Number, title, section, or firm" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Division
          <select className="field w-44" value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="all">All divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d} {d === "11" ? "Equipment" : d === "14" ? "Conveying Equipment" : csiName(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Ball in court
          <select className="field w-48" value={holder} onChange={(e) => setHolder(e.target.value)}>
            <option value="all">Anyone</option>
            {holders.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Switch checked={lateOnly} onChange={setLateOnly} label="Late or at risk" />
      </div>

      {sel.length > 0 && (
        <div role="region" aria-label="Selection" className="flex flex-wrap items-center gap-3 border-t border-line-soft bg-accent-wash px-5 py-2.5">
          <span className="text-sm font-semibold text-accent-ink">{plural(sel.length, "item")} selected</span>
          {selProjects.size > 1 ? (
            <span className="text-xs text-ink-2">A package covers one project. Narrow the selection to package it.</span>
          ) : (
            <span className="text-xs text-ink-2">
              {sel.filter((r) => r.bucket === "rejected").length ? `${sel.filter((r) => r.bucket === "rejected").length} as resubmittals · ` : ""}
              {projectById([...selProjects][0]!)!.name}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={selProjects.size !== 1}
              icon={<PackagePlus className="size-3.5" aria-hidden />}
              onClick={() => {
                openBuilder({ projectId: [...selProjects][0], itemIds: sel.map((r) => r.s.id) });
                setSelected(new Set());
              }}
            >
              Package selected
            </Button>
          </div>
        </div>
      )}

      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[76rem]">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  aria-label="Select every item that can be packaged on this page"
                  checked={allOn}
                  disabled={!visibleEligible.length}
                  onChange={(e) =>
                    setSelected((s) => {
                      const n = new Set(s);
                      for (const r of visibleEligible) {
                        if (e.target.checked) n.add(r.s.id);
                        else n.delete(r.s.id);
                      }
                      return n;
                    })
                  }
                />
              </th>
              <th className="min-w-[20rem]">Submittal</th>
              {project === "all" && <th>Project</th>}
              <th>Type</th>
              <th>Status</th>
              <th>Ball in court</th>
              <th>Next date</th>
              <th>Needed on site</th>
              <th>Package</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => {
              const can = packageable(r);
              const pkgId = r.draft?.id ?? r.last?.packageId;
              const pkg = pkgId ? pkgById.get(pkgId) : null;
              return (
                <tr key={r.s.id} className="row-link cursor-pointer" data-selected={selected.has(r.s.id) || undefined} onClick={() => openItem(r.s.id)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)] disabled:opacity-40"
                      aria-label={`Select ${r.number} ${r.s.title}`}
                      title={can ? undefined : r.draft ? `Already in draft ${r.draft.number}` : "Only items to submit or resubmit can be packaged"}
                      disabled={!can}
                      checked={selected.has(r.s.id)}
                      onChange={(e) => toggle(r.s.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openItem(r.s.id); }}>
                      <span className="block font-semibold text-ink">{r.s.title}</span>
                      <span className="num block text-xs text-ink-3">
                        <span className="font-semibold text-accent-ink">{r.number}</span>
                        {r.rev > 0 && <span className="font-semibold text-ink-2"> · Rev {r.rev}</span>} · {r.s.sectionTitle}
                      </span>
                    </button>
                  </td>
                  {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectById(r.s.projectId)!.code}</td>}
                  <td className="whitespace-nowrap text-ink-2">{r.s.type}</td>
                  <td>
                    <StatusBadge r={r} />
                  </td>
                  <td className="max-w-[12rem]">
                    {r.ball ? (
                      <>
                        <div className="truncate text-sm text-ink">{r.ball.name}</div>
                        <div className="truncate text-xs text-ink-3">{r.bucket === "open" && r.last ? `Step ${(r.step ?? 0) + 1} of ${r.last.steps.length} · ${r.ball.side === "owner" ? "Owner" : r.ball.role}` : r.ball.role}</div>
                      </>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td>
                    <NextDate r={r} />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="num text-ink-2">{shortDate(r.s.requiredOnSite)}</div>
                    <div className="mt-0.5 flex gap-1">
                      {r.longLead && <Chip tone="neutral">{r.s.leadWeeks} wk lead</Chip>}
                      {r.float < 0 && <FloatChip r={r} />}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {pkg ? (
                      <button type="button" className={cx("num text-sm font-semibold hover:underline", r.draft ? "text-ink-2" : "text-accent-ink")} onClick={() => openPackage(pkg.id)}>
                        {pkg.number}
                        {r.draft && <span className="block text-2xs font-semibold text-ink-3">Draft</span>}
                      </button>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-ink-2">
                  No items match these filters.{" "}
                  <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={reset}>
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
            Showing {Math.min(limit, shown.length)} of {plural(shown.length, "item")}
            {filter !== "all" && ` · ${BUCKETS[filter].label.toLowerCase()}`}
          </span>
          {shown.length > limit && (
            <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show more
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
