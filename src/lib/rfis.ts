/** RFI model: stage, ball in court, response time, cost and schedule
 *  exposure, and the KPI roll-ups on the RFIs view. Every figure on that view
 *  comes from here, and every change a user makes goes through the actions at
 *  the bottom, which append to the RFI's thread so the history stays whole. */

import { addDays, daysBetween, fmtDate, parseISO } from "./format";
import { CONTRACTORS, PEOPLE, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import {
  IMPACT_LABEL,
  PRIORITIES,
  RFIS,
  rfiNumber,
  type Attachment,
  type Entry,
  type EntryKind,
  type ImpactLevel,
  type Rfi,
  type RfiDiscipline,
  type RfiPriority,
  type Who,
} from "@/mock/rfis";

export type Tone = "pos" | "warn" | "neg" | "info" | "neutral" | "accent";

/* ---------------------------------------------------------------------------
 * Stage
 * ------------------------------------------------------------------------- */

/** Where an RFI stands. Open RFIs split three ways by who holds the ball. */
export type Stage = "draft" | "awaiting" | "info" | "answered" | "closed" | "void";

export const STAGES: Record<Stage, { label: string; short: string; tone: Tone; color: string }> = {
  closed: { label: "Closed", short: "Closed", tone: "pos", color: "var(--c-teal-500)" },
  answered: { label: "Answered, not closed", short: "Answered", tone: "info", color: "var(--c-sky-400)" },
  awaiting: { label: "Awaiting response", short: "Awaiting", tone: "accent", color: "var(--c-cobalt-500)" },
  info: { label: "Info requested", short: "Info requested", tone: "warn", color: "var(--c-amber-400)" },
  draft: { label: "Draft", short: "Draft", tone: "neutral", color: "var(--c-slate-400)" },
  void: { label: "Void", short: "Void", tone: "neutral", color: "var(--c-slate-400)" },
};
/** Issued, non-void stages in bar order. */
export const LIVE_STAGES: Stage[] = ["closed", "answered", "awaiting", "info"];

/* ---------------------------------------------------------------------------
 * Parties
 * ------------------------------------------------------------------------- */

export function whoName(w: Who): string {
  if (w.kind === "staff") return PEOPLE.find((x) => x.id === w.id)?.name ?? w.id;
  return CONTRACTORS.find((x) => x.id === w.id)?.name ?? w.id;
}

export type Side = "contractor" | "design" | "owner";
export const SIDE_LABEL: Record<Side, string> = { contractor: "Contractor", design: "Design team", owner: "Owner" };

export function sideOf(w: Who): Side {
  if (w.kind === "staff") return "owner";
  const k = CONTRACTORS.find((x) => x.id === w.id)?.kind;
  return k === "Design" || k === "Consultant" ? "design" : "contractor";
}

/** The party's role on the project team, or their firm type. */
export function whoRole(w: Who, projectId: string): string {
  const t = projectById(projectId)?.team.find((x) => x.refId === w.id);
  if (t) return t.role;
  if (w.kind === "staff") return PEOPLE.find((x) => x.id === w.id)?.title ?? "Owner";
  return CONTRACTORS.find((x) => x.id === w.id)?.kind ?? "";
}

export const sameWho = (a: Who | null | undefined, b: Who | null | undefined) => !!a && !!b && a.kind === b.kind && a.id === b.id;

/** Everyone who can post on a project's RFIs: the team, plus the originator if it is not on it. */
export function projectParties(projectId: string, extra: Who[] = []): Who[] {
  const p = projectById(projectId);
  if (!p) return extra;
  const team: Who[] = p.team.map((t) => ({ kind: t.kind, id: t.refId }));
  const all = [...team, { kind: "firm" as const, id: p.gcId }, ...extra];
  return all.filter((w, i) => all.findIndex((x) => sameWho(x, w)) === i);
}

/* ---------------------------------------------------------------------------
 * Timeline: who held the ball, and for how long
 * ------------------------------------------------------------------------- */

export interface Hold {
  who: Who;
  from: string;
  to: string;
  days: number;
  /** How the hold ended: an answer, a forward, a request for information, or still open. */
  end: "answered" | "forwarded" | "request" | "open";
}

/** The answer of record: the last official response since the RFI was last reopened or sent back. */
export function currentAnswer(r: Rfi): Entry | null {
  let hit: Entry | null = null;
  for (const e of r.entries) {
    if (e.kind === "return" || e.kind === "reopen") hit = null;
    if (e.kind === "response" && e.official) hit = e;
  }
  return hit;
}

/** Reviewer holds in order. The contractor's time answering a request for information is not counted against the reviewer. */
export function holds(r: Rfi): Hold[] {
  const out: Hold[] = [];
  let reviewer: Who = r.assignee;
  let holder: Who | null = null;
  let since = "";
  const end = (date: string, how: Hold["end"]) => {
    if (holder) out.push({ who: holder, from: since, to: date, days: Math.max(0, daysBetween(since, date)), end: how });
    holder = null;
  };
  const start = (w: Who, date: string) => {
    reviewer = w;
    holder = w;
    since = date;
  };
  // The issue entry names the first reviewer; forwards name the next.
  const firstTo = r.entries.find((e) => e.kind === "issue")?.to;
  if (firstTo) reviewer = firstTo;
  for (const e of r.entries) {
    switch (e.kind) {
      case "issue":
        start(e.to ?? reviewer, e.date);
        break;
      case "forward":
        end(e.date, "forwarded");
        if (e.to) start(e.to, e.date);
        break;
      case "request":
        end(e.date, "request");
        break;
      case "clarify":
        start(reviewer, e.date);
        break;
      case "response":
        if (e.official) end(e.date, "answered");
        break;
      case "return":
      case "reopen":
      case "restore":
        if (r.issued) start(e.to ?? reviewer, e.date);
        break;
      case "close":
      case "void":
        holder = null;
        break;
    }
  }
  if (holder && r.status === "open") end(TODAY, "open");
  return out;
}

/* ---------------------------------------------------------------------------
 * Rows: one derived record per RFI
 * ------------------------------------------------------------------------- */

export interface Row {
  r: Rfi;
  number: string;
  stage: Stage;
  /** Who has to act next; null once closed or void. */
  ball: { who: Who; name: string; side: Side; role: string; why: string } | null;
  answer: Entry | null;
  answeredOn: string | null;
  /** Days past the response due date while the RFI waits on a reviewer. */
  late: number;
  /** Issue to close, or to today while open. */
  daysOpen: number | null;
  /** Days the reviewers held it before the first answer, excluding time spent waiting on the contractor. */
  reviewDays: number | null;
  onTime: boolean | null;
  /** Days since the answer while the Owner has not closed it. */
  waitingClose: number | null;
  /** Estimated cost when the impact is possible or confirmed. */
  exposure: number;
  files: number;
  comments: number;
}

export function rowOf(r: Rfi): Row {
  const answer = r.status === "open" || r.status === "closed" ? currentAnswer(r) : null;
  const first = r.entries.find((e) => e.kind === "response" && e.official) ?? null;
  let stage: Stage;
  if (r.status === "draft") stage = "draft";
  else if (r.status === "void") stage = "void";
  else if (r.status === "closed") stage = "closed";
  else if (answer) stage = "answered";
  else stage = r.awaiting === "originator" ? "info" : "awaiting";

  const originator: Who = { kind: "firm", id: r.fromId };
  const manager: Who = { kind: "staff", id: r.managerId };
  const ballOf = (w: Who, why: string): Row["ball"] => ({ who: w, name: whoName(w), side: sideOf(w), role: whoRole(w, r.projectId), why });
  const ball =
    stage === "draft"
      ? ballOf(originator, "To issue")
      : stage === "awaiting"
        ? ballOf(r.assignee, "To respond")
        : stage === "info"
          ? ballOf(originator, "To provide information")
          : stage === "answered"
            ? ballOf(manager, "To close or return")
            : null;

  // Reviewer time up to the first answer.
  let reviewDays: number | null = null;
  if (first) {
    reviewDays = 0;
    for (const h of holds(r)) {
      if (h.from >= first.date) break;
      reviewDays += h.days;
      if (h.end === "answered") break;
    }
  }
  const allowed = PRIORITIES[r.priority].days;
  const files = r.files.length + r.entries.reduce((a, e) => a + (e.files?.length ?? 0), 0);

  return {
    r,
    number: rfiNumber(r),
    stage,
    ball,
    answer,
    answeredOn: answer?.date ?? null,
    late: stage === "awaiting" && r.due ? Math.max(0, daysBetween(r.due, TODAY)) : 0,
    daysOpen: r.issued && r.status !== "void" ? daysBetween(r.issued, r.closed ?? TODAY) : null,
    reviewDays,
    onTime: reviewDays === null ? null : reviewDays <= allowed,
    waitingClose: stage === "answered" && answer ? daysBetween(answer.date, TODAY) : null,
    exposure: r.status !== "void" && r.costImpact !== "none" ? (r.costEstimate ?? 0) : 0,
    files,
    comments: r.entries.filter((e) => e.kind === "comment").length,
  };
}

export const rowsOf = (rfis: Rfi[]): Row[] => rfis.map(rowOf);

export const isOpen = (x: Row) => x.stage === "awaiting" || x.stage === "info";
export const hasImpact = (x: Row) => x.stage !== "void" && x.stage !== "draft" && (x.r.costImpact !== "none" || x.r.scheduleImpact !== "none");
/** Confirmed cost with no PCO or change order to carry it: exposure the budget can't see yet. */
export const unlinked = (x: Row) => x.stage !== "void" && x.r.costImpact === "yes" && !x.r.changeRef;

/* ---------------------------------------------------------------------------
 * KPIs
 * ------------------------------------------------------------------------- */

export interface Kpis {
  issued: number;
  drafts: number;
  open: number;
  awaiting: number;
  info: number;
  overdue: number;
  answered: number;
  /** Answered more than a week ago and still not closed. */
  answeredStale: number;
  closed: number;
  voided: number;
  pctClosed: number;
  /** Average reviewer days to the first answer, over answers in the last 90 days. */
  avgReview: number;
  onTimeRate: number;
  recentAnswers: number;
  possible: number;
  confirmed: number;
  exposure: number;
  impactCount: number;
  scheduleDays: number;
  unlinked: number;
}

export function kpis(rows: Row[]): Kpis {
  const live = rows.filter((x) => x.stage !== "draft" && x.stage !== "void");
  const by = (s: Stage) => rows.filter((x) => x.stage === s).length;
  const since = addDays(TODAY, -90);
  const recent = rows.filter((x) => x.reviewDays !== null && (x.r.entries.find((e) => e.kind === "response" && e.official)?.date ?? "") >= since);
  const impacts = rows.filter(hasImpact);
  const closed = by("closed");
  return {
    issued: live.length,
    drafts: by("draft"),
    open: by("awaiting") + by("info"),
    awaiting: by("awaiting"),
    info: by("info"),
    overdue: rows.filter((x) => x.late > 0).length,
    answered: by("answered"),
    answeredStale: rows.filter((x) => (x.waitingClose ?? 0) > 7).length,
    closed,
    voided: by("void"),
    pctClosed: live.length ? closed / live.length : 0,
    avgReview: recent.length ? recent.reduce((a, x) => a + x.reviewDays!, 0) / recent.length : 0,
    onTimeRate: recent.length ? recent.filter((x) => x.onTime).length / recent.length : 0,
    recentAnswers: recent.length,
    possible: impacts.filter((x) => x.r.costImpact === "possible").reduce((a, x) => a + x.exposure, 0),
    confirmed: impacts.filter((x) => x.r.costImpact === "yes").reduce((a, x) => a + x.exposure, 0),
    exposure: impacts.reduce((a, x) => a + x.exposure, 0),
    impactCount: impacts.length,
    scheduleDays: impacts.reduce((a, x) => a + (x.r.scheduleImpact !== "none" ? (x.r.scheduleDays ?? 0) : 0), 0),
    unlinked: rows.filter(unlinked).length,
  };
}

export function stageCounts(rows: Row[]): Record<Stage, number> {
  const c: Record<Stage, number> = { draft: 0, awaiting: 0, info: 0, answered: 0, closed: 0, void: 0 };
  for (const x of rows) c[x.stage]++;
  return c;
}

/* ---------------------------------------------------------------------------
 * Trends and breakdowns
 * ------------------------------------------------------------------------- */

const monthKey = (iso: string) => iso.slice(0, 7);

export interface VolumePoint {
  month: string;
  issued: number;
  closed: number;
  /** Open at month end (or today, for this month). */
  backlog: number;
}

/** RFIs issued and closed by month, with the open backlog at each month end. */
export function volume(rows: Row[], months = 18): VolumePoint[] {
  const live = rows.filter((x) => x.r.issued && x.stage !== "void");
  if (!live.length) return [];
  const first = live.map((x) => x.r.issued!).sort()[0]!;
  const out: VolumePoint[] = [];
  const d = parseISO(TODAY);
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    if (key < monthKey(first)) continue;
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const at = endIso > TODAY ? TODAY : endIso;
    out.push({
      month: `${key}-01`,
      issued: live.filter((x) => monthKey(x.r.issued!) === key).length,
      closed: live.filter((x) => x.r.closed && monthKey(x.r.closed) === key).length,
      backlog: live.filter((x) => x.r.issued! <= at && (!x.r.closed || x.r.closed > at)).length,
    });
  }
  return out;
}

