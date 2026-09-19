/** Primavera P6 XER: tab-delimited tables (%T name, %F fields, %R rows).
 *  Reads PROJECT, CALENDAR, PROJWBS, TASK, and TASKPRED; everything else in
 *  the file (resources, codes, UDFs, risks) is left behind. */

import { isoValid } from "../calendar";
import type { Activity, ActType, CalendarDef, ConstraintType, Rel, RelType, Wbs } from "../types";
import { ImportError, isoPart, plural, serialToIso, type ImportSet, type Parsed } from "./common";

type Rec = Record<string, string>;

export function parseXerTables(text: string): Map<string, Rec[]> {
  const tables = new Map<string, Rec[]>();
  let fields: string[] = [];
  let cur: Rec[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("%T\t")) {
      cur = [];
      tables.set(line.slice(3).trim(), cur);
      fields = [];
    } else if (line.startsWith("%F\t")) {
      fields = line.slice(3).split("\t");
    } else if (line.startsWith("%R\t") && cur) {
      const vals = line.slice(3).split("\t");
      const rec: Rec = {};
      fields.forEach((f, i) => (rec[f] = vals[i] ?? ""));
      cur.push(rec);
    }
  }
  return tables;
}

/* ---------------------------------------------------------------------------
 * clndr_data: (0||Name(attrs)(children)) all the way down
 * ------------------------------------------------------------------------- */

interface CalNode {
  name: string;
  attrs: string;
  kids: CalNode[];
}

function parseCalData(raw: string): CalNode | null {
  const s = raw.replace(/[\s\x7f]/g, "");
  let i = 0;
  const node = (): CalNode => {
    if (s[i] !== "(") throw new Error("calendar");
    i++;
    const bar = s.indexOf("||", i);
    if (bar < 0) throw new Error("calendar");
    i = bar + 2;
    const p = s.indexOf("(", i);
    const name = s.slice(i, p);
    i = p + 1;
    const q = s.indexOf(")", i);
    const attrs = s.slice(i, q);
    i = q + 1;
    const kids: CalNode[] = [];
    if (s[i] === "(") {
      i++;
      while (s[i] === "(") kids.push(node());
      if (s[i] === ")") i++;
    }
    if (s[i] === ")") i++;
    return { name, attrs, kids };
  };
  try {
    return node();
  } catch {
    return null;
  }
}

const find = (n: CalNode, name: string): CalNode | undefined => (n.name === name ? n : n.kids.map((k) => find(k, name)).find(Boolean));
const hasWork = (n: CalNode): boolean => /s\|/.test(n.attrs) || n.kids.some(hasWork);

function xerCalendar(rec: Rec | undefined): { def: CalendarDef; hours: number; ok: boolean } {
  const hours = Number(rec?.day_hr_cnt) || 8;
  const fallback: CalendarDef = { name: rec?.clndr_name || "Standard 5-day", week: [false, true, true, true, true, true, false], holidays: [] };
  if (!rec?.clndr_data) return { def: fallback, hours, ok: false };
  const root = parseCalData(rec.clndr_data);
  if (!root) return { def: fallback, hours, ok: false };
  const week = [...fallback.week] as CalendarDef["week"];
  const dow = find(root, "DaysOfWeek");
  if (dow) for (const d of dow.kids) {
    const k = Number(d.name) - 1;
    if (k >= 0 && k < 7) week[k] = hasWork(d);
  }
  const holidays: string[] = [];
  const ex = find(root, "Exceptions");
  if (ex)
    for (const e of ex.kids) {
      const m = /d\|(\d+)/.exec(e.attrs);
      if (m && !hasWork(e)) holidays.push(serialToIso(Number(m[1])));
    }
  return { def: { name: rec.clndr_name || "P6 calendar", week, holidays: holidays.sort() }, hours, ok: true };
}

/* ---------------------------------------------------------------------------
 * Projects
 * ------------------------------------------------------------------------- */

const TYPE: Record<string, ActType> = { TT_Mile: "start", TT_FinMile: "finish" };
const REL: Record<string, RelType> = { PR_FS: "FS", PR_SS: "SS", PR_FF: "FF", PR_SF: "SF" };
const CONS: Record<string, ConstraintType> = {
  CS_MSO: "MSO",
  CS_MANDSTART: "MSO",
  CS_MSOA: "SNET",
  CS_MSOB: "SNLT",
  CS_MEO: "MFO",
  CS_MANDFIN: "MFO",
  CS_MEOA: "FNET",
  CS_MEOB: "FNLT",
};

