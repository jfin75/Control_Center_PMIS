/** Exports: Microsoft Project XML (MSPDI), which Project opens directly and
 *  P6 imports through its Microsoft Project XML option, and a flat activity
 *  table that the CSV importer reads back. */

import { dayNum, isoValid } from "./calendar";
import { compute, type Result } from "./cpm";
import { relText } from "./edit";
import type { ConstraintType, RelType, Schedule } from "./types";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const el = (name: string, v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "" : `<${name}>${typeof v === "number" ? v : x(v)}</${name}>`);
const hrs = (days: number) => `PT${Math.round(days * 8)}H0M0S`;
const am = (iso: string) => `${iso}T08:00:00`;
const pm = (iso: string) => `${iso}T17:00:00`;

/** Text1 carries the activity ID, so a round trip through Project keeps it. */
const TEXT1 = 188743731;

const CONS_OUT: Record<ConstraintType, number> = { MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };
const REL_OUT: Record<RelType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

export function toMspdi(s: Schedule, projectName: string, r: Result = compute(s)): string {
  // Unique IDs in outline order: WBS summaries, then their activities, then children.
  const uidOf = new Map<string, number>();
  let next = 1;
  const rows: string[] = [];
  const actsIn = new Map<string | null, typeof s.acts>();
  const known = new Set(s.wbs.map((w) => w.id));
  for (const a of s.acts) {
    const k = a.wbsId && known.has(a.wbsId) ? a.wbsId : null;
    actsIn.set(k, [...(actsIn.get(k) ?? []), a]);
  }
  const childrenOf = (parent: string | null) => s.wbs.filter((z) => (z.parentId && known.has(z.parentId) ? z.parentId : null) === parent);
  const order: Array<{ kind: "wbs" | "act"; id: string; outline: string; level: number }> = [];
  const walk = (parent: string | null, prefix: string, level: number) => {
    let n = 0;
    for (const a of actsIn.get(parent) ?? []) order.push({ kind: "act", id: a.id, outline: `${prefix}${++n}`, level });
    for (const w of childrenOf(parent)) {
      const outline = `${prefix}${++n}`;
      order.push({ kind: "wbs", id: w.id, outline, level });
      walk(w.id, `${outline}.`, level + 1);
    }
  };
  walk(null, "", 1);
  for (const o of order) uidOf.set(o.id, next++);

  const byId = new Map(s.acts.map((a) => [a.id, a]));
  // Project has no project-level deadline; put the contract completion on the open ends, where P6's must-finish-by acts.
  const hasSucc = new Set(s.rels.map((l) => l.pred));
  const wById = new Map(s.wbs.map((w) => [w.id, w]));
  rows.push(
    `<Task><UID>0</UID><ID>0</ID>${el("Name", projectName)}<Type>1</Type><IsNull>0</IsNull><WBS>0</WBS><OutlineNumber>0</OutlineNumber><OutlineLevel>0</OutlineLevel><Start>${am(r.start)}</Start><Finish>${pm(r.finish)}</Finish><DurationFormat>7</DurationFormat><Milestone>0</Milestone><Summary>1</Summary></Task>`,
  );
  for (const o of order) {
    const u = uidOf.get(o.id)!;
    if (o.kind === "wbs") {
      const w = wById.get(o.id)!;
      const roll = r.wbs.get(w.id);
      rows.push(
        `<Task><UID>${u}</UID><ID>${u}</ID>${el("Name", w.name)}<Manual>0</Manual><Type>1</Type><IsNull>0</IsNull>${el("WBS", o.outline)}<OutlineNumber>${o.outline}</OutlineNumber><OutlineLevel>${o.level}</OutlineLevel>${
          roll?.count ? `<Start>${am(roll.start)}</Start><Finish>${pm(roll.finish)}</Finish>` : ""
        }<DurationFormat>7</DurationFormat><Milestone>0</Milestone><Summary>1</Summary></Task>`,
      );
      continue;
    }
    const a = byId.get(o.id)!;
    const c = r.byId.get(a.id)!;
    const ms = a.type !== "task";
    const start = ms ? (a.type === "start" ? am(c.start) : pm(c.finish)) : am(c.start);
    const finish = ms ? start : pm(c.finish);
    const preds = s.rels
      .filter((l) => l.succ === a.id && uidOf.get(l.pred))
      .map(
        (l) =>
          `<PredecessorLink><PredecessorUID>${uidOf.get(l.pred)}</PredecessorUID><Type>${REL_OUT[l.type]}</Type><CrossProject>0</CrossProject><LinkLag>${l.lag * 480 * 10}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`,
      )
      .join("");
    const bl =
      a.bl && isoValid(a.bl.s) && isoValid(a.bl.f)
        ? `<Baseline><Number>0</Number><Start>${ms ? (a.type === "start" ? am(a.bl.s) : pm(a.bl.f)) : am(a.bl.s)}</Start><Finish>${ms ? (a.type === "start" ? am(a.bl.s) : pm(a.bl.f)) : pm(a.bl.f)}</Finish><Duration>${hrs(ms ? 0 : r.cal.span(a.bl.s, a.bl.f))}</Duration><DurationFormat>7</DurationFormat></Baseline>`
        : "";
    rows.push(
      [
        `<Task><UID>${u}</UID><ID>${u}</ID>${el("Name", a.name)}<Manual>0</Manual><Type>1</Type><IsNull>0</IsNull>`,
        `${el("WBS", o.outline)}<OutlineNumber>${o.outline}</OutlineNumber><OutlineLevel>${o.level}</OutlineLevel>`,
        `<Start>${start}</Start><Finish>${finish}</Finish><Duration>${hrs(ms ? 0 : a.dur)}</Duration><DurationFormat>7</DurationFormat>`,
        `<Milestone>${ms ? 1 : 0}</Milestone><Summary>0</Summary><Critical>${c.longest ? 1 : 0}</Critical>`,
        `<PercentComplete>${c.pct}</PercentComplete>`,
        c.status !== "planned" && isoValid(a.as) ? `<ActualStart>${am(a.as)}</ActualStart>` : "",
        c.status === "complete" && isoValid(a.af) ? `<ActualFinish>${pm(a.af)}</ActualFinish>` : "",
        `<RemainingDuration>${hrs(c.remaining)}</RemainingDuration>`,
        `<ConstraintType>${a.cons ? CONS_OUT[a.cons.type] : 0}</ConstraintType><CalendarUID>-1</CalendarUID>`,
        a.cons && isoValid(a.cons.date) ? `<ConstraintDate>${["MFO", "FNET", "FNLT"].includes(a.cons.type) ? pm(a.cons.date) : am(a.cons.date)}</ConstraintDate>` : "",
        s.deadline && isoValid(s.deadline) && !hasSucc.has(a.id) ? `<Deadline>${pm(s.deadline)}</Deadline>` : "",
        el("Notes", [a.resp ? `Responsible: ${a.resp}` : "", a.notes ?? ""].filter(Boolean).join("\n")),
        preds,
        `<ExtendedAttribute><FieldID>${TEXT1}</FieldID><Value>${x(a.code)}</Value></ExtendedAttribute>`,
        bl,
        `</Task>`,
      ].join(""),
    );
  }

  const week = s.calendar.week
    .map((on, i) =>
      on
        ? `<WeekDay><DayType>${i + 1}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`
        : `<WeekDay><DayType>${i + 1}</DayType><DayWorking>0</DayWorking></WeekDay>`,
    )
    .join("");
  const exceptions = s.calendar.holidays
    .filter(isoValid)
    .map((h) => `<Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>${h}T00:00:00</FromDate><ToDate>${h}T23:59:00</ToDate></TimePeriod><Occurrences>1</Occurrences><Name>Holiday</Name><Type>1</Type><DayWorking>0</DayWorking></Exception>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
<SaveVersion>14</SaveVersion>${el("Name", `${projectName}.xml`)}${el("Title", `${projectName} — ${s.name}`)}
<ScheduleFromStart>1</ScheduleFromStart><StartDate>${am(r.start < s.start ? r.start : s.start)}</StartDate><FinishDate>${pm(r.finish)}</FinishDate>
<CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime>
<MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>${480 * s.calendar.week.filter(Boolean).length}</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth>
<DurationFormat>7</DurationFormat><HonorConstraints>0</HonorConstraints><StatusDate>${am(s.dataDate)}</StatusDate>
<ExtendedAttributes><ExtendedAttribute><FieldID>${TEXT1}</FieldID><FieldName>Text1</FieldName><Alias>Activity ID</Alias></ExtendedAttribute></ExtendedAttributes>
<Calendars><Calendar><UID>1</UID>${el("Name", s.calendar.name)}<IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID><WeekDays>${week}</WeekDays>${exceptions ? `<Exceptions>${exceptions}</Exceptions>` : ""}</Calendar></Calendars>
<Tasks>
${rows.join("\n")}
</Tasks>
</Project>
`;
}

export const CSV_HEADERS = [
  "Activity ID",
  "Activity Name",
  "WBS",
  "Activity Type",
  "Original Duration",
  "Remaining Duration",
  "% Complete",
  "Start",
  "Finish",
  "Actual Start",
  "Actual Finish",
  "Total Float",
  "Free Float",
  "Longest Path",
  "Predecessors",
  "Baseline Start",
  "Baseline Finish",
  "Finish Variance (days)",
  "Constraint",
  "Constraint Date",
  "Responsible",
];

export function toRows(s: Schedule, r: Result = compute(s)): Array<Array<string | number | null>> {
  const code = new Map(s.acts.map((a) => [a.id, a.code]));
  const wbsName = new Map(s.wbs.map((w) => [w.id, w]));
  const path = (id: string | null) => {
    const parts: string[] = [];
    let cur = id ? wbsName.get(id) : undefined;
    while (cur && parts.length < 30) {
      parts.unshift(cur.name);
      cur = cur.parentId ? wbsName.get(cur.parentId) : undefined;
    }
    return parts.join(" > ");
  };
  return r.list.map((c) => {
    const a = c.a;
    return [
      a.code,
      a.name,
      path(a.wbsId),
      a.type === "task" ? "Task" : a.type === "start" ? "Start Milestone" : "Finish Milestone",
      a.dur,
      c.remaining,
      c.pct,
      c.start,
      c.finish,
      c.status !== "planned" ? (a.as ?? null) : null,
      c.status === "complete" ? (a.af ?? null) : null,
      c.tf,
      c.ff,
      c.longest ? "Yes" : "",
      s.rels
        .filter((l) => l.succ === a.id && code.has(l.pred))
        .map((l) => relText(l, code.get(l.pred)!).replace("−", "-"))
        .join(", "),
      a.bl?.s ?? null,
      a.bl?.f ?? null,
      a.bl && isoValid(a.bl.f) ? dayNum(c.finish) - dayNum(a.bl.f) : null,
      a.cons?.type ?? "",
      a.cons?.date ?? null,
      a.resp ?? "",
    ];
  });
}
