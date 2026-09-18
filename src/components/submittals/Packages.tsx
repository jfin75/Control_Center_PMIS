"use client";

import { useState } from "react";
import { Download, Pencil, RotateCcw, Search, Send, Stamp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { DrawerHeader, toast } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { downloadCsv } from "@/lib/exporters";
import { addDays, fmtDate } from "@/lib/format";
import { PACKAGE_STATUS, partyName, savePackage, STATUS, type PackageRow } from "@/lib/submittals";
import { projectById } from "@/mock/projects";
import { ACTION_ORDER, REVIEW_ACTIONS, type SubmittalPackage } from "@/mock/submittals";
import { ActionBadge, days, MiniFact, partyRole, plural, StatusBadge, shortDate } from "./parts";
import { useSubmittals } from "./state";

type Filter = "active" | "draft" | "returned" | "all";

export function Packages() {
  const { packageRows, project, openPackage } = useSubmittals();
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);

  const mine = packageRows.filter((r) => project === "all" || r.p.projectId === project);
  const is = (r: PackageRow, f: Filter) =>
    f === "all" ? true : f === "draft" ? r.status === "draft" : f === "returned" ? r.status === "returned" : r.status === "inReview" || r.status === "partial" || r.resubmit > 0;
  const needle = q.trim().toLowerCase();
  const shown = mine
    .filter((r) => is(r, filter))
    .filter((r) => !needle || `${r.p.number} ${r.p.title} ${partyName({ kind: "firm", id: r.p.byId })}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.p.transmitted ?? "9999").localeCompare(a.p.transmitted ?? "9999") || b.p.number.localeCompare(a.p.number));

  return (
    <Panel title="Submittal packages" info="A package is one transmittal: the items a contractor sends together for review, with one review period and one route. Active includes packages still in review and returned packages that still owe resubmittals." flush>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<Filter>
            label="Show packages"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: "Active", count: mine.filter((r) => is(r, "active")).length },
              { value: "draft", label: "Drafts", count: mine.filter((r) => r.status === "draft").length },
              { value: "returned", label: "Returned", count: mine.filter((r) => r.status === "returned").length },
              { value: "all", label: "All", count: mine.length },
            ]}
          />
        </div>
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search packages</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field w-full pl-8" placeholder="Number, title, or firm" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[68rem]">
          <thead>
            <tr>
              <th className="min-w-[20rem]">Package</th>
              {project === "all" && <th>Project</th>}
              <th>Submitted by</th>
              <th className="r">Items</th>
              <th>Status</th>
              <th>Transmitted</th>
              <th>Review due</th>
              <th>Actions returned</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <tr key={r.p.id} className="row-link cursor-pointer" onClick={() => openPackage(r.p.id)}>
                <td>
                  <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openPackage(r.p.id); }}>
                    <span className="block font-semibold text-ink">{r.p.title}</span>
                    <span className="num block text-xs font-semibold text-accent-ink">{r.p.number}</span>
                  </button>
                </td>
                {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectById(r.p.projectId)!.code}</td>}
                <td className="max-w-[12rem] truncate text-ink-2">{partyName({ kind: "firm", id: r.p.byId })}</td>
                <td className="r">{r.p.items.length}</td>
                <td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={PACKAGE_STATUS[r.status].tone}>{PACKAGE_STATUS[r.status].label}</Badge>
                    {r.resubmit > 0 && <span className="text-xs font-semibold text-warn-ink">{plural(r.resubmit, "resubmittal")} owed</span>}
                  </div>
                </td>
                <td className="num whitespace-nowrap text-ink-2">{r.p.transmitted ? shortDate(r.p.transmitted) : <span className="text-ink-3">Not sent</span>}</td>
                <td className="whitespace-nowrap">
                  {r.due ? (
                    <>
                      <div className="num text-ink">{shortDate(r.due)}</div>
                      {r.late > 0 ? <div className="num text-xs font-semibold text-neg-ink">{days(r.late)} late</div> : r.returnedOn ? <div className="num text-xs text-ink-3">Returned {shortDate(r.returnedOn)}</div> : null}
                    </>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {ACTION_ORDER.filter((a) => r.actions[a]).map((a) => (
                      <span key={a} className="num">
                        <Badge tone={REVIEW_ACTIONS[a].tone} dot={false}>
                          {a} <span className="font-bold">{r.actions[a]}</span>
                        </Badge>
                      </span>
                    ))}
                    {r.returned < r.p.items.length && r.status !== "draft" && <span className="num self-center text-xs text-ink-3">{r.p.items.length - r.returned} pending</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-ink-2">
                  {filter === "draft" ? "No draft packages. Start one with New package, or select items in the register." : "No packages match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > limit && (
        <div className="flex justify-end border-t border-line-soft px-5 py-3">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 200)}>
            Show more
          </Button>
        </div>
      )}
    </Panel>
  );
}

export function PackageDetail({ pkg, onClose }: { pkg: SubmittalPackage; onClose: () => void }) {
  const { packageRows, rowById, subs, pkgs, commit, openItem, openBuilder, queue } = useSubmittals();
  const r = packageRows.find((x) => x.p.id === pkg.id)!;
  const project = projectById(pkg.projectId)!;
  const items = pkg.items.flatMap((i) => {
    const row = rowById.get(i.submittalId);
    return row ? [{ i, row, rev: row.s.revisions.find((v) => v.packageId === pkg.id) ?? null }] : [];
  });
  const owed = items.filter((x) => x.rev?.action && !REVIEW_ACTIONS[x.rev.action].closes && x.row.last?.packageId === pkg.id);
  const inReview = items.filter((x) => x.rev && !x.rev.action);
  const nextToReview = queue.find((q) => inReview.some((x) => x.row.s.id === q.s.id)) ?? inReview[0]?.row;

  const transmit = () => {
    const res = savePackage(
      { projectId: pkg.projectId, title: pkg.title, byId: pkg.byId, reviewDays: pkg.reviewDays, reviewers: pkg.reviewers, note: pkg.note, items: pkg.items.map((i) => ({ submittalId: i.submittalId, response: i.response })) },
      { transmit: true, existing: pkg, subs, pkgs },
    );
    commit({ subs: res.subs, pkgs: [res.pkg] });
    toast(`${pkg.number} transmitted to ${partyName(pkg.reviewers[0]!)} · due ${shortDate(addDays(res.pkg.transmitted!, pkg.reviewDays))}`);
  };

  const exportCsv = () =>
    downloadCsv(
      `${project.code}-${pkg.number}-transmittal.csv`,
      ["Package", "Title", "Project", "Submitted by", "Transmitted", "Review due", "Number", "Rev", "Item", "Type", "Action", "Returned", "Response to comments"],
      items.map(({ i, row, rev }) => [pkg.number, pkg.title, project.code, partyName({ kind: "firm", id: pkg.byId }), pkg.transmitted ?? "Draft", r.due ?? "", row.number, i.rev, row.s.title, row.s.type, rev?.action ? `${rev.action} — ${REVIEW_ACTIONS[rev.action].label}` : "", rev?.returned ?? "", i.response ?? ""]),
    );

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <p className="num text-xs font-semibold text-accent-ink">
          {pkg.number} · {project.code}
        </p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">{pkg.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{project.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={PACKAGE_STATUS[r.status].tone}>{PACKAGE_STATUS[r.status].label}</Badge>
          {r.late > 0 && <Badge tone="neg">{days(r.late)} past due</Badge>}
          {owed.length > 0 && <Badge tone="warn">{plural(owed.length, "resubmittal")} owed</Badge>}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <MiniFact label="Submitted by">{partyName({ kind: "firm", id: pkg.byId })}</MiniFact>
          <MiniFact label="Transmitted">{pkg.transmitted ? fmtDate(pkg.transmitted) : "Draft"}</MiniFact>
          <MiniFact label="Review period">{pkg.reviewDays} days</MiniFact>
          <MiniFact label="Review due">{r.due ? fmtDate(r.due) : `${pkg.reviewDays} days after sending`}</MiniFact>
        </dl>
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <h3 className="text-sm font-semibold text-ink">Review route</h3>
          <ol className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {pkg.reviewers.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-ink-4">→</span>}
                <span className="num inline-flex size-5 items-center justify-center rounded-full bg-accent-tint text-2xs font-bold text-accent-ink">{i + 1}</span>
                <span>
                  <span className="text-ink">{partyName(p)}</span> <span className="text-xs text-ink-3">{partyRole(p)}</span>
                </span>
              </li>
            ))}
          </ol>
          {pkg.note && <p className="mt-3 border-l-2 border-line pl-3 text-sm text-ink-2">{pkg.note}</p>}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">{plural(items.length, "item")}</h3>
          <table className="dt compact">
            <thead>
              <tr>
                <th>Item</th>
                <th>Action</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ i, row, rev }) => (
                <tr key={row.s.id} className="row-link cursor-pointer" onClick={() => openItem(row.s.id)}>
                  <td>
                    <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openItem(row.s.id); }}>
                      <span className="block font-semibold text-ink">{row.s.title}</span>
                      <span className="num block text-xs text-ink-3">
                        {row.number} · Rev {i.rev} · {row.s.type}
                      </span>
                    </button>
                    {i.response && <p className="mt-1 text-xs text-ink-2">Response: {i.response}</p>}
                  </td>
                  <td className="whitespace-nowrap">
                    {rev?.action ? (
                      <>
                        <ActionBadge action={rev.action} />
                        <div className="num mt-0.5 text-xs text-ink-3">{shortDate(rev.returned!)}</div>
                      </>
                    ) : rev ? (
                      <span className="text-xs text-ink-2">With {partyName(rev.steps.find((s) => !s.date)?.party ?? rev.steps[0]!.party)}</span>
                    ) : (
                      <span className="text-xs text-ink-3">Not sent</span>
                    )}
                  </td>
                  <td>
                    {row.last?.packageId === pkg.id || row.draft?.id === pkg.id ? <StatusBadge r={row} /> : <span className="text-xs text-ink-2">Superseded by Rev {row.last?.rev} · {STATUS[row.status].label}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <Button size="sm" variant="ghost" icon={<Download className="size-3.5" aria-hidden />} onClick={exportCsv}>
          Transmittal CSV
        </Button>
        <div className="flex flex-wrap gap-2">
          {r.status === "draft" && (
            <>
              <Button
                variant="danger"
                icon={<Trash2 className="size-3.5" aria-hidden />}
                onClick={() => {
                  commit({ removePkg: pkg.id });
                  onClose();
                  toast(`Draft ${pkg.number} deleted`);
                }}
              >
                Delete draft
              </Button>
              <Button icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => openBuilder({ existing: pkg })}>
                Edit
              </Button>
              <Button variant="primary" icon={<Send className="size-3.5" aria-hidden />} onClick={transmit}>
                Transmit for review
              </Button>
            </>
          )}
          {owed.length > 0 && (
            <Button icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => openBuilder({ projectId: pkg.projectId, itemIds: owed.filter((x) => !x.row.draft).map((x) => x.row.s.id) })} disabled={owed.every((x) => x.row.draft)}>
              Resubmit {plural(owed.length, "item")}
            </Button>
          )}
          {nextToReview && (
            <Button variant="primary" icon={<Stamp className="size-3.5" aria-hidden />} onClick={() => openItem(nextToReview.s.id)}>
              Review {inReview.length > 1 ? `${inReview.length} items` : "item"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

