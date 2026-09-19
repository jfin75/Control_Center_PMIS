"use client";

import { useId, useState } from "react";
import { FolderPlus, Link2, Plus, Trash2, X } from "lucide-react";
import { Chip } from "@/components/ui/data";
import { Button, IconButton } from "@/components/ui/controls";
import { Drawer, DrawerHeader, toast } from "@/components/ui/overlay";
import { Fact } from "@/components/ui/Panel";
import { cx, fmtDate } from "@/lib/format";
import { dayNum, isoValid } from "@/lib/schedule/calendar";
import type { Calc } from "@/lib/schedule/cpm";
import {
  ACT_TYPE_LABEL,
  addActivity,
  addWbs,
  REL_LABEL,
  REL_TYPES,
  removeActivities,
  removeRel,
  removeWbs,
  updateActivity,
  updateWbs,
  upsertRel,
  uid,
  wbsOptions,
} from "@/lib/schedule/edit";
import type { Activity, ActType, ConstraintType, Rel, RelType, Schedule } from "@/lib/schedule/types";
import { CONTRACTORS } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { CommitInput, Field, FloatText, plural, StatusChip, Variance } from "./parts";
import { useSchedule } from "./state";

export const CONSTRAINTS: Record<ConstraintType, { label: string; hard: boolean }> = {
  SNET: { label: "Start on or after", hard: false },
  FNET: { label: "Finish on or after", hard: false },
  SNLT: { label: "Start on or before", hard: true },
  FNLT: { label: "Finish on or before", hard: true },
  MSO: { label: "Mandatory start", hard: true },
  MFO: { label: "Mandatory finish", hard: true },
};

export function ActivityDrawer() {
  const { s, r, detail, openDetail } = useSchedule();
  const act = s && detail ? s.acts.find((a) => a.id === detail) : undefined;
  const wbs = s && detail && !act ? s.wbs.find((w) => w.id === detail) : undefined;
  const open = !!(s && r && (act || wbs));
  return (
    <Drawer open={open} onClose={() => openDetail(null)} label={act ? "Activity detail" : "WBS detail"} width="w-[min(32rem,100vw)]">
      {open && act && <ActivityPanel key={act.id} a={act} c={r!.byId.get(act.id)!} />}
      {open && wbs && <WbsPanel key={wbs.id} id={wbs.id} />}
    </Drawer>
  );
}

/* ---------------------------------------------------------------------------
 * Activity
 * ------------------------------------------------------------------------- */

