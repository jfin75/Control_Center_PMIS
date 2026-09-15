/**
 * SYNTHETIC DEMONSTRATION DATA — see src/mock/org.ts.
 * Line items, cash flow, forecast history, contracts and pay applications are
 * generated deterministically from each project's Finance-level totals, so
 * every rollup reconciles exactly to src/mock/projects.ts.
 */

import { allocate, chain, seeded, sumChain, type Chain, type ChainInputs } from "@/lib/budget";
import { costCode, type ChangeClassifier, type Level1 } from "./costCodes";
import { TODAY } from "./org";
import { PROJECTS, type Archetype, type Project } from "./projects";

export interface BudgetLine extends ChainInputs {
  id: string;
  projectId: string;
  level1: Level1;
  code: string;
  category: string;
  description?: string;
  classifier?: ChangeClassifier;
  csi?: string;
  pr?: string;
  po?: string;
}

type Weights = Array<[code: string, weight: number]>;

const ARCHETYPE_WEIGHTS: Record<Archetype, Weights> = {
  fitout: [
    ["1.02", 6], ["1.05", 3], ["1.14", 2], ["1.16", 1], ["1.18", 0.3], ["1.21", 0.8], ["3.02", 62], ["3.04", 3], ["3.05", 1],
    ["3.06", 4], ["5.03", 7], ["5.04", 2], ["6.01", 1.5], ["7.02", 1.5], ["7.03", 1], ["7.06", 0.6], ["8.05", 0.2], ["8.07", 0.3], ["9.01", 3],
  ],
  equipment: [
    ["1.02", 4], ["1.05", 4], ["1.16", 2], ["1.28", 1], ["3.02", 30], ["3.04", 2], ["3.06", 3], ["5.02", 1], ["5.03", 48], ["7.03", 1], ["8.11", 1], ["9.01", 3],
  ],
  infrastructure: [
    ["1.02", 3], ["1.05", 6], ["1.08", 1], ["1.11", 1], ["1.16", 1.5], ["1.19", 0.5], ["1.20", 1], ["3.02", 70], ["3.04", 3], ["3.05", 0.8],
    ["3.06", 4], ["5.03", 4], ["8.12", 0.2], ["9.01", 4],
  ],
  office: [
    ["1.02", 7], ["1.05", 3], ["1.14", 2], ["3.02", 64], ["3.04", 3], ["3.06", 4], ["6.01", 9], ["7.02", 2], ["7.03", 2], ["7.08", 1.5], ["8.05", 1], ["8.07", 0.5], ["9.01", 2],
  ],
};

const CSI_SPLITS: Record<Archetype, Weights> = {
  fitout: [["01", 8], ["02", 3], ["03", 2], ["05", 3], ["06", 4], ["07", 2], ["08", 6], ["09", 18], ["10", 2], ["21", 4], ["22", 12], ["23", 18], ["26", 12], ["27", 3], ["28", 3]],
  equipment: [["01", 10], ["02", 6], ["03", 8], ["05", 6], ["09", 10], ["13", 20], ["22", 5], ["23", 15], ["26", 20]],
  infrastructure: [["01", 7], ["02", 4], ["03", 12], ["05", 8], ["07", 3], ["22", 10], ["23", 30], ["25", 3], ["26", 20], ["31", 3]],
  office: [["01", 8], ["06", 6], ["08", 8], ["09", 30], ["10", 3], ["21", 4], ["22", 6], ["23", 16], ["26", 14], ["27", 5]],
};

const CSI_LABEL: Record<string, string> = {
  "01": "General conditions & requirements",
  "02": "Selective demolition & abatement",
  "03": "Cast-in-place concrete",
  "05": "Structural & misc. metals",
  "06": "Casework & millwork",
  "07": "Roofing, fireproofing & sealants",
  "08": "Doors, frames, hardware & glazing",
  "09": "Drywall, ceilings, flooring & paint",
  "10": "Toilet accessories & specialties",
  "13": "Radiation / RF shielding",
  "21": "Fire sprinklers",
  "22": "Plumbing & medical gas",
  "23": "HVAC & controls",
  "25": "Building automation integration",
  "26": "Power & lighting",
  "27": "Structured cabling & nurse call",
  "28": "Access control & fire alarm",
  "31": "Excavation & shoring",
};

