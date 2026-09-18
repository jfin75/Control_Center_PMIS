/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  Submittal registers for projects in procurement, construction, and
 *  closeout. Each register is built from a spec-section library and the
 *  project's submittal window, then played forward to TODAY with a seeded
 *  review history: packages go out, reviewers return them, and anything
 *  rejected comes back as the next revision. */

import { seeded } from "@/lib/budget";
import { addDays, daysBetween } from "@/lib/format";
import { TODAY } from "./org";
import { projectById, type Project } from "./projects";

export type SubmittalType =
  | "Product data"
  | "Shop drawings"
  | "Samples"
  | "Calculations"
  | "Coordination drawings"
  | "Test reports"
  | "Certificates"
  | "O&M manual"
  | "Warranty";

export const SUBMITTAL_TYPES: SubmittalType[] = [
  "Product data",
  "Shop drawings",
  "Samples",
  "Calculations",
  "Coordination drawings",
  "Test reports",
  "Certificates",
  "O&M manual",
  "Warranty",
];

/** Reviewer action codes stamped on a returned submittal. */
export type ReviewAction = "A" | "B" | "C" | "D" | "E";

export const REVIEW_ACTIONS: Record<
  ReviewAction,
  { code: ReviewAction; label: string; long: string; closes: boolean; tone: "pos" | "warn" | "neg" | "info"; severity: number }
> = {
  A: { code: "A", label: "Approved", long: "No exceptions taken", closes: true, tone: "pos", severity: 1 },
  B: { code: "B", label: "Approved as noted", long: "Make corrections noted; no resubmittal", closes: true, tone: "pos", severity: 2 },
  C: { code: "C", label: "Revise and resubmit", long: "Make corrections noted and resubmit", closes: false, tone: "warn", severity: 3 },
  D: { code: "D", label: "Rejected", long: "Does not comply; submit the specified item", closes: false, tone: "neg", severity: 4 },
  E: { code: "E", label: "Received for record", long: "Filed for the record; no review action", closes: true, tone: "info", severity: 0 },
};

export const ACTION_ORDER: ReviewAction[] = ["A", "B", "C", "D", "E"];

/** Division 01: the contractor resubmits within this many days of a return. */
export const RESUBMIT_DAYS = 14;
/** Default review period by type, in calendar days. */
export const REVIEW_DAYS: Record<SubmittalType, number> = {
  "Product data": 14,
  "Shop drawings": 21,
  Samples: 10,
  Calculations: 21,
  "Coordination drawings": 14,
  "Test reports": 10,
  Certificates: 7,
  "O&M manual": 14,
  Warranty: 7,
};
/** Items at or above this fabrication lead time are tracked as long-lead. */
export const LONG_LEAD_WEEKS = 8;

/**
 * Days of float the submittal schedule carries between planned approval and
 * the start of fabrication: one full resubmittal cycle for long-lead items,
 * a week for everything else.
 */
export function scheduleAllowance(leadWeeks: number, reviewDays: number): number {
  return leadWeeks >= LONG_LEAD_WEEKS ? reviewDays + RESUBMIT_DAYS : 7;
}

/**
 * Each reviewer's share of the review period, in days: specialty consultants
 * 30%, the lead design reviewer 50%, the Owner 25%, rescaled to the reviewers
 * actually on the route.
 */
export function stepAllotments(route: Array<{ kind: "firm" | "staff"; id: string }>, reviewDays: number): number[] {
  const w: number[] = route.map((r) => (r.kind === "staff" ? 0.25 : r.id === "c-cedarmark" || r.id === "c-meridian-eq" ? 0.3 : 0.5));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map((x) => Math.max(1, Math.floor((x / sum) * reviewDays)));
  const lead = w.indexOf(Math.max(...w));
  raw[lead] = Math.max(1, raw[lead]! + reviewDays - raw.reduce((a, b) => a + b, 0));
  return raw;
}

export interface Party {
  kind: "firm" | "staff";
  id: string;
  role: string;
}

export interface ReviewStep {
  party: Party;
  action?: ReviewAction;
  date?: string;
  comments?: string;
}

export interface Revision {
  rev: number;
  packageId: string;
  submitted: string;
  due: string;
  /** Review route in order. The first step without a date holds the ball. */
  steps: ReviewStep[];
  /** Set when the route completes: the most restrictive step action governs. */
  returned?: string;
  action?: ReviewAction;
  /** The contractor's response to the previous revision's comments. */
  response?: string;
}

export interface Submittal {
  id: string;
  projectId: string;
  section: string;
  sectionTitle: string;
  seq: number;
  title: string;
  type: SubmittalType;
  /** Responsible firm: the trade contractor, or the GC when self-performed. */
  byId: string;
  /** Date the material or document is needed on site; drives the submit-by date. */
  requiredOnSite: string;
  leadWeeks: number;
  reviewDays: number;
  /** Default review route for new revisions. */
  reviewers: Party[];
  revisions: Revision[];
}

export interface SubmittalPackage {
  id: string;
  number: string;
  projectId: string;
  title: string;
  created: string;
  /** Null while the package is a draft. */
  transmitted: string | null;
  reviewDays: number;
  items: Array<{ submittalId: string; rev: number; response?: string }>;
  reviewers: Party[];
  note: string;
  byId: string;
}

/* ---------------------------------------------------------------------------
 * Spec-section library
 * ------------------------------------------------------------------------- */

type Discipline = "arch" | "struct" | "mech" | "elec" | "fire" | "equip" | "dts";

interface SectionSpec {
  section: string;
  title: string;
  disc: Discipline;
  /** Responsible firm; "gc" means the project's general contractor self-performs. */
  by: string;
  lead: number;
  /** Owner review required: clinical equipment, finishes, DTS and security standards. */
  owner?: boolean;
  /** Commissioning authority reviews. */
  cx?: boolean;
  /** [title, type, closeout wave] */
  items: Array<[string, SubmittalType, ("closeout" | undefined)?]>;
  /** Index of a layout item submitted separately for each area or stage. */
  areaItem?: number;
}

