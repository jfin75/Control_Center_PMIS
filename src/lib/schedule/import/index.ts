/** Import entry point: pick the reader by file type, then turn a parsed
 *  project into a Schedule and check the recalculation against the file. */

import { CALENDAR_PRESETS, dayNum, isoValid, type CalendarPreset } from "../calendar";
import { compute } from "../cpm";
import type { CalendarDef, Schedule } from "../types";
import { uid } from "../edit";
import { ImportError, readText, type ImportSet, type Parsed } from "./common";
import { readCsv } from "./csv";
import { readXer } from "./xer";
import { readXml } from "./xml";

export { ImportError, type ImportSet, type Parsed } from "./common";

export const ACCEPT = ".xer,.xml,.csv,.tsv,.txt";

/** Largest file the browser is asked to parse. */
export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;

export async function readScheduleFile(file: File): Promise<ImportSet> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "mpp" || ext === "mpt")
    throw new ImportError("Microsoft Project .mpp files are a closed binary format. In Project, choose File › Save As, pick XML Format (*.xml), and import that file.");
  if (ext === "mpx") throw new ImportError("MPX is Project's retired text format. Save the schedule as XML (*.xml) from Microsoft Project and import that.");
  if (ext === "xls" || ext === "xlsx") throw new ImportError("Save the sheet as CSV (File › Save As › CSV UTF-8) and import that, or export XER or XML from the scheduling tool.");
  if (ext === "pdf") throw new ImportError("A PDF is a picture of a schedule, not the schedule. Ask for the native XER or XML file.");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(`The file is ${(file.size / 1024 / 1024).toFixed(0)} MB. Files over ${MAX_IMPORT_BYTES / 1024 / 1024} MB are too large to import in the browser.`);
  const text = await readText(file);
  const head = text.trimStart().slice(0, 400);
  if (ext === "xer" || head.startsWith("ERMHDR")) return readXer(file.name, text);
  if (ext === "xml" || head.startsWith("<?xml") || head.startsWith("<")) return readXml(file.name, text);
  return readCsv(file.name, text);
}

export interface ImportOptions {
  projectId: string;
  name: string;
  dataDate: string;
  /** Replace the file's calendar with a preset. */
  preset?: CalendarPreset | null;
  keepBaseline: boolean;
  by: string;
  at: string;
}

export function calendarFor(p: Parsed, preset: CalendarPreset | null | undefined, dataDate: string): CalendarDef {
  if (!preset && p.calendar) return p.calendar;
  const all = [p.start, dataDate, p.fileFinish, ...Object.values(p.fileDates).map((d) => d.f)].filter(isoValid);
  const y0 = Math.min(...all.map((d) => Number(d.slice(0, 4))));
  const y1 = Math.max(...all.map((d) => Number(d.slice(0, 4))));
  return CALENDAR_PRESETS[preset ?? "5day"].make(Number.isFinite(y0) ? y0 : 2025, Number.isFinite(y1) ? y1 + 2 : 2030);
}

/** The data date to offer: the file's own, else the day after the latest actual, else the earliest start. */
export function suggestedDataDate(p: Parsed, fallback: string): string {
  if (isoValid(p.dataDate)) return p.dataDate;
  const actuals = p.acts.flatMap((a) => [a.as, a.af]).filter(isoValid);
  if (actuals.length) {
    const last = actuals.reduce((m, x) => (x > m ? x : m));
    const d = new Date(dayNum(last) * 86_400_000 + 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return isoValid(p.start) ? p.start : fallback;
}

export function toSchedule(p: Parsed, o: ImportOptions): Schedule {
  const starts = [p.start, ...p.acts.map((a) => a.as), ...Object.values(p.fileDates).map((d) => d.s)].filter(isoValid);
  return {
    id: uid("s"),
    projectId: o.projectId,
    name: o.name.trim() || p.name,
    source: { kind: p.kind, label: undefined, ref: p.ref, at: o.at, by: o.by },
    dataDate: o.dataDate,
    start: isoValid(p.start) ? p.start : starts.length ? starts.reduce((m, x) => (x < m ? x : m)) : o.dataDate,
    deadline: p.deadline,
    calendar: calendarFor(p, o.preset, o.dataDate),
    wbs: p.wbs,
    acts: o.keepBaseline ? p.acts : p.acts.map((a) => ({ ...a, bl: null })),
    rels: p.rels,
    baselineName: o.keepBaseline ? p.baselineFrom : null,
    updated: o.at,
  };
}

export interface RecalcCheck {
  finish: string;
  fileFinish: string | null;
  /** Calendar days between the two finishes. */
  finishDiff: number | null;
  /** Open activities whose recalculated finish differs from the file's. */
  moved: number;
  compared: number;
  loops: number;
}

export function recalcCheck(p: Parsed, s: Schedule): RecalcCheck {
  const r = compute(s);
  let moved = 0;
  let compared = 0;
  for (const c of r.list) {
    const d = p.fileDates[c.a.id];
    if (!d || c.status === "complete") continue;
    compared++;
    if (d.f !== c.finish) moved++;
  }
  return {
    finish: r.finish,
    fileFinish: p.fileFinish,
    finishDiff: p.fileFinish ? dayNum(r.finish) - dayNum(p.fileFinish) : null,
    moved,
    compared,
    loops: r.loops.length,
  };
}
