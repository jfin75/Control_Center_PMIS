"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Diamond,
  Download,
  FilePlus2,
  FolderPlus,
  ListCollapse,
  ListTree,
  Plus,
  Redo2,
  Search,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { EmptyState, Legend } from "@/components/ui/data";
import { Button, IconButton, Segmented, Switch } from "@/components/ui/controls";
import { Popover, toast } from "@/components/ui/overlay";
import { downloadCsv, downloadExcel, downloadText } from "@/lib/exporters";
import { cx, fmtDate } from "@/lib/format";
import { dayNum, isoOf } from "@/lib/schedule/calendar";
import type { Calc } from "@/lib/schedule/cpm";
import { addActivity, addWbs, ganttRows, moveActivity, moveWbs, predText, removeActivities, removeWbs, setPredsFromText, updateActivity, updateWbs, type GanttRow } from "@/lib/schedule/edit";
import { CSV_HEADERS, toMspdi, toRows } from "@/lib/schedule/export";
import type { Schedule } from "@/lib/schedule/types";
import { TODAY } from "@/mock/org";
import { projectById, PROJECTS } from "@/mock/projects";
import { CommitInput, FloatText, INK, plural, SOURCE_LABEL, StatusGlyph, Variance } from "./parts";
import { useOpenSchedule, useSchedule } from "./state";

const ROW = 30;
const HEAD = 44;

type Zoom = "day" | "week" | "month" | "quarter";
const PPD: Record<Zoom, number> = { day: 26, week: 6, month: 1.9, quarter: 0.72 };

type Filter = "all" | "longest" | "near" | "negative" | "open" | "milestones" | "look3" | "look6";
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All activities" },
  { value: "longest", label: "Longest path" },
  { value: "near", label: "Near critical (≤ 10 wd float)" },
  { value: "negative", label: "Negative float" },
  { value: "open", label: "Not complete" },
  { value: "milestones", label: "Milestones" },
  { value: "look3", label: "3-week look-ahead" },
  { value: "look6", label: "6-week look-ahead" },
];

type ColSet = "names" | "dates" | "logic";

interface Col {
  id: "st" | "code" | "name" | "dur" | "start" | "finish" | "tf" | "preds" | "blf" | "var";
  label: string;
  w: number;
  right?: boolean;
  /** The narrowest column set that shows it. */
  set: ColSet;
  title?: string;
}
const COLS: Col[] = [
  { id: "st", label: "", w: 26, set: "names" },
  { id: "code", label: "ID", w: 88, set: "names" },
  { id: "name", label: "Activity", w: 250, set: "names" },
  { id: "dur", label: "Dur", w: 50, right: true, set: "names", title: "Original duration, working days" },
  { id: "start", label: "Start", w: 92, set: "dates" },
  { id: "finish", label: "Finish", w: 92, set: "dates" },
  { id: "tf", label: "TF", w: 48, right: true, set: "dates", title: "Total float, working days" },
  { id: "preds", label: "Predecessors", w: 150, set: "logic" },
  { id: "blf", label: "BL finish", w: 92, set: "logic", title: "Baseline finish" },
  { id: "var", label: "Var", w: 58, right: true, set: "logic", title: "Finish variance against baseline, calendar days" },
];
const SET_ORDER: ColSet[] = ["names", "dates", "logic"];

export function Gantt() {
  const { project, s, startNew, startImport, all } = useSchedule();
  if (project === "all") return <Picker />;
  if (!s) {
    const p = projectById(project)!;
    const others = all.filter((x) => x.projectId === project).length;
    return (
      <div className="panel">
        <EmptyState icon={<ListTree className="size-5" aria-hidden />} title={`${p.code} has no detailed schedule yet`} action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<Upload className="size-3.5" aria-hidden />} onClick={startImport}>
              Import from P6 or MS Project
            </Button>
            <Button variant="primary" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => startNew(project)}>
              Build a schedule
            </Button>
          </div>
        }>
          {others ? "" : `Its ${p.milestones.length} milestones come from the project record. Start from a template, turn those milestones into a logic-linked skeleton, or import the contractor's latest update.`}
        </EmptyState>
      </div>
    );
  }
  return <Editor />;
}

/* ---------------------------------------------------------------------------
 * No project chosen: pick one
 * ------------------------------------------------------------------------- */

