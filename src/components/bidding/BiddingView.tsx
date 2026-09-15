"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Award, CalendarClock, CircleAlert, ShieldCheck } from "lucide-react";
import { Badge, Chip, EmptyState, KpiStrip, type Tone } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { cx, daysBetween, fmtDate, money, num, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { BID_PACKAGES, PACKAGE_STATUSES, levelBid, type BidPackage, type PackageStatus } from "@/mock/bidding";
import { contractor, TODAY } from "@/mock/org";
import { projectById } from "@/mock/projects";

const STATUS_TONE: Record<PackageStatus, Tone> = {
  Drafting: "neutral",
  "Out to tender": "info",
  "Bids received": "accent",
  Leveling: "warn",
  "Award recommended": "warn",
  Awarded: "pos",
};

export function BiddingView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const firm = params.get("firm");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, PackageStatus>>({});
  const pkgs = useMemo(
    () =>
      BID_PACKAGES.map((b) => ({ ...b, status: statusOverrides[b.id] ?? b.status }))
        .filter((b) => filter === "all" || b.status !== "Awarded")
        .filter((b) => !firm || b.bids.some((x) => x.contractorId === firm)),
    [filter, firm, statusOverrides],
  );
  const selId = params.get("pkg") ?? pkgs.find((p) => p.bids.length > 1)?.id ?? pkgs[0]?.id;
  const sel = pkgs.find((p) => p.id === selId) ?? BID_PACKAGES.map((b) => ({ ...b, status: statusOverrides[b.id] ?? b.status })).find((p) => p.id === selId) ?? null;

  const select = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("pkg", id);
    router.replace(`${pathname}?${sp}`, { scroll: false });
    requestAnimationFrame(() => document.getElementById("leveling")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const out = BID_PACKAGES.filter((b) => b.status === "Out to tender");
  const due14 = BID_PACKAGES.filter((b) => b.due && daysBetween(TODAY, b.due) >= 0 && daysBetween(TODAY, b.due) <= 14);
  const awarded = BID_PACKAGES.filter((b) => b.status === "Awarded" || b.recommendation);
  const savings = awarded.reduce((a, b) => {
    const bid = b.bids.find((x) => x.contractorId === b.recommendation?.contractorId);
    return bid ? a + (b.estimate - levelBid(b, bid).leveled) : a;
  }, 0);

  return (
    <>
      <PageHeader
        title="Bidding"
        meta={firm ? `Packages bid by ${contractor(firm).name}` : "Owner procurement: RFPs, invitations to bid, and GMP packages"}
        actions={
          <>
            {firm && (
              <Button variant="ghost" onClick={() => router.replace(pathname)}>
                Clear contractor filter
              </Button>
            )}
            <Segmented
              label="Show packages"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "all", label: "All" },
              ]}
            />
          </>
        }
      />

      <KpiStrip
        className="mb-5"
        items={[
          { label: "Out to tender", value: out.length, sub: `${money(out.reduce((a, b) => a + b.estimate, 0), { compact: true })} estimated value` },
          { label: "Bids due in 14 days", value: due14.length, sub: due14.map((b) => b.number).join(", ") || "None" },
          { label: "In leveling or award", value: BID_PACKAGES.filter((b) => b.status === "Leveling" || b.status === "Award recommended" || b.status === "Bids received").length, sub: "Awaiting Owner decision" },
          { label: "Savings vs. estimate", value: <span className={savings >= 0 ? "text-pos-ink" : "text-neg-ink"}>{money(savings, { compact: true, signed: true })}</span>, sub: `${awarded.length} awarded or recommended` },
        ]}
      />

      <Panel title="Bid packages" flush>
        <div className="scroll-x">
          <table className="dt min-w-[70rem]">
            <thead>
              <tr>
                <th>Package</th>
                <th>Project</th>
                <th>Method</th>
                <th>Status</th>
                <th>Bids due</th>
                <th className="r">Bids / invited</th>
                <th className="r">Estimate</th>
                <th className="r">Low leveled</th>
                <th className="r">vs. estimate</th>
              </tr>
            </thead>
            <tbody>
              {pkgs.map((b) => {
                const leveled = b.bids.map((x) => levelBid(b, x).leveled);
                const low = leveled.length ? Math.min(...leveled) : null;
                const days = b.due ? daysBetween(TODAY, b.due) : null;
                return (
                  <tr key={b.id} className="row-link cursor-pointer" data-selected={b.id === sel?.id}
                    aria-current={b.id === sel?.id || undefined} onClick={() => select(b.id)}>
                    <td>
                      <button type="button" onClick={(e) => { e.stopPropagation(); select(b.id); }} className="text-left">
                        <span className="block font-semibold text-ink">{b.name}</span>
                        <span className="num block text-xs font-semibold text-accent-ink">{b.number}</span>
                      </button>
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{projectById(b.projectId)!.code}</td>
                    <td className="whitespace-nowrap text-ink-2">{b.method}</td>
                    <td>
                      <StatusTrack status={b.status} />
                    </td>
                    <td className="whitespace-nowrap">
                      {b.due ? (
                        <>
                          <div className="num text-ink">{fmtDate(b.due, "short")}</div>
                          <div className={cx("num text-xs", days !== null && days >= 0 && days <= 7 ? "font-semibold text-warn-ink" : "text-ink-3")}>
                            {days !== null && days >= 0 ? `in ${days} days` : "Closed"}
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-3">Not issued</span>
                      )}
                    </td>
                    <td className="r">
                      {b.bids.length} / {b.invited}
                    </td>
                    <td className="r">{money(b.estimate, { compact: true })}</td>
                    <td className="r font-semibold text-ink">{low !== null ? money(low, { compact: true }) : "–"}</td>
                    <td className={cx("r font-semibold", low === null ? "text-ink-4" : low <= b.estimate ? "text-pos-ink" : "text-neg-ink")}>{low !== null ? pct(low / b.estimate - 1, 1) : "–"}</td>
                  </tr>
                );
              })}
              {!pkgs.length && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-ink-2">
                    No packages match. Switch to “All” to include awarded packages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div id="leveling" className="scroll-mt-4">
        {sel && <Leveling pkg={sel} onRoute={() => { setStatusOverrides((s) => ({ ...s, [sel.id]: "Award recommended" })); toast(`${sel.number} routed to Owner Executive for award approval`); }} />}
      </div>
    </>
  );
}

