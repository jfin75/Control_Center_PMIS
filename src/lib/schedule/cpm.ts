/** Critical path method over one schedule version: forward and backward
 *  passes with progress (retained logic), constraints, a contract completion
 *  deadline, free and total float, driving relationships, the longest path,
 *  and WBS roll-ups. Everything the Schedule view shows about dates comes
 *  from compute(). */

import { WorkCalendar, dayNum, isoValid } from "./calendar";
import type { Activity, Rel, Schedule } from "./types";

export type ActStatus = "complete" | "active" | "planned";

export interface Calc {
  a: Activity;
  status: ActStatus;
  /** Early start and finish points (working-day indexes). */
  es: number;
  ef: number;
  /** Where the remaining work starts: es until the activity starts, then no earlier than the data date. */
  rs: number;
  ls: number | null;
  lf: number | null;
  start: string;
  finish: string;
  lateStart: string | null;
  lateFinish: string | null;
  /** Working days; null once complete. */
  tf: number | null;
  ff: number | null;
  /** Remaining working days. */
  remaining: number;
  pct: number;
  longest: boolean;
  /** Relationships whose logic sets this activity's dates. */
  driving: string[];
  /** Calendar days the finish sits past the baseline finish. */
  varFinish: number | null;
  varStart: number | null;
}

export interface Roll {
  start: string;
  finish: string;
  es: number;
  ef: number;
  count: number;
  done: number;
  pct: number;
  tf: number | null;
  blStart: string | null;
  blFinish: string | null;
}

export interface Result {
  cal: WorkCalendar;
  byId: Map<string, Calc>;
  /** In schedule order. */
  list: Calc[];
  wbs: Map<string, Roll>;
  startIdx: number;
  ddIdx: number;
  finishIdx: number;
  start: string;
  finish: string;
  blFinish: string | null;
  deadline: string | null;
  /** Float on the finish against the deadline, in working days. */
  finishFloat: number | null;
  longest: string[];
  /** Relationships dropped to break loops. */
  loops: Rel[];
  /** Relationship id → free float in working days. */
  relFloat: Map<string, number>;
}

const cd = (a: string, b: string) => dayNum(b) - dayNum(a);

