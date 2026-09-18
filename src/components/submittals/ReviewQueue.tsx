"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/data";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { addDays, cx, daysBetween } from "@/lib/format";
import { TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";
import { days, plural, shortDate } from "./parts";
import { useSubmittals } from "./state";

type Side = "all" | "design" | "owner";

export function ReviewQueue() {
  const { queue, project, pkgById, openItem, openPackage } = useSubmittals();
  const [side, setSide] = useState<Side>("all");
  const [who, setWho] = useState("all");

  const reviewers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of queue) if (r.ball) m.set(r.ball.id, r.ball.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [queue]);
  const shown = queue.filter((r) => (side === "all" || r.ball?.side === side) && (who === "all" || r.ball?.id === who));
  const overdue = queue.filter((r) => r.late > 0).length;
  const week = queue.filter((r) => r.late === 0 && r.last!.due <= addDays(TODAY, 7)).length;

  return (
    <Panel
      title="Review queue"
      info="Everything in review, most urgent first. Open an item to record the current reviewer's action; Record and next walks this list in order."
      flush
      actions={
        <p className="text-xs text-ink-3">
          <span className="num font-semibold text-neg-ink">{overdue} past due</span> · <span className="num font-semibold text-ink-2">{week} due this week</span> · <span className="num">{queue.length - overdue - week} later</span>
        </p>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <Segmented<Side>
          label="Waiting on"
          value={side}
          onChange={setSide}
          options={[
            { value: "all", label: "All", count: queue.length },
            { value: "design", label: "Design team", count: queue.filter((r) => r.ball?.side === "design").length },
            { value: "owner", label: "Owner", count: queue.filter((r) => r.ball?.side === "owner").length },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Reviewer
          <select className="field w-52" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">Every reviewer</option>
            {reviewers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!shown.length ? (
        <div className="border-t border-line-soft">
          <EmptyState icon={<Inbox className="size-5" aria-hidden />} title={queue.length ? "Nothing waiting on this reviewer" : "Nothing in review"}>
            {queue.length ? "Pick another reviewer, or show everyone." : "Transmitted packages land here until every reviewer on the route has stamped them."}
          </EmptyState>
        </div>
      ) : (
        <div className="scroll-x border-t border-line-soft">
          <table className="dt min-w-[64rem]">
            <thead>
              <tr>
                <th className="min-w-[18rem]">Submittal</th>
                {project === "all" && <th>Project</th>}
                <th>Package</th>
                <th>With</th>
                <th className="r">Held</th>
                <th>Sent</th>
                <th>Review due</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const pkg = pkgById.get(r.last!.packageId);
                const left = daysBetween(TODAY, r.last!.due);
                const over = (r.heldDays ?? 0) > (r.share ?? 0);
                return (
                  <tr key={r.s.id} className="row-link cursor-pointer" onClick={() => openItem(r.s.id)}>
                    <td>
                      <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openItem(r.s.id); }}>
                        <span className="block font-semibold text-ink">{r.s.title}</span>
                        <span className="num block text-xs text-ink-3">
                          <span className="font-semibold text-accent-ink">{r.number}</span> · Rev {r.rev} · {r.s.type}
                        </span>
                      </button>
                    </td>
                    {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectById(r.s.projectId)!.code}</td>}
                    <td onClick={(e) => e.stopPropagation()}>
                      {pkg && (
                        <button type="button" className="num text-sm font-semibold text-accent-ink hover:underline" onClick={() => openPackage(pkg.id)}>
                          {pkg.number}
                        </button>
                      )}
                    </td>
                    <td className="max-w-[14rem]">
                      <div className="truncate text-sm text-ink">{r.ball?.name}</div>
                      <div className="truncate text-xs text-ink-3">
                        Step {(r.step ?? 0) + 1} of {r.last!.steps.length} · {r.ball?.side === "owner" ? "Owner review" : r.ball?.role}
                      </div>
                    </td>
                    <td className={cx("r whitespace-nowrap", over ? "font-semibold text-neg-ink" : "text-ink-2")}>
                      {r.heldDays} of {r.share} d
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{shortDate(r.last!.submitted)}</td>
                    <td className="whitespace-nowrap">
                      <div className="num text-ink">{shortDate(r.last!.due)}</div>
                      <div className={cx("num text-xs", left < 0 ? "font-semibold text-neg-ink" : left <= 7 ? "font-semibold text-warn-ink" : "text-ink-3")}>
                        {left < 0 ? `${days(left)} late` : left === 0 ? "Due today" : `in ${days(left)}`}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > 0 && <p className="border-t border-line-soft px-5 py-3 text-xs text-ink-3">{plural(shown.length, "item")} waiting</p>}
    </Panel>
  );
}
