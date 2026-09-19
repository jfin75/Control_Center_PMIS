/** Editing a schedule: ids and activity codes, the predecessor shorthand the
 *  grid accepts ("A1010, A1020SS+5"), adding, removing, and reordering
 *  activities and WBS nodes, and flattening the WBS tree into Gantt rows.
 *  Every function returns a new Schedule; nothing mutates. */

import type { Calc, Result, Roll } from "./cpm";
import type { Activity, ActType, Rel, RelType, Schedule, Wbs } from "./types";

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const REL_TYPES: RelType[] = ["FS", "SS", "FF", "SF"];
export const REL_LABEL: Record<RelType, string> = {
  FS: "Finish to start",
  SS: "Start to start",
  FF: "Finish to finish",
  SF: "Start to finish",
};

export const ACT_TYPE_LABEL: Record<ActType, string> = {
  task: "Task",
  start: "Start milestone",
  finish: "Finish milestone",
};

/* ---------------------------------------------------------------------------
 * Codes
 * ------------------------------------------------------------------------- */

/** The next free code after `after` (or after the highest), stepping by ten like P6's auto-numbering. */
export function nextCode(s: Schedule, after?: string): string {
  const taken = new Set(s.acts.map((a) => a.code.toUpperCase()));
  const parse = (c: string) => /^(.*?)(\d+)$/.exec(c);
  let prefix = "A";
  let n = 1000;
  let width = 4;
  const src = after ? parse(after) : null;
  if (src) {
    prefix = src[1]!;
    n = Number(src[2]);
    width = src[2]!.length;
  } else {
    const nums = s.acts.map((a) => parse(a.code)).filter((m): m is RegExpExecArray => !!m);
    if (nums.length) {
      const top = nums.reduce((m, x) => (Number(x[2]) > Number(m[2]) ? x : m));
      prefix = top[1]!;
      n = Number(top[2]);
      width = top[2]!.length;
    } else n = 990;
  }
  const fmt = (v: number) => `${prefix}${String(v).padStart(width, "0")}`;
  // Step by ten from a round number; if the slot is taken, try the numbers in between.
  let v = Math.floor(n / 10) * 10 + 10;
  if (after && taken.has(fmt(v).toUpperCase())) {
    for (let k = n + 1; k < v; k++) if (!taken.has(fmt(k).toUpperCase())) return fmt(k);
  }
  while (taken.has(fmt(v).toUpperCase())) v += 10;
  return fmt(v);
}

/* ---------------------------------------------------------------------------
 * Predecessor shorthand
 * ------------------------------------------------------------------------- */

export interface PredSpec {
  code: string;
  type: RelType;
  lag: number;
}

const PRED_RE = /^(.+?)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+)\s*(?:d|days?|wd)?)?$/i;

/** "A1010, A1020SS+5, A1030 FF-2d" → specs, plus anything that didn't parse. */
export function parsePreds(text: string): { specs: PredSpec[]; bad: string[] } {
  const specs: PredSpec[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[,;\n]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = PRED_RE.exec(t);
    if (!m) {
      bad.push(t);
      continue;
    }
    const lag = m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0;
    specs.push({ code: m[1]!.trim(), type: (m[2] ?? "FS").toUpperCase() as RelType, lag });
  }
  return { specs, bad };
}

export function relText(r: Pick<Rel, "type" | "lag">, code: string): string {
  const t = r.type === "FS" && !r.lag ? "" : r.type;
  const lag = r.lag ? `${r.lag > 0 ? "+" : "−"}${Math.abs(r.lag)}` : "";
  return `${code}${t}${lag}`;
}

export function predText(s: Schedule, id: string, codeOf: (id: string) => string): string {
  return s.rels
    .filter((r) => r.succ === id)
    .map((r) => relText(r, codeOf(r.pred)))
    .join(", ");
}

