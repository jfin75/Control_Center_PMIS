/** SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 *  Contractor schedule updates for four projects, as if imported from their
 *  monthly P6 submissions. Each spec's durations are fit so its key milestones
 *  land on the baseline and forecast dates in the project record
 *  (src/mock/projects.ts), and progress is statused as planned up to each
 *  update's data date. */

import { fitMilestones, fromSpec, durations, type Frame, type SpecWbs } from "@/lib/schedule/build";
import { CALENDAR_PRESETS, type CalendarPreset } from "@/lib/schedule/calendar";
import { compute, progressAsPlanned } from "@/lib/schedule/cpm";
import type { Schedule, Source } from "@/lib/schedule/types";
import { projectById } from "./projects";

interface Update {
  id: string;
  name: string;
  dataDate: string;
  source: Source;
  /** Latest update only: durations set before fitting to the project record, by activity ID. */
  set?: Record<string, number>;
  /** Older updates: working days added to the latest update's fitted durations. */
  delta?: Record<string, number>;
  /** Activities this update doesn't have yet. */
  skip?: string[];
}

interface Seed {
  projectId: string;
  start: string;
  calendar: CalendarPreset;
  deadline: string;
  baselineName: string;
  /** Activities added after the baseline: they carry no baseline dates. */
  added?: string[];
  spec: SpecWbs[];
  /** Newest first. The first is fit to the project record's forecasts. */
  updates: Update[];
}

const GC = "General contractor";