export const AGE_BANDS = [
  { label: "0–7 days", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61+", max: Number.POSITIVE_INFINITY },
];

/** Unanswered RFIs by days since issue, split by whether the response is past due. */
export function aging(rows: Row[]): Array<{ label: string; onTime: number; overdue: number; info: number }> {
  const open = rows.filter(isOpen);
  let lo = -1;
  return AGE_BANDS.map((b) => {
    const inBand = open.filter((x) => (x.daysOpen ?? 0) > lo && (x.daysOpen ?? 0) <= b.max);
    lo = b.max;
    return {
      label: b.label,
      onTime: inBand.filter((x) => x.stage === "awaiting" && x.late === 0).length,
      overdue: inBand.filter((x) => x.late > 0).length,
      info: inBand.filter((x) => x.stage === "info").length,
    };
  });
}

export interface BallRow {
  id: string;
  name: string;
  side: Side;
  count: number;
  late: number;
}

export function ballInCourt(rows: Row[]): BallRow[] {
  const m = new Map<string, BallRow>();
  for (const x of rows) {
    if (!x.ball || x.stage === "draft") continue;
    const cur = m.get(x.ball.who.id) ?? { id: x.ball.who.id, name: x.ball.name, side: x.ball.side, count: 0, late: 0 };
    cur.count++;
    if (x.late > 0 || (x.waitingClose ?? 0) > 7) cur.late++;
    m.set(x.ball.who.id, cur);
  }
  return [...m.values()].sort((a, b) => b.late - a.late || b.count - a.count);
}

export interface ReviewerRow {
  id: string;
  name: string;
  side: Side;
  answered: number;
  forwarded: number;
  avgDays: number;
  onTime: number;
  openNow: number;
  overdueNow: number;
}

/** How long each reviewer holds an RFI before answering or passing it on, against the requested response time. */
export function reviewerPerformance(rows: Row[]): ReviewerRow[] {
  const m = new Map<string, ReviewerRow & { sum: number; n: number; ok: number }>();
  for (const x of rows) {
    if (x.stage === "draft" || x.stage === "void") continue;
    const allowed = PRIORITIES[x.r.priority].days;
    for (const h of holds(x.r)) {
      const g = m.get(h.who.id) ?? { id: h.who.id, name: whoName(h.who), side: sideOf(h.who), answered: 0, forwarded: 0, avgDays: 0, onTime: 0, openNow: 0, overdueNow: 0, sum: 0, n: 0, ok: 0 };
      if (h.end === "open") {
        g.openNow++;
        if (h.days > allowed) g.overdueNow++;
      } else {
        if (h.end === "answered") g.answered++;
        if (h.end === "forwarded") g.forwarded++;
        g.n++;
        g.sum += h.days;
        if (h.days <= allowed) g.ok++;
      }
      m.set(h.who.id, g);
    }
  }
  return [...m.values()]
    .map(({ sum, n, ok, ...g }) => ({ ...g, avgDays: n ? sum / n : 0, onTime: n ? ok / n : 0 }))
    .filter((g) => g.side !== "contractor")
    .sort((a, b) => b.openNow - a.openNow || b.answered - a.answered);
}

export interface DisciplineRow {
  discipline: RfiDiscipline;
  total: number;
  open: number;
  overdue: number;
  exposure: number;
}

export function byDiscipline(rows: Row[]): DisciplineRow[] {
  const m = new Map<RfiDiscipline, DisciplineRow>();
  for (const x of rows) {
    if (x.stage === "draft" || x.stage === "void") continue;
    const d = x.r.discipline;
    const cur = m.get(d) ?? { discipline: d, total: 0, open: 0, overdue: 0, exposure: 0 };
    cur.total++;
    if (isOpen(x) || x.stage === "answered") cur.open++;
    if (x.late > 0) cur.overdue++;
    cur.exposure += x.exposure;
    m.set(d, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/* ---------------------------------------------------------------------------
 * State: the seeded logs plus whatever the user has changed
 * ------------------------------------------------------------------------- */

export interface Store {
  /** Changed or added RFIs by id; null deletes a seeded draft. */
  rfis: Record<string, Rfi | null>;
}

export const EMPTY_STORE: Store = { rfis: {} };

export function merged(store: Store): Rfi[] {
  const base = new Set(RFIS.map((r) => r.id));
  return [
    ...RFIS.map((r) => (r.id in store.rfis ? store.rfis[r.id] : r)),
    ...Object.entries(store.rfis)
      .filter(([id]) => !base.has(id))
      .map(([, r]) => r),
  ].filter((r): r is Rfi => !!r);
}

/** Every file id the user has added, so a reset can clear them from storage. */
export function storedFileIds(rfis: Rfi[]): string[] {
  return rfis.flatMap((r) => [...r.files, ...r.entries.flatMap((e) => e.files ?? [])]).filter((f) => f.stored).map((f) => f.id);
}

/* ---------------------------------------------------------------------------
 * Actions. Each returns a new RFI with an entry appended to its thread.
 * ------------------------------------------------------------------------- */

let uid = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(uid++).toString(36)}`;

function append(r: Rfi, kind: EntryKind, by: Who, extra: Partial<Entry> = {}): Rfi {
  const e: Entry = { id: newId(`${r.id}:e`), kind, date: TODAY, by, ...extra };
  if (e.text !== undefined) e.text = e.text.trim() || undefined;
  if (e.files && !e.files.length) delete e.files;
  return { ...r, entries: [...r.entries, e] };
}

const addTo = (list: Who[], w: Who) => (list.some((x) => sameWho(x, w)) ? list : [...list, w]);

export const dueFor = (priority: RfiPriority, from = TODAY) => addDays(from, PRIORITIES[priority].days);

export function nextSeq(projectId: string, rfis: Rfi[]): number {
  return rfis.filter((r) => r.projectId === projectId).reduce((a, r) => Math.max(a, r.seq), 0) + 1;
}

export interface RfiInput {
  projectId: string;
  subject: string;
  question: string;
  suggestion: string;
  discipline: RfiDiscipline;
  section: string;
  drawing: string;
  location: string;
  fromId: string;
  assignee: Who;
  distribution: Who[];
  priority: RfiPriority;
  due: string;
  costImpact: ImpactLevel;
  costEstimate: number | null;
  scheduleImpact: ImpactLevel;
  scheduleDays: number | null;
  files: Attachment[];
}

export function createRfi(input: RfiInput, opts: { issue: boolean; by: Who; rfis: Rfi[] }): Rfi {
  const p = projectById(input.projectId)!;
  const seq = nextSeq(input.projectId, opts.rfis);
  const opt = (s: string) => s.trim() || undefined;
  let dist = input.distribution;
  for (const w of [{ kind: "firm" as const, id: input.fromId }, input.assignee, { kind: "staff" as const, id: p.pmId }]) dist = addTo(dist, w);
  const r: Rfi = {
    id: newId(`${input.projectId}:rfi`),
    projectId: input.projectId,
    seq,
    subject: input.subject.trim(),
    question: input.question.trim(),
    suggestion: opt(input.suggestion),
    discipline: input.discipline,
    section: opt(input.section),
    drawing: opt(input.drawing),
    location: opt(input.location),
    fromId: input.fromId,
    managerId: p.pmId,
    assignee: input.assignee,
    distribution: dist,
    priority: input.priority,
    created: TODAY,
    issued: opts.issue ? TODAY : null,
    due: opts.issue ? input.due : null,
    status: opts.issue ? "open" : "draft",
    awaiting: "reviewer",
    closed: null,
    costImpact: input.costImpact,
    costEstimate: input.costImpact === "none" ? null : input.costEstimate,
    scheduleImpact: input.scheduleImpact,
    scheduleDays: input.scheduleImpact === "none" ? null : input.scheduleDays,
    files: input.files,
    entries: [],
  };
  return opts.issue ? append(r, "issue", opts.by, { to: input.assignee }) : r;
}

export function issueRfi(r: Rfi, x: { by: Who; assignee: Who; due: string; priority: RfiPriority }): Rfi {
  const next: Rfi = { ...r, status: "open", awaiting: "reviewer", issued: TODAY, due: x.due, priority: x.priority, assignee: x.assignee, distribution: addTo(r.distribution, x.assignee) };
  return append(next, "issue", x.by, { to: x.assignee });
}

export function respond(r: Rfi, x: { by: Who; text: string; official: boolean; files: Attachment[] }): Rfi {
  return append(r, "response", x.by, { text: x.text, official: x.official, files: x.files });
}

export function forward(r: Rfi, x: { by: Who; to: Who; text: string; due: string }): Rfi {
  return append({ ...r, assignee: x.to, due: x.due, awaiting: "reviewer", distribution: addTo(r.distribution, x.to) }, "forward", x.by, { to: x.to, text: x.text });
}

export function requestInfo(r: Rfi, x: { by: Who; text: string; files: Attachment[] }): Rfi {
  return append({ ...r, awaiting: "originator" }, "request", x.by, { text: x.text, files: x.files });
}

/** The contractor answers a request for information; the reviewer's clock restarts. */
export function clarify(r: Rfi, x: { by: Who; text: string; files: Attachment[] }): Rfi {
  return append({ ...r, awaiting: "reviewer", due: dueFor(r.priority) }, "clarify", x.by, { text: x.text, files: x.files });
}

export function comment(r: Rfi, x: { by: Who; text: string; files: Attachment[] }): Rfi {
  return append(r, "comment", x.by, { text: x.text, files: x.files });
}

export function addFiles(r: Rfi, x: { by: Who; files: Attachment[]; text?: string }): Rfi {
  return append(r, "files", x.by, { files: x.files, text: x.text });
}

/** The Owner does not accept the answer and sends it back to a reviewer. */
export function returnAnswer(r: Rfi, x: { by: Who; to: Who; text: string; due: string }): Rfi {
  return append({ ...r, assignee: x.to, due: x.due, awaiting: "reviewer", distribution: addTo(r.distribution, x.to) }, "return", x.by, { to: x.to, text: x.text });
}

export interface ImpactInput {
  costImpact: ImpactLevel;
  costEstimate: number | null;
  scheduleImpact: ImpactLevel;
  scheduleDays: number | null;
  changeRef: string;
}

const impactOf = (x: ImpactInput) => ({
  costImpact: x.costImpact,
  costEstimate: x.costImpact === "none" ? null : x.costEstimate,
  scheduleImpact: x.scheduleImpact,
  scheduleDays: x.scheduleImpact === "none" ? null : x.scheduleDays,
  changeRef: x.changeRef.trim() || undefined,
});

export function closeRfi(r: Rfi, x: { by: Who; text: string; impact: ImpactInput }): Rfi {
  return append({ ...r, status: "closed", closed: TODAY, ...impactOf(x.impact) }, "close", x.by, { text: x.text });
}

export function reopen(r: Rfi, x: { by: Who; to: Who; text: string; due: string }): Rfi {
  return append({ ...r, status: "open", closed: null, awaiting: "reviewer", assignee: x.to, due: x.due, distribution: addTo(r.distribution, x.to) }, "reopen", x.by, { to: x.to, text: x.text });
}

export function voidRfi(r: Rfi, x: { by: Who; text: string }): Rfi {
  return append({ ...r, status: "void", closed: TODAY }, "void", x.by, { text: x.text });
}

/** Bring a void RFI back: to the reviewer if it had been issued, otherwise to draft. */
export function restore(r: Rfi, x: { by: Who; text: string; due: string }): Rfi {
  const issued = !!r.issued;
  return append({ ...r, status: issued ? "open" : "draft", closed: null, awaiting: "reviewer", due: issued ? x.due : null }, "restore", x.by, { text: x.text, to: issued ? r.assignee : undefined });
}

export type Editable = Pick<Rfi, "subject" | "question" | "suggestion" | "discipline" | "section" | "drawing" | "location" | "priority" | "due" | "assignee" | "distribution" | "fromId"> & ImpactInput;

const EDIT_LABEL: Partial<Record<keyof Editable, string>> = {
  subject: "subject",
  question: "question",
  suggestion: "proposed solution",
  discipline: "discipline",
  section: "spec section",
  drawing: "drawing",
  location: "location",
  priority: "priority",
  due: "response due",
  assignee: "assignee",
  distribution: "distribution",
  fromId: "originator",
  costImpact: "cost impact",
  costEstimate: "cost estimate",
  scheduleImpact: "schedule impact",
  scheduleDays: "schedule days",
  changeRef: "change reference",
};

/** Save edited fields and log what changed. */
export function editRfi(r: Rfi, patch: Editable, by: Who): Rfi {
  const opt = (s: string | undefined) => s?.trim() || undefined;
  const next: Rfi = {
    ...r,
    subject: patch.subject.trim(),
    question: patch.question.trim(),
    suggestion: opt(patch.suggestion),
    discipline: patch.discipline,
    section: opt(patch.section),
    drawing: opt(patch.drawing),
    location: opt(patch.location),
    priority: patch.priority,
    due: r.status === "draft" ? r.due : patch.due,
    assignee: patch.assignee,
    distribution: addTo(patch.distribution, patch.assignee),
    fromId: patch.fromId,
    ...impactOf(patch),
  };
  const changed = (Object.keys(EDIT_LABEL) as Array<keyof Editable>).filter((k) => JSON.stringify(next[k as keyof Rfi] ?? null) !== JSON.stringify(r[k as keyof Rfi] ?? null));
  if (!changed.length) return r;
  const detail = changed.map((k) => {
    if (k === "due" && r.due && next.due) return `response due ${fmtDate(r.due)} → ${fmtDate(next.due)}`;
    if (k === "priority") return `priority ${PRIORITIES[r.priority].label} → ${PRIORITIES[next.priority].label}`;
    if (k === "assignee") return `assignee → ${whoName(next.assignee)}`;
    if (k === "costImpact") return `cost impact ${IMPACT_LABEL[r.costImpact]} → ${IMPACT_LABEL[next.costImpact]}`;
    if (k === "scheduleImpact") return `schedule impact ${IMPACT_LABEL[r.scheduleImpact]} → ${IMPACT_LABEL[next.scheduleImpact]}`;
    return EDIT_LABEL[k]!;
  });
  return append(next, "edit", by, { text: `Updated ${detail.join("; ")}.` });
}

/** Remove a file the user added, and log it. */
export function removeFile(r: Rfi, fileId: string, by: Who): Rfi {
  const all = [...r.files, ...r.entries.flatMap((e) => e.files ?? [])];
  const f = all.find((x) => x.id === fileId);
  if (!f) return r;
  const next: Rfi = {
    ...r,
    files: r.files.filter((x) => x.id !== fileId),
    entries: r.entries
      .map((e) => (e.files?.some((x) => x.id === fileId) ? { ...e, files: e.files.filter((x) => x.id !== fileId) } : e))
      // A files-only entry with nothing left in it says nothing; the removal line below keeps the history.
      .filter((e) => e.kind !== "files" || e.files?.length || e.text),
  };
  return append(next, "edit", by, { text: `Removed ${f.name}.` });
}
