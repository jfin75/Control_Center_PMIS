/** What changed between two schedule updates, matched by activity ID the way
 *  an Owner's scheduler reviews a contractor's monthly submission: finish
 *  movement, added and deleted work, duration and logic edits, and actual
 *  dates rewritten in the past. */

import { dayNum, isoValid } from "./calendar";
import { compute, type Result } from "./cpm";
import { relText } from "./edit";
import type { Activity, Schedule } from "./types";

export type ChangeKind = "added" | "deleted" | "duration" | "logic" | "slipped" | "gained" | "actuals" | "constraint" | "renamed";

export const CHANGE_KINDS: Record<ChangeKind, { label: string; tone: "neg" | "warn" | "pos" | "neutral" | "info" }> = {
  slipped: { label: "Finish slipped", tone: "neg" },
  gained: { label: "Finish gained", tone: "pos" },
  added: { label: "Added", tone: "info" },
  deleted: { label: "Deleted", tone: "warn" },
  duration: { label: "Duration changed", tone: "warn" },
  logic: { label: "Logic changed", tone: "warn" },
  constraint: { label: "Constraint changed", tone: "warn" },
  actuals: { label: "Past actuals edited", tone: "neg" },
  renamed: { label: "Renamed", tone: "neutral" },
};

export interface ActChange {
  code: string;
  name: string;
  kinds: ChangeKind[];
  /** Id in the newer update, if the activity is still there. */
  id: string | null;
  before: { finish: string; dur: number; preds: string; tf: number | null } | null;
  after: { finish: string; dur: number; preds: string; tf: number | null } | null;
  /** Calendar days the finish moved; positive is later. */
  moved: number | null;
  longest: boolean;
}

export interface Comparison {
  a: Schedule;
  b: Schedule;
  ra: Result;
  rb: Result;
  /** Calendar days the project finish moved from a to b. */
  finishMoved: number;
  changes: ActChange[];
  counts: Record<ChangeKind, number>;
}

/** Days a finish may move before it counts as a change worth reviewing. */
const NOISE = 0;

export function compare(a: Schedule, b: Schedule): Comparison {
  const ra = compute(a);
  const rb = compute(b);
  const key = (x: Activity) => x.code.trim().toUpperCase();
  const mapA = new Map(a.acts.map((x) => [key(x), x]));
  const mapB = new Map(b.acts.map((x) => [key(x), x]));
  const codeA = new Map(a.acts.map((x) => [x.id, x.code]));
  const codeB = new Map(b.acts.map((x) => [x.id, x.code]));
  const predsOf = (s: Schedule, codes: Map<string, string>, id: string) =>
    s.rels
      .filter((r) => r.succ === id && codes.has(r.pred))
      .map((r) => relText(r, codes.get(r.pred)!.toUpperCase()))
      .sort()
      .join(", ");
  const snap = (s: Schedule, r: Result, codes: Map<string, string>, x: Activity) => {
    const c = r.byId.get(x.id)!;
    return { finish: c.finish, dur: x.dur, preds: predsOf(s, codes, x.id), tf: c.tf };
  };

  const changes: ActChange[] = [];
  for (const [k, xb] of mapB) {
    const xa = mapA.get(k);
    const cb = rb.byId.get(xb.id)!;
    const after = snap(b, rb, codeB, xb);
    if (!xa) {
      changes.push({ code: xb.code, name: xb.name, kinds: ["added"], id: xb.id, before: null, after, moved: null, longest: cb.longest });
      continue;
    }
    const before = snap(a, ra, codeA, xa);
    const kinds: ChangeKind[] = [];
    const moved = dayNum(after.finish) - dayNum(before.finish);
    if (moved > NOISE) kinds.push("slipped");
    if (moved < -NOISE) kinds.push("gained");
    if (xa.dur !== xb.dur) kinds.push("duration");
    if (before.preds !== after.preds) kinds.push("logic");
    const cons = (x: Activity) => (x.cons ? `${x.cons.type} ${x.cons.date}` : "");
    if (cons(xa) !== cons(xb)) kinds.push("constraint");
    // Actuals the earlier update already reported shouldn't move afterwards.
    const pastEdited = (v1: string | null | undefined, v2: string | null | undefined) => isoValid(v1) && v1 < a.dataDate && v1 !== v2;
    if (pastEdited(xa.as, xb.as) || pastEdited(xa.af, xb.af)) kinds.push("actuals");
    if (xa.name.trim() !== xb.name.trim()) kinds.push("renamed");
    if (kinds.length) changes.push({ code: xb.code, name: xb.name, kinds, id: xb.id, before, after, moved, longest: cb.longest });
  }
  for (const [k, xa] of mapA) {
    if (mapB.has(k)) continue;
    changes.push({ code: xa.code, name: xa.name, kinds: ["deleted"], id: null, before: snap(a, ra, codeA, xa), after: null, moved: null, longest: false });
  }

  const counts = Object.fromEntries(Object.keys(CHANGE_KINDS).map((k) => [k, 0])) as Record<ChangeKind, number>;
  for (const c of changes) for (const k of c.kinds) counts[k]++;
  changes.sort((x, y) => Number(y.longest) - Number(x.longest) || (y.moved ?? 0) - (x.moved ?? 0) || x.code.localeCompare(y.code));

  return { a, b, ra, rb, finishMoved: dayNum(rb.finish) - dayNum(ra.finish), changes, counts };
}
