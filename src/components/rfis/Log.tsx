"use client";

import { useMemo, useState } from "react";
import { CircleCheck, Download, MessageSquare, Paperclip, Search, X } from "lucide-react";
import { Button, Segmented, Switch } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { cx } from "@/lib/format";
import { closeRfi, hasImpact, stageCounts, STAGES, whoName, type Row, type Stage } from "@/lib/rfis";
import { DISCIPLINES, PRIORITIES, PRIORITY_ORDER, type RfiDiscipline, type RfiPriority } from "@/mock/rfis";
import { impactFrom } from "./Composer";
import { exportRows } from "./export";
import { BallCell, DueCell, ImpactChips, plural, PriorityBadge, projectCode, StageBadge } from "./parts";
import { useRfis } from "./state";

type Filter = "all" | "open" | Stage;
type Sort = "number" | "due" | "age" | "exposure";

const PAGE = 120;

const matches = (x: Row, f: Filter) => (f === "all" ? x.stage !== "void" : f === "open" ? x.stage === "awaiting" || x.stage === "info" : x.stage === f);

/** Next date the row owes, for sorting: due for open, answer date for answered, and so on. */
const dueKey = (x: Row) =>
  x.stage === "awaiting" ? x.r.due! : x.stage === "info" ? "0" + (x.r.due ?? "") : x.stage === "answered" ? x.answeredOn! : x.stage === "draft" ? x.r.created : "9999" + (x.r.closed ?? "");

