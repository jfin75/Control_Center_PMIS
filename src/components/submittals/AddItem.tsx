"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { fmtDate, addDays } from "@/lib/format";
import { createItem, partyName, submitByFor } from "@/lib/submittals";
import { CONTRACTORS, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { LONG_LEAD_WEEKS, REGISTER_PROJECT_IDS, REVIEW_DAYS, SPEC_SECTIONS, SUBMITTAL_TYPES, type Party, type SubmittalType } from "@/mock/submittals";
import { routeOptions } from "./PackageBuilder";
import { RoutePicker } from "./parts";
import { useSubmittals } from "./state";

const SUBMITTERS = CONTRACTORS.filter((c) => c.kind === "General Contractor" || c.kind === "Trade Contractor" || c.kind === "Vendor");
const SECTION_RE = /^\d{2} \d{2} \d{2}$/;

/** Add a line to a project's submittal register. */
export function AddItem({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, subs, commit, openItem } = useSubmittals();
  const listId = useId();
  const [projectId, setProjectId] = useState("");
  const [section, setSection] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SubmittalType>("Product data");
  const [byId, setById] = useState("");
  const [ros, setRos] = useState(addDays(TODAY, 120));
  const [lead, setLead] = useState(4);
  const [reviewDays, setReviewDays] = useState(REVIEW_DAYS["Product data"]);
  const [route, setRoute] = useState<Party[] | null>(null);
  const [tried, setTried] = useState(false);

  // Start each visit from the page's project filter.
  useEffect(() => {
    if (!open) return;
    const pid = project === "all" ? REGISTER_PROJECT_IDS[0]! : project;
    setProjectId(pid);
    setById(projectById(pid)!.gcId);
    setSection("");
    setSectionTitle("");
    setTitle("");
    setType("Product data");
    setRos(addDays(TODAY, 120));
    setLead(4);
    setReviewDays(REVIEW_DAYS["Product data"]);
    setRoute(null);
    setTried(false);
  }, [open, project]);

  const options = routeOptions(projectId);
  const effRoute = route ?? options.filter((o) => o.kind === "firm" && o.id !== "c-cedarmark" && o.id !== "c-meridian-eq").slice(0, 1);
  const submitBy = ros ? submitByFor(ros, lead, reviewDays) : null;
  const errors = {
    section: !SECTION_RE.test(section.trim()),
    sectionTitle: !sectionTitle.trim(),
    title: !title.trim(),
    ros: !ros,
    route: !effRoute.length,
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = () => {
    setTried(true);
    if (!valid) return;
    const s = createItem({ projectId, section: section.trim(), sectionTitle, title, type, byId, requiredOnSite: ros, leadWeeks: lead, reviewDays, reviewers: effRoute }, subs);
    commit({ subs: [s] });
    toast(`${s.section}-${String(s.seq).padStart(2, "0")} added to the ${projectById(projectId)!.code} register`);
    onClose();
    openItem(s.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a register item" description="One line per required submittal. The submit-by date comes from the need date, lead time, and review period." className="w-[min(44rem,calc(100vw-2rem))]">
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Project</span>
            <select
              className="field mt-1 w-full"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setById(projectById(e.target.value)!.gcId);
                setRoute(null);
              }}
            >
              {REGISTER_PROJECT_IDS.map((id) => {
                const x = projectById(id)!;
                return (
                  <option key={id} value={id}>
                    {x.code} · {x.name}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Spec section</span>
              <input
                className="field num mt-1 w-full"
                list={listId}
                placeholder="23 73 13"
                value={section}
                aria-invalid={(tried && errors.section) || undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setSection(v);
                  const hit = SPEC_SECTIONS.find((x) => x.section === v.trim());
                  if (hit) setSectionTitle(hit.title);
                }}
              />
              <datalist id={listId}>
                {SPEC_SECTIONS.map((x) => (
                  <option key={x.section} value={x.section}>
                    {x.title}
                  </option>
                ))}
              </datalist>
              {tried && errors.section && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Use the six-digit form, e.g. 23 73 13.</span>}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Section title</span>
              <input className="field mt-1 w-full" value={sectionTitle} aria-invalid={(tried && errors.sectionTitle) || undefined} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Modular Indoor Central-Station AHUs" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Item title</span>
            <input className="field mt-1 w-full" value={title} aria-invalid={(tried && errors.title) || undefined} onChange={(e) => setTitle(e.target.value)} placeholder="AHU product data & fan curves" />
            {tried && errors.title && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Name the submittal.</span>}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Type</span>
              <select
                className="field mt-1 w-full"
                value={type}
                onChange={(e) => {
                  const t = e.target.value as SubmittalType;
                  setType(t);
                  setReviewDays(REVIEW_DAYS[t]);
                }}
              >
                {SUBMITTAL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Responsible firm</span>
              <select className="field mt-1 w-full" value={byId} onChange={(e) => setById(e.target.value)}>
                {SUBMITTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Needed on site</span>
              <input type="date" className="field num mt-1 w-full" value={ros} aria-invalid={(tried && errors.ros) || undefined} onChange={(e) => setRos(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Lead time</span>
              <span className="relative mt-1 block">
                <input type="number" min={0} max={80} className="field num w-full pr-14 text-right" value={lead} onChange={(e) => setLead(Math.max(0, Math.min(80, Number(e.target.value) || 0)))} />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-3">weeks</span>
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Review period</span>
              <span className="relative mt-1 block">
                <input type="number" min={3} max={60} className="field num w-full pr-12 text-right" value={reviewDays} onChange={(e) => setReviewDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-3">days</span>
              </span>
            </label>
          </div>
          {submitBy && (
            <p className="text-sm text-ink-2">
              Submit by <span className={submitBy < TODAY ? "num font-semibold text-neg-ink" : "num font-semibold text-ink"}>{fmtDate(submitBy)}</span>
              {submitBy < TODAY && " — already past, so it will show as late"}. {lead >= LONG_LEAD_WEEKS ? "Long-lead items carry one resubmittal cycle of float." : "Includes a week of float."}
            </p>
          )}
          <RoutePicker options={options} value={effRoute} onChange={setRoute} names={partyName} invalid={tried && errors.route} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Add to register
          </Button>
        </div>
      </form>
    </Modal>
  );
}