export function compute(s: Schedule): Result {
  const cal = new WorkCalendar(s.calendar);
  const acts = s.acts;
  const byId = new Map<string, Activity>(acts.map((a) => [a.id, a]));
  const rels = s.rels.filter((r) => r.pred !== r.succ && byId.has(r.pred) && byId.has(r.succ));
  const ddIdx = cal.start(s.dataDate);
  const startIdx = cal.start(isoValid(s.start) ? s.start : s.dataDate);

  const preds = new Map<string, Rel[]>();
  const succs = new Map<string, Rel[]>();
  for (const a of acts) {
    preds.set(a.id, []);
    succs.set(a.id, []);
  }
  for (const r of rels) {
    preds.get(r.succ)!.push(r);
    succs.get(r.pred)!.push(r);
  }

  // Topological order (Kahn). Anything left sits in or behind a loop; cut one
  // link per loop until the rest sorts.
  const order: string[] = [];
  const indeg = new Map<string, number>(acts.map((a) => [a.id, preds.get(a.id)!.length]));
  const ready = acts.filter((a) => indeg.get(a.id) === 0).map((a) => a.id);
  const loops: Rel[] = [];
  const done = new Set<string>();
  const drain = () => {
    while (ready.length) {
      const id = ready.shift()!;
      if (done.has(id)) continue;
      done.add(id);
      order.push(id);
      for (const r of succs.get(id)!) {
        const n = indeg.get(r.succ)! - 1;
        indeg.set(r.succ, n);
        if (n === 0) ready.push(r.succ);
      }
    }
  };
  drain();
  while (order.length < acts.length) {
    // Every unsorted activity still waits on an unsorted predecessor, so
    // walking predecessors must come back around: drop the link that closes it.
    let cur = acts.find((a) => !done.has(a.id))!.id;
    const via = new Map<string, Rel>();
    while (!via.has(cur)) {
      const r = preds.get(cur)!.find((x) => !done.has(x.pred))!;
      via.set(cur, r);
      cur = r.pred;
    }
    const cut = via.get(cur)!;
    loops.push(cut);
    preds.set(cut.succ, preds.get(cut.succ)!.filter((x) => x !== cut));
    succs.set(cut.pred, succs.get(cut.pred)!.filter((x) => x !== cut));
    const n = indeg.get(cut.succ)! - 1;
    indeg.set(cut.succ, n);
    if (n === 0) ready.push(cut.succ);
    drain();
  }

  const calc = new Map<string, Calc>();
  const status = (a: Activity): ActStatus => (isoValid(a.af) ? "complete" : isoValid(a.as) ? "active" : "planned");
  const durOf = (a: Activity) => (a.type === "task" ? Math.max(0, Math.round(a.dur)) : 0);
  const remOf = (a: Activity, st: ActStatus) => (st === "complete" ? 0 : st === "active" ? Math.max(0, Math.round(a.rem ?? Math.max(0, durOf(a) * (1 - (a.pct ?? 0) / 100)))) : durOf(a));

  /* Forward pass ----------------------------------------------------------- */
  for (const id of order) {
    const a = byId.get(id)!;
    const st = status(a);
    const dur = durOf(a);
    const rem = remOf(a, st);
    let es: number;
    let ef: number;
    let rs: number;
    if (st === "complete") {
      const af = a.af!;
      const as = isoValid(a.as) ? a.as : af;
      if (a.type === "finish") es = ef = cal.end(af);
      else if (a.type === "start") es = ef = cal.start(as);
      else {
        es = cal.start(as);
        ef = Math.max(es, cal.end(af));
      }
      rs = ef;
    } else {
      // Earliest start and finish the logic allows.
      let s0 = Math.max(ddIdx, st === "planned" ? startIdx : ddIdx);
      let f0 = -Infinity;
      for (const r of preds.get(id)!) {
        const p = calc.get(r.pred)!;
        if (p.status === "complete" && (r.type === "SS" || r.type === "SF")) continue;
        if (r.type === "FS") s0 = Math.max(s0, p.ef + r.lag);
        else if (r.type === "SS") s0 = Math.max(s0, p.es + r.lag);
        else if (r.type === "FF") f0 = Math.max(f0, p.ef + r.lag);
        else f0 = Math.max(f0, p.es + r.lag);
      }
      const c = a.cons;
      if (c && isoValid(c.date) && st === "planned") {
        const cs = cal.start(c.date);
        const ce = cal.end(c.date);
        if (c.type === "SNET") s0 = Math.max(s0, cs);
        if (c.type === "FNET") f0 = Math.max(f0, a.type === "start" ? cs : ce);
        if (c.type === "MSO") s0 = cs;
        if (c.type === "MFO") s0 = (a.type === "start" ? cs : ce) - rem;
      }
      if (f0 !== -Infinity && (!c || c.type !== "MSO")) s0 = Math.max(s0, f0 - rem);
      rs = s0;
      if (st === "active") {
        es = cal.start(a.as!);
        ef = rs + rem;
      } else {
        es = rs;
        ef = rs + rem;
      }
    }
    calc.set(id, {
      a,
      status: st,
      es,
      ef,
      rs,
      ls: null,
      lf: null,
      start: "",
      finish: "",
      lateStart: null,
      lateFinish: null,
      tf: null,
      ff: null,
      remaining: rem,
      pct: st === "complete" ? 100 : st === "planned" ? 0 : Math.round(a.pct ?? (dur ? ((dur - rem) / dur) * 100 : 0)),
      longest: false,
      driving: [],
      varFinish: null,
      varStart: null,
    });
  }

  const open = [...calc.values()].filter((c) => c.status !== "complete");
  const finishIdx = Math.max(startIdx, ...[...calc.values()].map((c) => c.ef));
  const deadline = isoValid(s.deadline) ? s.deadline : null;
  const lateEnd = deadline ? cal.end(deadline) : finishIdx;

  /* Backward pass ---------------------------------------------------------- */
  for (let i = order.length - 1; i >= 0; i--) {
    const c = calc.get(order[i]!)!;
    if (c.status === "complete") continue;
    let lf = lateEnd;
    for (const r of succs.get(c.a.id)!) {
      const s2 = calc.get(r.succ)!;
      if (s2.status === "complete" || s2.lf === null || s2.ls === null) continue;
      if (r.type === "FS") lf = Math.min(lf, s2.ls - r.lag);
      else if (r.type === "FF") lf = Math.min(lf, s2.lf - r.lag);
      else if (c.status === "active") continue;
      else if (r.type === "SS") lf = Math.min(lf, s2.ls - r.lag + c.remaining);
      else lf = Math.min(lf, s2.lf - r.lag + c.remaining);
    }
    const k = c.a.cons;
    if (k && isoValid(k.date) && c.status === "planned") {
      const cs = cal.start(k.date);
      const ce = cal.end(k.date);
      if (k.type === "FNLT") lf = Math.min(lf, c.a.type === "start" ? cs : ce);
      if (k.type === "SNLT") lf = Math.min(lf, cs + c.remaining);
      if (k.type === "MSO") lf = cs + c.remaining;
      if (k.type === "MFO") lf = c.a.type === "start" ? cs : ce;
    }
    c.lf = lf;
    c.ls = lf - c.remaining;
    c.tf = lf - c.ef;
  }

  /* Relationship free float and driving links ------------------------------ */
  const relFloat = new Map<string, number>();
  for (const r of rels) {
    if (loops.includes(r)) continue;
    const p = calc.get(r.pred)!;
    const s2 = calc.get(r.succ)!;
    if (s2.status === "complete") continue;
    const sStart = s2.rs;
    const sEnd = s2.ef;
    let slack: number;
    if (r.type === "FS") slack = sStart - (p.ef + r.lag);
    else if (r.type === "SS") slack = sStart - (p.es + r.lag);
    else if (r.type === "FF") slack = sEnd - (p.ef + r.lag);
    else slack = sEnd - (p.es + r.lag);
    if (p.status === "complete" && (r.type === "SS" || r.type === "SF")) continue;
    relFloat.set(r.id, slack);
    if (slack === 0) s2.driving.push(r.id);
  }
  for (const c of calc.values()) {
    if (c.status === "complete") continue;
    const out = succs.get(c.a.id)!.map((r) => relFloat.get(r.id)).filter((x): x is number => x !== undefined);
    c.ff = out.length ? Math.max(0, Math.min(...out)) : Math.max(0, lateEnd - c.ef);
  }

  /* Longest path: back from the latest finish through driving links -------- */
  const longest: string[] = [];
  const relById = new Map(rels.map((r) => [r.id, r]));
  if (open.length) {
    const maxEf = Math.max(...open.map((c) => c.ef));
    const stack = open.filter((c) => c.ef === maxEf).map((c) => c.a.id);
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const c = calc.get(id)!;
      if (c.status === "complete") continue;
      c.longest = true;
      longest.push(id);
      for (const rid of c.driving) {
        const r = relById.get(rid);
        if (r) stack.push(r.pred);
      }
    }
  }

  /* Dates ------------------------------------------------------------------ */
  const endDate = (p: number, s0: number) => (p > s0 ? cal.endDate(p) : cal.date(s0));
  // A finish milestone with nothing ahead of it sits on the first open day, not the evening before.
  const floor = Math.max(ddIdx, startIdx);
  const msDate = (p: number) => (p > floor ? cal.endDate(p) : cal.date(p));
  for (const c of calc.values()) {
    const a = c.a;
    if (c.status === "complete") {
      c.start = isoValid(a.as) ? a.as : a.af!;
      c.finish = a.af!;
    } else {
      c.start = a.type === "finish" ? msDate(c.ef) : cal.date(c.es);
      c.finish = a.type === "start" ? cal.date(c.es) : a.type === "finish" ? msDate(c.ef) : endDate(c.ef, c.es);
      if (c.status === "active") c.start = a.as!;
      if (c.ls !== null && c.lf !== null) {
        c.lateStart = a.type === "finish" ? cal.endDate(c.lf) : cal.date(c.ls);
        c.lateFinish = a.type === "start" ? cal.date(c.ls) : cal.endDate(c.lf);
      }
    }
    if (a.bl && isoValid(a.bl.f)) c.varFinish = cd(a.bl.f, c.finish);
    if (a.bl && isoValid(a.bl.s)) c.varStart = cd(a.bl.s, c.start);
  }

  const list = acts.map((a) => calc.get(a.id)!);
  const finish = open.length ? cal.endDate(Math.max(...open.map((c) => c.ef))) : list.reduce((m, c) => (c.finish > m ? c.finish : m), s.start);
  const blFinishes = acts.map((a) => a.bl?.f).filter(isoValid);
  const blFinish = blFinishes.length ? blFinishes.reduce((m, x) => (x > m ? x : m)) : null;
  const start = list.length ? list.reduce((m, c) => (c.start < m ? c.start : m), list[0]!.start) : s.start;

  return {
    cal,
    byId: calc,
    list,
    wbs: rollup(s, calc, cal),
    startIdx,
    ddIdx,
    finishIdx,
    start,
    finish,
    blFinish,
    deadline,
    finishFloat: open.length ? lateEnd - Math.max(...open.map((c) => c.ef)) : null,
    longest,
    loops,
    relFloat,
  };
}