/** Replace an activity's predecessors from shorthand. Unknown codes and self-links are reported, not saved. */
export function setPredsFromText(s: Schedule, id: string, text: string): { s: Schedule; unknown: string[] } {
  const { specs, bad } = parsePreds(text.replace(/−/g, "-"));
  const byCode = new Map(s.acts.map((a) => [a.code.toUpperCase(), a.id]));
  const unknown = [...bad];
  const keep = s.rels.filter((r) => r.succ !== id);
  const added: Rel[] = [];
  for (const p of specs) {
    const pid = byCode.get(p.code.toUpperCase());
    if (!pid || pid === id) {
      unknown.push(p.code);
      continue;
    }
    if (added.some((r) => r.pred === pid)) continue;
    const prev = s.rels.find((r) => r.succ === id && r.pred === pid);
    added.push({ id: prev?.id ?? uid("r"), pred: pid, succ: id, type: p.type, lag: p.lag });
  }
  return { s: { ...s, rels: [...keep, ...added] }, unknown };
}

/* ---------------------------------------------------------------------------
 * Activities
 * ------------------------------------------------------------------------- */

export function addActivity(s: Schedule, opts: { afterId?: string | null; wbsId?: string | null; type?: ActType; name?: string; link?: boolean }): { s: Schedule; id: string } {
  const after = opts.afterId ? s.acts.find((a) => a.id === opts.afterId) : undefined;
  const type = opts.type ?? "task";
  const a: Activity = {
    id: uid("a"),
    code: nextCode(s, after?.code),
    name: opts.name ?? (type === "task" ? "New activity" : "New milestone"),
    wbsId: opts.wbsId !== undefined ? opts.wbsId : (after?.wbsId ?? null),
    type,
    dur: type === "task" ? 5 : 0,
  };
  const acts = [...s.acts];
  const at = after ? acts.indexOf(after) + 1 : acts.length;
  acts.splice(at, 0, a);
  // Chain a new activity onto the one it was added after, the common case when building a sequence.
  const rels = after && opts.link !== false ? [...s.rels, { id: uid("r"), pred: after.id, succ: a.id, type: "FS" as const, lag: 0 }] : s.rels;
  return { s: { ...s, acts, rels }, id: a.id };
}

export function updateActivity(s: Schedule, id: string, patch: Partial<Activity>): Schedule {
  return { ...s, acts: s.acts.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

export function removeActivities(s: Schedule, ids: string[]): Schedule {
  const gone = new Set(ids);
  return { ...s, acts: s.acts.filter((a) => !gone.has(a.id)), rels: s.rels.filter((r) => !gone.has(r.pred) && !gone.has(r.succ)) };
}

/** Swap with the neighbouring activity in the same WBS. */
export function moveActivity(s: Schedule, id: string, dir: -1 | 1): Schedule {
  const a = s.acts.find((x) => x.id === id);
  if (!a) return s;
  const same = s.acts.filter((x) => x.wbsId === a.wbsId);
  const i = same.indexOf(a);
  const other = same[i + dir];
  if (!other) return s;
  const acts = [...s.acts];
  const ia = acts.indexOf(a);
  const ib = acts.indexOf(other);
  acts[ia] = other;
  acts[ib] = a;
  return { ...s, acts };
}

export function upsertRel(s: Schedule, r: Rel): Schedule {
  const exists = s.rels.some((x) => x.id === r.id);
  return { ...s, rels: exists ? s.rels.map((x) => (x.id === r.id ? r : x)) : [...s.rels, r] };
}

export function removeRel(s: Schedule, id: string): Schedule {
  return { ...s, rels: s.rels.filter((r) => r.id !== id) };
}

/* ---------------------------------------------------------------------------
 * WBS
 * ------------------------------------------------------------------------- */

export function wbsPath(s: Schedule, id: string | null): Wbs[] {
  const out: Wbs[] = [];
  const byId = new Map(s.wbs.map((w) => [w.id, w]));
  let cur = id ? byId.get(id) : undefined;
  while (cur && out.length < 50) {
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

export function wbsLabel(s: Schedule, id: string | null): string {
  const path = wbsPath(s, id);
  return path.length ? path.map((w) => w.name).join(" › ") : "No WBS";
}

export function addWbs(s: Schedule, parentId: string | null, name = "New WBS"): { s: Schedule; id: string } {
  const sibs = s.wbs.filter((w) => w.parentId === parentId);
  const parent = parentId ? s.wbs.find((w) => w.id === parentId) : null;
  const code = `${parent ? `${parent.code}.` : ""}${sibs.length + 1}`;
  const w: Wbs = { id: uid("w"), parentId, code, name };
  return { s: { ...s, wbs: [...s.wbs, w] }, id: w.id };
}

export function updateWbs(s: Schedule, id: string, patch: Partial<Wbs>): Schedule {
  // A node can't move under itself or its own descendants.
  if (patch.parentId) {
    let cur: string | null = patch.parentId;
    while (cur) {
      if (cur === id) return s;
      cur = s.wbs.find((w) => w.id === cur)?.parentId ?? null;
    }
  }
  return { ...s, wbs: s.wbs.map((w) => (w.id === id ? { ...w, ...patch } : w)) };
}

/** Remove a WBS node; its activities and children move up to its parent. */
export function removeWbs(s: Schedule, id: string): Schedule {
  const w = s.wbs.find((x) => x.id === id);
  if (!w) return s;
  return {
    ...s,
    wbs: s.wbs.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: w.parentId } : x)),
    acts: s.acts.map((a) => (a.wbsId === id ? { ...a, wbsId: w.parentId } : a)),
  };
}

export function moveWbs(s: Schedule, id: string, dir: -1 | 1): Schedule {
  const w = s.wbs.find((x) => x.id === id);
  if (!w) return s;
  const sibs = s.wbs.filter((x) => x.parentId === w.parentId);
  const other = sibs[sibs.indexOf(w) + dir];
  if (!other) return s;
  const wbs = [...s.wbs];
  const ia = wbs.indexOf(w);
  const ib = wbs.indexOf(other);
  wbs[ia] = other;
  wbs[ib] = w;
  return { ...s, wbs };
}

/** Every WBS node in tree order, with its depth, for pickers. */
export function wbsOptions(s: Schedule): Array<{ w: Wbs; depth: number }> {
  const out: Array<{ w: Wbs; depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const w of s.wbs.filter((x) => x.parentId === parent)) {
      out.push({ w, depth });
      walk(w.id, depth + 1);
    }
  };
  walk(null, 0);
  // Orphans whose parent is missing still get listed.
  for (const w of s.wbs) if (!out.some((o) => o.w === w)) out.push({ w, depth: 0 });
  return out;
}

