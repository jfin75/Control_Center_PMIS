/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  RFI logs for projects in construction, procurement, and closeout. Each log
 *  is drawn from a question library and the project's RFI window, then played
 *  forward to TODAY: the contractor issues, the design team (or the Owner)
 *  answers, and the Owner's PM closes. A few RFIs are pinned so the log agrees
 *  with the change orders and PCOs on the project record. */

import { seeded } from "@/lib/budget";
import { addDays, daysBetween } from "@/lib/format";
import { TODAY } from "./org";
import { projectById, type Project } from "./projects";

export type RfiDiscipline =
  | "Architectural"
  | "Structural"
  | "Civil"
  | "Mechanical"
  | "Plumbing"
  | "Fire protection"
  | "Electrical"
  | "Medical equipment"
  | "DTS";

export const DISCIPLINES: RfiDiscipline[] = ["Architectural", "Structural", "Civil", "Mechanical", "Plumbing", "Fire protection", "Electrical", "Medical equipment", "DTS"];

export type RfiPriority = "urgent" | "high" | "normal" | "low";

/** Requested response time by priority, in calendar days (Division 01). */
export const PRIORITIES: Record<RfiPriority, { label: string; days: number; tone: "neg" | "warn" | "neutral" }> = {
  urgent: { label: "Urgent", days: 2, tone: "neg" },
  high: { label: "High", days: 4, tone: "warn" },
  normal: { label: "Normal", days: 7, tone: "neutral" },
  low: { label: "Low", days: 14, tone: "neutral" },
};
export const PRIORITY_ORDER: RfiPriority[] = ["urgent", "high", "normal", "low"];

export type ImpactLevel = "none" | "possible" | "yes";
export const IMPACT_LABEL: Record<ImpactLevel, string> = { none: "None", possible: "Possible", yes: "Confirmed" };

export interface Who {
  kind: "firm" | "staff";
  id: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  added: string;
  by: Who;
  /** True when the file itself is kept in this browser; seeded records are metadata only. */
  stored: boolean;
}

export type EntryKind =
  | "issue"
  | "response"
  | "forward"
  | "request"
  | "clarify"
  | "comment"
  | "files"
  | "return"
  | "close"
  | "reopen"
  | "void"
  | "restore"
  | "edit";

export interface Entry {
  id: string;
  kind: EntryKind;
  date: string;
  by: Who;
  text?: string;
  /** Responses only: the answer of record, which the Owner closes against. */
  official?: boolean;
  /** Forward, reopen, and return: who holds the ball next. */
  to?: Who;
  files?: Attachment[];
}

export interface Rfi {
  id: string;
  projectId: string;
  seq: number;
  subject: string;
  question: string;
  /** The contractor's proposed answer, if they offered one. */
  suggestion?: string;
  discipline: RfiDiscipline;
  section?: string;
  drawing?: string;
  location?: string;
  /** Originating firm: the GC, or the prime contractor on a single-prime job. */
  fromId: string;
  /** Owner staff who manages the RFI and closes it. */
  managerId: string;
  /** Reviewer who owes the answer. */
  assignee: Who;
  distribution: Who[];
  priority: RfiPriority;
  created: string;
  /** Null while a draft. */
  issued: string | null;
  /** Response due; resets when the RFI is reopened or the contractor answers a request for information. */
  due: string | null;
  status: "draft" | "open" | "closed" | "void";
  /** While open and unanswered: who holds the ball. */
  awaiting: "reviewer" | "originator";
  closed: string | null;
  costImpact: ImpactLevel;
  costEstimate: number | null;
  scheduleImpact: ImpactLevel;
  scheduleDays: number | null;
  /** PCO or change order that carries the cost. */
  changeRef?: string;
  /** Attachments on the question itself. */
  files: Attachment[];
  entries: Entry[];
}

export const rfiNumber = (r: Pick<Rfi, "seq">) => `RFI-${String(r.seq).padStart(3, "0")}`;

/* ---------------------------------------------------------------------------
 * Question library
 * ------------------------------------------------------------------------- */

interface Template {
  d: RfiDiscipline;
  subject: string;
  q: string;
  s?: string;
  a: string;
  dwg: string;
  sec?: string;
  /** Chance this question carries a cost impact. */
  cost?: number;
  /** The Owner answers, not the design team. */
  owner?: boolean;
  /** Limit to projects of these archetypes. */
  only?: Project["archetype"][];
}

