"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, CircleCheck, CornerUpLeft, FileEdit, Forward, Link2, LockOpen, Paperclip, RotateCcw, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/data";
import { Button, IconButton, Tabs } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { deleteFiles } from "@/lib/attachments";
import { cx, fmtDate } from "@/lib/format";
import { addFiles, currentAnswer, editRfi, projectParties, removeFile, sameWho, whoName, whoRole, type ImpactInput, type Row } from "@/lib/rfis";
import { CONTRACTORS } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { DISCIPLINES, PRIORITIES, PRIORITY_ORDER, type Attachment, type Entry, type RfiDiscipline, type RfiPriority, type Who } from "@/mock/rfis";
import { Composer, impactFrom, VoidControl } from "./Composer";
import { AttachmentChip, AttachmentList, FileDrop, fileMeta, storeFiles } from "./files";
import { ImpactFields } from "./ImpactFields";
import { days, ImpactChips, MiniFact, plural, PriorityBadge, reviewerOptions, shortDate, StageBadge, WhoDot, whoKey, WhoSelect } from "./parts";
import { useRfis, type DetailTab } from "./state";

export function RfiDetail({ x, tab, onTab, onClose }: { x: Row; tab: DetailTab; onTab: (t: DetailTab) => void; onClose: () => void }) {
  const r = x.r;
  const p = projectById(r.projectId)!;
  const refs = [r.discipline, r.section && `Spec ${r.section}`, r.drawing, r.location].filter(Boolean).join(" · ");

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-start justify-between gap-2">
          <p className="num text-xs font-semibold text-accent-ink">
            {x.number} ·{" "}
            <Link href={`/projects/${p.id}/`} className="hover:underline">
              {p.code}
            </Link>
          </p>
          <IconButton
            label="Copy a link to this RFI"
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
        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">{r.subject}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{refs}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StageBadge x={x} />
          <PriorityBadge p={r.priority} />
          {x.late > 0 && <Badge tone="neg">{days(x.late)} late</Badge>}
          <ImpactChips x={x} />
        </div>
        {x.ball && (
          <p className="mt-2 text-sm text-ink-2">
            Ball in court: <span className="font-semibold text-ink">{x.ball.name}</span> <span className="text-ink-3">({x.ball.why.toLowerCase()})</span>
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <MiniFact label={r.issued ? "Issued" : "Created"}>{fmtDate(r.issued ?? r.created)}</MiniFact>
          <MiniFact label="Response due" tip={`${PRIORITIES[r.priority].label} priority: ${plural(PRIORITIES[r.priority].days, "day")} to respond. Resets when the RFI is reopened or the contractor answers a request for information.`}>
            <span className={cx(x.late > 0 && "text-neg-ink")}>{r.due && r.status !== "draft" ? fmtDate(r.due) : "—"}</span>
          </MiniFact>
          <MiniFact label="Answered" tip="The current answer of record">
            {x.answeredOn ? fmtDate(x.answeredOn) : "—"}
          </MiniFact>
          <MiniFact label={r.status === "closed" ? "Closed" : "Days open"}>{r.status === "closed" && r.closed ? fmtDate(r.closed) : x.daysOpen !== null ? x.daysOpen : "—"}</MiniFact>
        </dl>
      </DrawerHeader>

      <div className="px-5">
        <Tabs
          idBase="rfi"
          label="RFI sections"
          value={tab}
          onChange={onTab}
          tabs={[
            { value: "thread", label: `Thread · ${r.entries.filter((e) => e.kind !== "edit").length + 1}` },
            { value: "files", label: `Files · ${x.files}` },
            { value: "details", label: "Details" },
          ]}
        />
      </div>

      <div id="rfi-panel" role="tabpanel" aria-labelledby={`rfi-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {tab === "thread" && (
          <>
            <Thread x={x} />
            <Composer key={`${r.id}:${r.entries.length}`} x={x} />
          </>
        )}
        {tab === "files" && <Files x={x} />}
        {tab === "details" && <Details key={`${r.id}:${r.entries.length}`} x={x} />}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Thread: the question, then every action in order
 * ------------------------------------------------------------------------- */

function Thread({ x }: { x: Row }) {
  const r = x.r;
  const scroller = useRef<HTMLDivElement>(null);
  const count = useRef(r.entries.length);
  const answer = currentAnswer(r);

  // Follow the thread down when someone posts.
  useEffect(() => {
    if (r.entries.length > count.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    count.current = r.entries.length;
  }, [r.entries.length]);

  const originator: Who = { kind: "firm", id: r.fromId };
  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <article className="rounded-lg border border-line bg-surface p-4">
        <header className="flex items-start gap-3">
          <WhoDot w={originator} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold text-ink">{whoName(originator)}</span> <span className="text-xs text-ink-3">{whoRole(originator, r.projectId)}</span>
            </p>
            <p className="num text-xs text-ink-3">{r.issued ? `Question · issued ${fmtDate(r.issued)}` : `Draft · created ${fmtDate(r.created)}`}</p>
          </div>
        </header>
        <p className="mt-3 text-sm whitespace-pre-line text-ink">{r.question}</p>
        {r.suggestion && (
          <p className="mt-3 border-l-2 border-line pl-3 text-sm text-ink-2">
            <span className="font-semibold text-ink">Proposed solution:</span> {r.suggestion}
          </p>
        )}
        <AttachmentList files={r.files} className="mt-3" />
      </article>

      <ol className="mt-4 space-y-3">
        {r.entries.map((e) => (
          <li key={e.id}>
            <EntryView e={e} projectId={r.projectId} answerId={answer?.id ?? null} />
          </li>
        ))}
      </ol>
      {!r.entries.length && <p className="mt-4 text-sm text-ink-3">Not issued yet. Issue it below to start the response clock.</p>}
    </div>
  );
}

const SYSTEM_ICON: Partial<Record<Entry["kind"], ReactNode>> = {
  issue: <Send className="size-3.5" aria-hidden />,
  forward: <Forward className="size-3.5" aria-hidden />,
  files: <Paperclip className="size-3.5" aria-hidden />,
  return: <CornerUpLeft className="size-3.5" aria-hidden />,
  close: <CircleCheck className="size-3.5" aria-hidden />,
  reopen: <LockOpen className="size-3.5" aria-hidden />,
  void: <Ban className="size-3.5" aria-hidden />,
  restore: <RotateCcw className="size-3.5" aria-hidden />,
  edit: <FileEdit className="size-3.5" aria-hidden />,
};

function EntryView({ e, projectId, answerId }: { e: Entry; projectId: string; answerId: string | null }) {
  const by = whoName(e.by);
  const card = e.kind === "response" || e.kind === "request" || e.kind === "clarify" || e.kind === "comment";

  if (!card) {
    const to = e.to ? whoName(e.to) : "";
    const line: Record<string, string> = {
      issue: `${by} issued the RFI to ${to}`,
      forward: `${by} forwarded to ${to}`,
      files: `${by} added ${plural(e.files?.length ?? 0, "file")}`,
      return: `${by} returned the answer to ${to}`,
      close: `${by} closed the RFI`,
      reopen: `${by} reopened the RFI${to ? ` and assigned ${to}` : ""}`,
      void: `${by} voided the RFI`,
      restore: `${by} restored the RFI`,
      edit: by,
    };
    return (
      <div className={cx("flex gap-3 pl-1", e.kind === "close" ? "text-pos-ink" : e.kind === "void" || e.kind === "return" ? "text-neg-ink" : "text-ink-3")}>
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sunk">{SYSTEM_ICON[e.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-semibold">{line[e.kind]}</span>
            {e.kind === "edit" && e.text && <span className="text-ink-3"> {e.text.charAt(0).toLowerCase() + e.text.slice(1)}</span>}
            <span className="num text-ink-3"> · {shortDate(e.date)}</span>
          </p>
          {e.text && e.kind !== "edit" && <p className="mt-0.5 text-sm text-ink-2">{e.text}</p>}
          <AttachmentList files={e.files ?? []} className="mt-1.5" />
        </div>
      </div>
    );
  }

  const official = e.kind === "response" && e.official;
  const superseded = official && e.id !== answerId;
  return (
    <article className={cx("rounded-lg border p-3.5", official && !superseded ? "border-[var(--c-teal-500)] bg-[var(--c-teal-100)]/40" : e.kind === "request" ? "border-[var(--c-amber-400)] bg-warn-tint/40" : "border-line bg-surface")}>
      <header className="flex items-start gap-3">
        <WhoDot w={e.by} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-ink">{by}</span>
            <span className="text-xs text-ink-3">{whoRole(e.by, projectId)}</span>
            {official && !superseded && <Badge tone="pos">Official response</Badge>}
            {superseded && <Badge tone="neutral">Superseded</Badge>}
            {e.kind === "response" && !official && <Badge tone="neutral" dot={false}>Response</Badge>}
            {e.kind === "request" && <Badge tone="warn">Requested information</Badge>}
            {e.kind === "clarify" && <Badge tone="accent" dot={false}>Information provided</Badge>}
          </p>
          <p className="num text-xs text-ink-3">{fmtDate(e.date)}</p>
        </div>
      </header>
      {e.text && <p className="mt-2 text-sm whitespace-pre-line text-ink">{e.text}</p>}
      <AttachmentList files={e.files ?? []} className="mt-2" />
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Files: every attachment on the RFI, and a place to add more
 * ------------------------------------------------------------------------- */

const SOURCE: Record<Entry["kind"], string> = {
  issue: "Question",
  response: "Response",
  forward: "Forward",
  request: "Request for information",
  clarify: "Information provided",
  comment: "Comment",
  files: "Added to RFI",
  return: "Return",
  close: "Close",
  reopen: "Reopen",
  void: "Void",
  restore: "Restore",
  edit: "Edit",
};

function Files({ x }: { x: Row }) {
  const { save, me } = useRfis();
  const r = x.r;
  const [picked, setPicked] = useState<File[]>([]);
  const [by, setBy] = useState<Who>(me(r.projectId));
  const [busy, setBusy] = useState(false);
  const all: Array<{ a: Attachment; source: string }> = [...r.files.map((a) => ({ a, source: "Question" })), ...r.entries.flatMap((e) => (e.files ?? []).map((a) => ({ a, source: SOURCE[e.kind] })))];

  const upload = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const stored = await storeFiles(picked, by, r.projectId);
      save(addFiles(r, { by, files: stored }));
      toast(`${plural(stored.length, "file")} added to ${x.number}`);
      setPicked([]);
    } catch {
      toast("Couldn't save the files in this browser");
    }
    setBusy(false);
  };

  const remove = async (a: Attachment) => {
    save(removeFile(r, a.id, me(r.projectId)));
    await deleteFiles([a.id]).catch(() => undefined);
    toast(`${a.name} removed`);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <section aria-labelledby="add-files-h" className="space-y-2">
        <h3 id="add-files-h" className="text-sm font-semibold text-ink">
          Add files
        </h3>
        <FileDrop files={picked} onChange={setPicked} />
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-3">
              Added by
              <WhoSelect projectId={r.projectId} value={by} onChange={setBy} className="h-7 max-w-[15rem] text-xs" />
            </label>
            <Button variant="primary" size="sm" loading={busy} icon={<Paperclip className="size-3.5" aria-hidden />} onClick={() => void upload()}>
              Add {plural(picked.length, "file")}
            </Button>
          </div>
        )}
        <p className="text-xs text-ink-3">Files you add are kept in this browser until the app has a file server. Seeded files are records only.</p>
      </section>

      <section aria-labelledby="all-files-h" className="mt-6">
        <h3 id="all-files-h" className="text-sm font-semibold text-ink">
          On this RFI · {all.length}
        </h3>
        {!all.length ? (
          <p className="mt-2 text-sm text-ink-3">No files yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line-soft">
            {all.map(({ a, source }) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <AttachmentChip a={a} onRemove={a.stored ? () => void remove(a) : undefined} />
                <span className="text-right text-xs text-ink-3">
                  <span className="block font-semibold text-ink-2">{source}</span>
                  {fileMeta(a)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Details: the fields behind the RFI, editable with a logged change
 * ------------------------------------------------------------------------- */

const ORIGINATORS = CONTRACTORS.filter((c) => c.kind === "General Contractor" || c.kind === "Trade Contractor" || c.kind === "Vendor");

function Details({ x }: { x: Row }) {
  const { save, me, remove } = useRfis();
  const r = x.r;
  const [subject, setSubject] = useState(r.subject);
  const [question, setQuestion] = useState(r.question);
  const [suggestion, setSuggestion] = useState(r.suggestion ?? "");
  const [discipline, setDiscipline] = useState<RfiDiscipline>(r.discipline);
  const [section, setSection] = useState(r.section ?? "");
  const [drawing, setDrawing] = useState(r.drawing ?? "");
  const [location, setLocation] = useState(r.location ?? "");
  const [priority, setPriority] = useState<RfiPriority>(r.priority);
  const [due, setDue] = useState(r.due ?? "");
  const [assignee, setAssignee] = useState<Who>(r.assignee);
  const [fromId, setFromId] = useState(r.fromId);
  const [dist, setDist] = useState<Who[]>(r.distribution);
  const [impact, setImpact] = useState<ImpactInput>(impactFrom(r));
  const parties = projectParties(r.projectId, [{ kind: "firm", id: r.fromId }, r.assignee]);

  const patch = { subject, question, suggestion, discipline, section, drawing, location, priority, due: due || r.due, assignee, distribution: dist, fromId, ...impact };
  const invalid = !subject.trim() || !question.trim() || (r.status !== "draft" && !due);
  const preview = editRfi(r, patch, me(r.projectId));
  const dirty = preview !== r;
  const assigneeLocked = x.stage !== "draft" && x.stage !== "awaiting";

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Subject</span>
          <input className="field mt-1 w-full" value={subject} aria-invalid={!subject.trim() || undefined} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Question</span>
          <textarea className="field mt-1 w-full" rows={4} value={question} aria-invalid={!question.trim() || undefined} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Proposed solution</span>
          <textarea className="field mt-1 w-full" rows={2} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Optional" />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Discipline</span>
            <select className="field mt-1 w-full" value={discipline} onChange={(e) => setDiscipline(e.target.value as RfiDiscipline)}>
              {DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Location</span>
            <input className="field mt-1 w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bay 7, gridline C/4" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Spec section</span>
            <input className="field num mt-1 w-full" value={section} onChange={(e) => setSection(e.target.value)} placeholder="23 31 13" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Drawing reference</span>
            <input className="field num mt-1 w-full" value={drawing} onChange={(e) => setDrawing(e.target.value)} placeholder="M-201" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Originator</span>
            <select className="field mt-1 w-full" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {ORIGINATORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Assigned reviewer</span>
            <WhoSelect projectId={r.projectId} options={reviewerOptions(r.projectId)} value={assignee} onChange={setAssignee} className="mt-1" />
            {assigneeLocked && !sameWho(assignee, r.assignee) && <span className="mt-0.5 block text-xs text-ink-3">Takes effect if the RFI is reopened or returned.</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Priority</span>
            <select className="field mt-1 w-full" value={priority} onChange={(e) => setPriority(e.target.value as RfiPriority)}>
              {PRIORITY_ORDER.map((k) => (
                <option key={k} value={k}>
                  {PRIORITIES[k].label} · {PRIORITIES[k].days} days
                </option>
              ))}
            </select>
          </label>
          {r.status !== "draft" && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">Response due</span>
              <input type="date" className="field num mt-1 w-full" value={due} aria-invalid={!due || undefined} onChange={(e) => setDue(e.target.value)} />
            </label>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Impact</legend>
          <p className="text-xs text-ink-3">Possible impacts show on the Impacts tab until the RFI closes; confirmed cost belongs on a PCO or change order.</p>
          <div className="mt-2">
            <ImpactFields value={impact} onChange={setImpact} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Distribution</legend>
          <p className="text-xs text-ink-3">Who receives this RFI and its answers. The originator, reviewer, and Owner's PM always do.</p>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {parties.map((w) => {
              const fixed = sameWho(w, { kind: "firm", id: fromId }) || sameWho(w, assignee) || sameWho(w, { kind: "staff", id: r.managerId });
              const on = fixed || dist.some((d) => sameWho(d, w));
              return (
                <li key={whoKey(w)}>
                  <label className={cx("flex items-center gap-2 rounded-md px-2 py-1.5", fixed ? "cursor-default" : "cursor-pointer hover:bg-surface-2")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={on}
                      disabled={fixed}
                      onChange={(e) => setDist(e.target.checked ? [...dist, w] : dist.filter((d) => !sameWho(d, w)))}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{whoName(w)}</span>
                      <span className="block truncate text-xs text-ink-3">{whoRole(w, r.projectId)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <section aria-label="Remove" className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <VoidControl x={x} />
          {r.status === "draft" && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-3.5" aria-hidden />}
              onClick={() => {
                const ids = [...r.files, ...r.entries.flatMap((e) => e.files ?? [])].filter((f) => f.stored).map((f) => f.id);
                remove(r.id);
                void deleteFiles(ids).catch(() => undefined);
                toast(`Draft ${x.number} deleted`);
              }}
            >
              Delete draft
            </Button>
          )}
        </section>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-xs text-ink-3">{dirty ? "Unsaved changes; saving logs them on the thread" : "No changes"}</span>
        <Button
          variant="primary"
          disabled={!dirty || invalid}
          onClick={() => {
            save(preview);
            toast(`${x.number} details saved`);
          }}
        >
          Save details
        </Button>
      </div>
    </>
  );
}
