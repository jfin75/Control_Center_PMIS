"use client";

import { useState } from "react";
import { Download, Scale } from "lucide-react";
import { Chip, EmptyState, Em, Narrative } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { money } from "@/lib/format";
import { hasImpact, kpis, unlinked, type Row } from "@/lib/rfis";
import { IMPACT_LABEL } from "@/mock/rfis";
import { exportRows } from "./export";
import { BallCell, plural, projectCode, StageBadge } from "./parts";
import { useRfis } from "./state";

type Filter = "all" | "open" | "possible" | "yes" | "unlinked";

const is = (x: Row, f: Filter) =>
  f === "all" ? true : f === "open" ? x.stage !== "closed" : f === "possible" ? x.r.costImpact === "possible" || x.r.scheduleImpact === "possible" : f === "yes" ? x.r.costImpact === "yes" || x.r.scheduleImpact === "yes" : unlinked(x);

/**
 * RFIs whose answers carry cost or time. Exposure over activity: this is where
 * an answer turns into a PCO, so anything confirmed without one is called out.
 */
export function Impacts() {
  const { rows, project, openRfi } = useRfis();
  const all = rows.filter(hasImpact);
  const [filter, setFilter] = useState<Filter>(all.some(unlinked) ? "unlinked" : "all");
  const k = kpis(rows);
  const shown = all.filter((x) => is(x, filter)).sort((a, b) => Number(unlinked(b)) - Number(unlinked(a)) || b.exposure - a.exposure);
  const total = shown.reduce((a, x) => a + x.exposure, 0);
  const days = shown.reduce((a, x) => a + (x.r.scheduleImpact !== "none" ? (x.r.scheduleDays ?? 0) : 0), 0);

  return (
    <>
      <Panel className="mb-5">
        <Narrative className="max-w-[88ch]">
          <Em>{plural(k.impactCount, "RFI")}</Em> carry a cost or schedule impact: <Em tone="neg">{money(k.confirmed, { compact: true })}</Em> confirmed and <Em>{money(k.possible, { compact: true })}</Em> possible, with{" "}
          <Em>{plural(k.scheduleDays, "day")}</Em> of schedule claimed.{" "}
          {k.unlinked > 0 ? (
            <>
              <Em tone="neg">{plural(k.unlinked, "confirmed impact")}</Em> {k.unlinked === 1 ? "has" : "have"} no PCO or change order yet, so the budget can't see {k.unlinked === 1 ? "it" : "them"}.
            </>
          ) : (
            <>Every confirmed impact is carried on a PCO or change order.</>
          )}
        </Narrative>
      </Panel>

      <Panel
        title="Cost and schedule impacts"
        info="Possible means the reviewer or contractor flagged a likely impact; confirmed means the answer changes the work. Confirmed cost belongs on a PCO or change order; add the reference on the RFI's details or when closing it."
        flush
        actions={
          <Button size="sm" variant="ghost" icon={<Download className="size-3.5" aria-hidden />} onClick={() => exportRows(shown, "impacts")} disabled={!shown.length}>
            Export
          </Button>
        }
      >
        <div className="px-5 pb-3">
          <div className="scroll-x max-w-full min-w-0">
            <Segmented<Filter>
              label="Show impacts"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "unlinked", label: "No PCO", count: all.filter(unlinked).length },
                { value: "open", label: "Not closed", count: all.filter((x) => is(x, "open")).length },
                { value: "possible", label: "Possible", count: all.filter((x) => is(x, "possible")).length },
                { value: "yes", label: "Confirmed", count: all.filter((x) => is(x, "yes")).length },
                { value: "all", label: "All", count: all.length },
              ]}
            />
          </div>
        </div>
        {!shown.length ? (
          <div className="border-t border-line-soft">
            <EmptyState icon={<Scale className="size-5" aria-hidden />} title="Nothing here">
              {all.length ? "No impacts match this filter." : "No RFI on this log carries a cost or schedule impact."}
            </EmptyState>
          </div>
        ) : (
          <div className="scroll-x border-t border-line-soft">
            <table className="dt min-w-[64rem]">
              <thead>
                <tr>
                  <th className="min-w-[20rem]">RFI</th>
                  {project === "all" && <th>Project</th>}
                  <th>Status</th>
                  <th>Cost</th>
                  <th className="r">Estimate</th>
                  <th>Schedule</th>
                  <th>Carried on</th>
                  <th>Ball in court</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => (
                  <tr key={x.r.id} className="row-link cursor-pointer" onClick={() => openRfi(x.r.id, "details")}>
                    <td>
                      <button
                        type="button"
                        className="text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRfi(x.r.id, "details");
                        }}
                      >
                        <span className="block font-semibold text-ink">{x.r.subject}</span>
                        <span className="num block text-xs text-ink-3">
                          <span className="font-semibold text-accent-ink">{x.number}</span> · {x.r.discipline}
                        </span>
                      </button>
                    </td>
                    {project === "all" && <td className="num whitespace-nowrap text-ink-2">{projectCode(x.r.projectId)}</td>}
                    <td>
                      <StageBadge x={x} />
                    </td>
                    <td className="text-sm text-ink-2">{x.r.costImpact === "none" ? <span className="text-ink-4">—</span> : IMPACT_LABEL[x.r.costImpact]}</td>
                    <td className="r font-semibold text-ink">{x.r.costImpact !== "none" ? (x.r.costEstimate ? money(x.r.costEstimate) : <span className="font-normal text-ink-3">TBD</span>) : <span className="text-ink-4">—</span>}</td>
                    <td className="text-sm whitespace-nowrap text-ink-2">
                      {x.r.scheduleImpact === "none" ? <span className="text-ink-4">—</span> : `${IMPACT_LABEL[x.r.scheduleImpact]}${x.r.scheduleDays ? ` · ${x.r.scheduleDays} d` : ""}`}
                    </td>
                    <td className="num whitespace-nowrap">{x.r.changeRef ? <span className="font-semibold text-ink">{x.r.changeRef}</span> : unlinked(x) ? <Chip tone="neg">Needs PCO</Chip> : <span className="text-ink-4">—</span>}</td>
                    <td>
                      <BallCell x={x} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={project === "all" ? 4 : 3} className="text-sm font-semibold text-ink">
                    {plural(shown.length, "RFI")}
                  </td>
                  <td className="r num font-bold text-ink">{money(total)}</td>
                  <td className="num text-sm font-semibold text-ink">{days ? `${days} d` : ""}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