/** How much of each line is typically committed at each phase. */
function commitFactor(code: string, phase: Project["phase"]): number {
  const l1 = code.split(".")[0];
  if (code === "9.01" || code === "3.04" || code === "3.06") return 0;
  if (l1 === "1") return phase === "Design" || phase === "Preconstruction" ? 0.55 : 0.95;
  if (code === "3.02") return { Preconstruction: 0.02, Design: 0.01, Procurement: 0.15, Construction: 1, Closeout: 1 }[phase];
  if (code === "3.05") return phase === "Design" ? 0 : 1;
  if (l1 === "5") return { Preconstruction: 0.05, Design: 0.05, Procurement: 0.4, Construction: 0.9, Closeout: 1 }[phase];
  return { Preconstruction: 0.05, Design: 0.05, Procurement: 0.2, Construction: 0.6, Closeout: 1 }[phase];
}

function buildLines(p: Project, seed: number): BudgetLine[] {
  const rnd = seeded(seed);
  const lines: BudgetLine[] = [];
  const base = ARCHETYPE_WEIGHTS[p.archetype];

  // Expand 3.02 into CSI sub-lines; everything else is one line per category.
  const slots: Array<{ code: string; weight: number; csi?: string }> = [];
  for (const [code, w] of base) {
    if (code === "3.02") {
      const splits = CSI_SPLITS[p.archetype];
      const sw = splits.reduce((a, [, x]) => a + x, 0);
      for (const [csi, x] of splits) slots.push({ code, weight: (w * x) / sw, csi });
    } else {
      slots.push({ code, weight: w * (0.85 + rnd() * 0.3) });
    }
  }

  const A = allocate(p.totals.A, slots.map((s) => s.weight), 50);
  slots.forEach((s, i) => {
    const cc = costCode(s.code);
    lines.push({
      id: `${p.id}-${i}`,
      projectId: p.id,
      level1: cc.level1,
      code: s.code,
      category: cc.name,
      description: s.csi ? `Div ${s.csi} – ${CSI_LABEL[s.csi]}` : undefined,
      csi: s.csi,
      A: A[i]!,
      B: 0,
      D: 0,
      F: 0,
      I: 0,
    });
  });

  // Budget adjustments (B). Positive change orders are executed, so they are committed.
  let fixedD = 0;
  let fixedI = 0;
  p.adjustments.forEach((adj, i) => {
    const cc = costCode(adj.code);
    if (adj.code === "3.03") {
      const paid = p.phase === "Closeout" ? adj.amount : Math.round((adj.amount * 0.5) / 50) * 50;
      lines.push({
        id: `${p.id}-adj${i}`,
        projectId: p.id,
        level1: cc.level1,
        code: adj.code,
        category: cc.name,
        description: adj.description,
        classifier: adj.classifier,
        csi: adj.csi,
        A: 0,
        B: adj.amount,
        D: adj.amount,
        F: 0,
        I: paid,
      });
      fixedD += adj.amount;
      fixedI += paid;
    } else {
      // Transfers and descopes post against the existing line for that code.
      const target =
        lines.find((l) => l.code === adj.code && (!adj.csi || l.csi === adj.csi)) ?? lines.find((l) => l.code === adj.code);
      if (target) target.B += adj.amount;
    }
  });

  const open = lines.filter((l) => l.code !== "3.03");

  // D — commitments.
  const dW = open.map((l) => Math.max(0, (l.A + l.B) * commitFactor(l.code, p.phase) * (0.8 + rnd() * 0.4)));
  const D = allocate(p.totals.D - fixedD, dW, 1);
  open.forEach((l, i) => (l.D = D[i]!));

  // F — projected remaining commitments, weighted to what is still uncommitted.
  const fW = open.map((l) => {
    const unc = Math.max(0, l.A + l.B - l.D);
    if (l.code === "9.01") return unc * 0.15;
    if (l.code === "3.04" || l.code === "3.06") return unc * 0.6;
    return unc * (0.7 + rnd() * 0.5) + (l.D > 0 ? l.D * 0.01 : 0);
  });
  const F = allocate(p.totals.F, fW, 1);
  open.forEach((l, i) => (l.F = F[i]!));

  // I — payments, never more than what is committed on the line.
  const k = (p.totals.I - fixedI) / Math.max(1, p.totals.D - fixedD);
  const iW = open.map((l) => {
    const early = l.code.startsWith("1.") ? 1.35 : 1;
    return l.D * Math.min(1, k * early * (0.85 + rnd() * 0.3));
  });
  const I = allocate(p.totals.I - fixedI, iW, 1);
  open.forEach((l, i) => (l.I = I[i]!));
  // Settle any line paid beyond its commitment by moving the excess to lines with headroom.
  for (let guard = 0; guard < 20; guard++) {
    let excess = 0;
    for (const l of open) if (l.I > l.D) { excess += l.I - l.D; l.I = l.D; }
    if (excess === 0) break;
    const room = open.filter((l) => l.D - l.I > 0);
    const add = allocate(excess, room.map((l) => l.D - l.I), 1);
    room.forEach((l, i) => (l.I += add[i]!));
  }

  // Purchase order / requisition references.
  let po = 4100 + (seed % 700);
  for (const l of lines) {
    if (l.D > 0) l.po = `PO-${26}${String(po++).padStart(5, "0")}`;
    else if (l.F > 0 && !["3.04", "3.06", "9.01"].includes(l.code)) l.pr = `PR-${String(80_000 + (po++ * 7) % 9000)}`;
  }
  return lines;
}

