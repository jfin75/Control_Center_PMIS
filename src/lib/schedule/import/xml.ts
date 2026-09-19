/** XML schedules: Microsoft Project's MSPDI (File › Save As › XML) and
 *  Primavera P6's PMXML export. Both are read with the browser's DOMParser,
 *  matching elements by local name so namespaces don't matter. */

import { dayNum, isoOf } from "../calendar";
import type { Activity, ActType, CalendarDef, ConstraintType, Rel, RelType, Wbs } from "../types";
import { ImportError, isoPart, plural, type ImportSet, type Parsed } from "./common";

const kids = (el: Element | null | undefined, name: string): Element[] => (el ? Array.from(el.children).filter((c) => c.localName === name) : []);
const kid = (el: Element | null | undefined, name: string): Element | undefined => kids(el, name)[0];
const txt = (el: Element | null | undefined, name: string): string | null => {
  const k = kid(el, name);
  const v = k?.textContent?.trim();
  return v ? v : null;
};
const numOf = (el: Element | null | undefined, name: string, d = 0) => {
  const v = Number(txt(el, name));
  return Number.isFinite(v) ? v : d;
};

export function readXml(file: string, text: string): ImportSet {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new ImportError("The XML file couldn't be read. It may be truncated or not an XML export.");
  const root = doc.documentElement;
  if (root.localName === "Project" && (root.namespaceURI?.includes("schemas.microsoft.com/project") || kid(root, "Tasks"))) return readMspdi(file, root);
  if (root.localName === "APIBusinessObjects") return readPmxml(file, root);
  throw new ImportError("This XML isn't a Microsoft Project (MSPDI) or Primavera P6 (PMXML) export.");
}

/* ---------------------------------------------------------------------------
 * Microsoft Project
 * ------------------------------------------------------------------------- */

/** ISO 8601 duration (PT40H0M0S, P2DT4H) → hours. */
function hoursOf(v: string | null): number {
  if (!v) return 0;
  const m = /^-?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?/.exec(v);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
}

const MSP_CONS: Record<string, ConstraintType | undefined> = { "2": "MSO", "3": "MFO", "4": "SNET", "5": "SNLT", "6": "FNET", "7": "FNLT" };
const MSP_REL: Record<string, RelType> = { "0": "FF", "1": "FS", "2": "SF", "3": "SS" };
const ELAPSED = new Set(["4", "6", "8", "10", "12", "36", "38", "40", "42", "44"]);

function mspCalendar(root: Element): { def: CalendarDef | null; ok: boolean } {
  const uid = txt(root, "CalendarUID");
  const cals = kids(kid(root, "Calendars"), "Calendar");
  const cal = cals.find((c) => txt(c, "UID") === uid) ?? cals.find((c) => txt(c, "IsBaseCalendar") === "1") ?? cals[0];
  if (!cal) return { def: null, ok: false };
  const week: CalendarDef["week"] = [false, true, true, true, true, true, false];
  const holidays: string[] = [];
  const addRange = (from: string | null, to: string | null) => {
    const a = isoPart(from);
    const b = isoPart(to) ?? a;
    if (!a || !b) return;
    for (let d = dayNum(a), n = 0; d <= dayNum(b) && n < 400; d++, n++) holidays.push(isoOf(d));
  };
  for (const wd of kids(kid(cal, "WeekDays"), "WeekDay")) {
    const type = txt(wd, "DayType");
    const working = txt(wd, "DayWorking") === "1";
    if (type === "0") {
      // Project 2003-style exception inside WeekDays.
      if (!working) addRange(txt(kid(wd, "TimePeriod"), "FromDate"), txt(kid(wd, "TimePeriod"), "ToDate"));
    } else if (type) {
      const k = Number(type) - 1;
      if (k >= 0 && k < 7) week[k] = working;
    }
  }
  for (const ex of kids(kid(cal, "Exceptions"), "Exception")) {
    if (txt(ex, "DayWorking") === "1") continue;
    addRange(txt(kid(ex, "TimePeriod"), "FromDate"), txt(kid(ex, "TimePeriod"), "ToDate"));
  }
  return { def: { name: txt(cal, "Name") ?? "Project calendar", week, holidays: [...new Set(holidays)].sort() }, ok: true };
}