function StatusTrack({ status }: { status: PackageStatus }) {
  const i = PACKAGE_STATUSES.indexOf(status);
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden>
        {PACKAGE_STATUSES.map((s, j) => (
          <span key={s} className={cx("h-1.5 w-2.5 rounded-full", j <= i ? (status === "Awarded" ? "bg-pos" : "bg-brand") : "bg-line")} />
        ))}
      </span>
      <Badge tone={STATUS_TONE[status]} dot={false}>
        {status}
      </Badge>
    </div>
  );
}

function Leveling({ pkg, onRoute }: { pkg: BidPackage; onRoute: () => void }) {
  const p = projectById(pkg.projectId)!;
  if (!pkg.bids.length) {
    return (
      <Panel className="mt-5" title={`${pkg.number} · ${pkg.name}`}>
        <EmptyState icon={<CalendarClock className="size-5" aria-hidden />} title={pkg.due ? `Bids due ${fmtDate(pkg.due)}` : "Package not yet issued"}>
          {pkg.due ? (
            <>
              {pkg.invited} contractors invited{pkg.prebid && `, pre-bid meeting ${fmtDate(pkg.prebid)}`}. The leveling sheet fills in as proposals arrive. Engineer’s estimate {money(pkg.estimate)}.
            </>
          ) : (
            <>Finish the scope sheet and invite list to issue this package. Engineer’s estimate {money(pkg.estimate)}.</>
          )}
        </EmptyState>
      </Panel>
    );
  }

  const rows = pkg.bids.map((b) => ({ b, c: contractor(b.contractorId), lv: levelBid(pkg, b) }));
  const low = Math.min(...rows.map((r) => r.lv.leveled));
  const lowBase = Math.min(...rows.map((r) => r.b.base));
  const rec = pkg.recommendation ? rows.find((r) => r.b.contractorId === pkg.recommendation!.contractorId) : [...rows].filter((r) => r.c.prequalified).sort((a, b) => a.lv.leveled - b.lv.leveled)[0];

  const exportCsv = () =>
    downloadCsv(
      `${pkg.number}-leveling.csv`,
      ["Line", ...rows.map((r) => r.c.name)],
      [
        ["Base bid", ...rows.map((r) => r.b.base)],
        ...pkg.scope.map((s) => [s.label, ...rows.map((r) => (r.b.items[s.id] === "excl" ? `Excluded — plug ${pkg.plugs[s.id]}` : r.b.items[s.id] === "incl" ? "Included" : String(r.b.items[s.id])))]),
        ["Alternates", ...rows.map((r) => r.b.alternates)],
        ["Leveled total", ...rows.map((r) => r.lv.leveled)],
        ["Schedule (days)", ...rows.map((r) => r.b.scheduleDays)],
        ["EMR", ...rows.map((r) => r.c.emr)],
      ],
    );

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel
        title={`Bid leveling · ${pkg.number}`}
        info="Excluded scope is plugged at the Owner’s value so every bid is compared on complete scope."
        flush
        actions={
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            Export sheet
          </Button>
        }
      >
        <p className="px-5 pb-3 text-sm text-ink-2">
          {pkg.name} · {p.name} · {pkg.method} · Engineer’s estimate <span className="num font-semibold text-ink">{money(pkg.estimate)}</span>
        </p>
        <div className="scroll-x">
          <table className="dt min-w-[48rem]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[2] min-w-[14rem] bg-surface">Line</th>
                {rows.map((r) => (
                  <th key={r.c.id} className={cx("r min-w-[9.5rem]", r === rec && "bg-pos-tint")}>
                    <span className="block text-sm font-semibold text-ink">{r.c.name}</span>
                    <span className="block font-normal">{r === rec ? "Recommended" : r.c.prequalified ? "Prequalified" : "Not prequalified"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 z-[1] bg-surface font-semibold text-ink">Base bid</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("r", r === rec && "bg-pos-tint/50")}>
                    {money(r.b.base)}
                    {r.b.base === lowBase && <span className="block text-2xs font-semibold text-ink-3">low base</span>}
                  </td>
                ))}
              </tr>
              {pkg.scope.map((s) => (
                <tr key={s.id}>
                  <td className="sticky left-0 z-[1] bg-surface text-ink-2">{s.label}</td>
                  {rows.map((r) => {
                    const v = r.b.items[s.id];
                    return (
                      <td key={r.c.id} className={cx("r", r === rec && "bg-pos-tint/50")}>
                        {v === "excl" ? (
                          <span className="inline-flex flex-col items-end">
                            <Chip tone="warn">Excluded</Chip>
                            <span className="num mt-0.5 text-xs text-warn-ink">+{money(pkg.plugs[s.id] ?? 0)} plug</span>
                          </span>
                        ) : v === "incl" ? (
                          <span className="text-ink-3">Included</span>
                        ) : (
                          money(v ?? 0)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-[1] bg-surface text-ink-2">Alternates accepted</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("r text-ink-2", r === rec && "bg-pos-tint/50")}>
                    {r.b.alternates ? money(r.b.alternates) : "–"}
                  </td>
                ))}
              </tr>
              <tr className="[&>td]:border-t [&>td]:border-line-strong">
                <td className="sticky left-0 z-[1] bg-surface font-bold text-ink">Leveled total</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("r", r === rec && "bg-pos-tint/50")}>
                    <span className={cx("num text-md font-bold", r.lv.leveled === low ? "text-pos-ink" : "text-ink")}>{money(r.lv.leveled)}</span>
                    <span className={cx("num block text-xs", r.lv.leveled <= pkg.estimate ? "text-pos-ink" : "text-neg-ink")}>{pct(r.lv.leveled / pkg.estimate - 1, 1)} vs est.</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] bg-surface text-ink-2">Schedule</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("r", r === rec && "bg-pos-tint/50")}>
                    {r.b.scheduleDays} days
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] bg-surface text-ink-2">Safety (EMR)</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("r", r.c.emr > 0.9 && "font-semibold text-warn-ink", r === rec && "bg-pos-tint/50")}>
                    {num(r.c.emr, 2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] bg-surface align-top text-ink-2">Qualifications</td>
                {rows.map((r) => (
                  <td key={r.c.id} className={cx("align-top text-xs text-ink-2", r === rec && "bg-pos-tint/50")}>
                    {r.b.qualifications.length ? (
                      <ul className="space-y-1">
                        {r.b.qualifications.map((q) => (
                          <li key={q} className="flex gap-1.5">
                            <CircleAlert className="mt-0.5 size-3 shrink-0 text-warn-ink" aria-hidden />
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-ink-3">None</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Award recommendation">
        {rec ? (
          <div>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pos-tint text-pos-ink">
                <Award className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-md font-semibold text-ink">{rec.c.name}</div>
                <div className="num text-sm text-ink-2">
                  {money(rec.lv.leveled)} leveled · {pct(rec.lv.leveled / pkg.estimate - 1, 1)} vs. estimate
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              {pkg.recommendation?.rationale ?? "Lowest leveled total from a prequalified bidder. Review qualifications before routing for approval."}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-ink-2">
                <ShieldCheck className="size-4 text-pos-ink" aria-hidden /> {rec.c.prequalified ? "Prequalified" : "Not prequalified — requires review"}
              </li>
              <li className="flex items-center gap-2 text-ink-2">
                <ShieldCheck className="size-4 text-pos-ink" aria-hidden /> EMR {num(rec.c.emr, 2)}, bond {pct(rec.b.bondRate, 2)}
              </li>
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              {pkg.status === "Awarded" ? (
                <Badge tone="pos">Awarded</Badge>
              ) : pkg.status === "Award recommended" ? (
                <Badge tone="warn">Awaiting Owner Executive approval</Badge>
              ) : (
                <Button variant="primary" className="w-full" onClick={onRoute}>
                  Route for award approval
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">No prequalified bidder yet. Prequalify a bidder or re-tender.</p>
        )}
      </Panel>
    </div>
  );
}
