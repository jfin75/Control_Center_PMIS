/** What every importer hands back: one project's network in this app's
 *  model, plus what the source file said about its own dates so the preview
 *  can show whether a recalculation here lands on the same finish. */

import { dayNum, isoOf, isoValid } from "../calendar";
import type { Activity, CalendarDef, Rel, SourceKind, Wbs } from "../types";

export interface Parsed {
  kind: SourceKind;
  /** "Primavera P6 (XER)". */
  tool: string;
  ref: string;
  name: string;
  dataDate: string | null;
  start: string | null;
  deadline: string | null;
  calendar: CalendarDef | null;
  wbs: Wbs[];
  acts: Activity[];
  rels: Rel[];
  /** The source's own scheduled finish. */
  fileFinish: string | null;
  /** The source's own start and finish for each activity id. */
  fileDates: Record<string, { s: string; f: string }>;
  /** What the activities' bl dates came from, if anything. */
  baselineFrom: string | null;
  warnings: string[];
  notes: string[];
}

/** A file can hold several projects (XER, P6 XML); each parses on demand. */
export interface ImportSet {
  file: string;
  tool: string;
  projects: Array<{ ref: string; name: string; activities: number; parse: () => Parsed }>;
}

export class ImportError extends Error {}

/** "2026-08-31 08:00", "2026-08-31T08:00:00" → "2026-08-31". */
export function isoPart(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Dates as scheduling tools export them: ISO, 8/31/2026, Mon 8/31/26, 31-Aug-26, Aug 31, 2026. Trailing "A" or "*" (actual, constrained) is dropped. */
export function parseLooseDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v
    .trim()
    .replace(/\s*[A*]$/, "")
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "");
  if (!t) return null;
  const iso = isoPart(t);
  if (iso) return isoValid(iso) ? iso : null;
  const y2 = (y: number) => (y < 100 ? 2000 + y : y);
  const make = (y: number, m: number, d: number) => {
    if (!m || m > 12 || !d || d > 31) return null;
    const s = `${y2(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return isoValid(s) && isoOf(dayNum(s)) === s ? s : null;
  };
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
  if (m) return make(Number(m[3]), Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s](\d{2,4})/.exec(t);
  if (m) return make(Number(m[3]), MONTHS[m[2]!.toLowerCase()] ?? 0, Number(m[1]));
  m = /^([A-Za-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/.exec(t);
  if (m) return make(Number(m[3]), MONTHS[m[1]!.toLowerCase()] ?? 0, Number(m[2]));
  return null;
}

/** Excel / P6 serial day (days since 1899-12-30) → ISO. */
export const serialToIso = (n: number) => isoOf(Math.round(n) + dayNum("1899-12-30"));

export function roundDays(hours: number, perDay: number): number {
  return Math.round((hours / (perDay || 8)) * 100) / 100;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Read a file's text, falling back to Windows-1252 when it isn't valid UTF-8 (older XER exports). */
export async function readText(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}
