/** Workload model: turns every active project and planning request into
 *  projected Owner PM hours per week, then rolls them up against each PM's
 *  capacity. Every figure on the Workload view comes from here. */

import { chain } from "./budget";
import { addDays, daysBetween } from "./format";
import { PEOPLE, TODAY, type Person } from "@/mock/org";
import { PIPELINE, type PipelineItem } from "@/mock/planning";
import { PROJECTS, type Phase, type Project } from "@/mock/projects";
import { WEEK_START } from "@/mock/workspace";
import {
  ARCHETYPE_FACTOR,
  AT_CAPACITY,
  HOLIDAYS,
  HORIZON_WEEKS,
  LEAVE,
  NON_PROJECT_SHARE,
  PHASE_HOURS,
  PHASE_WEIGHT,
  PIPELINE_PM,
  PM_STAFF,
  PROJECT_HOURS_PER_FTE,
  SIZE_BANDS,
  STANDARD_WEEK,
  type StaffCapacity,
  type WorkPhase,
} from "@/mock/workload";

/** Monday of each week in the planning horizon, starting with the current week. */
export const WEEKS: string[] = Array.from({ length: HORIZON_WEEKS }, (_, i) => addDays(WEEK_START, i * 7));

const DELIVERY: Phase[] = ["Preconstruction", "Design", "Procurement", "Construction", "Closeout"];

interface Segment {
  phase: WorkPhase;
  from: string;
  to: string; // exclusive
}

export interface WorkItem {
  id: string;
  kind: "project" | "planning";
  code: string;
  name: string;
  propertyId: string;
  href: string;
  budget: number;
  start: string;
  finish: string;
  basePmId: string | null;
  sizeFactor: number;
  sizeLabel: string;
  typeFactor: number;
  typeLabel: string;
  /** Phase in each week of the horizon; null when the work has not started or is finished. */
  phases: Array<WorkPhase | null>;
  /** Model hours per week, before any user adjustment. */
  weekly: number[];
}

const round05 = (n: number) => Math.round(n * 2) / 2;

function sizeBand(budget: number) {
  return SIZE_BANDS.find((b) => budget < b.upTo) ?? SIZE_BANDS[SIZE_BANDS.length - 1]!;
}

