/** Building schedules from a compact spec: the Owner's starter templates and
 *  the seeded contractor updates both use it. A spec is a WBS tree whose
 *  activities carry a duration and predecessor shorthand. */

import { compute } from "./cpm";
import { parsePreds } from "./edit";
import type { Activity, ActType, Constraint, Rel, Schedule, Wbs } from "./types";

export interface SpecAct {
  /** Activity ID. */
  c: string;
  /** Name. */
  n: string;
  /** Duration in working days (0 for milestones). */
  d: number;
  /** Predecessors in grid shorthand: "A1010, A1020SS+5". */
  p?: string;
  t?: Exclude<ActType, "task">;
  /** Project-record milestone this activity reports as. */
  key?: string;
  resp?: string;
  cons?: Constraint;
  notes?: string;
}

export interface SpecWbs {
  code: string;
  name: string;
  acts?: SpecAct[];
  kids?: SpecWbs[];
}

export type Frame = Omit<Schedule, "wbs" | "acts" | "rels">;

/** Flatten a spec into a schedule. `dur` can override any activity's duration by code. */
export function fromSpec(spec: SpecWbs[], frame: Frame, dur: Record<string, number> = {}, skip: Set<string> = new Set()): Schedule {
  const wbs: Wbs[] = [];
  const acts: Activity[] = [];
  const preds: Array<[string, string]> = [];
  const walk = (list: SpecWbs[], parentId: string | null) => {
    for (const w of list) {
      const id = `w-${w.code}`;
      wbs.push({ id, parentId, code: w.code, name: w.name });
      for (const a of w.acts ?? []) {
        if (skip.has(a.c)) continue;
        const act: Activity = { id: `a-${a.c}`, code: a.c, name: a.n, wbsId: id, type: a.t ?? "task", dur: a.t ? 0 : (dur[a.c] ?? a.d) };
        if (a.key) act.key = a.key;
        if (a.resp) act.resp = a.resp;
        if (a.cons) act.cons = a.cons;
        if (a.notes) act.notes = a.notes;
        acts.push(act);
        if (a.p) preds.push([act.id, a.p]);
      }
      walk(w.kids ?? [], id);
    }
  };
  walk(spec, null);
  const byCode = new Map(acts.map((a) => [a.code.toUpperCase(), a.id]));
  const rels: Rel[] = [];
  for (const [succ, text] of preds) {
    for (const p of parsePreds(text).specs) {
      const pred = byCode.get(p.code.toUpperCase());
      if (pred) rels.push({ id: `r-${pred.slice(2)}-${succ.slice(2)}`, pred, succ, type: p.type, lag: p.lag });
    }
  }
  return { ...frame, wbs, acts, rels };
}

/** Durations by code, for copying one version's durations onto another. */
export const durations = (s: Schedule) => Object.fromEntries(s.acts.map((a) => [a.code, a.dur]));

/**
 * Stretch or shrink the task that drives each target milestone until the
 * milestone lands on its date. Seeds use it so a contractor schedule's key
 * milestones tie to the dates on the project record.
 */
export function fitMilestones(s: Schedule, targets: Record<string, string>): Schedule {
  let cur = s;
  const order = Object.entries(targets).sort((a, b) => a[1].localeCompare(b[1]));
  for (const [code, date] of order) {
    for (let tries = 0; tries < 6; tries++) {
      const r = compute(cur);
      const a = cur.acts.find((x) => x.code === code);
      if (!a) break;
      const c = r.byId.get(a.id)!;
      const want = a.type === "start" ? r.cal.start(date) : r.cal.end(date);
      const have = a.type === "start" ? c.es : c.ef;
      const delta = want - have;
      if (!delta) break;
      // Walk back through driving links to the nearest task.
      let id = a.id;
      let task: Activity | undefined;
      for (let hop = 0; hop < 10 && !task; hop++) {
        const rel = cur.rels.find((x) => r.byId.get(id)!.driving.includes(x.id));
        if (!rel) break;
        const p = cur.acts.find((x) => x.id === rel.pred)!;
        if (p.type === "task") task = p;
        else id = p.id;
      }
      if (!task) break;
      const next = Math.max(1, task.dur + delta);
      if (next === task.dur) break;
      cur = { ...cur, acts: cur.acts.map((x) => (x === task ? { ...x, dur: next } : x)) };
    }
  }
  return cur;
}