const LIB: Template[] = [
  // Architectural
  { d: "Architectural", subject: "Ceiling height conflict at {loc}", q: "Ductwork and sprinkler mains below the existing structure leave 8'-4\" clear at {loc}. The reflected ceiling plan calls for 9'-0\". Confirm a lowered ceiling is acceptable or advise routing.", s: "Hold the ceiling at 8'-6\" in this area only.", a: "Lower the ceiling to 8'-6\" at {loc} only and hold 9'-0\" elsewhere. Revised ceiling plan sketch {sk} attached.", dwg: "A-201", sec: "09 51 13", cost: 0.15 },
  { d: "Architectural", subject: "Door swing conflicts with casework at {loc}", q: "The door at {loc} swings into the base cabinet shown on the enlarged plan and cannot open past 70°. Confirm a revised swing or a casework shift.", s: "Reverse the door swing; hardware set unchanged.", a: "Reverse the swing as proposed. The hardware set is unchanged; the door schedule will be updated in the next bulletin. No cost impact anticipated.", dwg: "A-501", sec: "08 11 13" },
  { d: "Architectural", subject: "Untagged partition at {loc}", q: "The partition between {loc} and the adjacent corridor has no wall type tag. Confirm the wall type and whether it is smoke- or fire-rated.", a: "Provide type 4A (one-hour, full height to deck). The corridor wall is rated; see the revised life safety plan LS-101 in {sk}.", dwg: "A-101", sec: "09 21 16", cost: 0.2 },
  { d: "Architectural", subject: "Flooring transition to existing terrazzo at {loc}", q: "New sheet vinyl meets existing terrazzo at {loc} with a 3/8\" height difference. Detail 5/A-601 assumes a flush condition. Provide the transition requirement.", s: "Feather with cementitious underlayment over 36\".", a: "Feather as proposed; no transition strip in patient care areas. Maximum slope 1:20.", dwg: "A-601", sec: "09 65 16" },
  { d: "Architectural", subject: "Headwall frame backing at {loc}", q: "The prefabricated headwall frame needs 20\" stud spacing, but the wall type calls for 16\" on center. Confirm an acceptable backing approach at {loc}.", a: "Keep 16\" studs and use the manufacturer's adapter channels. Manufacturer's letter attached.", dwg: "A-521", sec: "11 73 00", only: ["fitout"] },
  { d: "Architectural", subject: "Crash rail mounting height at {loc}", q: "The specification calls for crash rail at 32\" AFF; the Owner's standard detail shows 34\". Confirm the height at {loc}.", a: "The Owner's standard governs: 34\" AFF to the top of rail throughout.", dwg: "A-701", sec: "10 26 00", owner: true },
  { d: "Architectural", subject: "Missing head detail at new glazing, {loc}", q: "No head detail is provided where the new glazing meets the existing brick at {loc}. Provide the flashing and sealant detail.", a: "See detail {sk}: through-wall flashing lapped under the existing counterflashing, backer rod and silicone sealant.", dwg: "A-401", sec: "08 44 13", cost: 0.25 },
  { d: "Architectural", subject: "Damaged fireproofing at existing column, {loc}", q: "Spray fireproofing on the existing column at {loc} is damaged below the ceiling. Confirm the enclosure finish and whether fireproofing repair is in the contract.", a: "Repair fireproofing to match the listed design, enclose with type 1 furring, and paint P-2. Submit a price for the fireproofing repair.", dwg: "A-102", sec: "07 81 00", cost: 0.6 },
  { d: "Architectural", subject: "Access panels in hard-lid ceiling at {loc}", q: "VAV boxes and fire dampers above the gypsum ceiling at {loc} need access panels that are not shown on the ceiling plan. Confirm locations and sizes.", a: "Provide 24x24 access panels at each VAV and damper, located per the attached markup. Use gasketed panels in clean areas.", dwg: "A-201", sec: "08 31 13" },
  { d: "Architectural", subject: "Anti-ligature fixture backing at {loc}", q: "Anti-ligature fixtures at {loc} need solid backing for through-bolting, but the wall is shown as 25-gauge metal stud. Confirm wall construction.", a: "Provide 3/4\" fire-retardant plywood backing full height and 20-gauge studs at 12\" on center; through-bolt all fixtures.", dwg: "A-541", sec: "10 28 00", cost: 0.35, only: ["fitout", "office"] },
  { d: "Architectural", subject: "Suspect material behind wall finish at {loc}", q: "Demolition at {loc} exposed a mastic under the existing wall base that is not in the hazardous materials survey. Confirm how to proceed.", a: "Stop work in the area. The Owner's abatement consultant will sample within 48 hours; proceed around the area per the revised sequence.", dwg: "A-100", cost: 0.45, owner: true },
  // Structural and civil
  { d: "Structural", subject: "Embed plate conflicts with conduit at {loc}", q: "Embed EP-4 at {loc} conflicts with the conduit bank on E-301. Confirm whether the embed can shift 6\".", a: "Shift the embed up to 6\" east and keep 4\" edge distance. Revised plan {sk} attached.", dwg: "S-201", sec: "05 50 00" },
  { d: "Structural", subject: "Existing slab thinner than shown at {loc}", q: "A core at {loc} shows a 4-1/2\" slab where the drawings assume 6\". Confirm the design of the new post-installed anchors.", a: "Use the revised anchor schedule on {sk}: reduce embedment and add a second anchor per plate. Special inspection is required.", dwg: "S-101", sec: "03 30 00", cost: 0.3 },
  { d: "Structural", subject: "Seismic bracing attachment at {loc}", q: "Bracing for overhead equipment at {loc} lands on bar joists at mid-span. Confirm acceptable attachment points.", a: "Attach at joist panel points only; add L2x2 struts where a brace falls between panel points. See {sk}.", dwg: "S-501", sec: "05 40 00", cost: 0.2 },
  { d: "Structural", subject: "Beam web penetration for exhaust duct at {loc}", q: "A 14\" round exhaust duct must pass through the W18 beam at {loc}. Confirm whether a web penetration with reinforcement is acceptable.", a: "Acceptable at mid-depth within the middle third of the span. Provide reinforcing plates per detail 7/S-502.", dwg: "S-502", sec: "05 12 00", cost: 0.15 },
  { d: "Civil", subject: "Unsuitable soils at footing, {loc}", q: "Excavation at {loc} found soft organic silts 3' below design bearing. Advise on over-excavation.", a: "Over-excavate to competent native soil and replace with controlled density fill; the geotechnical engineer will observe. Track quantities for the unit-price adjustment.", dwg: "S-001", sec: "31 23 00", cost: 0.8, only: ["fitout"] },
  { d: "Civil", subject: "Storm connection invert at {loc}", q: "The existing storm main at {loc} is 1'-2\" higher than the survey shows; the new lateral cannot reach it at minimum slope. Advise.", a: "Connect at the new manhole shown on {sk}; minimum slope 1% is acceptable for this run.", dwg: "C-301", sec: "33 41 00", cost: 0.5, only: ["fitout"] },
  { d: "Structural", subject: "Shielding wall cold joint at {loc}", q: "The shielding design assumes monolithic wall pours, but the pump cannot reach the north wall at {loc} in one placement. Confirm an acceptable cold joint and keyway.", a: "A stepped cold joint at 8'-0\" with the staggered keyway on {sk} is acceptable to the physicist. No straight-through joints.", dwg: "S-301", sec: "13 49 13", only: ["equipment"] },
  // Mechanical
  { d: "Mechanical", subject: "Supply main routing conflict at {loc}", q: "The 24x14 supply main at {loc} conflicts with the sprinkler main and the beam line. No route holds both the ceiling height and the duct size shown.", s: "Split into two 18x10 ducts.", a: "Split as proposed with equal free area and keep velocity under 1,500 fpm. See {sk}.", dwg: "M-201", sec: "23 31 13" },
  { d: "Mechanical", subject: "Room pressure relationship at {loc}", q: "The pressure schedule shows {loc} positive to the corridor, but the airflow schedule has exhaust exceeding supply. Confirm the intended relationship.", a: "The room is negative. Revise to 450 cfm supply and 600 cfm exhaust; revised schedule attached.", dwg: "M-601", sec: "23 36 00", cost: 0.25 },
  { d: "Mechanical", subject: "Existing lined ductwork at {loc}", q: "Existing ductwork to be reused at {loc} is internally lined and shows microbial growth at two joints. Confirm scope.", a: "Remove the lined section and replace with unlined galvanized duct with external insulation. Price as a change.", dwg: "M-101", sec: "23 31 13", cost: 0.85 },
  { d: "Mechanical", subject: "Humidifier absorption distance at {loc}", q: "The AHU humidifier dispersion panel needs 36\" of absorption; only 24\" exists before the first fitting at {loc}. Confirm.", a: "Provide the manufacturer's short-absorption dispersion panel; capacity unchanged.", dwg: "M-501", sec: "23 84 13" },
  { d: "Mechanical", subject: "Exhaust fan too close to outside air intake, {loc}", q: "The roof exhaust fan above {loc} is 12' from the outside air intake; code requires 25'. Confirm relocation.", a: "Relocate the fan as shown on {sk}, extend the duct, and add a curb. Submit pricing.", dwg: "M-401", sec: "23 34 00", cost: 0.7 },
  { d: "Mechanical", subject: "Setback sequence in procedure rooms, {loc}", q: "Sequence 4 calls for unoccupied setback at {loc}, but the Owner's standard requires constant volume in procedure rooms. Confirm.", a: "Constant volume governs in procedure rooms; setback applies to support spaces only.", dwg: "M-701", sec: "23 09 23", owner: true },
  { d: "Mechanical", subject: "Chilled water tap for process chiller backup, {loc}", q: "The equipment vendor requires a chilled water backup to the process chiller at {loc}; the drawings show none. Confirm tap location and valving.", a: "Tap the 4\" chilled water main at the location on {sk} with a three-way valve and flow meter.", dwg: "M-301", sec: "23 21 13", cost: 0.55, only: ["equipment", "infrastructure"] },
  // Plumbing
  { d: "Plumbing", subject: "Medical gas outlet count at {loc}", q: "The headwall elevation at {loc} shows two oxygen, two vacuum, and one medical air; the med gas plan shows one of each. Confirm quantities.", a: "Provide two O2, two VAC, and one MA per the headwall elevation. The plan will be corrected by bulletin.", dwg: "P-301", sec: "22 63 00", cost: 0.3, only: ["fitout"] },
  { d: "Plumbing", subject: "Floor drain at slab high point, {loc}", q: "The existing slab at {loc} slopes away from the new floor drain. Confirm whether to relocate the drain or build up with topping.", a: "Relocate the drain 3'-0\" north to the low point; saw-cut and patch per detail 4/P-501.", dwg: "P-201", sec: "22 13 16", cost: 0.35 },
  { d: "Plumbing", subject: "Domestic water shutdown for tie-in at {loc}", q: "The tie-in to the existing 4\" domestic main at {loc} needs a shutdown that affects the adjacent unit. Request an approved window and the notice required.", a: "Facilities approves a four-hour window, Saturday 0200–0600, with 10 working days' notice. Coordinate with the unit manager.", dwg: "P-101", sec: "22 11 16", owner: true },
  { d: "Plumbing", subject: "Hand sink too close to clean supply at {loc}", q: "The hand sink at {loc} conflicts with the casework run; moving it puts it within 3' of the clean supply shelving. Confirm with Infection Prevention.", a: "Infection Prevention accepts the relocation with a 24\" splash guard on the supply side.", dwg: "P-401", sec: "22 42 00", owner: true },
  // Fire protection
  { d: "Fire protection", subject: "Sprinkler obstruction at soffit, {loc}", q: "The soffit at {loc} obstructs the heads under the beam rule. Confirm whether to add heads below the soffit.", a: "Add heads below the soffit. Revise the hydraulic calculations and resubmit the affected sheet.", dwg: "FP-201", sec: "21 13 13", cost: 0.4 },
  { d: "Fire protection", subject: "No access to fire damper above {loc}", q: "The fire damper in the rated wall above {loc} has no access; the gypsum ceiling is continuous. Confirm the access method.", a: "Provide a 24x24 rated access panel in the ceiling; see markup.", dwg: "FP-301", sec: "23 33 00" },
  { d: "Fire protection", subject: "Detector bypass inside ICRA barrier, {loc}", q: "Existing smoke detectors at {loc} are inside the ICRA barrier and will alarm during demolition. Confirm the bypass procedure.", a: "The Owner's fire alarm vendor will bypass devices during work hours with a fire watch. Request 48 hours ahead.", dwg: "FA-101", sec: "28 46 21", owner: true },
  // Electrical
  { d: "Electrical", subject: "Panel conflicts with new door frame at {loc}", q: "Panel 4LA at {loc} conflicts with the new door frame. Confirm relocating it 4'-0\" south.", a: "Relocate as proposed and keep NEC 110.26 working clearance.", dwg: "E-201", sec: "26 24 16" },
  { d: "Electrical", subject: "Headwall receptacle count at {loc}", q: "The headwall elevation at {loc} shows eight receptacles per bed; the power plan shows six. Confirm quantity and branch assignment.", a: "Provide eight: four critical branch (red) and four normal. Revised circuiting on {sk}.", dwg: "E-401", sec: "26 27 26", cost: 0.3, only: ["fitout"] },
  { d: "Electrical", subject: "Existing feeder at capacity, {loc}", q: "Field measurement shows the existing feeder serving {loc} at 82% before the new load. Confirm whether a new feeder is required.", a: "Provide a new 225A feeder from switchboard MSB-2, routed per {sk}. Submit pricing.", dwg: "E-601", sec: "26 05 19", cost: 0.85 },
  { d: "Electrical", subject: "Discontinued luminaire type L7 at {loc}", q: "Luminaire type L7 has been discontinued. The proposed substitute matches output but is a 2x4 housing in place of 2x2.", a: "The 2x4 substitute is not acceptable in the 2x2 grid. Provide the manufacturer's replacement series in 2x2; data attached.", dwg: "E-301", sec: "26 51 00" },
  { d: "Electrical", subject: "No emergency lighting on egress path at {loc}", q: "The egress path through {loc} shows no emergency luminaires. Confirm.", a: "Circuit two type L2 fixtures to the life safety branch; see the revised plan.", dwg: "E-301", sec: "26 51 00", cost: 0.2 },
  { d: "Electrical", subject: "Switchgear pad too short, {loc}", q: "The approved switchgear shop drawings need a 14'-6\" pad; the drawings show 13'-0\" at {loc}. Confirm the pad extension and doweling.", a: "Extend the pad per {sk}; dowel #5 bars at 12\" into the existing pad.", dwg: "E-501", sec: "26 13 26", cost: 0.5, only: ["equipment", "infrastructure"] },
  { d: "Electrical", subject: "Generator feeder crosses storm line, {loc}", q: "The underground generator feeder route at {loc} crosses the existing storm line at the same elevation. Confirm.", a: "Route over the storm line with 12\" separation in concrete encasement; see {sk}.", dwg: "E-701", sec: "26 32 13", cost: 0.5, only: ["equipment", "infrastructure"] },
  { d: "Electrical", subject: "Battery room hydrogen ventilation, {loc}", q: "The battery manufacturer requires 150 cfm of hydrogen ventilation at {loc}; the mechanical plan shows 90 cfm.", a: "Increase exhaust to 150 cfm and resize the fan per the attached schedule.", dwg: "M-201", sec: "26 33 53", cost: 0.3, only: ["equipment"] },
  // Medical equipment
  { d: "Medical equipment", subject: "Vendor utility requirements changed for {loc}", q: "The vendor's final site plan for {loc} shows a 100A disconnect where the drawings show 60A and adds chilled water connections. Confirm.", a: "The vendor's final requirements govern. Upsize the disconnect and feeder and add chilled water per the vendor drawing. Price as a change.", dwg: "E-401", sec: "11 77 00", cost: 0.7, only: ["equipment", "fitout"] },
  { d: "Medical equipment", subject: "Boom mounting plate misses support grid, {loc}", q: "The surgical boom mounting plate at {loc} does not align with the unistrut grid. Confirm the support modification.", a: "Add a bridging frame per {sk}; the boom vendor confirms loads before installation.", dwg: "S-601", sec: "11 76 00", cost: 0.3, only: ["fitout"] },
  { d: "Medical equipment", subject: "Owner-furnished equipment templates for {loc}", q: "Delivery of Owner-furnished equipment for {loc} is not confirmed, and rough-in cannot close without final templates.", a: "Delivery is confirmed for six weeks out; final templates attached.", dwg: "Q-101", sec: "11 71 00", owner: true },
  // DTS
  { d: "DTS", subject: "Telecom room smaller than DTS standard, {loc}", q: "The telecom room serving {loc} is 8'x10'; the Owner's DTS standard requires 10'x12' for this floor area.", a: "DTS accepts 8'x10' with wall-mounted racks per the attached layout.", dwg: "T-101", sec: "27 10 00", owner: true },
  { d: "DTS", subject: "Card reader not on security plan, {loc}", q: "The hardware schedule shows a card reader at {loc}, but the security plan does not. Confirm.", a: "Provide the reader and add it to the security plan. The Owner's security vendor terminates.", dwg: "T-301", sec: "28 13 00", cost: 0.2 },
  { d: "DTS", subject: "Wireless access point density in {loc}", q: "The DTS standard requires one WAP per 2,500 sf; the plan for {loc} shows one per 4,000 sf. Confirm.", a: "Add WAPs per the attached layout. Cabling is in the contract; devices are Owner-furnished.", dwg: "T-201", sec: "27 10 00", cost: 0.4, owner: true },
  { d: "DTS", subject: "Pillow speaker jacks at {loc}", q: "Nurse call pillow speaker jacks are shown on both sides of the bed at {loc}; the Owner's standard is one per bed. Confirm.", a: "One per bed, on the headwall side.", dwg: "T-401", sec: "27 52 23", owner: true, only: ["fitout"] },
];