function readMspdi(file: string, root: Element): ImportSet {
  const tasks = kids(kid(root, "Tasks"), "Task").filter((t) => txt(t, "IsNull") !== "1" && txt(t, "UID") !== "0");
  const name = txt(root, "Title") ?? txt(root, "Name")?.replace(/\.(mpp|xml)$/i, "") ?? file.replace(/\.[^.]+$/, "");
  return {
    file,
    tool: "Microsoft Project (XML)",
    projects: [{ ref: txt(root, "Name") ?? name, name, activities: tasks.filter((t) => txt(t, "Summary") !== "1").length, parse: () => parseMspdi(root, tasks, name) }],
  };
}

function parseMspdi(root: Element, tasks: Element[], name: string): Parsed {
  const warnings: string[] = [];
  // A custom field aliased "Activity ID" (this app's export uses Text1) beats Project's own numbering.
  const idField = kids(kid(root, "ExtendedAttributes"), "ExtendedAttribute").find((e) => /^activity ?id$/i.test(txt(e, "Alias") ?? ""));
  const idFieldId = idField ? txt(idField, "FieldID") : null;
  const codeOf = (t: Element) => (idFieldId ? txt(kids(t, "ExtendedAttribute").find((e) => txt(e, "FieldID") === idFieldId), "Value") : null);
  const notes: string[] = [idFieldId ? "Activity IDs come from the file's Activity ID field." : "Activity IDs are Microsoft Project Unique IDs, which stay put when rows are inserted, so later updates line up."];
  const perDay = (numOf(root, "MinutesPerDay", 480) || 480) / 60;
  const cal = mspCalendar(root);
  if (!cal.ok) warnings.push("No project calendar was found; a Monday–Friday week is assumed.");

  // Summary tasks become WBS nodes; outline level tells us whose child each row is.
  const wbs: Wbs[] = [];
  const acts: Activity[] = [];
  const stack: Array<{ level: number; id: string }> = [];
  const summaryUids = new Set<string>();
  const fileDates: Parsed["fileDates"] = {};
  let fractional = 0;
  let baselined = 0;
  let manual = 0;
  const linkEls: Array<{ succ: string; el: Element }> = [];

  for (const t of tasks) {
    const uid = txt(t, "UID")!;
    const level = numOf(t, "OutlineLevel", 1);
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const parent = stack[stack.length - 1]?.id ?? null;
    if (txt(t, "Summary") === "1") {
      const id = `w-${uid}`;
      wbs.push({ id, parentId: parent, code: txt(t, "WBS") ?? txt(t, "OutlineNumber") ?? uid, name: txt(t, "Name") ?? "Summary" });
      stack.push({ level, id });
      summaryUids.add(uid);
      continue;
    }
    if (txt(t, "Manual") === "1") manual++;
    const hrs = hoursOf(txt(t, "Duration"));
    const raw = hrs / perDay;
    const ms = txt(t, "Milestone") === "1" && raw < 0.01;
    // Project has one kind of milestone; where it sits in the day says which P6 kind it is.
    const hour = /T(d{2}):/.exec(txt(t, "Start") ?? "")?.[1];
    const early = hour !== undefined ? Number(hour) < 12 : kids(t, "PredecessorLink").length === 0;
    const type: ActType = ms ? (early ? "start" : "finish") : "task";
    if (!ms && Math.abs(raw - Math.round(raw)) > 0.01) fractional++;
    const pct = numOf(t, "PercentComplete");
    const as = isoPart(txt(t, "ActualStart"));
    const af = isoPart(txt(t, "ActualFinish"));
    const a: Activity = {
      id: `a-${uid}`,
      code: codeOf(t) ?? uid,
      name: txt(t, "Name") ?? "(no name)",
      wbsId: parent,
      type,
      dur: ms ? 0 : Math.max(0, Math.round(raw)),
    };
    if (as) a.as = as;
    if (af && (pct >= 100 || ms)) a.af = af;
    if (as && !a.af) {
      a.rem = Math.max(0, Math.round(hoursOf(txt(t, "RemainingDuration")) / perDay));
      a.pct = pct;
    }
    const ct = MSP_CONS[txt(t, "ConstraintType") ?? ""];
    const cd = isoPart(txt(t, "ConstraintDate"));
    if (ct && cd) a.cons = { type: ct, date: cd };
    const bl = kids(t, "Baseline").find((b) => (txt(b, "Number") ?? "0") === "0");
    const bs = isoPart(txt(bl, "Start"));
    const bf = isoPart(txt(bl, "Finish"));
    if (bs && bf) {
      a.bl = { s: bs, f: bf };
      baselined++;
    }
    const notesText = txt(t, "Notes");
    if (notesText) a.notes = notesText.slice(0, 2000);
    const s = isoPart(txt(t, "Start"));
    const f = isoPart(txt(t, "Finish"));
    if (s && f) fileDates[a.id] = { s, f };
    acts.push(a);
    for (const el of kids(t, "PredecessorLink")) linkEls.push({ succ: a.id, el });
  }

  const ids = new Set(acts.map((a) => a.id));
  const rels: Rel[] = [];
  let toSummary = 0;
  let pctLags = 0;
  let external = 0;
  for (const { succ, el } of linkEls) {
    const pu = txt(el, "PredecessorUID");
    if (!pu) continue;
    if (summaryUids.has(pu)) {
      toSummary++;
      continue;
    }
    if (!ids.has(`a-${pu}`)) {
      external++;
      continue;
    }
    const fmt = txt(el, "LagFormat") ?? "7";
    const lagMin = numOf(el, "LinkLag") / 10;
    let lag = 0;
    if (fmt === "19" || fmt === "20") {
      if (lagMin) pctLags++;
    } else if (ELAPSED.has(fmt)) lag = Math.round(((lagMin / 1440) * 5) / 7);
    else lag = Math.round(lagMin / 60 / perDay);
    rels.push({ id: `r-${pu}-${succ}`, pred: `a-${pu}`, succ, type: MSP_REL[txt(el, "Type") ?? "1"] ?? "FS", lag });
  }
  const summaryLinked = tasks.filter((t) => txt(t, "Summary") === "1" && kids(t, "PredecessorLink").length).length;

  if (fractional) warnings.push(`${plural(fractional, "duration")} weren't whole days and were rounded; this app schedules in whole working days.`);
  if (toSummary || summaryLinked) warnings.push(`${plural(toSummary + summaryLinked, "link")} to or from summary tasks were left out. Link the work inside the summary instead.`);
  if (pctLags) warnings.push(`${plural(pctLags, "percentage lag")} were set to zero.`);
  if (external) warnings.push(`${plural(external, "link")} to tasks outside the file were left out.`);
  if (manual) warnings.push(`${plural(manual, "manually scheduled task")} are auto-scheduled here, so they follow their logic.`);

  const status = isoPart(txt(root, "StatusDate")) ?? isoPart(txt(root, "CurrentDate"));
  // Task deadlines stand in for contract completion; the latest one governs.
  const deadlines = tasks.map((t) => isoPart(txt(t, "Deadline"))).filter((d): d is string => !!d);
  if (!status) notes.push("The file has no status date; the preview uses the current date from the file.");
  return {
    kind: "msp-xml",
    tool: "Microsoft Project (XML)",
    ref: txt(root, "Name") ?? name,
    name,
    dataDate: status,
    start: isoPart(txt(root, "StartDate")),
    deadline: deadlines.length ? deadlines.reduce((m, d) => (d > m ? d : m)) : null,
    calendar: cal.def,
    wbs,
    acts,
    rels,
    fileFinish: isoPart(txt(root, "FinishDate")),
    fileDates,
    baselineFrom: baselined ? "Microsoft Project Baseline" : null,
    warnings,
    notes,
  };
}

