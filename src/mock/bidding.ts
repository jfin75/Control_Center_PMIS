/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts. */

export type PackageStatus = "Drafting" | "Out to tender" | "Bids received" | "Leveling" | "Award recommended" | "Awarded";
export const PACKAGE_STATUSES: PackageStatus[] = ["Drafting", "Out to tender", "Bids received", "Leveling", "Award recommended", "Awarded"];

export interface ScopeItem {
  id: string;
  label: string;
}

export interface Bid {
  contractorId: string;
  base: number;
  /** Per scope item: amount, "incl" (included in base), or "excl" (excluded — must be plugged). */
  items: Record<string, number | "incl" | "excl">;
  alternates: number;
  qualifications: string[];
  scheduleDays: number;
  bondRate: number;
}

export interface BidPackage {
  id: string;
  number: string;
  name: string;
  projectId: string;
  method: "RFP — Best value" | "ITB — Low bid" | "CM/GC GMP" | "Sole source";
  csi: string[];
  status: PackageStatus;
  issued: string | null;
  due: string | null;
  prebid: string | null;
  invited: number;
  estimate: number;
  scope: ScopeItem[];
  /** Plug values the Owner uses to level excluded scope. */
  plugs: Record<string, number>;
  bids: Bid[];
  recommendation?: { contractorId: string; rationale: string };
}

