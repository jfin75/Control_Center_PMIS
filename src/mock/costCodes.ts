/**
 * The Owner's capital budget structure, transcribed from
 * Private/Budget Fortmat/Dropdown List.csv and Budget Template Format.csv.
 * (Two typos in the source — "1.11Design" and "2.06Real Estate" — are spaced.)
 * This is product structure, not demo data.
 */

export type Level1 =
  | "Professional Services"
  | "Real Estate"
  | "Construction"
  | "Enabling"
  | "Equipment"
  | "Furniture"
  | "DTS"
  | "Owners Purchased Services & Equipment"
  | "Owner's Reserve";

export const LEVEL1: Array<{ name: Level1; prefix: string; color: string }> = [
  { name: "Professional Services", prefix: "1", color: "var(--series-1)" },
  { name: "Real Estate", prefix: "2", color: "var(--series-6)" },
  { name: "Construction", prefix: "3", color: "var(--series-2)" },
  { name: "Enabling", prefix: "4", color: "var(--series-8)" },
  { name: "Equipment", prefix: "5", color: "var(--series-4)" },
  { name: "Furniture", prefix: "6", color: "var(--series-5)" },
  { name: "DTS", prefix: "7", color: "var(--series-3)" },
  { name: "Owners Purchased Services & Equipment", prefix: "8", color: "var(--series-7)" },
  { name: "Owner's Reserve", prefix: "9", color: "var(--c-purple-500)" },
];

export interface CostCode {
  code: string;
  name: string;
  level1: Level1;
}

const raw: Array<[string, string]> = [
  ["1.01", "Professional Services - General"],
  ["1.02", "Design - A/E Contract"],
  ["1.05", "Design - Engineering (MEP) Base Contract"],
  ["1.08", "Design - Civil Engineering Base Contract"],
  ["1.11", "Design - Structural Engineering Base Contract"],
  ["1.14", "Project Management - Consultants"],
  ["1.15", "Consultants Other"],
  ["1.16", "Commissioning"],
  ["1.17", "Planning - Conditions Assessment"],
  ["1.18", "Cost Estimating"],
  ["1.19", "Geotechnical/Environmental Assessment"],
  ["1.20", "Pre-Construction Services"],
  ["1.21", "Special Inspections & Testing"],
  ["1.22", "Planning - Concept & Pre-Design Studies"],
  ["1.23", "Planning - Other Studies"],
  ["1.24", "Planning - Land/Title Surveys"],
  ["1.25", "Planning - Traffic Studies"],
  ["1.26", "Design Peer Reviews"],
  ["1.27", "Regulatory Fees"],
  ["1.28", "Equipment Planning Consultant"],
  ["1.29", "Noise & Vibration Consulting Services"],
  ["1.30", "Other Services"],
  ["2.01", "Real Estate - General"],
  ["2.02", "Real Estate - TI Allowance Transfer"],
  ["2.03", "Real Estate - Expenses"],
  ["2.04", "Real Estate - Land Acquisition"],
  ["2.05", "Real Estate - Due Diligence"],
  ["2.06", "Real Estate - Closing Cost"],
  ["3.01", "Construction - General"],
  ["3.02", "Construction - Base Contract"],
  ["3.03", "Construction - Change Orders"],
  ["3.04", "Construction - Design Contingency"],
  ["3.05", "Construction - Permits"],
  ["3.06", "Construction - Contractor Contingency"],
  ["4.01", "Enabling Projects (Rollup)"],
  ["5.01", "Equipment - General"],
  ["5.02", "Equipment Management/Logistics Consultant"],
  ["5.03", "Major/Fixed Equipment"],
  ["5.04", "Minor/Moveable & Fixtures"],
  ["5.05", "Kitchen Equipment"],
  ["6.01", "Furniture - General"],
  ["6.02", "Furniture - Medical Accommodation"],
  ["7.01", "DTS - General"],
  ["7.02", "DTS - IS Infrastructure"],
  ["7.03", "DTS - IS/ Telecom Cabling"],
  ["7.04", "DTS - Computer Hardware"],
  ["7.05", "DTS - Computer Software"],
  ["7.06", "DTS - Epic/Clinical Apps."],
  ["7.07", "DTS - Business Apps."],
  ["7.08", "DTS - Telecom (Phones, Intercom, AV)"],
  ["7.09", "DTS - Consultants (PM/labor)"],
  ["8.01", "Owner - General"],
  ["8.02", "Owner - Audit Services"],
  ["8.03", "Owner - Marketing & Public Affairs"],
  ["8.04", "Owner - Community Investment"],
  ["8.05", "Owner - Moving Expenses"],
  ["8.06", "Owner - Artwork, Graphics & Wayfinding"],
  ["8.07", "Owner - Signage"],
  ["8.08", "Owner - Post Occupancy Surveys"],
  ["8.09", "Owner - Prior Cost Expenses"],
  ["8.10", "Owner - Foundation Transfer"],
  ["8.11", "Owner - Shipping / Freight"],
  ["8.12", "Owner - Workday - Manual Journal"],
  ["8.13", "Owner - Workday - Receipt Accruals"],
  ["9.01", "Owner's Reserve"],
];

