"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Ban, CircleCheck, FilePen, FilePlus2, GitPullRequestArrow, Link2, PenLine, RefreshCw, Send, Trash2, Undo2 } from "lucide-react";
import { AttachmentList } from "@/components/rfis/files";
import { Badge } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { deleteFiles } from "@/lib/attachments";
import { cx, fmtDate, money } from "@/lib/format";
import { commentContract, fmtField, isPending, moveContract, type Row } from "@/lib/contracts";
import { whoName } from "@/lib/rfis";
import { codeLabel, ORDER_NAME, orderTemplateFor, type LogEntry } from "@/mock/contracts";
import { TODAY } from "@/mock/org";
import { ActionDialog, type ActionSpec } from "./ActionDialog";
import { DocPreview, DownloadDocButton, exhibitLetter, exhibitStatus } from "./Document";
import { SignatureDialog } from "./SignatureDialog";
import { EnvelopeStrip, SigningPanel, useEnvelope } from "./Signing";
import { kindLabel, MiniFact, ModAmount, ModStatusBadge, ModTypeTag, plural, shortDate, StatusBadge, SubHead } from "./parts";
import { useContracts, type DetailTab } from "./state";

export function ContractDetail({ r, tab, onTab, onClose }: { r: Row; tab: DetailTab; onTab: (t: DetailTab) => void; onClose: () => void }) {
  const { contracts, saveContracts, removeContract, startContract, startMod, openContract, me } = useContracts();
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [sending, setSending] = useState(false);
  const envelope = useEnvelope(r);
  const c = r.c;
  const live = c.esign?.status === "SENT";
  const master = r.t.structure === "master";
  const order = ORDER_NAME[r.t.category].name;

  const move = (to: Parameters<typeof moveContract>[1], msg: string) => (v: { note: string; date: string }) => {
    saveContracts(moveContract(c, to, me, v.note, v.date));
    toast(msg);
  };

  const buttons = (() => {
    switch (c.status) {
      case "draft":
        return (
          <>
            <Button size="sm" icon={<PenLine className="size-3.5" aria-hidden />} onClick={() => startContract({ contract: c })}>
              Fill in blanks
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Send className="size-3.5" aria-hidden />}
              onClick={() => {
                if (r.missing.length) {
                  toast(`${plural(r.missing.length, "item")} to finish first`);
                  startContract({ contract: c, tab: "review" });
                } else setAction({ title: `Send ${c.number} to Legal & Risk`, confirm: "Submit for Legal review", note: "optional", notePlaceholder: "Anything Legal should look at first", onConfirm: move("review", `${c.number} sent to Legal & Risk`) });
              }}
            >
              Submit for Legal review
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={() =>
                setAction({
                  title: `Delete draft ${c.number}`,
                  description: "The draft and any files attached to it are removed. This can't be undone.",
                  confirm: "Delete draft",
                  danger: true,
                  onConfirm: () => {
                    const ids = c.exhibits.flatMap((x) => x.files).filter((f) => f.stored).map((f) => f.id);
                    removeContract(c.id);
                    if (ids.length) void deleteFiles(ids).catch(() => undefined);
                    toast(`${c.number} deleted`);
                  },
                })
              }
            >
              Delete
            </Button>
          </>
        );
      case "review":
        return (
          <>
            <Button size="sm" variant="primary" icon={<FilePen className="size-3.5" aria-hidden />} onClick={() => setSending(true)}>
              Legal approved · send for signature
            </Button>
            <Button size="sm" icon={<Undo2 className="size-3.5" aria-hidden />} onClick={() => setAction({ title: `Return ${c.number} to draft`, confirm: "Return to draft", note: "required", notePlaceholder: "What needs to change", onConfirm: move("draft", `${c.number} returned to draft`) })}>
              Return to draft
            </Button>
          </>
        );
      case "signature":
        if (live)
          return (
            <>
              <Button size="sm" icon={<RefreshCw className={cx("size-3.5", envelope.busy === "refresh" && "animate-spin")} aria-hidden />} disabled={!!envelope.busy} onClick={() => void envelope.refresh()}>
                Refresh signatures
              </Button>
              <Button
                size="sm"
                icon={<Ban className="size-3.5" aria-hidden />}
                disabled={!!envelope.busy}
                onClick={() =>
                  setAction({
                    title: `Void the SignVault envelope for ${c.number}`,
                    description: "Every outstanding signing link stops working, and SignVault records why. The contract goes back to Legal review so it can be corrected and resent.",
                    confirm: "Void envelope",
                    danger: true,
                    note: "required",
                    notePlaceholder: "Why signing is stopping",
                    onConfirm: (v) => void envelope.voidIt(v.note, "review"),
                  })
                }
              >
                Void envelope
              </Button>
              <Button
                size="sm"
                icon={<Undo2 className="size-3.5" aria-hidden />}
                disabled={!!envelope.busy}
                onClick={() => setAction({ title: `Return ${c.number} to draft`, description: "The SignVault envelope is voided first, so no one can keep signing the old version.", confirm: "Void and return to draft", note: "required", notePlaceholder: "What needs to change", onConfirm: (v) => void envelope.voidIt(v.note, "draft") })}
              >
                Return to draft
              </Button>
            </>
          );
        return (
          <>
            <Button size="sm" variant="primary" icon={<Send className="size-3.5" aria-hidden />} onClick={() => setSending(true)}>
              Send through SignVault
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<CircleCheck className="size-3.5" aria-hidden />}
              onClick={() => setAction({ title: `Record execution of ${c.number}`, description: `Both parties signed outside SignVault. The contract takes effect and ${money(r.current)} posts to ${c.code} commitments.`, confirm: "Record execution", date: TODAY, note: "optional", onConfirm: move("executed", `${c.number} executed`) })}
            >
              Record wet-ink execution
            </Button>
            <Button size="sm" icon={<Undo2 className="size-3.5" aria-hidden />} onClick={() => setAction({ title: `Return ${c.number} to draft`, confirm: "Return to draft", note: "required", notePlaceholder: "Why signature stopped", onConfirm: move("draft", `${c.number} returned to draft`) })}>
              Return to draft
            </Button>
          </>
        );
      case "executed":
        return (
          <>
            <Button size="sm" variant="primary" icon={<GitPullRequestArrow className="size-3.5" aria-hidden />} onClick={() => startMod({ contractId: c.id })}>
              New change
            </Button>
            {master && (
              <Button size="sm" variant="tint" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => startContract({ templateId: orderTemplateFor(r.t.category).id, parentId: c.id })}>
                Issue {order.toLowerCase()}
              </Button>
            )}
            <Button
              size="sm"
              icon={<Archive className="size-3.5" aria-hidden />}
              disabled={r.pendingCount > 0 || r.children.some((k) => k.c.status !== "closed")}
              title={r.pendingCount ? `${plural(r.pendingCount, "change")} still open` : r.children.some((k) => k.c.status !== "closed") ? `Close its ${order.toLowerCase()}s first` : undefined}
              onClick={() => setAction({ title: `Close out ${c.number}`, description: "Work is complete, final payment and retainage are released, and no change is open.", confirm: "Close out", date: TODAY, note: "optional", onConfirm: move("closed", `${c.number} closed`) })}
            >
              Close out
            </Button>
          </>
        );
      default:
        return null;
    }
  })();

  const openMods = r.mods.filter((x) => isPending(x.m));

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-start justify-between gap-2">
          <p className="num text-xs font-semibold text-accent-ink">
            {c.number} ·{" "}
            {r.project ? (
              <Link href={`/projects/${r.project.id}/`} className="hover:underline">
                {r.project.code}
              </Link>
            ) : (
              "Program-wide"
            )}
          </p>
          <IconButton
            label="Copy a link to this contract"
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
        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">{c.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          {r.counterparty} · {kindLabel(r)}
          {r.parent && (
            <>
              {" "}
              under{" "}
              <button type="button" className="num font-semibold text-accent-ink hover:underline" onClick={() => openContract(r.parent!.id)}>
                {r.parent.number}
              </button>
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge c={c} />
          <Badge tone="neutral" dot={false}>
            {r.t.form}
          </Badge>
          {c.status === "draft" && r.missing.length > 0 && <Badge tone="warn">{plural(r.missing.length, "item")} to fill</Badge>}
          {openMods.length > 0 && <Badge tone="warn">{plural(openMods.length, "open change")}</Badge>}
        </div>
        {c.status === "signature" && <EnvelopeStrip ctl={envelope} onOpen={() => onTab("signing")} />}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {master ? (
            <>
              <MiniFact label="Ceiling">{money(r.current)}</MiniFact>
              <MiniFact label="Released" tip={`Executed ${order.toLowerCase()}s at their current value`}>
                {money(r.released)}
              </MiniFact>
              <MiniFact label="In progress" tip={`${order}s still in draft, review, or signature`}>
                {money(r.inFlight)}
              </MiniFact>
              <MiniFact label="Left">
                <span className={cx(r.current - r.released - r.inFlight < r.current * 0.2 && "text-warn-ink")}>{money(r.current - r.released - r.inFlight)}</span>
              </MiniFact>
            </>
          ) : (
            <>
              <MiniFact label="Current value" tip="Original plus executed change orders, ASRs, and amendments">
                {money(r.current)}
              </MiniFact>
              <MiniFact label={`Original · ${r.t.valueLabel.toLowerCase()}`}>{money(r.original)}</MiniFact>
              <MiniFact label="Approved changes">
                <span className={cx(r.approved > 0 && "text-neg-ink")}>{money(r.approved, { signed: true })}</span>
                {r.approvedDays ? <span className="text-xs font-normal text-ink-3"> · {r.approvedDays} d</span> : null}
              </MiniFact>
              <MiniFact label="Pending changes">
                <span className={cx(r.pending > 0 && "text-warn-ink")}>{money(r.pending)}</span>
              </MiniFact>
            </>
          )}
          <MiniFact label={c.executed ? "Executed" : "Created"}>{fmtDate(c.executed ?? c.created)}</MiniFact>
          <MiniFact label={master ? "Term ends" : "Ends"}>{r.end ? fmtDate(r.end) : "—"}</MiniFact>
          <MiniFact label="Budget line">{c.code}</MiniFact>
          <MiniFact label="Contract manager">{whoName({ kind: "staff", id: c.ownerRepId })}</MiniFact>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {buttons}
          <DownloadDocButton c={c} t={r.t} all={contracts} size="sm" />
        </div>
      </DrawerHeader>

      <div className="px-5">
        <Tabs
          idBase="contract"
          label="Contract sections"
          value={tab}
          onChange={onTab}
          tabs={[
            { value: "summary", label: master ? `Terms & ${order.toLowerCase()}s` : "Terms" },
            { value: "document", label: "Document" },
            { value: "exhibits", label: `Exhibits · ${r.t.exhibits.length}` },
            { value: "changes", label: `Changes · ${r.mods.length}` },
            ...(c.esign ? [{ value: "signing" as const, label: "Signatures" }] : []),
            { value: "history", label: "History" },
          ]}
        />
      </div>

      <div id="contract-panel" role="tabpanel" aria-labelledby={`contract-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === "summary" && <Terms r={r} />}
        {tab === "document" && (
          <div className="rounded-md border border-line bg-surface-2 px-4 py-6 sm:px-8">
            <DocPreview c={c} t={r.t} all={contracts} />
          </div>
        )}
        {tab === "exhibits" && <Exhibits r={r} />}
        {tab === "changes" && <Changes r={r} />}
        {tab === "signing" && <SigningPanel ctl={envelope} />}
        {tab === "history" && <History key={c.log.length} r={r} />}
      </div>

      <ActionDialog spec={action} onClose={() => setAction(null)} />
      <SignatureDialog r={r} open={sending} onClose={() => setSending(false)} onSent={() => onTab("signing")} />
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Terms: the blanks as filled, and a master's orders
 * ------------------------------------------------------------------------- */

function Terms({ r }: { r: Row }) {
  const { openContract, startContract } = useContracts();
  const master = r.t.structure === "master";
  const order = ORDER_NAME[r.t.category].name;
  return (
    <div className="space-y-6">
      {master && (
        <section>
          <SubHead
            aside={
              r.c.status === "executed" && (
                <Button size="sm" variant="ghost" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => startContract({ templateId: orderTemplateFor(r.t.category).id, parentId: r.c.id })}>
                  Issue {order.toLowerCase()}
                </Button>
              )
            }
          >
            {order}s · {plural(r.children.length, "order")}
          </SubHead>
          {r.children.length ? (
            <ul className="divide-y divide-line-soft border-y border-line-soft">
              {[...r.children]
                .sort((a, b) => a.c.number.localeCompare(b.c.number, undefined, { numeric: true }))
                .map((k) => (
                  <li key={k.c.id}>
                    <button type="button" onClick={() => openContract(k.c.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto_7rem] items-center gap-3 px-1 py-2 text-left hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{k.c.title}</span>
                        <span className="num block text-xs text-ink-3">
                          {k.c.number} · {k.project?.code}
                        </span>
                      </span>
                      <StatusBadge c={k.c} />
                      <span className="num text-right text-sm text-ink">{money(k.current)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">No {order.toLowerCase()}s yet.</p>
          )}
        </section>
      )}
      {r.t.sections.map((s) => {
        const filled = s.fields.map((f) => ({ f, v: fmtField(f, r.c.values[f.key]) })).filter((x) => x.v || x.f.required);
        if (!filled.length) return null;
        return (
          <section key={s.id}>
            <SubHead>{s.label}</SubHead>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {filled.map(({ f, v }) => (
                <div key={f.key} className={cx("min-w-0", !f.half && "sm:col-span-2")}>
                  <dt className="text-xs text-ink-3">{f.label}</dt>
                  <dd className={cx("mt-0.5 text-sm", v ? "text-ink" : "font-semibold text-warn-ink", (f.type === "money" || f.type === "date" || f.type === "percent") && "num")}>{v ?? "Not filled in"}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      <p className="text-xs text-ink-3">
        {r.t.name} · {r.t.form} · commits to {codeLabel(r.c.code)}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Exhibits
 * ------------------------------------------------------------------------- */

function Exhibits({ r }: { r: Row }) {
  const { startContract } = useContracts();
  return (
    <div>
      {r.c.status === "draft" && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" icon={<PenLine className="size-3.5" aria-hidden />} onClick={() => startContract({ contract: r.c, tab: "exhibits" })}>
            Attach or change exhibits
          </Button>
        </div>
      )}
      <ul className="divide-y divide-line-soft">
        {r.t.exhibits.map((x) => {
          const st = r.c.exhibits.find((e) => e.key === x.key);
          const s = exhibitStatus(x, st);
          return (
            <li key={x.key} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Exhibit {exhibitLetter(r.t, x.key)}. {x.title}
                    {!x.required && <span className="font-normal text-ink-3"> · optional</span>}
                  </p>
                  <p className="text-xs text-ink-3">{x.standard && st?.standard ? `${x.hint} From the Owner's standard library.` : x.hint}</p>
                </div>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              {st?.note && <p className="mt-1 text-sm text-ink-2">{st.note}</p>}
              {st && <AttachmentList files={st.files} className="mt-2" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Changes on this contract
 * ------------------------------------------------------------------------- */

function Changes({ r }: { r: Row }) {
  const { openMod, startMod } = useContracts();
  const groups = [
    { label: "Open", list: r.mods.filter((x) => isPending(x.m) || x.m.status === "draft") },
    { label: "Executed and approved", list: r.mods.filter((x) => x.m.status === "approved") },
    { label: "Converted, rejected, or withdrawn", list: r.mods.filter((x) => x.m.status === "converted" || x.m.status === "rejected" || x.m.status === "withdrawn") },
  ].filter((g) => g.list.length);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-ink-2">
          {money(r.original)} original <span className="text-ink-3">+</span> {money(r.approved)} approved <span className="text-ink-3">=</span> <span className="font-semibold text-ink">{money(r.current)}</span>
          {r.pending ? <span className="text-warn-ink"> · {money(r.pending)} pending</span> : null}
        </p>
        {r.c.status === "executed" && (
          <Button size="sm" variant="primary" icon={<GitPullRequestArrow className="size-3.5" aria-hidden />} onClick={() => startMod({ contractId: r.c.id })}>
            New change
          </Button>
        )}
      </div>
      {!groups.length && <p className="text-sm text-ink-2">{r.c.status === "executed" ? "No changes yet." : "Changes open once the contract is executed."}</p>}
      {groups.map((g) => (
        <section key={g.label}>
          <SubHead>{g.label}</SubHead>
          <ul className="divide-y divide-line-soft border-y border-line-soft">
            {g.list.map((x) => (
              <li key={x.m.id}>
                <button type="button" onClick={() => openMod(x.m.id)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-1 py-2.5 text-left hover:bg-surface-2">
                  <ModTypeTag m={x.m} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{x.m.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span className="num font-semibold text-accent-ink">{x.number}</span>
                      <ModStatusBadge m={x.m} />
                      {x.m.ref && <span className="num">{x.m.ref}</span>}
                      <span className="num">{shortDate(x.m.decided ?? x.m.submitted ?? x.m.created)}</span>
                    </span>
                  </span>
                  <ModAmount x={x} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * History
 * ------------------------------------------------------------------------- */

export const LOG_LABEL: Record<LogEntry["kind"], string> = {
  created: "Created",
  edited: "Edited",
  submitted: "Submitted",
  returned: "Returned to draft",
  signature: "Sent for signature",
  voided: "Envelope voided",
  executed: "Executed",
  closed: "Closed",
  priced: "Priced",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
  comment: "Comment",
};

export function LogList({ log }: { log: LogEntry[] }) {
  return (
    <ol className="space-y-3">
      {[...log].reverse().map((e) => (
        <li key={e.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
          <span className="num pt-px text-xs text-ink-3">{shortDate(e.date)}</span>
          <div className="min-w-0">
            <p className="text-sm text-ink">
              <span className="font-semibold">{LOG_LABEL[e.kind]}</span> <span className="text-ink-3">by {whoName(e.by)}</span>
            </p>
            {e.text && <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{e.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function History({ r }: { r: Row }) {
  const { saveContracts, me } = useContracts();
  const [text, setText] = useState("");
  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          saveContracts(commentContract(r.c, me, text));
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
      <LogList log={r.c.log} />
    </div>
  );
}