const LIB: Record<string, SectionSpec> = {
  earthwork: { section: "31 23 00", title: "Excavation and Fill", disc: "struct", by: "c-foothold", lead: 1, items: [["Structural fill gradation & compaction plan", "Test reports"], ["Dewatering plan", "Shop drawings"]] },
  concrete: { section: "03 30 00", title: "Cast-in-Place Concrete", disc: "struct", by: "gc", lead: 2, items: [["Concrete mix designs", "Product data"], ["Reinforcing steel shop drawings", "Shop drawings"], ["Admixtures & curing compounds", "Product data"], ["Concrete cylinder test reports", "Test reports", "closeout"]] },
  steel: { section: "05 12 00", title: "Structural Steel Framing", disc: "struct", by: "c-ironwood", lead: 10, items: [["Erection & connection shop drawings", "Shop drawings"], ["Connection design calculations", "Calculations"], ["Welder certifications", "Certificates"], ["Mill certificates", "Certificates", "closeout"]] },
  cfmf: { section: "05 40 00", title: "Cold-Formed Metal Framing", disc: "struct", by: "c-summit", lead: 3, items: [["Delegated-design framing calculations", "Calculations"], ["Overhead support & seismic bracing", "Shop drawings"], ["Framing & clip product data", "Product data"]] },
  insulation: { section: "07 21 00", title: "Thermal Insulation", disc: "arch", by: "gc", lead: 1, items: [["Batt & board insulation", "Product data"], ["Acoustic insulation at rated walls", "Product data"]] },
  roofing: { section: "07 54 23", title: "Thermoplastic-Polyolefin Roofing", disc: "arch", by: "gc", lead: 6, items: [["Roofing system & details", "Shop drawings"], ["Membrane & insulation product data", "Product data"], ["Manufacturer’s roofing warranty", "Warranty", "closeout"]] },
  firestop: { section: "07 84 00", title: "Firestopping", disc: "arch", by: "gc", lead: 1, items: [["UL systems & engineering judgments", "Product data"], ["Firestop installer qualifications", "Certificates"], ["Firestop inspection log", "Test reports", "closeout"]] },
  sealants: { section: "07 92 00", title: "Joint Sealants", disc: "arch", by: "gc", lead: 1, items: [["Sealant product data & colors", "Samples"]] },
  curtainwall: { section: "08 44 13", title: "Glazed Aluminum Curtain Walls", disc: "arch", by: "c-ravenna", lead: 14, items: [["Curtain wall shop drawings", "Shop drawings"], ["Curtain wall structural calculations", "Calculations"], ["Anodized finish samples", "Samples"], ["Field water test report", "Test reports", "closeout"], ["Curtain wall warranty", "Warranty", "closeout"]] },
  doors: { section: "08 11 13", title: "Hollow Metal Doors and Frames", disc: "arch", by: "gc", lead: 8, items: [["Door & frame shop drawings", "Shop drawings"], ["Door & frame schedule", "Product data"], ["Fire-rated label certifications", "Certificates", "closeout"]] },
  wooddoors: { section: "08 14 16", title: "Flush Wood Doors", disc: "arch", by: "gc", lead: 10, owner: true, items: [["Wood door shop drawings", "Shop drawings"], ["Veneer samples", "Samples"]] },
  hardware: { section: "08 71 00", title: "Door Hardware", disc: "arch", by: "gc", lead: 10, owner: true, items: [["Hardware schedule & keying", "Shop drawings"], ["Hardware product data", "Product data"], ["Hardware O&M and keying records", "O&M manual", "closeout"]] },
  louvers: { section: "08 91 19", title: "Fixed Louvers", disc: "arch", by: "gc", lead: 8, items: [["Louver product data & finish", "Product data"], ["Louver shop drawings", "Shop drawings"]] },
  glazing: { section: "08 80 00", title: "Glazing", disc: "arch", by: "c-ravenna", lead: 6, items: [["Interior fire-rated & vision glazing", "Product data"], ["Glass samples", "Samples"]] },
  gyp: { section: "09 21 16", title: "Gypsum Board Assemblies", disc: "arch", by: "c-summit", lead: 2, items: [["Board & abuse-resistant products", "Product data"], ["Shaft wall & rated assembly listings", "Product data"]] },
  tile: { section: "09 30 13", title: "Ceramic Tiling", disc: "arch", by: "c-summit", lead: 4, owner: true, items: [["Tile & grout samples", "Samples"], ["Setting materials & waterproofing", "Product data"]] },
  ceilings: { section: "09 51 13", title: "Acoustical Panel Ceilings", disc: "arch", by: "c-summit", lead: 4, owner: true, areaItem: 2, items: [["Washable & cleanroom ceiling panels", "Product data"], ["Ceiling panel samples", "Samples"], ["Ceiling seismic bracing details", "Shop drawings"]] },
  flooring: { section: "09 65 16", title: "Resilient Sheet Flooring", disc: "arch", by: "c-summit", lead: 5, owner: true, items: [["Sheet vinyl & welded seam samples", "Samples"], ["Flooring product data & moisture limits", "Product data"], ["Flooring maintenance data", "O&M manual", "closeout"]] },
  paint: { section: "09 91 23", title: "Interior Painting", disc: "arch", by: "c-summit", lead: 1, owner: true, items: [["Color & sheen drawdowns", "Samples"], ["Paint product data & VOC", "Product data"]] },
  signage: { section: "10 14 00", title: "Signage", disc: "arch", by: "gc", lead: 6, owner: true, areaItem: 0, items: [["Wayfinding & room ID sign schedule", "Shop drawings"], ["Sign finish samples", "Samples"]] },
  cubicle: { section: "10 21 23", title: "Cubicle Curtains and Track", disc: "arch", by: "gc", lead: 6, owner: true, areaItem: 0, items: [["Curtain track layout", "Shop drawings"], ["Antimicrobial fabric samples", "Samples"]] },
  wallprot: { section: "10 26 00", title: "Wall and Door Protection", disc: "arch", by: "gc", lead: 6, owner: true, items: [["Corner guards & handrail product data", "Product data"], ["Wall protection color samples", "Samples"]] },
  accessories: { section: "10 28 00", title: "Toilet, Bath, and Laundry Accessories", disc: "arch", by: "gc", lead: 4, owner: true, items: [["Accessory product data & mounting heights", "Product data"], ["Accessory warranty", "Warranty", "closeout"]] },
  casework: { section: "06 41 16", title: "Plastic-Laminate-Clad Casework", disc: "arch", by: "c-pacific-mw", lead: 10, owner: true, areaItem: 0, items: [["Casework shop drawings", "Shop drawings"], ["Laminate & solid-surface samples", "Samples"], ["Casework hardware product data", "Product data"], ["Casework warranty", "Warranty", "closeout"]] },
  headwalls: { section: "11 73 00", title: "Patient Care Equipment", disc: "equip", by: "gc", lead: 14, owner: true, items: [["Prefabricated headwall shop drawings", "Shop drawings"], ["Headwall mock-up review report", "Test reports"]] },
  sterilizers: { section: "11 71 00", title: "Medical Sterilizing Equipment", disc: "equip", by: "gc", lead: 24, owner: true, items: [["Washer-disinfector product data", "Product data"], ["Sterilizer utility & rough-in drawings", "Shop drawings"]] },
  orequip: { section: "11 76 00", title: "Operating Room Equipment", disc: "equip", by: "gc", lead: 18, owner: true, items: [["Surgical light & boom layouts", "Shop drawings"], ["Ceiling support structure calculations", "Calculations"], ["Boom & light O&M manuals", "O&M manual", "closeout"]] },
  imaging: { section: "11 77 00", title: "Radiology Equipment", disc: "equip", by: "c-orca", lead: 4, owner: true, items: [["Equipment site-planning drawings", "Shop drawings"], ["Power, cooling & network requirements", "Product data"], ["Vendor acceptance test report", "Test reports", "closeout"]] },
  xrayshield: { section: "13 49 13", title: "Integrated X-Ray Shielding Assemblies", disc: "struct", by: "gc", lead: 8, owner: true, items: [["Shielding design report", "Calculations"], ["Vault door & maze shop drawings", "Shop drawings"], ["High-density concrete mix design", "Product data"], ["Radiation protection survey", "Test reports", "closeout"]] },
  rfshield: { section: "13 49 23", title: "Modular RF Shielding Enclosures", disc: "equip", by: "c-orca", lead: 10, owner: true, items: [["RF enclosure & door shop drawings", "Shop drawings"], ["Magnetic shielding calculations", "Calculations"], ["RF attenuation test report", "Test reports", "closeout"]] },
  pneumatic: { section: "14 92 00", title: "Pneumatic Tube Systems", disc: "equip", by: "gc", lead: 16, owner: true, items: [["Tube station & routing shop drawings", "Shop drawings"], ["Station product data", "Product data"], ["System acceptance test", "Test reports", "closeout"]] },
  sprinkler: { section: "21 13 13", title: "Wet-Pipe Sprinkler Systems", disc: "fire", by: "c-clearline", lead: 4, areaItem: 0, items: [["Sprinkler layout & hydraulic calculations", "Shop drawings"], ["Sprinkler heads & valves", "Product data"], ["Seismic bracing calculations", "Calculations"], ["Hydrostatic test certificate", "Certificates", "closeout"]] },
  cleanagent: { section: "21 22 00", title: "Clean-Agent Fire-Extinguishing Systems", disc: "fire", by: "c-clearline", lead: 12, owner: true, items: [["Clean-agent system shop drawings & flow calculations", "Shop drawings"], ["Agent & cylinder product data", "Product data"], ["Room integrity (door fan) test", "Test reports", "closeout"]] },
  plumbing: { section: "22 11 16", title: "Domestic Water Piping", disc: "mech", by: "c-graystone", lead: 3, items: [["Piping, valves & insulation", "Product data"], ["Thermostatic mixing valves", "Product data"], ["Disinfection & flushing report", "Test reports", "closeout"]] },
  fixtures: { section: "22 42 00", title: "Commercial Plumbing Fixtures", disc: "mech", by: "c-graystone", lead: 6, owner: true, items: [["Plumbing fixtures & trim", "Product data"], ["Fixture O&M data", "O&M manual", "closeout"]] },
  medgas: { section: "22 63 00", title: "Medical Gas Systems", disc: "mech", by: "c-graystone", lead: 6, owner: true, areaItem: 1, items: [["Outlets, zone valve boxes & alarms", "Product data"], ["Medical gas piping layout", "Shop drawings"], ["Installer ASSE 6010 certifications", "Certificates"], ["ASSE 6030 verification report", "Certificates", "closeout"]] },
  hvacinsul: { section: "23 07 00", title: "HVAC Insulation", disc: "mech", by: "c-graystone", lead: 1, items: [["Duct & pipe insulation", "Product data"]] },
  controls: { section: "23 09 23", title: "DDC System for HVAC", disc: "mech", by: "c-graystone", lead: 6, owner: true, cx: true, areaItem: 0, items: [["Controls shop drawings & sequences", "Shop drawings"], ["Points list & graphics", "Product data"], ["Room pressure monitors", "Product data"], ["Controls O&M and as-builts", "O&M manual", "closeout"]] },
  tab: { section: "23 05 93", title: "Testing, Adjusting, and Balancing", disc: "mech", by: "c-graystone", lead: 0, cx: true, items: [["TAB agent qualifications & procedures", "Certificates"], ["Final TAB report", "Test reports", "closeout"]] },
  hydronic: { section: "23 21 13", title: "Hydronic Piping", disc: "mech", by: "c-graystone", lead: 3, items: [["Hydronic piping, valves & specialties", "Product data"], ["Hydronic pump product data", "Product data"], ["Hydronic pressure test report", "Test reports", "closeout"]] },
  ductwork: { section: "23 31 13", title: "Metal Ducts", disc: "mech", by: "c-graystone", lead: 3, areaItem: 0, items: [["Coordinated duct shop drawings", "Coordination drawings"], ["Duct leakage test report", "Test reports", "closeout"]] },
  fans: { section: "23 34 00", title: "HVAC Fans", disc: "mech", by: "c-graystone", lead: 10, cx: true, items: [["Exhaust fan product data", "Product data"], ["Fan O&M manual", "O&M manual", "closeout"]] },
  vav: { section: "23 36 00", title: "Air Terminal Units", disc: "mech", by: "c-graystone", lead: 8, items: [["VAV box schedules & product data", "Product data"], ["Terminal unit O&M manual", "O&M manual", "closeout"]] },
  diffusers: { section: "23 37 13", title: "Diffusers, Registers, and Grilles", disc: "mech", by: "c-graystone", lead: 4, items: [["Air device schedule & product data", "Product data"]] },
  chillers: { section: "23 64 16", title: "Centrifugal Water Chillers", disc: "mech", by: "c-graystone", lead: 44, cx: true, items: [["Heat-recovery chiller product data", "Product data"], ["Chiller sound & vibration data", "Product data"], ["Factory witness test procedure", "Test reports"]] },
  procchiller: { section: "23 64 23", title: "Scroll Water Chillers", disc: "equip", by: "gc", lead: 16, items: [["Process chiller product data", "Product data"], ["Chiller start-up report", "Test reports", "closeout"]] },
  towers: { section: "23 65 00", title: "Cooling Towers", disc: "mech", by: "c-graystone", lead: 30, cx: true, items: [["Cooling tower product data", "Product data"], ["Tower structural support drawings", "Shop drawings"]] },
  ahu: { section: "23 73 13", title: "Modular Indoor Central-Station AHUs", disc: "mech", by: "c-graystone", lead: 16, cx: true, items: [["AHU product data & fan curves", "Product data"], ["AHU shop drawings", "Shop drawings"], ["AHU O&M manual", "O&M manual", "closeout"]] },
  humidifiers: { section: "23 84 13", title: "Humidifiers", disc: "mech", by: "c-graystone", lead: 10, cx: true, items: [["Steam humidifier product data", "Product data"]] },
  epms: { section: "26 09 13", title: "Electrical Power Monitoring", disc: "elec", by: "gc", lead: 8, owner: true, items: [["EPMS points list & graphics", "Shop drawings"], ["Meter product data", "Product data"]] },
  conductors: { section: "26 05 19", title: "Low-Voltage Electrical Conductors", disc: "elec", by: "c-brightwater", lead: 2, items: [["Wire & cable product data", "Product data"], ["Insulation resistance test report", "Test reports", "closeout"]] },
  grounding: { section: "26 05 26", title: "Grounding and Bonding", disc: "elec", by: "c-brightwater", lead: 1, items: [["Grounding layout", "Shop drawings"], ["Ground resistance test report", "Test reports", "closeout"]] },
  study: { section: "26 05 73", title: "Power System Studies", disc: "elec", by: "gc", lead: 0, items: [["Short-circuit, coordination & arc-flash study", "Calculations"], ["Arc-flash labels", "Product data", "closeout"]] },
  mvswgr: { section: "26 13 26", title: "Medium-Voltage Metal-Clad Switchgear", disc: "elec", by: "gc", lead: 38, owner: true, cx: true, items: [["Switchgear shop drawings & one-lines", "Shop drawings"], ["Factory test report", "Test reports", "closeout"]] },
  lvswgr: { section: "26 23 00", title: "Low-Voltage Switchgear", disc: "elec", by: "c-brightwater", lead: 30, cx: true, items: [["Switchgear shop drawings", "Shop drawings"], ["Switchgear O&M manual", "O&M manual", "closeout"]] },
  panels: { section: "26 24 16", title: "Panelboards", disc: "elec", by: "c-brightwater", lead: 10, items: [["Panelboard schedules & product data", "Product data"], ["Isolated power panels (OR & ICU)", "Product data"], ["Panelboard O&M manual", "O&M manual", "closeout"]] },
  devices: { section: "26 27 26", title: "Wiring Devices", disc: "elec", by: "c-brightwater", lead: 4, owner: true, items: [["Hospital-grade receptacles & colors", "Product data"]] },
  generator: { section: "26 32 13", title: "Engine Generators", disc: "elec", by: "gc", lead: 52, cx: true, items: [["Generator product data & emissions", "Product data"], ["Enclosure & fuel system drawings", "Shop drawings"], ["Load bank test report", "Test reports", "closeout"]] },
  ups: { section: "26 33 53", title: "Static Uninterruptible Power Supply", disc: "elec", by: "gc", lead: 20, owner: true, cx: true, items: [["UPS modules & battery cabinets", "Product data"], ["UPS warranty", "Warranty", "closeout"]] },
  ats: { section: "26 36 23", title: "Automatic Transfer Switches", disc: "elec", by: "gc", lead: 18, cx: true, items: [["ATS product data", "Product data"], ["ATS O&M manual", "O&M manual", "closeout"]] },
  lighting: { section: "26 51 00", title: "Interior Lighting", disc: "elec", by: "c-brightwater", lead: 8, owner: true, areaItem: 1, items: [["Luminaire package", "Product data"], ["Lighting controls", "Shop drawings"], ["Emergency lighting inverters", "Product data"], ["Lighting controls commissioning report", "Test reports", "closeout"]] },
  cabling: { section: "27 10 00", title: "Structured Cabling", disc: "dts", by: "c-brightwater", lead: 4, owner: true, items: [["Cabling & pathway product data", "Product data"], ["Telecom room layouts", "Shop drawings"], ["Cable certification test results", "Test reports", "closeout"]] },
  nursecall: { section: "27 52 23", title: "Nurse Call/Code Blue Systems", disc: "dts", by: "c-brightwater", lead: 10, owner: true, items: [["Nurse call riser & device layout", "Shop drawings"], ["Head-end integration", "Product data"]] },
  access: { section: "28 13 00", title: "Access Control", disc: "dts", by: "c-brightwater", lead: 6, owner: true, items: [["Access control device layout", "Shop drawings"], ["Card reader & lock product data", "Product data"]] },
  video: { section: "28 23 00", title: "Video Surveillance", disc: "dts", by: "c-brightwater", lead: 6, owner: true, items: [["Camera layout & head-end", "Shop drawings"]] },
  firealarm: { section: "28 46 21", title: "Fire Alarm", disc: "fire", by: "c-brightwater", lead: 6, areaItem: 0, items: [["Fire alarm shop drawings & battery calculations", "Shop drawings"], ["Fire alarm device product data", "Product data"], ["Fire alarm acceptance test", "Certificates", "closeout"]] },
};