/* ---------------------------------------------------------------------------
 * Project logs
 * ------------------------------------------------------------------------- */

interface Script {
  subject: string;
  question: string;
  suggestion?: string;
  answer: string;
  discipline: RfiDiscipline;
  section?: string;
  drawing: string;
  location: string;
  priority: RfiPriority;
  owner?: boolean;
  issued: string;
  answered?: string;
  closed?: string;
  cost: [ImpactLevel, number | null];
  schedule?: [ImpactLevel, number | null];
  changeRef?: string;
}

interface LogSpec {
  projectId: string;
  seed: number;
  count: number;
  /** First and last issue dates for generated RFIs. */
  window: [string, string];
  weights: Partial<Record<RfiDiscipline, number>>;
  locations: string[];
  drafts: number;
  /** Pinned RFIs that tie to change orders and PCOs on the project record. */
  scripts?: Script[];
}

const LOGS: LogSpec[] = [
  {
    projectId: "ehs-ed",
    seed: 3101,
    count: 175,
    window: ["2025-07-14", TODAY],
    weights: { Architectural: 5, Structural: 1, Mechanical: 3, Plumbing: 2, "Fire protection": 1.5, Electrical: 2.5, "Medical equipment": 1, DTS: 1.5 },
    locations: ["Bay 4", "Bay 7", "Bay 12", "rapid triage", "safe room 3", "corridor B", "nurse station 2", "the soiled utility room", "the ambulance entry", "the decon room", "Stage 2 core"],
    drafts: 2,
    scripts: [
      {
        subject: "Missing seismic bracing details at Stage 1 soffits",
        question: "The drawings show new gypsum soffits at the Stage 1 triage zone with no lateral bracing details, and the ceiling specification requires engineered bracing. Provide the bracing design.",
        answer: "Bracing details were omitted from the construction documents. Provide diagonal bracing and compression posts per the attached {sk}. Price as a change; this is an architect's omission.",
        discipline: "Architectural",
        section: "09 22 16",
        drawing: "A-521",
        location: "rapid triage",
        priority: "high",
        issued: "2026-05-18",
        answered: "2026-06-01",
        closed: "2026-06-05",
        cost: ["yes", 95_000],
        schedule: ["yes", 6],
        changeRef: "CO #3",
      },
      {
        subject: "Nurse call head-end compatibility with new devices",
        question: "The specified nurse call devices are not compatible with the existing head-end, which the manufacturer has placed at end of life. Confirm whether to upgrade the head-end or match the legacy devices.",
        answer: "Upgrade the head-end to the current platform per the DTS standard. Legacy-compatible devices are not acceptable. Submit pricing; the Owner will carry it as PCO-022.",
        discipline: "DTS",
        section: "27 52 23",
        drawing: "T-401",
        location: "nurse station 2",
        priority: "high",
        owner: true,
        issued: "2026-08-03",
        answered: "2026-08-24",
        closed: "2026-09-08",
        cost: ["yes", 64_000],
        schedule: ["possible", 14],
        changeRef: "PCO-022",
      },
      {
        subject: "Suspect asbestos in Stage 2 plaster soffits",
        question: "Demolition in the Stage 2 core found a textured plaster on the soffits that is not in the hazardous materials survey. Work is stopped in the area. Advise.",
        answer: "Samples came back positive. The Owner's abatement contractor will remove the soffits under containment; the GC resequences Stage 2 around the area. This is a latent condition, carried as PCO-021.",
        discipline: "Architectural",
        drawing: "A-100",
        location: "Stage 2 core",
        priority: "urgent",
        owner: true,
        issued: "2026-08-21",
        answered: "2026-08-26",
        closed: "2026-09-02",
        cost: ["yes", 138_500],
        schedule: ["yes", 10],
        changeRef: "PCO-021",
      },
    ],
  },
  {
    projectId: "cmp-mri",
    seed: 3102,
    count: 26,
    window: ["2026-05-18", TODAY],
    weights: { Architectural: 2, Structural: 1, Mechanical: 2, Electrical: 2, "Medical equipment": 3 },
    locations: ["the magnet room", "the MRI equipment room", "the control room", "patient prep", "the quench pipe route"],
    drafts: 1,
    scripts: [
      {
        subject: "Magnet delivery path through curtain wall",
        question: "The rigging plan for the new magnet needs two curtain wall panels removed on the east elevation. Confirm the Owner accepts removal and reinstallation, and who carries the cost.",
        answer: "The Owner accepts. Remove and reinstall the panels with new gaskets and weather-protect overnight. Carried as PCO-002.",
        discipline: "Architectural",
        section: "08 44 13",
        drawing: "A-401",
        location: "the magnet room",
        priority: "high",
        owner: true,
        issued: "2026-08-10",
        answered: "2026-08-19",
        closed: "2026-08-28",
        cost: ["yes", 28_500],
        changeRef: "PCO-002",
      },
    ],
  },
  {
    projectId: "hmc-l4",
    seed: 3103,
    count: 250,
    window: ["2024-10-21", TODAY],
    weights: { Architectural: 4, Structural: 1, Mechanical: 3.5, Plumbing: 2, "Fire protection": 1.5, Electrical: 3, "Medical equipment": 1.5, DTS: 1 },
    locations: ["OR 3", "OR 5", "OR 7", "PACU", "the sterile core", "the east corridor", "the west corridor", "the anesthesia workroom", "the clean elevator lobby"],
    drafts: 1,
    scripts: [
      {
        subject: "OR 7 integration pre-wire",
        question: "The Owner's new OR integration vendor needs pathways and pre-wire in OR 7 that are not in the documents. Confirm scope before the ceiling closes.",
        answer: "Add pathways and pre-wire per the integration vendor's attached layout. This is an Owner change, carried as PCO-031.",
        discipline: "DTS",
        section: "27 10 00",
        drawing: "T-201",
        location: "OR 7",
        priority: "high",
        owner: true,
        issued: "2026-08-17",
        answered: "2026-08-28",
        closed: "2026-08-30",
        cost: ["yes", 41_000],
        changeRef: "PCO-031",
      },
    ],
  },
  {
    projectId: "rmob-bh",
    seed: 3104,
    count: 88,
    window: ["2025-02-10", "2026-07-24"],
    weights: { Architectural: 5, Mechanical: 2, Plumbing: 1, "Fire protection": 1, Electrical: 2, DTS: 1 },
    locations: ["group room 5.12", "the seclusion room", "the nurse station", "the staff lounge", "the Suite 520 corridor", "intake"],
    drafts: 0,
  },
  {
    projectId: "tdc-ups",
    seed: 3105,
    count: 72,
    window: ["2025-08-25", TODAY],
    weights: { Structural: 1, Mechanical: 1.5, Electrical: 6, "Fire protection": 1, DTS: 1 },
    locations: ["UPS room A", "UPS room B", "the switchgear room", "the generator yard", "the battery room", "the main electrical room"],
    drafts: 1,
    scripts: [
      {
        subject: "Temporary generator through the switchgear delay",
        question: "The medium-voltage switchgear factory slot has slipped 17 weeks. Confirm whether the Owner wants the temporary generator kept through March or a phased cutover on the existing gear.",
        answer: "",
        discipline: "Electrical",
        section: "26 32 13",
        drawing: "E-701",
        location: "the generator yard",
        priority: "urgent",
        owner: true,
        issued: "2026-08-24",
        cost: ["possible", 96_000],
        schedule: ["possible", 0],
        changeRef: "PCO-011",
      },
    ],
  },
  {
    projectId: "scc-linac",
    seed: 3106,
    count: 92,
    window: ["2025-05-12", TODAY],
    weights: { Architectural: 1.5, Structural: 4, Mechanical: 1.5, Electrical: 2, "Medical equipment": 3 },
    locations: ["the vault maze", "the vault roof", "the control room", "the mechanical room", "the linac vault", "the conduit trench"],
    drafts: 1,
    scripts: [
      {
        subject: "Shielding density at the vault roof",
        question: "Placement records for the vault roof show density below the shielding design in two trucks. Confirm whether cores are required before the equipment set.",
        answer: "Take six cores at the locations on {sk} for density testing; the physicist reviews results before the equipment set. The specified density acceptance criteria were unclear, carried as PCO-014.",
        discipline: "Structural",
        section: "13 49 13",
        drawing: "S-301",
        location: "the vault roof",
        priority: "urgent",
        issued: "2026-08-12",
        answered: "2026-08-26",
        cost: ["yes", 34_000],
        schedule: ["possible", 10],
        changeRef: "PCO-014",
      },
    ],
  },
  {
    projectId: "lasc-or",
    seed: 3107,
    count: 150,
    window: ["2025-10-06", TODAY],
    weights: { Architectural: 4, Structural: 2, Civil: 1.5, Mechanical: 3, Plumbing: 1.5, "Fire protection": 1, Electrical: 2.5, "Medical equipment": 1 },
    locations: ["OR 5", "OR 6", "the sterile corridor", "the existing tie-in", "the roof at gridline D", "the mechanical yard", "pre-op bay 4"],
    drafts: 2,
  },
];