function rollup(s: Schedule, calc: Map<string, Calc>, cal: WorkCalendar): Map<string, Roll> {
  const kids = new Map<string | null, string[]>();
  for (const w of s.wbs) kids.set(w.parentId, [...(kids.get(w.parentId) ?? []), w.id]);
  const actsIn = new Map<string, Calc[]>();
  for (const c of calc.values()) if (c.a.wbsId) actsIn.set(c.a.wbsId, [...(actsIn.get(c.a.wbsId) ?? []), c]);
  const out = new Map<string, Roll>();
  const walk = (id: string): Calc[] => {
    const all = [...(actsIn.get(id) ?? []), ...(kids.get(id) ?? []).flatMap(walk)];
    if (all.length) {
      const es = Math.min(...all.map((c) => (c.status === "complete" ? cal.start(c.start) : c.es)));
      const ef = Math.max(...all.map((c) => c.ef));
      const w = all.reduce((t, c) => t + Math.max(1, c.a.dur), 0);
      const open = all.filter((c) => c.tf !== null);
      const bls = all.map((c) => c.a.bl).filter((b): b is { s: string; f: string } => !!b && isoValid(b.s) && isoValid(b.f));
      out.set(id, {
        start: all.reduce((m, c) => (c.start < m ? c.start : m), all[0]!.start),
        finish: all.reduce((m, c) => (c.finish > m ? c.finish : m), all[0]!.finish),
        es,
        ef,
        count: all.length,
        done: all.filter((c) => c.status === "complete").length,
        pct: Math.round(all.reduce((t, c) => t + c.pct * Math.max(1, c.a.dur), 0) / w),
        tf: open.length ? Math.min(...open.map((c) => c.tf!)) : null,
        blStart: bls.length ? bls.reduce((m, b) => (b.s < m ? b.s : m), bls[0]!.s) : null,
        blFinish: bls.length ? bls.reduce((m, b) => (b.f > m ? b.f : m), bls[0]!.f) : null,
      });
    } else {
      out.set(id, { start: s.start, finish: s.start, es: 0, ef: 0, count: 0, done: 0, pct: 0, tf: null, blStart: null, blFinish: null });
    }
    return all;
  };
  for (const root of kids.get(null) ?? []) walk(root);
  return out;
}