/** Split the time left on an active project across its remaining phases by standard phase length. */
function projectSegments(p: Project): Segment[] {
  const rest = DELIVERY.slice(DELIVERY.indexOf(p.phase));
  // The current phase is assumed to be half done.
  const weights = rest.map((ph, i) => PHASE_WEIGHT[ph] * (i === 0 ? 0.5 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(14, daysBetween(TODAY, p.forecastFinish));
  let cursor = TODAY;
  return rest.map((phase, i) => {
    const to = i === rest.length - 1 ? addDays(TODAY, span) : addDays(TODAY, Math.round((span * weights.slice(0, i + 1).reduce((a, b) => a + b, 0)) / total));
    const seg = { phase, from: cursor, to };
    cursor = to;
    return seg;
  });
}

/** Planning requests follow their own target dates: board approval, design, construction, occupancy. */
function pipelineSegments(x: PipelineItem): Segment[] {
  const t = x.targets;
  const designDays = daysBetween(t.designStart, t.constructionStart);
  const bidStart = addDays(t.designStart, Math.round(designDays * 0.8));
  return [
    { phase: x.stage, from: TODAY, to: t.board },
    { phase: "Preconstruction", from: t.board, to: t.designStart },
    { phase: "Design", from: t.designStart, to: bidStart },
    { phase: "Procurement", from: bidStart, to: t.constructionStart },
    { phase: "Construction", from: t.constructionStart, to: t.occupancy },
    { phase: "Closeout", from: t.occupancy, to: addDays(t.occupancy, 84) },
  ];
}

function spread(segments: Segment[], factor: number) {
  const phases = WEEKS.map((w) => {
    const mid = addDays(w, 2);
    return segments.find((s) => s.from <= mid && mid < s.to)?.phase ?? null;
  });
  const weekly = phases.map((ph) => (ph ? round05(PHASE_HOURS[ph] * factor) : 0));
  return { phases, weekly };
}

const TYPE_LABEL = { fitout: "Clinical fit-out", infrastructure: "Infrastructure", equipment: "Equipment", office: "Office / admin" } as const;

function fromProject(p: Project): WorkItem {
  const budget = chain(p.totals).C;
  const band = sizeBand(budget);
  const typeFactor = ARCHETYPE_FACTOR[p.archetype];
  return {
    id: p.id,
    kind: "project",
    code: p.code,
    name: p.name,
    propertyId: p.propertyId,
    href: `/projects/${p.id}/`,
    budget,
    start: p.start,
    finish: p.forecastFinish,
    basePmId: p.pmId,
    sizeFactor: band.factor,
    sizeLabel: band.label,
    typeFactor,
    typeLabel: TYPE_LABEL[p.archetype],
    ...spread(projectSegments(p), band.factor * typeFactor),
  };
}

function fromPipeline(x: PipelineItem): WorkItem {
  const band = sizeBand(x.requested);
  return {
    id: x.id,
    kind: "planning",
    code: "Request",
    name: x.title,
    propertyId: x.propertyId,
    href: `/planning/?item=${x.id}`,
    budget: x.requested,
    start: x.targets.designStart,
    finish: x.targets.occupancy,
    basePmId: PIPELINE_PM[x.id] ?? null,
    sizeFactor: band.factor,
    sizeLabel: band.label,
    typeFactor: 1,
    typeLabel: "Not yet typed",
    ...spread(pipelineSegments(x), band.factor),
  };
}

export const WORK_ITEMS: WorkItem[] = [...PROJECTS.map(fromProject), ...PIPELINE.map(fromPipeline)];

/* ------------------------------------------------------------------ Plan */

/** The user's changes on top of the recorded assignments: who leads what, and adjusted effort. */
export interface Plan {
  assign: Record<string, string | null>;
  scale: Record<string, number>;
}

export const EMPTY_PLAN: Plan = { assign: {}, scale: {} };

export function pmOf(item: WorkItem, plan: Plan): string | null {
  return item.id in plan.assign ? (plan.assign[item.id] ?? null) : item.basePmId;
}

export function hoursOf(item: WorkItem, plan: Plan): number[] {
  const f = plan.scale[item.id] ?? 1;
  return f === 1 ? item.weekly : item.weekly.map((h) => round05(h * f));
}

export const peakOf = (hours: number[]) => hours.reduce((a, b) => Math.max(a, b), 0);

/* -------------------------------------------------------------- Capacity */

export function capacityFor(s: StaffCapacity): number[] {
  return WEEKS.map((w) => {
    const holiday = HOLIDAYS.filter((h) => h.week === w).reduce((a, h) => a + h.hours, 0) * s.fte;
    const leave = LEAVE.filter((l) => l.personId === s.personId && l.week === w).reduce((a, l) => a + l.hours, 0);
    return round05(Math.max(0, STANDARD_WEEK * s.fte - holiday - leave) * (1 - NON_PROJECT_SHARE));
  });
}

export function leaveNote(personId: string, week: string): string | null {
  const parts = [
    ...HOLIDAYS.filter((h) => h.week === week).map((h) => h.label),
    ...LEAVE.filter((l) => l.personId === personId && l.week === week).map((l) => `${l.hours} h leave`),
  ];
  return parts.length ? parts.join(", ") : null;
}

/* ------------------------------------------------------------- Roll-ups */

export interface Assigned {
  item: WorkItem;
  hours: number[];
}

export interface StaffLoad extends StaffCapacity {
  person: Person;
  capacity: number[];
  load: number[];
  items: Assigned[];
}

export interface Workload {
  staff: StaffLoad[];
  unassigned: Assigned[];
  unassignedLoad: number[];
}

const zeros = () => WEEKS.map(() => 0);

function sumInto(target: number[], hours: number[]) {
  for (let i = 0; i < target.length; i++) target[i]! += hours[i] ?? 0;
}

export function computeWorkload(plan: Plan, items: WorkItem[] = WORK_ITEMS): Workload {
  const staff: StaffLoad[] = PM_STAFF.map((s) => ({
    ...s,
    person: PEOPLE.find((p) => p.id === s.personId)!,
    capacity: capacityFor(s),
    load: zeros(),
    items: [],
  }));
  const unassigned: Assigned[] = [];
  const unassignedLoad = zeros();
  for (const item of items) {
    const hours = hoursOf(item, plan);
    // Nothing left to do inside the horizon: not part of anyone's workload.
    if (peakOf(hours) === 0) continue;
    const s = staff.find((x) => x.personId === pmOf(item, plan));
    if (s) {
      s.items.push({ item, hours });
      sumInto(s.load, hours);
    } else {
      unassigned.push({ item, hours });
      sumInto(unassignedLoad, hours);
    }
  }
  for (const s of staff) s.items.sort((a, b) => (b.hours[0] ?? 0) - (a.hours[0] ?? 0) || peakOf(b.hours) - peakOf(a.hours));
  return { staff, unassigned, unassignedLoad };
}

export type LoadStatus = "over" | "at" | "available";

export function statusOf(util: number): LoadStatus {
  if (util > 1) return "over";
  if (util >= AT_CAPACITY) return "at";
  return "available";
}

export interface TeamSnapshot {
  week: string;
  assigned: number;
  capacity: number;
  unassigned: number;
  unassignedCount: number;
  over: number;
  overCount: number;
  spare: number;
  spareCount: number;
  /** Demand, assigned or not, beyond team capacity, in FTE. Negative means spare. */
  netGapFte: number;
}

export function teamAt(wl: Workload, w: number): TeamSnapshot {
  let assigned = 0;
  let capacity = 0;
  let over = 0;
  let overCount = 0;
  let spare = 0;
  let spareCount = 0;
  for (const s of wl.staff) {
    const d = s.load[w] ?? 0;
    const c = s.capacity[w] ?? 0;
    assigned += d;
    capacity += c;
    if (d > c) {
      over += d - c;
      overCount++;
    }
    if (d < c) spare += c - d;
    if (c > 0 && d < c * AT_CAPACITY) spareCount++;
  }
  const unassigned = wl.unassignedLoad[w] ?? 0;
  return {
    week: WEEKS[w]!,
    assigned,
    capacity,
    unassigned,
    unassignedCount: wl.unassigned.filter((u) => (u.hours[w] ?? 0) > 0).length,
    over,
    overCount,
    spare,
    spareCount,
    netGapFte: (assigned + unassigned - capacity) / PROJECT_HOURS_PER_FTE,
  };
}

/** Weeks in the rolling window used for peaks, so one holiday or leave week does not read as a crisis. */
export const WINDOW = 4;

const windowSum = (arr: number[], w: number) => arr.slice(w, w + WINDOW).reduce((a, b) => a + b, 0);

/** Worst 4-week stretch for the team, from the given week to the end of the horizon, in FTE. */
export function peakGap(wl: Workload, from = 0): { week: number; fte: number } {
  let best = { week: from, fte: Number.NEGATIVE_INFINITY };
  for (let w = from; w <= WEEKS.length - WINDOW; w++) {
    let demand = windowSum(wl.unassignedLoad, w);
    let capacity = 0;
    for (const s of wl.staff) {
      demand += windowSum(s.load, w);
      capacity += windowSum(s.capacity, w);
    }
    const fte = (demand - capacity) / WINDOW / PROJECT_HOURS_PER_FTE;
    if (fte > best.fte) best = { week: w, fte };
  }
  return best;
}

/** A PM's worst 4-week utilization over the horizon. */
export function peakUtil(load: number[], capacity: number[]): { week: number; util: number } {
  let best = { week: 0, util: 0 };
  for (let w = 0; w <= WEEKS.length - WINDOW; w++) {
    const util = windowSum(load, w) / Math.max(1, windowSum(capacity, w));
    if (util > best.util) best = { week: w, util };
  }
  return best;
}

/**
 * Place unassigned work on the PM whose peak 4-week utilization stays lowest,
 * skipping anyone it would push past capacity or past their project limit.
 * Work that fits nowhere stays unassigned: that is the hiring gap.
 */
export function suggestAssignments(plan: Plan): { plan: Plan; placed: Array<{ itemId: string; pmId: string }>; unplaced: string[] } {
  const wl = computeWorkload(plan);
  const load = new Map(wl.staff.map((s) => [s.personId, [...s.load]]));
  const held = new Map(wl.staff.map((s) => [s.personId, s.items.map((a) => a.hours)]));
  const queue = [...wl.unassigned].sort((a, b) => peakOf(b.hours) - peakOf(a.hours));
  const next: Plan = { assign: { ...plan.assign }, scale: plan.scale };
  const placed: Array<{ itemId: string; pmId: string }> = [];
  const unplaced: string[] = [];

  for (const u of queue) {
    let pick: { id: string; peak: number; count: number } | null = null;
    for (const s of wl.staff) {
      const l = load.get(s.personId)!;
      const peak = peakUtil(
        l.map((x, w) => x + (u.hours[w] ?? 0)),
        s.capacity,
      ).util;
      if (peak > 1) continue;
      // Concurrent projects in the weeks this work is live.
      const count = held.get(s.personId)!.filter((hrs) => hrs.some((h, w) => h > 0 && (u.hours[w] ?? 0) > 0)).length;
      if (count >= s.maxProjects) continue;
      if (!pick || peak < pick.peak - 0.01 || (Math.abs(peak - pick.peak) <= 0.01 && count < pick.count)) pick = { id: s.personId, peak, count };
    }
    if (pick) {
      next.assign[u.item.id] = pick.id;
      sumInto(load.get(pick.id)!, u.hours);
      held.get(pick.id)!.push(u.hours);
      placed.push({ itemId: u.item.id, pmId: pick.id });
    } else unplaced.push(u.item.id);
  }
  return { plan: next, placed, unplaced };
}