/** Section title lookup for the "add item" form. */
export const SPEC_SECTIONS: Array<{ section: string; title: string }> = Object.values(LIB)
  .map((s) => ({ section: s.section, title: s.title }))
  .sort((a, b) => a.section.localeCompare(b.section));

/* ---------------------------------------------------------------------------
 * Project registers
 * ------------------------------------------------------------------------- */

interface Round {
  submitted: string;
  /** Omit while the round is still in review. */
  returned?: string;
  /** Action per item still in play this round, in section order. */
  actions?: ReviewAction[];
}

interface RegisterSpec {
  projectId: string;
  seed: number;
  /** First and last planned submit dates for action submittals. */
  action: [string, string];
  /** Planned window for closeout submittals (O&M, warranties, tests). */
  closeout: [string, string] | null;
  /** Sections in construction sequence. */
  sections: string[];
  /** Areas or stages with their own layout submittals, offset in days from the section date. */
  areas?: Array<[string, number]>;
  /** Planned submit dates pinned to the equipment need dates in operations.ts. */
  pin?: Record<string, string>;
  /** Pinned histories where the register has to agree with the project record. */
  scripts?: Record<string, Round[]>;
}

const REGISTERS: RegisterSpec[] = [
  {
    projectId: "ehs-ed",
    seed: 2419,
    action: ["2025-05-05", "2026-12-18"],
    closeout: ["2027-05-03", "2027-07-02"],
    sections: ["concrete", "cfmf", "insulation", "firestop", "doors", "wooddoors", "sprinkler", "plumbing", "hydronic", "medgas", "ductwork", "hvacinsul", "vav", "fans", "conductors", "grounding", "panels", "firealarm", "pneumatic", "headwalls", "controls", "hardware", "gyp", "glazing", "casework", "lighting", "devices", "nursecall", "cabling", "access", "video", "diffusers", "fixtures", "ceilings", "wallprot", "cubicle", "flooring", "tile", "accessories", "signage", "paint", "tab"],
    areas: [["Stage 2", -45], ["Stage 3", 50], ["Stage 4", 130]],
    pin: { headwalls: "2026-05-11" },
    scripts: {
      // Headwall shop drawings went around three times before approval (eq-9).
      headwalls: [
        { submitted: "2026-03-02", returned: "2026-03-27", actions: ["D", "B"] },
        { submitted: "2026-04-20", returned: "2026-05-15", actions: ["C"] },
        { submitted: "2026-06-01", returned: "2026-06-19", actions: ["B"] },
      ],
      // Nurse call waits on the head-end decision in PCO-022.
      nursecall: [{ submitted: "2026-07-13", returned: "2026-08-10", actions: ["C", "D"] }],
    },
  },
  {
    projectId: "cmp-mri",
    seed: 2420,
    action: ["2026-06-01", "2026-10-30"],
    closeout: ["2027-01-18", "2027-02-12"],
    sections: ["imaging", "rfshield", "procchiller", "ductwork", "panels", "lighting", "ceilings", "flooring"],
    scripts: {
      imaging: [
        { submitted: "2026-06-01", returned: "2026-06-26", actions: ["B", "C"] },
        { submitted: "2026-07-13", returned: "2026-08-07", actions: ["A"] },
      ],
    },
  },
  {
    projectId: "hmc-l4",
    seed: 2421,
    action: ["2024-09-09", "2026-03-27"],
    closeout: ["2026-08-10", "2026-11-13"],
    sections: ["cfmf", "insulation", "firestop", "sprinkler", "plumbing", "hydronic", "medgas", "ductwork", "hvacinsul", "vav", "humidifiers", "conductors", "grounding", "orequip", "panels", "firealarm", "controls", "doors", "wooddoors", "hardware", "gyp", "glazing", "ceilings", "lighting", "devices", "nursecall", "cabling", "access", "casework", "diffusers", "fixtures", "wallprot", "cubicle", "flooring", "tile", "accessories", "signage", "paint", "tab"],
    areas: [["East", 0], ["West", 50]],
    pin: { orequip: "2026-02-09" },
  },
  {
    projectId: "nsrh-cup",
    seed: 2422,
    action: ["2026-10-16", "2026-11-30"],
    closeout: null,
    sections: ["chillers", "towers", "mvswgr"],
    // Chillers must be approved ahead of the early equipment release milestone.
    pin: { chillers: "2026-10-16" },
  },
  {
    projectId: "rmob-bh",
    seed: 2423,
    action: ["2025-03-24", "2025-12-19"],
    closeout: ["2026-05-04", "2026-08-28"],
    sections: ["cfmf", "firestop", "doors", "sprinkler", "plumbing", "ductwork", "vav", "panels", "firealarm", "controls", "hardware", "gyp", "lighting", "devices", "access", "ceilings", "casework", "wallprot", "accessories", "signage", "flooring", "paint", "tab"],
  },
  {
    projectId: "tdc-ups",
    seed: 2424,
    action: ["2025-08-04", "2026-10-23"],
    closeout: ["2027-01-11", "2027-02-26"],
    sections: ["mvswgr", "study", "grounding", "conductors", "lvswgr", "ups", "ats", "generator", "panels", "epms", "cleanagent", "firealarm", "access", "cabling"],
    pin: { mvswgr: "2025-09-15", generator: "2025-11-17" },
    scripts: {
      // Agrees with the "Switchgear submittals approved" milestone (actual Nov 7, 2025).
      mvswgr: [
        { submitted: "2025-08-04", returned: "2025-08-29", actions: ["D"] },
        { submitted: "2025-09-15", returned: "2025-10-06", actions: ["C"] },
        { submitted: "2025-10-20", returned: "2025-11-07", actions: ["B"] },
      ],
    },
  },
  {
    projectId: "scc-linac",
    seed: 2425,
    action: ["2025-09-01", "2026-10-02"],
    closeout: ["2026-11-16", "2027-01-08"],
    sections: ["concrete", "xrayshield", "imaging", "procchiller"],
  },
  {
    projectId: "kvsc-spd",
    seed: 2426,
    action: ["2027-01-11", "2027-03-26"],
    closeout: null,
    sections: ["ahu", "humidifiers", "lvswgr", "sterilizers"],
    pin: { sterilizers: "2027-04-05" },
  },
  {
    projectId: "lasc-or",
    seed: 2427,
    action: ["2025-08-11", "2026-10-30"],
    closeout: ["2026-11-30", "2027-01-08"],
    sections: ["earthwork", "concrete", "steel", "roofing", "curtainwall", "louvers", "insulation", "firestop", "sealants", "doors", "wooddoors", "sprinkler", "plumbing", "hydronic", "medgas", "ahu", "ductwork", "hvacinsul", "fans", "humidifiers", "controls", "conductors", "grounding", "panels", "lighting", "devices", "firealarm", "orequip", "hardware", "gyp", "glazing", "ceilings", "diffusers", "fixtures", "flooring", "tile", "accessories", "signage", "paint", "tab"],
    areas: [["Addition", 0], ["Existing tie-in", 45]],
    pin: { ahu: "2026-01-19" },
  },
];