function ActivityPanel({ a, c }: { a: Activity; c: Calc }) {
  const { s: sOpt, r, edit, openDetail } = useSchedule();
  const s = sOpt!;
  const id = useId();
  const set = (patch: Partial<Activity>) => edit(updateActivity(s, a.id, patch));
  const p = projectById(s.projectId);
  const dd = s.dataDate;
  const warnActual = (v: string | null | undefined) => (isoValid(v) && v >= dd ? "On or after the data date. Actuals must be before it." : undefined);

  return (
    <>
      <DrawerHeader onClose={() => openDetail(null)}>
        <p className="num text-xs font-semibold text-ink-3">{a.code}</p>
        <h2 className="mt-0.5 text-lg font-semibold text-ink">{a.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip c={c} />
          {c.longest && <Chip tone="neg">Longest path</Chip>}
          {c.tf !== null && c.tf < 0 && <Chip tone="neg">{Math.abs(c.tf)} wd negative float</Chip>}
          {a.key && <Chip tone="accent">Reports as “{a.key}”</Chip>}
        </div>
      </DrawerHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="Start" value={fmtDate(c.start)} sub={c.status !== "planned" ? "Actual" : c.lateStart ? `Late ${fmtDate(c.lateStart)}` : undefined} />
          <Fact label="Finish" value={fmtDate(c.finish)} sub={c.status === "complete" ? "Actual" : c.lateFinish ? `Late ${fmtDate(c.lateFinish)}` : undefined} />
          <Fact label="Total float" value={<FloatText tf={c.tf} />} sub={c.ff !== null ? `Free float ${c.ff} wd` : "Complete"} />
          <Fact label="Baseline start" value={a.bl ? fmtDate(a.bl.s) : "—"} sub={c.varStart !== null ? <Variance days={c.varStart} short /> : undefined} />
          <Fact label="Baseline finish" value={a.bl ? fmtDate(a.bl.f) : "—"} sub={c.varFinish !== null ? <Variance days={c.varFinish} /> : undefined} />
          <Fact label="Remaining" value={`${c.remaining} wd`} sub={`${c.pct}% complete`} />
        </dl>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Activity</h3>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <Field label="ID" htmlFor={`${id}-code`}>
              <CommitInput
                id={`${id}-code`}
                className="field w-full"
                value={a.code}
                onCommit={(v) => {
                  const code = v.trim();
                  if (!code) return;
                  if (s.acts.some((x) => x !== a && x.code.toUpperCase() === code.toUpperCase())) return toast(`${code} is already used by another activity.`);
                  set({ code });
                }}
              />
            </Field>
            <Field label="Name" htmlFor={`${id}-name`}>
              <CommitInput id={`${id}-name`} className="field w-full" value={a.name} onCommit={(v) => v.trim() && set({ name: v.trim() })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor={`${id}-type`}>
              <select
                id={`${id}-type`}
                className="field w-full"
                value={a.type}
                onChange={(e) => {
                  const type = e.target.value as ActType;
                  set(type === "task" ? { type, dur: a.dur || 5 } : { type, dur: 0, rem: undefined });
                }}
              >
                {(Object.keys(ACT_TYPE_LABEL) as ActType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Original duration (working days)" htmlFor={`${id}-dur`}>
              <CommitInput
                id={`${id}-dur`}
                inputMode="numeric"
                className="field w-full"
                disabled={a.type !== "task"}
                value={String(a.dur)}
                onCommit={(v) => {
                  const n = Math.round(Number(v));
                  if (!Number.isFinite(n) || n < 1) return toast("A task needs at least one working day. Make it a milestone for zero.");
                  set({ dur: n });
                }}
              />
            </Field>
            <Field label="WBS" htmlFor={`${id}-wbs`} className="col-span-2">
              <select id={`${id}-wbs`} className="field w-full" value={a.wbsId ?? ""} onChange={(e) => set({ wbsId: e.target.value || null })}>
                <option value="">No WBS</option>
                {wbsOptions(s).map(({ w, depth }) => (
                  <option key={w.id} value={w.id}>
                    {"  ".repeat(depth)}
                    {w.code} {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsible" htmlFor={`${id}-resp`}>
              <CommitInput id={`${id}-resp`} list={`${id}-firms`} className="field w-full" value={a.resp ?? ""} placeholder="Company or person" onCommit={(v) => set({ resp: v.trim() || undefined })} />
              <datalist id={`${id}-firms`}>
                {["Owner", ...CONTRACTORS.map((x) => x.name)].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Reports as project milestone" htmlFor={`${id}-key`}>
              <select id={`${id}-key`} className="field w-full" value={a.key ?? ""} onChange={(e) => set({ key: e.target.value || undefined })} disabled={a.type === "task" && !a.key}>
                <option value="">{a.type === "task" ? "Milestones only" : "None"}</option>
                {(p?.milestones ?? []).map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Progress</h3>
          <p className="text-xs text-ink-3">Actual dates must fall before the {fmtDate(dd)} data date. An actual finish marks the activity complete.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Actual start" htmlFor={`${id}-as`} hint={warnActual(a.as)}>
              <input
                id={`${id}-as`}
                type="date"
                className="field w-full"
                aria-invalid={!!warnActual(a.as)}
                value={a.as ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  set(v ? { as: v, rem: a.rem ?? a.dur, pct: a.pct ?? 0 } : { as: null, af: null, rem: undefined, pct: undefined });
                }}
              />
            </Field>
            <Field label="Actual finish" htmlFor={`${id}-af`} hint={warnActual(a.af)}>
              <input
                id={`${id}-af`}
                type="date"
                className="field w-full"
                aria-invalid={!!warnActual(a.af)}
                value={a.af ?? ""}
                min={a.as ?? undefined}
                onChange={(e) => {
                  const v = e.target.value || null;
                  set(v ? { as: a.as ?? (a.type === "task" ? c.start : v), af: v, rem: 0, pct: 100 } : { af: null, rem: a.dur, pct: a.pct === 100 ? 90 : a.pct });
                }}
              />
            </Field>
            {a.type === "task" && c.status === "active" && (
              <>
                <Field label="Physical % complete" htmlFor={`${id}-pct`}>
                  <CommitInput
                    id={`${id}-pct`}
                    inputMode="numeric"
                    className="field w-full"
                    value={String(a.pct ?? c.pct)}
                    onCommit={(v) => {
                      const n = Math.max(0, Math.min(99, Math.round(Number(v))));
                      if (!Number.isFinite(n)) return;
                      set({ pct: n, rem: Math.max(1, Math.round(a.dur * (1 - n / 100))) });
                    }}
                  />
                </Field>
                <Field label="Remaining duration (wd)" htmlFor={`${id}-rem`}>
                  <CommitInput
                    id={`${id}-rem`}
                    inputMode="numeric"
                    className="field w-full"
                    value={String(a.rem ?? c.remaining)}
                    onCommit={(v) => {
                      const n = Math.round(Number(v));
                      if (!Number.isFinite(n) || n < 0) return;
                      set({ rem: n });
                    }}
                  />
                </Field>
              </>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Constraint</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor={`${id}-ct`} hint={a.cons && CONSTRAINTS[a.cons.type].hard ? "Hard constraints override logic and count against schedule health." : undefined}>
              <select
                id={`${id}-ct`}
                className="field w-full"
                value={a.cons?.type ?? ""}
                onChange={(e) => {
                  const t = e.target.value as ConstraintType | "";
                  set({ cons: t ? { type: t, date: a.cons?.date ?? c.start } : null });
                }}
              >
                <option value="">None</option>
                {(Object.keys(CONSTRAINTS) as ConstraintType[]).map((t) => (
                  <option key={t} value={t}>
                    {CONSTRAINTS[t].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" htmlFor={`${id}-cd`}>
              <input id={`${id}-cd`} type="date" className="field w-full" disabled={!a.cons} value={a.cons?.date ?? ""} onChange={(e) => a.cons && e.target.value && set({ cons: { ...a.cons, date: e.target.value } })} />
            </Field>
          </div>
        </section>

        <Links title="Predecessors" s={s} a={a} side="pred" driving={c.driving} relFloat={r!.relFloat} />
        <Links title="Successors" s={s} a={a} side="succ" driving={[]} relFloat={r!.relFloat} />

        <section className="space-y-2">
          <Field label="Notes" htmlFor={`${id}-notes`}>
            <NotesBox id={`${id}-notes`} value={a.notes ?? ""} onCommit={(v) => set({ notes: v.trim() || undefined })} />
          </Field>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-3.5" aria-hidden />}
          onClick={() => {
            edit(removeActivities(s, [a.id]));
            openDetail(null);
            toast(`Deleted ${a.code}. Undo with Ctrl+Z.`);
          }}
        >
          Delete activity
        </Button>
        <Button
          size="sm"
          icon={<Plus className="size-3.5" aria-hidden />}
          onClick={() => {
            const res = addActivity(s, { afterId: a.id });
            edit(res.s);
            openDetail(res.id);
          }}
        >
          Add successor
        </Button>
      </div>
    </>
  );
}

function NotesBox({ id, value, onCommit }: { id: string; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <textarea id={id} rows={3} className="field w-full" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v)} />;
}

/** Predecessor or successor list with type, lag, relationship float, and a picker to add more. */
function Links({ title, s, a, side, driving, relFloat }: { title: string; s: Schedule; a: Activity; side: "pred" | "succ"; driving: string[]; relFloat: Map<string, number> }) {
  const { edit, openDetail, r } = useSchedule();
  const id = useId();
  const [pick, setPick] = useState("");
  const [type, setType] = useState<RelType>("FS");
  const [lag, setLag] = useState("0");
  const rels = s.rels.filter((x) => (side === "pred" ? x.succ === a.id : x.pred === a.id));
  const other = (x: Rel) => s.acts.find((y) => y.id === (side === "pred" ? x.pred : x.succ));
  const byCode = new Map(s.acts.map((y) => [y.code.toUpperCase(), y]));
  const add = () => {
    const code = pick.split(/\s+[—-]\s+/)[0]!.trim().toUpperCase();
    const o = byCode.get(code);
    if (!o || o.id === a.id) return toast(`${pick || "That"} isn’t another activity’s ID.`);
    const exists = s.rels.find((x) => (side === "pred" ? x.pred === o.id && x.succ === a.id : x.pred === a.id && x.succ === o.id));
    const rel: Rel = { id: exists?.id ?? uid("r"), pred: side === "pred" ? o.id : a.id, succ: side === "pred" ? a.id : o.id, type, lag: Math.round(Number(lag)) || 0 };
    edit(upsertRel(s, rel));
    setPick("");
    setLag("0");
  };
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          {title} <span className="font-normal text-ink-3">· {rels.length}</span>
        </h3>
        {side === "pred" && driving.length > 0 && <span className="text-xs text-ink-3">Driving links set this activity’s dates</span>}
      </div>
      {rels.length ? (
        <ul className="divide-y divide-line-soft rounded-md border border-line">
          {rels.map((x) => {
            const o = other(x);
            if (!o) return null;
            const drv = side === "pred" ? driving.includes(x.id) : (r?.byId.get(x.succ)?.driving.includes(x.id) ?? false);
            const rf = relFloat.get(x.id);
            return (
              <li key={x.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <button type="button" onClick={() => openDetail(o.id)} className="min-w-0 flex-1 text-left">
                  <span className="num block text-xs font-semibold text-accent-ink hover:underline">{o.code}</span>
                  <span className="block truncate text-xs text-ink-2">{o.name}</span>
                </button>
                {drv && <Chip tone="neg">Driving</Chip>}
                {!drv && rf !== undefined && <span className="num text-2xs text-ink-3" title="Relationship free float">{rf} wd</span>}
                <label className="sr-only" htmlFor={`${id}-${x.id}-t`}>
                  Relationship type
                </label>
                <select id={`${id}-${x.id}-t`} className="field h-7 w-16 px-1.5 text-xs" value={x.type} onChange={(e) => edit(upsertRel(s, { ...x, type: e.target.value as RelType }))} title={REL_LABEL[x.type]}>
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`${id}-${x.id}-l`}>
                  Lag in working days
                </label>
                <CommitInput
                  id={`${id}-${x.id}-l`}
                  inputMode="numeric"
                  title="Lag, working days (negative for a lead)"
                  className={cx("field h-7 w-14 px-1.5 text-right text-xs", x.lag < 0 && "text-neg-ink")}
                  value={String(x.lag)}
                  onCommit={(v) => {
                    const n = Math.round(Number(v));
                    if (Number.isFinite(n)) edit(upsertRel(s, { ...x, lag: n }));
                  }}
                />
                <IconButton label={`Remove link to ${o.code}`} onClick={() => edit(removeRel(s, x.id))} className="size-7">
                  <X className="size-3.5" aria-hidden />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-ink-3">{side === "pred" ? "No predecessors. Only the first activity should start from nothing." : "No successors. Only the last activity should lead nowhere."}</p>
      )}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-pick`} className="sr-only">
            Add {side === "pred" ? "predecessor" : "successor"}
          </label>
          <input
            id={`${id}-pick`}
            list={`${id}-acts`}
            className="field h-7 w-full text-xs"
            placeholder={`Add ${side === "pred" ? "predecessor" : "successor"} by ID`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          />
          <datalist id={`${id}-acts`}>
            {s.acts
              .filter((y) => y.id !== a.id)
              .map((y) => (
                <option key={y.id} value={`${y.code} — ${y.name}`} />
              ))}
          </datalist>
        </div>
        <label className="sr-only" htmlFor={`${id}-type`}>
          Relationship type
        </label>
        <select id={`${id}-type`} className="field h-7 w-16 px-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value as RelType)}>
          {REL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${id}-lag`}>
          Lag in working days
        </label>
        <input id={`${id}-lag`} inputMode="numeric" className="field h-7 w-14 px-1.5 text-right text-xs" value={lag} onChange={(e) => setLag(e.target.value)} />
        <Button size="sm" icon={<Link2 className="size-3.5" aria-hidden />} onClick={add} disabled={!pick.trim()}>
          Link
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * WBS node
 * ------------------------------------------------------------------------- */

function WbsPanel({ id }: { id: string }) {
  const { s: sOpt, r, edit, openDetail } = useSchedule();
  const s = sOpt!;
  const w = s.wbs.find((x) => x.id === id)!;
  const roll = r!.wbs.get(id);
  const fid = useId();
  // A node can't move under itself or anything beneath it.
  const below = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of s.wbs) if (x.parentId && below.has(x.parentId) && !below.has(x.id)) (below.add(x.id), (grew = true));
  }
  return (
    <>
      <DrawerHeader onClose={() => openDetail(null)}>
        <p className="num text-xs font-semibold text-ink-3">WBS {w.code}</p>
        <h2 className="mt-0.5 text-lg font-semibold text-ink">{w.name}</h2>
      </DrawerHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {roll && roll.count > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label="Start" value={fmtDate(roll.start)} />
            <Fact label="Finish" value={fmtDate(roll.finish)} sub={roll.blFinish ? <Variance days={dayNum(roll.finish) - dayNum(roll.blFinish)} /> : undefined} />
            <Fact label="Least float" value={<FloatText tf={roll.tf} />} sub="Working days" />
            <Fact label="Activities" value={roll.count} sub={`${roll.done} complete`} />
            <Fact label="Complete" value={`${roll.pct}%`} sub="Duration-weighted" />
          </dl>
        )}
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <Field label="Code" htmlFor={`${fid}-code`}>
            <CommitInput id={`${fid}-code`} className="field w-full" value={w.code} onCommit={(v) => v.trim() && edit(updateWbs(s, id, { code: v.trim() }))} />
          </Field>
          <Field label="Name" htmlFor={`${fid}-name`}>
            <CommitInput id={`${fid}-name`} className="field w-full" value={w.name} onCommit={(v) => v.trim() && edit(updateWbs(s, id, { name: v.trim() }))} />
          </Field>
          <Field label="Parent" htmlFor={`${fid}-parent`} className="col-span-2">
            <select id={`${fid}-parent`} className="field w-full" value={w.parentId ?? ""} onChange={(e) => edit(updateWbs(s, id, { parentId: e.target.value || null }))}>
              <option value="">Top level</option>
              {wbsOptions(s)
                .filter((o) => !below.has(o.w.id))
                .map(({ w: o, depth }) => (
                  <option key={o.id} value={o.id}>
                    {"  ".repeat(depth)}
                    {o.code} {o.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <p className="text-sm text-ink-2">
          {plural(s.acts.filter((a) => a.wbsId === id).length, "activity", "activities")} sit directly under this node, and {plural(s.wbs.filter((x) => x.parentId === id).length, "child node")}.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="size-3.5" aria-hidden />}
          onClick={() => {
            edit(removeWbs(s, id));
            openDetail(null);
            toast(`Removed WBS ${w.name}; its contents moved up a level. Undo with Ctrl+Z.`);
          }}
        >
          Remove node
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            icon={<FolderPlus className="size-3.5" aria-hidden />}
            onClick={() => {
              const res = addWbs(s, id);
              edit(res.s);
              openDetail(res.id);
            }}
          >
            Child node
          </Button>
          <Button
            size="sm"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => {
              const inW = s.acts.filter((a) => a.wbsId === id);
              const res = addActivity(s, { afterId: inW[inW.length - 1]?.id ?? null, wbsId: id, link: !!inW.length });
              edit(res.s);
              openDetail(res.id);
            }}
          >
            Activity here
          </Button>
        </div>
      </div>
    </>
  );
}