export const BID_PACKAGES: BidPackage[] = [
  {
    id: "bp-2611",
    number: "BP-2611",
    name: "ED Expansion Stage 3 — Mechanical & Plumbing",
    projectId: "ehs-ed",
    method: "RFP — Best value",
    csi: ["22", "23"],
    status: "Leveling",
    issued: "2026-07-28",
    due: "2026-09-04",
    prebid: "2026-08-06",
    invited: 5,
    estimate: 2_940_000,
    scope: [
      { id: "hvac", label: "HVAC ductwork & terminal units" },
      { id: "plumb", label: "Domestic water & sanitary" },
      { id: "medgas", label: "Medical gas outlets & zone valves" },
      { id: "controls", label: "BAS controls integration" },
      { id: "icra", label: "ICRA negative-air & barriers" },
      { id: "tab", label: "Test, adjust & balance" },
    ],
    plugs: { hvac: 1_310_000, plumb: 520_000, medgas: 310_000, controls: 240_000, icra: 145_000, tab: 68_000 },
    bids: [
      {
        contractorId: "c-graystone",
        base: 2_788_000,
        items: { hvac: "incl", plumb: "incl", medgas: "incl", controls: "incl", icra: "incl", tab: "incl" },
        alternates: 42_000,
        qualifications: ["Night-shift premium included for Stage 3 tie-ins"],
        scheduleDays: 168,
        bondRate: 0.009,
      },
      {
        contractorId: "c-harrow",
        base: 2_540_000,
        items: { hvac: "incl", plumb: "incl", medgas: "incl", controls: "excl", icra: "excl", tab: "incl" },
        alternates: 38_500,
        qualifications: ["Excludes BAS integration", "Excludes ICRA barriers — by GC", "Pricing valid 30 days"],
        scheduleDays: 175,
        bondRate: 0.01,
      },
      {
        contractorId: "c-foothold",
        base: 3_105_000,
        items: { hvac: "incl", plumb: "incl", medgas: "incl", controls: "incl", icra: "incl", tab: "incl" },
        alternates: 51_000,
        qualifications: ["Assumes single-shift work"],
        scheduleDays: 190,
        bondRate: 0.011,
      },
      {
        contractorId: "c-clearline",
        base: 2_695_000,
        items: { hvac: "incl", plumb: "incl", medgas: "excl", controls: "incl", icra: "incl", tab: "excl" },
        alternates: 40_000,
        qualifications: ["Medical gas by others", "TAB by Owner’s agent"],
        scheduleDays: 160,
        bondRate: 0.0095,
      },
    ],
    recommendation: {
      contractorId: "c-graystone",
      rationale:
        "Lowest leveled total once excluded scope is plugged, complete medical gas and ICRA scope with no qualifications that shift risk to the Owner, and the strongest EMR on the list (0.69).",
    },
  },
  {
    id: "bp-2604",
    number: "BP-2604",
    name: "Level 4 OR Integration & AV",
    projectId: "hmc-l4",
    method: "Sole source",
    csi: ["27"],
    status: "Awarded",
    issued: "2026-02-02",
    due: "2026-02-27",
    prebid: null,
    invited: 1,
    estimate: 1_220_000,
    scope: [{ id: "int", label: "OR integration system" }],
    plugs: { int: 1_220_000 },
    bids: [
      { contractorId: "c-brightwater", base: 1_184_000, items: { int: "incl" }, alternates: 0, qualifications: ["Standardized to system OR platform"], scheduleDays: 90, bondRate: 0.01 },
    ],
    recommendation: { contractorId: "c-brightwater", rationale: "Sole-source justification approved 2026-01-21 for platform standardization." },
  },
  {
    id: "bp-2614",
    number: "BP-2614",
    name: "Central Utility Plant — Early Chiller Procurement",
    projectId: "nsrh-cup",
    method: "RFP — Best value",
    csi: ["23"],
    status: "Out to tender",
    issued: "2026-08-24",
    due: "2026-09-25",
    prebid: "2026-09-03",
    invited: 4,
    estimate: 6_850_000,
    scope: [
      { id: "chillers", label: "Heat-recovery chillers (3)" },
      { id: "startup", label: "Factory start-up & training" },
      { id: "warranty", label: "5-year parts & labor warranty" },
    ],
    plugs: { chillers: 6_200_000, startup: 180_000, warranty: 470_000 },
    bids: [],
  },
  {
    id: "bp-2615",
    number: "BP-2615",
    name: "Sterile Processing Addition — Site & Foundations",
    projectId: "kvsc-spd",
    method: "CM/GC GMP",
    csi: ["03", "31", "32"],
    status: "Out to tender",
    issued: "2026-09-01",
    due: "2026-10-02",
    prebid: "2026-09-10",
    invited: 6,
    estimate: 3_420_000,
    scope: [
      { id: "earth", label: "Earthwork & soil improvement" },
      { id: "found", label: "Foundations & slab on grade" },
      { id: "util", label: "Site utilities" },
    ],
    plugs: { earth: 1_050_000, found: 1_710_000, util: 660_000 },
    bids: [],
  },
  {
    id: "bp-2609",
    number: "BP-2609",
    name: "UPS Module B & Battery Cabinets",
    projectId: "tdc-ups",
    method: "ITB — Low bid",
    csi: ["26"],
    status: "Award recommended",
    issued: "2026-06-15",
    due: "2026-07-17",
    prebid: "2026-06-23",
    invited: 3,
    estimate: 1_460_000,
    scope: [
      { id: "ups", label: "UPS module & static switch" },
      { id: "batt", label: "VRLA battery cabinets" },
      { id: "cx", label: "Integrated systems test support" },
    ],
    plugs: { ups: 980_000, batt: 380_000, cx: 100_000 },
    bids: [
      { contractorId: "c-brightwater", base: 1_392_000, items: { ups: "incl", batt: "incl", cx: "incl" }, alternates: 0, qualifications: [], scheduleDays: 120, bondRate: 0.01 },
      { contractorId: "c-graystone", base: 1_518_000, items: { ups: "incl", batt: "incl", cx: "incl" }, alternates: 0, qualifications: ["Battery lead time 22 weeks"], scheduleDays: 150, bondRate: 0.009 },
      { contractorId: "c-harrow", base: 1_301_000, items: { ups: "incl", batt: "excl", cx: "incl" }, alternates: 0, qualifications: ["Batteries Owner-furnished"], scheduleDays: 125, bondRate: 0.01 },
    ],
    recommendation: { contractorId: "c-brightwater", rationale: "Low responsive bidder after plugging Owner-furnished batteries on the Harrow & Finch bid; already mobilized on site." },
  },
  {
    id: "bp-2616",
    number: "BP-2616",
    name: "Floors 5–6 Backfill — Interiors Package",
    projectId: "sodo-backfill",
    method: "ITB — Low bid",
    csi: ["06", "08", "09", "10"],
    status: "Drafting",
    issued: null,
    due: null,
    prebid: null,
    invited: 0,
    estimate: 2_180_000,
    scope: [{ id: "int", label: "Interior construction" }],
    plugs: { int: 2_180_000 },
    bids: [],
  },
  {
    id: "bp-2612",
    number: "BP-2612",
    name: "Linac Vault — Radiation Shielding Doors",
    projectId: "scc-linac",
    method: "ITB — Low bid",
    csi: ["08", "13"],
    status: "Bids received",
    issued: "2026-08-03",
    due: "2026-09-10",
    prebid: "2026-08-12",
    invited: 3,
    estimate: 640_000,
    scope: [
      { id: "door", label: "Motorized shielded door" },
      { id: "frame", label: "Frame & embeds" },
      { id: "interlock", label: "Safety interlocks" },
    ],
    plugs: { door: 470_000, frame: 110_000, interlock: 60_000 },
    bids: [
      { contractorId: "c-ravenna", base: 612_000, items: { door: "incl", frame: "incl", interlock: "incl" }, alternates: 0, qualifications: ["Not prequalified — requires review"], scheduleDays: 84, bondRate: 0.012 },
      { contractorId: "c-ironwood", base: 655_000, items: { door: "incl", frame: "incl", interlock: "incl" }, alternates: 0, qualifications: [], scheduleDays: 70, bondRate: 0.01 },
    ],
  },
  {
    id: "bp-2617",
    number: "BP-2617",
    name: "MRI Suite — RF Shielding & Quench Vent",
    projectId: "cmp-mri",
    method: "ITB — Low bid",
    csi: ["13", "23"],
    status: "Out to tender",
    issued: "2026-09-08",
    due: "2026-09-29",
    prebid: "2026-09-15",
    invited: 3,
    estimate: 286_000,
    scope: [
      { id: "rf", label: "RF shield rework" },
      { id: "quench", label: "Quench pipe reroute" },
    ],
    plugs: { rf: 198_000, quench: 88_000 },
    bids: [],
  },
];

export function levelBid(pkg: BidPackage, bid: Bid): { leveled: number; plugged: number; excluded: string[] } {
  let plugged = 0;
  const excluded: string[] = [];
  let extras = 0;
  for (const s of pkg.scope) {
    const v = bid.items[s.id];
    if (v === "excl") {
      plugged += pkg.plugs[s.id] ?? 0;
      excluded.push(s.label);
    } else if (typeof v === "number") extras += v;
  }
  return { leveled: bid.base + extras + plugged, plugged, excluded };
}
