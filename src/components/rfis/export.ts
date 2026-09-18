import { downloadCsv } from "@/lib/exporters";
import { STAGES, whoName, type Row } from "@/lib/rfis";
import { TODAY } from "@/mock/org";
import { IMPACT_LABEL, PRIORITIES } from "@/mock/rfis";
import { projectCode } from "./parts";

/** The RFI log as CSV, one row per RFI, with the answer of record. */
export function exportRows(rows: Row[], label: string) {
  downloadCsv(
    `rfi-log-${label}-${TODAY}.csv`,
    [
      "Project",
      "Number",
      "Subject",
      "Discipline",
      "Spec section",
      "Drawing",
      "Location",
      "From",
      "Assigned to",
      "Priority",
      "Status",
      "Ball in court",
      "Issued",
      "Response due",
      "Days late",
      "Answered",
      "Closed",
      "Days open",
      "Reviewer days to answer",
      "Cost impact",
      "Cost estimate",
      "Schedule impact",
      "Schedule days",
      "Change reference",
      "Question",
      "Answer",
    ],
    rows.map((x) => [
      projectCode(x.r.projectId),
      x.number,
      x.r.subject,
      x.r.discipline,
      x.r.section ?? "",
      x.r.drawing ?? "",
      x.r.location ?? "",
      whoName({ kind: "firm", id: x.r.fromId }),
      whoName(x.r.assignee),
      PRIORITIES[x.r.priority].label,
      STAGES[x.stage].label,
      x.ball?.name ?? "",
      x.r.issued ?? "",
      x.r.status === "draft" ? "" : (x.r.due ?? ""),
      x.late || "",
      x.answeredOn ?? "",
      x.r.status === "closed" ? (x.r.closed ?? "") : "",
      x.daysOpen ?? "",
      x.reviewDays ?? "",
      IMPACT_LABEL[x.r.costImpact],
      x.r.costEstimate ?? "",
      IMPACT_LABEL[x.r.scheduleImpact],
      x.r.scheduleDays ?? "",
      x.r.changeRef ?? "",
      x.r.question,
      x.answer?.text ?? "",
    ]),
  );
}