/* ---------------------------------------------------------------------------
 * Baselines and progress
 * ------------------------------------------------------------------------- */

/** Copy the current dates onto every activity as its baseline. */
export function captureBaseline(s: Schedule, name: string): Schedule {
  const r = compute(s);
  return {
    ...s,
    baselineName: name,
    acts: s.acts.map((a) => {
      const c = r.byId.get(a.id)!;
      return { ...a, bl: { s: c.start, f: c.finish } };
    }),
  };
}

export function clearBaseline(s: Schedule): Schedule {
  return { ...s, baselineName: null, acts: s.acts.map((a) => ({ ...a, bl: null })) };
}

/**
 * Move the data date and status every activity as planned: work the schedule
 * said would be done by then gets actual dates, work under way gets its
 * remaining duration cut to what's left. The usual first step of an update,
 * before the scheduler corrects the exceptions by hand.
 */
export function progressAsPlanned(s: Schedule, newDD: string): Schedule {
  const r = compute(s);
  const cal = r.cal;
  const dd = cal.start(newDD);
  const acts = s.acts.map((a) => {
    const c = r.byId.get(a.id)!;
    if (c.status === "complete") return a;
    const startPt = c.status === "active" ? c.rs : c.es;
    if (a.type !== "task") {
      if (c.ef <= dd && startPt < dd + (a.type === "start" ? 0 : 1)) {
        return a.type === "start" ? { ...a, as: c.start, af: c.start, pct: 100 } : { ...a, as: c.finish, af: c.finish, pct: 100 };
      }
      return a;
    }
    if (c.ef <= dd) return { ...a, as: a.as ?? c.start, af: c.finish, rem: 0, pct: 100 };
    if (startPt < dd) {
      const rem = c.ef - dd;
      return { ...a, as: a.as ?? c.start, rem, pct: a.dur ? Math.round(((a.dur - rem) / a.dur) * 100) : 0 };
    }
    return a;
  });
  return { ...s, dataDate: newDD, acts };
}
