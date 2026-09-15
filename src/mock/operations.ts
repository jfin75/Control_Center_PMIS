/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  Capital equipment, commissioning, warranty and safety feeds for the Dashboard. */

export interface ProcurementItem {
  id: string;
  item: string;
  projectId: string;
  vendor: string;
  quotedWeeks: number;
  currentWeeks: number;
  needBy: string;
  eta: string;
  status: "Ordered" | "In fabrication" | "Shipped" | "Delivered" | "Not ordered";
}

export const PROCUREMENT: ProcurementItem[] = [
  { id: "eq-1", item: "Main switchgear lineup (4000A)", projectId: "tdc-ups", vendor: "Brightwater Electric", quotedWeeks: 38, currentWeeks: 55, needBy: "2026-08-03", eta: "2026-11-27", status: "In fabrication" },
  { id: "eq-2", item: "3T MRI system", projectId: "cmp-mri", vendor: "Orcaline Imaging Systems", quotedWeeks: 26, currentWeeks: 26, needBy: "2026-12-14", eta: "2026-12-11", status: "Ordered" },
  { id: "eq-3", item: "Linear accelerator", projectId: "scc-linac", vendor: "Orcaline Imaging Systems", quotedWeeks: 40, currentWeeks: 44, needBy: "2026-08-21", eta: "2026-09-18", status: "Shipped" },
  { id: "eq-4", item: "Heat-recovery chillers (3)", projectId: "nsrh-cup", vendor: "Out to tender", quotedWeeks: 44, currentWeeks: 48, needBy: "2027-10-01", eta: "2027-10-15", status: "Not ordered" },
  { id: "eq-5", item: "Hybrid OR imaging system", projectId: "hmc-l4", vendor: "Orcaline Imaging Systems", quotedWeeks: 30, currentWeeks: 30, needBy: "2026-06-01", eta: "2026-05-29", status: "Delivered" },
  { id: "eq-6", item: "Surgical lights & booms (8 ORs)", projectId: "hmc-l4", vendor: "Lumenfield Equipment Planning", quotedWeeks: 18, currentWeeks: 20, needBy: "2026-08-17", eta: "2026-08-24", status: "Delivered" },
  { id: "eq-7", item: "Emergency generator (2 MW)", projectId: "tdc-ups", vendor: "Brightwater Electric", quotedWeeks: 52, currentWeeks: 60, needBy: "2027-01-11", eta: "2027-02-08", status: "In fabrication" },
  { id: "eq-8", item: "Washer-disinfectors (6)", projectId: "kvsc-spd", vendor: "Not yet selected", quotedWeeks: 24, currentWeeks: 28, needBy: "2027-11-01", eta: "2027-11-01", status: "Not ordered" },
  { id: "eq-9", item: "ED headwalls (18)", projectId: "ehs-ed", vendor: "Harrow & Finch Contractors", quotedWeeks: 14, currentWeeks: 19, needBy: "2026-10-12", eta: "2026-11-09", status: "In fabrication" },
  { id: "eq-10", item: "Air handling units (2)", projectId: "lasc-or", vendor: "Alderline Construction", quotedWeeks: 22, currentWeeks: 22, needBy: "2026-07-06", eta: "2026-07-01", status: "Delivered" },
];

export type CxStage = "Not started" | "Pre-functional" | "Functional testing" | "Issues open" | "Accepted";
export const CX_STAGES: CxStage[] = ["Not started", "Pre-functional", "Functional testing", "Issues open", "Accepted"];

export interface CxSystem {
  projectId: string;
  system: string;
  stage: CxStage;
  openIssues: number;
}

