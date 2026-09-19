/** Starter schedules: the Owner's typical sequence for each kind of capital
 *  project, logic-linked and ready to adjust. Durations are working days. */

import type { Archetype } from "@/mock/projects";
import type { SpecAct, SpecWbs } from "./build";

export interface Template {
  id: string;
  name: string;
  about: string;
  archetype: Archetype | null;
  spec: SpecWbs[];
}

/** One construction phase in an occupied building: barriers, demo, rough-in, close-in, finishes, test, turnover. */
function phase(n: number, label: string, after: string, equipment?: string): SpecWbs {
  const b = 1100 + n * 100;
  const c = (k: number) => `A${b + k * 10}`;
  const acts: SpecAct[] = [
    { c: c(0), n: `${label}: ICRA barriers and temporary protection`, d: 5, p: after, resp: "General contractor" },
    { c: c(1), n: `${label}: demolition`, d: 10, p: c(0) },
    { c: c(2), n: `${label}: above-ceiling MEP rough-in`, d: 25, p: c(1) },
    { c: c(3), n: `${label}: framing and in-wall rough-in`, d: 20, p: `${c(2)}SS+10` },
    { c: c(4), n: `${label}: above-ceiling inspection`, d: 3, p: `${c(2)}, ${c(3)}`, resp: "Authority having jurisdiction" },
    { c: c(5), n: `${label}: drywall, ceilings, and finishes`, d: 25, p: c(4) },
    { c: c(6), n: `${label}: equipment and headwall install`, d: 10, p: `${c(5)}SS+15${equipment ? `, ${equipment}` : ""}` },
    { c: c(7), n: `${label}: TAB, commissioning, and ICRA clearance`, d: 10, p: `${c(5)}, ${c(6)}`, resp: "Commissioning agent" },
    { c: c(8), n: `${label}: AHJ and DOH inspection`, d: 5, p: c(7), resp: "Authority having jurisdiction" },
    { c: c(9), n: `${label} turnover`, d: 0, t: "finish", p: c(8) },
  ];
  return { code: String(n + 2), name: label, acts };
}

