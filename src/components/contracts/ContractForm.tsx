"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, FilePen, Send } from "lucide-react";
import { AttachmentChip, FileDrop, storeFiles } from "@/components/rfis/files";
import { Badge } from "@/components/ui/data";
import { Button, Segmented, Switch, Tabs } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { deleteFiles } from "@/lib/attachments";
import { cx, money } from "@/lib/format";
import { blankContract, missingOf, nextNumber, saveContract, warningsOf, type Missing } from "@/lib/contracts";
import { COST_CODES } from "@/mock/costCodes";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  ORDER_NAME,
  STRUCTURE_ORDER,
  STRUCTURES,
  TEMPLATES,
  templateById,
  type Category,
  type Contract,
  type Field,
  type Structure,
  type Template,
} from "@/mock/contracts";
import type { Attachment } from "@/mock/rfis";
import { CONTRACTORS, PEOPLE } from "@/mock/org";
import { projectById, PROJECTS } from "@/mock/projects";
import { DocPreview, DownloadDocButton, exhibitLetter, exhibitStatus } from "./Document";
import { plural, TabLabel } from "./parts";
import { useContracts, type FormStart } from "./state";

const TITLE_HINT: Record<Category, string> = {
  construction: "General construction",
  ae: "Architectural design services",
  consultant: "Commissioning authority",
  vendor: "Imaging equipment purchase and installation",
};

const MANAGERS = PEOPLE.filter((p) => p.role === "PM" || p.role === "Procurement" || p.role === "Cost Controller" || p.role === "Owner Executive");

/** Picked files count toward an exhibit before they're stored. */
function withPending(c: Contract, files: Record<string, File[]>): Contract {
  return {
    ...c,
    exhibits: c.exhibits.map((e) =>
      files[e.key]?.length
        ? { ...e, files: [...e.files, ...files[e.key]!.map((f, i): Attachment => ({ id: `pending-${e.key}-${i}`, name: f.name, size: f.size, type: f.type, added: c.created, by: { kind: "staff", id: c.ownerRepId }, stored: false }))] }
        : e,
    ),
  };
}

/**
 * The contract form: pick a template, then fill its blanks tab by tab, attach
 * or describe each exhibit, and review the filled-in document before it goes
 * to Legal & Risk.
 */