const SEEDS: Seed[] = [
  {
    projectId: "ehs-ed",
    start: "2024-11-04",
    calendar: "5day",
    deadline: "2027-06-30",
    baselineName: "Contract baseline (GMP Amendment 1)",
    added: ["A1325"],
    spec: [
      {
        code: "1",
        name: "Design and permitting",
        acts: [
          { c: "A1000", n: "Notice to proceed, construction documents", d: 0, t: "start" },
          { c: "A1010", n: "Construction documents", d: 90, p: "A1000", resp: "Tessellate Architecture" },
          { c: "A1020", n: "Construction documents complete", d: 0, t: "finish", p: "A1010", key: "Construction documents complete" },
          { c: "A1030", n: "Permit review, City of Bellevue", d: 35, p: "A1020", resp: "City of Bellevue" },
          { c: "A1040", n: "Permit issued", d: 0, t: "finish", p: "A1030", key: "Permit issued" },
          { c: "A1050", n: "GMP amendment negotiated and executed", d: 15, p: "A1020", resp: "Harrow & Finch Contractors" },
          { c: "A1060", n: "Construction notice to proceed", d: 0, t: "start", p: "A1040, A1050", cons: { type: "SNET", date: "2025-06-02" } },
        ],
      },
      {
        code: "2",
        name: "Procurement",
        acts: [
          { c: "A1100", n: "Submittals: headwalls, med gas, nurse call", d: 25, p: "A1050", resp: "Harrow & Finch Contractors" },
          { c: "A1110", n: "Fabricate and deliver patient headwalls", d: 70, p: "A1100", resp: "Headwall manufacturer" },
          { c: "A1120", n: "Nurse call equipment lead time", d: 60, p: "A1100", resp: "Brightwater Electric" },
          { c: "A1130", n: "ICRA plan and Infection Prevention approval", d: 10, p: "A1050", resp: "Owner" },
        ],
      },
      {
        code: "3",
        name: "Stage 1: rapid triage",
        acts: [
          { c: "A1200", n: "Stage 1 mobilize and ICRA barriers", d: 15, p: "A1060, A1130", resp: GC },
          { c: "A1210", n: "Stage 1 demolition", d: 20, p: "A1200", resp: GC },
          { c: "A1220", n: "Stage 1 above-ceiling MEP rough-in", d: 70, p: "A1210", resp: "Graystone Mechanical" },
          { c: "A1230", n: "Stage 1 framing and in-wall rough-in", d: 50, p: "A1220SS+15", resp: GC },
          { c: "A1240", n: "Stage 1 drywall, ceilings, and finishes", d: 75, p: "A1220, A1230", resp: "Summit Crest Interiors" },
          { c: "A1250", n: "Stage 1 headwalls and equipment", d: 20, p: "A1240SS+40, A1110", resp: GC },
          { c: "A1260", n: "Stage 1 TAB, commissioning, and DOH inspection", d: 20, p: "A1240, A1250", resp: "Cedarmark Commissioning" },
          { c: "A1270", n: "Stage 1 turnover (triage)", d: 0, t: "finish", p: "A1260", key: "Stage 1 turnover (triage)" },
        ],
      },
      {
        code: "4",
        name: "Stage 2: bays 1–9",
        acts: [
          { c: "A1300", n: "Stage 2 relocate ED operations and ICRA barriers", d: 10, p: "A1270", resp: GC },
          { c: "A1310", n: "Stage 2 demolition", d: 15, p: "A1300", resp: GC },
          { c: "A1320", n: "Stage 2 hazardous material abatement", d: 10, p: "A1310", resp: "Abatement subcontractor" },
          {
            c: "A1325",
            n: "Stage 2 supplemental destructive survey, plaster soffits",
            d: 3,
            p: "A1310",
            cons: { type: "SNET", date: "2026-09-22" },
            resp: "Environmental consultant",
            notes: "Added in Update 15 after asbestos was found in the Stage 2 plaster soffits (PCO-021).",
          },
          { c: "A1330", n: "Stage 2 above-ceiling MEP rough-in", d: 40, p: "A1320", resp: "Graystone Mechanical" },
          { c: "A1340", n: "Stage 2 framing and in-wall rough-in", d: 30, p: "A1330SS+10", resp: GC },
          { c: "A1350", n: "Stage 2 above-ceiling inspection", d: 3, p: "A1330, A1340", resp: "City of Bellevue" },
          { c: "A1360", n: "Stage 2 drywall, ceilings, and finishes", d: 40, p: "A1350", resp: "Summit Crest Interiors" },
          { c: "A1370", n: "Stage 2 headwalls and equipment", d: 15, p: "A1360SS+20", resp: GC },
          { c: "A1380", n: "Stage 2 TAB, commissioning, and DOH inspection", d: 15, p: "A1360, A1370, A1325", resp: "Cedarmark Commissioning" },
          { c: "A1390", n: "Stage 2 turnover (bays 1–9)", d: 0, t: "finish", p: "A1380", key: "Stage 2 turnover (bays 1–9)" },
        ],
      },
      {
        code: "5",
        name: "Stage 3: bays 10–18",
        acts: [
          { c: "A1400", n: "Stage 3 ICRA barriers", d: 10, p: "A1390", resp: GC },
          { c: "A1410", n: "Stage 3 demolition", d: 15, p: "A1400", resp: GC },
          { c: "A1420", n: "Stage 3 above-ceiling MEP rough-in", d: 35, p: "A1410", resp: "Graystone Mechanical" },
          { c: "A1430", n: "Stage 3 framing and in-wall rough-in", d: 25, p: "A1420SS+10", resp: GC },
          { c: "A1440", n: "Stage 3 drywall, ceilings, and finishes", d: 30, p: "A1420, A1430", resp: "Summit Crest Interiors" },
          { c: "A1450", n: "Negative-pressure conversion, bays 12–14", d: 10, p: "A1440SS+10", resp: "Graystone Mechanical", notes: "PCO-018, priced and pending approval." },
          { c: "A1460", n: "Stage 3 headwalls and equipment", d: 15, p: "A1440SS+15", resp: GC },
          { c: "A1470", n: "Stage 3 TAB, commissioning, and DOH inspection", d: 15, p: "A1440, A1450, A1460", resp: "Cedarmark Commissioning" },
          { c: "A1480", n: "Stage 3 turnover (bays 10–18)", d: 0, t: "finish", p: "A1470", key: "Stage 3 turnover (bays 10–18)" },
        ],
      },
      {
        code: "6",
        name: "Stage 4: safe rooms and closeout",
        acts: [
          { c: "A1500", n: "Behavioral health safe room suite build-out", d: 45, p: "A1390", resp: GC },
          { c: "A1510", n: "Safe room anchoring, DOH review", d: 10, p: "A1500", resp: "Washington DOH" },
          { c: "A1515", n: "Stage 4 exam rooms and nurse station", d: 40, p: "A1480", resp: GC },
          { c: "A1520", n: "Final AHJ and DOH inspections", d: 20, p: "A1515, A1510", resp: "Washington DOH" },
          { c: "A1530", n: "Substantial completion", d: 0, t: "finish", p: "A1520", key: "Substantial completion" },
          { c: "A1540", n: "Punch list and corrections", d: 15, p: "A1530", resp: GC },
          { c: "A1550", n: "Owner move-in and clinical activation", d: 20, p: "A1530", resp: "Owner" },
          { c: "A1560", n: "Final completion and occupancy", d: 0, t: "finish", p: "A1540, A1550", key: "Final completion & occupancy" },
        ],
      },
    ],
    updates: [
      {
        id: "sch-ehs-ed-u15",
        name: "Update 15 (Aug 2026)",
        dataDate: "2026-08-31",
        source: { kind: "p6-xer", label: "CP24017_HF_UPD15_2026-08-31.xer", ref: "CP24017-U15", at: "2026-09-08", by: "u-reyes" },
        set: { A1240: 95, A1320: 20 },
      },
      {
        id: "sch-ehs-ed-u14",
        name: "Update 14 (Jul 2026)",
        dataDate: "2026-07-31",
        source: { kind: "p6-xer", label: "CP24017_HF_UPD14_2026-07-31.xer", ref: "CP24017-U14", at: "2026-08-07", by: "u-reyes" },
        delta: { A1330: -8, A1360: -12 },
        skip: ["A1325"],
      },
    ],
  },
  {
    projectId: "tdc-ups",
    start: "2025-08-04",
    calendar: "6day",
    deadline: "2026-11-20",
    baselineName: "Contract baseline",
    spec: [
      {
        code: "1",
        name: "Engineering and submittals",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Short-circuit and coordination study", d: 25, p: "A1000", resp: "Keelson Engineering" },
          { c: "A1020", n: "Switchgear and UPS shop drawings", d: 60, p: "A1000", resp: "Brightwater Electric" },
          { c: "A1030", n: "Switchgear submittals approved", d: 0, t: "finish", p: "A1010, A1020", key: "Switchgear submittals approved" },
          { c: "A1040", n: "Method of procedure, UPS module A, DTS review", d: 20, p: "A1030", resp: "DTS" },
        ],
      },
      {
        code: "2",
        name: "UPS modules",
        acts: [
          { c: "A1100", n: "UPS module fabrication and delivery", d: 125, p: "A1030", resp: "UPS manufacturer" },
          { c: "A1120", n: "Install UPS module A and batteries", d: 20, p: "A1100", resp: "Brightwater Electric" },
          { c: "A1130", n: "UPS module A pre-functional testing", d: 8, p: "A1120", resp: "Cedarmark Commissioning" },
          { c: "A1140", n: "UPS module A cutover", d: 0, t: "finish", p: "A1130, A1040", key: "UPS module A cutover" },
          { c: "A1150", n: "Install and test UPS module B (CO #2)", d: 30, p: "A1140", resp: "Brightwater Electric" },
        ],
      },
      {
        code: "3",
        name: "Main switchgear",
        acts: [
          { c: "A1200", n: "Switchgear factory fabrication", d: 180, p: "A1030", resp: "Switchgear manufacturer", notes: "Factory slot slipped 17 weeks (risk R-01)." },
          { c: "A1210", n: "Switchgear delivery", d: 0, t: "finish", p: "A1200", key: "Switchgear delivery" },
          { c: "A1220", n: "Set switchgear and terminate feeders", d: 25, p: "A1210", resp: "Brightwater Electric" },
          { c: "A1230", n: "Pre-functional testing and relay settings", d: 12, p: "A1220", resp: "Cedarmark Commissioning" },
          { c: "A1235", n: "Method of procedure, main switchgear, DTS review", d: 15, p: "A1040", resp: "DTS" },
          { c: "A1240", n: "Rollback rehearsal", d: 3, p: "A1230, A1235", resp: "Brightwater Electric" },
          { c: "A1250", n: "Main switchgear cutover", d: 0, t: "finish", p: "A1240", key: "Main switchgear cutover" },
        ],
      },
      {
        code: "4",
        name: "Testing and closeout",
        acts: [
          { c: "A1300", n: "Transfer remaining loads", d: 12, p: "A1250, A1150", resp: "Brightwater Electric" },
          { c: "A1310", n: "Integrated systems test preparation", d: 10, p: "A1300", resp: "Cedarmark Commissioning" },
          { c: "A1320", n: "Integrated systems test", d: 0, t: "finish", p: "A1310", key: "Integrated systems test" },
          { c: "A1330", n: "Demobilize generator, as-builts, and training", d: 12, p: "A1320", resp: "Brightwater Electric" },
          { c: "A1340", n: "Final completion", d: 0, t: "finish", p: "A1330", key: "Final completion" },
        ],
      },
    ],
    updates: [
      {
        id: "sch-tdc-ups-u12",
        name: "Update 12 (Aug 2026)",
        dataDate: "2026-08-31",
        source: { kind: "p6-xer", label: "CP25019_BWE_UPD12.xer", ref: "CP25019-U12", at: "2026-09-04", by: "u-tran" },
      },
      {
        id: "sch-tdc-ups-u11",
        name: "Update 11 (Jul 2026)",
        dataDate: "2026-07-31",
        source: { kind: "p6-xer", label: "CP25019_BWE_UPD11.xer", ref: "CP25019-U11", at: "2026-08-05", by: "u-tran" },
        delta: { A1200: -24 },
      },
    ],
  },
  {
    projectId: "hmc-l4",
    start: "2024-07-01",
    calendar: "5day",
    deadline: "2026-12-18",
    baselineName: "GMP baseline",
    spec: [
      {
        code: "1",
        name: "Preconstruction",
        acts: [
          { c: "A1000", n: "Notice to proceed, preconstruction", d: 0, t: "start" },
          { c: "A1010", n: "GMP negotiation", d: 34, p: "A1000", resp: "Northbeam Builders" },
          { c: "A1020", n: "GMP executed", d: 0, t: "finish", p: "A1010", key: "GMP executed" },
          { c: "A1030", n: "Mobilization and ICRA barriers", d: 12, p: "A1020", resp: "Northbeam Builders" },
        ],
      },
      {
        code: "2",
        name: "Shell and overhead MEP",
        acts: [
          { c: "A1100", n: "Demolition and abatement, level 4", d: 30, p: "A1030", resp: "Northbeam Builders" },
          { c: "A1110", n: "Overhead ductwork and piping", d: 200, p: "A1100", resp: "Graystone Mechanical" },
          { c: "A1115", n: "Overhead electrical and medical gas", d: 200, p: "A1110SS+20", resp: "Brightwater Electric" },
          { c: "A1120", n: "Overhead MEP rough-in complete", d: 0, t: "finish", p: "A1110, A1115", key: "Overhead MEP rough-in complete" },
        ],
      },
      {
        code: "3",
        name: "OR build-out",
        acts: [
          { c: "A1200", n: "Framing, in-wall rough-in, and ceiling grid", d: 70, p: "A1120", resp: "Northbeam Builders" },
          { c: "A1210", n: "Imaging boom and equipment supports", d: 20, p: "A1200SS+20", resp: "Ironwood Steel Erectors" },
          { c: "A1220", n: "Finishes, OR 1–8", d: 120, p: "A1200SS+30", resp: "Summit Crest Interiors" },
          { c: "A1230", n: "Hybrid OR equipment delivery and set", d: 25, p: "A1210, A1220", resp: "Orcaline Imaging Systems" },
          { c: "A1240", n: "Hybrid OR equipment set", d: 0, t: "finish", p: "A1230", key: "Hybrid OR equipment set" },
        ],
      },
      {
        code: "4",
        name: "Commissioning and activation",
        acts: [
          { c: "A1300", n: "Medical gas certification", d: 10, p: "A1220", resp: "Graystone Mechanical" },
          { c: "A1305", n: "OR integration, low-voltage, and nurse call", d: 45, p: "A1240", resp: "Brightwater Electric" },
          { c: "A1310", n: "Test, adjust, and balance", d: 35, p: "A1300, A1305", resp: "Cedarmark Commissioning" },
          { c: "A1320", n: "Air balance and pressurization", d: 0, t: "finish", p: "A1310", key: "Air balance & pressurization" },
          { c: "A1330", n: "Terminal cleaning and ICRA clearance", d: 10, p: "A1320", resp: "Owner" },
          { c: "A1340", n: "DOH survey preparation", d: 20, p: "A1330", resp: "Owner" },
          { c: "A1350", n: "DOH survey", d: 0, t: "finish", p: "A1340", key: "DOH survey" },
          { c: "A1360", n: "Owner equipment, supplies, and staff training", d: 20, p: "A1350", resp: "Owner" },
          { c: "A1370", n: "First case", d: 0, t: "finish", p: "A1360", key: "First case" },
        ],
      },
    ],
    updates: [
      {
        id: "sch-hmc-l4-u23",
        name: "Update 23 (Aug 2026)",
        dataDate: "2026-08-31",
        source: { kind: "p6-xer", label: "CP23041_NB_UPD23.xer", ref: "CP23041-U23", at: "2026-09-09", by: "u-novak" },
      },
    ],
  },
  {
    projectId: "scc-linac",
    start: "2025-04-07",
    calendar: "5day",
    deadline: "2026-12-18",
    baselineName: "Contract baseline",
    spec: [
      {
        code: "1",
        name: "Design and procurement",
        acts: [
          { c: "A1000", n: "Notice to proceed", d: 0, t: "start" },
          { c: "A1010", n: "Linac purchase order and vendor site planning", d: 20, p: "A1000", resp: "Owner" },
          { c: "A1020", n: "Vault shielding design and physicist review", d: 30, p: "A1000", resp: "Bluecoast Civil" },
          { c: "A1030", n: "Permit review", d: 25, p: "A1020", resp: "Kitsap County" },
        ],
      },
      {
        code: "2",
        name: "Vault construction",
        acts: [
          { c: "A1100", n: "Excavation, including rock", d: 60, p: "A1030", resp: "Foothold Sitework" },
          { c: "A1110", n: "Foundation and vault walls", d: 90, p: "A1100", resp: "Alderline Construction" },
          { c: "A1120", n: "Vault roof pour and cure", d: 25, p: "A1110", resp: "Alderline Construction" },
          { c: "A1130", n: "Vault concrete complete", d: 0, t: "finish", p: "A1120", key: "Vault concrete complete" },
          { c: "A1140", n: "Shielding density verification cores (PCO-014)", d: 10, p: "A1130", resp: "Bluecoast Civil" },
        ],
      },
      {
        code: "3",
        name: "Fit-out",
        acts: [
          { c: "A1200", n: "MEP rough-in and dedicated chiller", d: 45, p: "A1130", resp: "Graystone Mechanical" },
          { c: "A1210", n: "Finishes and treatment console room", d: 35, p: "A1200SS+20", resp: "Alderline Construction" },
          { c: "A1220", n: "Linac fabrication and shipping", d: 300, p: "A1010", resp: "Linac manufacturer" },
          { c: "A1230", n: "Linac delivery", d: 0, t: "finish", p: "A1220, A1140, A1200", key: "Linac delivery" },
        ],
      },
      {
        code: "4",
        name: "Installation and acceptance",
        acts: [
          { c: "A1300", n: "Rigging and set", d: 5, p: "A1230", resp: "Linac manufacturer" },
          { c: "A1310", n: "Vendor installation", d: 25, p: "A1300", resp: "Linac manufacturer" },
          { c: "A1315", n: "Beam commissioning and acceptance testing", d: 20, p: "A1310", resp: "Physicist" },
          { c: "A1320", n: "Physics acceptance testing complete", d: 0, t: "finish", p: "A1315", key: "Physics acceptance testing" },
          { c: "A1330", n: "Commissioning data, treatment planning system, and dry runs", d: 35, p: "A1320", resp: "Physicist" },
          { c: "A1340", n: "First treatment", d: 0, t: "finish", p: "A1330, A1210", key: "First treatment" },
        ],
      },
    ],
    updates: [
      {
        id: "sch-scc-linac-u16",
        name: "Update 16 (Aug 2026)",
        dataDate: "2026-08-31",
        source: { kind: "p6-xml", label: "CP24033_AC_UPD16.xml", ref: "CP24033", at: "2026-09-10", by: "u-mensah" },
        set: { A1100: 75 },
      },
    ],
  },
];

