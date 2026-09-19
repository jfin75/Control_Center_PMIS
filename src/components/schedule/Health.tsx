"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Em, EmptyState, Narrative } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { fmtDate } from "@/lib/format";
import { healthChecks, healthScore, worstFirst } from "@/lib/schedule/health";
import { plural } from "./parts";
import { useSchedule } from "./state";

/** The DCMA-style checks for the version on screen, each one a click away from the activities that fail it. */
export function Health() {
  const { s, r, project, showInGantt } = useSchedule();
  const checks = useMemo(() => (s && r ? healthChecks(s, r) : []), [s, r]);
  if (project === "all" || !s || !r) {
    return (
      <div className="panel">
        <EmptyState title="Pick a project with a detailed schedule">Health checks run on one schedule version at a time. Choose a project above.</EmptyState>
      </div>
    );
  }
  const score = healthScore(checks);
  const failing = worstFirst(checks);
  return (
    <div className="space-y-5">
      <Panel title="Schedule quality" info="Adapted from the DCMA 14-point assessment. Thresholds are the DCMA's; float and duration limits are 44 working days.">
        <Narrative>
          <Em tone={failing.length ? "neg" : "pos"}>
            {score.passed} of {score.of}
          </Em>{" "}
          checks pass on {s.name}, statused to {fmtDate(s.dataDate)}.
          {failing.length ? (
            <>
              {" "}
              Ask the scheduler about {failing
                .slice(0, 3)
                .map((c) => c.label.toLowerCase())
                .join(", ")
                .replace(/, ([^,]*)$/, " and $1")}{" "}
              before accepting the update.
            </>
          ) : (
            " The logic is sound enough to rely on its dates."
          )}
        </Narrative>
      </Panel>
      <Panel title="Checks" flush>
        <div className="scroll-x">
          <table className="dt">
            <thead>
              <tr>
                <th>Check</th>
                <th>Result</th>
                <th>Target</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-[34rem] min-w-[18rem]">
                    <div className="font-semibold text-ink">{c.label}</div>
                    <div className="mt-0.5 text-xs text-ink-3">{c.about}</div>
                  </td>
                  <td className="num whitespace-nowrap text-ink">{c.value}</td>
                  <td className="num whitespace-nowrap text-ink-2">{c.target}</td>
                  <td>{c.na ? <Badge>Not yet</Badge> : c.pass ? <Badge tone="pos">Pass</Badge> : <Badge tone="neg">Fail</Badge>}</td>
                  <td className="r whitespace-nowrap">
                    {c.ids.length > 0 && (
                      <Button size="sm" variant="ghost" icon={<ArrowRight className="size-3.5" aria-hidden />} onClick={() => showInGantt({ label: c.label, ids: c.ids })}>
                        {`Show ${plural(c.ids.length, "activity", "activities")}`}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
