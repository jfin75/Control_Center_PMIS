/** Derived views over mock data. Every figure the UI shows is computed here or in lib/budget. */

import { chain } from "./budget";
import { daysBetween } from "./format";
import { PROJECTS, type Project } from "@/mock/projects";
import { PROPERTIES, type Property } from "@/mock/properties";
import { TODAY } from "@/mock/org";

export function projectsAt(propertyId: string): Project[] {
  return PROJECTS.filter((p) => p.propertyId === propertyId);
}

export function activeCapexAt(propertyId: string): number {
  return projectsAt(propertyId).reduce((a, p) => a + chain(p.totals).C, 0);
}

/** Space leased to third parties and internal departments, as a share of rentable area. */
export function leasedSf(p: Property): number {
  if (p.ownership === "Leased") return 0;
  return p.leases.reduce((a, l) => a + l.sf, 0);
}

export function portfolioKpis(props: Property[] = PROPERTIES) {
  const assetValue = props.reduce((a, p) => a + p.assetValue, 0);
  const activeSf = props.reduce((a, p) => a + p.grossSf, 0);
  const rentable = props.filter((p) => p.ownership !== "Leased").reduce((a, p) => a + p.rentableSf, 0);
  const leased = props.reduce((a, p) => a + leasedSf(p), 0);
  const acres = props.reduce((a, p) => a + p.landAcres, 0);
  const ids = new Set(props.map((p) => p.id));
  const capex = PROJECTS.filter((p) => ids.has(p.propertyId)).reduce((a, p) => a + chain(p.totals).C, 0);
  const capexProjects = PROJECTS.filter((p) => ids.has(p.propertyId)).length;
  return { assetValue, activeSf, leasedPct: rentable ? leased / rentable : 0, rentable, acres, capex, capexProjects, count: props.length };
}

/** Weighted average lease term remaining, in years, by annual rent (falls back to area). */
export function walt(p: Property): number | null {
  const ls = p.leases.filter((l) => daysBetween(TODAY, l.expiry) > 0);
  if (!ls.length) return null;
  const w = ls.map((l) => (l.annualRent > 0 ? l.annualRent : l.sf));
  const tw = w.reduce((a, b) => a + b, 0);
  return ls.reduce((a, l, i) => a + (daysBetween(TODAY, l.expiry) / 365.25) * w[i]!, 0) / tw;
}

export interface LeaseExpiry {
  propertyId: string;
  propertyName: string;
  tenant: string;
  suite: string;
  sf: number;
  expiry: string;
  annualRent: number;
  daysOut: number;
}

export function upcomingExpiries(withinDays = 548): LeaseExpiry[] {
  return PROPERTIES.flatMap((p) =>
    p.leases
      .filter((l) => l.annualRent > 0)
      .map((l) => ({ propertyId: p.id, propertyName: p.name, tenant: l.tenant, suite: l.suite, sf: l.sf, expiry: l.expiry, annualRent: l.annualRent, daysOut: daysBetween(TODAY, l.expiry) })),
  )
    .filter((e) => e.daysOut >= 0 && e.daysOut <= withinDays)
    .sort((a, b) => a.daysOut - b.daysOut);
}

export function milestoneSlip(m: { baseline: string; forecast: string; actual?: string }): number {
  return daysBetween(m.baseline, m.actual ?? m.forecast);
}

export function finishSlip(p: Project): number {
  return daysBetween(p.baselineFinish, p.forecastFinish);
}