export const BUDGET_LINES: BudgetLine[] = PROJECTS.flatMap((p, i) => buildLines(p, 1000 + i * 97));

export function linesFor(projectId: string | "all"): BudgetLine[] {
  return projectId === "all" ? BUDGET_LINES : BUDGET_LINES.filter((l) => l.projectId === projectId);
}

export function projectChain(p: Project): Chain {
  return chain(p.totals);
}

export function programChain(projectIds?: string[]): Chain {
  const ps = projectIds ? PROJECTS.filter((p) => projectIds.includes(p.id)) : PROJECTS;
  return sumChain(ps.map((p) => p.totals));
}

/* ---------------------------------------------------------------------------
 * Contingency buckets (derived from lines)
 * ------------------------------------------------------------------------- */

export interface ContingencyBucket {
  bucket: "Design contingency" | "Contractor contingency" | "Owner's reserve";
  code: string;
  original: number;
  drawn: number;
  pending: number;
  remaining: number;
}

export function contingencyFor(projectId: string | "all"): ContingencyBucket[] {
  const lines = linesFor(projectId);
  const projects = projectId === "all" ? PROJECTS : PROJECTS.filter((p) => p.id === projectId);
  const defs = [
    { bucket: "Design contingency" as const, code: "3.04" },
    { bucket: "Contractor contingency" as const, code: "3.06" },
    { bucket: "Owner's reserve" as const, code: "9.01" },
  ];
  return defs.map(({ bucket, code }) => {
    const ls = lines.filter((l) => l.code === code);
    const original = ls.reduce((a, l) => a + l.A, 0);
    const drawn = -ls.reduce((a, l) => a + Math.min(0, l.B), 0) + ls.reduce((a, l) => a + l.D, 0);
    const pending = projects.flatMap((p) => p.pending).filter((c) => c.funding === bucket).reduce((a, c) => a + c.amount, 0);
    return { bucket, code, original, drawn, pending, remaining: original - drawn - pending };
  });
}

/* ---------------------------------------------------------------------------
 * Monthly series: cash flow and forecast history
 * ------------------------------------------------------------------------- */