export function ContractForm({ start, onClose }: { start: FormStart | null; onClose: () => void }) {
  const { contracts, saveContracts, openContract, me, project } = useContracts();
  const [c, setC] = useState<Contract | null>(null);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [tab, setTab] = useState("template");
  const [category, setCategory] = useState<Category>("construction");
  const [structure, setStructure] = useState<Structure>("standalone");
  const [repTouched, setRepTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const isNew = !start?.contract;

  const masterFor = (x: Contract, parentId: string | null): Contract => {
    const m = parentId ? contracts.find((y) => y.id === parentId) : null;
    return m ? { ...x, parentId: m.id, counterpartyId: m.counterpartyId, code: m.code } : { ...x, parentId: null };
  };
  const withProject = (x: Contract, projectId: string | null, touched: boolean): Contract => {
    const p = projectId ? projectById(projectId) : null;
    return { ...x, projectId, ownerRepId: !touched && p ? p.pmId : x.ownerRepId };
  };

  // Start each visit fresh: an edit loads the saved draft; a new contract starts from the preset or the template picker.
  useEffect(() => {
    if (!start) return;
    setFiles({});
    setTried(false);
    setBusy(false);
    setRepTouched(!!start.contract);
    if (start.contract) {
      const t = templateById(start.contract.templateId)!;
      setC(structuredClone(start.contract));
      setCategory(t.category);
      setStructure(t.structure);
      setTab(start.tab ?? "parties");
      return;
    }
    const t = start.templateId ? templateById(start.templateId) : undefined;
    if (!t) {
      setC(null);
      setTab("template");
      return;
    }
    let x = blankContract(t, me.id);
    if (t.structure !== "master") x = withProject(x, start.projectId ?? (project !== "all" ? project : null), false);
    if (t.structure === "task") x = masterFor(x, start.parentId ?? null);
    setC(x);
    setCategory(t.category);
    setStructure(t.structure);
    setTab("parties");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [tab]);

  const t = c ? templateById(c.templateId)! : null;
  const view = useMemo(() => (c ? withPending(c, files) : null), [c, files]);
  const missing: Missing[] = view && t ? missingOf(view, t) : [];
  const warnings = view && t ? warningsOf(view, t, contracts) : [];
  const count = (id: string) => missing.filter((m) => m.tab === id).length;

  const order = t ? [...(isNew ? ["template"] : []), "parties", ...t.sections.map((s) => s.id), "exhibits", "review"] : ["template"];
  const at = order.indexOf(tab);
  const tabs = t
    ? [
        ...(isNew ? [{ value: "template", label: "Template" }] : []),
        { value: "parties", label: <TabLabel label="Parties" missing={tried ? count("parties") : 0} /> },
        ...t.sections.map((s) => ({ value: s.id, label: <TabLabel label={s.label} missing={tried ? count(s.id) : 0} /> })),
        { value: "exhibits", label: <TabLabel label="Exhibits" missing={tried ? count("exhibits") : 0} /> },
        { value: "review", label: <TabLabel label="Review" missing={missing.length} /> },
      ]
    : [{ value: "template", label: "Template" }];

  const set = (patch: Partial<Contract>) => setC((x) => (x ? { ...x, ...patch } : x));
  const setValue = (key: string, v: string) => setC((x) => (x ? { ...x, values: { ...x.values, [key]: v } } : x));
  const setExhibit = (key: string, patch: Partial<Contract["exhibits"][number]>) => setC((x) => (x ? { ...x, exhibits: x.exhibits.map((e) => (e.key === key ? { ...e, ...patch } : e)) } : x));

  /** Switch templates, keeping what still applies. */
  const choose = (next: Template) => {
    let x = blankContract(next, c?.ownerRepId ?? me.id);
    if (c) {
      x.title = c.title;
      if (CATEGORIES[next.category].kinds.includes(CONTRACTORS.find((k) => k.id === c.counterpartyId)?.kind ?? "Vendor") && templateById(c.templateId)!.category === next.category) x.counterpartyId = c.counterpartyId;
      if (next.structure !== "master") x = withProject(x, c.projectId, repTouched);
    } else if (next.structure !== "master") x = withProject(x, project !== "all" ? project : null, false);
    if (next.structure === "task") x = masterFor(x, null);
    setC(x);
    setFiles({});
  };

  const save = async (submit: boolean) => {
    if (!c || !t) return;
    setTried(true);
    const blockers = submit ? missing : missing.filter((m) => m.tab === "parties");
    if (blockers.length) {
      setTab(submit ? "review" : "parties");
      toast(submit ? `${plural(blockers.length, "item")} to finish before Legal review` : "Name the contract, its project, and the other party to save a draft");
      return;
    }
    setBusy(true);
    const stored: Attachment[] = [];
    let exhibits = c.exhibits;
    try {
      for (const [key, list] of Object.entries(files)) {
        if (!list.length) continue;
        const got = await storeFiles(list, me, c.projectId ?? "program");
        stored.push(...got);
        exhibits = exhibits.map((e) => (e.key === key ? { ...e, files: [...e.files, ...got] } : e));
      }
    } catch {
      await deleteFiles(stored.map((a) => a.id)).catch(() => undefined);
      setBusy(false);
      toast("Couldn't save the files in this browser; nothing was saved");
      return;
    }
    const saved = saveContract({ ...c, exhibits }, contracts, me, submit);
    saveContracts(saved);
    // Files removed from a saved draft leave browser storage too.
    if (start?.contract) {
      const kept = new Set(saved.exhibits.flatMap((e) => e.files.map((f) => f.id)));
      const gone = start.contract.exhibits.flatMap((e) => e.files).filter((f) => f.stored && !kept.has(f.id));
      if (gone.length) void deleteFiles(gone.map((f) => f.id)).catch(() => undefined);
    }
    toast(submit ? `${saved.number} sent to Legal & Risk` : `${saved.number} saved as a draft`);
    onClose();
    openContract(saved.id, submit ? "summary" : "document");
  };

  const next = order[at + 1];
  const prev = order[at - 1];

  return (
    <Modal
      open={!!start}
      onClose={onClose}
      title={isNew ? "New contract" : `Edit ${start?.contract?.number ?? ""}`}
      description={t ? `${t.name} · ${t.form}` : "Choose the Owner form that fits the work. Every template carries its own blanks and exhibits."}
      className="h-[min(48rem,calc(100dvh-2rem))] max-h-[min(48rem,calc(100dvh-2rem))] w-[min(60rem,calc(100vw-2rem))]"
    >
      <div className="px-5">
        <Tabs idBase="cform" label="Contract form sections" value={tab} onChange={setTab} tabs={tabs} />
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (tab === "review") void save(true);
          else if (next) setTab(next);
        }}
      >
        <div ref={body} id="cform-panel" role="tabpanel" aria-labelledby={`cform-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === "template" && <TemplatePicker category={category} structure={structure} onCategory={setCategory} onStructure={setStructure} value={c?.templateId ?? null} onPick={choose} />}
          {c && t && tab === "parties" && (
            <Parties
              c={c}
              t={t}
              tried={tried}
              isNew={isNew}
              onTitle={(v) => set({ title: v })}
              onProject={(id) => setC((x) => (x ? withProject(x, id || null, repTouched) : x))}
              onParent={(id) => setC((x) => (x ? masterFor(x, id || null) : x))}
              onCounterparty={(id) => set({ counterpartyId: id })}
              onRep={(id) => {
                setRepTouched(true);
                set({ ownerRepId: id });
              }}
              onCode={(code) => set({ code })}
              onChangeTemplate={() => setTab("template")}
            />
          )}
          {c && t && t.sections.map((s) => tab === s.id && <SectionFields key={s.id} c={c} t={t} sectionId={s.id} tried={tried} onValue={setValue} />)}
          {c && t && tab === "exhibits" && (
            <Exhibits
              c={c}
              t={t}
              files={files}
              onFiles={(key, list) => setFiles((f) => ({ ...f, [key]: list }))}
              onExhibit={setExhibit}
              tried={tried}
            />
          )}
          {view && t && tab === "review" && <Review c={view} t={t} missing={missing} warnings={warnings} all={contracts} onJump={setTab} />}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {prev && (
            <Button variant="ghost" icon={<ArrowLeft className="size-3.5" aria-hidden />} onClick={() => setTab(prev)}>
              Back
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {t && (
              <Button disabled={busy} icon={<FilePen className="size-3.5" aria-hidden />} onClick={() => void save(false)}>
                Save draft
              </Button>
            )}
            {tab === "review" ? (
              <Button type="submit" variant="primary" loading={busy} icon={<Send className="size-3.5" aria-hidden />}>
                Submit for Legal review
              </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={!t} icon={<ArrowRight className="size-3.5" aria-hidden />}>
                Next
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Template
 * ------------------------------------------------------------------------- */

function TemplatePicker({
  category,
  structure,
  onCategory,
  onStructure,
  value,
  onPick,
}: {
  category: Category;
  structure: Structure;
  onCategory: (c: Category) => void;
  onStructure: (s: Structure) => void;
  value: string | null;
  onPick: (t: Template) => void;
}) {
  const { contracts } = useContracts();
  const list = TEMPLATES.filter((t) => t.category === category && t.structure === structure);
  const masters = contracts.filter((x) => x.status === "executed" && templateById(x.templateId)!.category === category && templateById(x.templateId)!.structure === "master");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Who the contract is with</p>
          <div className="scroll-x max-w-full">
            <Segmented<Category> label="Contract type" value={category} onChange={onCategory} options={CATEGORY_ORDER.map((k) => ({ value: k, label: CATEGORIES[k].short }))} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">How it's structured</p>
          <Segmented<Structure>
            label="Structure"
            value={structure}
            onChange={onStructure}
            options={STRUCTURE_ORDER.map((k) => ({ value: k, label: k === "task" ? ORDER_NAME[category].name : STRUCTURES[k].label }))}
          />
        </div>
      </div>
      <p className="text-sm text-ink-2">{STRUCTURES[structure].long}</p>
      {structure === "task" && !masters.length && <p className="text-sm font-medium text-warn-ink">No executed {CATEGORIES[category].short} master agreement exists yet. Execute one first, then release orders under it.</p>}
      <fieldset>
        <legend className="sr-only">Template</legend>
        <ul className="space-y-2">
          {list.map((t) => {
            const on = value === t.id;
            return (
              <li key={t.id}>
                <label className={cx("flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--dur-fast)]", on ? "border-accent bg-accent-wash" : "border-line-strong hover:border-slate hover:bg-surface-2")}>
                  <input type="radio" name="template" className="mt-1 size-4 accent-[var(--accent)]" checked={on} onChange={() => onPick(t)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{t.name}</span>
                    <span className="num block text-xs text-ink-3">
                      {t.form} · {plural(t.sections.flatMap((s) => s.fields).length, "blank")} · {plural(t.exhibits.length, "exhibit")} · changes by {t.mods.join(", ")}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">{t.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Parties
 * ------------------------------------------------------------------------- */

function Parties({
  c,
  t,
  tried,
  isNew,
  onTitle,
  onProject,
  onParent,
  onCounterparty,
  onRep,
  onCode,
  onChangeTemplate,
}: {
  c: Contract;
  t: Template;
  tried: boolean;
  isNew: boolean;
  onTitle: (v: string) => void;
  onProject: (id: string) => void;
  onParent: (id: string) => void;
  onCounterparty: (id: string) => void;
  onRep: (id: string) => void;
  onCode: (code: string) => void;
  onChangeTemplate: () => void;
}) {
  const { contracts, rowById } = useContracts();
  const firms = CONTRACTORS.filter((k) => CATEGORIES[t.category].kinds.includes(k.kind));
  const masters = contracts.filter((x) => x.status === "executed" && templateById(x.templateId)!.category === t.category && templateById(x.templateId)!.structure === "master");
  const err = (on: boolean, msg: string) => tried && on && <span className="mt-0.5 block text-xs font-medium text-neg-ink">{msg}</span>;
  const party = CATEGORIES[t.category].party;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">{t.name}</span> · {STRUCTURES[t.structure].label}
        {isNew && (
          <>
            {" "}
            ·{" "}
            <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={onChangeTemplate}>
              Change template
            </button>
          </>
        )}
        <span className="num block text-xs text-ink-3">
          {c.number ? `Contract ${c.number}` : t.structure === "task" && !c.parentId ? "Numbered under its master agreement when saved" : `Numbered ${nextNumber(contracts, t, c.projectId, c.parentId)} when saved`}
        </span>
      </p>
      <label className="block">
        <span className="text-sm font-semibold text-ink">Title</span>
        <input className="field mt-1 w-full" value={c.title} aria-invalid={(tried && !c.title.trim()) || undefined} onChange={(e) => onTitle(e.target.value)} placeholder={TITLE_HINT[t.category]} />
        {err(!c.title.trim(), "Give the contract a title.")}
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {t.structure !== "master" && (
          <label className="block">
            <span className="text-sm font-semibold text-ink">Project</span>
            <select className="field mt-1 w-full" value={c.projectId ?? ""} aria-invalid={(tried && !c.projectId) || undefined} onChange={(e) => onProject(e.target.value)}>
              {!c.projectId && <option value="">Choose…</option>}
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            {err(!c.projectId, "Pick the project.")}
          </label>
        )}
        {t.structure === "task" && (
          <label className="block">
            <span className="text-sm font-semibold text-ink">Master agreement</span>
            <select className="field mt-1 w-full" value={c.parentId ?? ""} aria-invalid={(tried && !c.parentId) || undefined} onChange={(e) => onParent(e.target.value)}>
              {!c.parentId && <option value="">Choose…</option>}
              {masters.map((m) => {
                const r = rowById.get(m.id);
                return (
                  <option key={m.id} value={m.id}>
                    {m.number} · {r?.counterparty} · {money((r?.current ?? 0) - (r?.released ?? 0) - (r?.inFlight ?? 0), { compact: true })} left
                  </option>
                );
              })}
            </select>
            {err(!c.parentId, "Pick the master agreement this order releases work under.")}
          </label>
        )}
        <label className="block">
          <span className="text-sm font-semibold text-ink">{party}</span>
          <select className="field mt-1 w-full" value={c.counterpartyId} disabled={t.structure === "task"} aria-invalid={(tried && !c.counterpartyId) || undefined} onChange={(e) => onCounterparty(e.target.value)}>
            {!c.counterpartyId && <option value="">{t.structure === "task" ? "Set by the master agreement" : "Choose…"}</option>}
            {firms.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} · {k.trade}
                {k.prequalified ? "" : " (not prequalified)"}
              </option>
            ))}
          </select>
          {t.structure === "task" ? <span className="mt-0.5 block text-xs text-ink-3">Always the master agreement's {party.toLowerCase()}.</span> : err(!c.counterpartyId, `Pick the ${party.toLowerCase()}.`)}
          {!!c.counterpartyId && CONTRACTORS.find((k) => k.id === c.counterpartyId)?.prequalified === false && <span className="mt-0.5 block text-xs font-medium text-warn-ink">Not prequalified. Procurement signs off before Legal review.</span>}
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Owner's contract manager</span>
          <select className="field mt-1 w-full" value={c.ownerRepId} onChange={(e) => onRep(e.target.value)}>
            {MANAGERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Budget line</span>
          <select className="field mt-1 w-full" value={c.code} onChange={(e) => onCode(e.target.value)}>
            {COST_CODES.filter((x) => !x.code.startsWith("9")).map((x) => (
              <option key={x.code} value={x.code}>
                {x.code} {x.name}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-xs text-ink-3">Executed value posts to Commitments (D) on this line.</span>
        </label>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Blanks
 * ------------------------------------------------------------------------- */

function SectionFields({ c, t, sectionId, tried, onValue }: { c: Contract; t: Template; sectionId: string; tried: boolean; onValue: (k: string, v: string) => void }) {
  const { contracts } = useContracts();
  const s = t.sections.find((x) => x.id === sectionId)!;
  const parent = c.parentId ? contracts.find((x) => x.id === c.parentId) : null;
  const first = t.sections[0]!.id === sectionId;
  return (
    <div className="space-y-4">
      {first && t.structure === "task" && (
        <p className="text-sm text-ink-2">
          {parent ? (
            <>
              Rates, insurance, and standard terms come from <span className="num font-semibold text-ink">{parent.number}</span>. Fill in only what this order sets.
            </>
          ) : (
            "Pick the master agreement on the Parties tab; its terms govern this order."
          )}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {s.fields.map((f) => (
          <FieldInput key={f.key} f={f} value={c.values[f.key] ?? ""} invalid={tried && !!f.required && !(c.values[f.key] ?? "").trim()} onChange={(v) => onValue(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

function FieldInput({ f, value, onChange, invalid }: { f: Field; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const common = { "aria-invalid": invalid || undefined, value, placeholder: f.placeholder };
  let input;
  if (f.type === "textarea") input = <textarea className="field mt-1 w-full" rows={3} {...common} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === "select")
    input = (
      <select className="field mt-1 w-full" {...common} onChange={(e) => onChange(e.target.value)}>
        {!value && <option value="">Choose…</option>}
        {f.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  else if (f.type === "money" || f.type === "percent" || f.type === "number")
    input = (
      <span className="relative mt-1 block">
        {f.type === "money" && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ink-3">$</span>}
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={f.type === "percent" ? 0.1 : 1}
          className={cx("field num w-full", f.type === "money" && "pl-6", f.type === "percent" && "pr-7")}
          {...common}
          onChange={(e) => onChange(e.target.value)}
        />
        {f.type === "percent" && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-3">%</span>}
      </span>
    );
  else input = <input type={f.type === "date" ? "date" : "text"} className={cx("field mt-1 w-full", f.type === "date" && "num")} {...common} onChange={(e) => onChange(e.target.value)} />;
  return (
    <label className={cx("block", !f.half && "sm:col-span-2")}>
      <span className="text-sm font-semibold text-ink">
        {f.label}
        {!f.required && <span className="font-normal text-ink-3"> · optional</span>}
      </span>
      {input}
      {invalid ? (
        <span className="mt-0.5 block text-xs font-medium text-neg-ink">Fill in {f.label.toLowerCase()}.</span>
      ) : f.type === "money" && value ? (
        <span className="num mt-0.5 block text-xs text-ink-3">{money(Number(value) || 0)}</span>
      ) : (
        f.hint && <span className="mt-0.5 block text-xs text-ink-3">{f.hint}</span>
      )}
    </label>
  );
}

/* ---------------------------------------------------------------------------
 * Exhibits
 * ------------------------------------------------------------------------- */

function Exhibits({
  c,
  t,
  files,
  onFiles,
  onExhibit,
  tried,
}: {
  c: Contract;
  t: Template;
  files: Record<string, File[]>;
  onFiles: (key: string, f: File[]) => void;
  onExhibit: (key: string, patch: Partial<Contract["exhibits"][number]>) => void;
  tried: boolean;
}) {
  const view = withPending(c, files);
  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">Attach each exhibit, or describe where it lives. Standard exhibits come from the Owner's library unless you replace them.</p>
      <ul className="divide-y divide-line-soft">
        {t.exhibits.map((x) => {
          const st = c.exhibits.find((e) => e.key === x.key) ?? { key: x.key, standard: !!x.standard, na: false, files: [] };
          const s = exhibitStatus(x, view.exhibits.find((e) => e.key === x.key));
          const open = !(x.standard && st.standard) && !st.na;
          return (
            <li key={x.key} className="py-4 first:pt-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Exhibit {exhibitLetter(t, x.key)}. {x.title}
                    {!x.required && <span className="font-normal text-ink-3"> · optional</span>}
                  </p>
                  <p className="text-xs text-ink-3">{x.hint}</p>
                </div>
                <Badge tone={s.done ? s.tone : tried ? "neg" : "warn"}>{s.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {x.standard && <Switch checked={st.standard} onChange={(v) => onExhibit(x.key, { standard: v })} label="Use the Owner's standard exhibit" />}
                {!x.required && <Switch checked={st.na} onChange={(v) => onExhibit(x.key, { na: v })} label="Not applicable" />}
              </div>
              {open && (
                <div className="mt-2 space-y-2">
                  {st.files.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {st.files.map((a) => (
                        <li key={a.id} className="max-w-full">
                          <AttachmentChip a={a} onRemove={() => onExhibit(x.key, { files: st.files.filter((f) => f.id !== a.id) })} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <FileDrop compact files={files[x.key] ?? []} onChange={(f) => onFiles(x.key, f)} />
                  <input className="field w-full" value={st.note ?? ""} onChange={(e) => onExhibit(x.key, { note: e.target.value })} placeholder="Or reference it instead, e.g. “Contractor proposal BWE-2291 dated Sep 4, 2026, on file”" aria-label={`Reference for ${x.title}`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Review
 * ------------------------------------------------------------------------- */

function Review({ c, t, missing, warnings, all, onJump }: { c: Contract; t: Template; missing: Missing[]; warnings: string[]; all: Contract[]; onJump: (tab: string) => void }) {
  const groups = [...new Set(missing.map((m) => m.tab))];
  const tabName = (id: string) => (id === "parties" ? "Parties" : id === "exhibits" ? "Exhibits" : (t.sections.find((s) => s.id === id)?.label ?? id));
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-3">{t.valueLabel}</dt>
          <dd className="num text-lg font-semibold text-ink">{money(t.value(c.values))}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Structure</dt>
          <dd className="text-sm font-semibold text-ink">{t.structure === "task" ? ORDER_NAME[t.category].name : STRUCTURES[t.structure].label}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{CATEGORIES[t.category].party}</dt>
          <dd className="truncate text-sm font-semibold text-ink">{CONTRACTORS.find((k) => k.id === c.counterpartyId)?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Budget line</dt>
          <dd className="num text-sm font-semibold text-ink">{c.code}</dd>
        </div>
      </dl>

      {missing.length ? (
        <div role="status" className="rounded-md bg-warn-tint px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
            <CircleAlert className="size-4" aria-hidden />
            {plural(missing.length, "item")} to finish before Legal review
          </p>
          <ul className="mt-2 space-y-1.5">
            {groups.map((g) => (
              <li key={g} className="text-sm text-ink">
                <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => onJump(g)}>
                  {tabName(g)}
                </button>
                <span className="text-ink-2">
                  {": "}
                  {missing
                    .filter((m) => m.tab === g)
                    .map((m) => m.label.replace(/^Exhibit: /, ""))
                    .join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 rounded-md bg-pos-tint px-4 py-3 text-sm font-semibold text-pos-ink">
          <CircleCheck className="size-4" aria-hidden />
          Every required blank and exhibit is filled. Ready for Legal review.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-sm font-medium text-warn-ink">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">The document as it will read</h3>
          <DownloadDocButton c={c} t={t} all={all} size="sm" />
        </div>
        <div className="rounded-md border border-line bg-surface-2 px-4 py-6 sm:px-8">
          <DocPreview c={c} t={t} all={all} />
        </div>
      </div>
    </div>
  );
}