/* ---------------------------------------------------------------------------
 * Primavera P6 XML
 * ------------------------------------------------------------------------- */

const PM_TYPE: Record<string, ActType> = { "Start Milestone": "start", "Finish Milestone": "finish" };
const PM_REL: Record<string, RelType> = { "Finish to Start": "FS", "Start to Start": "SS", "Finish to Finish": "FF", "Start to Finish": "SF" };
const PM_CONS: Record<string, ConstraintType> = {
  "Start On": "MSO",
  "Mandatory Start": "MSO",
  "Start On or After": "SNET",
  "Start On or Before": "SNLT",
  "Finish On": "MFO",
  "Mandatory Finish": "MFO",
  "Finish On or After": "FNET",
  "Finish On or Before": "FNLT",
};

function pmCalendar(el: Element | undefined): { def: CalendarDef; hours: number } | null {
  if (!el) return null;
  const week: CalendarDef["week"] = [false, true, true, true, true, true, false];
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const h of kids(kid(el, "StandardWorkWeek"), "StandardWorkHours")) {
    const k = names.indexOf(txt(h, "DayOfWeek") ?? "");
    if (k >= 0) week[k] = kids(h, "WorkTime").some((w) => txt(w, "Start") && txt(w, "Finish"));
  }
  const holidays = kids(kid(el, "HolidayOrExceptions"), "HolidayOrException")
    .filter((h) => !kids(h, "WorkTime").some((w) => txt(w, "Start")))
    .map((h) => isoPart(txt(h, "Date")))
    .filter((d): d is string => !!d)
    .sort();
  return { def: { name: txt(el, "Name") ?? "P6 calendar", week, holidays }, hours: numOf(el, "HoursPerDay", 8) || 8 };
}

