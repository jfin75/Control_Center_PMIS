/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  Projects 1–3 reuse the dollar rows of Private/Budget Fortmat/Budget Summary
 *  Report.csv so the Cost Summary can be checked against the Owner's report. */

import type { ChainInputs } from "@/lib/budget";
import type { ChangeClassifier } from "./costCodes";

export type Phase = "Preconstruction" | "Design" | "Procurement" | "Construction" | "Closeout";
export type ScheduleStatus = "on-schedule" | "at-risk" | "delayed";

export const SCHEDULE_STATUS: Record<ScheduleStatus, { label: string; tone: "pos" | "warn" | "neg" }> = {
  "on-schedule": { label: "On schedule", tone: "pos" },
  "at-risk": { label: "Critical path risk", tone: "warn" },
  delayed: { label: "Delayed", tone: "neg" },
};

export type Archetype = "fitout" | "equipment" | "infrastructure" | "office";

export interface Milestone {
  name: string;
  baseline: string;
  forecast: string;
  actual?: string;
}

export interface Risk {
  id: string;
  title: string;
  category: "Schedule" | "Cost" | "Scope" | "Safety" | "Regulatory" | "Operational";
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  ownerId: string;
  mitigation: string;
  status: "Open" | "Mitigating" | "Watching" | "Closed";
  costExposure: number;
  scheduleDays: number;
}

export interface TeamMember {
  kind: "staff" | "firm";
  refId: string;
  role: string;
}

export interface BudgetAdjustment {
  code: string;
  description: string;
  classifier?: ChangeClassifier;
  amount: number;
  csi?: string;
  approved: string;
}

export interface PendingChange {
  number: string;
  title: string;
  classifier: ChangeClassifier;
  code: string;
  amount: number;
  status: "Pending review" | "Priced" | "In negotiation";
  submitted: string;
  funding: "Design contingency" | "Contractor contingency" | "Owner's reserve" | "Budget increase";
}

export interface Project {
  id: string;
  code: string;
  name: string;
  propertyId: string;
  phase: Phase;
  status: ScheduleStatus;
  pmId: string;
  sponsorId: string;
  controllerId: string;
  archetype: Archetype;
  start: string;
  baselineFinish: string;
  forecastFinish: string;
  physicalComplete: number;
  spi: number;
  funding: string;
  summary: string;
  /** Finance-level totals; line items are allocated to hit these exactly. */
  totals: ChainInputs;
  adjustments: BudgetAdjustment[];
  pending: PendingChange[];
  gcId: string;
  milestones: Milestone[];
  risks: Risk[];
  team: TeamMember[];
  safety: { hoursWorked: number; recordables: number; nearMisses: number; daysSinceIncident: number };
}

