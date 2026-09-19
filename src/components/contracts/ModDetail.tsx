"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightLeft, Ban, CircleCheck, Link2, PenLine, Receipt, Send, Trash2, Undo2 } from "lucide-react";
import { AttachmentList, FileDrop, storeFiles } from "@/components/rfis/files";
import { Badge } from "@/components/ui/data";
import { Button, IconButton } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { deleteFiles } from "@/lib/attachments";
import { cx, fmtDate, money } from "@/lib/format";
import { approveMod, commentMod, convertMod, isPending, priceMod, rejectMod, rfisFor, submitMod, withdrawMod, type ModRow } from "@/lib/contracts";
import { rfiNumber } from "@/mock/rfis";
import { CHANGE_CLASSIFIERS } from "@/mock/costCodes";
import { codeLabel, MOD_TYPES, modNumber } from "@/mock/contracts";
import { TODAY } from "@/mock/org";
import { ActionDialog, type ActionSpec } from "./ActionDialog";
import { LogList } from "./ContractDetail";
import { MiniFact, ModStatusBadge, plural, SubHead } from "./parts";
import { useContracts } from "./state";

export function ModDetail({ x, onClose }: { x: ModRow; onClose: () => void }) {
  const { mods, modById, saveMods, removeMod, openMod, openContract, startMod, rowById, me } = useContracts();
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const m = x.m;
  const c = x.c;
  const type = MOD_TYPES[m.type];
  const row = rowById.get(c.id);
  const from = m.fromId ? modById.get(m.fromId) : undefined;
  const to = m.toId ? modById.get(m.toId) : undefined;
  const rfis = rfisFor(m, c);
  const classifier = CHANGE_CLASSIFIERS.find((k) => k.id === m.classifier)?.label;
  const pending = isPending(m);
  const onMaster = x.t.structure === "master";

  const approve = () =>
    setAction({
      title: `${m.type === "ASR" ? "Approve" : "Execute"} ${x.number}`,
      description:
        m.type === "AMD" && onMaster
          ? `The amount changes the ceiling of ${c.number}.`
          : `The approved amount is added to ${c.number}'s contract value and posts to ${m.code} as a commitment.`,
      confirm: m.type === "ASR" ? "Approve" : "Record execution",
      amount: { label: "Approved amount", initial: m.amount, required: true },
      days: { initial: m.days },
      funding: onMaster ? undefined : { initial: m.funding, required: true },
      date: TODAY,
      note: "optional",
      onConfirm: (v) => {
        saveMods(approveMod(m, { amount: v.amount ?? 0, days: v.days ?? 0, funding: v.funding, date: v.date }, me, v.note));
        toast(`${x.number} ${m.type === "ASR" ? "approved" : "executed"} at ${money(v.amount ?? 0)}`);
      },
    });

  const buttons = (() => {
    if (m.status === "draft")
      return (
        <>
          <Button size="sm" icon={<PenLine className="size-3.5" aria-hidden />} onClick={() => startMod({ mod: m })}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Send className="size-3.5" aria-hidden />}
            onClick={() => {
              saveMods(submitMod(m, me));
              toast(`${x.number} submitted`);
            }}
          >
            Submit
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" aria-hidden />}
            onClick={() =>
              setAction({
                title: `Delete draft ${x.number}`,
                description: "The draft and its files are removed. This can't be undone.",
                confirm: "Delete draft",
                danger: true,
                onConfirm: () => {
                  const ids = m.files.filter((f) => f.stored).map((f) => f.id);
                  removeMod(m.id);
                  if (ids.length) void deleteFiles(ids).catch(() => undefined);
                  toast(`${x.number} deleted`);
                },
              })
            }
          >
            Delete
          </Button>
        </>
      );
    if (!pending) return null;
    return (
      <>
        {type.final ? (
          <Button size="sm" variant="primary" icon={<CircleCheck className="size-3.5" aria-hidden />} onClick={approve}>
            {m.type === "ASR" ? "Approve" : "Execute"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={<ArrowRightLeft className="size-3.5" aria-hidden />}
            onClick={() =>
              setAction({
                title: `Convert ${x.number}`,
                description: `${x.number} closes as converted; the new change opens on ${c.number} with the same description and backup.`,
                confirm: "Convert",
                target: { options: type.next },
                amount: { label: "Amount carried forward", initial: m.amount, hint: "Blank while unpriced" },
                days: { initial: m.days },
                note: "optional",
                onConfirm: (v) => {
                  const [src, next] = convertMod(m, v.target!, { amount: v.amount, days: v.days }, mods, me, v.note);
                  saveMods(src, next);
                  toast(`${x.number} converted to ${modNumber(next)}`);
                  openMod(next.id);
                },
              })
            }
          >
            Convert to {type.next.join(" or ")}
          </Button>
        )}
        <Button
          size="sm"
          icon={<Receipt className="size-3.5" aria-hidden />}
          onClick={() =>
            setAction({
              title: `Record the price for ${x.number}`,
              description: `The proposal ${c.number}'s ${x.t.category === "construction" ? "contractor" : "firm"} submitted. It stays pending until the Owner decides.`,
              confirm: "Record price",
              amount: { label: "Priced amount", initial: m.amount, required: true },
              days: { initial: m.days },
              note: "optional",
              notePlaceholder: "Proposal number, what's included, qualifications",
              onConfirm: (v) => {
                saveMods(priceMod(m, v.amount ?? 0, v.days ?? 0, me, v.note));
                toast(`${x.number} priced at ${money(v.amount ?? 0)}`);
              },
            })
          }
        >
          {m.status === "priced" ? "Revise price" : "Record price"}
        </Button>
        <Button
          size="sm"
          icon={<Ban className="size-3.5" aria-hidden />}
          onClick={() =>
            setAction({
              title: `Reject ${x.number}`,
              confirm: "Reject",
              danger: true,
              note: "required",
              notePlaceholder: "Why: covered by the contract, not a change, price not justified…",
              onConfirm: (v) => {
                saveMods(rejectMod(m, me, v.note));
                toast(`${x.number} rejected`);
              },
            })
          }
        >
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Undo2 className="size-3.5" aria-hidden />}
          onClick={() =>
            setAction({
              title: `Withdraw ${x.number}`,
              confirm: "Withdraw",
              note: "required",
              notePlaceholder: "Why it's no longer needed",
              onConfirm: (v) => {
                saveMods(withdrawMod(m, me, v.note));
                toast(`${x.number} withdrawn`);
              },
            })
          }
        >
          Withdraw
        </Button>
      </>
    );
  })();

  const addFiles = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const stored = await storeFiles(files, me, c.projectId ?? "program");
      saveMods({ ...commentMod(m, me, `Added ${plural(stored.length, "file")}`), files: [...m.files, ...stored] });
      setFiles([]);
      toast(`${plural(stored.length, "file")} added`);
    } catch {
      toast("Couldn't save the files in this browser");
    }
    setBusy(false);
  };

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-start justify-between gap-2">
          <p className="num text-xs font-semibold text-accent-ink">
            {x.number} on{" "}
            <button type="button" className="hover:underline" onClick={() => openContract(c.id, "changes")}>
              {c.number}
            </button>
            {row?.project && (
              <>
                {" · "}
                <Link href={`/projects/${row.project.id}/`} className="hover:underline">
                  {row.project.code}
                </Link>
              </>
            )}
          </p>
          <IconButton
            label="Copy a link to this change"
            className="-mt-1.5 size-7"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href).then(
                () => toast("Link copied"),
                () => toast("Couldn't copy the link"),
              );
            }}
          >
            <Link2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">{m.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          {type.label} · {c.title} · {row?.counterparty}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ModStatusBadge m={m} />
          <Badge tone="neutral" dot={false}>
            {m.classifier} · {classifier}
          </Badge>
          {m.ref && (
            <Badge tone="neutral" dot={false}>
              Project record {m.ref}
            </Badge>
          )}
          {x.age !== null && x.age > 14 && <Badge tone={x.age > 30 ? "neg" : "warn"}>Open {plural(x.age, "day")}</Badge>}
        </div>
        {x.waiting && (
          <p className="mt-2 text-sm text-ink-2">
            Waiting on <span className="font-semibold text-ink">{x.waiting.name}</span> <span className="text-ink-3">({x.waiting.why.toLowerCase()})</span>
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <MiniFact label={m.status === "priced" ? "Priced" : "Estimate"}>{m.amount === null ? "TBD" : money(m.amount)}</MiniFact>
          <MiniFact label="Approved">{m.approvedAmount !== undefined ? money(m.approvedAmount) : "—"}</MiniFact>
          <MiniFact label="Schedule days">{m.approvedDays ?? m.days ?? "—"}</MiniFact>
          <MiniFact label={m.decided ? "Decided" : m.submitted ? "Submitted" : "Created"}>{fmtDate(m.decided ?? m.submitted ?? m.created)}</MiniFact>
        </dl>
        {buttons && <div className="mt-3 flex flex-wrap items-center gap-2">{buttons}</div>}
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {(from || to) && (
          <section>
            <SubHead>Lineage</SubHead>
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {from && (
                <li>
                  <button type="button" className="num font-semibold text-accent-ink hover:underline" onClick={() => openMod(from.m.id)}>
                    {from.number}
                  </button>{" "}
                  <span className="text-ink-3">→</span>
                </li>
              )}
              <li className="num font-semibold text-ink">{x.number}</li>
              {to && (
                <li>
                  <span className="text-ink-3">→</span>{" "}
                  <button type="button" className="num font-semibold text-accent-ink hover:underline" onClick={() => openMod(to.m.id)}>
                    {to.number}
                  </button>{" "}
                  <span className="text-xs text-ink-3">({to.m.status === "approved" ? "executed" : "open"})</span>
                </li>
              )}
            </ol>
          </section>
        )}

        <section>
          <SubHead>Description</SubHead>
          <p className="text-sm whitespace-pre-line text-ink-2">{m.description}</p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-3">Budget line</dt>
              <dd className="text-sm text-ink">{codeLabel(m.code)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Funding</dt>
              <dd className={cx("text-sm", m.funding ? "text-ink" : "text-ink-3")}>{m.funding ?? "Decided at approval"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Raised by</dt>
              <dd className="text-sm text-ink">{m.by.kind === "firm" ? row?.counterparty : "The Owner"}</dd>
            </div>
          </dl>
        </section>

        {rfis.length > 0 && (
          <section>
            <SubHead>RFIs behind this change</SubHead>
            <ul className="space-y-1">
              {rfis.map((q) => (
                <li key={q.id}>
                  <Link href={`/rfis/?project=${q.projectId}&tab=log&rfi=${encodeURIComponent(q.id)}`} className="text-sm hover:underline">
                    <span className="num font-semibold text-accent-ink">{rfiNumber(q)}</span> <span className="text-ink">{q.subject}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SubHead aside={plural(m.files.length, "file")}>Backup</SubHead>
          {m.files.length ? <AttachmentList files={m.files} /> : <p className="text-sm text-ink-3">No files yet.</p>}
          {(m.status === "draft" || pending) && (
            <div className="mt-2 space-y-2">
              <FileDrop compact files={files} onChange={setFiles} />
              {files.length > 0 && (
                <Button size="sm" loading={busy} onClick={() => void addFiles()}>
                  Add {plural(files.length, "file")}
                </Button>
              )}
            </div>
          )}
        </section>

        <section>
          <SubHead>History</SubHead>
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              saveMods(commentMod(m, me, text));
              setText("");
              toast("Comment added");
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Add a comment</span>
              <input className="field w-full" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note to the record" />
            </label>
            <Button type="submit" disabled={!text.trim()}>
              Add
            </Button>
          </form>
          <LogList log={m.log} />
        </section>
      </div>

      <ActionDialog spec={action} onClose={() => setAction(null)} />
    </>
  );
}