/* ---------------------------------------------------------------------------
 * Review routing
 * ------------------------------------------------------------------------- */

const DESIGN_ORDER: Record<Discipline, string[]> = {
  arch: ["c-tessellate", "c-keelson", "c-bluecoast"],
  struct: ["c-bluecoast", "c-tessellate", "c-keelson"],
  mech: ["c-keelson", "c-tessellate", "c-bluecoast"],
  elec: ["c-keelson", "c-tessellate", "c-bluecoast"],
  fire: ["c-keelson", "c-tessellate", "c-bluecoast"],
  equip: ["c-tessellate", "c-keelson", "c-bluecoast"],
  dts: ["c-keelson", "c-tessellate", "c-bluecoast"],
};

const ROLE_OF: Record<string, string> = {
  "c-tessellate": "Architect of record",
  "c-keelson": "MEP engineer",
  "c-bluecoast": "Structural engineer",
  "c-cedarmark": "Commissioning authority",
  "c-meridian-eq": "Equipment planner",
};

/** The design and consultant firms on a project who can review submittals. */
export function reviewerFirms(p: Project): Party[] {
  return p.team
    .filter((t) => t.kind === "firm" && ROLE_OF[t.refId])
    .map((t) => ({ kind: "firm" as const, id: t.refId, role: t.role }));
}