/* ---------------------------------------------------------------------------
 * Who answers what
 * ------------------------------------------------------------------------- */

const LEAD: Record<RfiDiscipline, string[]> = {
  Architectural: ["c-tessellate"],
  Structural: ["c-bluecoast", "c-tessellate"],
  Civil: ["c-bluecoast", "c-tessellate"],
  Mechanical: ["c-keelson", "c-tessellate"],
  Plumbing: ["c-keelson", "c-tessellate"],
  "Fire protection": ["c-keelson", "c-tessellate"],
  Electrical: ["c-keelson", "c-tessellate"],
  "Medical equipment": ["c-meridian-eq", "c-tessellate"],
  DTS: ["c-keelson", "c-tessellate"],
};

const DESIGN_FIRMS = new Set(["c-tessellate", "c-keelson", "c-bluecoast", "c-cedarmark", "c-meridian-eq"]);

/** Design team and consultants on a project who can answer RFIs. */
export function designTeam(p: Project): Who[] {
  return p.team.filter((t) => t.kind === "firm" && DESIGN_FIRMS.has(t.refId)).map((t) => ({ kind: "firm" as const, id: t.refId }));
}

/** The reviewer an RFI goes to by default: the lead design firm for its discipline, or the Owner's PM. */
export function defaultAssignee(p: Project, d: RfiDiscipline, owner = false): Who {
  if (owner) return { kind: "staff", id: p.pmId };
  const team = designTeam(p);
  const hit = LEAD[d].find((id) => team.some((t) => t.id === id)) ?? team[0]?.id;
  return hit ? { kind: "firm", id: hit } : { kind: "staff", id: p.pmId };
}

