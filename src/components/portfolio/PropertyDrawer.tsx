"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Mail, MapPin, Phone, TriangleAlert } from "lucide-react";
import { DrawerHeader } from "@/components/ui/overlay";
import { Switch, Tabs } from "@/components/ui/controls";
import { Avatar, Badge, Meter, Swatch } from "@/components/ui/data";
import { Fact } from "@/components/ui/Panel";
import { chain } from "@/lib/budget";
import { cx, daysBetween, fmtDate, money, num, pct, sf } from "@/lib/format";
import { activeCapexAt, leasedSf, projectsAt, walt } from "@/lib/selectors";
import { person, TODAY } from "@/mock/org";
import { assetColor, type Property } from "@/mock/properties";
import { SCHEDULE_STATUS } from "@/mock/projects";

type Tab = "overview" | "site" | "leases" | "building";

export function PropertyDrawerBody({
  p,
  onClose,
  showBoundary,
  setShowBoundary,
}: {
  p: Property;
  onClose: () => void;
  showBoundary: boolean;
  setShowBoundary: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const pm = person(p.managerId);
  const projects = projectsAt(p.id);
  const capex = activeCapexAt(p.id);
  const isLand = p.type === "Land";

  return (
    <>
      <DrawerHeader onClose={onClose}>
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-ink">{p.name}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
          <MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          {p.address}, {p.city}, {p.state} {p.zip}
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-ink-2">
          <Swatch color={assetColor(p.type)} shape="dot" />
          {p.type}
          <span className="text-ink-4">·</span>
          {p.ownership}
        </p>
      </DrawerHeader>

      <div className="px-5">
        <Tabs
          idBase="prop"
          label="Property sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "site", label: "Site" },
            { value: "leases", label: `Leases${p.leases.length ? ` · ${p.leases.length}` : ""}` },
            { value: "building", label: "Building" },
          ]}
        />
      </div>

      <div id="prop-panel" role="tabpanel" aria-labelledby={`prop-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === "overview" && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact label="Asset value" value={money(p.assetValue, { compact: true })} />
              <Fact label="Active CapEx" value={money(capex, { compact: true })} sub={`${projects.length} active project${projects.length === 1 ? "" : "s"}`} />
              <Fact label={isLand ? "Carrying cost (annual)" : "Net operating income"} value={money(p.noi, { compact: true })} />
              <Fact label={isLand ? "Land area" : "Occupancy"} value={isLand ? `${num(p.landAcres, 1)} ac` : pct(p.occupancy)} />
            </dl>

            {projects.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">Active projects</h3>
                <ul className="-mx-2 divide-y divide-line-soft">
                  {projects.map((pr) => {
                    const c = chain(pr.totals);
                    const st = SCHEDULE_STATUS[pr.status];
                    return (
                      <li key={pr.id}>
                        <Link href={`/projects/${pr.id}/`} className="group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent-ink">{pr.name}</span>
                            <span className="num block text-xs text-ink-3">
                              {pr.code} · {money(c.C, { compact: true })} approved
                            </span>
                          </span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Real Estate Property Manager</h3>
              <div className="flex items-start gap-3">
                <Avatar name={pm.name} tone={pm.tone} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="text-md font-semibold text-ink">{pm.name}</div>
                  <div className="text-xs text-ink-3">{pm.title}</div>
                  <div className="mt-2.5 flex flex-col gap-1.5 text-sm">
                    <a href={`mailto:${pm.email}`} className="inline-flex items-center gap-2 text-accent-ink hover:underline">
                      <Mail className="size-3.5" aria-hidden /> {pm.email}
                    </a>
                    <a href={`tel:${pm.phone.replace(/\D/g, "")}`} className="num inline-flex items-center gap-2 text-ink-2 hover:text-ink">
                      <Phone className="size-3.5 text-ink-3" aria-hidden /> {pm.phone}
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {p.notes && (
              <p className="rounded-md bg-warn-tint px-3.5 py-3 text-sm leading-relaxed text-warn-ink">
                <TriangleAlert className="mr-1.5 -mt-0.5 inline size-3.5" aria-hidden />
                {p.notes}
              </p>
            )}
          </div>
        )}

        {tab === "site" && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact label="Land area" value={`${num(p.landAcres, 1)} acres`} sub={`${num(p.landAcres * 43_560)} sf`} />
              <Fact label="Acquired" value={fmtDate(p.acquired)} sub={`${Math.floor(daysBetween(p.acquired, TODAY) / 365.25)} years held`} />
              <Fact label="Zoning" value={<span className="text-sm">{p.zoning}</span>} />
              <Fact label="Tax parcel" value={<span className="text-sm">{p.parcelId}</span>} />
              <Fact label="Tenure" value={p.ownership} />
              <Fact label="Floor area ratio" value={p.grossSf ? num(p.grossSf / (p.landAcres * 43_560), 2) : "—"} sub="Gross sf ÷ land sf" />
            </dl>
            <div className="border-t border-line-soft pt-4">
              <Switch checked={showBoundary} onChange={setShowBoundary} label="Show site boundary on map" />
              <p className="mt-2 text-xs leading-relaxed text-ink-3">Outline is approximated from recorded acreage. Connect Esri ArcGIS in Settings for surveyed parcel geometry.</p>
            </div>
          </div>
        )}

        {tab === "leases" && <LeaseTab p={p} />}

        {tab === "building" && (
          <div className="space-y-6">
            {isLand ? (
              <p className="text-sm text-ink-2">Undeveloped parcel. Building statistics appear once a structure is recorded.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Fact label="Gross area" value={sf(p.grossSf)} />
                  <Fact label="Rentable area" value={p.rentableSf ? sf(p.rentableSf) : "—"} sub={p.rentableSf ? `${pct(p.rentableSf / p.grossSf)} of gross` : "Owner-occupied"} />
                  <Fact label="Floors" value={p.floors} />
                  <Fact label="Year built" value={p.yearBuilt ?? "—"} sub={p.yearBuilt ? `${2026 - p.yearBuilt} years` : undefined} />
                  <Fact label="MEP vintage" value={p.mepVintage ?? "—"} sub={p.mepVintage ? `Major systems ${2026 - p.mepVintage} years old` : undefined} />
                  <Fact label="Area per floor" value={p.floors ? sf(Math.round(p.grossSf / p.floors)) : "—"} />
                </dl>
                {p.mepVintage && 2026 - p.mepVintage >= 20 && (
                  <p className="rounded-md bg-warn-tint px-3.5 py-3 text-sm leading-relaxed text-warn-ink">
                    <TriangleAlert className="mr-1.5 -mt-0.5 inline size-3.5" aria-hidden />
                    MEP systems are past the 20-year renewal horizon. Check the Planning pipeline for a renewal request.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-xs text-ink-3">Synthetic demo record</span>
        {projects[0] && (
          <Link href={`/cost/?project=${projects[0].id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
            Open cost summary <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </>
  );
}

function LeaseTab({ p }: { p: Property }) {
  const leased = leasedSf(p);
  const w = walt(p);
  const thirdParty = p.leases.filter((l) => l.annualRent > 0);
  const rent = thirdParty.reduce((a, l) => a + l.annualRent, 0);
  if (!p.leases.length) return <p className="text-sm text-ink-2">No leases recorded. This property is fully owner-occupied or undeveloped.</p>;
  const sorted = [...p.leases].sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 gap-x-5 gap-y-4">
        <Fact label="Occupancy" value={pct(p.occupancy)} />
        <Fact label="Leased (of rentable)" value={p.rentableSf && p.ownership !== "Leased" ? pct(leased / p.rentableSf) : "—"} />
        <Fact label="WALT" value={w ? `${num(w, 1)} yrs` : "—"} sub="By annual rent" />
      </dl>
      {p.rentableSf > 0 && p.ownership !== "Leased" && (
        <Meter
          label="Rentable area"
          max={p.rentableSf}
          segments={[
            { value: thirdParty.reduce((a, l) => a + l.sf, 0), color: "var(--brand)", label: "third-party leased" },
            { value: leased - thirdParty.reduce((a, l) => a + l.sf, 0), color: "var(--c-navy-500)", label: "internal" },
          ]}
        />
      )}
      <div className="scroll-x -mx-5 px-5">
        <table className="dt compact min-w-[26rem]">
          <thead>
            <tr>
              <th>Tenant</th>
              <th className="r">Area</th>
              <th>Expires</th>
              <th className="r">Annual rent</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => {
              const d = daysBetween(TODAY, l.expiry);
              return (
                <tr key={l.tenant + l.suite}>
                  <td>
                    <div className="font-semibold text-ink">{l.tenant}</div>
                    <div className="text-xs text-ink-3">
                      Suite {l.suite} · {l.structure}
                    </div>
                  </td>
                  <td className="r">{num(l.sf)}</td>
                  <td className="whitespace-nowrap">
                    <div className="num text-ink">{fmtDate(l.expiry, "month")}</div>
                    {d <= 365 && <div className={cx("text-xs font-semibold", d <= 180 ? "text-neg-ink" : "text-warn-ink")}>{d} days</div>}
                  </td>
                  <td className="r">{l.annualRent > 0 ? money(l.annualRent) : l.annualRent < 0 ? `(${money(-l.annualRent)}) paid` : "Internal"}</td>
                </tr>
              );
            })}
          </tbody>
          {rent > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Third-party rent roll</td>
                <td className="r num">{money(rent)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