export function ownerReviewer(p: Project): Party {
  return { kind: "staff", id: p.pmId, role: "Owner" };
}

/** Specialty consultant first, then the lead design reviewer, then the Owner. */
function routeFor(p: Project, spec: SectionSpec): Party[] {
  const firms = reviewerFirms(p);
  const has = (id: string) => firms.find((f) => f.id === id);
  const route: Party[] = [];
  if (spec.cx && has("c-cedarmark")) route.push(has("c-cedarmark")!);
  if (spec.disc === "equip" && has("c-meridian-eq")) route.push(has("c-meridian-eq")!);
  const lead = DESIGN_ORDER[spec.disc].map(has).find(Boolean);
  if (lead) route.push(lead);
  if (!route.length && firms[0]) route.push(firms[0]);
  if (spec.owner || !route.length) route.push(ownerReviewer(p));
  return route;
}

/* ---------------------------------------------------------------------------
 * Review comments
 * ------------------------------------------------------------------------- */

const COMMENTS: Record<"B" | "C" | "D", Record<Discipline, string[]>> = {
  B: {
    arch: ["Field-verify dimensions before fabrication.", "Provide the finish colors listed in the Owner’s finish schedule; see markups.", "Stainless fasteners required at wet locations as noted."],
    struct: ["Confirm embed locations with the coordinated MEP model before pour.", "Revise bar callouts on sheet 4 as marked; no resubmittal required.", "Special inspection required at noted connections."],
    mech: ["Coordinate access door locations with ceiling grid; see markups.", "Provide isolation valves at each branch as marked.", "Sound data acceptable; confirm unit weights for structural."],
    elec: ["Label circuits per the Owner’s naming standard as noted.", "Provide spare breakers noted on panel schedules.", "Coordinate conduit entry with structural; see markups."],
    fire: ["Relocate heads noted to clear light fixtures.", "Confirm device addresses with the Owner’s monitoring vendor."],
    equip: ["Confirm utility connections with the final vendor drawings; see markups.", "Owner Clinical Engineering to witness start-up."],
    dts: ["Match DTS naming standard for all devices as marked.", "Coordinate head-end location with DTS before rough-in."],
  },
  C: {
    arch: ["Dimensions conflict with the coordinated ceiling plan; revise and resubmit.", "Missing fire ratings on several assemblies; resubmit with UL listings.", "Infection-control rated product required in clean areas; revise and resubmit."],
    struct: ["Provide calculations stamped by a Washington-licensed engineer.", "Seismic anchorage not shown for overhead equipment; revise and resubmit.", "Connections do not match the design loads on S-501; revise."],
    mech: ["Duct routing conflicts with sprinkler mains in corridor B; recoordinate and resubmit.", "Unit capacities below scheduled values; revise selections.", "Provide pressure-independent valves as specified; resubmit."],
    elec: ["Available fault current exceeds the equipment rating; revise and resubmit.", "One-lines do not match the approved coordination study; revise.", "Provide seismic certification for all floor-mounted gear."],
    fire: ["Hydraulic calculations use the wrong water supply test; revise and resubmit.", "Battery calculations missing for NAC panels; resubmit."],
    equip: ["Rough-in dimensions do not match the room layouts; revise and resubmit.", "Provide vendor-stamped structural support loads; resubmit.", "Mock-up comments not incorporated; revise and resubmit."],
    dts: ["Device layout omits bays added by change order; revise and resubmit.", "Integration with the Owner’s head-end not demonstrated; resubmit."],
  },
  D: {
    arch: ["Product is not the basis of design and no substitution was requested; submit the specified item."],
    struct: ["Incomplete submittal: calculations missing; returned without review."],
    mech: ["Proposed manufacturer does not meet the specified efficiency; submit the specified item."],
    elec: ["Equipment does not meet the specified interrupting rating; submit compliant equipment."],
    fire: ["Submittal not from a licensed fire protection contractor; returned without review."],
    equip: ["Proposed model is not on the Owner’s clinical equipment standard; submit the specified item."],
    dts: ["Proposed system is not on the Owner’s DTS standard list; submit the specified system."],
  },
};

