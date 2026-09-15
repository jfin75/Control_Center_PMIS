"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { Badge, KpiStrip } from "@/components/ui/data";
import { Button, IconButton } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { cx, num, parseISO } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { CURRENT_USER_ID, person } from "@/mock/org";
import { PROJECTS, projectById } from "@/mock/projects";
import { SEED_TIMESHEET, TIME_ACCOUNTS, WEEK_START, type TimeRow } from "@/mock/workspace";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Sheet {
  rows: TimeRow[];
  status: "Draft" | "Submitted" | "Approved";
}

function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const label = (iso: string) => parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function TimeView() {
  const me = person(CURRENT_USER_ID);
  const [week, setWeek] = useState(WEEK_START);
  const [sheets, setSheets] = useStoredState<Record<string, Sheet>>("cc.time.v1", { [WEEK_START]: { rows: SEED_TIMESHEET, status: "Draft" } });
  const sheet: Sheet = sheets[week] ?? { rows: [], status: week < WEEK_START ? "Approved" : "Draft" };
  const locked = sheet.status !== "Draft";
  const update = (fn: (s: Sheet) => Sheet) => setSheets((all) => ({ ...all, [week]: fn(all[week] ?? sheet) }));

  const dayTotals = DAYS.map((_, i) => sheet.rows.reduce((a, r) => a + (r.hours[i] ?? 0), 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const capital = sheet.rows.filter((r) => r.projectId).reduce((a, r) => a + r.hours.reduce((x, y) => x + y, 0), 0);
  const overDay = dayTotals.some((h) => h > 24);
  const incomplete = sheet.rows.some((r) => !r.account);
  const dates = DAYS.map((_, i) => addDays(week, i));

  const accountsFor = (projectId: string | null) => (projectId ? TIME_ACCOUNTS.filter((a) => !a.code.startsWith("OPS") && a.code !== "PTO") : TIME_ACCOUNTS.filter((a) => a.code.startsWith("OPS") || a.code === "PTO"));

  const setCell = (rowId: string, day: number, v: string) => {
    const n = v === "" ? 0 : Math.max(0, Math.min(24, Math.round(Number(v) * 4) / 4));
    if (!Number.isFinite(n)) return;
    update((s) => ({ ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, hours: r.hours.map((h, i) => (i === day ? n : h)) } : r)) }));
  };

  const prevWeek = useMemo(() => sheets[addDays(week, -7)], [sheets, week]);

  const setRowProject = (rowId: string, pid: string | null) =>
    update((s) => ({ ...s, rows: s.rows.map((x) => (x.id === rowId ? { ...x, projectId: pid, account: accountsFor(pid)[0]!.code } : x)) }));
  const setRowAccount = (rowId: string, account: string) => update((s) => ({ ...s, rows: s.rows.map((x) => (x.id === rowId ? { ...x, account } : x)) }));
  const removeRow = (rowId: string) => update((s) => ({ ...s, rows: s.rows.filter((x) => x.id !== rowId) }));
  const addRow = () => update((s) => ({ ...s, rows: [...s.rows, { id: `r${Date.now()}`, projectId: PROJECTS[0]!.id, account: "1.14", hours: [0, 0, 0, 0, 0, 0, 0] }] }));

  return (
    <>
      <PageHeader
        title="Time Tracking"
        meta={`${me.name} · ${me.title} · hours post to project cost accounts for capitalization`}
        actions={
          <div className="flex items-center gap-1">
            <IconButton label="Previous week" variant="secondary" onClick={() => setWeek((w) => addDays(w, -7))}>
              <ChevronLeft className="size-4" aria-hidden />
            </IconButton>
            <span className="num min-w-[11.5rem] text-center text-sm font-semibold text-ink" aria-live="polite">
              {label(week)} – {label(addDays(week, 6))}, {week.slice(0, 4)}
            </span>
            <IconButton label="Next week" variant="secondary" onClick={() => setWeek((w) => addDays(w, 7))} disabled={week >= WEEK_START}>
              <ChevronRight className="size-4" aria-hidden />
            </IconButton>
            {week !== WEEK_START && (
              <Button variant="ghost" size="sm" onClick={() => setWeek(WEEK_START)}>
                This week
              </Button>
            )}
          </div>
        }
      />

      <KpiStrip
        className="mb-5"
        items={[
          { label: "Hours this week", value: num(total, 2).replace(/\.00$/, ""), sub: `of 40.0 expected`, chip: <Badge tone={sheet.status === "Approved" ? "pos" : sheet.status === "Submitted" ? "info" : "neutral"}>{sheet.status}</Badge> },
          { label: "Capitalizable", value: total ? `${Math.round((capital / total) * 100)}%` : "—", sub: `${num(capital, 1)} h on project accounts` },
          { label: "Projects charged", value: new Set(sheet.rows.filter((r) => r.projectId).map((r) => r.projectId)).size, sub: "Distinct project codes" },
          { label: "Remaining to 40 h", value: num(Math.max(0, 40 - total), 1), sub: total > 40 ? `${num(total - 40, 1)} h overtime` : "Before submission" },
        ]}
      />

      <Panel
        title="Weekly timesheet"
        info="Enter hours in quarter-hour steps. Project time must use a capitalizable cost account."
        flush
        actions={
          locked ? (
            sheet.status === "Submitted" && (
              <Button icon={<Undo2 className="size-3.5" aria-hidden />} onClick={() => update((s) => ({ ...s, status: "Draft" }))}>
                Recall
              </Button>
            )
          ) : (
            <>
              <Button
                variant="ghost"
                icon={<Copy className="size-3.5" aria-hidden />}
                disabled={!prevWeek?.rows.length}
                onClick={() => update((s) => ({ ...s, rows: (prevWeek?.rows ?? []).map((r, i) => ({ ...r, id: `c${Date.now()}${i}`, hours: [0, 0, 0, 0, 0, 0, 0] })) }))}
              >
                Copy last week’s rows
              </Button>
              <Button
                variant="primary"
                icon={<Send className="size-3.5" aria-hidden />}
                disabled={overDay || incomplete || total === 0}
                onClick={() => {
                  update((s) => ({ ...s, status: "Submitted" }));
                  toast(`Timesheet submitted — ${num(total, 1)} h to Adaeze Okafor for approval`);
                }}
              >
                Submit week
              </Button>
            </>
          )
        }
      >
        {/* Phones: one block per row, days in a 7-column strip under the project and account. */}
        <ul className="divide-y divide-line-soft border-t border-line-soft sm:hidden">
          {sheet.rows.map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <select aria-label="Project" className="field min-w-0 flex-1" disabled={locked} value={r.projectId ?? ""} onChange={(e) => setRowProject(r.id, e.target.value || null)}>
                  <option value="">Non-project time</option>
                  {PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                {!locked && (
                  <button type="button" aria-label="Remove row" onClick={() => removeRow(r.id)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-neg-tint hover:text-neg-ink">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <select aria-label="Cost account" className="field w-full" disabled={locked} value={r.account} onChange={(e) => setRowAccount(r.id, e.target.value)}>
                {accountsFor(r.projectId).map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-7 gap-1">
                {r.hours.map((h, i) => (
                  <label key={i} className="block text-center">
                    <span className={cx("block text-2xs font-semibold", i >= 5 ? "text-ink-3" : "text-ink-2")}>{DAYS[i]}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={24}
                      step={0.25}
                      disabled={locked}
                      value={h || ""}
                      placeholder="0"
                      onChange={(e) => setCell(r.id, i, e.target.value)}
                      className="field num mt-0.5 h-9 w-full px-1 text-center"
                    />
                  </label>
                ))}
              </div>
              <div className="text-right text-xs text-ink-2">
                Row total <span className="num font-bold text-ink">{num(r.hours.reduce((a, b) => a + b, 0), 2).replace(/\.00$/, "")} h</span>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 py-3">
            {!locked ? (
              <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" aria-hidden />} onClick={addRow}>
                Add row
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-ink-2">
              Week <span className="num font-bold text-ink">{num(total, 2).replace(/\.00$/, "")} h</span>
            </span>
          </li>
        </ul>

        <div className="scroll-x max-sm:hidden">
          <table className="dt min-w-[64rem]">
            <thead>
              <tr>
                <th className="min-w-[15rem]">Project</th>
                <th className="min-w-[13rem]">Cost account</th>
                {DAYS.map((d, i) => (
                  <th key={d} className={cx("r w-[4.5rem]", i >= 5 && "font-normal")}>
                    <span className="block">{d}</span>
                    <span className="num block font-normal">{label(dates[i]!)}</span>
                  </th>
                ))}
                <th className="r w-16">Total</th>
                <th className="w-10">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => {
                const rowTotal = r.hours.reduce((a, b) => a + b, 0);
                const pr = r.projectId ? projectById(r.projectId) : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <select
                        aria-label="Project"
                        className="field w-full"
                        disabled={locked}
                        value={r.projectId ?? ""}
                        onChange={(e) => {
                          const pid = e.target.value || null;
                          update((s) => ({ ...s, rows: s.rows.map((x) => (x.id === r.id ? { ...x, projectId: pid, account: accountsFor(pid)[0]!.code } : x)) }));
                        }}
                      >
                        <option value="">Non-project time</option>
                        {PROJECTS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} · {p.name}
                          </option>
                        ))}
                      </select>
                      {pr && <div className="mt-0.5 truncate text-2xs text-ink-3">{pr.phase}</div>}
                    </td>
                    <td>
                      <select
                        aria-label="Cost account"
                        className="field w-full"
                        disabled={locked}
                        value={r.account}
                        aria-invalid={!r.account}
                        onChange={(e) => update((s) => ({ ...s, rows: s.rows.map((x) => (x.id === r.id ? { ...x, account: e.target.value } : x)) }))}
                      >
                        {accountsFor(r.projectId).map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} · {a.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {r.hours.map((h, i) => (
                      <td key={i} className="r px-1.5">
                        <input
                          aria-label={`${DAYS[i]} hours`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={24}
                          step={0.25}
                          disabled={locked}
                          value={h || ""}
                          placeholder="0"
                          onChange={(e) => setCell(r.id, i, e.target.value)}
                          className={cx("field num h-8 w-full px-2 text-right", i >= 5 && "bg-surface-2", locked && "border-transparent bg-transparent")}
                        />
                      </td>
                    ))}
                    <td className="r font-bold text-ink">{num(rowTotal, 2).replace(/\.00$/, "")}</td>
                    <td>
                      {!locked && (
                        <button type="button" aria-label="Remove row" onClick={() => update((s) => ({ ...s, rows: s.rows.filter((x) => x.id !== r.id) }))} className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-neg-tint hover:text-neg-ink">
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!sheet.rows.length && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-ink-2">
                    {locked ? "No time was recorded this week." : "No rows yet. Add a project and cost account, or copy last week’s rows."}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  {!locked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus className="size-3.5" aria-hidden />}
                      onClick={() => update((s) => ({ ...s, rows: [...s.rows, { id: `r${Date.now()}`, projectId: PROJECTS[0]!.id, account: "1.14", hours: [0, 0, 0, 0, 0, 0, 0] }] }))}
                    >
                      Add row
                    </Button>
                  )}
                </td>
                {dayTotals.map((h, i) => (
                  <td key={i} className={cx("r num", h > 24 ? "text-neg-ink" : h > 10 ? "text-warn-ink" : "")}>
                    {num(h, 2).replace(/\.00$/, "")}
                  </td>
                ))}
                <td className="r num">{num(total, 2).replace(/\.00$/, "")}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {(overDay || dayTotals.some((h) => h > 10)) && (
          <p role="alert" className={cx("border-t border-line px-5 py-2.5 text-xs font-medium", overDay ? "text-neg-ink" : "text-warn-ink")}>
            {overDay ? "A day cannot exceed 24 hours. Correct the highlighted total to submit." : "More than 10 hours on a day. Confirm overtime was approved before submitting."}
          </p>
        )}
      </Panel>
    </>
  );
}
