"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FilePen, Send } from "lucide-react";
import { AttachmentChip, FileDrop, storeFiles } from "@/components/rfis/files";
import { Button, Tabs } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { deleteFiles } from "@/lib/attachments";
import { cx, money, pct } from "@/lib/format";
import { createMod, editMod, nextModSeq, submitMod } from "@/lib/contracts";
import { whoName } from "@/lib/rfis";
import { CHANGE_CLASSIFIERS, COST_CODES, type ChangeClassifier } from "@/mock/costCodes";
import { FUNDING, MOD_TYPES, modNumber, ORDER_NAME, templateById, type Funding, type ModType } from "@/mock/contracts";
import type { Attachment, Who } from "@/mock/rfis";
import { TabLabel } from "./parts";
import { useContracts, type ModStart } from "./state";

type FormTab = "change" | "cost" | "files";

/** Types the other party usually raises; the Owner raises the rest. */
const RAISED_BY_FIRM: ModType[] = ["PCI", "ASR", "CO"];

/** Raise a change against an executed contract, or edit a draft one. */
export function ModForm({ start, onClose }: { start: ModStart | null; onClose: () => void }) {
  const { rows, rowById, mods, saveMods, openMod, me, project } = useContracts();
  const [contractId, setContractId] = useState("");
  const [type, setType] = useState<ModType>("PCI");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classifier, setClassifier] = useState<ChangeClassifier>("OC");
  const [ref, setRef] = useState("");
  const [raisedBy, setRaisedBy] = useState<"firm" | "owner">("firm");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [code, setCode] = useState("3.03");
  const [funding, setFunding] = useState<Funding | "">("");
  const [kept, setKept] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [tab, setTab] = useState<FormTab>("change");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const editing = start?.mod ?? null;
  const eligible = rows.filter((r) => r.c.status === "executed");
  const r = contractId ? rowById.get(contractId) : undefined;
  const types = r ? r.t.mods : [];

  const pickContract = (id: string, keepType?: ModType) => {
    setContractId(id);
    const row = rowById.get(id);
    if (!row) return;
    const t = keepType && row.t.mods.includes(keepType) ? keepType : row.t.mods[0]!;
    setType(t);
    setRaisedBy(RAISED_BY_FIRM.includes(t) ? "firm" : "owner");
    setCode(row.c.code === "3.02" ? "3.03" : row.c.code);
  };

  useEffect(() => {
    if (!start) return;
    setTried(false);
    setBusy(false);
    setFiles([]);
    setTab("change");
    if (start.mod) {
      const m = start.mod;
      setContractId(m.contractId);
      setType(m.type);
      setTitle(m.title);
      setDescription(m.description);
      setClassifier(m.classifier);
      setRef(m.ref ?? "");
      setRaisedBy(m.by.kind === "firm" ? "firm" : "owner");
      setAmount(m.amount === null ? "" : String(m.amount));
      setDays(m.days === null ? "" : String(m.days));
      setCode(m.code);
      setFunding(m.funding ?? "");
      setKept(m.files);
      return;
    }
    setTitle("");
    setDescription("");
    setClassifier("OC");
    setRef("");
    setAmount("");
    setDays("");
    setFunding("");
    setKept([]);
    const first = start.contractId ?? (project !== "all" ? eligible.find((x) => x.c.projectId === project && x.t.structure !== "master")?.c.id : undefined) ?? "";
    if (first) pickContract(first, start.type);
    else setContractId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const errors = { contract: !r, title: !title.trim(), description: !description.trim() };
  const changeMissing = Object.values(errors).filter(Boolean).length;
  const amt = amount.trim() === "" ? null : Number(amount);
  const after = r ? r.current + (amt ?? 0) : 0;

  const submit = async (send: boolean) => {
    setTried(true);
    if (changeMissing || !r) {
      setTab("change");
      return;
    }
    setBusy(true);
    const by: Who = raisedBy === "firm" ? { kind: "firm", id: r.c.counterpartyId } : me;
    let stored: Attachment[] = [];
    try {
      if (files.length) stored = await storeFiles(files, by, r.c.projectId ?? "program");
    } catch {
      setBusy(false);
      toast("Couldn't save the files in this browser; the change wasn't saved");
      return;
    }
    const input = { title, description, classifier, code, funding: funding || null, amount: amt, days: days.trim() === "" ? null : Number(days), ref, files: [...kept, ...stored] };
    let m;
    if (editing) {
      m = editMod({ ...editing, by }, input, me);
      if (send) m = submitMod(m, me);
      const gone = editing.files.filter((f) => f.stored && !kept.some((k) => k.id === f.id));
      if (gone.length) void deleteFiles(gone.map((f) => f.id)).catch(() => undefined);
    } else m = createMod({ contractId: r.c.id, type, ...input }, mods, by, send);
    saveMods(m);
    toast(send ? `${modNumber(m)} submitted on ${r.c.number}` : `${modNumber(m)} saved as a draft`);
    onClose();
    openMod(m.id);
  };

  const number = r ? modNumber({ type, seq: editing?.seq ?? nextModSeq(mods, r.c.id, type) }) : null;
  const firmName = r ? whoName({ kind: "firm", id: r.c.counterpartyId }) : "The other party";

  return (
    <Modal
      open={!!start}
      onClose={onClose}
      title={editing ? `Edit ${modNumber(editing)}` : "New change"}
      description="Changes open against an executed contract. The contract value moves only when a change order, ASR, or amendment is executed."
      className="h-[min(44rem,calc(100dvh-2rem))] max-h-[min(44rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-2rem))]"
    >
      <div className="px-5">
        <Tabs
          idBase="mform"
          label="Change form sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "change", label: <TabLabel label="Change" missing={tried ? changeMissing : 0} /> },
            { value: "cost", label: "Cost & time" },
            { value: "files", label: `Attachments${kept.length + files.length ? ` · ${kept.length + files.length}` : ""}` },
          ]}
        />
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (tab === "change") setTab("cost");
          else if (tab === "cost") setTab("files");
          else void submit(true);
        }}
      >
        <div id="mform-panel" role="tabpanel" aria-labelledby={`mform-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === "change" && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-ink">Contract</span>
                <select className="field mt-1 w-full" value={contractId} disabled={!!editing} aria-invalid={(tried && errors.contract) || undefined} onChange={(e) => pickContract(e.target.value, type)}>
                  {!contractId && <option value="">Choose an executed contract…</option>}
                  {eligible
                    .slice()
                    .sort((a, b) => a.c.number.localeCompare(b.c.number, undefined, { numeric: true }))
                    .map((x) => (
                      <option key={x.c.id} value={x.c.id}>
                        {x.c.number} · {x.c.title} · {x.counterparty}
                      </option>
                    ))}
                </select>
                {tried && errors.contract && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Pick the contract this changes.</span>}
                {r && (
                  <span className="num mt-0.5 block text-xs text-ink-3">
                    {r.project ? `${r.project.code} · ` : "Program master · "}
                    {r.t.structure === "task" ? `${ORDER_NAME[r.t.category].name} under ${r.parent?.number}` : templateById(r.c.templateId)!.name} · current {money(r.current)}
                  </span>
                )}
              </label>
              {r && (
                <fieldset>
                  <legend className="text-sm font-semibold text-ink">Type</legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {types.map((t) => (
                      <label
                        key={t}
                        className={cx(
                          "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-[var(--dur-fast)]",
                          type === t ? "border-accent bg-accent-wash" : "border-line-strong hover:border-slate hover:bg-surface-2",
                          editing && type !== t && "pointer-events-none opacity-50",
                        )}
                      >
                        <input
                          type="radio"
                          name="modtype"
                          className="mt-0.5 size-4 accent-[var(--accent)]"
                          checked={type === t}
                          disabled={!!editing}
                          onChange={() => {
                            setType(t);
                            setRaisedBy(RAISED_BY_FIRM.includes(t) ? "firm" : "owner");
                          }}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <span className="num">{t}</span> {MOD_TYPES[t].label}
                          </span>
                          <span className="block text-xs text-ink-3">{MOD_TYPES[t].long}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {number && <p className="num mt-1.5 text-xs text-ink-3">Will be {number} on {r.c.number}</p>}
                </fieldset>
              )}
              <label className="block">
                <span className="text-sm font-semibold text-ink">Title</span>
                <input className="field mt-1 w-full" value={title} aria-invalid={(tried && errors.title) || undefined} onChange={(e) => setTitle(e.target.value)} placeholder="Relocate hand sinks at triage stations" />
                {tried && errors.title && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Give the change a title.</span>}
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Description</span>
                <textarea
                  className="field mt-1 w-full"
                  rows={4}
                  value={description}
                  aria-invalid={(tried && errors.description) || undefined}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What changed, why, and what the contract documents say today"
                />
                {tried && errors.description && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Describe the change.</span>}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Reason</span>
                  <select className="field mt-1 w-full" value={classifier} onChange={(e) => setClassifier(e.target.value as ChangeClassifier)}>
                    {CHANGE_CLASSIFIERS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id} · {x.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Raised by</span>
                  <select className="field mt-1 w-full" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value as "firm" | "owner")}>
                    <option value="firm">{firmName}</option>
                    <option value="owner">The Owner ({whoName(me)})</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">
                    Reference <span className="font-normal text-ink-3">· optional</span>
                  </span>
                  <input className="field num mt-1 w-full" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PCO-024 or RFI-031" />
                </label>
              </div>
            </div>
          )}

          {tab === "cost" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">{type === "PCI" || type === "PR" || type === "CCD" ? "Estimate" : "Proposed amount"}</span>
                  <span className="relative mt-1 block">
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ink-3">$</span>
                    <input type="number" inputMode="decimal" step={1} className="field num w-full pl-6" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="TBD" />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-3">{type === "AMD" && r?.t.structure === "master" ? "Change to the ceiling; 0 for terms or rates only" : "Blank while unknown; negative for a credit"}</span>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Schedule days</span>
                  <input type="number" inputMode="numeric" step={1} className="field num mt-1 w-full" value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
                  <span className="mt-0.5 block text-xs text-ink-3">Calendar days the change adds to the contract time</span>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Budget line</span>
                  <select className="field mt-1 w-full" value={code} onChange={(e) => setCode(e.target.value)}>
                    {COST_CODES.filter((x) => !x.code.startsWith("9")).map((x) => (
                      <option key={x.code} value={x.code}>
                        {x.code} {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">
                    Funding <span className="font-normal text-ink-3">· can wait until approval</span>
                  </span>
                  <select className="field mt-1 w-full" value={funding} onChange={(e) => setFunding(e.target.value as Funding)}>
                    <option value="">Decide at approval</option>
                    {FUNDING.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
              </div>
              {r && amt !== null && r.t.structure !== "master" && (
                <p className="num rounded-md bg-sunk px-4 py-3 text-sm text-ink-2">
                  If executed at this amount, {r.c.number} goes from {money(r.current)} to <span className="font-semibold text-ink">{money(after)}</span>
                  {r.original ? ` (${pct((after - r.original) / r.original, 1)} over its original ${money(r.original, { compact: true })})` : ""}.
                  {MOD_TYPES[type].final ? "" : ` A ${MOD_TYPES[type].label.toLowerCase()} is exposure only until it becomes a ${type === "PCI" || type === "PR" || type === "CCD" ? "change order" : "final change"}.`}
                </p>
              )}
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">Backup: the contractor's pricing, sketches, photos, the RFI answer, or the design firm's fee proposal.</p>
              {kept.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {kept.map((a) => (
                    <li key={a.id} className="max-w-full">
                      <AttachmentChip a={a} onRemove={() => setKept((k) => k.filter((x) => x.id !== a.id))} />
                    </li>
                  ))}
                </ul>
              )}
              <FileDrop files={files} onChange={setFiles} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} icon={<FilePen className="size-3.5" aria-hidden />} onClick={() => void submit(false)}>
            Save draft
          </Button>
          {tab !== "files" ? (
            <Button type="submit" variant="primary" icon={<ArrowRight className="size-3.5" aria-hidden />}>
              Next
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={busy} icon={<Send className="size-3.5" aria-hidden />}>
              Submit {type}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
