"use client";

import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { EmptyState } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { addDays, cx, fmtDate } from "@/lib/format";
import { partyName, savePackage, type Row } from "@/lib/submittals";
import { CONTRACTORS, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { REGISTER_PROJECT_IDS, REVIEW_ACTIONS, ownerReviewer, reviewerFirms, type Party } from "@/mock/submittals";
import { NextDate, plural, RoutePicker, StatusBadge, shortDate } from "./parts";
import { useSubmittals, type BuilderInit } from "./state";

const SUBMITTERS = CONTRACTORS.filter((c) => c.kind === "General Contractor" || c.kind === "Trade Contractor" || c.kind === "Vendor");

/** Reviewer options for a project in route order: consultants, lead design firms, then the Owner. */
export function routeOptions(projectId: string): Party[] {
  const p = projectById(projectId);
  if (!p) return [];
  const rank = (x: Party) => (x.kind === "staff" ? 2 : x.id === "c-cedarmark" || x.id === "c-meridian-eq" ? 0 : 1);
  return [...reviewerFirms(p), ownerReviewer(p)].sort((a, b) => rank(a) - rank(b));
}

/** Comments that sent the last revision back, for the resubmittal response. */
export function returnComments(r: Row): Array<{ who: string; text: string }> {
  if (!r.last?.action || REVIEW_ACTIONS[r.last.action].closes) return [];
  return r.last.steps.filter((st) => st.comments && st.action && st.action !== "A" && st.action !== "E").map((st) => ({ who: partyName(st.party), text: st.comments! }));
}

export function PackageBuilder({ init, onClose }: { init: BuilderInit; onClose: () => void }) {
  const { allRows, rowById, subs, pkgs, commit, openPackage } = useSubmittals();
  const ex = init.existing ?? null;
  const [projectId, setProjectId] = useState(ex?.projectId ?? init.projectId ?? (init.itemIds?.[0] ? (rowById.get(init.itemIds[0])?.s.projectId ?? "") : ""));
  const [picked, setPicked] = useState<string[]>(ex ? ex.items.map((i) => i.submittalId) : (init.itemIds ?? []));
  const [responses, setResponses] = useState<Record<string, string>>(ex ? Object.fromEntries(ex.items.filter((i) => i.response).map((i) => [i.submittalId, i.response!])) : {});
  const [title, setTitle] = useState<string | null>(ex?.title ?? null);
  const [byId, setById] = useState<string | null>(ex?.byId ?? null);
  const [reviewDays, setReviewDays] = useState<number | null>(ex?.reviewDays ?? null);
  const [route, setRoute] = useState<Party[] | null>(ex?.reviewers ?? null);
  const [note, setNote] = useState(ex?.note ?? "");
  const [q, setQ] = useState("");
  const [tried, setTried] = useState(false);

  const project = projectById(projectId) ?? null;
  const eligible = useMemo(
    () =>
      allRows
        .filter((r) => r.s.projectId === projectId && (r.bucket === "toSubmit" || r.bucket === "rejected") && (!r.draft || r.draft.id === ex?.id))
        .sort((a, b) => a.s.section.localeCompare(b.s.section) || a.s.seq - b.s.seq),
    [allRows, projectId, ex?.id],
  );
  const chosen = eligible.filter((r) => picked.includes(r.s.id));
  const needle = q.trim().toLowerCase();
  const listed = eligible.filter((r) => picked.includes(r.s.id) || !needle || `${r.number} ${r.s.title} ${r.s.sectionTitle}`.toLowerCase().includes(needle));
  const sections = [...new Set(listed.map((r) => r.s.section))];
  const options = routeOptions(projectId);

  // Defaults follow the selection until the user overrides them.
  const autoTitle = (() => {
    if (!chosen.length) return "";
    const secs = [...new Set(chosen.map((r) => r.s.section))];
    const first = chosen[0]!;
    const resub = chosen.every((r) => r.bucket === "rejected") ? " — resubmittal" : "";
    return secs.length === 1 ? `${first.s.section} ${first.s.sectionTitle}${resub}` : `${first.s.section} ${first.s.sectionTitle} and ${plural(secs.length - 1, "more section")}${resub}`;
  })();
  const autoBy = (() => {
    const tally = new Map<string, number>();
    for (const r of chosen) tally.set(r.s.byId, (tally.get(r.s.byId) ?? 0) + 1);
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? project?.gcId ?? "";
  })();
  const autoDays = chosen.length ? Math.max(...chosen.map((r) => r.s.reviewDays)) : 14;
  const autoRoute = (() => {
    const ids = new Set(chosen.flatMap((r) => r.s.reviewers.map((p) => p.id)));
    const r = options.filter((o) => ids.has(o.id));
    return r.length ? r : options.filter((o) => o.kind === "firm").slice(0, 1);
  })();

  const effTitle = title ?? autoTitle;
  const effBy = byId ?? autoBy;
  const effDays = reviewDays ?? autoDays;
  const effRoute = route ?? autoRoute;
  const resubs = chosen.filter((r) => r.bucket === "rejected");
  const missing = resubs.filter((r) => !(responses[r.s.id] ?? "").trim());
  const errors = {
    items: !chosen.length,
    title: !effTitle.trim(),
    route: !effRoute.length,
    responses: missing.length > 0,
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = (transmit: boolean) => {
    setTried(true);
    if (!valid) return;
    const res = savePackage(
      {
        projectId,
        title: effTitle,
        byId: effBy,
        reviewDays: effDays,
        reviewers: effRoute,
        note,
        items: chosen.map((r) => ({ submittalId: r.s.id, response: responses[r.s.id] })),
      },
      { transmit, existing: ex, subs, pkgs },
    );
    commit({ subs: res.subs, pkgs: [res.pkg] });
    toast(transmit ? `${res.pkg.number} transmitted to ${partyName(effRoute[0]!)} · review due ${shortDate(addDays(TODAY, effDays))}` : `Draft ${res.pkg.number} saved`);
    onClose();
    openPackage(res.pkg.id);
  };

  const togglePick = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">{ex ? `Edit draft ${ex.number}` : "New submittal package"}</h2>
        <p className="mt-0.5 text-sm text-ink-2">Bundle items to submit, or resubmit items that came back rejected, into one transmittal.</p>
        {!ex && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            Project
            <select
              className="field w-full max-w-[26rem] min-w-0"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPicked([]);
                setRoute(null);
                setById(null);
              }}
            >
              <option value="">Choose a project…</option>
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
        )}
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
        {!project ? (
          <EmptyState title="Choose a project">Packages go to one project’s design team, so start with the project.</EmptyState>
        ) : (
          <>
            <section aria-labelledby="pb-items">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 id="pb-items" className="text-sm font-semibold text-ink">
                    Items
                  </h3>
                  <p className="text-xs text-ink-3">
                    {plural(eligible.length, "item")} can go out: not yet submitted, or returned for resubmittal. {chosen.length > 0 && <span className="font-semibold text-ink-2">{chosen.length} selected.</span>}
                  </p>
                </div>
                <label className="relative w-full sm:w-60">
                  <span className="sr-only">Filter items</span>
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                  <input className="field w-full pl-8" placeholder="Filter items" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
              </div>
              {tried && errors.items && <p className="mt-2 text-xs font-medium text-neg-ink">Pick at least one item.</p>}
              {!eligible.length ? (
                <p className="mt-3 text-sm text-ink-2">Nothing on this project’s register is waiting to be submitted.</p>
              ) : (
                <div className="mt-3 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
                  {sections.map((sec) => {
                    const group = listed.filter((r) => r.s.section === sec);
                    const allOn = group.every((r) => picked.includes(r.s.id));
                    return (
                      <div key={sec}>
                        <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1">
                          <h4 className="min-w-0 truncate text-xs font-semibold text-ink-2">
                            <span className="num text-accent-ink">{sec}</span> {group[0]!.s.sectionTitle}
                          </h4>
                          <button
                            type="button"
                            className="shrink-0 text-2xs font-semibold text-accent-ink hover:underline"
                            onClick={() => setPicked((p) => (allOn ? p.filter((id) => !group.some((r) => r.s.id === id)) : [...new Set([...p, ...group.map((r) => r.s.id)])]))}
                          >
                            {allOn ? "Clear section" : "Select section"}
                          </button>
                        </div>
                        <ul>
                          {group.map((r) => {
                            const on = picked.includes(r.s.id);
                            const comments = returnComments(r);
                            const bad = tried && on && r.bucket === "rejected" && !(responses[r.s.id] ?? "").trim();
                            return (
                              <li key={r.s.id} className="border-b border-line-soft py-2 last:border-b-0">
                                <label className="flex cursor-pointer items-start gap-3">
                                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={on} onChange={(e) => togglePick(r.s.id, e.target.checked)} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-ink">{r.s.title}</span>
                                    <span className="num block text-xs text-ink-3">
                                      {r.number} · {r.bucket === "rejected" ? `Rev ${r.rev} resubmittal` : "Rev 0"} · {r.s.type}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                                    <StatusBadge r={r} />
                                    <NextDate r={r} />
                                  </span>
                                </label>
                                {on && r.bucket === "rejected" && (
                                  <div className="mt-2 ml-7">
                                    {comments.length > 0 && (
                                      <ul className="mb-2 space-y-1 border-l-2 border-line pl-3 text-xs text-ink-2">
                                        {comments.map((c, i) => (
                                          <li key={i}>
                                            <span className="font-semibold text-ink">{c.who}:</span> {c.text}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <label className="block">
                                      <span className="text-xs font-semibold text-ink">Response to comments</span>
                                      <textarea
                                        className="field mt-1 w-full"
                                        rows={2}
                                        aria-invalid={bad || undefined}
                                        value={responses[r.s.id] ?? ""}
                                        onChange={(e) => setResponses((x) => ({ ...x, [r.s.id]: e.target.value }))}
                                        placeholder="What changed in this revision"
                                      />
                                      {bad && <span className="mt-0.5 block text-xs font-medium text-neg-ink">A resubmittal needs a response to the review comments.</span>}
                                    </label>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-labelledby="pb-transmittal" className="space-y-4">
              <h3 id="pb-transmittal" className="border-b border-line-soft pb-1 text-sm font-semibold text-ink">
                Transmittal
              </h3>
              <label className="block">
                <span className="text-sm font-semibold text-ink">Package title</span>
                <input className="field mt-1 w-full" value={effTitle} aria-invalid={(tried && errors.title) || undefined} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 23 73 13 Modular Indoor Central-Station AHUs" />
                {tried && errors.title && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Give the package a title.</span>}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Submitted by</span>
                  <select className="field mt-1 w-full" value={effBy} onChange={(e) => setById(e.target.value)}>
                    {SUBMITTERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.id === project.gcId ? " (GC)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Review period</span>
                  <span className="relative mt-1 block">
                    <input type="number" min={3} max={60} className="field num w-full pr-12 text-right" value={effDays} onChange={(e) => setReviewDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-3">days</span>
                  </span>
                </label>
                <div>
                  <span className="text-sm font-semibold text-ink">Review due if sent today</span>
                  <p className="num mt-1 flex h-8 items-center text-sm font-semibold text-ink">{fmtDate(addDays(TODAY, effDays))}</p>
                </div>
              </div>
              <RoutePicker options={options} value={effRoute} onChange={setRoute} names={partyName} invalid={tried && errors.route} />
              <label className="block">
                <span className="text-sm font-semibold text-ink">Transmittal note</span>
                <textarea className="field mt-1 w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: deviations, substitutions, or items to review first" />
              </label>
            </section>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className={cx("text-xs", tried && !valid ? "font-medium text-neg-ink" : "text-ink-3")}>
          {tried && !valid
            ? "Fix the highlighted fields to continue."
            : chosen.length
              ? `${plural(chosen.length, "item")}${resubs.length ? `, ${resubs.length} as resubmittals` : ""} · ${plural(effRoute.length, "reviewer")}`
              : "No items selected"}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => save(false)} disabled={!project}>
            Save draft
          </Button>
          <Button variant="primary" icon={<Send className="size-3.5" aria-hidden />} onClick={() => save(true)} disabled={!project}>
            Transmit for review
          </Button>
        </div>
      </div>
    </>
  );
}