const RESPONSES = [
  "Revised per reviewer comments; changes clouded on all affected sheets.",
  "Resubmitted with the specified product and updated data sheets.",
  "Calculations stamped and added; dimensions recoordinated with the model.",
  "Comments incorporated; see response letter on the cover sheet.",
];

/* ---------------------------------------------------------------------------
 * Generation
 * ------------------------------------------------------------------------- */

const lerpDate = ([a, b]: [string, string], t: number) => addDays(a, Math.round(daysBetween(a, b) * t));

/** How a reviewer's pace compares to their share of the review period (1 = exactly on it). */
const PACE: Record<string, number> = { "c-keelson": 1.25, "c-bluecoast": 1.1, "c-tessellate": 0.9, "c-cedarmark": 0.85, "c-meridian-eq": 0.9 };

const CLOSES_ONLY: SubmittalType[] = ["Certificates", "Warranty"];

function drawAction(rnd: () => number, type: SubmittalType, rev: number): ReviewAction {
  const r = rnd();
  if (CLOSES_ONLY.includes(type)) return r < 0.7 ? "E" : r < 0.85 ? "B" : "C";
  if (rev > 0) return r < 0.46 ? "A" : r < 0.92 ? "B" : r < 0.98 ? "C" : "D";
  if (type === "O&M manual" || type === "Test reports") return r < 0.25 ? "A" : r < 0.65 ? "B" : r < 0.93 ? "C" : "D";
  return r < 0.3 ? "A" : r < 0.74 ? "B" : r < 0.93 ? "C" : "D";
}

