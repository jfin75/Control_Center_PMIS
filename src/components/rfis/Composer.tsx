"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Ban, CircleCheck, CornerUpLeft, Forward, LockOpen, MessageSquare, Reply, Send, HelpCircle, RotateCcw } from "lucide-react";
import { Button, Segmented } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { fmtDate } from "@/lib/format";
import {
  clarify,
  closeRfi,
  comment,
  dueFor,
  forward,
  issueRfi,
  reopen,
  requestInfo,
  respond,
  restore,
  returnAnswer,
  sameWho,
  voidRfi,
  whoName,
  type ImpactInput,
  type Row,
  type Stage,
} from "@/lib/rfis";
import { TODAY } from "@/mock/org";
import { PRIORITIES, PRIORITY_ORDER, type Rfi, type RfiPriority, type Who } from "@/mock/rfis";
import { FileDrop, storeFiles } from "./files";
import { ImpactFields } from "./ImpactFields";
import { reviewerOptions, shortDate, WhoSelect } from "./parts";
import { useRfis, type Queue } from "./state";

type Mode = "issue" | "respond" | "forward" | "request" | "clarify" | "comment" | "close" | "return" | "reopen" | "restore";

const MODES: Record<Stage, Mode[]> = {
  draft: ["issue", "comment"],
  awaiting: ["respond", "forward", "request", "comment"],
  info: ["clarify", "comment"],
  answered: ["close", "return", "comment"],
  closed: ["reopen", "comment"],
  void: ["restore", "comment"],
};

const LABEL: Record<Mode, string> = {
  issue: "Issue",
  respond: "Respond",
  forward: "Forward",
  request: "Request info",
  clarify: "Provide info",
  comment: "Comment",
  close: "Close",
  return: "Return answer",
  reopen: "Reopen",
  restore: "Restore",
};

const ICON: Record<Mode, ReactNode> = {
  issue: <Send className="size-3.5" aria-hidden />,
  respond: <Reply className="size-3.5" aria-hidden />,
  forward: <Forward className="size-3.5" aria-hidden />,
  request: <HelpCircle className="size-3.5" aria-hidden />,
  clarify: <Reply className="size-3.5" aria-hidden />,
  comment: <MessageSquare className="size-3.5" aria-hidden />,
  close: <CircleCheck className="size-3.5" aria-hidden />,
  return: <CornerUpLeft className="size-3.5" aria-hidden />,
  reopen: <LockOpen className="size-3.5" aria-hidden />,
  restore: <RotateCcw className="size-3.5" aria-hidden />,
};

/** Text is required for these; comments need text or a file. */
const NEEDS_TEXT: Mode[] = ["respond", "request", "clarify", "return", "reopen"];
const TAKES_FILES: Mode[] = ["respond", "request", "clarify", "comment"];

const QUEUE_OF: Partial<Record<Mode, Queue>> = { respond: "awaiting", close: "answered", issue: "draft", clarify: "info" };

export const impactFrom = (r: Rfi): ImpactInput => ({
  costImpact: r.costImpact,
  costEstimate: r.costEstimate,
  scheduleImpact: r.scheduleImpact,
  scheduleDays: r.scheduleDays,
  changeRef: r.changeRef ?? "",
});

/**
 * Every action an RFI's stage allows, one at a time. Posting appends to the
 * thread; the stage, ball in court, and due date follow from the action.
 */
