"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { addDays, cx, fmtDate } from "@/lib/format";
import { durations, fitMilestones, fromSpec, type Frame, type SpecAct, type SpecWbs } from "@/lib/schedule/build";
import { CALENDAR_PRESETS, isoValid, type CalendarPreset } from "@/lib/schedule/calendar";
import { captureBaseline, compute, progressAsPlanned } from "@/lib/schedule/cpm";
import { uid } from "@/lib/schedule/edit";
import { TEMPLATES } from "@/lib/schedule/templates";
import type { Schedule } from "@/lib/schedule/types";
import { CURRENT_USER_ID, TODAY } from "@/mock/org";
import { projectById, PROJECTS, type Project } from "@/mock/projects";
import { Field, plural } from "./parts";
import { useSchedule } from "./state";

type Start = "copy" | "milestones" | "blank" | `tpl:${string}`;

/** A new version: the next update of the current one, a template, a skeleton from the project record's milestones, or a blank page. */
export function NewScheduleDialog({ start, onClose }: { start: string | null | false; onClose: () => void }) {
  const { add, gotoProject, currentFor } = useSchedule();
  const id = useId();
  const [projectId, setProjectId] = useState<string>("");
  const [from, setFrom] = useState<Start>("blank");
  const [name, setName] = useState("");
  const [begin, setBegin] = useState(TODAY);
  const [dataDate, setDataDate] = useState(TODAY);
  const [preset, setPreset] = useState<CalendarPreset>("5day");
  const [deadline, setDeadline] = useState("");
  const [setBl, setSetBl] = useState(true);

  const p = projectId ? projectById(projectId) : undefined;
  const cur = projectId ? currentFor(projectId) : null;

  // Reset to sensible defaults for the project each time the dialog opens or the project changes.
  useEffect(() => {
    if (start === false) return;
    setProjectId(start ?? "");
  }, [start]);
  useEffect(() => {
    if (!p) return;
    const latest = currentFor(p.id);
    const tpl = TEMPLATES.find((t) => t.archetype === p.archetype);
    setFrom(latest ? "copy" : tpl ? `tpl:${tpl.id}` : "blank");
    setBegin(p.start < TODAY ? p.start : TODAY);
    setDataDate(latest ? addDays(latest.dataDate, 30) : TODAY < p.start ? p.start : TODAY);
    setDeadline(p.baselineFinish);
    setPreset("5day");
    setSetBl(true);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!p) return setName("");
    if (from === "copy" && cur) {
      const m = /(\d+)/.exec(cur.name);
      setName(m ? cur.name.replace(/\(.*\)$/, "").replace(m[1]!, String(Number(m[1]) + 1)).trim() + ` (${fmtDate(dataDate, "month")})` : `${cur.name} (next update)`);
    } else if (from === "milestones") setName("Milestone skeleton");
    else if (from.startsWith("tpl:")) setName("Owner's plan");
    else setName("Working schedule");
  }, [from, p?.id, cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = !!p && name.trim() && isoValid(dataDate) && (from === "copy" || isoValid(begin));

  const create = () => {
    if (!p || !valid) return;
    const s = build(p, from, { name: name.trim(), begin, dataDate, preset, deadline: isoValid(deadline) ? deadline : null, baseline: setBl, cur });
    add(s, { current: true });
    gotoProject(p.id);
    onClose();
    toast(`${s.name} created with ${plural(s.acts.length, "activity", "activities")}`);
  };

  const options: Array<{ value: Start; label: string; about: string; hidden?: boolean }> = [
    { value: "copy", label: cur ? `Next update of ${cur.name}` : "Next update", about: "Copies the current version, including its logic and baseline, and statuses it as planned to the new data date. Correct the exceptions and you have this month’s update.", hidden: !cur },
    ...TEMPLATES.map((t) => ({ value: `tpl:${t.id}` as Start, label: t.name, about: t.about })),
    { value: "milestones", label: "Skeleton from the project record’s milestones", about: p ? `Links the ${p.milestones.length} recorded milestones in sequence with a work activity before each, sized to land on their dates. The recorded baselines become the baseline.` : "" },
    { value: "blank", label: "Blank", about: "A notice-to-proceed milestone and nothing else." },
  ];

  return (
    <Modal open={start !== false} onClose={onClose} title="New schedule" description="Build a version here instead of importing one." className="w-[min(46rem,calc(100vw-2rem))]">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Field label="Project" htmlFor={`${id}-project`}>
          <select id={`${id}-project`} className="field w-full" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Choose a project</option>
            {PROJECTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} · {x.name}
              </option>
            ))}
          </select>
        </Field>

        {p && (
          <>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold text-ink-2">Start from</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options
                  .filter((o) => !o.hidden)
                  .map((o) => (
                    <label key={o.value} className={cx("flex cursor-pointer gap-2.5 rounded-md border px-3 py-2.5", from === o.value ? "border-accent bg-accent-wash" : "border-line hover:border-line-strong")}>
                      <input type="radio" name={`${id}-from`} className="mt-1 accent-[var(--accent)]" checked={from === o.value} onChange={() => setFrom(o.value)} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">
                          {o.label}
                          {o.value.startsWith("tpl:") && TEMPLATES.find((t) => `tpl:${t.id}` === o.value)?.archetype === p.archetype && <span className="ml-1.5 text-2xs font-semibold text-accent-ink">Suggested</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-3">{o.about}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Version name" htmlFor={`${id}-name`} className="sm:col-span-2">
                <input id={`${id}-name`} className="field w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {from !== "copy" && (
                <Field label="Planned start" htmlFor={`${id}-begin`}>
                  <input id={`${id}-begin`} type="date" className="field w-full" value={begin} onChange={(e) => setBegin(e.target.value)} />
                </Field>
              )}
              <Field label="Data date" htmlFor={`${id}-dd`} hint={from === "copy" && cur ? `The current version’s is ${fmtDate(cur.dataDate)}.` : "Work planned before it is statused as done."}>
                <input id={`${id}-dd`} type="date" className="field w-full" value={dataDate} onChange={(e) => setDataDate(e.target.value)} />
              </Field>
              {from !== "copy" && (
                <>
                  <Field label="Calendar" htmlFor={`${id}-cal`}>
                    <select id={`${id}-cal`} className="field w-full" value={preset} onChange={(e) => setPreset(e.target.value as CalendarPreset)}>
                      {(Object.keys(CALENDAR_PRESETS) as CalendarPreset[]).map((k) => (
                        <option key={k} value={k}>
                          {CALENDAR_PRESETS[k].label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Contract completion" htmlFor={`${id}-deadline`} hint="Defaults to the project’s baseline finish.">
                    <input id={`${id}-deadline`} type="date" className="field w-full" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </Field>
                  {from !== "milestones" && from !== "blank" && (
                    <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
                      <input type="checkbox" className="accent-[var(--accent)]" checked={setBl} onChange={(e) => setSetBl(e.target.checked)} />
                      Set the baseline from these dates
                    </label>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!valid} onClick={create}>
          Create
        </Button>
      </div>
    </Modal>
  );
}

function build(
  p: Project,
  from: Start,
  o: { name: string; begin: string; dataDate: string; preset: CalendarPreset; deadline: string | null; baseline: boolean; cur: Schedule | null },
): Schedule {
  const source = { kind: "native" as const, at: TODAY, by: CURRENT_USER_ID };
  if (from === "copy" && o.cur) {
    const copy: Schedule = { ...o.cur, id: uid("s"), name: o.name, source: { ...source, label: `Copied from ${o.cur.name}` }, updated: TODAY };
    return o.dataDate > o.cur.dataDate ? progressAsPlanned(copy, o.dataDate) : { ...copy, dataDate: o.dataDate };
  }
  const y0 = Number(o.begin.slice(0, 4));
  const frame: Frame = {
    id: uid("s"),
    projectId: p.id,
    name: o.name,
    source,
    dataDate: o.begin,
    start: o.begin,
    deadline: o.deadline,
    calendar: CALENDAR_PRESETS[o.preset].make(y0, y0 + 5),
    baselineName: null,
    updated: TODAY,
  };
  const status = (s: Schedule) => (o.dataDate > o.begin ? progressAsPlanned(s, o.dataDate) : { ...s, dataDate: o.dataDate });

  if (from.startsWith("tpl:")) {
    const t = TEMPLATES.find((x) => `tpl:${x.id}` === from)!;
    let s = fromSpec(t.spec, { ...frame, source: { kind: "template", label: t.name, at: TODAY, by: CURRENT_USER_ID } });
    if (o.baseline) s = captureBaseline(s, "Owner's plan");
    return status(s);
  }

  if (from === "milestones") {
    const ms = [...p.milestones].sort((a, b) => a.baseline.localeCompare(b.baseline));
    const acts: SpecAct[] = [{ c: "A1000", n: "Notice to proceed", d: 0, t: "start" }];
    ms.forEach((m, i) => {
      const work = `A${1010 + i * 20}`;
      const mark = `A${1020 + i * 20}`;
      // Lower-case the first word unless it's an acronym ("GMP executed").
      const lead = /^[A-Z]{2,}/.test(m.name) ? m.name : m.name.charAt(0).toLowerCase() + m.name.slice(1);
      acts.push({ c: work, n: `Work leading to ${lead}`, d: 10, p: i ? `A${1000 + i * 20}` : "A1000" });
      acts.push({ c: mark, n: m.name, d: 0, t: "finish", p: work, key: m.name });
    });
    const spec: SpecWbs[] = [{ code: "1", name: "Key milestones", acts }];
    const first = ms.reduce((min, m) => [m.baseline, m.actual ?? m.forecast, min].sort()[0]!, o.begin);
    const f2 = { ...frame, start: first < o.begin ? addDays(first, -30) : o.begin, dataDate: first < o.begin ? addDays(first, -30) : o.begin };
    const target = (pick: "baseline" | "forecast") => Object.fromEntries(acts.filter((a) => a.key).map((a) => [a.c, (() => { const m = ms.find((x) => x.name === a.key)!; return pick === "baseline" ? m.baseline : (m.actual ?? m.forecast); })()]));
    const bl = fitMilestones(fromSpec(spec, f2), target("baseline"));
    const blDates = new Map(compute(bl).list.map((c) => [c.a.code, { s: c.start, f: c.finish }]));
    const cur = fitMilestones(fromSpec(spec, f2, durations(bl)), target("forecast"));
    const withBl = { ...cur, baselineName: "Project record baselines", acts: cur.acts.map((a) => ({ ...a, bl: blDates.get(a.code) ?? null })) };
    return o.dataDate > f2.dataDate ? progressAsPlanned(withBl, o.dataDate) : { ...withBl, dataDate: o.dataDate };
  }

  return status(fromSpec([{ code: "1", name: p.name, acts: [{ c: "A1000", n: "Notice to proceed", d: 0, t: "start" }] }], frame));
}
