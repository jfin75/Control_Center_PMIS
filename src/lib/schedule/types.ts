/** The schedule model. One Schedule is one version of one project's CPM
 *  network: a contractor's monthly update imported from P6, a Microsoft
 *  Project file, or a schedule built here. Durations and lags are in working
 *  days on the schedule's calendar; dates are ISO `YYYY-MM-DD`. Early and late
 *  dates, float, and the critical path are never stored: cpm.ts derives them. */

export type RelType = "FS" | "SS" | "FF" | "SF";
export type ActType = "task" | "start" | "finish";
export type ConstraintType = "SNET" | "SNLT" | "FNET" | "FNLT" | "MSO" | "MFO";

export interface Constraint {
  type: ConstraintType;
  date: string;
}

export interface Activity {
  /** Internal id; relationships point at this. */
  id: string;
  /** Activity ID as the scheduler wrote it, e.g. "A1040". */
  code: string;
  name: string;
  wbsId: string | null;
  type: ActType;
  /** Original duration in working days (0 for milestones). */
  dur: number;
  /** Remaining duration in working days, once started. Defaults to dur. */
  rem?: number;
  /** Physical % complete, 0–100. */
  pct?: number;
  /** Actual start and finish. */
  as?: string | null;
  af?: string | null;
  cons?: Constraint | null;
  /** Baseline start and finish. */
  bl?: { s: string; f: string } | null;
  /** Company or person responsible. */
  resp?: string;
  notes?: string;
  /** The name of the project-record milestone this activity reports as. */
  key?: string;
}

export interface Rel {
  id: string;
  pred: string;
  succ: string;
  type: RelType;
  /** Working days; negative is a lead. */
  lag: number;
}

export interface Wbs {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
}

export interface CalendarDef {
  name: string;
  /** Sunday first. */
  week: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  /** Non-working dates, sorted. */
  holidays: string[];
}

export type SourceKind = "native" | "template" | "p6-xer" | "p6-xml" | "msp-xml" | "csv";

export interface Source {
  kind: SourceKind;
  /** File name for imports, template name for templates. */
  label?: string;
  /** The project's name or ID inside the source file. */
  ref?: string;
  at: string;
  by: string;
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  source: Source;
  /** Progress is reported up to the start of this day. */
  dataDate: string;
  /** Planned start: nothing without progress or a predecessor starts before it. */
  start: string;
  /** Contract completion. Open ends are late-scheduled to it, so float measures against it. */
  deadline?: string | null;
  calendar: CalendarDef;
  wbs: Wbs[];
  acts: Activity[];
  rels: Rel[];
  /** What the baseline dates on the activities are. */
  baselineName?: string | null;
  updated: string;
}
