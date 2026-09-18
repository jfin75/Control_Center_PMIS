"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, PackagePlus, Send, Stamp } from "lucide-react";
import { Badge, Chip } from "@/components/ui/data";
import { Button, Tabs } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { addDays, cx, daysBetween, fmtDate } from "@/lib/format";
import { firmName, governing, partyName, savePackage, submitByFor, type Row } from "@/lib/submittals";
import { CONTRACTORS, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { RESUBMIT_DAYS, REVIEW_ACTIONS, SUBMITTAL_TYPES, type Party, type ReviewAction, type SubmittalType } from "@/mock/submittals";
import { routeOptions, returnComments } from "./PackageBuilder";
import { ActionBadge, ActionPicker, days, FloatChip, MiniFact, partyRole, plural, RoutePicker, StatusBadge, shortDate } from "./parts";
import { useSubmittals, type ItemTab } from "./state";

const SUBMITTERS = CONTRACTORS.filter((c) => c.kind === "General Contractor" || c.kind === "Trade Contractor" || c.kind === "Vendor");

export function ItemDetail({ r, tab, onTab, onClose }: { r: Row; tab: ItemTab; onTab: (t: ItemTab) => void; onClose: () => void }) {
  const p = projectById(r.s.projectId)!;
  const hasAction = r.bucket !== "closed";
  const actionLabel = r.bucket === "open" ? "Review" : r.bucket === "rejected" ? "Resubmit" : "Submit";
  const current: ItemTab = !hasAction && tab === "action" ? "history" : tab;

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <p className="num text-xs font-semibold text-accent-ink">
          {r.number}
          {r.rev > 0 && ` · Rev ${r.rev}`} ·{" "}
          <Link href={`/projects/${p.id}/`} className="hover:underline">
            {p.code}
          </Link>
        </p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">{r.s.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          {r.s.sectionTitle} · {r.s.type} · {firmName(r.s.byId)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge r={r} />
          {r.late > 0 && <Badge tone="neg">{days(r.late)} late</Badge>}
          {r.longLead && <Chip>{r.s.leadWeeks} wk lead</Chip>}
          <FloatChip r={r} />
        </div>
        {r.ball && (
          <p className="mt-2 text-sm text-ink-2">
            Ball in court: <span className="font-semibold text-ink">{r.ball.name}</span> <span className="text-ink-3">({r.ball.side === "owner" ? "Owner review" : r.ball.role})</span>
            {r.heldDays !== null && r.share !== null && (
              <span className={cx("num", r.heldDays > r.share ? "font-semibold text-neg-ink" : "text-ink-3")}>
                {" "}
                · held {r.heldDays} of {r.share} days
              </span>
            )}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <MiniFact label="Submit by" tip="Needed on site, less lead time, the review period, and schedule float">
            {fmtDate(r.submitBy)}
          </MiniFact>
          <MiniFact label="Needed on site">{fmtDate(r.s.requiredOnSite)}</MiniFact>
          <MiniFact label="Approval needed by" tip="Needed on site less the fabrication and delivery lead time">
            {fmtDate(r.approvalNeeded)}
          </MiniFact>
          <MiniFact label={r.bucket === "closed" ? "Approved" : "Forecast approval"}>
            <span className={cx(r.bucket !== "closed" && r.float < 0 && r.s.leadWeeks > 0 && "text-neg-ink")}>{fmtDate(r.forecastApproval)}</span>
          </MiniFact>
        </dl>
      </DrawerHeader>

      <div className="px-5">
        <Tabs
          idBase="item"
          label="Submittal sections"
          value={current}
          onChange={onTab}
          tabs={[
            ...(hasAction ? [{ value: "action" as const, label: actionLabel }] : []),
            { value: "history" as const, label: `History · ${plural(r.s.revisions.length, "revision")}` },
            { value: "details" as const, label: "Register details" },
          ]}
        />
      </div>

      <div id="item-panel" role="tabpanel" aria-labelledby={`item-tab-${current}`} className="flex min-h-0 flex-1 flex-col">
        {current === "action" && r.bucket === "open" && <ReviewForm r={r} />}
        {current === "action" && r.bucket === "rejected" && <SendForm r={r} mode="resubmit" />}
        {current === "action" && r.bucket === "toSubmit" && <SendForm r={r} mode="submit" />}
        {current === "history" && <History r={r} />}
        {current === "details" && <Details r={r} />}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Review: record the current reviewer's action
 * ------------------------------------------------------------------------- */

function ReviewForm({ r }: { r: Row }) {
  const { recordReview, queue, openItem } = useSubmittals();
  const last = r.last!;
  const step = r.step ?? 0;
  const party = last.steps[step]!.party;
  const isLast = step === last.steps.length - 1;
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [comments, setComments] = useState("");
  const [returnNow, setReturnNow] = useState(false);
  const [tried, setTried] = useState(false);

  const needsComment = action !== null && action !== "A" && action !== "E";
  const errAction = tried && !action;
  const errComment = tried && needsComment && !comments.trim();
  const finishes = isLast || returnNow;
  const outcome = action ? governing([...last.steps.slice(0, step).map((s) => s.action!).filter(Boolean), action]) : null;
  const idx = queue.findIndex((q) => q.s.id === r.s.id);
  const next = queue.length > 1 ? queue[(idx + 1) % queue.length] : null;

  const submit = (andNext: boolean) => {
    setTried(true);
    if (!action || (needsComment && !comments.trim())) return;
    recordReview(r.s.id, { action, comments, returnNow });
    if (andNext && next && next.s.id !== r.s.id) openItem(next.s.id);
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section aria-labelledby="route-h">
          <h3 id="route-h" className="text-sm font-semibold text-ink">
            Review route · Rev {last.rev}, sent {shortDate(last.submitted)}, due {shortDate(last.due)}
          </h3>
          <ol className="mt-2 space-y-3">
            {last.steps.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={cx(
                    "num mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold",
                    st.date ? "bg-pos-tint text-pos-ink" : i === step ? "bg-accent text-white" : "bg-sunk text-ink-3",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink">{partyName(st.party)}</span>
                    <span className="text-xs text-ink-3">{partyRole(st.party)}</span>
                    {st.action && <ActionBadge action={st.action} />}
                    {st.date && <span className="num text-xs text-ink-3">{shortDate(st.date)}</span>}
                    {!st.date && i === step && (
                      <span className={cx("num text-xs font-semibold", (r.heldDays ?? 0) > (r.share ?? 0) ? "text-neg-ink" : "text-accent-ink")}>
                        Reviewing now · {r.heldDays} of {r.share} days
                      </span>
                    )}
                    {!st.date && i > step && <span className="text-xs text-ink-3">Waiting</span>}
                  </div>
                  {st.comments && st.action !== "A" && st.action !== "E" && <p className="mt-0.5 text-sm text-ink-2">{st.comments}</p>}
                </div>
              </li>
            ))}
          </ol>
          {last.response && (
            <p className="mt-3 border-l-2 border-line pl-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">Contractor’s response to Rev {last.rev - 1}:</span> {last.response}
            </p>
          )}
        </section>

        <section aria-labelledby="record-h" className="space-y-4 border-t border-line pt-5">
          <div>
            <h3 id="record-h" className="text-md font-semibold text-ink">
              Record the review for {partyName(party)}
            </h3>
            <p className="text-xs text-ink-3">
              Step {step + 1} of {last.steps.length} · {partyRole(party)}. Stamped {fmtDate(TODAY)}.
            </p>
          </div>
          <ActionPicker value={action} onChange={setAction} name={`action-${r.s.id}`} />
          {errAction && <p className="-mt-2 text-xs font-medium text-neg-ink">Choose an action.</p>}
          <label className="block">
            <span className="text-sm font-semibold text-ink">Comments{needsComment ? "" : " (optional)"}</span>
            <textarea
              className="field mt-1 w-full"
              rows={3}
              value={comments}
              aria-invalid={errComment || undefined}
              onChange={(e) => setComments(e.target.value)}
              placeholder={needsComment ? "What must change, with sheet or page references" : "No exceptions taken."}
            />
            {errComment && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Say what the contractor has to correct.</span>}
          </label>
          {!isLast && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={returnNow} onChange={(e) => setReturnNow(e.target.checked)} />
              <span>
                Return to the contractor now
                <span className="block text-xs text-ink-3">Skips {plural(last.steps.length - step - 1, "remaining reviewer")}. Use when the submittal fails regardless of later reviews.</span>
              </span>
            </label>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-xs text-ink-3">
          {!outcome ? (
            "Most restrictive action governs"
          ) : finishes ? (
            <>
              Returns to {firmName(r.s.byId)} as <span className="font-semibold text-ink">{REVIEW_ACTIONS[outcome].label}</span>
              {!REVIEW_ACTIONS[outcome].closes && `; resubmittal due ${shortDate(addDays(TODAY, RESUBMIT_DAYS))}`}
            </>
          ) : (
            <>
              Forwards to <span className="font-semibold text-ink">{partyName(last.steps[step + 1]!.party)}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {next && next.s.id !== r.s.id && (
            <Button icon={<ArrowRight className="size-3.5" aria-hidden />} onClick={() => submit(true)}>
              Record and next
            </Button>
          )}
          <Button variant="primary" icon={<Stamp className="size-3.5" aria-hidden />} onClick={() => submit(false)}>
            Record review
          </Button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Submit and resubmit: a one-item package, or hand off to the builder
 * ------------------------------------------------------------------------- */

function SendForm({ r, mode }: { r: Row; mode: "submit" | "resubmit" }) {
  const { subs, pkgs, commit, openBuilder, openPackage, allRows } = useSubmittals();
  const [response, setResponse] = useState("");
  const [route, setRoute] = useState<Party[]>(r.s.reviewers);
  const [reviewDays, setReviewDays] = useState(r.s.reviewDays);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const comments = returnComments(r);
  const options = routeOptions(r.s.projectId);
  const siblings = allRows.filter((x) => x.s.projectId === r.s.projectId && x.s.section === r.s.section && (x.bucket === "toSubmit" || x.bucket === "rejected") && !x.draft);
  const errResponse = tried && mode === "resubmit" && !response.trim();
  const errRoute = tried && !route.length;

  if (r.draft) {
    return (
      <div className="px-5 py-6">
        <p className="text-sm text-ink-2">
          This item is in draft package <span className="num font-semibold text-ink">{r.draft.number}</span>, {r.draft.title}. Transmit or edit the draft to send it.
        </p>
        <Button className="mt-3" onClick={() => openPackage(r.draft!.id)}>
          Open {r.draft.number}
        </Button>
      </div>
    );
  }

  const send = () => {
    setTried(true);
    if ((mode === "resubmit" && !response.trim()) || !route.length) return;
    const res = savePackage(
      {
        projectId: r.s.projectId,
        title: `${r.number} ${r.s.title}${mode === "resubmit" ? ` — Rev ${r.rev}` : ""}`,
        byId: r.s.byId,
        reviewDays,
        reviewers: route,
        note,
        items: [{ submittalId: r.s.id, response }],
      },
      { transmit: true, subs, pkgs },
    );
    commit({ subs: res.subs, pkgs: [res.pkg] });
    toast(`${res.pkg.number}: ${mode === "resubmit" ? `Rev ${r.rev} resubmitted` : "submitted"} to ${partyName(route[0]!)} · due ${shortDate(addDays(TODAY, reviewDays))}`);
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {mode === "resubmit" ? (
          <section aria-labelledby="ret-h">
            <h3 id="ret-h" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              Rev {r.last!.rev} returned {shortDate(r.last!.returned!)} <ActionBadge action={r.last!.action!} />
            </h3>
            <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-3 text-sm text-ink-2">
              {comments.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink">{c.who}:</span> {c.text}
                </li>
              ))}
            </ul>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-ink">Response to comments</span>
              <textarea className="field mt-1 w-full" rows={3} aria-invalid={errResponse || undefined} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="What changed in this revision" />
              {errResponse && <span className="mt-0.5 block text-xs font-medium text-neg-ink">A resubmittal needs a response to the review comments.</span>}
            </label>
          </section>
        ) : (
          <p className="text-sm text-ink-2">
            {r.late > 0 ? (
              <>
                Due to be submitted by <span className="num font-semibold text-neg-ink">{fmtDate(r.submitBy)}</span>, {days(r.late)} ago.
              </>
            ) : (
              <>
                Due to be submitted by <span className="num font-semibold text-ink">{fmtDate(r.submitBy)}</span> to hold the {shortDate(r.s.requiredOnSite)} need date.
              </>
            )}{" "}
            {siblings.length > 1 && <>{plural(siblings.length - 1, "other item")} in {r.s.section} can go in the same package.</>}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Review period</span>
            <span className="relative mt-1 block">
              <input type="number" min={3} max={60} className="field num w-full pr-12 text-right" value={reviewDays} onChange={(e) => setReviewDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-3">days</span>
            </span>
          </label>
          <div>
            <span className="text-sm font-semibold text-ink">Review due if sent today</span>
            <p className="num mt-1 flex h-8 items-center text-sm font-semibold text-ink">{fmtDate(addDays(TODAY, reviewDays))}</p>
          </div>
        </div>
        <RoutePicker options={options} value={route} onChange={setRoute} names={partyName} invalid={errRoute} />
        <label className="block">
          <span className="text-sm font-semibold text-ink">Transmittal note</span>
          <textarea className="field mt-1 w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
        <Button icon={<PackagePlus className="size-3.5" aria-hidden />} onClick={() => openBuilder({ projectId: r.s.projectId, itemIds: siblings.length > 1 ? siblings.map((x) => x.s.id) : [r.s.id] })}>
          {siblings.length > 1 ? `Package with ${r.s.section}` : "Add to a package"}
        </Button>
        <Button variant="primary" icon={<Send className="size-3.5" aria-hidden />} onClick={send}>
          {mode === "resubmit" ? `Resubmit as Rev ${r.rev}` : "Submit this item"}
        </Button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * History
 * ------------------------------------------------------------------------- */

function History({ r }: { r: Row }) {
  const { pkgById, openPackage } = useSubmittals();
  if (!r.s.revisions.length) {
    return (
      <p className="px-5 py-6 text-sm text-ink-2">
        Not submitted yet. Submit by <span className="num font-semibold text-ink">{fmtDate(r.submitBy)}</span>.
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <ol className="space-y-6">
        {[...r.s.revisions].reverse().map((v) => {
          const pkg = pkgById.get(v.packageId);
          return (
            <li key={v.rev} className="border-b border-line-soft pb-5 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  Rev {v.rev}
                  {pkg && (
                    <button type="button" className="num text-xs font-semibold text-accent-ink hover:underline" onClick={() => openPackage(pkg.id)}>
                      {pkg.number}
                    </button>
                  )}
                </h3>
                {v.action ? <ActionBadge action={v.action} /> : <Badge tone="accent">In review</Badge>}
              </div>
              <p className="num mt-0.5 text-xs text-ink-3">
                Sent {fmtDate(v.submitted)} · due {shortDate(v.due)}
                {v.returned && (
                  <>
                    {" "}
                    · returned {shortDate(v.returned)}
                    {v.returned > v.due && <span className="font-semibold text-neg-ink"> ({days(daysBetween(v.due, v.returned))} late)</span>}
                  </>
                )}
              </p>
              {v.response && (
                <p className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-2">
                  <span className="font-semibold text-ink">Response:</span> {v.response}
                </p>
              )}
              <table className="dt compact quiet mt-2">
                <tbody>
                  {v.steps.map((st, i) => (
                    <tr key={i}>
                      <td className="w-[40%] align-top">
                        <div className="text-sm text-ink">{partyName(st.party)}</div>
                        <div className="text-xs text-ink-3">{partyRole(st.party)}</div>
                      </td>
                      <td className="align-top whitespace-nowrap">{st.action ? <ActionBadge action={st.action} short /> : <span className="text-xs text-ink-3">{v.action ? "Skipped" : "Pending"}</span>}</td>
                      <td className="align-top text-sm text-ink-2">
                        {st.comments}
                        {st.date && <span className="num block text-xs text-ink-3">{shortDate(st.date)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Register details: the fields that drive the submit-by date
 * ------------------------------------------------------------------------- */

function Details({ r }: { r: Row }) {
  const { commit } = useSubmittals();
  const [title, setTitle] = useState(r.s.title);
  const [type, setType] = useState<SubmittalType>(r.s.type);
  const [byId, setById] = useState(r.s.byId);
  const [ros, setRos] = useState(r.s.requiredOnSite);
  const [lead, setLead] = useState(r.s.leadWeeks);
  const [reviewDays, setReviewDays] = useState(r.s.reviewDays);
  const [route, setRoute] = useState<Party[]>(r.s.reviewers);
  const options = routeOptions(r.s.projectId);
  const dirty =
    title !== r.s.title || type !== r.s.type || byId !== r.s.byId || ros !== r.s.requiredOnSite || lead !== r.s.leadWeeks || reviewDays !== r.s.reviewDays || route.map((x) => x.id).join() !== r.s.reviewers.map((x) => x.id).join();
  const invalid = !title.trim() || !ros || !route.length;
  const submitBy = ros ? submitByFor(ros, lead, reviewDays) : null;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Item title</span>
          <input className="field mt-1 w-full" value={title} aria-invalid={!title.trim() || undefined} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Type</span>
            <select className="field mt-1 w-full" value={type} onChange={(e) => setType(e.target.value as SubmittalType)}>
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
            <input type="date" className="field num mt-1 w-full" value={ros} aria-invalid={!ros || undefined} onChange={(e) => setRos(e.target.value)} />
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
            Submit by <span className="num font-semibold text-ink">{fmtDate(submitBy)}</span>
            {submitBy !== r.submitBy && <span className="text-ink-3"> (was {shortDate(r.submitBy)})</span>}. Needed on site, less lead time, the review period, and{" "}
            {lead >= 8 ? "one resubmittal cycle" : "a week"} of float.
          </p>
        )}
        <RoutePicker options={options} value={route} onChange={setRoute} names={partyName} invalid={!route.length} />
        <p className="text-xs text-ink-3">The route applies to the next revision sent; a revision already in review keeps its route.</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-xs text-ink-3">{dirty ? "Unsaved changes" : "No changes"}</span>
        <Button
          variant="primary"
          disabled={!dirty || invalid}
          onClick={() => {
            commit({ subs: [{ ...r.s, title: title.trim(), type, byId, requiredOnSite: ros, leadWeeks: lead, reviewDays, reviewers: route }] });
            toast(`${r.number} register details saved`);
          }}
        >
          Save details
        </Button>
      </div>
    </>
  );
}