/** Projects that keep an RFI log. */
export const RFI_PROJECT_IDS: string[] = LOGS.map((l) => l.projectId);

/* ---------------------------------------------------------------------------
 * Generation
 * ------------------------------------------------------------------------- */

/** How a reviewer's pace compares to the requested response time (1 = exactly on it). */
const PACE: Record<string, number> = { "c-keelson": 1.35, "c-tessellate": 0.95, "c-bluecoast": 1.05, "c-cedarmark": 0.8, "c-meridian-eq": 1.1 };
const STAFF_PACE = 0.75;

const COMMENTS = [
  "Field-verified; the conflict is confirmed. Photo attached.",
  "We need an answer by the end of the week to hold ceiling close-in in this area.",
  "Infection Prevention wants to see the answer before work proceeds.",
  "Trade is holding rough-in here pending the response.",
  "Discussed at the OAC meeting; the design team will respond this week.",
  "Cost controller copied: this may carry a change.",
  "Walked this with the inspector; no concerns with the proposed approach.",
];
const FORWARD = ["Forwarding to our engineer for response.", "This is an MEP question; forwarding for the engineer's answer.", "Forwarding; the consultant owns this detail."];
const REQUEST = [
  "Provide a field sketch with dimensions to the nearest gridlines.",
  "Please attach photos of the existing condition before we respond.",
  "Confirm which revision of the shop drawings this refers to.",
];
const CLARIFY = ["Sketch and dimensions attached.", "Photos of the existing condition attached; see markup.", "This refers to the approved Rev 1 shop drawings."];
const RETURN = ["The response doesn't address the conflict at the beam line. Please revise.", "The Owner needs a cost-neutral option before accepting this answer."];
const CLOSE_NOTE = ["", "", "Answer incorporated in the next bulletin.", "Closed; no further action.", "Resolved in the field per the response."];

