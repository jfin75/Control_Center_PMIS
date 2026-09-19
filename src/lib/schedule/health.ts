/** Schedule quality checks an Owner runs on every contractor update, after
 *  the DCMA 14-point assessment. Each check reports the activities that fail
 *  it, so the Gantt can filter straight to them. */

import { dayNum, isoValid } from "./calendar";
import type { Result } from "./cpm";
import type { Schedule } from "./types";

export interface Check {
  id: string;
  label: string;
  /** What it measures and why an Owner cares. */
  about: string;
  /** "12 of 240 (5.0%)" or "0.92". */
  value: string;
  target: string;
  pass: boolean;
  /** Activities that fail it. */
  ids: string[];
  /** Not enough data to judge (no baseline, nothing complete yet). */
  na?: boolean;
}

/** DCMA's thresholds, in working days. */
export const HIGH_FLOAT = 44;
export const HIGH_DURATION = 44;

const share = (n: number, of: number) => `${n} of ${of}${of ? ` (${((n / of) * 100).toFixed(1)}%)` : ""}`;

export function healthChecks(s: Schedule, r: Result): Check[] {
  const open = r.list.filter((c) => c.status !== "complete");
  const openTasks = open.filter((c) => c.a.type === "task");
  const ids = new Set(s.acts.map((a) => a.id));
  const rels = s.rels.filter((x) => ids.has(x.pred) && ids.has(x.succ));
  const openIds = new Set(open.map((c) => c.a.id));
  const openRels = rels.filter((x) => openIds.has(x.succ));
  const hasPred = new Set(rels.map((x) => x.succ));
  const hasSucc = new Set(rels.map((x) => x.pred));

  // Open ends: only the project's first start and last finish may lack logic.
  const first = open.filter((c) => !hasPred.has(c.a.id)).sort((a, b) => a.es - b.es)[0];
  const last = open.filter((c) => !hasSucc.has(c.a.id)).sort((a, b) => b.ef - a.ef)[0];
  const missing = open.filter((c) => (!hasPred.has(c.a.id) && c !== first && c.status === "planned") || (!hasSucc.has(c.a.id) && c !== last));
  const leads = openRels.filter((x) => x.lag < 0);
  const lags = openRels.filter((x) => x.lag > 0);
  const nonFs = openRels.filter((x) => x.type !== "FS");
  const hard = open.filter((c) => c.a.cons && ["MSO", "MFO", "SNLT", "FNLT"].includes(c.a.cons.type));
  const highFloat = open.filter((c) => (c.tf ?? 0) > HIGH_FLOAT);
  const negFloat = open.filter((c) => (c.tf ?? 0) < 0);
  const highDur = openTasks.filter((c) => c.a.dur > HIGH_DURATION);
  const dd = s.dataDate;
  const invalid = r.list.filter(
    (c) => (isoValid(c.a.as) && c.a.as >= dd) || (isoValid(c.a.af) && c.a.af >= dd) || (c.status === "planned" && isoValid(c.start) && dayNum(c.start) < dayNum(dd)),
  );
  const withBl = r.list.filter((c) => c.a.bl && isoValid(c.a.bl.f));
  const dueByDD = withBl.filter((c) => c.a.bl!.f < dd);
  const missed = dueByDD.filter((c) => c.status !== "complete" || (isoValid(c.a.af) && c.a.af > c.a.bl!.f));
  const doneOfDue = dueByDD.filter((c) => c.status === "complete").length;
  const bei = dueByDD.length ? doneOfDue / dueByDD.length : null;

  // Critical path length index: how much of the remaining critical path the float to the target could absorb.
  const target = r.deadline ?? r.blFinish;
  const cpl = r.cal.span(dd, r.finish);
  const floatToTarget = target ? r.cal.end(target) - r.cal.end(r.finish) : null;
  const cpli = target && cpl > 0 && floatToTarget !== null ? (cpl + floatToTarget) / cpl : null;

  const rel2acts = (list: typeof rels) => [...new Set(list.map((x) => x.succ))];
  const pctPass = (n: number, of: number, max: number) => !of || n / of <= max;

  return [
    {
      id: "logic",
      label: "Missing logic",
      about: "Open activities without a predecessor or a successor. Dangling ends let dates float free of the work that drives them.",
      value: share(missing.length, open.length),
      target: "≤ 5%",
      pass: pctPass(missing.length, open.length, 0.05),
      ids: missing.map((c) => c.a.id),
    },
    {
      id: "leads",
      label: "Leads",
      about: "Relationships with negative lag. A lead lets a successor start before its predecessor finishes without saying what work allows it.",
      value: share(leads.length, openRels.length),
      target: "0",
      pass: leads.length === 0,
      ids: rel2acts(leads),
    },
    {
      id: "lags",
      label: "Lags",
      about: "Relationships with positive lag. Lags hide work (cure, review, delivery) that should be its own activity.",
      value: share(lags.length, openRels.length),
      target: "≤ 5%",
      pass: pctPass(lags.length, openRels.length, 0.05),
      ids: rel2acts(lags),
    },
    {
      id: "types",
      label: "Relationship types",
      about: "Share of relationships that aren't finish-to-start. Heavy use of SS and FF makes the critical path hard to follow.",
      value: `${openRels.length ? (((openRels.length - nonFs.length) / openRels.length) * 100).toFixed(1) : "100.0"}% FS`,
      target: "≥ 90% FS",
      pass: pctPass(nonFs.length, openRels.length, 0.1),
      ids: rel2acts(nonFs),
    },
    {
      id: "constraints",
      label: "Hard constraints",
      about: "Mandatory and 'no later than' constraints override logic, so the schedule can't show the real effect of a delay.",
      value: share(hard.length, open.length),
      target: "≤ 5%",
      pass: pctPass(hard.length, open.length, 0.05),
      ids: hard.map((c) => c.a.id),
    },
    {
      id: "high-float",
      label: "High float",
      about: `Open activities with more than ${HIGH_FLOAT} working days of total float, usually a sign of missing successors.`,
      value: share(highFloat.length, open.length),
      target: "≤ 5%",
      pass: pctPass(highFloat.length, open.length, 0.05),
      ids: highFloat.map((c) => c.a.id),
    },
    {
      id: "neg-float",
      label: "Negative float",
      about: "Open activities forecast to miss the contract completion date or a constraint. Each one needs a recovery plan.",
      value: share(negFloat.length, open.length),
      target: "0",
      pass: negFloat.length === 0,
      ids: negFloat.map((c) => c.a.id),
    },
    {
      id: "high-duration",
      label: "High duration",
      about: `Open tasks longer than ${HIGH_DURATION} working days. Long tasks are hard to status and hide their own sequence.`,
      value: share(highDur.length, openTasks.length),
      target: "≤ 5%",
      pass: pctPass(highDur.length, openTasks.length, 0.05),
      ids: highDur.map((c) => c.a.id),
    },
    {
      id: "invalid-dates",
      label: "Invalid dates",
      about: "Actual dates on or after the data date, or planned work still sitting before it. Either one means the update wasn't statused cleanly.",
      value: String(invalid.length),
      target: "0",
      pass: invalid.length === 0,
      ids: invalid.map((c) => c.a.id),
    },
    {
      id: "missed",
      label: "Missed activities",
      about: "Activities baselined to finish before the data date that finished late or haven't finished.",
      value: dueByDD.length ? share(missed.length, dueByDD.length) : "No baseline due yet",
      target: "≤ 5%",
      pass: pctPass(missed.length, dueByDD.length, 0.05),
      ids: missed.map((c) => c.a.id),
      na: !dueByDD.length,
    },
    {
      id: "bei",
      label: "Baseline execution index",
      about: "Activities finished ÷ activities the baseline said would be finished by the data date. Below 0.95 means work is falling behind plan.",
      value: bei === null ? "—" : bei.toFixed(2),
      target: "≥ 0.95",
      pass: bei === null || bei >= 0.95,
      ids: dueByDD.filter((c) => c.status !== "complete").map((c) => c.a.id),
      na: bei === null,
    },
    {
      id: "cpli",
      label: "Critical path length index",
      about: "(Remaining critical path + float to the contract completion) ÷ remaining critical path. Below 0.95 means the finish is unlikely without recovery.",
      value: cpli === null ? "—" : cpli.toFixed(2),
      target: "≥ 0.95",
      pass: cpli === null || cpli >= 0.95,
      ids: r.longest,
      na: cpli === null,
    },
    {
      id: "cp-test",
      label: "Critical path test",
      about: "The longest path must run back from the finish to work under way, with no loops in the logic.",
      value: r.loops.length ? `${r.loops.length} loop${r.loops.length === 1 ? "" : "s"}` : r.longest.length ? `${r.longest.length} activities` : "No path",
      target: "Continuous, no loops",
      pass: r.loops.length === 0 && (r.longest.length > 0 || open.length === 0),
      ids: r.loops.length ? rel2acts(r.loops) : r.longest,
    },
  ];
}

/** Failing checks in the order an Owner should raise them: finish risk first, hygiene last. */
const PRIORITY = ["neg-float", "cpli", "bei", "missed", "cp-test", "invalid-dates", "logic", "constraints", "leads", "high-float", "high-duration", "lags", "types"];
export const worstFirst = (checks: Check[]) => checks.filter((c) => !c.pass && !c.na).sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id));

export function healthScore(checks: Check[]): { passed: number; of: number } {
  const judged = checks.filter((c) => !c.na);
  return { passed: judged.filter((c) => c.pass).length, of: judged.length };
}