export const COMMISSIONING: CxSystem[] = [
  { projectId: "hmc-l4", system: "OR air handling (AHU-4A/4B)", stage: "Functional testing", openIssues: 3 },
  { projectId: "hmc-l4", system: "Medical gas", stage: "Accepted", openIssues: 0 },
  { projectId: "hmc-l4", system: "Emergency power (life safety branch)", stage: "Functional testing", openIssues: 1 },
  { projectId: "hmc-l4", system: "Nurse call", stage: "Pre-functional", openIssues: 0 },
  { projectId: "hmc-l4", system: "OR integration", stage: "Pre-functional", openIssues: 2 },
  { projectId: "tdc-ups", system: "UPS module A", stage: "Accepted", openIssues: 0 },
  { projectId: "tdc-ups", system: "UPS module B", stage: "Not started", openIssues: 0 },
  { projectId: "tdc-ups", system: "Main switchgear", stage: "Not started", openIssues: 0 },
  { projectId: "scc-linac", system: "Vault HVAC", stage: "Issues open", openIssues: 4 },
  { projectId: "scc-linac", system: "Radiation safety interlocks", stage: "Pre-functional", openIssues: 0 },
  { projectId: "lasc-or", system: "AHU-5 & exhaust", stage: "Pre-functional", openIssues: 1 },
  { projectId: "lasc-or", system: "Medical gas", stage: "Not started", openIssues: 0 },
  { projectId: "rmob-bh", system: "HVAC & controls", stage: "Accepted", openIssues: 0 },
  { projectId: "rmob-bh", system: "Access control", stage: "Accepted", openIssues: 0 },
  { projectId: "ehs-ed", system: "Stage 1 HVAC", stage: "Accepted", openIssues: 0 },
  { projectId: "ehs-ed", system: "Stage 2 negative-pressure rooms", stage: "Not started", openIssues: 0 },
];

export interface Warranty {
  id: string;
  asset: string;
  propertyId: string;
  vendor: string;
  start: string;
  end: string;
}

export const WARRANTIES: Warranty[] = [
  { id: "w-1", asset: "Hybrid OR imaging system", propertyId: "hmc-tacoma", vendor: "Orcaline Imaging Systems", start: "2026-06-05", end: "2028-06-04" },
  { id: "w-2", asset: "UPS module A", propertyId: "tdc-tukwila", vendor: "Brightwater Electric", start: "2026-05-02", end: "2027-05-01" },
  { id: "w-3", asset: "Behavioral health anti-ligature hardware", propertyId: "rmob-redmond", vendor: "Summit Crest Interiors", start: "2026-06-30", end: "2027-06-29" },
  { id: "w-4", asset: "Roof membrane — Redmond MOB", propertyId: "rmob-redmond", vendor: "Harrow & Finch Contractors", start: "2016-10-01", end: "2026-09-30" },
  { id: "w-5", asset: "Chiller CH-2 — Gig Harbor", propertyId: "gh-mob", vendor: "Graystone Mechanical", start: "2022-05-15", end: "2027-05-14" },
  { id: "w-6", asset: "Elevator modernization — Olympia", propertyId: "cmp-olympia", vendor: "Alderline Construction", start: "2021-11-01", end: "2026-10-31" },
  { id: "w-7", asset: "Curtainwall — Silverdale", propertyId: "scc-silverdale", vendor: "Ravenna Glass & Curtainwall", start: "2017-06-01", end: "2027-05-31" },
  { id: "w-8", asset: "CT scanner — Eastside ED", propertyId: "ehs-bellevue", vendor: "Orcaline Imaging Systems", start: "2021-12-01", end: "2026-11-30" },
];

/** Program-wide monthly safety statistics (all active sites). TRIR per 200,000 hours. */
export const SAFETY_MONTHLY: Array<{ month: string; hours: number; recordables: number; nearMisses: number }> = [
  { month: "2025-10-01", hours: 41_200, recordables: 1, nearMisses: 5 },
  { month: "2025-11-01", hours: 43_900, recordables: 0, nearMisses: 4 },
  { month: "2025-12-01", hours: 38_100, recordables: 1, nearMisses: 3 },
  { month: "2026-01-01", hours: 44_600, recordables: 0, nearMisses: 6 },
  { month: "2026-02-01", hours: 46_800, recordables: 1, nearMisses: 4 },
  { month: "2026-03-01", hours: 51_300, recordables: 0, nearMisses: 7 },
  { month: "2026-04-01", hours: 53_900, recordables: 1, nearMisses: 5 },
  { month: "2026-05-01", hours: 55_400, recordables: 0, nearMisses: 6 },
  { month: "2026-06-01", hours: 58_200, recordables: 0, nearMisses: 4 },
  { month: "2026-07-01", hours: 60_700, recordables: 1, nearMisses: 8 },
  { month: "2026-08-01", hours: 61_900, recordables: 0, nearMisses: 5 },
];

export const SAFETY_TARGET_TRIR = 1.5;