const JPG = "image/jpeg";
const PDF = "application/pdf";

function pick<T>(rnd: () => number, xs: T[]): T {
  return xs[Math.floor(rnd() * xs.length) % xs.length]!;
}

function pickWeighted<T extends string>(rnd: () => number, w: Partial<Record<T, number>>): T {
  const entries = Object.entries(w) as Array<[T, number]>;
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let x = rnd() * total;
  for (const [k, v] of entries) {
    x -= v;
    if (x <= 0) return k;
  }
  return entries[entries.length - 1]![0];
}

const fill = (s: string, loc: string, sk: string) => s.replace(/\{loc\}/g, loc).replace(/\{sk\}/g, sk);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function build(): Rfi[] {
  const out: Rfi[] = [];

  for (const log of LOGS) {
    const p = projectById(log.projectId)!;
    const rnd = seeded(log.seed);
    const pm: Who = { kind: "staff", id: p.pmId };
    const gc: Who = { kind: "firm", id: p.gcId };
    const field = p.team.find((t) => t.kind === "staff" && /field/i.test(t.role));
    const controller = p.team.find((t) => t.kind === "staff" && /cost/i.test(t.role));
    const templates = LIB.filter((t) => !t.only || t.only.includes(p.archetype));
    const used = new Set<string>();
    let sk = 0;
    let fileSeq = 0;
    const att = (name: string, type: string, size: number, added: string, by: Who): Attachment => ({ id: `${p.id}:f${++fileSeq}`, name, type, size, added, by, stored: false });
    const sketch = (dwg: string) => `SK-${dwg.split("-")[0]}-${String(++sk).padStart(3, "0")}`;

    // Generated issue dates: steady on active jobs, busiest mid-window on finished ones.
    const span = daysBetween(log.window[0], log.window[1]);
    const active = log.window[1] === TODAY;
    const dates = Array.from({ length: log.count }, () => {
      const t = active || rnd() < 0.45 ? rnd() : (rnd() + rnd()) / 2;
      return addDays(log.window[0], Math.round(span * t));
    });
    const plan: Array<{ issued: string; script?: Script }> = [...dates.map((issued) => ({ issued })), ...(log.scripts ?? []).map((s) => ({ issued: s.issued, script: s }))];
    plan.sort((a, b) => a.issued.localeCompare(b.issued));

    plan.forEach(({ issued, script }, i) => {
      const seq = i + 1;
      let tpl: Template;
      let loc: string;
      if (script) {
        tpl = { d: script.discipline, subject: script.subject, q: script.question, s: script.suggestion, a: script.answer, dwg: script.drawing, sec: script.section, owner: script.owner };
        loc = script.location;
      } else {
        const d = pickWeighted(rnd, log.weights);
        const pool = templates.filter((t) => t.d === d);
        tpl = pick(rnd, pool.length ? pool : templates);
        loc = pick(rnd, log.locations);
        for (let k = 0; k < 10 && used.has(tpl.subject + loc); k++) {
          tpl = pick(rnd, pool.length ? pool : templates);
          loc = pick(rnd, log.locations);
        }
      }
      used.add(tpl.subject + loc);

      const priority: RfiPriority = script?.priority ?? (rnd() < 0.07 ? "urgent" : rnd() < 0.24 ? "high" : rnd() < 0.9 ? "normal" : "low");
      const first = defaultAssignee(p, tpl.d, tpl.owner);
      const sk0 = tpl.a.includes("{sk}") ? sketch(tpl.dwg) : "";
      const answer = fill(tpl.a, loc, sk0);
      const r: Rfi = {
        id: `${p.id}:rfi-${seq}`,
        projectId: p.id,
        seq,
        subject: cap(fill(tpl.subject, loc, "")),
        question: fill(tpl.q, loc, ""),
        suggestion: tpl.s,
        discipline: tpl.d,
        section: tpl.sec,
        drawing: tpl.dwg,
        location: cap(loc.replace(/^the /, "")),
        fromId: p.gcId,
        managerId: p.pmId,
        assignee: first,
        distribution: [gc, first, pm, ...(field ? [{ kind: "staff" as const, id: field.refId }] : [])].filter((w, j, xs) => xs.findIndex((x) => x.id === w.id) === j),
        priority,
        created: addDays(issued, -Math.round(rnd() * 2)),
        issued,
        due: addDays(issued, PRIORITIES[priority].days),
        status: "open",
        awaiting: "reviewer",
        closed: null,
        costImpact: "none",
        costEstimate: null,
        scheduleImpact: "none",
        scheduleDays: null,
        files: [],
        entries: [],
      };
      const e = (kind: EntryKind, date: string, by: Who, extra: Partial<Entry> = {}): Entry => ({ id: `${r.id}:e${r.entries.length + 1}`, kind, date, by, ...extra });

      if (rnd() < 0.55 || script) r.files.push(att(`IMG_${4000 + Math.floor(rnd() * 5000)}.jpg`, JPG, Math.round(1.1e6 + rnd() * 2.6e6), issued, gc));
      if (rnd() < 0.35) r.files.push(att(`${tpl.dwg} markup.pdf`, PDF, Math.round(1.8e5 + rnd() * 1.3e6), issued, gc));
      r.entries.push(e("issue", issued, gc, { to: first }));

      // Play the RFI forward: forwards, requests for information, and the answer.
      let ball = first;
      let since = issued;
      let due = r.due!;
      const pace = (w: Who) => (w.kind === "staff" ? STAFF_PACE : (PACE[w.id] ?? 1));
      const hold = (w: Who) => Math.max(1, Math.round(PRIORITIES[priority].days * pace(w) * (0.45 + rnd() * 1.0) * (rnd() < 0.18 ? 2 + rnd() * 2 : 1)));

      if (!script && ball.id === "c-tessellate" && rnd() < 0.22) {
        const others = designTeam(p).filter((w) => w.id !== "c-tessellate" && w.id !== "c-meridian-eq");
        const to = others.length ? pick(rnd, others) : null;
        const on = addDays(since, 1 + Math.floor(rnd() * 2));
        if (to && on <= TODAY) {
          r.entries.push(e("forward", on, ball, { to, text: pick(rnd, FORWARD) }));
          ball = to;
          r.assignee = to;
          if (!r.distribution.some((w) => w.id === to.id)) r.distribution.push(to);
        }
      }

      if (!script && rnd() < (daysBetween(issued, TODAY) < 21 ? 0.25 : 0.12)) {
        const on = addDays(since, Math.max(1, Math.round(hold(ball) / 2)));
        if (on <= TODAY) {
          r.entries.push(e("request", on, ball, { text: pick(rnd, REQUEST) }));
          r.awaiting = "originator";
          const back = addDays(on, 2 + Math.floor(rnd() * 8));
          if (back > TODAY) {
            out.push(finish(r, due, undefined, tpl, rnd, controller?.refId));
            return;
          }
          r.entries.push(e("clarify", back, gc, { text: pick(rnd, CLARIFY), files: rnd() < 0.6 ? [att(`IMG_${4000 + Math.floor(rnd() * 5000)}.jpg`, JPG, Math.round(1.2e6 + rnd() * 2.4e6), back, gc)] : undefined }));
          r.awaiting = "reviewer";
          since = back;
          due = addDays(back, PRIORITIES[priority].days);
        }
      }

      if (!script && rnd() < 0.3) {
        const on = addDays(issued, 1 + Math.floor(rnd() * 3));
        const by = rnd() < 0.6 ? gc : pick(rnd, [pm, ...(field ? [{ kind: "staff" as const, id: field.refId }] : [])]);
        if (on <= TODAY) r.entries.push(e("comment", on, by, { text: pick(rnd, COMMENTS) }));
      }

      const answered = script ? script.answered : addDays(since, hold(ball));
      if (!answered || answered > TODAY) {
        out.push(finish(r, due, script, tpl, rnd, controller?.refId));
        return;
      }
      r.entries.push(e("response", answered, ball, { text: answer, official: true, files: sk0 ? [att(`${sk0}.pdf`, PDF, Math.round(1.2e5 + rnd() * 6e5), answered, ball)] : undefined }));

      // Now and then the Owner sends an answer back before accepting it.
      let answeredAt = answered;
      if (!script && rnd() < 0.05) {
        const on = addDays(answered, 1 + Math.floor(rnd() * 3));
        const again = addDays(on, 2 + Math.floor(rnd() * 5));
        if (again <= TODAY) {
          r.entries.push(e("return", on, pm, { to: ball, text: pick(rnd, RETURN) }));
          r.entries.push(e("response", again, ball, { text: `Revised: ${answer}`, official: true }));
          answeredAt = again;
        }
      }

      const closeOn = script ? script.closed : addDays(answeredAt, 1 + Math.round(rnd() * (rnd() < 0.2 ? 24 : 8)));
      const closes = !!closeOn && closeOn <= TODAY && (script || daysBetween(answeredAt, TODAY) > 45 || rnd() < 0.9);
      if (closes) {
        r.status = "closed";
        r.closed = closeOn!;
        const note = pick(rnd, CLOSE_NOTE);
        r.entries.push(e("close", closeOn!, pm, note ? { text: note } : {}));
      }

      // Voids: a duplicate or a question the field resolved on its own.
      if (!script && r.status === "closed" && rnd() < 0.03) {
        r.status = "void";
        r.entries = r.entries.slice(0, 1);
        r.closed = addDays(issued, 2);
        r.entries.push(e("void", r.closed, pm, { text: rnd() < 0.5 ? "Duplicate of an earlier RFI." : "Withdrawn by the contractor; resolved in the field." }));
      }

      out.push(finish(r, due, script, tpl, rnd, controller?.refId));
    });

    // Drafts the GC has started but not issued.
    for (let k = 0; k < log.drafts; k++) {
      const d = pickWeighted(rnd, log.weights);
      const pool = templates.filter((t) => t.d === d);
      const tpl = pick(rnd, pool.length ? pool : templates);
      const loc = pick(rnd, log.locations);
      const seq = plan.length + k + 1;
      const created = addDays(TODAY, -Math.floor(rnd() * 4));
      const first = defaultAssignee(p, tpl.d, tpl.owner);
      out.push({
        id: `${p.id}:rfi-${seq}`,
        projectId: p.id,
        seq,
        subject: cap(fill(tpl.subject, loc, "")),
        question: fill(tpl.q, loc, ""),
        suggestion: tpl.s,
        discipline: tpl.d,
        section: tpl.sec,
        drawing: tpl.dwg,
        location: cap(loc.replace(/^the /, "")),
        fromId: p.gcId,
        managerId: p.pmId,
        assignee: first,
        distribution: [gc, first, pm],
        priority: "normal",
        created,
        issued: null,
        due: null,
        status: "draft",
        awaiting: "reviewer",
        closed: null,
        costImpact: "none",
        costEstimate: null,
        scheduleImpact: "none",
        scheduleDays: null,
        files: [],
        entries: [],
      });
    }
  }

  return out;

  /** Apply due dates and impacts once the history is played out. */
  function finish(r: Rfi, due: string, script?: Script, tpl?: Template, rnd?: () => number, controllerId?: string): Rfi {
    r.due = due;
    if (script) {
      [r.costImpact, r.costEstimate] = script.cost;
      [r.scheduleImpact, r.scheduleDays] = script.schedule ?? ["none", null];
      r.changeRef = script.changeRef;
    } else if (tpl?.cost && rnd && r.status !== "void" && rnd() < tpl.cost * 0.5) {
      const est = Math.round((4_000 + rnd() * rnd() * 110_000) / 500) * 500;
      // Most flagged RFIs that closed were answered at no cost; the rest wait on a PCO.
      const level: ImpactLevel = r.status === "closed" ? (rnd() < 0.12 ? "yes" : "none") : "possible";
      r.costImpact = level;
      r.costEstimate = level === "none" ? null : est;
      if (level !== "none" && rnd() < 0.35) {
        r.scheduleImpact = level;
        r.scheduleDays = 2 + Math.floor(rnd() * 12);
      }
    }
    if (r.costImpact !== "none" && controllerId && !r.distribution.some((w) => w.id === controllerId)) r.distribution.push({ kind: "staff", id: controllerId });
    return r;
  }
}

export const RFIS: Rfi[] = build();