/* ---------------------------------------------------------------------------
 * Gantt rows
 * ------------------------------------------------------------------------- */

export type GanttRow = { kind: "wbs"; w: Wbs; depth: number; roll: Roll; hidden: number } | { kind: "act"; c: Calc; depth: number };

/**
 * The WBS tree flattened into rows: each node, then its own activities, then
 * its children. With a filter, WBS nodes appear only when something under them
 * matches, and flat drops the WBS bands entirely.
 */
export function ganttRows(s: Schedule, r: Result, collapsed: Set<string>, keep?: (c: Calc) => boolean, flat = false): GanttRow[] {
  const byWbs = new Map<string | null, Calc[]>();
  const known = new Set(s.wbs.map((w) => w.id));
  for (const c of r.list) {
    if (keep && !keep(c)) continue;
    const k = c.a.wbsId && known.has(c.a.wbsId) ? c.a.wbsId : null;
    byWbs.set(k, [...(byWbs.get(k) ?? []), c]);
  }
  if (flat) return [...byWbs.values()].flat().sort((a, b) => r.list.indexOf(a) - r.list.indexOf(b)).map((c) => ({ kind: "act" as const, c, depth: 0 }));
  const kids = new Map<string | null, Wbs[]>();
  for (const w of s.wbs) {
    const p = w.parentId && known.has(w.parentId) ? w.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), w]);
  }
  const count = (id: string): number => (byWbs.get(id)?.length ?? 0) + (kids.get(id) ?? []).reduce((t, w) => t + count(w.id), 0);
  const out: GanttRow[] = [];
  for (const c of byWbs.get(null) ?? []) out.push({ kind: "act", c, depth: 0 });
  const walk = (parent: string | null, depth: number) => {
    for (const w of kids.get(parent) ?? []) {
      const n = count(w.id);
      if (keep && !n) continue;
      const roll = r.wbs.get(w.id);
      if (!roll) continue;
      const shut = collapsed.has(w.id);
      out.push({ kind: "wbs", w, depth, roll, hidden: shut ? n : 0 });
      if (shut) continue;
      for (const c of byWbs.get(w.id) ?? []) out.push({ kind: "act", c, depth: depth + 1 });
      walk(w.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
