"use client";

import { useMemo, useState } from "react";
import { Download, GitPullRequestArrow, Paperclip, Search } from "lucide-react";
import { Button, Segmented, Switch } from "@/components/ui/controls";
import { Panel } from "@/components/ui/Panel";
import { downloadCsv } from "@/lib/exporters";
import { cx, money } from "@/lib/format";
import { isPending, modStatusLabel, type ModRow } from "@/lib/contracts";
import { CHANGE_CLASSIFIERS } from "@/mock/costCodes";
import { MOD_TYPE_ORDER, MOD_TYPES, type ModStatus, type ModType } from "@/mock/contracts";
import { ModAmount, ModStatusBadge, ModTypeTag, plural, projectCode, shortDate, WaitingCell } from "./parts";
import { useContracts } from "./state";

type StatusFilter = "pending" | "all" | "draft" | "approved" | "converted" | "closedOut";
type Sort = "age" | "value" | "number";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string; test: (s: ModStatus) => boolean }> = [
  { value: "pending", label: "Open and priced", test: (s) => s === "open" || s === "priced" },
  { value: "draft", label: "Drafts", test: (s) => s === "draft" },
  { value: "approved", label: "Executed or approved", test: (s) => s === "approved" },
  { value: "converted", label: "Converted", test: (s) => s === "converted" },
  { value: "closedOut", label: "Rejected or withdrawn", test: (s) => s === "rejected" || s === "withdrawn" },
  { value: "all", label: "Any status", test: () => true },
];