function Picker() {
  const { all, setProject } = useSchedule();
  return (
    <div className="panel p-5">
      <h2 className="text-md font-semibold text-ink">Choose a project to open its schedule</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {PROJECTS.map((p) => {
          const n = all.filter((x) => x.projectId === p.id).length;
          return (
            <li key={p.id}>
              <button type="button" onClick={() => setProject(p.id)} className="flex w-full items-start gap-3 rounded-md border border-line px-3 py-2.5 text-left hover:border-line-strong hover:bg-surface-2">
                <ListTree className={cx("mt-0.5 size-4 shrink-0", n ? "text-accent-ink" : "text-ink-4")} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {p.code} · {p.name}
                  </span>
                  <span className="block text-xs text-ink-3">{n ? plural(n, "schedule version") : "No detailed schedule yet"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The editor
 * ------------------------------------------------------------------------- */

function Editor() {
  const ctl = useOpenSchedule();
  const { s, r, edit, selected, select, openDetail, focus, showInGantt, undo, redo, canUndo, canRedo, openSettings, all, currentId } = ctl;
  // Open at a scale that fits most of the job on screen.
  const [zoom, setZoom] = useState<Zoom>(() => (dayNum(r.finish) - dayNum(r.start) > 300 ? "month" : "week"));
  // Narrow screens start with names only so the bars get room.
  const [colSet, setColSet] = useState<ColSet>(() => (typeof window !== "undefined" && window.innerWidth < 1280 ? "names" : "dates"));
  const full = colSet === "logic";
  const [baseline, setBaseline] = useState(true);
  const [links, setLinks] = useState(s.acts.length <= 600);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editField, setEditField] = useState<{ id: string; field: "name" | "dur" | "preds" } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, h: 600, w: 1200 });

  const cols = COLS.filter((c) => SET_ORDER.indexOf(c.set) <= SET_ORDER.indexOf(colSet));
  const gridW = cols.reduce((t, c) => t + c.w, 0);
  const ppd = PPD[zoom];
  // The grid pins to the left only while it leaves the bars most of the width; on a phone it scrolls away instead.
  const stick = gridW <= view.w * 0.6;
  const codeOf = useMemo(() => new Map(s.acts.map((a) => [a.id, a.code])), [s.acts]);

  /* Rows ------------------------------------------------------------------ */
  const keep = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dd = dayNum(s.dataDate);
    const ids = focus ? new Set(focus.ids) : null;
    const pass = (c: Calc) => {
      if (ids && !ids.has(c.a.id)) return false;
      if (needle && !`${c.a.code} ${c.a.name} ${c.a.resp ?? ""}`.toLowerCase().includes(needle)) return false;
      switch (filter) {
        case "longest":
          return c.longest;
        case "near":
          return c.tf !== null && c.tf <= 10;
        case "negative":
          return c.tf !== null && c.tf < 0;
        case "open":
          return c.status !== "complete";
        case "milestones":
          return c.a.type !== "task";
        case "look3":
        case "look6": {
          const end = dd + (filter === "look3" ? 21 : 42);
          return c.status !== "complete" && dayNum(c.start) <= end;
        }
        default:
          return true;
      }
    };
    return !ids && !needle && filter === "all" ? undefined : pass;
  }, [q, filter, focus, s.dataDate]);
  const rows = useMemo(() => ganttRows(s, r, collapsed, keep), [s, r, collapsed, keep]);
  const rowIndex = useMemo(() => new Map(rows.map((x, i) => [x.kind === "wbs" ? x.w.id : x.c.a.id, i])), [rows]);
  const shown = rows.filter((x) => x.kind === "act").length;

  /* Time scale ------------------------------------------------------------- */
  const range = useMemo(() => {
    const dates = [s.start, s.dataDate, r.start, r.finish, ...(s.deadline ? [s.deadline] : []), ...s.acts.flatMap((a) => (a.bl ? [a.bl.s, a.bl.f] : []))].filter(Boolean);
    const lo = Math.min(...dates.map(dayNum)) - 14;
    const hi = Math.max(...dates.map(dayNum)) + 45;
    // Start on a Sunday so week ticks line up.
    const d0 = lo - new Date(lo * 86_400_000).getUTCDay();
    return { d0, days: hi - d0 };
  }, [s, r]);
  const tlW = Math.ceil(range.days * ppd);
  const x = useCallback((iso: string, end = false) => (dayNum(iso) - range.d0 + (end ? 1 : 0)) * ppd, [range.d0, ppd]);

  /* Scrolling and virtual rows -------------------------------------------- */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView((v) => ({ ...v, h: el.clientHeight, w: el.clientWidth })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const toDataDate = useCallback(() => {
    const el = scroller.current;
    // Put the data date a third of the way across the visible timeline: some history, mostly what's ahead.
    // Pinned, the grid covers the left of the viewport and the bars start at scrollLeft; unpinned, the bars start after the grid.
    if (el) el.scrollLeft = Math.max(0, stick ? x(s.dataDate) - (el.clientWidth - gridW) / 3 : gridW + x(s.dataDate) - el.clientWidth / 3);
  }, [x, s.dataDate, gridW, stick]);
  useLayoutEffect(toDataDate, [zoom, s.id, colSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) setView({ top: el.scrollTop, h: el.clientHeight, w: el.clientWidth });
    });
  };
  const first = Math.max(0, Math.floor((view.top - HEAD) / ROW) - 8);
  const last = Math.min(rows.length, Math.ceil((view.top + view.h) / ROW) + 8);

  const selIndex = selected ? (rowIndex.get(selected) ?? -1) : -1;
  const scrollToRow = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const top = HEAD + i * ROW;
    if (top < el.scrollTop + HEAD) el.scrollTop = top - HEAD;
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight;
  };

  /* Editing ---------------------------------------------------------------- */
  const selRow = selIndex >= 0 ? rows[selIndex] : undefined;
  const wbsOfSel = selRow ? (selRow.kind === "wbs" ? selRow.w.id : selRow.c.a.wbsId) : null;

  const add = (type: "task" | "finish") => {
    let afterId: string | null = null;
    let wbsId: string | null = wbsOfSel;
    if (selRow?.kind === "act") afterId = selRow.c.a.id;
    else if (selRow?.kind === "wbs") {
      const inW = s.acts.filter((a) => a.wbsId === selRow.w.id);
      afterId = inW[inW.length - 1]?.id ?? null;
      wbsId = selRow.w.id;
    } else afterId = s.acts[s.acts.length - 1]?.id ?? null;
    const res = addActivity(s, { afterId, wbsId, type, link: !!afterId });
    if (wbsId && collapsed.has(wbsId)) setCollapsed((c) => new Set([...c].filter((k) => k !== wbsId)));
    edit(res.s);
    select(res.id);
    setEditField({ id: res.id, field: "name" });
  };
  const addW = () => {
    const parent = selRow?.kind === "wbs" ? selRow.w.parentId : selRow?.kind === "act" ? (s.wbs.find((w) => w.id === selRow.c.a.wbsId)?.parentId ?? null) : null;
    const res = addWbs(s, parent);
    edit(res.s);
    select(res.id);
    setEditField({ id: res.id, field: "name" });
  };
  const del = () => {
    if (!selRow) return;
    const next = rows[selIndex + 1] ?? rows[selIndex - 1];
    if (selRow.kind === "act") {
      edit(removeActivities(s, [selRow.c.a.id]));
      toast(`Deleted ${selRow.c.a.code}. Undo with Ctrl+Z.`);
    } else {
      edit(removeWbs(s, selRow.w.id));
      toast(`Removed WBS ${selRow.w.name}; its activities moved up a level. Undo with Ctrl+Z.`);
    }
    select(next ? (next.kind === "wbs" ? next.w.id : next.c.a.id) : null);
  };
  const move = (dir: -1 | 1) => {
    if (!selRow) return;
    edit(selRow.kind === "act" ? moveActivity(s, selRow.c.a.id, dir) : moveWbs(s, selRow.w.id, dir));
  };
  const toggle = (id: string) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((k) => k !== id)) : new Set([...c, id])));

  // Undo and redo anywhere on the page, except inside a text field (which has its own).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const onGridKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const go = (i: number) => {
      const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (!row) return;
      select(row.kind === "wbs" ? row.w.id : row.c.a.id);
      scrollToRow(Math.max(0, Math.min(rows.length - 1, i)));
    };
    if (e.key === "ArrowDown" && e.altKey) return (e.preventDefault(), move(1));
    if (e.key === "ArrowUp" && e.altKey) return (e.preventDefault(), move(-1));
    if (e.key === "ArrowDown") return (e.preventDefault(), go(selIndex + 1));
    if (e.key === "ArrowUp") return (e.preventDefault(), go(selIndex < 0 ? 0 : selIndex - 1));
    if (e.key === "Home") return (e.preventDefault(), go(0));
    if (e.key === "End") return (e.preventDefault(), go(rows.length - 1));
    if (!selRow) return;
    if (e.key === "Enter") return (e.preventDefault(), openDetail(selRow.kind === "wbs" ? selRow.w.id : selRow.c.a.id));
    if (e.key === "F2") return (e.preventDefault(), setEditField({ id: selRow.kind === "wbs" ? selRow.w.id : selRow.c.a.id, field: "name" }));
    if (e.key === "Insert") return (e.preventDefault(), add("task"));
    if (e.key === "Delete") return (e.preventDefault(), del());
    if (selRow.kind === "wbs" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const shut = collapsed.has(selRow.w.id);
      if ((e.key === "ArrowLeft") !== shut) toggle(selRow.w.id);
    }
  };

  const projectName = projectById(s.projectId)?.code ?? "Schedule";
  const fileBase = `${projectName}_${s.name}`.replace(/[^\w.-]+/g, "_");
  const isCurrent = s.id === currentId;
  const newer = isCurrent ? null : (all.find((v) => v.id === currentId) ?? null);

  /* Render ----------------------------------------------------------------- */
  return (
    <div className="panel flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => add("task")} title="Add an activity after the selected row (Insert)">
          Activity
        </Button>
        <Button size="sm" icon={<Diamond className="size-3" aria-hidden />} onClick={() => add("finish")}>
          Milestone
        </Button>
        <Button size="sm" icon={<FolderPlus className="size-3.5" aria-hidden />} onClick={addW}>
          WBS
        </Button>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <IconButton label="Move up (Alt+↑)" disabled={!selRow} onClick={() => move(-1)}>
          <ArrowUp className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="Move down (Alt+↓)" disabled={!selRow} onClick={() => move(1)}>
          <ArrowDown className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="Delete selected (Delete)" disabled={!selRow} onClick={del}>
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Redo2 className="size-4" aria-hidden />
        </IconButton>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<Settings2 className="size-3.5" aria-hidden />} onClick={openSettings}>
            Dates, calendar, baseline
          </Button>
          <Popover
            label="Export schedule"
            width="w-72"
            trigger={({ toggle, ref, ...aria }) => (
              <button
                ref={ref}
                {...aria}
                type="button"
                onClick={toggle}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-semibold text-ink hover:border-slate hover:bg-surface-2"
              >
                <Download className="size-3.5" aria-hidden />
                Export
              </button>
            )}
          >
            {(close) => (
              <div className="p-1.5">
                {[
                  {
                    label: "Microsoft Project XML",
                    hint: "Opens in Project; P6 imports it too",
                    run: () => downloadText(`${fileBase}.xml`, toMspdi(s, projectName, r), "application/xml"),
                  },
                  { label: "Activity table (CSV)", hint: "Re-imports here with its logic", run: () => downloadCsv(`${fileBase}.csv`, CSV_HEADERS, toRows(s, r)) },
                  { label: "Activity table (Excel)", hint: "For review and markup", run: () => downloadExcel(`${fileBase}.xls`, s.name, CSV_HEADERS, toRows(s, r)) },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface-2"
                    onClick={() => {
                      o.run();
                      close();
                    }}
                  >
                    <span className="block text-sm font-semibold text-ink">{o.label}</span>
                    <span className="block text-xs text-ink-3">{o.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input type="search" aria-label="Find activities" placeholder="Find ID, name, or company" className="field h-7 w-56 pl-8 text-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label htmlFor="gantt-filter" className="sr-only">
          Filter
        </label>
        <select id="gantt-filter" className="field h-7 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Segmented size="sm" label="Timescale" value={zoom} onChange={setZoom} options={[{ value: "day", label: "Days" }, { value: "week", label: "Weeks" }, { value: "month", label: "Months" }, { value: "quarter", label: "Quarters" }]} />
        <Segmented size="sm" label="Columns" value={colSet} onChange={setColSet} options={[{ value: "names", label: "Names" }, { value: "dates", label: "Dates" }, { value: "logic", label: "Logic & baseline" }]} />
        <Switch checked={baseline} onChange={setBaseline} label="Baseline" />
        <Switch checked={links} onChange={setLinks} label="Links" />
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Collapse every WBS" onClick={() => setCollapsed(new Set(s.wbs.map((w) => w.id)))}>
            <ListCollapse className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Expand every WBS" onClick={() => setCollapsed(new Set())}>
            <ListTree className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Scroll to the data date" onClick={toDataDate}>
            <Crosshair className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {(focus || r.loops.length > 0 || newer) && (
        <div className="space-y-1.5 border-b border-line-soft px-4 py-2.5">
          {focus && (
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <span className="font-semibold text-ink">Showing {plural(focus.ids.length, "activity", "activities")}</span> from the health check “{focus.label}”.
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={() => showInGantt(null)}>
                Show all
              </Button>
            </div>
          )}
          {r.loops.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-neg-ink">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {plural(r.loops.length, "relationship")} closed a loop and {r.loops.length === 1 ? "was" : "were"} ignored:{" "}
                {r.loops
                  .slice(0, 4)
                  .map((l) => `${codeOf.get(l.pred)} → ${codeOf.get(l.succ)}`)
                  .join(", ")}
                . Remove one link in each loop.
              </span>
            </p>
          )}
          {newer && (
            <p className="text-sm text-ink-2">
              You’re looking at <span className="font-semibold text-ink">{s.name}</span>, not the current schedule. Edits here don’t change {newer.name}.
            </p>
          )}
        </div>
      )}

      <div
        ref={scroller}
        role="treegrid"
        aria-label={`${s.name} activities`}
        aria-rowcount={rows.length}
        aria-multiselectable={false}
        tabIndex={0}
        onKeyDown={onGridKey}
        onScroll={onScroll}
        className="relative h-[max(24rem,calc(100dvh-19rem))] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-accent-tint focus-visible:ring-inset"
        style={{ ["--grid-w" as string]: `${stick ? gridW : 0}px` }}
      >
        <div style={{ width: gridW + tlW, height: HEAD + rows.length * ROW }} className="relative">
          <Header cols={cols} gridW={gridW} tlW={tlW} zoom={zoom} d0={range.d0} days={range.days} ppd={ppd} stick={stick} />
          <Overlay
            top={HEAD}
            left={gridW}
            width={tlW}
            height={rows.length * ROW}
            zoom={zoom}
            d0={range.d0}
            days={range.days}
            ppd={ppd}
            x={x}
            s={s}
            rowIndex={rowIndex}
            first={first}
            last={last}
            links={links}
            r={r}
          />
          <div style={{ position: "absolute", top: HEAD + first * ROW, left: 0 }}>
            {rows.slice(first, last).map((row, k) => {
              const i = first + k;
              const id = row.kind === "wbs" ? row.w.id : row.c.a.id;
              return (
                <Row
                  key={id}
                  row={row}
                  index={i}
                  cols={cols}
                  gridW={gridW}
                  tlW={tlW}
                  stick={stick}
                  x={x}
                  selected={selected === id}
                  collapsed={row.kind === "wbs" && collapsed.has(row.w.id)}
                  baseline={baseline}
                  editField={editField?.id === id ? editField.field : null}
                  onEdited={() => setEditField(null)}
                  onSelect={() => select(id)}
                  onOpen={() => openDetail(id)}
                  onToggle={() => row.kind === "wbs" && toggle(row.w.id)}
                  predsText={row.kind === "act" && full ? predText(s, row.c.a.id, (pid) => codeOf.get(pid) ?? "?") : ""}
                  onName={(v) => {
                    if (!v.trim()) return;
                    edit(row.kind === "act" ? updateActivity(s, row.c.a.id, { name: v.trim() }) : updateWbs(s, row.w.id, { name: v.trim() }));
                  }}
                  onDur={(v) => {
                    if (row.kind !== "act") return;
                    const n = Math.round(Number(v));
                    if (!Number.isFinite(n) || n < 0) return toast("Duration must be zero or more working days.");
                    const a = row.c.a;
                    if (n === 0 && a.type === "task") edit(updateActivity(s, a.id, { type: "finish", dur: 0 }));
                    else if (n > 0 && a.type !== "task") edit(updateActivity(s, a.id, { type: "task", dur: n }));
                    else edit(updateActivity(s, a.id, { dur: n, ...(row.c.status === "planned" ? {} : { rem: Math.max(0, (a.rem ?? n) + n - a.dur) }) }));
                  }}
                  onPreds={(v) => {
                    if (row.kind !== "act") return;
                    const res = setPredsFromText(s, row.c.a.id, v);
                    edit(res.s);
                    if (res.unknown.length) toast(`Not linked: ${res.unknown.join(", ")} isn’t an activity ID here.`);
                  }}
                />
              );
            })}
          </div>
          {!rows.length && (
            <div className="sticky left-0 px-5 py-10 text-sm text-ink-2" style={{ width: Math.min(gridW + 320, 900), top: HEAD }}>
              {s.acts.length ? "No activities match. Clear the search or pick another filter." : "No activities yet. Add one with the Activity button or press Insert."}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <Legend
          items={[
            { label: "Complete", color: INK.done },
            { label: "Remaining", color: INK.todo },
            { label: "Longest path", color: INK.critical },
            ...(baseline ? [{ label: "Baseline", color: INK.baseline }] : []),
            { label: "WBS summary", color: INK.summary },
            { label: "Data date", color: INK.dataDate, dashed: true },
            ...(s.deadline ? [{ label: "Contract completion", color: INK.deadline, dashed: true }] : []),
          ]}
        />
        <p className="text-xs text-ink-3">
          {shown === s.acts.length ? plural(s.acts.length, "activity", "activities") : `${shown} of ${plural(s.acts.length, "activity", "activities")}`} · {plural(s.rels.length, "relationship")} · {SOURCE_LABEL[s.source.kind]} · finish{" "}
          {fmtDate(r.finish)}
          {r.blFinish && (
            <>
              {" "}
              (<Variance days={dayNum(r.finish) - dayNum(r.blFinish)} short />)
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Header: column labels and the two-tier timescale
 * ------------------------------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 4 ’24": short enough for a grid column, with the year kept. */
const gridDate = (iso: string) => `${fmtDate(iso, "short")} ’${iso.slice(2, 4)}`;

interface Tick {
  at: number;
  label: string;
  w: number;
}

function ticks(zoom: Zoom, d0: number, days: number): { top: Tick[]; bottom: Tick[] } {
  const top: Tick[] = [];
  const bottom: Tick[] = [];
  const dateOf = (d: number) => new Date(d * 86_400_000);
  const push = (list: Tick[], at: number, label: string) => {
    const prev = list[list.length - 1];
    if (prev) prev.w = at - prev.at;
    list.push({ at, label, w: d0 + days - at });
  };
  let lastTop = "";
  let lastBottom = "";
  for (let d = d0; d < d0 + days; d++) {
    const dt = dateOf(d);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const q = Math.floor(m / 3);
    const topKey = zoom === "day" || zoom === "week" ? `${y}-${m}` : `${y}`;
    if (topKey !== lastTop) {
      push(top, d, zoom === "day" || zoom === "week" ? `${MONTHS[m]} ${y}` : String(y));
      lastTop = topKey;
    }
    let bKey = "";
    let bLabel = "";
    if (zoom === "day") [bKey, bLabel] = [String(d), String(dt.getUTCDate())];
    else if (zoom === "week") {
      if (dt.getUTCDay() === 1 || d === d0) [bKey, bLabel] = [String(d - ((dt.getUTCDay() + 6) % 7)), String(dt.getUTCDate())];
      else bKey = lastBottom;
    } else if (zoom === "month") [bKey, bLabel] = [`${y}-${m}`, MONTHS[m]!];
    else [bKey, bLabel] = [`${y}-${q}`, `Q${q + 1}`];
    if (bKey !== lastBottom) {
      push(bottom, d, bLabel);
      lastBottom = bKey;
    }
  }
  return { top, bottom };
}

function Header({ cols, gridW, tlW, zoom, d0, days, ppd, stick }: { cols: Col[]; gridW: number; tlW: number; zoom: Zoom; d0: number; days: number; ppd: number; stick: boolean }) {
  const t = useMemo(() => ticks(zoom, d0, days), [zoom, d0, days]);
  return (
    <div role="row" className="sticky top-0 z-[4] flex border-b border-line bg-surface" style={{ width: gridW + tlW, height: HEAD }}>
      <div className={cx("z-[5] flex items-end border-r border-line bg-surface", stick && "sticky left-0")} style={{ width: gridW }}>
        {cols.map((c) => (
          <div
            key={c.id}
            role="columnheader"
            title={c.title}
            className={cx("truncate px-2 pb-2 text-2xs font-semibold text-ink-3", c.right && "text-right")}
            style={{ width: c.w }}
          >
            {c.label}
          </div>
        ))}
      </div>
      <div aria-hidden className="relative" style={{ width: tlW }}>
        <div className="absolute inset-x-0 top-0 h-[22px] border-b border-line-soft">
          {t.top.map((k) => (
            <div key={k.at} className="absolute top-0 flex h-full items-center border-l border-line-soft px-1.5 text-2xs font-semibold whitespace-nowrap text-ink-2" style={{ left: (k.at - d0) * ppd, width: k.w * ppd }}>
              <span className="sticky left-[calc(var(--grid-w)+6px)] truncate">{k.label}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[22px]">
          {t.bottom.map((k) => (
            <div key={k.at} className="num absolute top-0 flex h-full items-center justify-center border-l border-line-soft text-[0.625rem] text-ink-3" style={{ left: (k.at - d0) * ppd, width: k.w * ppd }}>
              {k.w * ppd >= 16 ? k.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Overlay: gridlines, weekends, data date and deadline lines, and links
 * ------------------------------------------------------------------------- */

function Overlay({
  top,
  left,
  width,
  height,
  zoom,
  d0,
  days,
  ppd,
  x,
  s,
  r,
  rowIndex,
  first,
  last,
  links,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
  zoom: Zoom;
  d0: number;
  days: number;
  ppd: number;
  x: (iso: string, end?: boolean) => number;
  s: Schedule;
  r: ReturnType<typeof useOpenSchedule>["r"];
  rowIndex: Map<string, number>;
  first: number;
  last: number;
  links: boolean;
}) {
  const t = useMemo(() => ticks(zoom, d0, days), [zoom, d0, days]);
  const shade = useMemo(() => {
    if (zoom !== "day") return [];
    const out: number[] = [];
    for (let d = d0; d < d0 + days; d++) if (!r.cal.isWork(isoOf(d))) out.push(d);
    return out;
  }, [zoom, d0, days, r.cal]);
  const paths = useMemo(() => {
    if (!links) return [];
    const out: Array<{ d: string; hot: boolean; key: string }> = [];
    const cy = (i: number) => i * ROW + ROW / 2;
    for (const rel of s.rels) {
      const ip = rowIndex.get(rel.pred);
      const is = rowIndex.get(rel.succ);
      if (ip === undefined || is === undefined) continue;
      if (Math.max(ip, is) < first || Math.min(ip, is) > last) continue;
      const p = r.byId.get(rel.pred);
      const q = r.byId.get(rel.succ);
      if (!p || !q) continue;
      const fromEnd = rel.type === "FS" || rel.type === "FF";
      const toEnd = rel.type === "FF" || rel.type === "SF";
      const x1 = fromEnd ? (p.a.type === "task" ? x(p.finish, true) : x(p.finish, p.a.type === "finish")) : x(p.start);
      const x2 = toEnd ? (q.a.type === "task" ? x(q.finish, true) : x(q.finish, q.a.type === "finish")) : x(q.start, q.a.type === "finish");
      const y1 = cy(ip);
      const y2 = cy(is);
      const dir = y2 >= y1 ? 1 : -1;
      let d: string;
      if (toEnd) {
        const xe = Math.max(x1, x2) + 8;
        d = `M${x1},${y1} H${xe} V${y2} H${x2 + 5}`;
      } else if (x2 - x1 >= 10) d = `M${x1},${y1} H${x1 + 5} V${y2} H${x2 - 5}`;
      else {
        const mid = y2 - (dir * ROW) / 2;
        d = `M${x1},${y1} H${x1 + 5} V${mid} H${x2 - 10} V${y2} H${x2 - 5}`;
      }
      out.push({ d, hot: p.longest && q.longest && q.driving.includes(rel.id), key: rel.id });
    }
    return out;
  }, [links, s.rels, rowIndex, first, last, r, x]);

  const dd = x(s.dataDate);
  return (
    <svg aria-hidden className="pointer-events-none absolute z-[1]" style={{ top, left, width, height }} width={width} height={height}>
      <defs>
        <marker id="gantt-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--c-slate-400)" />
        </marker>
        <marker id="gantt-arrow-hot" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--c-coral-500)" />
        </marker>
      </defs>
      {shade.map((d) => (
        <rect key={d} x={(d - d0) * ppd} y={0} width={ppd} height={height} fill="var(--surface-sunk)" />
      ))}
      {t.bottom.map((k) => (
        <line key={k.at} x1={(k.at - d0) * ppd} x2={(k.at - d0) * ppd} y1={0} y2={height} stroke="var(--line-soft)" />
      ))}
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill="none" stroke={p.hot ? "var(--c-coral-500)" : "var(--c-slate-400)"} strokeOpacity={p.hot ? 0.9 : 0.55} strokeWidth={p.hot ? 1.4 : 1} markerEnd={`url(#${p.hot ? "gantt-arrow-hot" : "gantt-arrow"})`} />
      ))}
      <line x1={dd} x2={dd} y1={0} y2={height} stroke={INK.dataDate} strokeWidth={1.5} strokeDasharray="5 4" />
      {s.deadline && <line x1={x(s.deadline, true)} x2={x(s.deadline, true)} y1={0} y2={height} stroke={INK.deadline} strokeWidth={1.5} strokeDasharray="2 3" />}
      {TODAY !== s.dataDate && <line x1={x(TODAY)} x2={x(TODAY)} y1={0} y2={height} stroke="var(--c-slate-400)" strokeWidth={1} strokeDasharray="1 3" />}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * One row: grid cells on the left, bars on the right
 * ------------------------------------------------------------------------- */

function Row({
  row,
  index,
  cols,
  gridW,
  tlW,
  stick,
  x,
  selected,
  collapsed,
  baseline,
  editField,
  onEdited,
  onSelect,
  onOpen,
  onToggle,
  predsText,
  onName,
  onDur,
  onPreds,
}: {
  row: GanttRow;
  index: number;
  cols: Col[];
  gridW: number;
  tlW: number;
  stick: boolean;
  x: (iso: string, end?: boolean) => number;
  selected: boolean;
  collapsed: boolean;
  baseline: boolean;
  editField: "name" | "dur" | "preds" | null;
  onEdited: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onToggle: () => void;
  predsText: string;
  onName: (v: string) => void;
  onDur: (v: string) => void;
  onPreds: (v: string) => void;
}) {
  const wbs = row.kind === "wbs";
  const c = row.kind === "act" ? row.c : null;
  const input = "h-6 w-full rounded-xs border border-accent bg-surface px-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-accent-tint";
  const cell = (col: Col): ReactNode => {
    switch (col.id) {
      case "st":
        return c ? <StatusGlyph c={c} /> : null;
      case "code":
        return (
          <span className="flex min-w-0 items-center" style={{ paddingLeft: row.depth * 12 }}>
            {wbs ? (
              <button type="button" tabIndex={-1} aria-label={collapsed ? "Expand" : "Collapse"} onClick={(e) => (e.stopPropagation(), onToggle())} className="-ml-1 mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-ink-3 hover:bg-sunk hover:text-ink">
                {collapsed ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
              </button>
            ) : null}
            <span className={cx("num truncate", wbs ? "font-semibold text-ink-2" : "text-ink-2")}>{wbs ? row.w.code : c!.a.code}</span>
          </span>
        );
      case "name":
        if (selected) {
          return (
            <CommitInput
              aria-label={wbs ? "WBS name" : "Activity name"}
              className={input}
              value={wbs ? row.w.name : c!.a.name}
              onCommit={onName}
              select={editField === "name"}
              autoFocus={editField === "name"}
              onBlur={onEdited}
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return (
          <span className={cx("block truncate", wbs ? "font-semibold text-ink" : c!.status === "complete" ? "text-ink-2" : "text-ink")} title={wbs ? row.w.name : c!.a.name}>
            {wbs ? row.w.name : c!.a.name}
            {wbs && row.hidden ? <span className="ml-1.5 text-2xs font-normal text-ink-3">{row.hidden} hidden</span> : null}
          </span>
        );
      case "dur":
        if (wbs) return <span className="num text-ink-3">{row.roll.count ? row.roll.pct + "%" : ""}</span>;
        if (selected) return <CommitInput aria-label="Original duration, working days" inputMode="numeric" className={cx(input, "text-right")} value={String(c!.a.dur)} onCommit={onDur} onClick={(e) => e.stopPropagation()} />;
        return <span className="num">{c!.a.type === "task" ? c!.a.dur : 0}</span>;
      case "start":
        return (
          <span className={cx("num whitespace-nowrap", c && c.status !== "planned" && "font-semibold")}>
            {gridDate(wbs ? row.roll.start : c!.start)}
            {c && c.status !== "planned" ? <span className="font-normal text-ink-3"> A</span> : null}
          </span>
        );
      case "finish":
        return (
          <span className={cx("num whitespace-nowrap", c?.status === "complete" && "font-semibold")}>
            {gridDate(wbs ? row.roll.finish : c!.finish)}
            {c?.status === "complete" ? <span className="font-normal text-ink-3"> A</span> : null}
          </span>
        );
      case "tf":
        return <FloatText tf={wbs ? row.roll.tf : c!.tf} />;
      case "preds":
        if (wbs) return null;
        if (selected) return <CommitInput aria-label="Predecessors, for example A1010, A1020SS+5" placeholder="A1010, A1020SS+5" className={input} value={predsText} onCommit={onPreds} onClick={(e) => e.stopPropagation()} />;
        return <span className="num block truncate text-ink-2" title={predsText}>{predsText}</span>;
      case "blf": {
        const f = wbs ? row.roll.blFinish : (c!.a.bl?.f ?? null);
        return f ? <span className="num whitespace-nowrap text-ink-2">{gridDate(f)}</span> : <span className="text-ink-4">—</span>;
      }
      case "var": {
        const f = wbs ? row.roll.blFinish : (c!.a.bl?.f ?? null);
        const cur = wbs ? row.roll.finish : c!.finish;
        return <Variance days={f ? dayNum(cur) - dayNum(f) : null} short />;
      }
    }
  };

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={wbs ? !collapsed : undefined}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cx("group flex text-xs", selected ? "bg-accent-wash" : wbs ? "bg-surface-2" : "bg-surface")}
      style={{ height: ROW, width: gridW + tlW }}
    >
      <div
        className={cx("z-[2] flex items-center border-r border-b border-line-soft", stick && "sticky left-0", selected ? "bg-accent-wash" : wbs ? "bg-surface-2 group-hover:bg-sunk" : "bg-surface group-hover:bg-surface-2")}
        style={{ width: gridW }}
      >
        {cols.map((col) => (
          <div key={col.id} role="gridcell" className={cx("min-w-0 px-2", col.right && "text-right", col.id === "st" && "flex justify-center px-0")} style={{ width: col.w }}>
            {cell(col)}
          </div>
        ))}
      </div>
      <div className="relative border-b border-line-soft" style={{ width: tlW }}>
        {wbs ? <SummaryBar row={row} x={x} baseline={baseline} /> : <ActBar c={c!} x={x} baseline={baseline} />}
      </div>
    </div>
  );
}

function SummaryBar({ row, x, baseline }: { row: Extract<GanttRow, { kind: "wbs" }>; x: (iso: string, end?: boolean) => number; baseline: boolean }) {
  if (!row.roll.count) return null;
  const l = x(row.roll.start);
  const w = Math.max(2, x(row.roll.finish, true) - l);
  return (
    <>
      <div aria-hidden className="absolute top-[10px] h-[6px] rounded-t-[2px]" style={{ left: l, width: w, background: INK.summary }}>
        <span className="absolute top-full left-0 h-[4px] w-[3px] bg-[inherit]" style={{ background: INK.summary }} />
        <span className="absolute top-full right-0 h-[4px] w-[3px]" style={{ background: INK.summary }} />
      </div>
      {baseline && row.roll.blStart && row.roll.blFinish && (
        <div aria-hidden className="absolute top-[21px] h-[3px] rounded-full" style={{ left: x(row.roll.blStart), width: Math.max(2, x(row.roll.blFinish, true) - x(row.roll.blStart)), background: INK.baseline }} />
      )}
    </>
  );
}

function ActBar({ c, x, baseline }: { c: Calc; x: (iso: string, end?: boolean) => number; baseline: boolean }) {
  const a = c.a;
  const tip = `${a.code} ${a.name}\n${fmtDate(c.start)} – ${fmtDate(c.finish)}${c.tf !== null ? ` · float ${c.tf} wd` : ""}${a.bl ? `\nBaseline ${fmtDate(a.bl.s)} – ${fmtDate(a.bl.f)}` : ""}`;
  const color = c.status === "complete" ? INK.done : c.longest ? INK.critical : INK.todo;
  const bl =
    baseline && a.bl ? (
      a.type === "task" ? (
        <div aria-hidden className="absolute top-[21px] h-[3px] rounded-full" style={{ left: x(a.bl.s), width: Math.max(2, x(a.bl.f, true) - x(a.bl.s)), background: INK.baseline }} />
      ) : (
        <div aria-hidden className="absolute top-[18px] size-[7px] -translate-x-1/2 rotate-45" style={{ left: x(a.bl.f, a.type === "finish"), background: INK.baseline }} />
      )
    ) : null;
  if (a.type !== "task") {
    const at = a.type === "finish" ? x(c.finish, true) : x(c.start);
    return (
      <>
        <div title={tip} className="absolute top-[8px] size-[11px] -translate-x-1/2 rotate-45 rounded-[1px] ring-1 ring-surface" style={{ left: at, background: color }} />
        <span className="pointer-events-none absolute top-[7px] text-2xs whitespace-nowrap text-ink-3" style={{ left: at + 10 }}>
          {fmtDate(c.finish, "short")}
        </span>
        {bl}
      </>
    );
  }
  const l = x(c.start);
  const w = Math.max(3, x(c.finish, true) - l);
  // In-progress bars show the share of working time already spent in teal, the rest in its remaining color.
  const doneW = c.status === "complete" ? w : c.status === "active" ? Math.max(2, Math.min(w - 2, w * (1 - c.remaining / Math.max(1, c.ef - c.es)))) : 0;
  return (
    <>
      <div title={tip} className="absolute top-[7px] flex h-[12px] overflow-hidden rounded-[3px]" style={{ left: l, width: w }}>
        {doneW > 0 && <span className="h-full" style={{ width: doneW, background: INK.done }} />}
        {doneW < w && <span className="h-full flex-1" style={{ background: color }} />}
      </div>
      {bl}
    </>
  );
}
