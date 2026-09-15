"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Plus, Trash2 } from "lucide-react";
import { Badge, Chip, KpiStrip, Meter, type Tone } from "@/components/ui/data";
import { Button, Segmented, Tabs } from "@/components/ui/controls";
import { Drawer, DrawerHeader, toast } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { cx, fmtDate, money, num, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { UNIFORMAT } from "@/mock/costCodes";
import { CAPITAL_ENVELOPE, PIPELINE, STAGE_GATES, type PipelineItem, type ProgramSpace, type StageGate } from "@/mock/planning";
import { propertyById } from "@/mock/properties";

const DRIVER_TONE: Record<string, Tone> = {
  Regulatory: "warn",
  Safety: "neg",
  "Infrastructure renewal": "neutral",
  Growth: "accent",
  "Patient experience": "pos",
  Efficiency: "info",
};

/** Uniformat II → CSI MasterFormat divisions, for the alternate estimate view. */
const UNIFORMAT_TO_CSI: Record<string, string> = {
  A: "03 Concrete · 31 Earthwork",
  B: "04 Masonry · 05 Metals · 07 Thermal · 08 Openings",
  C: "06 Casework · 08 Openings · 09 Finishes · 10 Specialties",
  D: "14 Conveying · 21–28 MEP, fire, low voltage",
  E: "11 Equipment · 12 Furnishings",
  F: "02 Existing Conditions · 13 Special Construction",
  G: "31–33 Sitework & Utilities",
  Z: "01 General Requirements · fees · contingency",
};

type Overrides = Record<string, Partial<PipelineItem>>;

export function PlanningView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [overrides, setOverrides] = useStoredState<Overrides>("cc.planning.v1", {});
  const [sort, setSort] = useState<"priority" | "requested" | "age">("priority");
  const items = useMemo(() => PIPELINE.map((i) => ({ ...i, ...overrides[i.id] }) as PipelineItem), [overrides]);
  const openId = params.get("item");
  const open = items.find((i) => i.id === openId) ?? null;

  const setOpen = (id: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("item", id);
    else sp.delete("item");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const requested = items.reduce((a, i) => a + i.requested, 0);
  const roiItems = items.filter((i) => i.roi !== null);
  const roi = roiItems.reduce((a, i) => a + i.roi! * i.requested, 0) / Math.max(1, roiItems.reduce((a, i) => a + i.requested, 0));
  const unallocated = CAPITAL_ENVELOPE.envelope - CAPITAL_ENVELOPE.allocatedToApproved;

  const sorter = (a: PipelineItem, b: PipelineItem) => (sort === "priority" ? b.priority - a.priority : sort === "requested" ? b.requested - a.requested : b.daysInStage - a.daysInStage);

  return (
    <>
      <PageHeader
        title="Planning"
        meta={`${CAPITAL_ENVELOPE.fiscalYear} capital pipeline · requests not yet approved by the Board`}
        actions={
          <Segmented
            label="Sort cards by"
            value={sort}
            onChange={setSort}
            options={[
              { value: "priority", label: "Priority" },
              { value: "requested", label: "Cost" },
              { value: "age", label: "Age" },
            ]}
          />
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: `${CAPITAL_ENVELOPE.fiscalYear} proposed projects`, value: items.length, sub: STAGE_GATES.map((s) => `${items.filter((i) => i.stage === s.id).length} ${s.id.toLowerCase()}`).join(" · ") },
          { label: "Total requested capital", value: money(requested, { compact: true }), sub: `${pct(requested / unallocated, 0)} of unallocated funds` },
          { label: "Projected ROI", value: pct(roi, 1), sub: `Cost-weighted, ${roiItems.length} revenue-bearing requests` },
          {
            label: "Unallocated funds",
            value: money(unallocated, { compact: true }),
            sub: (
              <span className="block pt-1">
                <Meter
                  label="Capital envelope"
                  max={CAPITAL_ENVELOPE.envelope}
                  segments={[{ value: CAPITAL_ENVELOPE.allocatedToApproved, color: "var(--c-navy-500)", label: `${money(CAPITAL_ENVELOPE.allocatedToApproved, { compact: true })} allocated` }]}
                />
                <span className="mt-1 block">
                  of {money(CAPITAL_ENVELOPE.envelope, { compact: true })} envelope · <span className="font-semibold text-neg-ink">{num(requested / unallocated, 1)}× oversubscribed</span>
                </span>
              </span>
            ),
          },
        ]}
      />

      <div className="scroll-x -mx-4 px-4 pb-2 [--scroll-ground:var(--bg)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[64rem] grid-cols-4 gap-4">
          {STAGE_GATES.map((g) => {
            const col = items.filter((i) => i.stage === g.id).sort(sorter);
            const total = col.reduce((a, i) => a + i.requested, 0);
            return (
              <section key={g.id} aria-labelledby={`gate-${g.id}`} className="flex min-w-0 flex-col rounded-lg bg-sunk/70 p-2">
                <header className="px-2 pt-1.5 pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={`gate-${g.id}`} className="text-md font-semibold text-ink">
                      {g.id} <span className="num ml-1 text-sm font-semibold text-ink-3">{col.length}</span>
                    </h2>
                    <span className="num text-sm font-bold text-ink">{money(total, { compact: true })}</span>
                  </div>
                  <p className="text-xs text-ink-3">{g.estimateClass}</p>
                </header>
                <ul className="space-y-2">
                  {col.map((i) => (
                    <li key={i.id}>
                      <PipelineCard item={i} onOpen={() => setOpen(i.id)} active={i.id === openId} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} label="Project intake" modal width="w-[min(46rem,100vw)]">
        {open && (
          <IntakeDetail
            key={open.id}
            item={open}
            onClose={() => setOpen(null)}
            onSave={(patch) => {
              setOverrides((o) => ({ ...o, [open.id]: { ...o[open.id], ...patch } }));
              toast("Intake saved");
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function PipelineCard({ item, onOpen, active }: { item: PipelineItem; onOpen: () => void; active: boolean }) {
  const p = propertyById(item.propertyId)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active || undefined}
      className={cx(
        "group w-full rounded-md border bg-surface p-3.5 text-left shadow-panel transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-accent hover:shadow-raised",
        active ? "border-accent" : "border-transparent",
      )}
    >
      <h3 className="text-sm leading-snug font-semibold text-ink group-hover:text-accent-ink">{item.title}</h3>
      <p className="mt-0.5 truncate text-xs text-ink-3">
        {p.name} · {item.department}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge tone={DRIVER_TONE[item.driver]} dot={false}>{item.driver}</Badge>
        <span className="num text-2xs font-semibold text-ink-3">{item.daysInStage}d in stage</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-2xs text-ink-3">Requested</div>
          <div className="num text-md font-bold text-ink">{money(item.requested, { compact: true })}</div>
        </div>
        <div className="text-right">
          <div className="text-2xs text-ink-3">ROI</div>
          <div className="num text-sm font-bold text-ink">{item.roi === null ? <span className="text-ink-3">Mission</span> : pct(item.roi)}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-2xs text-ink-3">Priority</span>
        <div className="h-1.5 flex-1 rounded-full bg-sunk" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${item.priority}%` }} />
        </div>
        <span className="num text-2xs font-bold text-ink-2">
          <span className="sr-only">Priority score </span>
          {item.priority}
        </span>
      </div>
    </button>
  );
}

type DTab = "scope" | "schedule" | "estimate";

function IntakeDetail({ item, onClose, onSave }: { item: PipelineItem; onClose: () => void; onSave: (p: Partial<PipelineItem>) => void }) {
  const [tab, setTab] = useState<DTab>("scope");
  const [scope, setScope] = useState(item.scope);
  const [program, setProgram] = useState<ProgramSpace[]>(item.program);
  const [targets, setTargets] = useState(item.targets);
  const [rom, setRom] = useState<Record<string, number>>(() => Object.fromEntries(UNIFORMAT.map((u) => [u.id, item.rom[u.id] ?? 0])));
  const [lens, setLens] = useState<"uniformat" | "masterformat">("uniformat");
  const p = propertyById(item.propertyId)!;
  const romTotal = Object.values(rom).reduce((a, b) => a + b, 0);
  const programSf = program.reduce((a, s) => a + s.qty * s.sfEach, 0);
  const gateIdx = STAGE_GATES.findIndex((g) => g.id === item.stage);
  const next = STAGE_GATES[gateIdx + 1];
  const dirty = scope !== item.scope || JSON.stringify(program) !== JSON.stringify(item.program) || JSON.stringify(targets) !== JSON.stringify(item.targets) || UNIFORMAT.some((u) => (item.rom[u.id] ?? 0) !== rom[u.id]);

  const order: Array<[keyof PipelineItem["targets"], string]> = [
    ["board", "Board approval"],
    ["designStart", "Design start"],
    ["constructionStart", "Construction start"],
    ["occupancy", "Occupancy"],
  ];
  const dateErr = order.some(([k], i) => i > 0 && targets[k] < targets[order[i - 1]![0]]);

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">{item.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          {p.name} · {item.department} · Sponsor {item.sponsor}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-2">
          <Badge tone="accent">{item.stage}</Badge>
          <span>{STAGE_GATES[gateIdx]!.estimateClass}</span>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="text-xs text-ink-3">Requested</dt>
            <dd className="num font-bold text-ink">{money(item.requested)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">ROM estimate</dt>
            <dd className={cx("num font-bold", romTotal > item.requested ? "text-neg-ink" : "text-ink")}>{romTotal ? money(romTotal) : "Not started"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Priority</dt>
            <dd className="num font-bold text-ink">{item.priority} / 100</dd>
          </div>
        </dl>
      </DrawerHeader>

      <div className="px-5">
        <Tabs
          idBase="intake"
          label="Intake sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "scope", label: "Scope & program" },
            { value: "schedule", label: "Target milestones" },
            { value: "estimate", label: "ROM estimate" },
          ]}
        />
      </div>

      <div id="intake-panel" role="tabpanel" aria-labelledby={`intake-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === "scope" && (
          <div className="space-y-6">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Scope narrative</span>
              <textarea className="field mt-1.5 w-full" rows={6} value={scope} onChange={(e) => setScope(e.target.value)} />
              <span className="mt-1 block text-xs text-ink-3">{scope.trim().split(/\s+/).filter(Boolean).length} words. Say what changes, for whom, and what must stay operational.</span>
            </label>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Programmatic requirements</h3>
                <span className="num text-xs text-ink-2">{num(programSf)} sf programmed</span>
              </div>
              <div className="scroll-x">
                <table className="dt compact min-w-[34rem]">
                  <thead>
                    <tr>
                      <th>Space</th>
                      <th className="r">Qty</th>
                      <th className="r">sf each</th>
                      <th className="r">Total sf</th>
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {program.map((s, i) => (
                      <tr key={i}>
                        <td>
                          <input aria-label="Space name" className="field h-8 w-full" value={s.space} onChange={(e) => setProgram((ps) => ps.map((x, j) => (j === i ? { ...x, space: e.target.value } : x)))} />
                        </td>
                        <td className="r">
                          <input aria-label="Quantity" type="number" min={0} className="field num h-8 w-16 text-right" value={s.qty} onChange={(e) => setProgram((ps) => ps.map((x, j) => (j === i ? { ...x, qty: Math.max(0, Number(e.target.value)) } : x)))} />
                        </td>
                        <td className="r">
                          <input aria-label="Square feet each" type="number" min={0} className="field num h-8 w-20 text-right" value={s.sfEach} onChange={(e) => setProgram((ps) => ps.map((x, j) => (j === i ? { ...x, sfEach: Math.max(0, Number(e.target.value)) } : x)))} />
                        </td>
                        <td className="r font-semibold">{num(s.qty * s.sfEach)}</td>
                        <td className="w-10">
                          <button type="button" aria-label={`Remove ${s.space || "row"}`} onClick={() => setProgram((ps) => ps.filter((_, j) => j !== i))} className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-neg-tint hover:text-neg-ink">
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!program.length && (
                      <tr>
                        <td colSpan={5} className="py-5 text-center text-sm text-ink-2">
                          No spaces yet. Add the rooms and areas this project must deliver.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Button className="mt-2" size="sm" variant="ghost" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setProgram((ps) => [...ps, { space: "", qty: 1, sfEach: 100 }])}>
                Add space
              </Button>
            </section>
          </div>
        )}

        {tab === "schedule" && (
          <div className="space-y-5">
            <ol className="relative space-y-4 border-l-2 border-line pl-6">
              {order.map(([k, label], i) => {
                const bad = i > 0 && targets[k] < targets[order[i - 1]![0]];
                return (
                  <li key={k} className="relative">
                    <span aria-hidden className={cx("absolute top-2.5 -left-[1.95rem] size-3 rounded-full ring-4 ring-surface", bad ? "bg-neg" : "bg-accent")} />
                    <label className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-ink-3">{fmtDate(targets[k])}</span>
                      </span>
                      <span className="relative">
                        <CalendarDays className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                        <input type="date" className="field num pl-8" value={targets[k]} aria-invalid={bad} onChange={(e) => setTargets((t) => ({ ...t, [k]: e.target.value }))} />
                      </span>
                    </label>
                    {bad && <p className="mt-1 text-xs font-medium text-neg-ink">Must be on or after {order[i - 1]![1].toLowerCase()}.</p>}
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-ink-3">Target dates feed the capital plan’s cash flow once the request is approved and becomes a project.</p>
          </div>
        )}

        {tab === "estimate" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Estimate breakdown"
                value={lens}
                onChange={setLens}
                options={[
                  { value: "uniformat", label: "Uniformat II" },
                  { value: "masterformat", label: "MasterFormat" },
                ]}
              />
              <span className="text-xs text-ink-3">{STAGE_GATES[gateIdx]!.estimateClass}</span>
            </div>
            <div>
              <table className="dt compact">
                <thead>
                  <tr>
                    <th>{lens === "uniformat" ? "Uniformat II group" : "CSI MasterFormat divisions"}</th>
                    <th className="r">Amount</th>
                    <th className="r">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {UNIFORMAT.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="text-sm font-semibold text-ink">
                          <span className="num mr-2 text-accent-ink">{u.id}</span>
                          {u.name}
                        </div>
                        {lens === "masterformat" && <div className="text-xs text-ink-3">{UNIFORMAT_TO_CSI[u.id]}</div>}
                      </td>
                      <td className="r">
                        <input
                          aria-label={`${u.name} amount`}
                          type="number"
                          min={0}
                          step={10000}
                          className="field num h-8 w-32 text-right"
                          value={rom[u.id] ?? 0}
                          onChange={(e) => setRom((r) => ({ ...r, [u.id]: Math.max(0, Number(e.target.value)) }))}
                        />
                      </td>
                      <td className="r w-28">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 rounded-full bg-sunk" aria-hidden>
                            <div className="h-full rounded-full bg-brand" style={{ width: `${romTotal ? ((rom[u.id] ?? 0) / romTotal) * 100 : 0}%` }} />
                          </div>
                          <span className="num w-9 text-xs">{romTotal ? pct((rom[u.id] ?? 0) / romTotal) : "–"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>ROM total</td>
                    <td className="r num">{money(romTotal)}</td>
                    <td className="r">{romTotal > 0 && <Chip tone={romTotal > item.requested ? "neg" : "pos"}>{pct(romTotal / item.requested - 1, 0)} vs request</Chip>}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {programSf > 0 && romTotal > 0 && (
              <p className="text-sm text-ink-2">
                <span className="num font-bold text-ink">{money(romTotal / programSf)}</span> per programmed square foot.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-xs text-ink-3">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="flex gap-2">
          {next && (
            <Button
              icon={<ArrowRight className="size-3.5" aria-hidden />}
              onClick={() => {
                onSave({ stage: next.id as StageGate, daysInStage: 0 });
                toast(`Advanced to ${next.id}`);
              }}
            >
              Advance to {next.id}
            </Button>
          )}
          <Button variant="primary" disabled={!dirty || dateErr} onClick={() => onSave({ scope, program, targets, rom })}>
            Save intake
          </Button>
        </div>
      </div>
    </>
  );
}