export const COST_CODES: CostCode[] = raw.map(([code, name]) => ({
  code,
  name,
  level1: LEVEL1.find((l) => l.prefix === code.split(".")[0])!.name,
}));

export function costCode(code: string): CostCode {
  const c = COST_CODES.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown cost code ${code}`);
  return c;
}

export type ChangeClassifier = "OC" | "AEO" | "EEO" | "LC" | "MISC";
export const CHANGE_CLASSIFIERS: Array<{ id: ChangeClassifier; label: string }> = [
  { id: "OC", label: "Owner Change" },
  { id: "AEO", label: "Architect Error & Omission" },
  { id: "EEO", label: "Engineer Error & Omission" },
  { id: "LC", label: "Latent Condition" },
  { id: "MISC", label: "Miscellaneous" },
];

/** CSI MasterFormat divisions used as a secondary filter on Construction lines. */
export const CSI_DIVISIONS: Array<{ id: string; name: string }> = [
  { id: "01", name: "General Requirements" },
  { id: "02", name: "Existing Conditions" },
  { id: "03", name: "Concrete" },
  { id: "05", name: "Metals" },
  { id: "06", name: "Wood, Plastics & Composites" },
  { id: "07", name: "Thermal & Moisture Protection" },
  { id: "08", name: "Openings" },
  { id: "09", name: "Finishes" },
  { id: "10", name: "Specialties" },
  { id: "13", name: "Special Construction" },
  { id: "21", name: "Fire Suppression" },
  { id: "22", name: "Plumbing" },
  { id: "23", name: "HVAC" },
  { id: "25", name: "Integrated Automation" },
  { id: "26", name: "Electrical" },
  { id: "27", name: "Communications" },
  { id: "28", name: "Electronic Safety & Security" },
  { id: "31", name: "Earthwork" },
  { id: "32", name: "Exterior Improvements" },
];

export function csiName(id: string): string {
  return CSI_DIVISIONS.find((d) => d.id === id)?.name ?? `Division ${id}`;
}

/** Uniformat II Level 1 groups, used for conceptual/ROM estimates in Planning. */
export const UNIFORMAT: Array<{ id: string; name: string }> = [
  { id: "A", name: "Substructure" },
  { id: "B", name: "Shell" },
  { id: "C", name: "Interiors" },
  { id: "D", name: "Services" },
  { id: "E", name: "Equipment & Furnishings" },
  { id: "F", name: "Special Construction & Demolition" },
  { id: "G", name: "Building Sitework" },
  { id: "Z", name: "General Requirements, Fees & Contingency" },
];