function pick<T>(rnd: () => number, xs: T[]): T {
  return xs[Math.floor(rnd() * xs.length) % xs.length]!;
}

const quiet = (a: ReviewAction) => (a === "A" ? "No exceptions taken." : a === "E" ? "Received for the record." : "");

function build(): { subs: Submittal[]; pkgs: SubmittalPackage[] } {
  const subs: Submittal[] = [];
  const pkgs: SubmittalPackage[] = [];

  for (const reg of REGISTERS) {
    const p = projectById(reg.projectId)!;
    const rnd = seeded(reg.seed);
    const n = reg.sections.length;
    let pkgSeq = 0;

    // Each section contributes an action wave and, where it has one, a closeout wave.
    const waves = reg.sections.flatMap((key, i) => {
      const spec = LIB[key]!;
      const t = n > 1 ? i / (n - 1) : 0;
      const split = reg.areas && spec.areaItem !== undefined;
      const numbered = spec.items.map((it, j) => ({ it, seq: j + 1 })).filter((_, j) => !split || j !== spec.areaItem);
      const action = numbered.filter((x) => x.it[2] !== "closeout");
      const closeout = numbered.filter((x) => x.it[2] === "closeout");
      const planned = reg.pin?.[key] ?? lerpDate(reg.action, t);
      // Layout drawings go in once per area, on that area's schedule.
      const areaWaves = split
        ? reg.areas!.map(([name, offset], k) => {
            const [title, type] = spec.items[spec.areaItem!]!;
            const it: [string, SubmittalType] = [`${title} — ${name}`, type];
            return { key, spec, items: [{ it, seq: k === 0 ? spec.areaItem! + 1 : spec.items.length + k }], planned: addDays(planned, offset), closeout: false };
          })
        : [];
      return [
        { key, spec, items: action, planned, closeout: false },
        ...areaWaves,
        ...(closeout.length && reg.closeout ? [{ key, spec, items: closeout, planned: lerpDate(reg.closeout, t), closeout: true }] : []),
      ].filter((w) => w.items.length);
    });
    waves.sort((a, b) => a.planned.localeCompare(b.planned));

    for (const w of waves) {
      const route = routeFor(p, w.spec);
      const byId = w.spec.by === "gc" ? p.gcId : w.spec.by;
      const reviewDays = Math.max(...w.items.map((x) => REVIEW_DAYS[x.it[1]]));
      const records = w.items.map(({ it: [title, type], seq }) => {
        const lead = w.closeout ? 0 : w.spec.lead;
        const days = REVIEW_DAYS[type];
        const s: Submittal = {
          id: `${p.id}:${w.spec.section.replace(/\s/g, "")}-${seq}`,
          projectId: p.id,
          section: w.spec.section,
          sectionTitle: w.spec.title,
          seq,
          title,
          type,
          byId,
          requiredOnSite: addDays(w.planned, days + scheduleAllowance(lead, days) + lead * 7),
          leadWeeks: lead,
          reviewDays: days,
          reviewers: route,
          revisions: [],
        };
        subs.push(s);
        return s;
      });

      const script = !w.closeout ? reg.scripts?.[w.key] : undefined;
      // Contractors run late on about a third of packages.
      const late = rnd() < 0.34 ? 5 + Math.round(rnd() * 45) : Math.round(rnd() * 6) - 3;
      let date = script?.[0]?.submitted ?? addDays(w.planned, late);
      let live = records;
      let round = 0;

      while (live.length && date <= TODAY) {
        pkgSeq++;
        const pkgId = `${p.id}:sp-${pkgSeq}`;
        const s0 = script?.[round];
        const due = addDays(date, reviewDays);
        const allot = stepAllotments(route, reviewDays);
        // Days each reviewer holds the package this round; items travel together.
        let held = route.map((party, i) => Math.max(1, Math.round(allot[i]! * (PACE[party.id] ?? 1) * (0.5 + rnd() * 0.75) * (rnd() < 0.16 ? 1.7 + rnd() : 1))));
        if (s0?.returned) {
          const total = daysBetween(date, s0.returned);
          const sum = held.reduce((a, b) => a + b, 0);
          held = held.map((h) => Math.max(1, Math.round((h / sum) * total)));
          held[held.length - 1] = Math.max(1, total - held.slice(0, -1).reduce((a, b) => a + b, 0));
        }
        const stepDates = held.map((_, i) => addDays(date, held.slice(0, i + 1).reduce((a, b) => a + b, 0)));
        const returned = s0 && !s0.returned ? undefined : stepDates[stepDates.length - 1]!;
        const done = returned !== undefined && returned <= TODAY;

        pkgs.push({
          id: pkgId,
          number: `SP-${String(pkgSeq).padStart(3, "0")}`,
          projectId: p.id,
          title: `${w.spec.section} ${w.spec.title}${w.closeout ? " — closeout" : ""}${round ? ` — resubmittal ${round}` : ""}`,
          created: addDays(date, -2),
          transmitted: date,
          reviewDays,
          items: live.map((s) => ({ submittalId: s.id, rev: round, response: round ? pick(rnd, RESPONSES) : undefined })),
          reviewers: route,
          note: round ? "Resubmitted with responses to review comments." : w.closeout ? "Closeout documentation for review and record." : "",
          byId,
        });
        const pkg = pkgs[pkgs.length - 1]!;

        const next: Submittal[] = [];
        live.forEach((s, k) => {
          const rev: Revision = { rev: round, packageId: pkgId, submitted: date, due, steps: [], response: pkg.items[k]!.response };
          const action = s0?.actions?.[k] ?? drawAction(rnd, s.type, round);
          // The lead design reviewer usually stamps the governing action; the Owner sometimes does.
          const leadIdx = Math.max(0, route.findIndex((r) => r.kind === "firm" && r.id !== "c-cedarmark" && r.id !== "c-meridian-eq"));
          const stamper = route[route.length - 1]!.kind === "staff" && rnd() < 0.25 ? route.length - 1 : leadIdx;
          rev.steps = route.map((party, i) => {
            if (stepDates[i]! > TODAY) return { party };
            const a: ReviewAction = i === stamper ? action : action === "E" ? "E" : rnd() < 0.55 ? "A" : "B";
            return { party, action: a, date: stepDates[i]!, comments: quiet(a) || pick(rnd, COMMENTS[a as "B" | "C" | "D"][w.spec.disc]) };
          });
          if (done) {
            rev.returned = returned;
            rev.action = rev.steps.reduce<ReviewAction>((g, st) => (REVIEW_ACTIONS[st.action!].severity > REVIEW_ACTIONS[g].severity ? st.action! : g), "E");
            if (!REVIEW_ACTIONS[rev.action].closes) next.push(s);
          }
          s.revisions.push(rev);
        });

        if (!done) break;
        live = next;
        round++;
        // A script that stops early leaves its rejected items waiting on the contractor.
        if (script && !script[round]) break;
        date = script?.[round]?.submitted ?? addDays(returned!, 12 + Math.round(rnd() * (rnd() < 0.3 ? 40 : 20)));
      }
    }
  }

  return { subs, pkgs };
}

const BUILT = build();

export const SUBMITTALS: Submittal[] = BUILT.subs;
export const SUBMITTAL_PACKAGES: SubmittalPackage[] = BUILT.pkgs;

/** Projects that keep a submittal register (design-phase backfills start one at CD issue). */
export const REGISTER_PROJECT_IDS: string[] = REGISTERS.map((r) => r.projectId);
