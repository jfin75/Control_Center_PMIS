/** Submittal model: status, ball in court, schedule float, and the KPI
 *  roll-ups on the Submittals view. Every figure on that view comes from here,
 *  and every change a user makes goes through the actions at the bottom. */

import { addDays, daysBetween, parseISO } from "./format";
import { CONTRACTORS, PEOPLE, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import {
  LONG_LEAD_WEEKS,
  RESUBMIT_DAYS,
  REVIEW_ACTIONS,
  SUBMITTAL_PACKAGES,
  SUBMITTALS,
  scheduleAllowance,
  stepAllotments,
  type Party,
  type ReviewAction,
  type Revision,
  type Submittal,
  type SubmittalPackage,
  type SubmittalType,
} from "@/mock/submittals";

export type Tone = "pos" | "warn" | "neg" | "info" | "neutral" | "accent";

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------- */

/** The four KPI buckets partition the register: remaining = toSubmit + open + rejected. */
export type Bucket = "toSubmit" | "open" | "rejected" | "closed";

export const BUCKETS: Record<Bucket, { label: string; short: string; color: string; tone: Tone }> = {
  closed: { label: "Closed", short: "Closed", color: "var(--c-teal-500)", tone: "pos" },
  open: { label: "In review", short: "Open", color: "var(--c-cobalt-500)", tone: "accent" },
  rejected: { label: "Rejected, awaiting resubmittal", short: "Rejected", color: "var(--c-coral-500)", tone: "neg" },
  toSubmit: { label: "To be submitted", short: "To submit", color: "var(--c-slate-400)", tone: "neutral" },
};
export const BUCKET_ORDER: Bucket[] = ["closed", "open", "rejected", "toSubmit"];

export type StatusKey = "notSubmitted" | "draft" | "inReview" | "revise" | "rejected" | "approved" | "approvedNoted" | "record";

export const STATUS: Record<StatusKey, { label: string; tone: Tone }> = {
  notSubmitted: { label: "Not submitted", tone: "neutral" },
  draft: { label: "Draft package", tone: "neutral" },
  inReview: { label: "In review", tone: "accent" },
  revise: { label: "Revise & resubmit", tone: "warn" },
  rejected: { label: "Rejected", tone: "neg" },
  approved: { label: "Approved", tone: "pos" },
  approvedNoted: { label: "Approved as noted", tone: "pos" },
  record: { label: "For record", tone: "info" },
};

const ACTION_STATUS: Record<ReviewAction, StatusKey> = { A: "approved", B: "approvedNoted", C: "revise", D: "rejected", E: "record" };

export const number = (s: Submittal) => `${s.section}-${String(s.seq).padStart(2, "0")}`;

/* ---------------------------------------------------------------------------
 * Parties
 * ------------------------------------------------------------------------- */

export function partyName(p: Party | { kind: "firm" | "staff"; id: string }): string {
  if (p.kind === "staff") return PEOPLE.find((x) => x.id === p.id)?.name ?? p.id;
  return CONTRACTORS.find((x) => x.id === p.id)?.name ?? p.id;
}

export function firmName(id: string): string {
  return CONTRACTORS.find((x) => x.id === id)?.name ?? id;
}

export type Side = "contractor" | "design" | "owner";
export const SIDE_LABEL: Record<Side, string> = { contractor: "Contractor", design: "Design team", owner: "Owner" };

/* ---------------------------------------------------------------------------
 * Rows: one derived record per register item
 * ------------------------------------------------------------------------- */

export interface Row {
  s: Submittal;
  number: string;
  /** Latest revision sent, or null before the first submittal. */
  last: Revision | null;
  /** Revision number the next or current transmittal carries. */
  rev: number;
  status: StatusKey;
  bucket: Bucket;
  /** Who has to act next; null once closed. */
  ball: { kind: "firm" | "staff"; id: string; name: string; side: Side; role: string } | null;
  /** Index of the step holding the ball while in review. */
  step: number | null;
  submitBy: string;
  /** Latest approval that still holds the on-site date. */
  approvalNeeded: string;
  forecastApproval: string;
  /** Days between forecast approval and the approval needed; negative puts the on-site date at risk. */
  float: number;
  /** Days past the deadline that applies now (submit-by, review due, or resubmittal due). */
  late: number;
  daysInReview: number | null;
  /** Days the current reviewer has held it, against their share of the review period. */
  heldDays: number | null;
  share: number | null;
  closedOn: string | null;
  draft: SubmittalPackage | null;
  longLead: boolean;
}

export function submitByOf(s: Submittal): string {
  return addDays(s.requiredOnSite, -(s.leadWeeks * 7 + s.reviewDays + scheduleAllowance(s.leadWeeks, s.reviewDays)));
}

export function currentStep(r: Revision): number | null {
  if (r.action) return null;
  const i = r.steps.findIndex((st) => !st.date);
  return i < 0 ? null : i;
}

const max = (a: string, b: string) => (a > b ? a : b);

export function rowOf(s: Submittal, drafts: Map<string, SubmittalPackage>): Row {
  const last = s.revisions[s.revisions.length - 1] ?? null;
  const draft = drafts.get(s.id) ?? null;
  const submitBy = submitByOf(s);
  const approvalNeeded = addDays(s.requiredOnSite, -s.leadWeeks * 7);
  const project = projectById(s.projectId)!;
  const contractorBall = { kind: "firm" as const, id: s.byId, name: firmName(s.byId), side: "contractor" as Side, role: s.byId === project.gcId ? "General contractor" : "Trade contractor" };

  let status: StatusKey;
  let bucket: Bucket;
  let ball: Row["ball"] = null;
  let step: number | null = null;
  let forecastApproval: string;
  let late = 0;
  let daysInReview: number | null = null;
  let heldDays: number | null = null;
  let share: number | null = null;
  let closedOn: string | null = null;

  if (!last) {
    status = draft ? "draft" : "notSubmitted";
    bucket = "toSubmit";
    ball = contractorBall;
    forecastApproval = addDays(max(submitBy, TODAY), s.reviewDays);
    late = Math.max(0, daysBetween(submitBy, TODAY));
  } else if (!last.action) {
    status = "inReview";
    bucket = "open";
    step = currentStep(last);
    const party = last.steps[step ?? 0]!.party;
    ball = { kind: party.kind, id: party.id, name: partyName(party), side: party.kind === "staff" ? "owner" : "design", role: party.role };
    forecastApproval = max(last.due, TODAY);
    late = Math.max(0, daysBetween(last.due, TODAY));
    daysInReview = daysBetween(last.submitted, TODAY);
    if (step !== null) {
      heldDays = daysBetween(step > 0 ? last.steps[step - 1]!.date! : last.submitted, TODAY);
      share = stepAllotments(last.steps.map((st) => st.party), daysBetween(last.submitted, last.due))[step]!;
    }
  } else if (!REVIEW_ACTIONS[last.action].closes) {
    status = draft ? "draft" : ACTION_STATUS[last.action];
    bucket = "rejected";
    ball = contractorBall;
    const resubmitDue = addDays(last.returned!, RESUBMIT_DAYS);
    forecastApproval = addDays(max(resubmitDue, TODAY), s.reviewDays);
    late = Math.max(0, daysBetween(resubmitDue, TODAY));
  } else {
    status = ACTION_STATUS[last.action];
    bucket = "closed";
    forecastApproval = last.returned!;
    closedOn = last.returned!;
  }

  return {
    s,
    number: number(s),
    last,
    rev: !last ? 0 : bucket === "rejected" ? last.rev + 1 : last.rev,
    status,
    bucket,
    ball,
    step,
    submitBy,
    approvalNeeded,
    forecastApproval,
    float: daysBetween(forecastApproval, approvalNeeded),
    late,
    daysInReview,
    heldDays,
    share,
    closedOn,
    draft,
    longLead: s.leadWeeks >= LONG_LEAD_WEEKS,
  };
}

export function draftIndex(pkgs: SubmittalPackage[]): Map<string, SubmittalPackage> {
  const m = new Map<string, SubmittalPackage>();
  for (const p of pkgs) if (!p.transmitted) for (const i of p.items) m.set(i.submittalId, p);
  return m;
}

export function rowsOf(subs: Submittal[], pkgs: SubmittalPackage[]): Row[] {
  const drafts = draftIndex(pkgs);
  return subs.map((s) => rowOf(s, drafts));
}

/** A row is "at risk" when it is still open and its forecast approval eats past the float. */
export const atRisk = (r: Row) => r.bucket !== "closed" && r.s.leadWeeks > 0 && r.float < 0;

/* ---------------------------------------------------------------------------
 * KPIs
 * ------------------------------------------------------------------------- */

export interface Kpis {
  total: number;
  closed: number;
  open: number;
  rejected: number;
  toSubmit: number;
  remaining: number;
  pctComplete: number;
  openOverdue: number;
  avgDaysInReview: number;
  rejectedHard: number;
  rejectedLate: number;
  toSubmitLate: number;
  /** Returns stamped C or D over the life of the register. */
  returnsRejected: number;
  returns: number;
  /** Share of first submittals (Rev 0) that closed without a resubmittal. */
  firstPass: number;
  atRisk: Row[];
}

export function kpis(rows: Row[]): Kpis {
  const by = (b: Bucket) => rows.filter((r) => r.bucket === b);
  const open = by("open");
  const rejected = by("rejected");
  const toSubmit = by("toSubmit");
  const closed = by("closed").length;
  const revs = rows.flatMap((r) => r.s.revisions.filter((v) => v.action));
  const firsts = rows.map((r) => r.s.revisions[0]).filter((v): v is Revision => !!v?.action);
  return {
    total: rows.length,
    closed,
    open: open.length,
    rejected: rejected.length,
    toSubmit: toSubmit.length,
    remaining: rows.length - closed,
    pctComplete: rows.length ? closed / rows.length : 0,
    openOverdue: open.filter((r) => r.late > 0).length,
    avgDaysInReview: open.length ? open.reduce((a, r) => a + (r.daysInReview ?? 0), 0) / open.length : 0,
    rejectedHard: rejected.filter((r) => r.last?.action === "D").length,
    rejectedLate: rejected.filter((r) => r.late > 0).length,
    toSubmitLate: toSubmit.filter((r) => r.late > 0).length,
    returnsRejected: revs.filter((v) => !REVIEW_ACTIONS[v.action!].closes).length,
    returns: revs.length,
    firstPass: firsts.length ? firsts.filter((v) => REVIEW_ACTIONS[v.action!].closes).length / firsts.length : 0,
    atRisk: rows.filter(atRisk).sort((a, b) => a.float - b.float),
  };
}

export function bucketCounts(rows: Row[]): Record<Bucket, number> {
  const c: Record<Bucket, number> = { closed: 0, open: 0, rejected: 0, toSubmit: 0 };
  for (const r of rows) c[r.bucket]++;
  return c;
}

/* ---------------------------------------------------------------------------
 * Trends and breakdowns
 * ------------------------------------------------------------------------- */

const monthEnd = (iso: string) => {
  const d = parseISO(iso);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
};

export interface BurnPoint {
  month: string;
  planned: number;
  submitted: number | null;
  closed: number | null;
}

/** Cumulative planned submittals against actual first submittals and closures, by month end. */
export function burnup(rows: Row[]): BurnPoint[] {
  if (!rows.length) return [];
  const planned = rows.map((r) => r.submitBy).sort();
  const firsts = rows.map((r) => r.s.revisions[0]?.submitted).filter((d): d is string => !!d).sort();
  const closes = rows.map((r) => r.closedOn).filter((d): d is string => !!d).sort();
  const start = [planned[0]!, firsts[0] ?? planned[0]!].sort()[0]!;
  const end = max(planned[planned.length - 1]!, TODAY);
  const out: BurnPoint[] = [];
  const count = (xs: string[], d: string) => xs.filter((x) => x <= d).length;
  for (let m = monthEnd(start); ; m = monthEnd(addDays(m, 1))) {
    const past = m <= monthEnd(TODAY);
    const at = m > TODAY ? TODAY : m;
    out.push({ month: m, planned: count(planned, m), submitted: past ? count(firsts, at) : null, closed: past ? count(closes, at) : null });
    if (m >= end) break;
  }
  return out;
}

export const AGE_BANDS = [
  { label: "0–7 days", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–21", max: 21 },
  { label: "22–28", max: 28 },
  { label: "29+", max: Number.POSITIVE_INFINITY },
];

export function aging(rows: Row[]): Array<{ label: string; onTime: number; overdue: number }> {
  const open = rows.filter((r) => r.bucket === "open");
  let lo = -1;
  return AGE_BANDS.map((b) => {
    const inBand = open.filter((r) => (r.daysInReview ?? 0) > lo && (r.daysInReview ?? 0) <= b.max);
    lo = b.max;
    return { label: b.label, onTime: inBand.filter((r) => r.late === 0).length, overdue: inBand.filter((r) => r.late > 0).length };
  });
}

export interface BallRow {
  id: string;
  name: string;
  side: Side;
  toSubmit: number;
  open: number;
  rejected: number;
  late: number;
  total: number;
}

export function ballInCourt(rows: Row[]): BallRow[] {
  const m = new Map<string, BallRow>();
  for (const r of rows) {
    if (!r.ball) continue;
    const cur = m.get(r.ball.id) ?? { id: r.ball.id, name: r.ball.name, side: r.ball.side, toSubmit: 0, open: 0, rejected: 0, late: 0, total: 0 };
    if (r.bucket === "toSubmit") cur.toSubmit++;
    if (r.bucket === "open") cur.open++;
    if (r.bucket === "rejected") cur.rejected++;
    if (r.late > 0) cur.late++;
    cur.total++;
    m.set(r.ball.id, cur);
  }
  return [...m.values()].sort((a, b) => b.late - a.late || b.total - a.total);
}

export interface ReviewerRow {
  id: string;
  name: string;
  side: Side;
  role: string;
  completed: number;
  avgDays: number;
  onTime: number;
  openNow: number;
  overdueNow: number;
}

/**
 * Days each reviewer held a submittal (from the previous step, or from
 * transmittal), and how often they returned it within their share of the
 * review period. Overdue now counts items a reviewer holds past that share.
 */
export function reviewerPerformance(rows: Row[]): ReviewerRow[] {
  const m = new Map<string, ReviewerRow & { sum: number; ontimeN: number }>();
  const get = (p: Party) =>
    m.get(p.id) ??
    m.set(p.id, { id: p.id, name: partyName(p), side: p.kind === "staff" ? "owner" : "design", role: p.kind === "staff" ? "Owner review" : p.role, completed: 0, avgDays: 0, onTime: 0, openNow: 0, overdueNow: 0, sum: 0, ontimeN: 0 }).get(p.id)!;
  for (const r of rows) {
    for (const v of r.s.revisions) {
      const allot = stepAllotments(v.steps.map((st) => st.party), daysBetween(v.submitted, v.due));
      let prev = v.submitted;
      v.steps.forEach((st, i) => {
        if (!st.date) return;
        const g = get(st.party);
        const held = Math.max(0, daysBetween(prev, st.date));
        g.completed++;
        g.sum += held;
        if (held <= allot[i]!) g.ontimeN++;
        prev = st.date;
      });
    }
    if (r.bucket === "open" && r.last && r.step !== null) {
      const g = get(r.last.steps[r.step]!.party);
      g.openNow++;
      if ((r.heldDays ?? 0) > (r.share ?? 0)) g.overdueNow++;
    }
  }
  return [...m.values()]
    .map(({ sum, ontimeN, ...g }) => ({ ...g, avgDays: g.completed ? sum / g.completed : 0, onTime: g.completed ? ontimeN / g.completed : 0 }))
    .sort((a, b) => b.openNow - a.openNow || b.completed - a.completed);
}

/* ---------------------------------------------------------------------------
 * Packages
 * ------------------------------------------------------------------------- */

export type PackageStatus = "draft" | "inReview" | "partial" | "returned";
export const PACKAGE_STATUS: Record<PackageStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  inReview: { label: "In review", tone: "accent" },
  partial: { label: "Partly returned", tone: "warn" },
  returned: { label: "Returned", tone: "pos" },
};

export interface PackageRow {
  p: SubmittalPackage;
  status: PackageStatus;
  due: string | null;
  late: number;
  returned: number;
  /** Count of each action stamped on this package's revisions. */
  actions: Partial<Record<ReviewAction, number>>;
  resubmit: number;
  returnedOn: string | null;
}

export function packageRow(p: SubmittalPackage, subsById: Map<string, Submittal>): PackageRow {
  const revs = p.items.map((i) => subsById.get(i.submittalId)?.revisions.find((v) => v.packageId === p.id)).filter((v): v is Revision => !!v);
  const returned = revs.filter((v) => v.action);
  const actions: PackageRow["actions"] = {};
  for (const v of returned) actions[v.action!] = (actions[v.action!] ?? 0) + 1;
  const due = p.transmitted ? addDays(p.transmitted, p.reviewDays) : null;
  const status: PackageStatus = !p.transmitted ? "draft" : returned.length === 0 ? "inReview" : returned.length < p.items.length ? "partial" : "returned";
  // Resubmittals still owed: rejected revisions from this package that are still the latest.
  const resubmit = p.items.filter((i) => {
    const s = subsById.get(i.submittalId);
    const last = s?.revisions[s.revisions.length - 1];
    return last?.packageId === p.id && last.action && !REVIEW_ACTIONS[last.action].closes;
  }).length;
  return {
    p,
    status,
    due,
    late: due && status !== "returned" ? Math.max(0, daysBetween(due, TODAY)) : 0,
    returned: returned.length,
    actions,
    resubmit,
    returnedOn: status === "returned" ? returned.map((v) => v.returned!).sort().at(-1)! : null,
  };
}

/* ---------------------------------------------------------------------------
 * State: the seeded register plus whatever the user has changed
 * ------------------------------------------------------------------------- */

export interface Store {
  subs: Record<string, Submittal>;
  pkgs: Record<string, SubmittalPackage | null>;
}

export const EMPTY_STORE: Store = { subs: {}, pkgs: {} };

export function merged(store: Store): { subs: Submittal[]; pkgs: SubmittalPackage[] } {
  const baseIds = new Set(SUBMITTALS.map((s) => s.id));
  const basePkgIds = new Set(SUBMITTAL_PACKAGES.map((p) => p.id));
  const subs = [...SUBMITTALS.map((s) => store.subs[s.id] ?? s), ...Object.values(store.subs).filter((s) => !baseIds.has(s.id))];
  const pkgs = [
    ...SUBMITTAL_PACKAGES.map((p) => (p.id in store.pkgs ? store.pkgs[p.id] : p)),
    ...Object.entries(store.pkgs)
      .filter(([id]) => !basePkgIds.has(id))
      .map(([, p]) => p),
  ].filter((p): p is SubmittalPackage => !!p);
  return { subs, pkgs };
}

export function nextPackageNumber(projectId: string, pkgs: SubmittalPackage[]): string {
  const n = pkgs.filter((p) => p.projectId === projectId).reduce((a, p) => Math.max(a, Number(p.number.replace(/\D/g, "")) || 0), 0);
  return `SP-${String(n + 1).padStart(3, "0")}`;
}

let uid = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(uid++).toString(36)}`;

export interface PackageDraft {
  projectId: string;
  title: string;
  byId: string;
  reviewDays: number;
  reviewers: Party[];
  note: string;
  items: Array<{ submittalId: string; response?: string }>;
}

/**
 * Save or transmit a package. Transmitting stamps a new revision on every item:
 * Rev 0 for first submittals, the next revision for anything returned C or D.
 */
export function savePackage(
  draft: PackageDraft,
  opts: { transmit: boolean; existing?: SubmittalPackage | null; subs: Submittal[]; pkgs: SubmittalPackage[] },
): { pkg: SubmittalPackage; subs: Submittal[] } {
  const byId = new Map(opts.subs.map((s) => [s.id, s]));
  const items = draft.items.map((i) => {
    const s = byId.get(i.submittalId)!;
    const last = s.revisions[s.revisions.length - 1];
    return { submittalId: s.id, rev: last ? last.rev + 1 : 0, response: last ? i.response?.trim() || undefined : undefined };
  });
  const pkg: SubmittalPackage = {
    id: opts.existing?.id ?? newId(`${draft.projectId}:sp`),
    number: opts.existing?.number ?? nextPackageNumber(draft.projectId, opts.pkgs),
    projectId: draft.projectId,
    title: draft.title.trim(),
    created: opts.existing?.created ?? TODAY,
    transmitted: opts.transmit ? TODAY : null,
    reviewDays: draft.reviewDays,
    items,
    reviewers: draft.reviewers,
    note: draft.note.trim(),
    byId: draft.byId,
  };
  if (!opts.transmit) return { pkg, subs: [] };
  const due = addDays(TODAY, draft.reviewDays);
  const changed = items.map((i) => {
    const s = byId.get(i.submittalId)!;
    const rev: Revision = { rev: i.rev, packageId: pkg.id, submitted: TODAY, due, steps: draft.reviewers.map((party) => ({ party })), response: i.response };
    return { ...s, revisions: [...s.revisions, rev] };
  });
  return { pkg, subs: changed };
}

/** The most restrictive action governs: D over C over B over A; E only when every step is E. */
export function governing(actions: ReviewAction[]): ReviewAction {
  return actions.reduce<ReviewAction>((g, a) => (REVIEW_ACTIONS[a].severity > REVIEW_ACTIONS[g].severity ? a : g), "E");
}

/**
 * Record the current reviewer's action. The route moves to the next reviewer,
 * or returns to the contractor when it is the last step or `returnNow` is set.
 */
export function recordReview(s: Submittal, input: { action: ReviewAction; comments: string; returnNow: boolean }): Submittal {
  const last = s.revisions[s.revisions.length - 1]!;
  const i = currentStep(last);
  if (i === null) return s;
  const steps = last.steps.map((st, j) => (j === i ? { ...st, action: input.action, date: TODAY, comments: input.comments.trim() || undefined } : st));
  const finished = input.returnNow || i === steps.length - 1;
  const rev: Revision = finished
    ? { ...last, steps, returned: TODAY, action: governing(steps.filter((st) => st.action).map((st) => st.action!)) }
    : { ...last, steps };
  return { ...s, revisions: [...s.revisions.slice(0, -1), rev] };
}

export interface ItemInput {
  projectId: string;
  section: string;
  sectionTitle: string;
  title: string;
  type: SubmittalType;
  byId: string;
  requiredOnSite: string;
  leadWeeks: number;
  reviewDays: number;
  reviewers: Party[];
}

export function createItem(input: ItemInput, subs: Submittal[]): Submittal {
  const seq = subs.filter((s) => s.projectId === input.projectId && s.section === input.section).reduce((a, s) => Math.max(a, s.seq), 0) + 1;
  return {
    id: newId(`${input.projectId}:${input.section.replace(/\s/g, "")}`),
    projectId: input.projectId,
    section: input.section.trim(),
    sectionTitle: input.sectionTitle.trim(),
    seq,
    title: input.title.trim(),
    type: input.type,
    byId: input.byId,
    requiredOnSite: input.requiredOnSite,
    leadWeeks: input.leadWeeks,
    reviewDays: input.reviewDays,
    reviewers: input.reviewers,
    revisions: [],
  };
}

/** Submit-by for a prospective item, so the add form can show it before saving. */
export function submitByFor(requiredOnSite: string, leadWeeks: number, reviewDays: number): string {
  return addDays(requiredOnSite, -(leadWeeks * 7 + reviewDays + scheduleAllowance(leadWeeks, reviewDays)));
}
