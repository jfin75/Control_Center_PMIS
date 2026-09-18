"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/data";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { addDays } from "@/lib/format";
import { whoName } from "@/lib/rfis";
import { TODAY } from "@/mock/org";
import { BallCell, DueCell, ImpactChips, plural, PriorityBadge, projectCode } from "./parts";
import { useRfis, type Queue } from "./state";

const QUEUES: Array<{ value: Queue; label: string; info: string; empty: string }> = [
  { value: "awaiting", label: "Awaiting response", info: "Issued RFIs the reviewer hasn't answered, soonest due first.", empty: "Every issued RFI has an answer or is back with the contractor." },
  { value: "answered", label: "Ready to close", info: "Answered RFIs waiting on the Owner's PM, oldest answer first. Close them, or return the answer if it doesn't resolve the question.", empty: "No answers are waiting on the Owner." },
  { value: "info", label: "Info requested", info: "RFIs the reviewer sent back to the contractor for more information. The reviewer's clock is stopped.", empty: "No reviewer is waiting on the contractor." },
  { value: "draft", label: "Drafts", info: "RFIs started but not issued.", empty: "No drafts." },
];

/** The Owner's worklists: what each party owes next, most urgent first. */
export function Queues() {
  const { queue, project, openRfi } = useRfis();
  const [which, setWhich] = useState<Queue>("awaiting");
  const [who, setWho] = useState("all");
  const list = queue(which);
  const q = QUEUES.find((x) => x.value === which)!;

  const holders = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of list) if (x.ball) m.set(x.ball.who.id, x.ball.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [list]);
  const shown = list.filter((x) => who === "all" || x.ball?.who.id === who);
  const overdue = list.filter((x) => x.late > 0).length;
  const week = list.filter((x) => x.late === 0 && x.r.due && x.r.due <= addDays(TODAY, 7)).length;
  const stale = list.filter((x) => (x.waitingClose ?? 0) > 7).length;

  return (
    <Panel
      title="Work queues"
      info={q.info}
      flush
      actions={
        which === "awaiting" ? (
          <p className="text-xs text-ink-3">
            <span className="num font-semibold text-neg-ink">{overdue} past due</span> · <span className="num font-semibold text-ink-2">{week} due this week</span> · <span className="num">{list.length - overdue - week} later</span>
          </p>
        ) : which === "answered" ? (
          <p className="text-xs text-ink-3">
            <span className="num font-semibold text-warn-ink">{stale} waiting more than a week</span>
          </p>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<Queue>
            label="Queue"
            value={which}
            onChange={(v) => {
              setWhich(v);
              setWho("all");
            }}
            options={QUEUES.map((x) => ({ value: x.value, label: x.label, count: queue(x.value).length }))}
          />
        </div>
        {holders.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Waiting on
            <select className="field w-52" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              {holders.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!shown.length ? (
        <div className="border-t border-line-soft">
          <EmptyState icon={<Inbox className="size-5" aria-hidden />} title={list.length ? "Nothing waiting on this party" : `Nothing in ${q.label.toLowerCase()}`}>
            {list.length ? "Pick someone else, or show everyone." : q.empty}
          </EmptyState>
        </div>
      ) : (
        <div className="scroll-x border-t border-line-soft">
          <table className="dt min-w-[64rem]">
            <thead>
              <tr>
                <th className="min-w-[20rem]">RFI</th>
                {project === "all" && <th>Project</th>}
                <th>Waiting on</th>
                <th>Dates</th>
                <th>Priority</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.r.id} className="row-link cursor-pointer" onClick={() => openRfi(x.r.id)}>
                  <td>
                    <button
                      type="button"
                      className="text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRfi(x.r.id);
                      }}
                    >
                      <span className="block font-semibold text-ink">{x.r.subject}</span>
                      <span className="num block text-xs text-ink-3">
                        <span className="font-semibold text-accent-ink">{x.number}</span> · {x.r.discipline}
                        {x.answer && which === "answered" && ` · answered by ${whoName(x.answer.by)}`}
                      </span>
                    </button>
                  </td>
                  {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectCode(x.r.projectId)}</td>}
                  <td>
                    <BallCell x={x} />
                  </td>
                  <td>
                    <DueCell x={x} />
                  </td>
                  <td>
                    <PriorityBadge p={x.r.priority} quiet />
                  </td>
                  <td>
                    <ImpactChips x={x} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > 0 && (
        <p className="border-t border-line-soft px-5 py-3 text-xs text-ink-3">
          {plural(shown.length, "RFI")} · open one to act on it; {which === "awaiting" ? "Respond and next" : which === "answered" ? "Close and next" : which === "info" ? "Provide info and next" : "Issue and next"} walks this list in order.
        </p>
      )}
    </Panel>
  );
}