/** Every modification across the contracts in view: from first notice to executed change. */
export function Changes() {
  const { modRows, project, openMod, startMod } = useContracts();
  const [type, setType] = useState<"all" | ModType>("all");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [q, setQ] = useState("");
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("age");

  const test = STATUS_FILTERS.find((s) => s.value === status)!.test;
  const inStatus = useMemo(() => modRows.filter((x) => test(x.m.status)), [modRows, test]);
  const typeCount = (t: ModType) => inStatus.filter((x) => x.m.type === t).length;

  const needle = q.trim().toLowerCase();
  const shown = inStatus
    .filter((x) => type === "all" || x.m.type === type)
    .filter((x) => !ownerOnly || x.waiting?.who.kind === "staff")
    .filter((x) => !needle || `${x.number} ${x.m.title} ${x.m.description} ${x.c.number} ${x.c.title} ${x.m.ref ?? ""} ${projectCode(x.c.projectId)} ${x.waiting?.name ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (sort === "value") return b.value - a.value;
      if (sort === "number") return a.c.number.localeCompare(b.c.number, undefined, { numeric: true }) || a.number.localeCompare(b.number);
      return (b.age ?? -1) - (a.age ?? -1) || (b.m.submitted ?? b.m.created).localeCompare(a.m.submitted ?? a.m.created);
    });

  const pendingValue = shown.filter((x) => isPending(x.m)).reduce((a, x) => a + x.value, 0);
  const approvedValue = shown.filter((x) => x.m.status === "approved").reduce((a, x) => a + x.value, 0);

  const exportCsv = () =>
    downloadCsv(
      `contract-changes-${project === "all" ? "all" : projectCode(project)}.csv`,
      ["Change", "Type", "Title", "Contract", "Project", "Status", "Waiting on", "Estimate or price", "Approved", "Days", "Classifier", "Budget line", "Funding", "Submitted", "Decided", "Project record"],
      shown.map((x) => [
        x.number,
        MOD_TYPES[x.m.type].label,
        x.m.title,
        x.c.number,
        projectCode(x.c.projectId),
        modStatusLabel(x.m),
        x.waiting ? `${x.waiting.name} (${x.waiting.why})` : "",
        x.m.amount,
        x.m.approvedAmount ?? "",
        x.m.approvedDays ?? x.m.days ?? "",
        x.m.classifier,
        x.m.code,
        x.m.funding ?? "",
        x.m.submitted ?? "",
        x.m.decided ?? "",
        x.m.ref ?? "",
      ]),
    );

  return (
    <Panel
      title="Contract changes"
      info="Potential cost incidents and proposal requests lead to change orders; construction change directives let work proceed before the price is agreed. Additional service requests change design and consultant fees; amendments change terms, dates, rates, and ceilings."
      flush
      actions={
        <>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Sort by
            <select className="field w-36" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="age">Oldest open</option>
              <option value="value">Amount</option>
              <option value="number">Contract</option>
            </select>
          </label>
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={exportCsv}>
            CSV
          </Button>
          <Button size="sm" variant="primary" icon={<GitPullRequestArrow className="size-3.5" aria-hidden />} onClick={() => startMod()}>
            New change
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <div className="scroll-x max-w-full min-w-0">
          <Segmented<"all" | ModType>
            label="Change type"
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "All", count: inStatus.length }, ...MOD_TYPE_ORDER.map((t) => ({ value: t, label: t, count: typeCount(t) }))]}
          />
        </div>
        <label className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search changes</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field w-full pl-8" placeholder="Number, title, contract, or PCO" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3">
        <label className="flex items-center gap-2 text-xs text-ink-3">
          Status
          <select className="field w-48" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Switch checked={ownerOnly} onChange={setOwnerOnly} label="Waiting on the Owner" />
        {type !== "all" && <p className="text-xs text-ink-3">{MOD_TYPES[type].long}</p>}
      </div>

      <div className="scroll-x border-t border-line-soft">
        <table className="dt min-w-[70rem]">
          <thead>
            <tr>
              <th className="min-w-[20rem]">Change</th>
              <th>Contract</th>
              <th>Status</th>
              <th>Waiting on</th>
              <th>Dates</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <Line key={x.m.id} x={x} onOpen={() => openMod(x.m.id)} />
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-ink-2">
                  No changes match these filters.{" "}
                  <button
                    type="button"
                    className="font-semibold text-accent-ink hover:underline"
                    onClick={() => {
                      setType("all");
                      setStatus("all");
                      setQ("");
                      setOwnerOnly(false);
                    }}
                  >
                    Show every change
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-xs text-ink-3">
          <span className="num">
            {plural(shown.length, "change")}
            {pendingValue ? ` · ${money(pendingValue)} pending` : ""}
            {approvedValue ? ` · ${money(approvedValue)} approved` : ""}
          </span>
        </div>
      )}
    </Panel>
  );
}

function Line({ x, onOpen }: { x: ModRow; onOpen: () => void }) {
  const m = x.m;
  const classifier = CHANGE_CLASSIFIERS.find((c) => c.id === m.classifier)?.label;
  return (
    <tr className="row-link cursor-pointer" onClick={onOpen}>
      <td>
        <div className="flex items-start gap-2">
          <ModTypeTag m={m} />
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <span className="block font-semibold text-ink">{m.title}</span>
            <span className="num block text-xs text-ink-3">
              <span className="font-semibold text-accent-ink">{x.number}</span> · {classifier}
              {m.ref && ` · ${m.ref}`}
              {m.files.length > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5" title={plural(m.files.length, "file")}>
                  <Paperclip className="size-3" aria-hidden />
                  {m.files.length}
                  <span className="sr-only"> files</span>
                </span>
              )}
            </span>
          </button>
        </div>
      </td>
      <td>
        <div className="max-w-[15rem] min-w-0">
          <div className="num truncate text-sm text-ink">{x.c.number}</div>
          <div className="truncate text-xs text-ink-3">
            {projectCode(x.c.projectId)} · {x.c.title}
          </div>
        </div>
      </td>
      <td>
        <ModStatusBadge m={m} />
      </td>
      <td>
        <WaitingCell x={x} />
      </td>
      <td>
        <div className="num whitespace-nowrap">
          <span className="text-xs text-ink-3">{m.decided ? "Decided " : m.submitted ? "Submitted " : "Created "}</span>
          {shortDate(m.decided ?? m.submitted ?? m.created)}
          {x.age !== null && <div className={cx("text-xs", x.age > 30 ? "font-semibold text-neg-ink" : x.age > 14 ? "font-semibold text-warn-ink" : "text-ink-3")}>open {plural(x.age, "day")}</div>}
        </div>
      </td>
      <td className="r">
        <ModAmount x={x} />
      </td>
    </tr>
  );
}