function readPmxml(file: string, root: Element): ImportSet {
  const projects = kids(root, "Project");
  if (!projects.length) throw new ImportError("The P6 XML file has no projects in it.");
  return {
    file,
    tool: "Primavera P6 (XML)",
    projects: projects.map((p) => ({
      ref: txt(p, "Id") ?? txt(p, "ObjectId") ?? "P6",
      name: txt(p, "Name") ?? txt(p, "Id") ?? "P6 project",
      activities: kids(p, "Activity").length,
      parse: () => parsePmxml(root, p),
    })),
  };
}

function parsePmxml(root: Element, p: Element): Parsed {
  const warnings: string[] = [];
  const notes: string[] = [];
  const calEls = [...kids(root, "Calendar"), ...kids(p, "Calendar")];
  const calId = txt(p, "ActivityDefaultCalendarObjectId") ?? txt(p, "DefaultCalendarObjectId");
  const actEls = kids(p, "Activity");
  const use = new Map<string, number>();
  for (const a of actEls) use.set(txt(a, "CalendarObjectId") ?? "", (use.get(txt(a, "CalendarObjectId") ?? "") ?? 0) + 1);
  const pick = calId ?? [...use.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const cal = pmCalendar(calEls.find((c) => txt(c, "ObjectId") === pick) ?? calEls[0]);
  if (!cal) warnings.push("No calendar was found in the file; a Monday–Friday week is assumed.");
  const hpd = cal?.hours ?? 8;
  const others = actEls.filter((a) => (txt(a, "CalendarObjectId") ?? pick) !== pick).length;
  if (others) warnings.push(`${plural(others, "activity uses", "activities use")} a different calendar than the project's. This app schedules everything on one calendar.`);

  const wbsEls = kids(p, "WBS").sort((a, b) => numOf(a, "SequenceNumber") - numOf(b, "SequenceNumber"));
  const known = new Set(wbsEls.map((w) => txt(w, "ObjectId")!));
  const byOid = new Map(wbsEls.map((w) => [txt(w, "ObjectId")!, w]));
  const codeOf = (w: Element): string => {
    const par = txt(w, "ParentObjectId");
    const pe = par && known.has(par) ? byOid.get(par) : undefined;
    return pe ? `${codeOf(pe)}.${txt(w, "Code") ?? ""}` : (txt(w, "Code") ?? "");
  };
  const wbs: Wbs[] = wbsEls.map((w) => {
    const par = txt(w, "ParentObjectId");
    return { id: `w-${txt(w, "ObjectId")}`, parentId: par && known.has(par) ? `w-${par}` : null, code: codeOf(w), name: txt(w, "Name") ?? "WBS" };
  });

  let fractional = 0;
  let loe = 0;
  let planned = 0;
  const fileDates: Parsed["fileDates"] = {};
  const acts: Activity[] = actEls.map((e) => {
    const oid = txt(e, "ObjectId")!;
    const rawType = txt(e, "Type") ?? "";
    const type = PM_TYPE[rawType] ?? "task";
    if (rawType === "Level of Effort" || rawType === "WBS Summary") loe++;
    const raw = numOf(e, "PlannedDuration") / hpd;
    if (type === "task" && Math.abs(raw - Math.round(raw)) > 0.01) fractional++;
    const status = txt(e, "Status");
    const w = txt(e, "WBSObjectId");
    const a: Activity = { id: `a-${oid}`, code: txt(e, "Id") ?? oid, name: txt(e, "Name") ?? "(no name)", wbsId: w && known.has(w) ? `w-${w}` : null, type, dur: type === "task" ? Math.max(0, Math.round(raw)) : 0 };
    const as = isoPart(txt(e, "ActualStartDate"));
    const af = isoPart(txt(e, "ActualFinishDate"));
    if (as && status !== "Not Started") a.as = as;
    if (af && status === "Completed") a.af = af;
    if (status === "In Progress") {
      a.rem = Math.max(0, Math.round(numOf(e, "RemainingDuration") / hpd));
      let pc = numOf(e, "PhysicalPercentComplete", numOf(e, "PercentComplete"));
      if (pc > 0 && pc <= 1) pc *= 100;
      a.pct = Math.round(pc);
    }
    const ct = PM_CONS[txt(e, "PrimaryConstraintType") ?? ""];
    const cd = isoPart(txt(e, "PrimaryConstraintDate"));
    if (ct && cd) a.cons = { type: ct, date: cd };
    const ps = isoPart(txt(e, "PlannedStartDate"));
    const pf = isoPart(txt(e, "PlannedFinishDate"));
    if (ps && pf) {
      a.bl = { s: ps, f: pf };
      planned++;
    }
    const s = isoPart(txt(e, "StartDate"));
    const f = isoPart(txt(e, "FinishDate"));
    if (s && f) fileDates[a.id] = { s, f };
    return a;
  });

  const ids = new Set(acts.map((a) => a.id));
  let external = 0;
  const rels: Rel[] = [];
  for (const r of [...kids(p, "Relationship"), ...kids(root, "Relationship")]) {
    const pred = `a-${txt(r, "PredecessorActivityObjectId")}`;
    const succ = `a-${txt(r, "SuccessorActivityObjectId")}`;
    if (!ids.has(pred) && !ids.has(succ)) continue;
    if (!ids.has(pred) || !ids.has(succ)) {
      external++;
      continue;
    }
    rels.push({ id: `r-${txt(r, "ObjectId") ?? `${pred}-${succ}`}`, pred, succ, type: PM_REL[txt(r, "Type") ?? ""] ?? "FS", lag: Math.round(numOf(r, "Lag") / hpd) });
  }

  if (fractional) warnings.push(`${plural(fractional, "duration")} weren't whole days and were rounded; this app schedules in whole working days.`);
  if (loe) warnings.push(`${plural(loe, "level-of-effort or WBS summary activity", "level-of-effort and WBS summary activities")} came in as ordinary tasks.`);
  if (external) warnings.push(`${plural(external, "relationship")} to activities in other projects were left out.`);
  if (planned) notes.push("P6 planned dates were brought in as the baseline.");

  const finishes = Object.values(fileDates).map((d) => d.f);
  return {
    kind: "p6-xml",
    tool: "Primavera P6 (XML)",
    ref: txt(p, "Id") ?? "",
    name: txt(p, "Name") ?? txt(p, "Id") ?? "P6 project",
    dataDate: isoPart(txt(p, "DataDate")),
    start: isoPart(txt(p, "PlannedStartDate")),
    deadline: isoPart(txt(p, "MustFinishByDate")),
    calendar: cal?.def ?? null,
    wbs,
    acts,
    rels,
    fileFinish: isoPart(txt(p, "ScheduledFinishDate")) ?? (finishes.length ? finishes.reduce((m, x) => (x > m ? x : m)) : null),
    fileDates,
    baselineFrom: planned ? "P6 planned dates" : null,
    warnings,
    notes,
  };
}