export function Composer({ x }: { x: Row }) {
  const { save, me, queue, openRfi } = useRfis();
  const r = x.r;
  const modes = MODES[x.stage];
  const [picked, setPicked] = useState<Mode>(modes[0]!);
  const mode = modes.includes(picked) ? picked : modes[0]!;
  const originator: Who = { kind: "firm", id: r.fromId };
  const manager: Who = { kind: "staff", id: r.managerId };
  const lastAnswerBy = x.answer?.by ?? r.assignee;

  const defaultBy = (m: Mode): Who =>
    m === "respond" || m === "forward" || m === "request" ? r.assignee : m === "issue" || m === "clarify" ? originator : m === "comment" ? me(r.projectId) : manager;

  const [byOverride, setBy] = useState<Partial<Record<Mode, Who>>>({});
  const by = byOverride[mode] ?? defaultBy(mode);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [official, setOfficial] = useState(true);
  const [to, setTo] = useState<Who | null>(null);
  const [priority, setPriority] = useState<RfiPriority>(r.priority);
  const [due, setDue] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactInput>(impactFrom(r));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const reviewers = reviewerOptions(r.projectId);
  const defaultTo = mode === "forward" ? (reviewers.find((w) => !sameWho(w, r.assignee)) ?? null) : mode === "return" ? lastAnswerBy : r.assignee;
  const target = to ?? defaultTo;
  const dueDefault = dueFor(mode === "issue" ? priority : r.priority);
  const effDue = due ?? dueDefault;

  const errText = tried && (NEEDS_TEXT.includes(mode) ? !text.trim() : mode === "comment" ? !text.trim() && !files.length : false);
  const errTo = tried && (mode === "forward" || mode === "return" || mode === "reopen" || mode === "issue") && (!target || (mode === "forward" && sameWho(target, r.assignee)));
  const errDue = tried && (mode === "issue" || mode === "forward" || mode === "return" || mode === "reopen") && effDue < TODAY;

  const q = QUEUE_OF[mode];
  const list = q ? queue(q) : [];
  const idx = list.findIndex((y) => y.r.id === r.id);
  const next = idx >= 0 && list.length > 1 ? list[(idx + 1) % list.length]! : null;

  const reset = () => {
    setText("");
    setFiles([]);
    setTo(null);
    setDue(null);
    setTried(false);
    setOfficial(true);
  };

  const post = async (andNext: boolean) => {
    setTried(true);
    const bad = (NEEDS_TEXT.includes(mode) && !text.trim()) || (mode === "comment" && !text.trim() && !files.length);
    const badTo = (mode === "forward" || mode === "return" || mode === "reopen" || mode === "issue") && (!target || (mode === "forward" && sameWho(target, r.assignee)));
    const badDue = (mode === "issue" || mode === "forward" || mode === "return" || mode === "reopen") && effDue < TODAY;
    if (bad || badTo || badDue) return;
    setBusy(true);
    let stored: Awaited<ReturnType<typeof storeFiles>> = [];
    try {
      if (TAKES_FILES.includes(mode) && files.length) stored = await storeFiles(files, by, r.projectId);
    } catch {
      setBusy(false);
      toast("Couldn't save the files in this browser; nothing was posted");
      return;
    }
    let nextRfi: Rfi;
    let msg: string;
    switch (mode) {
      case "issue":
        nextRfi = issueRfi(r, { by, assignee: target!, due: effDue, priority });
        msg = `${x.number} issued to ${whoName(target!)} · due ${shortDate(effDue)}`;
        break;
      case "respond":
        nextRfi = respond(r, { by, text, official, files: stored });
        msg = official ? `${x.number} answered; waiting on ${whoName(manager)} to close` : `Response posted on ${x.number}`;
        break;
      case "forward":
        nextRfi = forward(r, { by, to: target!, text, due: effDue });
        msg = `${x.number} forwarded to ${whoName(target!)}`;
        break;
      case "request":
        nextRfi = requestInfo(r, { by, text, files: stored });
        msg = `Information requested from ${whoName(originator)}`;
        break;
      case "clarify":
        nextRfi = clarify(r, { by, text, files: stored });
        msg = `Information provided; ${whoName(r.assignee)} now owes a response by ${shortDate(dueFor(r.priority))}`;
        break;
      case "comment":
        nextRfi = comment(r, { by, text, files: stored });
        msg = stored.length && !text.trim() ? `${stored.length === 1 ? "File" : `${stored.length} files`} added to ${x.number}` : `Comment added to ${x.number}`;
        break;
      case "close":
        nextRfi = closeRfi(r, { by, text, impact });
        msg = `${x.number} closed`;
        break;
      case "return":
        nextRfi = returnAnswer(r, { by, to: target!, text, due: effDue });
        msg = `${x.number} returned to ${whoName(target!)}`;
        break;
      case "reopen":
        nextRfi = reopen(r, { by, to: target!, text, due: effDue });
        msg = `${x.number} reopened with ${whoName(target!)} · due ${shortDate(effDue)}`;
        break;
      case "restore":
        nextRfi = restore(r, { by, text, due: effDue });
        msg = `${x.number} restored`;
        break;
    }
    save(nextRfi);
    toast(msg);
    reset();
    setBusy(false);
    if (andNext && next) openRfi(next.r.id);
  };

  const needsDue = mode === "issue" || mode === "forward" || mode === "return" || mode === "reopen" || (mode === "restore" && !!r.issued);
  const needsTo = mode === "issue" || mode === "forward" || mode === "return" || mode === "reopen";
  const confirmedNoRef = mode === "close" && impact.costImpact === "yes" && !impact.changeRef.trim();

  return (
    <section aria-label="Actions" className="border-t border-line bg-surface-2/60">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void post(false);
        }}
        className="max-h-[52dvh] space-y-3 overflow-y-auto px-5 pt-3 pb-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="scroll-x max-w-full min-w-0">
            <Segmented<Mode>
              size="sm"
              label="Action"
              value={mode}
              onChange={(m) => {
                setPicked(m);
                setTried(false);
                setTo(null);
                setDue(null);
              }}
              options={modes.map((m) => ({ value: m, label: LABEL[m] }))}
            />
          </div>
          <label className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
            <span className="shrink-0">{mode === "comment" ? "Posting as" : "By"}</span>
            <WhoSelect projectId={r.projectId} extra={[originator, r.assignee]} value={by} onChange={(w) => setBy((b) => ({ ...b, [mode]: w }))} className="h-7 max-w-[15rem] text-xs" />
          </label>
        </div>

        <ModeHint mode={mode} x={x} due={dueFor(r.priority)} />

        {(needsTo || needsDue) && (
          <div className="flex flex-wrap gap-3">
            {needsTo && (
              <label className="block min-w-[14rem] flex-1">
                <span className="text-xs font-semibold text-ink-2">{mode === "forward" ? "Forward to" : mode === "return" ? "Return to" : "Assign to"}</span>
                <WhoSelect projectId={r.projectId} options={reviewers} value={target} onChange={setTo} className="mt-1" invalid={errTo} />
              </label>
            )}
            {mode === "issue" && (
              <label className="block w-40">
                <span className="text-xs font-semibold text-ink-2">Priority</span>
                <select
                  className="field mt-1 w-full"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as RfiPriority);
                    setDue(null);
                  }}
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITIES[p].label} · {PRIORITIES[p].days} days
                    </option>
                  ))}
                </select>
              </label>
            )}
            {needsDue && (
              <label className="block w-40">
                <span className="text-xs font-semibold text-ink-2">Response due</span>
                <input type="date" className="field num mt-1 w-full" min={TODAY} value={effDue} aria-invalid={errDue || undefined} onChange={(e) => setDue(e.target.value || null)} />
              </label>
            )}
          </div>
        )}
        {errTo && <p className="-mt-1 text-xs font-medium text-neg-ink">{mode === "forward" ? "Pick a different reviewer to forward to." : "Choose who holds the ball."}</p>}
        {errDue && <p className="-mt-1 text-xs font-medium text-neg-ink">The due date can't be in the past.</p>}

        {mode === "close" && <ImpactFields value={impact} onChange={setImpact} compact />}
        {confirmedNoRef && <p className="text-xs font-medium text-warn-ink">Confirmed cost with no PCO or change order: the budget won't see this until one is written.</p>}

        {mode !== "issue" && (
          <label className="block">
            <span className="sr-only">{LABEL[mode]} text</span>
            <textarea
              className="field w-full"
              rows={mode === "respond" ? 4 : 2}
              value={text}
              aria-invalid={errText || undefined}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER[mode]}
            />
            {errText && <span className="mt-0.5 block text-xs font-medium text-neg-ink">{mode === "comment" ? "Write a comment or attach a file." : "This action needs a note."}</span>}
          </label>
        )}

        {TAKES_FILES.includes(mode) && <FileDrop files={files} onChange={setFiles} compact />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {mode === "respond" ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
              <span>
                Official response
                <span className="block text-xs text-ink-3">The answer of record; sends the RFI to {whoName(manager)} to close.</span>
              </span>
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {next && next.r.id !== r.id && (
              <Button type="button" disabled={busy} icon={<ArrowRight className="size-3.5" aria-hidden />} onClick={() => void post(true)}>
                {LABEL[mode]} and next
              </Button>
            )}
            <Button type="submit" variant={mode === "restore" ? "secondary" : "primary"} loading={busy} icon={ICON[mode]}>
              {SUBMIT[mode]}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

const PLACEHOLDER: Record<Mode, string> = {
  issue: "",
  respond: "The answer, with sheet, detail, or spec references",
  forward: "Optional note to the next reviewer",
  request: "What the reviewer needs before answering",
  clarify: "The information requested",
  comment: "Add a comment for the distribution",
  close: "Closing note (optional)",
  return: "Why the answer isn't accepted yet",
  reopen: "Why the RFI is reopened",
  restore: "Why it's restored (optional)",
};

const SUBMIT: Record<Mode, string> = {
  issue: "Issue RFI",
  respond: "Post response",
  forward: "Forward",
  request: "Request information",
  clarify: "Send information",
  comment: "Post comment",
  close: "Close RFI",
  return: "Return to reviewer",
  reopen: "Reopen RFI",
  restore: "Restore RFI",
};

function ModeHint({ mode, x, due }: { mode: Mode; x: Row; due: string }) {
  const r = x.r;
  const text: Partial<Record<Mode, string>> = {
    issue: "Sends the RFI to the reviewer and starts the response clock.",
    forward: "Passes the question to another reviewer; the ball moves with it.",
    request: `Puts the ball back with ${whoName({ kind: "firm", id: r.fromId })}. The reviewer's clock stops until they answer.`,
    clarify: `Restarts the reviewer's clock: the response comes due ${fmtDate(due)}.`,
    close: x.answer ? `Closes against the answer of ${shortDate(x.answer.date)} from ${whoName(x.answer.by)}. Confirm the impact first.` : "Closes the RFI. Confirm the impact first.",
    return: "The answer isn't accepted. The reviewer owes a new one.",
    reopen: "Reopens the RFI and puts the ball back with a reviewer.",
    restore: r.issued ? "Brings the RFI back to the reviewer." : "Brings the RFI back as a draft.",
  };
  const t = text[mode];
  return t ? <p className="text-xs text-ink-3">{t}</p> : null;
}

/** Void control for the details tab: a reason is required. */
export function VoidControl({ x }: { x: Row }) {
  const { save, me } = useRfis();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  if (x.stage === "void") return null;
  if (!open)
    return (
      <Button variant="danger" size="sm" icon={<Ban className="size-3.5" aria-hidden />} onClick={() => setOpen(true)}>
        Void RFI
      </Button>
    );
  return (
    <div className="w-full space-y-2 rounded-md border border-line-strong p-3">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Reason for voiding {x.number}</span>
        <input className="field mt-1 w-full" value={reason} aria-invalid={(tried && !reason.trim()) || undefined} onChange={(e) => setReason(e.target.value)} placeholder="Duplicate of RFI-012, withdrawn, or answered elsewhere" />
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setTried(true);
            if (!reason.trim()) return;
            save(voidRfi(x.r, { by: me(x.r.projectId), text: reason }));
            toast(`${x.number} voided`);
          }}
        >
          Void RFI
        </Button>
      </div>
    </div>
  );
}
