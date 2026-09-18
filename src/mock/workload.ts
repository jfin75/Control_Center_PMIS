/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  PM capacity, planned leave, and the effort standards the Workload view
 *  uses to turn a project's phase and size into hours per week. Replace with
 *  Workday FTE/leave feeds and the PMO's own staffing standards. */

import type { Archetype, Phase } from "./projects";
import type { StageGate } from "./planning";

export type WorkPhase = StageGate | Phase;

/** Owner PM hours per week, for a mid-size project, by phase. */
export const PHASE_HOURS: Record<WorkPhase, number> = {
  Intake: 1,
  Conceptual: 2,
  Feasibility: 4,
  Estimating: 6,
  Preconstruction: 8,
  Design: 12,
  Procurement: 12,
  Construction: 20,
  Closeout: 8,
};

/** Size multiplier by total approved budget (C), or requested amount for planning items. */
export const SIZE_BANDS: Array<{ upTo: number; factor: number; label: string }> = [
  { upTo: 2_000_000, factor: 0.5, label: "Under $2M" },
  { upTo: 5_000_000, factor: 0.7, label: "$2M–$5M" },
  { upTo: 15_000_000, factor: 0.9, label: "$5M–$15M" },
  { upTo: 40_000_000, factor: 1.15, label: "$15M–$40M" },
  { upTo: Number.POSITIVE_INFINITY, factor: 1.4, label: "$40M and over" },
];

/** Complexity multiplier by project type. Occupied clinical fit-outs carry the most coordination. */
export const ARCHETYPE_FACTOR: Record<Archetype, number> = {
  fitout: 1.15,
  infrastructure: 1.1,
  equipment: 0.9,
  office: 0.8,
};

/** Relative length of each delivery phase, used to project when an active project moves on. */
export const PHASE_WEIGHT: Record<Phase, number> = {
  Preconstruction: 1,
  Design: 3,
  Procurement: 1.5,
  Construction: 6,
  Closeout: 1,
};

export const STANDARD_WEEK = 40;
/** Share of a PM's week that goes to non-project work: program admin, training, meetings. */
export const NON_PROJECT_SHARE = 0.15;
/** Project hours one full-time PM can carry in a normal week (40 h less non-project time). */
export const PROJECT_HOURS_PER_FTE = STANDARD_WEEK * (1 - NON_PROJECT_SHARE);

export const AT_CAPACITY = 0.85;

export interface StaffCapacity {
  personId: string;
  fte: number;
  /** Hard limit on concurrent projects the PMO lets this person lead. */
  maxProjects: number;
}

export const PM_STAFF: StaffCapacity[] = [
  { personId: "u-reyes", fte: 1, maxProjects: 4 },
  { personId: "u-novak", fte: 1, maxProjects: 4 },
  { personId: "u-tran", fte: 1, maxProjects: 4 },
  { personId: "u-haddad", fte: 1, maxProjects: 4 },
  { personId: "u-mensah", fte: 1, maxProjects: 5 },
  { personId: "u-farah", fte: 0.8, maxProjects: 3 },
];

/** Organization holidays: hours off in the week beginning on the given Monday. */
export const HOLIDAYS: Array<{ week: string; hours: number; label: string }> = [
  { week: "2026-11-09", hours: 8, label: "Veterans Day" },
  { week: "2026-11-23", hours: 16, label: "Thanksgiving" },
  { week: "2026-12-21", hours: 8, label: "Christmas Day" },
  { week: "2026-12-28", hours: 8, label: "New Year’s Day" },
  { week: "2027-01-18", hours: 8, label: "MLK Jr. Day" },
  { week: "2027-02-15", hours: 8, label: "Presidents’ Day" },
  { week: "2027-05-31", hours: 8, label: "Memorial Day" },
  { week: "2027-06-14", hours: 8, label: "Juneteenth" },
  { week: "2027-07-05", hours: 8, label: "Independence Day" },
  { week: "2027-09-06", hours: 8, label: "Labor Day" },
];

/** Approved personal leave: hours off in the week beginning on the given Monday. */
export const LEAVE: Array<{ personId: string; week: string; hours: number }> = [
  { personId: "u-novak", week: "2026-10-12", hours: 40 },
  { personId: "u-reyes", week: "2026-11-23", hours: 24 },
  { personId: "u-haddad", week: "2026-12-21", hours: 32 },
  { personId: "u-haddad", week: "2026-12-28", hours: 32 },
  { personId: "u-tran", week: "2027-03-22", hours: 40 },
  { personId: "u-mensah", week: "2027-04-12", hours: 40 },
  { personId: "u-mensah", week: "2027-04-19", hours: 40 },
  { personId: "u-farah", week: "2027-02-01", hours: 32 },
  { personId: "u-reyes", week: "2027-07-19", hours: 40 },
  { personId: "u-reyes", week: "2027-07-26", hours: 40 },
];

/** Planning requests that already have a PM lined up. Everything else in the pipeline is unassigned. */
export const PIPELINE_PM: Record<string, string> = {
  "pl-ehs-cath": "u-reyes",
  "pl-hmc-elev": "u-tran",
  "pl-lasc-steril": "u-farah",
  "pl-cmp-mob": "u-farah",
  "pl-gh-imaging": "u-farah",
};

/** Weeks projected forward from the current week. */
export const HORIZON_WEEKS = 52;