export function Log() {
  const { rows, project, openRfi, save } = useRfis();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState<"all" | RfiDiscipline>("all");
  const [holder, setHolder] = useState("all");
  const [priority, setPriority] = useState<"all" | RfiPriority>("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [impactOnly, setImpactOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("number");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [closing, setClosing] = useState(false);

  const counts = stageCounts(rows);
  const holders = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of rows) if (x.ball) m.set(x.ball.who.id, x.ball.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((x) => matches(x, filter))
    .filter((x) => discipline === "all" || x.r.discipline === discipline)
    .filter((x) => holder === "all" || x.ball?.who.id === holder)
    .filter((x) => priority === "all" || x.r.priority === priority)
    .filter((x) => !lateOnly || x.late > 0 || (x.waitingClose ?? 0) > 7)
    .filter((x) => !impactOnly || hasImpact(x))
    .filter(
      (x) =>
        !needle ||
        `${x.number} ${x.r.subject} ${x.r.question} ${x.r.section ?? ""} ${x.r.drawing ?? ""} ${x.r.location ?? ""} ${x.r.changeRef ?? ""} ${whoName({ kind: "firm", id: x.r.fromId })} ${whoName(x.r.assignee)}`
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => {
      if (sort === "due") return dueKey(a).localeCompare(dueKey(b));
      if (sort === "age") return (b.stage === "closed" ? -1 : (b.daysOpen ?? 0)) - (a.stage === "closed" ? -1 : (a.daysOpen ?? 0));
      if (sort === "exposure") return b.exposure - a.exposure || b.r.seq - a.r.seq;
      return projectCode(a.r.projectId).localeCompare(projectCode(b.r.projectId)) || b.r.seq - a.r.seq;
    });

  const sel = rows.filter((x) => selected.has(x.r.id));
  const closable = sel.filter((x) => x.stage === "answered");
  const visible = shown.slice(0, limit);
  const allOn = visible.length > 0 && visible.every((x) => selected.has(x.r.id));
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
    setDiscipline("all");
    setHolder("all");
    setPriority("all");
    setLateOnly(false);
    setImpactOnly(false);
  };

  return (
    <Panel
      title="RFI log"
      info="Every RFI on the log, newest first within each project. Open means waiting on a reviewer or on the contractor; answered RFIs wait on the Owner to close them. Void RFIs show only under their own filter."
      flush
      actions={
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Sort by
          <select className="field w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="number">Number</option>
            <option value="due">Next date</option>
            <option value="age">Days open</option>
            <option value="exposure">Cost exposure</option>
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
              { value: "all", label: "All", count: rows.length - counts.void },
              { value: "open", label: "Open", count: counts.awaiting + counts.info },
              { value: "answered", label: "Answered", count: counts.answered },
              { value: "closed", label: "Closed", count: counts.closed },
              { value: "draft", label: "Drafts", count: counts.draft },
              { value: "void", label: "Void", count: counts.void },
            ]}
          />
        </div>
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search the log</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field w-full pl-8" placeholder="Number, subject, sheet, location, or firm" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Discipline
          <select className="field w-40" value={discipline} onChange={(e) => setDiscipline(e.target.value as "all" | RfiDiscipline)}>
            <option value="all">All disciplines</option>
            {DISCIPLINES.map((d) => (
              <option key={d}>{d}</option>
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
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Priority
          <select className="field w-32" value={priority} onChange={(e) => setPriority(e.target.value as "all" | RfiPriority)}>
            <option value="all">Any</option>
            {PRIORITY_ORDER.map((k) => (
              <option key={k} value={k}>
                {PRIORITIES[k].label}
              </option>
            ))}
          </select>
        </label>
        <Switch checked={lateOnly} onChange={setLateOnly} label="Late" />
        <Switch checked={impactOnly} onChange={setImpactOnly} label="Cost or schedule impact" />
      </div>

      {sel.length > 0 && (
        <div role="region" aria-label="Selection" className="flex flex-wrap items-center gap-3 border-t border-line-soft bg-accent-wash px-5 py-2.5">
          <span className="text-sm font-semibold text-accent-ink">{plural(sel.length, "RFI")} selected</span>
          <span className="text-xs text-ink-2">{closable.length ? `${closable.length} answered and ready to close` : "None are answered, so none can be closed"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={() => exportRows(sel, "selected")}>
              Export selected
            </Button>
            <Button size="sm" variant="primary" disabled={!closable.length} icon={<CircleCheck className="size-3.5" aria-hidden />} onClick={() => setClosing(true)}>
              Close {closable.length || ""} answered
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
                  aria-label="Select every RFI on this page"
                  checked={allOn}
                  disabled={!visible.length}
                  onChange={(e) =>
                    setSelected((s) => {
                      const n = new Set(s);
                      for (const x of visible) {
                        if (e.target.checked) n.add(x.r.id);
                        else n.delete(x.r.id);
                      }
                      return n;
                    })
                  }
                />
              </th>
              <th className="min-w-[22rem]">RFI</th>
              {project === "all" && <th>Project</th>}
              <th>Status</th>
              <th>Ball in court</th>
              <th>Dates</th>
              <th>Priority</th>
              <th>Impact</th>
              <th className="r">Activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((x) => (
              <tr key={x.r.id} className="row-link cursor-pointer" data-selected={selected.has(x.r.id) || undefined} onClick={() => openRfi(x.r.id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" aria-label={`Select ${x.number} ${x.r.subject}`} checked={selected.has(x.r.id)} onChange={(e) => toggle(x.r.id, e.target.checked)} />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-left"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRfi(x.r.id);
                    }}
                  >
                    <span className="block font-semibold text-ink">{x.r.subject}</span>
                    <span className="num block text-xs text-ink-3">
                      <span className="font-semibold text-accent-ink">{x.number}</span> · {x.r.discipline}
                      {x.r.drawing && ` · ${x.r.drawing}`}
                      {x.r.section && ` · ${x.r.section}`}
                    </span>
                  </button>
                </td>
                {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectCode(x.r.projectId)}</td>}
                <td>
                  <StageBadge x={x} />
                </td>
                <td>
                  <BallCell x={x} />
                </td>
                <td>
                  <DueCell x={x} />
                </td>
                <td>
                  <PriorityBadge p={x.r.priority} quiet />
                </td>
                <td>
                  <ImpactChips x={x} />
                </td>
                {/* relative: keeps the sr-only labels inside the scroll box instead of stretching the page */}
                <td className="r relative whitespace-nowrap text-xs text-ink-3">
                  <span className={cx("inline-flex items-center gap-1", !x.files && "opacity-40")} title={plural(x.files, "file")}>
                    <Paperclip className="size-3" aria-hidden />
                    <span className="num">{x.files}</span>
                    <span className="sr-only">files</span>
                  </span>
                  <span className={cx("ml-2.5 inline-flex items-center gap-1", !x.comments && "opacity-40")} title={plural(x.comments, "comment")}>
                    <MessageSquare className="size-3" aria-hidden />
                    <span className="num">{x.comments}</span>
                    <span className="sr-only">comments</span>
                  </span>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-ink-2">
                  No RFIs match these filters.{" "}
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
            Showing {Math.min(limit, shown.length)} of {plural(shown.length, "RFI")}
            {filter !== "all" && filter !== "open" && ` · ${STAGES[filter].label.toLowerCase()}`}
          </span>
          {shown.length > limit && (
            <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE * 2)}>
              Show more
            </Button>
          )}
        </div>
      )}

      <BulkClose
        open={closing}
        rows={closable}
        onClose={() => setClosing(false)}
        onConfirm={(note) => {
          save(...closable.map((x) => closeRfi(x.r, { by: { kind: "staff", id: x.r.managerId }, text: note, impact: impactFrom(x.r) })));
          toast(`${plural(closable.length, "RFI")} closed`);
          setSelected((s) => new Set([...s].filter((id) => !closable.some((x) => x.r.id === id))));
          setClosing(false);
        }}
      />
    </Panel>
  );
}

function BulkClose({ open, rows, onClose, onConfirm }: { open: boolean; rows: Row[]; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  const withImpact = rows.filter(hasImpact);
  return (
    <Modal open={open} onClose={onClose} title={`Close ${plural(rows.length, "answered RFI")}`} description="Each closes against its current answer, by its Owner's PM, keeping the impact already recorded.">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
          {rows.map((x) => (
            <li key={x.r.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="num font-semibold text-accent-ink">{x.number}</span> <span className="text-ink">{x.r.subject}</span>
              </span>
              <ImpactChips x={x} className="shrink-0" />
            </li>
          ))}
        </ul>
        {withImpact.length > 0 && <p className="text-xs font-medium text-warn-ink">{plural(withImpact.length, "RFI")} carry a cost or schedule impact. Check each is on a PCO before closing, or close them one at a time.</p>}
        <label className="block">
          <span className="text-sm font-semibold text-ink">Closing note</span>
          <input className="field mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional; added to every thread" />
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon={<CircleCheck className="size-3.5" aria-hidden />} onClick={() => onConfirm(note)}>
          Close {plural(rows.length, "RFI")}
        </Button>
      </div>
    </Modal>
  );
}
