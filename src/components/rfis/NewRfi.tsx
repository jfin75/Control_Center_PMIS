"use client";

import { useEffect, useState } from "react";
import { FilePen, Send } from "lucide-react";
import { Button } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { fmtDate } from "@/lib/format";
import { createRfi, dueFor, whoName, type ImpactInput } from "@/lib/rfis";
import { CONTRACTORS, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { defaultAssignee, DISCIPLINES, PRIORITIES, PRIORITY_ORDER, rfiNumber, RFI_PROJECT_IDS, type RfiDiscipline, type RfiPriority, type Who } from "@/mock/rfis";
import { FileDrop, storeFiles } from "./files";
import { ImpactFields } from "./ImpactFields";
import { reviewerOptions, WhoSelect } from "./parts";
import { useRfis } from "./state";

const ORIGINATORS = CONTRACTORS.filter((c) => c.kind === "General Contractor" || c.kind === "Trade Contractor" || c.kind === "Vendor");
const NO_IMPACT: ImpactInput = { costImpact: "none", costEstimate: null, scheduleImpact: "none", scheduleDays: null, changeRef: "" };

/** Log a new RFI, as a draft or issued straight to the reviewer. */
export function NewRfi({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, rfis, save, openRfi } = useRfis();
  const [projectId, setProjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [discipline, setDiscipline] = useState<RfiDiscipline>("Architectural");
  const [section, setSection] = useState("");
  const [drawing, setDrawing] = useState("");
  const [location, setLocation] = useState("");
  const [fromId, setFromId] = useState("");
  const [assignee, setAssignee] = useState<Who | null>(null);
  const [priority, setPriority] = useState<RfiPriority>("normal");
  const [due, setDue] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactInput>(NO_IMPACT);
  const [files, setFiles] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  // Start each visit from the page's project filter.
  useEffect(() => {
    if (!open) return;
    const pid = project === "all" ? RFI_PROJECT_IDS[0]! : project;
    setProjectId(pid);
    setFromId(projectById(pid)!.gcId);
    setSubject("");
    setQuestion("");
    setSuggestion("");
    setDiscipline("Architectural");
    setSection("");
    setDrawing("");
    setLocation("");
    setAssignee(null);
    setPriority("normal");
    setDue(null);
    setImpact(NO_IMPACT);
    setFiles([]);
    setTried(false);
    setBusy(false);
  }, [open, project]);

  const p = projectById(projectId);
  const effAssignee = assignee ?? (p ? defaultAssignee(p, discipline) : null);
  const effDue = due ?? dueFor(priority);
  const seq = projectId ? rfis.filter((r) => r.projectId === projectId).reduce((a, r) => Math.max(a, r.seq), 0) + 1 : 1;
  const errors = { subject: !subject.trim(), question: !question.trim(), assignee: !effAssignee, due: effDue < TODAY };

  const submit = async (issue: boolean) => {
    setTried(true);
    if (Object.values(errors).some(Boolean) || !p || !effAssignee) return;
    setBusy(true);
    const by: Who = { kind: "firm", id: fromId };
    let stored: Awaited<ReturnType<typeof storeFiles>> = [];
    try {
      if (files.length) stored = await storeFiles(files, by, projectId);
    } catch {
      setBusy(false);
      toast("Couldn't save the files in this browser; the RFI wasn't created");
      return;
    }
    const r = createRfi(
      { projectId, subject, question, suggestion, discipline, section, drawing, location, fromId, assignee: effAssignee, distribution: [], priority, due: effDue, ...impact, files: stored },
      { issue, by, rfis },
    );
    save(r);
    toast(issue ? `${rfiNumber(r)} issued to ${whoName(effAssignee)} · due ${fmtDate(effDue)}` : `${rfiNumber(r)} saved as a draft`);
    onClose();
    openRfi(r.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="New RFI" description="A question the contract documents don't answer. Issuing starts the response clock for the reviewer." className="w-[min(48rem,calc(100vw-2rem))]">
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(true);
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Project</span>
              <select
                className="field mt-1 w-full"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setFromId(projectById(e.target.value)!.gcId);
                  setAssignee(null);
                }}
              >
                {RFI_PROJECT_IDS.map((id) => {
                  const x = projectById(id)!;
                  return (
                    <option key={id} value={id}>
                      {x.code} · {x.name}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">From</span>
              <select className="field mt-1 w-full" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {ORIGINATORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">
              Subject <span className="num font-normal text-ink-3">· will be {rfiNumber({ seq })}</span>
            </span>
            <input className="field mt-1 w-full" value={subject} aria-invalid={(tried && errors.subject) || undefined} onChange={(e) => setSubject(e.target.value)} placeholder="Duct routing conflict at corridor B" />
            {tried && errors.subject && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Give the RFI a subject.</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Question</span>
            <textarea
              className="field mt-1 w-full"
              rows={4}
              value={question}
              aria-invalid={(tried && errors.question) || undefined}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What the documents show, what the field found, and what you need answered"
            />
            {tried && errors.question && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Ask the question.</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Proposed solution</span>
            <textarea className="field mt-1 w-full" rows={2} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Optional" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Discipline</span>
              <select
                className="field mt-1 w-full"
                value={discipline}
                onChange={(e) => {
                  setDiscipline(e.target.value as RfiDiscipline);
                  setAssignee(null);
                }}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Spec section</span>
              <input className="field num mt-1 w-full" value={section} onChange={(e) => setSection(e.target.value)} placeholder="23 31 13" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Drawing</span>
              <input className="field num mt-1 w-full" value={drawing} onChange={(e) => setDrawing(e.target.value)} placeholder="M-201" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Location</span>
              <input className="field mt-1 w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Corridor B" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_10rem]">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Assign to</span>
              {projectId && <WhoSelect projectId={projectId} options={reviewerOptions(projectId)} value={effAssignee} onChange={setAssignee} className="mt-1" invalid={tried && errors.assignee} />}
              <span className="mt-0.5 block text-xs text-ink-3">{assignee ? "Chosen" : "Default"} reviewer for {discipline.toLowerCase()} questions</span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Priority</span>
              <select
                className="field mt-1 w-full"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value as RfiPriority);
                  setDue(null);
                }}
              >
                {PRIORITY_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {PRIORITIES[k].label} · {PRIORITIES[k].days} days
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Response due</span>
              <input type="date" className="field num mt-1 w-full" min={TODAY} value={effDue} aria-invalid={(tried && errors.due) || undefined} onChange={(e) => setDue(e.target.value || null)} />
              {tried && errors.due && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Pick today or later.</span>}
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Potential impact</legend>
            <p className="text-xs text-ink-3">Flag cost or time the answer could carry, so the Owner sees the exposure before a PCO exists.</p>
            <div className="mt-2">
              <ImpactFields value={impact} onChange={setImpact} />
            </div>
          </fieldset>
          <div>
            <span className="text-sm font-semibold text-ink">Attachments</span>
            <div className="mt-1">
              <FileDrop files={files} onChange={setFiles} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} icon={<FilePen className="size-3.5" aria-hidden />} onClick={() => void submit(false)}>
            Save draft
          </Button>
          <Button type="submit" variant="primary" loading={busy} icon={<Send className="size-3.5" aria-hidden />}>
            Issue RFI
          </Button>
        </div>
      </form>
    </Modal>
  );
}
