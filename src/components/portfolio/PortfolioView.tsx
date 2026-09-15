"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Drawer } from "@/components/ui/overlay";
import { IconButton } from "@/components/ui/controls";
import { Em, KpiStrip, Narrative, Swatch } from "@/components/ui/data";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { chain } from "@/lib/budget";
import { cx, fmtDate, money, num, pct } from "@/lib/format";
import { downloadCsv } from "@/lib/exporters";
import { activeCapexAt, portfolioKpis } from "@/lib/selectors";
import { ORG, TODAY } from "@/mock/org";
import { PROJECTS } from "@/mock/projects";
import { ASSET_TYPES, PROPERTIES, assetColor, propertyById, type AssetType } from "@/mock/properties";
import { PropertyDrawerBody } from "./PropertyDrawer";

const PropertyMap = dynamic(() => import("./PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[26rem] w-full animate-pulse rounded-md bg-sunk" />,
});

export function PortfolioView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("property");
  const [hidden, setHidden] = useState<Set<AssetType>>(new Set());
  const [ownership, setOwnership] = useState<"all" | "Owned" | "Leased" | "Ground lease">("all");
  const [q, setQ] = useState("");
  const [showBoundary, setShowBoundary] = useState(true);

  const filtered = useMemo(
    () =>
      PROPERTIES.filter((p) => !hidden.has(p.type))
        .filter((p) => ownership === "all" || p.ownership === ownership)
        .filter((p) => !q.trim() || `${p.name} ${p.city} ${p.type}`.toLowerCase().includes(q.trim().toLowerCase())),
    [hidden, ownership, q],
  );
  const onMap = useMemo(() => PROPERTIES.filter((p) => !hidden.has(p.type)).filter((p) => ownership === "all" || p.ownership === ownership), [hidden, ownership]);
  const k = portfolioKpis(onMap);
  const selected = PROPERTIES.find((p) => p.id === selectedId) ?? null;

  const select = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (id) sp.set("property", id);
      else sp.delete("property");
      router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const toggleType = (t: AssetType) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  // Exposure story: which properties carry projects that are late or over budget.
  const mapIds = new Set(onMap.map((p) => p.id));
  const live = PROJECTS.filter((p) => mapIds.has(p.propertyId));
  const offSchedule = live.filter((p) => p.status !== "on-schedule");
  const overruns = live.filter((p) => chain(p.totals).H < 0);
  const riskIds = useMemo(() => new Set(PROJECTS.filter((p) => p.status !== "on-schedule" || chain(p.totals).H < 0).map((p) => p.propertyId)), []);
  const riskNames = [...new Set(offSchedule.map((p) => propertyById(p.propertyId)!.name.replace("Harborline ", "")))];

  const buildings = onMap.filter((p) => p.grossSf > 0).length;
  const parcels = onMap.filter((p) => p.type === "Land").length;

  return (
    <>
      <PageHeader
        title="Portfolio"
        meta={`${PROPERTIES.length} properties across the ${ORG.region} region · as of ${fmtDate(TODAY)}`}
        actions={
          <>
            <label className="sr-only" htmlFor="own">
              Tenure
            </label>
            <select id="own" className="field" value={ownership} onChange={(e) => setOwnership(e.target.value as typeof ownership)}>
              <option value="all">All tenure</option>
              <option value="Owned">Owned</option>
              <option value="Ground lease">Ground lease</option>
              <option value="Leased">Leased (Owner is tenant)</option>
            </select>
            <IconButton
              label="Export property list (CSV)"
              variant="tint"
              onClick={() =>
                downloadCsv(
                  "portfolio.csv",
                  ["Property", "Type", "Tenure", "City", "Asset value", "Gross sf", "Rentable sf", "Occupancy", "Land acres", "Active CapEx"],
                  onMap.map((p) => [p.name, p.type, p.ownership, p.city, p.assetValue, p.grossSf, p.rentableSf, p.occupancy, p.landAcres, activeCapexAt(p.id)]),
                )
              }
            >
              <Download className="size-4" aria-hidden />
            </IconButton>
          </>
        }
      />

      <KpiStrip
        className="mb-5"
        items={[
          { label: "Total asset value", value: money(k.assetValue, { compact: true }), sub: `${k.count} properties`, accent: "var(--c-navy-500)" },
          { label: "Active square footage", value: `${num(k.activeSf / 1e6, 2)}M sf`, sub: `Gross, ${buildings} buildings`, accent: "var(--c-cobalt-500)" },
          { label: "Leased", value: pct(k.leasedPct, 1), sub: `of ${num(k.rentable)} rentable sf`, accent: "var(--c-teal-500)" },
          { label: "Total land acreage", value: `${num(k.acres, 1)} ac`, sub: `${parcels} parcels held for development`, accent: "var(--c-orange-400)" },
          { label: "Active CapEx", value: money(k.capex, { compact: true }), sub: `${k.capexProjects} projects · approved budget`, accent: "var(--c-sky-400)" },
        ]}
      />

      <Panel className="mb-5" bodyClassName="!py-4">
        <Narrative className="!max-w-none !text-md !leading-7">
          <Em>{live.length}</Em> active projects carry <Em>{money(k.capex, { compact: true })}</Em> of approved CapEx across <Em>{new Set(live.map((p) => p.propertyId)).size}</Em> properties.{" "}
          {offSchedule.length > 0 ? (
            <>
              <Em tone="neg">{offSchedule.length}</Em> {offSchedule.length === 1 ? "is" : "are"} off schedule — at {riskNames.join(", ")} — and <Em tone="neg">{overruns.length}</Em> forecast overruns totaling{" "}
              <Em tone="neg">{money(-overruns.reduce((a, p) => a + chain(p.totals).H, 0), { compact: true })}</Em>. Ringed pins mark them.
            </>
          ) : (
            <>Every project on these properties is on schedule.</>
          )}
        </Narrative>
      </Panel>

      <Panel
        title="Property map"
        info="Pins are colored by asset type. Select a pin or a row to open the property."
        flush
        actions={
          <div role="group" aria-label="Filter by asset type" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 inline-flex h-7 items-center gap-1.5 px-1 text-2xs font-semibold text-ink-2">
              <span aria-hidden className="size-2.5 rounded-full bg-surface ring-2 ring-coral" />
              Project at risk
            </span>
            {ASSET_TYPES.map((t) => {
              const on = !hidden.has(t.type);
              return (
                <button
                  key={t.type}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleType(t.type)}
                  className={cx(
                    "inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-2xs font-semibold transition-colors",
                    on ? "text-ink-2 hover:bg-sunk" : "text-ink-3 line-through decoration-ink-3 hover:bg-sunk",
                  )}
                >
                  <Swatch color={on ? t.color : "var(--line-strong)"} shape="dot" />
                  {t.short}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="grid h-[max(30rem,calc(100dvh-28rem))] grid-cols-1 gap-0 border-t border-line-soft md:grid-cols-[18.5rem_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-line-soft max-md:max-h-64 md:border-r">
            <div className="p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter properties" aria-label="Filter properties" className="field w-full pl-8" />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Properties">
              {filtered.map((p) => {
                const on = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => select(on ? null : p.id)}
                      className={cx("flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors", on ? "bg-accent-tint" : "hover:bg-surface-2")}
                    >
                      <Swatch color={assetColor(p.type)} shape="dot" className={cx("mt-1.5", riskIds.has(p.id) && "ring-2 ring-coral ring-offset-2 ring-offset-surface")} />
                      <span className="min-w-0 flex-1">
                        <span className={cx("block truncate text-sm font-semibold", on ? "text-accent-ink" : "text-ink")}>{p.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {p.city} · {ASSET_TYPES.find((t) => t.type === p.type)!.short}
                          {riskIds.has(p.id) && <span className="font-semibold text-neg-ink"> · project at risk</span>}
                        </span>
                      </span>
                      <span className="num pt-0.5 text-xs font-semibold text-ink-2">{money(p.assetValue, { compact: true })}</span>
                    </button>
                  </li>
                );
              })}
              {!filtered.length && <li className="px-3 py-6 text-center text-sm text-ink-3">No properties match these filters.</li>}
            </ul>
          </div>
          <div className="min-h-0 p-3">
            <PropertyMap properties={onMap} riskIds={riskIds} selectedId={selectedId} onSelect={(id) => select(id)} showBoundary={showBoundary} drawerOpen={!!selected} />
          </div>
        </div>
      </Panel>

      <Drawer open={!!selected} onClose={() => select(null)} label={selected ? `${selected.name} details` : "Property details"}>
        {selected && <PropertyDrawerBody key={selected.id} p={selected} onClose={() => select(null)} showBoundary={showBoundary} setShowBoundary={setShowBoundary} />}
      </Drawer>
    </>
  );
}