export function readXer(file: string, text: string): ImportSet {
  if (!/^ERMHDR/.test(text.trimStart()) && !text.includes("%T\tTASK")) throw new ImportError("This doesn't look like a P6 XER export: there's no ERMHDR header or TASK table.");
  const t = parseXerTables(text);
  const projects = t.get("PROJECT") ?? [];
  const tasks = t.get("TASK") ?? [];
  if (!projects.length || !tasks.length) throw new ImportError("The XER file has no projects or no activities.");
  const wbsAll = t.get("PROJWBS") ?? [];
  const nameOf = (p: Rec) => wbsAll.find((w) => w.proj_id === p.proj_id && w.proj_node_flag === "Y")?.wbs_name || p.proj_short_name;
  return {
    file,
    tool: "Primavera P6 (XER)",
    projects: projects.map((p) => ({
      ref: p.proj_short_name || p.proj_id!,
      name: nameOf(p) ?? p.proj_short_name ?? "P6 project",
      activities: tasks.filter((k) => k.proj_id === p.proj_id).length,
      parse: () => parseProject(t, p, nameOf(p) ?? ""),
    })),
  };
}

function parseProject(t: Map<string, Rec[]>, p: Rec, name: string): Parsed {
  const warnings: string[] = [];
  const notes: string[] = [];
  const pid = p.proj_id!;
  const tasks = (t.get("TASK") ?? []).filter((k) => k.proj_id === pid);
  const cals = new Map((t.get("CALENDAR") ?? []).map((c) => [c.clndr_id!, c]));

  // Project default calendar, else the one most activities use.
  const use = new Map<string, number>();
  for (const k of tasks) use.set(k.clndr_id!, (use.get(k.clndr_id!) ?? 0) + 1);
  const mostUsed = [...use.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const calId = p.clndr_id && cals.has(p.clndr_id) ? p.clndr_id : mostUsed;
  const cal = xerCalendar(calId ? cals.get(calId) : undefined);
  if (!cal.ok) warnings.push("The project calendar couldn't be read; a Monday–Friday week is assumed. Check the calendar before relying on dates.");
  const others = tasks.filter((k) => k.clndr_id !== calId).length;
  if (others) warnings.push(`${plural(others, "activity uses", "activities use")} a different calendar than the project's. This app schedules everything on one calendar, so their dates can shift by a day or two.`);
  const hoursFor = (k: Rec) => Number(cals.get(k.clndr_id!)?.day_hr_cnt) || cal.hours;

  // WBS: drop the project node itself; its children become roots.
  const allWbs = (t.get("PROJWBS") ?? []).filter((w) => w.proj_id === pid);
  const root = allWbs.find((w) => w.proj_node_flag === "Y");
  const wbsRecs = allWbs.filter((w) => w !== root).sort((a, b) => Number(a.seq_num) - Number(b.seq_num) || (a.wbs_short_name ?? "").localeCompare(b.wbs_short_name ?? ""));
  const known = new Set(wbsRecs.map((w) => w.wbs_id!));
  const recById = new Map(wbsRecs.map((w) => [w.wbs_id!, w]));
  const codeOf = (w: Rec): string => {
    const parent = w.parent_wbs_id && known.has(w.parent_wbs_id) ? recById.get(w.parent_wbs_id) : undefined;
    return parent ? `${codeOf(parent)}.${w.wbs_short_name}` : (w.wbs_short_name ?? "");
  };
  const wbs: Wbs[] = wbsRecs.map((w) => ({
    id: `w-${w.wbs_id}`,
    parentId: w.parent_wbs_id && known.has(w.parent_wbs_id) ? `w-${w.parent_wbs_id}` : null,
    code: codeOf(w),
    name: w.wbs_name || w.wbs_short_name || "WBS",
  }));

  let fractional = 0;
  let loe = 0;
  let alap = 0;
  let planned = 0;
  const fileDates: Parsed["fileDates"] = {};
  const acts: Activity[] = tasks.map((k) => {
    const hpd = hoursFor(k);
    const kind = TYPE[k.task_type!] ?? "task";
    if (k.task_type === "TT_LOE" || k.task_type === "TT_WBS") loe++;
    const raw = (Number(k.target_drtn_hr_cnt) || 0) / hpd;
    if (kind === "task" && Math.abs(raw - Math.round(raw)) > 0.01) fractional++;
    const status = k.status_code;
    const as = isoPart(k.act_start_date);
    const af = status === "TK_Complete" ? isoPart(k.act_end_date) : null;
    const a: Activity = {
      id: `a-${k.task_id}`,
      code: k.task_code || k.task_id!,
      name: k.task_name || "(no name)",
      wbsId: k.wbs_id && known.has(k.wbs_id) ? `w-${k.wbs_id}` : null,
      type: kind,
      dur: kind === "task" ? Math.max(0, Math.round(raw)) : 0,
    };
    if (status !== "TK_NotStart" && as) a.as = as;
    if (af) a.af = af;
    if (status === "TK_Active") {
      a.rem = Math.max(0, Math.round((Number(k.remain_drtn_hr_cnt) || 0) / hpd));
      a.pct = Math.round(Number(k.phys_complete_pct) || 0);
    }
    const ct = k.cstr_type ? CONS[k.cstr_type] : undefined;
    const cd = isoPart(k.cstr_date);
    if (ct && cd) a.cons = { type: ct, date: cd };
    if (k.cstr_type === "CS_ALAP") alap++;
    const ps = isoPart(k.target_start_date);
    const pf = isoPart(k.target_end_date);
    if (ps && pf) {
      a.bl = { s: ps, f: pf };
      planned++;
    }
    const es = isoPart(status === "TK_Complete" ? k.act_start_date : status === "TK_Active" ? k.act_start_date : k.restart_date || k.early_start_date);
    const ef = isoPart(status === "TK_Complete" ? k.act_end_date : k.reend_date || k.early_end_date);
    if (es && ef) fileDates[a.id] = { s: es, f: ef };
    return a;
  });

  const ids = new Set(acts.map((a) => a.id));
  const hpdById = new Map(tasks.map((k) => [`a-${k.task_id}`, hoursFor(k)]));
  let external = 0;
  const rels: Rel[] = [];
  for (const r of t.get("TASKPRED") ?? []) {
    const succ = `a-${r.task_id}`;
    const pred = `a-${r.pred_task_id}`;
    if (!ids.has(succ) && !ids.has(pred)) continue;
    if (!ids.has(succ) || !ids.has(pred)) {
      external++;
      continue;
    }
    rels.push({ id: `r-${r.task_pred_id}`, pred, succ, type: REL[r.pred_type!] ?? "FS", lag: Math.round((Number(r.lag_hr_cnt) || 0) / (hpdById.get(succ) ?? 8)) });
  }

  if (fractional) warnings.push(`${plural(fractional, "duration")} weren't whole days and were rounded; this app schedules in whole working days.`);
  if (loe) warnings.push(`${plural(loe, "level-of-effort or WBS summary activity", "level-of-effort and WBS summary activities")} came in as ordinary tasks. Their durations no longer stretch with the work around them.`);
  if (alap) warnings.push(`${plural(alap, "as-late-as-possible constraint")} were dropped; those activities schedule as early as possible.`);
  if (external) warnings.push(`${plural(external, "relationship")} to activities in other projects were left out.`);
  if (planned) notes.push("P6 planned dates were brought in as the baseline. If the file came from a project with a separate baseline assigned, compare against that update instead.");

  const dd = isoPart(p.last_recalc_date) ?? isoPart(p.plan_start_date);
  const finishes = Object.values(fileDates).map((d) => d.f);
  return {
    kind: "p6-xer",
    tool: "Primavera P6 (XER)",
    ref: p.proj_short_name || pid,
    name,
    dataDate: dd,
    start: isoPart(p.plan_start_date),
    deadline: isoPart(p.plan_end_date),
    calendar: cal.def,
    wbs,
    acts,
    rels,
    fileFinish: isoPart(p.scd_end_date) ?? (finishes.length ? finishes.reduce((m, x) => (x > m ? x : m)) : null),
    fileDates,
    baselineFrom: planned ? "P6 planned dates" : null,
    warnings,
    notes: [...notes, ...(isoValid(dd) ? [] : ["The file has no data date; the preview uses the earliest date in it."])],
  };
}