export const TEMPLATES: Template[] = [
  {
    id: "phased-reno",
    name: "Phased renovation in an occupied hospital",
    about: "Design, permit, and procurement, then two phases of ICRA-controlled work with inspections and turnover, then closeout. For ED, inpatient, and OR fit-outs.",
    archetype: "fitout",
    spec: [
      {
        code: "1",
        name: "Preconstruction",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Construction documents", d: 40, p: "A1000", resp: "Architect" },
          { c: "A1020", n: "Permit review", d: 30, p: "A1010", resp: "Authority having jurisdiction" },
          { c: "A1030", n: "Permit issued", d: 0, t: "finish", p: "A1020" },
          { c: "A1040", n: "GMP and contract award", d: 10, p: "A1010", resp: "Owner" },
        ],
      },
      {
        code: "2",
        name: "Procurement",
        acts: [
          { c: "A1100", n: "Shop drawings and submittals", d: 20, p: "A1040", resp: "General contractor" },
          { c: "A1110", n: "Long-lead equipment fabrication and delivery", d: 60, p: "A1100", resp: "Vendor" },
          { c: "A1120", n: "ICRA plan and Infection Prevention approval", d: 10, p: "A1040", resp: "Owner" },
        ],
      },
      phase(1, "Phase 1", "A1030, A1120", "A1110"),
      phase(2, "Phase 2", "A1290"),
      {
        code: "5",
        name: "Closeout",
        acts: [
          { c: "A1500", n: "Substantial completion", d: 0, t: "finish", p: "A1390" },
          { c: "A1510", n: "Punch list and corrections", d: 15, p: "A1500", resp: "General contractor" },
          { c: "A1520", n: "Owner move-in and clinical activation", d: 10, p: "A1500", resp: "Owner" },
          { c: "A1530", n: "Closeout documents, O&M manuals, and training", d: 20, p: "A1500", resp: "General contractor" },
          { c: "A1540", n: "Final completion", d: 0, t: "finish", p: "A1510, A1520, A1530" },
        ],
      },
    ],
  },
  {
    id: "equipment",
    name: "Major medical equipment replacement",
    about: "Vendor selection, site readiness design and permit, fabrication, room prep, delivery and rigging, vendor install, acceptance testing, accreditation, and first patient. For MRI, CT, linacs, and cath labs.",
    archetype: "equipment",
    spec: [
      {
        code: "1",
        name: "Planning and design",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Vendor selection and purchase order", d: 20, p: "A1000", resp: "Owner" },
          { c: "A1020", n: "Site readiness drawings", d: 30, p: "A1010", resp: "Architect" },
          { c: "A1030", n: "Permit review", d: 25, p: "A1020", resp: "Authority having jurisdiction" },
          { c: "A1040", n: "Service diversion and downtime plan", d: 10, p: "A1020", resp: "Owner" },
        ],
      },
      {
        code: "2",
        name: "Procurement",
        acts: [
          { c: "A1100", n: "Equipment fabrication", d: 90, p: "A1010", resp: "Vendor" },
          { c: "A1110", n: "Rigging plan and crane permit", d: 15, p: "A1020", resp: "General contractor" },
        ],
      },
      {
        code: "3",
        name: "Room preparation",
        acts: [
          { c: "A1200", n: "Decommission and remove existing equipment", d: 10, p: "A1030, A1040", resp: "Vendor" },
          { c: "A1210", n: "Structural, shielding, and pit work", d: 20, p: "A1200" },
          { c: "A1220", n: "MEP rough-in and dedicated chiller", d: 20, p: "A1210SS+5" },
          { c: "A1230", n: "Finishes and RF or radiation shielding test", d: 15, p: "A1210, A1220" },
        ],
      },
      {
        code: "4",
        name: "Installation and acceptance",
        acts: [
          { c: "A1300", n: "Equipment delivery", d: 0, t: "finish", p: "A1100, A1110, A1230", resp: "Vendor" },
          { c: "A1310", n: "Rigging and set", d: 3, p: "A1300" },
          { c: "A1320", n: "Vendor installation", d: 20, p: "A1310", resp: "Vendor" },
          { c: "A1330", n: "Calibration and acceptance testing", d: 15, p: "A1320", resp: "Physicist" },
          { c: "A1340", n: "Staff applications training", d: 5, p: "A1330", resp: "Vendor" },
          { c: "A1350", n: "Accreditation and state registration", d: 10, p: "A1330", resp: "Owner" },
          { c: "A1360", n: "First patient", d: 0, t: "finish", p: "A1340, A1350" },
        ],
      },
    ],
  },
  {
    id: "infrastructure",
    name: "Central plant or infrastructure upgrade",
    about: "Schematic, design development, and construction documents with an early equipment release, then utility work, installation, cutover windows, and commissioning. For chillers, boilers, switchgear, and UPS.",
    archetype: "infrastructure",
    spec: [
      {
        code: "1",
        name: "Design",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Schematic design", d: 60, p: "A1000", resp: "Engineer" },
          { c: "A1020", n: "Design development", d: 80, p: "A1010", resp: "Engineer" },
          { c: "A1030", n: "Construction documents", d: 90, p: "A1020", resp: "Engineer" },
          { c: "A1040", n: "Permit review", d: 40, p: "A1030", resp: "Authority having jurisdiction" },
        ],
      },
      {
        code: "2",
        name: "Procurement",
        acts: [
          { c: "A1100", n: "Early equipment release", d: 0, t: "finish", p: "A1020", resp: "Owner" },
          { c: "A1110", n: "Major equipment fabrication", d: 120, p: "A1100", resp: "Vendor" },
          { c: "A1120", n: "Utility service application and upgrade", d: 150, p: "A1020", resp: "Utility" },
        ],
      },
      {
        code: "3",
        name: "Construction",
        acts: [
          { c: "A1200", n: "Enabling work and temporary services", d: 30, p: "A1040" },
          { c: "A1210", n: "Structure and housekeeping pads", d: 40, p: "A1200" },
          { c: "A1220", n: "Equipment set", d: 15, p: "A1210, A1110" },
          { c: "A1230", n: "Piping, electrical, and controls", d: 60, p: "A1220SS+5" },
          { c: "A1240", n: "Startup and functional testing", d: 20, p: "A1230, A1120", resp: "Commissioning agent" },
        ],
      },
      {
        code: "4",
        name: "Cutover and commissioning",
        acts: [
          { c: "A1300", n: "Method of procedure approved", d: 10, p: "A1240", resp: "Owner" },
          { c: "A1310", n: "Plant cutover", d: 0, t: "finish", p: "A1300" },
          { c: "A1320", n: "Integrated systems test", d: 10, p: "A1310", resp: "Commissioning agent" },
          { c: "A1330", n: "Decommission legacy equipment", d: 20, p: "A1320" },
          { c: "A1340", n: "Final completion", d: 0, t: "finish", p: "A1330" },
        ],
      },
    ],
  },
  {
    id: "clinic-ti",
    name: "Clinic or office tenant improvement",
    about: "Program, design, permit, and bid, then a single build-out with low-voltage, furniture, IT, and move-in. For medical office and administrative space.",
    archetype: "office",
    spec: [
      {
        code: "1",
        name: "Design and permit",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Program confirmation", d: 15, p: "A1000", resp: "Owner" },
          { c: "A1020", n: "Design and construction documents", d: 50, p: "A1010", resp: "Architect" },
          { c: "A1030", n: "Permit review", d: 35, p: "A1020", resp: "Authority having jurisdiction" },
          { c: "A1040", n: "Bid and award", d: 20, p: "A1020", resp: "Owner" },
          { c: "A1050", n: "Permit issued", d: 0, t: "finish", p: "A1030" },
        ],
      },
      {
        code: "2",
        name: "Construction",
        acts: [
          { c: "A1100", n: "Demolition and layout", d: 10, p: "A1040, A1050" },
          { c: "A1110", n: "Framing and MEP rough-in", d: 30, p: "A1100" },
          { c: "A1120", n: "Inspections and close-in", d: 5, p: "A1110", resp: "Authority having jurisdiction" },
          { c: "A1130", n: "Finishes", d: 25, p: "A1120" },
          { c: "A1140", n: "Low-voltage and IT build-out", d: 15, p: "A1130SS+10", resp: "DTS" },
          { c: "A1150", n: "Certificate of occupancy", d: 0, t: "finish", p: "A1130, A1140" },
        ],
      },
      {
        code: "3",
        name: "Furniture and move-in",
        acts: [
          { c: "A1200", n: "Furniture order and lead time", d: 40, p: "A1040", resp: "Vendor" },
          { c: "A1210", n: "Furniture install", d: 10, p: "A1150, A1200" },
          { c: "A1220", n: "Move-in", d: 5, p: "A1210", resp: "Owner" },
          { c: "A1230", n: "Move-in complete", d: 0, t: "finish", p: "A1220" },
        ],
      },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