export const PROJECTS: Project[] = [
  {
    id: "ehs-ed",
    code: "CP-24017",
    name: "Eastside Emergency Department Expansion",
    propertyId: "ehs-bellevue",
    phase: "Construction",
    status: "at-risk",
    pmId: "u-reyes",
    sponsorId: "u-okafor",
    controllerId: "u-sato",
    archetype: "fitout",
    start: "2025-06-02",
    baselineFinish: "2027-06-30",
    forecastFinish: "2027-08-27",
    physicalComplete: 0.21,
    spi: 0.88,
    funding: "Board-approved capital, FY25",
    summary:
      "Adds 18 treatment bays, a 6-bay rapid-triage zone, and a behavioral health safe room suite to the Eastside ED while it stays open. Phased in four stages to hold 100% of existing bay count during work.",
    totals: { A: 15_000_000, B: 800_000, D: 11_575_000, F: 5_000_000, I: 1_200_000 },
    adjustments: [
      { code: "3.03", description: "CO #1 – Triage bay reconfiguration", classifier: "OC", amount: 420_000, csi: "09", approved: "2026-02-11" },
      { code: "3.03", description: "CO #2 – Unforeseen duct bank relocation", classifier: "LC", amount: 365_000, csi: "26", approved: "2026-04-22" },
      { code: "3.03", description: "CO #3 – Missing seismic bracing details", classifier: "AEO", amount: 95_000, csi: "05", approved: "2026-07-08" },
      { code: "3.04", description: "Transfer to CO #3", amount: -80_000, approved: "2026-07-08" },
    ],
    pending: [
      { number: "PCO-018", title: "Negative-pressure conversion, bays 12–14", classifier: "OC", code: "3.03", amount: 212_000, status: "Priced", submitted: "2026-08-19", funding: "Owner's reserve" },
      { number: "PCO-021", title: "Asbestos in Stage 2 plaster soffits", classifier: "LC", code: "3.03", amount: 138_500, status: "Pending review", submitted: "2026-09-02", funding: "Contractor contingency" },
      { number: "PCO-022", title: "Nurse call head-end upgrade", classifier: "EEO", code: "3.03", amount: 64_000, status: "In negotiation", submitted: "2026-09-08", funding: "Design contingency" },
    ],
    gcId: "c-harrow",
    milestones: [
      { name: "Construction documents complete", baseline: "2025-03-14", forecast: "2025-03-28", actual: "2025-03-28" },
      { name: "Permit issued", baseline: "2025-05-16", forecast: "2025-05-30", actual: "2025-05-30" },
      { name: "Stage 1 turnover (triage)", baseline: "2026-03-31", forecast: "2026-05-15", actual: "2026-05-15" },
      { name: "Stage 2 turnover (bays 1–9)", baseline: "2026-09-30", forecast: "2026-11-20" },
      { name: "Stage 3 turnover (bays 10–18)", baseline: "2027-02-26", forecast: "2027-04-23" },
      { name: "Substantial completion", baseline: "2027-05-28", forecast: "2027-07-23" },
      { name: "Final completion & occupancy", baseline: "2027-06-30", forecast: "2027-08-27" },
    ],
    risks: [
      { id: "R-01", title: "Stage 2 turnover slips into respiratory season surge", category: "Schedule", probability: 4, impact: 5, ownerId: "u-reyes", mitigation: "Resequence bays 1–4 ahead of 5–9; pre-order long-lead headwalls.", status: "Mitigating", costExposure: 310_000, scheduleDays: 42 },
      { id: "R-02", title: "Hazardous materials beyond survey in Stage 2 ceilings", category: "Cost", probability: 4, impact: 3, ownerId: "u-mensah", mitigation: "Supplemental destructive survey scheduled 2026-09-22.", status: "Open", costExposure: 180_000, scheduleDays: 10 },
      { id: "R-03", title: "ICRA barrier breach during night shift work", category: "Safety", probability: 2, impact: 5, ownerId: "u-whitehorse", mitigation: "Daily ICRA walk with Infection Prevention; negative air monitoring alarms.", status: "Watching", costExposure: 0, scheduleDays: 0 },
      { id: "R-04", title: "Nurse call vendor end-of-life on existing head-end", category: "Scope", probability: 3, impact: 3, ownerId: "u-reyes", mitigation: "PCO-022 in negotiation; confirm DTS standard.", status: "Open", costExposure: 64_000, scheduleDays: 14 },
      { id: "R-05", title: "DOH plan review comments on safe room anchoring", category: "Regulatory", probability: 2, impact: 3, ownerId: "u-reyes", mitigation: "AOR pre-submittal meeting held; response package ready.", status: "Watching", costExposure: 25_000, scheduleDays: 7 },
    ],
    team: [
      { kind: "staff", refId: "u-okafor", role: "Executive sponsor" },
      { kind: "staff", refId: "u-reyes", role: "Project manager" },
      { kind: "staff", refId: "u-sato", role: "Cost controller" },
      { kind: "staff", refId: "u-whitehorse", role: "Field inspector" },
      { kind: "firm", refId: "c-harrow", role: "General contractor" },
      { kind: "firm", refId: "c-tessellate", role: "Architect of record" },
      { kind: "firm", refId: "c-keelson", role: "MEP engineer" },
      { kind: "firm", refId: "c-cedarmark", role: "Commissioning authority" },
    ],
    safety: { hoursWorked: 96_400, recordables: 2, nearMisses: 9, daysSinceIncident: 47 },
  },
  {
    id: "cmp-mri",
    code: "CP-25006",
    name: "Capitol Pavilion MRI Replacement",
    propertyId: "cmp-olympia",
    phase: "Procurement",
    status: "on-schedule",
    pmId: "u-mensah",
    sponsorId: "u-lindqvist",
    controllerId: "u-bauer",
    archetype: "equipment",
    start: "2026-03-02",
    baselineFinish: "2027-02-26",
    forecastFinish: "2027-02-19",
    physicalComplete: 0.18,
    spi: 1.02,
    funding: "Routine capital, FY26",
    summary:
      "Replaces the 2008 1.5T MRI with a 3T unit in the same suite: RF shielding rework, quench pipe reroute, chiller replacement, and a four-week imaging diversion plan.",
    totals: { A: 850_320, B: 0, D: 250_000, F: 500_000, I: 200_000 },
    adjustments: [],
    pending: [{ number: "PCO-002", title: "Magnet delivery path — curtainwall panel removal", classifier: "MISC", code: "3.03", amount: 28_500, status: "Priced", submitted: "2026-08-28", funding: "Contractor contingency" }],
    gcId: "c-alderline",
    milestones: [
      { name: "Vendor selection & PO", baseline: "2026-05-29", forecast: "2026-05-22", actual: "2026-05-22" },
      { name: "Site readiness drawings", baseline: "2026-08-14", forecast: "2026-08-14", actual: "2026-08-12" },
      { name: "Imaging diversion starts", baseline: "2026-12-07", forecast: "2026-12-07" },
      { name: "Magnet rigging & set", baseline: "2026-12-21", forecast: "2026-12-18" },
      { name: "ACR accreditation scans", baseline: "2027-02-12", forecast: "2027-02-05" },
      { name: "First patient", baseline: "2027-02-26", forecast: "2027-02-19" },
    ],
    risks: [
      { id: "R-01", title: "Crane permit for magnet rigging over parking lot", category: "Regulatory", probability: 2, impact: 3, ownerId: "u-mensah", mitigation: "Permit application submitted with traffic control plan.", status: "Watching", costExposure: 12_000, scheduleDays: 5 },
      { id: "R-02", title: "Chiller lead time exceeds 16 weeks", category: "Schedule", probability: 3, impact: 3, ownerId: "u-mensah", mitigation: "Rental chiller quote on hold as fallback.", status: "Open", costExposure: 18_000, scheduleDays: 12 },
    ],
    team: [
      { kind: "staff", refId: "u-lindqvist", role: "Executive sponsor" },
      { kind: "staff", refId: "u-mensah", role: "Owner's representative" },
      { kind: "staff", refId: "u-bauer", role: "Cost analyst" },
      { kind: "firm", refId: "c-alderline", role: "General contractor" },
      { kind: "firm", refId: "c-orca", role: "Imaging vendor" },
      { kind: "firm", refId: "c-meridian-eq", role: "Equipment planner" },
    ],
    safety: { hoursWorked: 3_100, recordables: 0, nearMisses: 1, daysSinceIncident: 198 },
  },
  {
    id: "hmc-l4",
    code: "CP-23041",
    name: "Surgical Tower Level 4 Fit-out",
    propertyId: "hmc-tacoma",
    phase: "Construction",
    status: "on-schedule",
    pmId: "u-novak",
    sponsorId: "u-okafor",
    controllerId: "u-sato",
    archetype: "fitout",
    start: "2024-09-03",
    baselineFinish: "2026-12-18",
    forecastFinish: "2026-12-11",
    physicalComplete: 0.63,
    spi: 1.03,
    funding: "Board-approved capital, FY24; philanthropy match",
    summary:
      "Builds out shelled Level 4 of the Surgical Tower: 8 ORs including 2 hybrid ORs, 24 pre/post bays, sterile core, and a dedicated clean elevator tie-in.",
    totals: { A: 28_000_250, B: 20_000, D: 25_000_000, F: 257_000, I: 12_500_000 },
    adjustments: [
      { code: "3.03", description: "CO #1 – Hybrid OR imaging boom supports", classifier: "OC", amount: 48_000, csi: "05", approved: "2025-06-18" },
      { code: "3.03", description: "CO #2 – Med gas zone valve relocation", classifier: "EEO", amount: 22_000, csi: "22", approved: "2025-11-04" },
      { code: "3.04", description: "Transfer to CO #1–2", amount: -50_000, approved: "2025-11-04" },
    ],
    pending: [
      { number: "PCO-031", title: "Add OR 7 integration pre-wire", classifier: "OC", code: "3.03", amount: 41_000, status: "Priced", submitted: "2026-08-30", funding: "Owner's reserve" },
    ],
    gcId: "c-northbeam",
    milestones: [
      { name: "GMP executed", baseline: "2024-08-16", forecast: "2024-08-16", actual: "2024-08-16" },
      { name: "Overhead MEP rough-in complete", baseline: "2025-09-26", forecast: "2025-09-19", actual: "2025-09-19" },
      { name: "Hybrid OR equipment set", baseline: "2026-06-12", forecast: "2026-06-05", actual: "2026-06-05" },
      { name: "Air balance & pressurization", baseline: "2026-10-09", forecast: "2026-10-02" },
      { name: "DOH survey", baseline: "2026-11-20", forecast: "2026-11-13" },
      { name: "First case", baseline: "2026-12-18", forecast: "2026-12-11" },
    ],
    risks: [
      { id: "R-01", title: "OR air change rates fail first TAB pass", category: "Schedule", probability: 2, impact: 4, ownerId: "u-novak", mitigation: "Cx pre-functional checks at 90% rough-in; TAB contractor on site early.", status: "Mitigating", costExposure: 40_000, scheduleDays: 10 },
      { id: "R-02", title: "Clean elevator tie-in outage window", category: "Operational", probability: 2, impact: 3, ownerId: "u-novak", mitigation: "Weekend outage approved by Perioperative Services.", status: "Closed", costExposure: 0, scheduleDays: 0 },
    ],
    team: [
      { kind: "staff", refId: "u-okafor", role: "Executive sponsor" },
      { kind: "staff", refId: "u-novak", role: "Project manager" },
      { kind: "staff", refId: "u-sato", role: "Cost controller" },
      { kind: "staff", refId: "u-castillo", role: "Field engineer" },
      { kind: "firm", refId: "c-northbeam", role: "General contractor (CM/GC)" },
      { kind: "firm", refId: "c-tessellate", role: "Architect of record" },
      { kind: "firm", refId: "c-keelson", role: "MEP engineer" },
      { kind: "firm", refId: "c-cedarmark", role: "Commissioning authority" },
    ],
    safety: { hoursWorked: 214_800, recordables: 1, nearMisses: 14, daysSinceIncident: 162 },
  },
  {
    id: "nsrh-cup",
    code: "CP-25012",
    name: "North Sound Central Utility Plant Renewal",
    propertyId: "nsrh-everett",
    phase: "Design",
    status: "on-schedule",
    pmId: "u-tran",
    sponsorId: "u-lindqvist",
    controllerId: "u-bauer",
    archetype: "infrastructure",
    start: "2025-10-01",
    baselineFinish: "2028-09-29",
    forecastFinish: "2028-09-29",
    physicalComplete: 0.07,
    spi: 0.99,
    funding: "Revenue bond series 2025B",
    summary:
      "Replaces 1986 chillers, boilers, and cooling towers with a heat-recovery chiller plant and electrode boilers, cutting campus Scope 1 emissions by an estimated 60%.",
    totals: { A: 42_500_000, B: 0, D: 4_180_000, F: 38_900_000, I: 2_260_000 },
    adjustments: [],
    pending: [{ number: "PCO-003", title: "Additional utility tunnel structural survey", classifier: "LC", code: "1.19", amount: 46_000, status: "Pending review", submitted: "2026-09-04", funding: "Design contingency" }],
    gcId: "c-graystone",
    milestones: [
      { name: "Schematic design complete", baseline: "2026-03-27", forecast: "2026-03-27", actual: "2026-03-24" },
      { name: "Design development complete", baseline: "2026-09-25", forecast: "2026-10-02" },
      { name: "Early equipment release (chillers)", baseline: "2026-11-13", forecast: "2026-11-13" },
      { name: "Construction documents complete", baseline: "2027-03-26", forecast: "2027-03-26" },
      { name: "Plant cutover", baseline: "2028-06-30", forecast: "2028-06-30" },
      { name: "Final completion", baseline: "2028-09-29", forecast: "2028-09-29" },
    ],
    risks: [
      { id: "R-01", title: "Utility electrical service upgrade timing", category: "Schedule", probability: 3, impact: 5, ownerId: "u-tran", mitigation: "Service application filed; monthly utility coordination.", status: "Open", costExposure: 520_000, scheduleDays: 60 },
      { id: "R-02", title: "Refrigerant regulation changes affect chiller selection", category: "Regulatory", probability: 2, impact: 3, ownerId: "u-tran", mitigation: "Low-GWP refrigerant basis of design.", status: "Watching", costExposure: 150_000, scheduleDays: 0 },
      { id: "R-03", title: "Tunnel structure condition worse than assumed", category: "Cost", probability: 3, impact: 4, ownerId: "u-tran", mitigation: "PCO-003 survey; carry allowance in DD estimate.", status: "Open", costExposure: 900_000, scheduleDays: 30 },
    ],
    team: [
      { kind: "staff", refId: "u-lindqvist", role: "Executive sponsor" },
      { kind: "staff", refId: "u-tran", role: "Project manager" },
      { kind: "staff", refId: "u-bauer", role: "Cost analyst" },
      { kind: "firm", refId: "c-keelson", role: "Engineer of record" },
      { kind: "firm", refId: "c-graystone", role: "Mechanical CM/GC (preconstruction)" },
      { kind: "firm", refId: "c-quartermile", role: "Cost consultant" },
    ],
    safety: { hoursWorked: 1_200, recordables: 0, nearMisses: 0, daysSinceIncident: 344 },
  },
  {
    id: "rmob-bh",
    code: "CP-24029",
    name: "Redmond MOB Level 5 Behavioral Health TI",
    propertyId: "rmob-redmond",
    phase: "Closeout",
    status: "on-schedule",
    pmId: "u-haddad",
    sponsorId: "u-lindqvist",
    controllerId: "u-bauer",
    archetype: "office",
    start: "2025-01-06",
    baselineFinish: "2026-08-28",
    forecastFinish: "2026-09-25",
    physicalComplete: 0.98,
    spi: 1.0,
    funding: "Tenant improvement allowance + routine capital",
    summary: "Outpatient behavioral health clinic fit-out for Bright Path: 22 consult rooms, group therapy, and anti-ligature detailing throughout.",
    totals: { A: 3_650_000, B: 145_000, D: 3_702_000, F: 38_000, I: 3_466_000 },
    adjustments: [
      { code: "3.03", description: "CO #1 – Anti-ligature hardware upgrade", classifier: "OC", amount: 112_000, csi: "08", approved: "2025-08-20" },
      { code: "3.03", description: "CO #2 – After-hours work premium", classifier: "MISC", amount: 33_000, csi: "01", approved: "2026-03-11" },
    ],
    pending: [],
    gcId: "c-summit",
    milestones: [
      { name: "Permit issued", baseline: "2025-03-14", forecast: "2025-03-14", actual: "2025-03-21" },
      { name: "Substantial completion", baseline: "2026-06-26", forecast: "2026-06-26", actual: "2026-06-30" },
      { name: "Tenant occupancy", baseline: "2026-07-13", forecast: "2026-07-13", actual: "2026-07-13" },
      { name: "Punch list closed", baseline: "2026-08-14", forecast: "2026-09-11" },
      { name: "Financial closeout", baseline: "2026-08-28", forecast: "2026-09-25" },
    ],
    risks: [{ id: "R-01", title: "Retainage release held on 3 open punch items", category: "Cost", probability: 2, impact: 1, ownerId: "u-haddad", mitigation: "Punch walk 2026-09-17.", status: "Open", costExposure: 0, scheduleDays: 14 }],
    team: [
      { kind: "staff", refId: "u-haddad", role: "Project manager" },
      { kind: "staff", refId: "u-bauer", role: "Cost analyst" },
      { kind: "staff", refId: "u-iyer", role: "Property manager" },
      { kind: "firm", refId: "c-summit", role: "General contractor" },
      { kind: "firm", refId: "c-tessellate", role: "Architect" },
    ],
    safety: { hoursWorked: 38_900, recordables: 0, nearMisses: 3, daysSinceIncident: 290 },
  },
  {
    id: "sodo-backfill",
    code: "CP-26003",
    name: "SoDo Campus Floors 5–6 Backfill",
    propertyId: "sodo-admin",
    phase: "Design",
    status: "delayed",
    pmId: "u-haddad",
    sponsorId: "u-okafor",
    controllerId: "u-sato",
    archetype: "office",
    start: "2026-02-02",
    baselineFinish: "2027-05-28",
    forecastFinish: "2027-08-20",
    physicalComplete: 0.09,
    spi: 0.81,
    funding: "Routine capital, FY26",
    summary: "Consolidates revenue cycle and IT from two leased sites into vacated floors 5–6. Descoped east wing of floor 6 in June after program review.",
    totals: { A: 6_200_000, B: -350_000, D: 820_000, F: 5_110_000, I: 410_000 },
    adjustments: [{ code: "3.02", description: "Descope floor 6 east wing", amount: -350_000, csi: "09", approved: "2026-06-17" }],
    pending: [],
    gcId: "c-summit",
    milestones: [
      { name: "Program confirmed", baseline: "2026-04-03", forecast: "2026-06-17", actual: "2026-06-17" },
      { name: "Construction documents complete", baseline: "2026-08-28", forecast: "2026-11-06" },
      { name: "Permit issued", baseline: "2026-10-30", forecast: "2027-01-22" },
      { name: "Move-in", baseline: "2027-05-28", forecast: "2027-08-20" },
    ],
    risks: [
      { id: "R-01", title: "Leased site holdover rent if move-in slips past July", category: "Cost", probability: 4, impact: 4, ownerId: "u-haddad", mitigation: "Negotiate 3-month extension option with landlord now.", status: "Open", costExposure: 285_000, scheduleDays: 0 },
      { id: "R-02", title: "Seattle permit review backlog", category: "Regulatory", probability: 4, impact: 3, ownerId: "u-haddad", mitigation: "Pursue subject-to-field-inspection path for TI.", status: "Mitigating", costExposure: 0, scheduleDays: 35 },
    ],
    team: [
      { kind: "staff", refId: "u-okafor", role: "Executive sponsor" },
      { kind: "staff", refId: "u-haddad", role: "Project manager" },
      { kind: "staff", refId: "u-sato", role: "Cost controller" },
      { kind: "staff", refId: "u-iyer", role: "Property manager" },
      { kind: "firm", refId: "c-tessellate", role: "Architect" },
    ],
    safety: { hoursWorked: 0, recordables: 0, nearMisses: 0, daysSinceIncident: 0 },
  },
  {
    id: "tdc-ups",
    code: "CP-25019",
    name: "Tukwila Data Center UPS & Switchgear Replacement",
    propertyId: "tdc-tukwila",
    phase: "Construction",
    status: "delayed",
    pmId: "u-tran",
    sponsorId: "u-lindqvist",
    controllerId: "u-bauer",
    archetype: "equipment",
    start: "2025-08-04",
    baselineFinish: "2026-11-20",
    forecastFinish: "2027-03-12",
    physicalComplete: 0.52,
    spi: 0.84,
    funding: "DTS infrastructure capital, FY25",
    summary: "Concurrent-maintainable replacement of 2N UPS and main switchgear serving Epic production. Every cutover is a scheduled maintenance window with rollback.",
    totals: { A: 9_400_000, B: 610_000, D: 8_960_000, F: 1_540_000, I: 4_020_000 },
    adjustments: [
      { code: "3.03", description: "CO #1 – Existing feeder insulation failure", classifier: "LC", amount: 280_000, csi: "26", approved: "2026-01-14" },
      { code: "3.03", description: "CO #2 – Add second UPS module", classifier: "OC", amount: 410_000, csi: "26", approved: "2026-03-25" },
      { code: "3.06", description: "Contractor contingency release", amount: -80_000, approved: "2026-03-25" },
    ],
    pending: [{ number: "PCO-011", title: "Extended generator rental through March", classifier: "MISC", code: "3.03", amount: 96_000, status: "Pending review", submitted: "2026-09-09", funding: "Owner's reserve" }],
    gcId: "c-brightwater",
    milestones: [
      { name: "Switchgear submittals approved", baseline: "2025-10-17", forecast: "2025-11-07", actual: "2025-11-07" },
      { name: "UPS module A cutover", baseline: "2026-04-18", forecast: "2026-05-02", actual: "2026-05-02" },
      { name: "Switchgear delivery", baseline: "2026-07-31", forecast: "2026-11-27" },
      { name: "Main switchgear cutover", baseline: "2026-09-26", forecast: "2027-01-23" },
      { name: "Integrated systems test", baseline: "2026-11-06", forecast: "2027-02-26" },
      { name: "Final completion", baseline: "2026-11-20", forecast: "2027-03-12" },
    ],
    risks: [
      { id: "R-01", title: "Switchgear factory slot slipped 17 weeks", category: "Schedule", probability: 5, impact: 4, ownerId: "u-tran", mitigation: "Weekly factory status; expedite fee under review.", status: "Mitigating", costExposure: 96_000, scheduleDays: 119 },
      { id: "R-02", title: "Unplanned outage during cutover", category: "Operational", probability: 1, impact: 5, ownerId: "u-tran", mitigation: "Method of procedure reviewed by DTS; rollback rehearsed.", status: "Watching", costExposure: 0, scheduleDays: 0 },
    ],
    team: [
      { kind: "staff", refId: "u-lindqvist", role: "Executive sponsor" },
      { kind: "staff", refId: "u-tran", role: "Project manager" },
      { kind: "staff", refId: "u-bauer", role: "Cost analyst" },
      { kind: "staff", refId: "u-castillo", role: "Field engineer" },
      { kind: "firm", refId: "c-brightwater", role: "Electrical contractor (prime)" },
      { kind: "firm", refId: "c-keelson", role: "Electrical engineer" },
      { kind: "firm", refId: "c-cedarmark", role: "Commissioning authority" },
    ],
    safety: { hoursWorked: 41_600, recordables: 1, nearMisses: 4, daysSinceIncident: 88 },
  },
  {
    id: "scc-linac",
    code: "CP-24033",
    name: "Silverdale Linear Accelerator Vault & Replacement",
    propertyId: "scc-silverdale",
    phase: "Construction",
    status: "at-risk",
    pmId: "u-mensah",
    sponsorId: "u-okafor",
    controllerId: "u-sato",
    archetype: "equipment",
    start: "2025-04-07",
    baselineFinish: "2026-12-18",
    forecastFinish: "2027-01-29",
    physicalComplete: 0.58,
    spi: 0.93,
    funding: "Board-approved capital, FY25",
    summary: "New shielded vault and replacement linear accelerator so radiation oncology keeps two machines in service through the swap.",
    totals: { A: 12_750_000, B: 0, D: 9_880_000, F: 2_420_000, I: 5_150_000 },
    adjustments: [
      { code: "3.03", description: "CO #1 – Vault rock excavation", classifier: "LC", amount: 186_000, csi: "31", approved: "2025-09-10" },
      { code: "3.04", description: "Transfer to CO #1", amount: -186_000, approved: "2025-09-10" },
    ],
    pending: [{ number: "PCO-014", title: "Shielding density verification cores", classifier: "EEO", code: "3.03", amount: 34_000, status: "Priced", submitted: "2026-09-01", funding: "Design contingency" }],
    gcId: "c-alderline",
    milestones: [
      { name: "Vault concrete complete", baseline: "2026-02-27", forecast: "2026-03-20", actual: "2026-03-20" },
      { name: "Linac delivery", baseline: "2026-08-21", forecast: "2026-09-18" },
      { name: "Physics acceptance testing", baseline: "2026-10-30", forecast: "2026-12-04" },
      { name: "First treatment", baseline: "2026-12-18", forecast: "2027-01-29" },
    ],
    risks: [
      { id: "R-01", title: "Physics acceptance window competes with vendor install backlog", category: "Schedule", probability: 4, impact: 4, ownerId: "u-mensah", mitigation: "Reserve vendor physics team in contract amendment.", status: "Open", costExposure: 60_000, scheduleDays: 21 },
      { id: "R-02", title: "Shielding density below design at vault roof", category: "Safety", probability: 2, impact: 5, ownerId: "u-mensah", mitigation: "PCO-014 cores; physicist review before equipment set.", status: "Mitigating", costExposure: 34_000, scheduleDays: 10 },
    ],
    team: [
      { kind: "staff", refId: "u-okafor", role: "Executive sponsor" },
      { kind: "staff", refId: "u-mensah", role: "Owner's representative" },
      { kind: "staff", refId: "u-sato", role: "Cost controller" },
      { kind: "staff", refId: "u-whitehorse", role: "Field inspector" },
      { kind: "firm", refId: "c-alderline", role: "General contractor" },
      { kind: "firm", refId: "c-bluecoast", role: "Structural engineer" },
      { kind: "firm", refId: "c-meridian-eq", role: "Equipment planner" },
    ],
    safety: { hoursWorked: 62_300, recordables: 1, nearMisses: 6, daysSinceIncident: 121 },
  },
  {
    id: "kvsc-spd",
    code: "CP-26001",
    name: "Kent Sterile Processing Expansion",
    propertyId: "kvsc-kent",
    phase: "Preconstruction",
    status: "on-schedule",
    pmId: "u-novak",
    sponsorId: "u-okafor",
    controllerId: "u-sato",
    archetype: "infrastructure",
    start: "2026-01-12",
    baselineFinish: "2028-03-31",
    forecastFinish: "2028-03-31",
    physicalComplete: 0.04,
    spi: 1.01,
    funding: "Board-approved capital, FY26",
    summary: "Doubles central sterile processing throughput for the three hospitals with a 42,000 sf addition, automated washers, and a tracking system tied to OR scheduling.",
    totals: { A: 18_900_000, B: 0, D: 2_340_000, F: 16_300_000, I: 980_000 },
    adjustments: [],
    pending: [],
    gcId: "c-northbeam",
    milestones: [
      { name: "Design development complete", baseline: "2026-08-28", forecast: "2026-08-28", actual: "2026-08-26" },
      { name: "GMP executed", baseline: "2026-12-11", forecast: "2026-12-11" },
      { name: "Building dry-in", baseline: "2027-07-30", forecast: "2027-07-30" },
      { name: "Equipment validation", baseline: "2028-02-11", forecast: "2028-02-11" },
      { name: "Go-live", baseline: "2028-03-31", forecast: "2028-03-31" },
    ],
    risks: [
      { id: "R-01", title: "GMP exceeds DD estimate on washer utilities", category: "Cost", probability: 3, impact: 4, ownerId: "u-novak", mitigation: "Target value design sessions on steam and RO water.", status: "Open", costExposure: 740_000, scheduleDays: 0 },
    ],
    team: [
      { kind: "staff", refId: "u-okafor", role: "Executive sponsor" },
      { kind: "staff", refId: "u-novak", role: "Project manager" },
      { kind: "staff", refId: "u-sato", role: "Cost controller" },
      { kind: "firm", refId: "c-northbeam", role: "CM/GC (preconstruction)" },
      { kind: "firm", refId: "c-tessellate", role: "Architect" },
      { kind: "firm", refId: "c-quartermile", role: "Cost consultant" },
    ],
    safety: { hoursWorked: 0, recordables: 0, nearMisses: 0, daysSinceIncident: 0 },
  },
  {
    id: "lasc-or",
    code: "CP-25002",
    name: "Lakewood ASC OR 5 & 6 Addition",
    propertyId: "lasc-lakewood",
    phase: "Construction",
    status: "on-schedule",
    pmId: "u-reyes",
    sponsorId: "u-lindqvist",
    controllerId: "u-bauer",
    archetype: "fitout",
    start: "2025-09-08",
    baselineFinish: "2027-01-29",
    forecastFinish: "2027-01-22",
    physicalComplete: 0.55,
    spi: 1.04,
    funding: "Routine capital, FY25",
    summary: "4,800 sf addition with two ORs and six recovery bays, built against the occupied ASC with a single weekend tie-in.",
    totals: { A: 7_800_000, B: 95_000, D: 6_420_000, F: 1_390_000, I: 3_610_000 },
    adjustments: [{ code: "3.03", description: "CO #1 – Add OR integration package", classifier: "OC", amount: 95_000, csi: "27", approved: "2026-05-06" }],
    pending: [],
    gcId: "c-alderline",
    milestones: [
      { name: "Foundations complete", baseline: "2025-12-12", forecast: "2025-12-05", actual: "2025-12-05" },
      { name: "Dry-in", baseline: "2026-04-24", forecast: "2026-04-17", actual: "2026-04-17" },
      { name: "Weekend tie-in", baseline: "2026-10-17", forecast: "2026-10-17" },
      { name: "First case", baseline: "2027-01-29", forecast: "2027-01-22" },
    ],
    risks: [{ id: "R-01", title: "Tie-in weekend conflicts with surgical block schedule", category: "Operational", probability: 2, impact: 3, ownerId: "u-reyes", mitigation: "Confirmed with ASC director; backup weekend held.", status: "Watching", costExposure: 0, scheduleDays: 7 }],
    team: [
      { kind: "staff", refId: "u-lindqvist", role: "Executive sponsor" },
      { kind: "staff", refId: "u-reyes", role: "Project manager" },
      { kind: "staff", refId: "u-bauer", role: "Cost analyst" },
      { kind: "staff", refId: "u-whitehorse", role: "Field inspector" },
      { kind: "firm", refId: "c-alderline", role: "General contractor" },
      { kind: "firm", refId: "c-tessellate", role: "Architect" },
    ],
    safety: { hoursWorked: 44_700, recordables: 0, nearMisses: 5, daysSinceIncident: 231 },
  },
];

export function projectById(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
