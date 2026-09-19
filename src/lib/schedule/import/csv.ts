/** A spreadsheet of activities, as P6 or Microsoft Project export to Excel
 *  and save as CSV. Columns are found by their usual header names; only an ID
 *  or a name is required. */

import { WorkCalendar, isoValid } from "../calendar";
import { parsePreds } from "../edit";
import type { Activity, ActType, CalendarDef, ConstraintType, Rel, Wbs } from "../types";
import { ImportError, parseLooseDate, plural, type ImportSet, type Parsed } from "./common";

/** RFC 4180, with the delimiter sniffed from the header line. */
export function parseDelimited(text: string): string[][] {
  const nl = text.indexOf("\n");
  const head = nl < 0 ? text : text.slice(0, nl);
  const delim = (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? "\t" : (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const COLS = {
  code: ["activity id", "id", "task id", "unique id", "activity code", "code", "task code"],
  name: ["activity name", "name", "task name", "description", "task", "activity"],
  dur: ["original duration", "duration", "planned duration", "od", "dur", "at completion duration"],
  rem: ["remaining duration", "rd"],
  start: ["start", "early start", "start date", "planned start", "scheduled start"],
  finish: ["finish", "early finish", "finish date", "planned finish", "end", "end date", "scheduled finish"],
  preds: ["predecessors", "predecessor", "preds", "predecessor details"],
  wbs: ["wbs", "wbs code", "wbs name", "wbs path", "outline", "phase"],
  type: ["activity type", "type", "milestone"],
  as: ["actual start"],
  af: ["actual finish"],
  pct: ["% complete", "percent complete", "activity % complete", "physical % complete", "pct complete", "complete"],
  bls: ["baseline start", "bl start", "bl project start", "baseline1 start"],
  blf: ["baseline finish", "bl finish", "bl project finish", "baseline1 finish"],
  resp: ["responsible", "resource names", "resources", "company", "subcontractor", "responsibility"],
  cons: ["constraint", "primary constraint", "constraint type"],
  consDate: ["constraint date", "primary constraint date"],
} as const;

const CONS: Record<string, ConstraintType> = {
  snet: "SNET",
  "start on or after": "SNET",
  "start no earlier than": "SNET",
  snlt: "SNLT",
  "start on or before": "SNLT",
  "start no later than": "SNLT",
  fnet: "FNET",
  "finish on or after": "FNET",
  "finish no earlier than": "FNET",
  fnlt: "FNLT",
  "finish on or before": "FNLT",
  "finish no later than": "FNLT",
  mso: "MSO",
  "start on": "MSO",
  "must start on": "MSO",
  "mandatory start": "MSO",
  mfo: "MFO",
  "finish on": "MFO",
  "must finish on": "MFO",
  "mandatory finish": "MFO",
};

const days = (v: string | undefined) => {
  if (!v) return null;
  const m = /(-?\d+(?:\.\d+)?)\s*(d|days?|wd|w|wks?|weeks?|h|hrs?|hours?)?/i.exec(v.replace(/,/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "d").toLowerCase();
  if (unit.startsWith("w")) return n * 5;
  if (unit.startsWith("h")) return n / 8;
  return n;
};

export function readCsv(file: string, text: string): ImportSet {
  const rows = parseDelimited(text);
  const headAt = rows.findIndex((r) => r.some((c) => ([...COLS.name, ...COLS.code] as string[]).includes(c.trim().toLowerCase())));
  if (headAt < 0 || rows.length < headAt + 2) throw new ImportError("No header row with an Activity ID or Activity Name column was found.");
  const name = file.replace(/\.[^.]+$/, "");
  return {
    file,
    tool: "Spreadsheet (CSV)",
    projects: [{ ref: name, name, activities: rows.length - headAt - 1, parse: () => parseCsv(rows, headAt, name) }],
  };
}

function parseCsv(rows: string[][], headAt: number, name: string): Parsed {
  const warnings: string[] = [];
  const notes: string[] = [];
  const head = rows[headAt]!.map((h) => h.trim().toLowerCase().replace(/\s*\(.*\)$/, ""));
  const col = (k: keyof typeof COLS) => {
    for (const n of COLS[k] as readonly string[]) {
      const i = head.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const at = Object.fromEntries(Object.keys(COLS).map((k) => [k, col(k as keyof typeof COLS)])) as Record<keyof typeof COLS, number>;
  const get = (r: string[], k: keyof typeof COLS) => (at[k] >= 0 ? (r[at[k]] ?? "").trim() : "");
  const calDef: CalendarDef = { name: "5-day week", week: [false, true, true, true, true, true, false], holidays: [] };
  const cal = new WorkCalendar(calDef);

  // WBS from a path column: "Construction > Stage 2" or dotted codes both build a tree.
  const wbs: Wbs[] = [];
  const wbsKey = new Map<string, string>();
  const wbsFor = (raw: string): string | null => {
    if (!raw) return null;
    const parts = raw.split(/\s*(?:›|>|\/|\\)\s*/).filter(Boolean);
    let parent: string | null = null;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}›${part}` : part;
      let id = wbsKey.get(path);
      if (!id) {
        id = `w-${wbs.length + 1}`;
        wbs.push({ id, parentId: parent, code: String(wbs.filter((w) => w.parentId === parent).length + 1), name: part });
        wbsKey.set(path, id);
      }
      parent = id;
    }
    return parent;
  };

  const acts: Activity[] = [];
  const predText = new Map<string, string>();
  const fileDates: Parsed["fileDates"] = {};
  let derived = 0;
  const seen = new Set<string>();
  for (const [i, r] of rows.slice(headAt + 1).entries()) {
    const code = get(r, "code") || `A${String((i + 1) * 10 + 1000)}`;
    const nm = get(r, "name");
    if (!nm && !get(r, "code")) continue;
    if (seen.has(code.toUpperCase())) {
      warnings.push(`Activity ID ${code} appears more than once; only the first row was kept.`);
      continue;
    }
    seen.add(code.toUpperCase());
    const s = parseLooseDate(get(r, "start"));
    const f = parseLooseDate(get(r, "finish"));
    let dur = days(get(r, "dur"));
    if (dur === null && s && f) {
      dur = cal.span(s, f);
      derived++;
    }
    const typeRaw = get(r, "type").toLowerCase();
    const isMs = /mile|^yes$|^true$|^1$/.test(typeRaw) || dur === 0;
    const type: ActType = isMs ? (/start/.test(typeRaw) ? "start" : "finish") : "task";
    const a: Activity = { id: `a-${i + 1}`, code, name: nm || code, wbsId: wbsFor(get(r, "wbs")), type, dur: isMs ? 0 : Math.max(0, Math.round(dur ?? 1)) };
    const as = parseLooseDate(get(r, "as"));
    const af = parseLooseDate(get(r, "af"));
    const pct = Number(get(r, "pct").replace("%", "")) || 0;
    if (as) a.as = as;
    if (af && (pct >= 100 || !get(r, "pct") || isMs)) a.af = af;
    if (as && !a.af) {
      const rem = days(get(r, "rem"));
      a.rem = rem !== null ? Math.round(rem) : Math.round(a.dur * (1 - pct / 100));
      a.pct = pct;
    }
    const bls = parseLooseDate(get(r, "bls"));
    const blf = parseLooseDate(get(r, "blf"));
    if (bls && blf) a.bl = { s: bls, f: blf };
    const resp = get(r, "resp");
    if (resp) a.resp = resp;
    const ct = CONS[get(r, "cons").toLowerCase()];
    const cd = parseLooseDate(get(r, "consDate"));
    if (ct && cd) a.cons = { type: ct, date: cd };
    if (s && f) fileDates[a.id] = { s, f };
    else if (s) fileDates[a.id] = { s, f: s };
    const p = get(r, "preds");
    if (p) predText.set(a.id, p);
    acts.push(a);
  }
  if (!acts.length) throw new ImportError("The spreadsheet has a header row but no activities under it.");

  const byCode = new Map(acts.map((a) => [a.code.toUpperCase(), a.id]));
  const rels: Rel[] = [];
  const unknown = new Set<string>();
  for (const [succ, text] of predText) {
    for (const p of parsePreds(text.replace(/[−–]/g, "-")).specs) {
      const pred = byCode.get(p.code.toUpperCase());
      if (!pred || pred === succ) {
        unknown.add(p.code);
        continue;
      }
      rels.push({ id: `r-${rels.length + 1}`, pred, succ, type: p.type, lag: p.lag });
    }
  }
  if (unknown.size) warnings.push(`${plural(unknown.size, "predecessor")} didn't match an activity ID and were left out: ${[...unknown].slice(0, 6).join(", ")}${unknown.size > 6 ? "…" : ""}.`);

  // Without logic, hold each activity at its exported start so the picture survives the recalculation.
  const hasPred = new Set(rels.map((r) => r.succ));
  const starts = Object.values(fileDates).map((d) => d.s).filter(isoValid);
  const first = starts.length ? starts.reduce((m, x) => (x < m ? x : m)) : null;
  let held = 0;
  for (const a of acts) {
    const d = fileDates[a.id];
    if (!hasPred.has(a.id) && d && first && d.s > first && !a.as && !a.cons) {
      a.cons = { type: "SNET", date: d.s };
      held++;
    }
  }
  if (!rels.length) warnings.push("No predecessors were found, so there's no logic to calculate a critical path from. Add a Predecessors column, or link the activities after import.");
  if (held) notes.push(`${plural(held, "activity", "activities")} without a predecessor ${held === 1 ? "is" : "are"} held at ${held === 1 ? "its" : "their"} exported start with a start-on-or-after constraint.`);
  if (derived) notes.push(`${plural(derived, "duration")} came from the start and finish dates on a Monday–Friday week.`);
  if (at.code < 0) notes.push("There was no Activity ID column, so IDs were numbered A1010, A1020, and on.");

  const finishes = Object.values(fileDates).map((d) => d.f);
  return {
    kind: "csv",
    tool: "Spreadsheet (CSV)",
    ref: name,
    name,
    dataDate: null,
    start: first,
    deadline: null,
    calendar: null,
    wbs,
    acts,
    rels,
    fileFinish: finishes.length ? finishes.reduce((m, x) => (x > m ? x : m)) : null,
    fileDates,
    baselineFrom: acts.some((a) => a.bl) ? "Baseline columns" : null,
    warnings,
    notes,
  };
}
