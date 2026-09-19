"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { CircleAlert, CircleCheck, FileDown, FileUp, Info } from "lucide-react";
import { Button, Spinner } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { downloadCsv } from "@/lib/exporters";
import { cx, fmtDate } from "@/lib/format";
import { CALENDAR_PRESETS, describeCalendar, isoValid, type CalendarPreset } from "@/lib/schedule/calendar";
import { ACCEPT, ImportError, readScheduleFile, recalcCheck, suggestedDataDate, toSchedule, type ImportSet, type Parsed } from "@/lib/schedule/import";
import { CURRENT_USER_ID, TODAY } from "@/mock/org";
import { PROJECTS } from "@/mock/projects";
import { Field, plural } from "./parts";
import { useSchedule } from "./state";

const HOW = [
  { tool: "Primavera P6", steps: "File › Export › Primavera PM (XER), or Oracle Primavera P6 (XML). One file can hold several projects; you'll pick one." },
  { tool: "Microsoft Project", steps: "File › Save As › XML Format (*.xml). The .mpp file itself can't be read outside Project." },
  { tool: "Spreadsheet", steps: "CSV with Activity ID, Activity Name, Duration, and Predecessors columns. Start, Finish, WBS, actuals, and baseline columns are read when present." },
];

/** Pick the project whose code or name appears in the file's own project ID or name. */
function guessProject(p: Parsed, fallback: string | null): string {
  const hay = `${p.ref} ${p.name}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = PROJECTS.find((x) => hay.includes(x.code.toLowerCase().replace(/[^a-z0-9]/g, "")) || hay.includes(x.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18)));
  return hit?.id ?? fallback ?? "";
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, add, gotoProject } = useSchedule();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [set, setSet] = useState<ImportSet | null>(null);
  const [pick, setPick] = useState(0);
  const [over, setOver] = useState(false);
  // Options
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [dataDate, setDataDate] = useState(TODAY);
  const [preset, setPreset] = useState<CalendarPreset | "file">("file");
  const [keepBl, setKeepBl] = useState(true);
  const [makeCurrent, setMakeCurrent] = useState(true);

  const { parsed, parseError } = useMemo(() => {
    if (!set) return { parsed: null, parseError: null };
    try {
      return { parsed: set.projects[pick]!.parse(), parseError: null };
    } catch (e) {
      return { parsed: null, parseError: e instanceof Error ? e.message : "The project couldn't be read." };
    }
  }, [set, pick]);

  useEffect(() => {
    if (!open) {
      setSet(null);
      setError(null);
      setPick(0);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!parsed) return;
    setProjectId(guessProject(parsed, project === "all" ? null : project));
    const month = isoValid(parsed.dataDate) ? fmtDate(parsed.dataDate, "month") : null;
    setName(month && !parsed.name.includes(month) ? `${parsed.name} (${month})` : parsed.name);
    setDataDate(suggestedDataDate(parsed, TODAY));
    setPreset(parsed.calendar ? "file" : "5day");
    setKeepBl(!!parsed.baselineFrom);
  }, [parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = useMemo(
    () =>
      parsed && projectId && isoValid(dataDate)
        ? toSchedule(parsed, { projectId, name, dataDate, preset: preset === "file" ? null : preset, keepBaseline: keepBl, by: CURRENT_USER_ID, at: TODAY })
        : null,
    [parsed, projectId, name, dataDate, preset, keepBl],
  );
  const check = useMemo(() => (parsed && draft ? recalcCheck(parsed, draft) : null), [parsed, draft]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSet(null);
    try {
      const s = await readScheduleFile(file);
      setPick(0);
      setSet(s);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `That file couldn't be read: ${e instanceof Error ? e.message : "unknown error"}.`);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files[0]);
  };

  const commit = () => {
    if (!draft || !parsed || !set) return;
    const s = { ...draft, name: name.trim() || parsed.name, source: { ...draft.source, label: set.file } };
    add(s, { current: makeCurrent });
    if (makeCurrent) gotoProject(projectId);
    onClose();
    toast(`Imported ${plural(s.acts.length, "activity", "activities")} and ${plural(s.rels.length, "relationship")} from ${set.file}`);
  };

  const stats = parsed
    ? [
        { label: "Activities", value: parsed.acts.length.toLocaleString("en-US") },
        { label: "Relationships", value: parsed.rels.length.toLocaleString("en-US") },
        { label: "WBS nodes", value: parsed.wbs.length.toLocaleString("en-US") },
        { label: "Milestones", value: parsed.acts.filter((a) => a.type !== "task").length.toLocaleString("en-US") },
        { label: "Complete", value: parsed.acts.filter((a) => a.af).length.toLocaleString("en-US") },
        { label: "In progress", value: parsed.acts.filter((a) => a.as && !a.af).length.toLocaleString("en-US") },
      ]
    : [];

  return (
    <Modal open={open} onClose={onClose} title="Import a schedule" description="From Primavera P6, Microsoft Project, or a spreadsheet. Nothing leaves this browser." className="w-[min(52rem,calc(100vw-2rem))]">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {!parsed ? (
          <div className="space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              className={cx("flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", over ? "border-accent bg-accent-wash" : "border-line-strong")}
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent-tint text-accent-ink">{busy ? <Spinner className="size-5" /> : <FileUp className="size-5" aria-hidden />}</div>
              <p className="text-md font-semibold text-ink">{busy ? "Reading the file…" : "Drop an XER, XML, or CSV file here"}</p>
              <p className="mt-1 text-sm text-ink-2">or</p>
              <input ref={input} id={`${id}-file`} type="file" accept={`${ACCEPT},.mpp,.mpx,.xlsx,.xls`} className="sr-only" onChange={(e) => (void read(e.target.files?.[0]), (e.target.value = ""))} />
              <Button className="mt-2" onClick={() => input.current?.click()} disabled={busy}>
                Choose a file
              </Button>
            </div>
            {(error ?? parseError) && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-neg-tint px-3 py-2.5 text-sm text-neg-ink">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error ?? parseError}
              </p>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">How to export</h3>
              <dl className="divide-y divide-line-soft rounded-md border border-line">
                {HOW.map((h) => (
                  <div key={h.tool} className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                    <dt className="text-sm font-semibold text-ink">{h.tool}</dt>
                    <dd className="text-sm text-ink-2">{h.steps}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                icon={<FileDown className="size-3.5" aria-hidden />}
                onClick={() =>
                  downloadCsv("schedule-import-template.csv", ["Activity ID", "Activity Name", "WBS", "Original Duration", "Predecessors", "Actual Start", "Actual Finish", "Responsible"], [
                    ["A1000", "Notice to proceed", "Preconstruction", 0, "", "", "", "Owner"],
                    ["A1010", "Construction documents", "Preconstruction", 40, "A1000", "", "", "Architect"],
                    ["A1020", "Permit review", "Preconstruction", 30, "A1010", "", "", "City"],
                    ["A1030", "Mobilize and demolition", "Construction > Phase 1", 15, "A1020", "", "", "General contractor"],
                    ["A1040", "MEP rough-in", "Construction > Phase 1", 30, "A1030SS+5", "", "", "Mechanical"],
                    ["A1050", "Substantial completion", "Closeout", 0, "A1040", "", "", ""],
                  ])
                }
              >
                Download a CSV template
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-3">
                  {set!.tool} · {set!.file}
                </p>
                <h3 className="text-md font-semibold text-ink">
                  {parsed.name}
                  {parsed.ref && parsed.ref !== parsed.name ? <span className="font-normal text-ink-3"> · {parsed.ref}</span> : null}
                </h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSet(null)}>
                Choose another file
              </Button>
            </div>

            {set!.projects.length > 1 && (
              <Field label={`This file holds ${set!.projects.length} projects`} htmlFor={`${id}-pick`}>
                <select id={`${id}-pick`} className="field w-full" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                  {set!.projects.map((x, i) => (
                    <option key={i} value={i}>
                      {x.ref} · {x.name} ({plural(x.activities, "activity", "activities")})
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 rounded-md bg-surface-2 px-4 py-3 sm:grid-cols-6">
              {stats.map((x) => (
                <div key={x.label}>
                  <dt className="text-xs text-ink-3">{x.label}</dt>
                  <dd className="num text-base font-semibold text-ink">{x.value}</dd>
                </div>
              ))}
            </dl>

            {check && (
              <div className={cx("flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm", check.finishDiff === null || check.finishDiff === 0 ? "bg-pos-tint text-pos-ink" : "bg-warn-tint text-warn-ink")}>
                {check.finishDiff === 0 ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <div>
                  {check.fileFinish ? (
                    check.finishDiff === 0 ? (
                      <p>
                        <span className="font-semibold">Recalculated finish matches the file: {fmtDate(check.finish)}.</span> {check.moved ? `${plural(check.moved, "open activity", "open activities")} of ${check.compared} land on a different date, most likely from calendars or leveling.` : "Every open activity lands on the file's dates."}
                      </p>
                    ) : (
                      <p>
                        <span className="font-semibold">
                          Recalculated finish is {fmtDate(check.finish)}, {Math.abs(check.finishDiff!)} {Math.abs(check.finishDiff!) === 1 ? "day" : "days"} {check.finishDiff! > 0 ? "later" : "earlier"} than the file’s {fmtDate(check.fileFinish)}.
                        </span>{" "}
                        {plural(check.moved, "open activity", "open activities")} of {check.compared} moved. Differences usually come from multiple calendars, resource leveling, level-of-effort activities, or a data date that doesn’t match the file’s. Worth asking the scheduler about.
                      </p>
                    )
                  ) : (
                    <p>
                      <span className="font-semibold">Calculated finish: {fmtDate(check.finish)}.</span> The file doesn’t state its own finish to check against.
                    </p>
                  )}
                  {check.loops > 0 && <p className="mt-1 font-semibold text-neg-ink">{plural(check.loops, "relationship")} closed a loop and will be ignored until fixed.</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Control Center project" htmlFor={`${id}-project`}>
                <select id={`${id}-project`} className="field w-full" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-invalid={!projectId}>
                  <option value="">Choose a project</option>
                  {PROJECTS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Version name" htmlFor={`${id}-name`}>
                <input id={`${id}-name`} className="field w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Data date" htmlFor={`${id}-dd`} hint={parsed.dataDate ? `The file says ${fmtDate(parsed.dataDate)}.` : "The file doesn't carry one; this is a guess from its actual dates."}>
                <input id={`${id}-dd`} type="date" className="field w-full" value={dataDate} onChange={(e) => setDataDate(e.target.value)} />
              </Field>
              <Field label="Calendar" htmlFor={`${id}-cal`} hint={parsed.calendar && preset === "file" ? describeCalendar(parsed.calendar) : undefined}>
                <select id={`${id}-cal`} className="field w-full" value={preset} onChange={(e) => setPreset(e.target.value as CalendarPreset | "file")}>
                  {parsed.calendar && <option value="file">From the file: {parsed.calendar.name}</option>}
                  {(Object.keys(CALENDAR_PRESETS) as CalendarPreset[]).map((k) => (
                    <option key={k} value={k}>
                      {CALENDAR_PRESETS[k].label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-start gap-2 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={keepBl} disabled={!parsed.baselineFrom} onChange={(e) => setKeepBl(e.target.checked)} />
                <span>{parsed.baselineFrom ? `Use ${parsed.baselineFrom} as the baseline` : "The file has no baseline dates"}</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
                <span>Make it the project’s current schedule</span>
              </label>
            </div>

            {(parsed.warnings.length > 0 || parsed.notes.length > 0) && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-ink">What to know</h3>
                <ul className="space-y-1.5">
                  {parsed.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-sm text-warn-ink">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                  {parsed.notes.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-sm text-ink-2">
                      <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!draft || !name.trim()} onClick={commit}>
          Import
        </Button>
      </div>
    </Modal>
  );
}