function build(seed: Seed): Schedule[] {
  const p = projectById(seed.projectId)!;
  const y0 = Number(seed.start.slice(0, 4));
  const frame: Frame = {
    id: "",
    projectId: seed.projectId,
    name: "",
    source: seed.updates[0]!.source,
    dataDate: seed.start,
    start: seed.start,
    deadline: seed.deadline,
    calendar: CALENDAR_PRESETS[seed.calendar].make(y0, y0 + 4),
    baselineName: seed.baselineName,
    updated: seed.updates[0]!.source.at,
  };
  const keys = seed.spec.flatMap((w) => w.acts ?? []).filter((a) => a.key);
  const target = (pick: "baseline" | "forecast") =>
    Object.fromEntries(
      keys.flatMap((a) => {
        const m = p.milestones.find((x) => x.name === a.key);
        return m ? [[a.c, pick === "baseline" ? m.baseline : (m.actual ?? m.forecast)]] : [];
      }),
    );

  const bl = fitMilestones(fromSpec(seed.spec, frame, {}, new Set(seed.added)), target("baseline"));
  const blDates = new Map(compute(bl).list.map((c) => [c.a.code, { s: c.start, f: c.finish }]));
  const [latest, ...older] = seed.updates;
  const cur = fitMilestones(fromSpec(seed.spec, frame, { ...durations(bl), ...latest!.set }), target("forecast"));
  const curDur = durations(cur);

  const finish = (u: Update, s: Schedule): Schedule => {
    const done = progressAsPlanned(s, u.dataDate);
    return {
      ...done,
      id: u.id,
      name: u.name,
      source: u.source,
      updated: u.source.at,
      acts: done.acts.map((a) => ({ ...a, bl: blDates.get(a.code) ?? null })),
    };
  };
  return [
    finish(latest!, cur),
    ...older.map((u) => {
      // Older updates carry the latest durations, adjusted by the update's own deltas.
      const dur = { ...curDur };
      for (const [k, v] of Object.entries(u.delta ?? {})) dur[k] = Math.max(1, (curDur[k] ?? 0) + v);
      return finish(u, fromSpec(seed.spec, frame, dur, new Set(u.skip)));
    }),
  ];
}

let built: Schedule[] | null = null;

/** Built on first use: fitting and statusing runs the scheduler dozens of times, and only the Schedule view needs the result. */
export function seededSchedules(): Schedule[] {
  built ??= SEEDS.flatMap(build);
  return built;
}

/** What the rest of the app needs to know without building anything. */
export const SCHEDULED_PROJECT_IDS = SEEDS.map((s) => s.projectId);
export const SEEDED_IDS = SEEDS.flatMap((s) => s.updates.map((u) => u.id));
export const LATEST_SEEDED = SEEDS.map((s) => ({ projectId: s.projectId, name: s.updates[0]!.name }));