function monthStart(iso: string): Date {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, 1);
}
function isoMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
/** Classic construction S-curve (regularized incomplete beta ≈ smootherstep). */
function sCurve(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export interface CashPoint {
  month: string;
  planned: number;
  actual: number | null;
  forecast: number | null;
  plannedCum: number;
  actualCum: number | null;
  forecastCum: number | null;
}

const NOW = monthStart(TODAY);

function projectCash(p: Project, rnd: () => number): Map<string, { planned: number; actual: number; forecast: number }> {
  const out = new Map<string, { planned: number; actual: number; forecast: number }>();
  const c = chain(p.totals);
  const s = monthStart(p.start);
  const bf = monthStart(p.baselineFinish);
  const ff = monthStart(p.forecastFinish);
  const nBase = Math.max(1, monthsBetween(s, bf) + 1);
  const nFc = Math.max(1, monthsBetween(s, ff) + 1);

  // Planned baseline: the approved budget paid over the baseline schedule, with the
  // usual ~2-month pay-application lag behind work in place.
  const LAG = 2;
  for (let i = 0; i < nBase + LAG; i++) {
    const m = isoMonth(addMonths(s, i));
    const v = c.C * (sCurve((i + 1 - LAG) / nBase) - sCurve((i - LAG) / nBase));
    out.set(m, { planned: v, actual: 0, forecast: 0 });
  }
  // Actual spend (payments) up to last month, shaped like the forecast curve and scaled to I.
  const elapsed = Math.max(0, Math.min(nFc, monthsBetween(s, NOW)));
  if (elapsed > 0) {
    const raw = Array.from({ length: elapsed }, (_, i) => (sCurve((i + 1) / nFc) - sCurve(i / nFc) + 0.004) * (0.75 + rnd() * 0.5));
    const alloc = allocate(p.totals.I, raw, 1);
    alloc.forEach((v, i) => {
      const m = isoMonth(addMonths(s, i));
      const cur = out.get(m) ?? { planned: 0, actual: 0, forecast: 0 };
      cur.actual = v;
      out.set(m, cur);
    });
  }
  // Forecast: remaining EAC (G − I) from this month to forecast finish (plus the same
  // pay lag). The remaining spend follows the S-curve from where the project actually
  // is — the point where the curve equals paid ÷ EAC — so the forecast picks up from
  // today's run-rate instead of jumping to the baseline.
  const paidShare = c.G > 0 ? Math.min(0.98, p.totals.I / c.G) : 0;
  let t0 = 0;
  while (t0 < 0.98 && sCurve(t0) < paidShare) t0 += 0.005;
  const remainN = Math.max(1, nFc - elapsed + (p.phase === "Closeout" ? 0 : LAG));
  const rawF = Array.from({ length: remainN }, (_, j) => {
    const a = t0 + ((1 - t0) * j) / remainN;
    const b = t0 + ((1 - t0) * (j + 1)) / remainN;
    return sCurve(b) - sCurve(a) + 0.001;
  });
  const allocF = allocate(Math.max(0, c.G - p.totals.I), rawF, 1);
  allocF.forEach((v, j) => {
    const m = isoMonth(addMonths(s, elapsed + j));
    const cur = out.get(m) ?? { planned: 0, actual: 0, forecast: 0 };
    cur.forecast = v;
    out.set(m, cur);
  });
  return out;
}

const CASH_CACHE = new Map<string, Map<string, { planned: number; actual: number; forecast: number }>>();
PROJECTS.forEach((p, i) => CASH_CACHE.set(p.id, projectCash(p, seeded(500 + i * 31))));

/** Monthly cash flow with cumulative curves, windowed to include 12 forward months. */
export function cashFlow(projectId: string | "all"): CashPoint[] {
  const ids = projectId === "all" ? PROJECTS.map((p) => p.id) : [projectId];
  const merged = new Map<string, { planned: number; actual: number; forecast: number }>();
  for (const id of ids) {
    for (const [m, v] of CASH_CACHE.get(id)!) {
      const cur = merged.get(m) ?? { planned: 0, actual: 0, forecast: 0 };
      cur.planned += v.planned;
      cur.actual += v.actual;
      cur.forecast += v.forecast;
      merged.set(m, cur);
    }
  }
  const months = [...merged.keys()].sort();
  const nowIso = isoMonth(NOW);
  let pc = 0;
  let ac = 0;
  const pts: CashPoint[] = months.map((m) => {
    const v = merged.get(m)!;
    pc += v.planned;
    const past = m < nowIso;
    if (past) ac += v.actual;
    return {
      month: m,
      planned: Math.round(v.planned),
      actual: past ? v.actual : null,
      forecast: past ? null : v.forecast,
      plannedCum: Math.round(pc),
      actualCum: past ? ac : null,
      forecastCum: null,
    };
  });
  // The forecast curve starts where actuals end so the two lines join.
  const lastActual = pts.findLastIndex((p) => p.actualCum !== null);
  let fc = ac;
  if (lastActual >= 0) pts[lastActual]!.forecastCum = ac;
  for (let i = lastActual + 1; i < pts.length; i++) {
    fc += pts[i]!.forecast ?? 0;
    pts[i]!.forecastCum = fc;
  }
  const end = pts.findIndex((p) => p.month === addMonthsIso(nowIso, 12));
  return end > 0 ? pts.slice(0, end + 1) : pts;
}

function addMonthsIso(iso: string, n: number): string {
  return isoMonth(addMonths(monthStart(iso), n));
}

export interface EacPoint {
  month: string;
  eac: number;
  approved: number;
}

/** Twelve monthly EAC snapshots ending at the current Forecast Cost at Completion (G). */
export function forecastHistory(projectId: string | "all"): EacPoint[] {
  const ps = projectId === "all" ? PROJECTS : PROJECTS.filter((p) => p.id === projectId);
  const pts: EacPoint[] = [];
  for (let k = 11; k >= 0; k--) {
    const m = isoMonth(addMonths(NOW, -k));
    let eac = 0;
    let approved = 0;
    ps.forEach((p, idx) => {
      const c = chain(p.totals);
      const rnd = seeded(9000 + idx * 13 + k * 7);
      const applied = p.adjustments.filter((a) => a.approved.slice(0, 7) <= m.slice(0, 7)).reduce((s, a) => s + a.amount, 0);
      const appr = p.start.slice(0, 7) <= m.slice(0, 7) ? p.totals.A + applied : 0;
      const drift = (c.G - c.C) * (1 - k / 12) + (rnd() - 0.5) * c.C * 0.006 * (k > 0 ? 1 : 0);
      eac += appr ? appr + drift : 0;
      approved += appr;
    });
    pts.push({ month: m, eac: Math.round(eac), approved: Math.round(approved) });
  }
  return pts;
}

/* ---------------------------------------------------------------------------
 * Contracts, pay applications (AIA G702/G703 style) and invoice ledger
 * ------------------------------------------------------------------------- */

export interface G703Line {
  item: string;
  description: string;
  scheduled: number;
  previous: number;
  thisPeriod: number;
  stored: number;
}

export interface PayApp {
  id: string;
  projectId: string;
  contractorId: string;
  number: number;
  periodTo: string;
  status: "Draft" | "Submitted" | "Under review" | "Approved" | "Paid";
  retainagePct: number;
  originalContract: number;
  netChanges: number;
  lines: G703Line[];
}

export function g702(app: PayApp) {
  const contractSum = app.originalContract + app.netChanges;
  const completed = app.lines.reduce((a, l) => a + l.previous + l.thisPeriod + l.stored, 0);
  const retainage = Math.round(completed * app.retainagePct);
  const earnedLessRet = completed - retainage;
  const prevCompleted = app.lines.reduce((a, l) => a + l.previous, 0);
  const previousCerts = prevCompleted - Math.round(prevCompleted * app.retainagePct);
  const currentDue = earnedLessRet - previousCerts;
  return {
    originalContract: app.originalContract,
    netChanges: app.netChanges,
    contractSum,
    completed,
    retainage,
    earnedLessRet,
    previousCerts,
    currentDue,
    balanceToFinish: contractSum - earnedLessRet,
    pctComplete: contractSum ? completed / contractSum : 0,
  };
}

function buildPayApp(p: Project): PayApp | null {
  const lines = linesFor(p.id).filter((l) => (l.code === "3.02" || l.code === "3.03") && l.D > 0);
  if (!lines.length) return null;
  const base = lines.filter((l) => l.code === "3.02");
  const cos = lines.filter((l) => l.code === "3.03");
  const ret = 0.05;
  // "Previous" is work certified through last period, so previous certificates
  // (net of retainage) equal payments to date (I) on each line.
  const g: G703Line[] = lines.map((l, i) => {
    const previous = Math.min(l.D, Math.round(l.I / (1 - ret)));
    const room = l.D - previous;
    const thisPeriod = Math.min(room, Math.round(l.D * (p.phase === "Closeout" ? 0.01 : 0.04)));
    const stored = l.csi === "23" || l.csi === "26" ? Math.min(room - thisPeriod, Math.round(l.D * 0.02)) : 0;
    return { item: String(i + 1).padStart(3, "0"), description: l.description ?? l.category, scheduled: l.D, previous, thisPeriod, stored };
  });
  const n = Math.max(2, Math.round((new Date(TODAY).getTime() - new Date(p.start).getTime()) / (30.4 * 86_400_000)) - 1);
  return {
    id: `${p.id}-pa${n}`,
    projectId: p.id,
    contractorId: p.gcId,
    number: n,
    periodTo: "2026-08-31",
    status: p.status === "delayed" ? "Under review" : p.phase === "Closeout" ? "Approved" : "Submitted",
    retainagePct: ret,
    originalContract: base.reduce((a, l) => a + l.D, 0),
    netChanges: cos.reduce((a, l) => a + l.D, 0),
    lines: g,
  };
}

export const PAY_APPS: PayApp[] = PROJECTS.map(buildPayApp).filter((x): x is PayApp => x !== null);

export interface Invoice {
  id: string;
  projectId: string;
  vendor: string;
  code: string;
  date: string;
  invoiced: number;
  approved: number;
  paid: number;
  status: "Received" | "In approval" | "Approved" | "Paid" | "Disputed";
  payApp?: string;
  workdayRef?: string;
}

function monthEnd(offset: number): string {
  // offset 0 = Aug 2026 (last closed period), 1 = Jul 2026, …
  const d = new Date(2026, 8 - offset, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Invoice ledger, project to date. For every cost code, paid invoices sum
 * exactly to that code's Payments to Date (I); open invoices draw only on the
 * committed-but-unpaid balance (D − I).
 */
function buildInvoices(): Invoice[] {
  const rnd = seeded(4242);
  const out: Invoice[] = [];
  const vendorsByL1: Record<string, string[]> = {
    "1": ["Tessellate Architecture", "Keelson Engineering", "Cedarmark Commissioning", "Quartermile Cost Consultants", "Bluecoast Civil"],
    "3": ["City permit office"],
    "5": ["Orcaline Imaging Systems", "Lumenfield Equipment Planning"],
    "6": ["Cascade Contract Furniture"],
    "7": ["Harborline DTS (internal)", "Northline Cabling"],
    "8": ["Evergreen Movers", "Sound Sign Co."],
  };
  let seq = 23_100;
  for (const p of PROJECTS) {
    const app = PAY_APPS.find((a) => a.projectId === p.id);
    const codes = [...new Set(linesFor(p.id).map((l) => l.code))].sort();
    for (const code of codes) {
      const ls = linesFor(p.id).filter((l) => l.code === code);
      const I = ls.reduce((a, l) => a + l.I, 0);
      const D = ls.reduce((a, l) => a + l.D, 0);
      if (D === 0) continue;
      const gc = code === "3.02" || code === "3.03";
      const pool = vendorsByL1[code.split(".")[0]!];
      if (!gc && !pool) continue;
      const vendor = gc ? gcName(p.gcId) : pool![Math.floor(rnd() * pool!.length)]!;

      // Paid history: one invoice per pay app for the contractor, a few for everyone else.
      if (I > 0) {
        const n = gc && app ? Math.min(app.number - 1, code === "3.03" ? 3 : 12) : 1 + Math.floor(rnd() * 3);
        const parts = allocate(I, Array.from({ length: n }, () => 0.6 + rnd() * 0.8), 1);
        parts.forEach((amt, k) => {
          const payNo = app ? app.number - 1 - k : undefined;
          out.push({
            id: `INV-${seq++}`,
            projectId: p.id,
            vendor,
            code,
            date: monthEnd(k + (gc ? 0 : Math.floor(rnd() * 2))),
            invoiced: amt,
            approved: amt,
            paid: amt,
            status: "Paid",
            payApp: gc && payNo ? `Pay App #${payNo}` : undefined,
            workdayRef: `SI-${String(700_000 + seq * 3)}`,
          });
        });
      }

      // Open items against the unpaid commitment.
      if (gc && app) {
        const cur = app.lines.filter((_, i) => ls.some((l) => (l.description ?? l.category) === app.lines[i]!.description));
        const amt = Math.round(cur.reduce((a, l) => a + l.thisPeriod + l.stored, 0) * (1 - app.retainagePct));
        if (amt > 0) {
          const status: Invoice["status"] = app.status === "Approved" ? "Approved" : app.status === "Under review" ? "In approval" : "Received";
          out.push({ id: `INV-${seq++}`, projectId: p.id, vendor, code, date: "2026-08-31", invoiced: amt, approved: status === "Approved" ? amt : 0, paid: 0, status, payApp: `Pay App #${app.number}` });
        }
      } else if (D - I > 0 && rnd() < 0.65) {
        const amt = Math.max(1_200, Math.round(((D - I) * (0.05 + rnd() * 0.12)) / 10) * 10);
        const roll = rnd();
        const status: Invoice["status"] = roll < 0.4 ? "Approved" : roll < 0.8 ? "In approval" : roll < 0.93 ? "Received" : "Disputed";
        out.push({ id: `INV-${seq++}`, projectId: p.id, vendor, code, date: monthEnd(0).replace(/-\d\d$/, `-${String(5 + Math.floor(rnd() * 22)).padStart(2, "0")}`), invoiced: amt, approved: status === "Approved" ? amt : 0, paid: 0, status });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function gcName(id: string): string {
  const names: Record<string, string> = {
    "c-northbeam": "Northbeam Builders",
    "c-alderline": "Alderline Construction",
    "c-harrow": "Harrow & Finch Contractors",
    "c-graystone": "Graystone Mechanical",
    "c-brightwater": "Brightwater Electric",
    "c-summit": "Summit Crest Interiors",
  };
  return names[id] ?? id;
}

export const INVOICES: Invoice[] = buildInvoices();
