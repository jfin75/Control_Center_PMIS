/** Contracts model: status, value roll-ups (original, approved changes,
 *  current, pending), master ceilings and releases, completeness of the
 *  blanks and exhibits, the filled-in document, and the workflow actions for
 *  contracts and their modifications. Every figure on the Contracts view
 *  comes from here, and every change goes through the actions at the bottom,
 *  which append to the record's log so the history stays whole. */

import { daysBetween, fmtDate, money } from "./format";
import { whoName } from "./rfis";
import { ORG, TODAY } from "@/mock/org";
import { projectById, type Project } from "@/mock/projects";
import {
  CATEGORIES,
  CONTRACTS,
  MOD_TYPES,
  modNumber,
  MODS,
  n,
  ORDER_NAME,
  templateById,
  type Contract,
  type ContractStatus,
  type Field,
  type Funding,
  type LogEntry,
  type LogKind,
  type Mod,
  type ModStatus,
  type ModType,
  type Template,
} from "@/mock/contracts";
import { RFIS, type Rfi, type Who } from "@/mock/rfis";
import type { Esign } from "./signvault/contract";

export type Tone = "pos" | "warn" | "neg" | "info" | "neutral" | "accent";

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------- */

export const STATUS: Record<ContractStatus, { label: string; tone: Tone; color: string; hint: string }> = {
  draft: { label: "Draft", tone: "neutral", color: "var(--c-slate-400)", hint: "Blanks and exhibits being filled in" },
  review: { label: "Legal review", tone: "accent", color: "var(--c-cobalt-500)", hint: "With Legal & Risk" },
  signature: { label: "Out for signature", tone: "warn", color: "var(--c-amber-400)", hint: "Sent to both signers" },
  executed: { label: "Executed", tone: "pos", color: "var(--c-teal-500)", hint: "Signed and in force" },
  closed: { label: "Closed", tone: "neutral", color: "var(--c-navy-500)", hint: "Work complete and paid out" },
};
export const IN_PROGRESS: ContractStatus[] = ["draft", "review", "signature"];

export const MOD_STATUS: Record<ModStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "accent" },
  priced: { label: "Priced", tone: "info" },
  approved: { label: "Executed", tone: "pos" },
  converted: { label: "Converted", tone: "neutral" },
  rejected: { label: "Rejected", tone: "neg" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function modStatusLabel(m: Mod): string {
  if (m.status === "open") return MOD_TYPES[m.type].openLabel;
  if (m.status === "approved" && m.type === "ASR") return "Approved";
  return MOD_STATUS[m.status].label;
}

export const isPending = (m: Mod) => m.status === "open" || m.status === "priced";
/** Approved changes that move the contract value. */
export const isApplied = (m: Mod) => MOD_TYPES[m.type].final && m.status === "approved";

/* ---------------------------------------------------------------------------
 * Field values
 * ------------------------------------------------------------------------- */

export function fmtField(f: Field, raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === "") return null;
  switch (f.type) {
    case "money":
      return money(n(raw));
    case "percent":
      return `${raw}%`;
    case "date":
      return fmtDate(raw);
    default:
      return raw.trim();
  }
}

export const allFields = (t: Template) => t.sections.flatMap((s) => s.fields);

/** The date the contract's work or term ends, from whichever blank the template has. */
export function endOf(c: Contract): string | null {
  const v = c.values;
  return v.final || v.substantial || v.finish || v.closeout || v.termEnd || v.delivery || null;
}

/* ---------------------------------------------------------------------------
 * Completeness
 * ------------------------------------------------------------------------- */

export interface Missing {
  /** Form tab to jump to: "parties", a section id, or "exhibits". */
  tab: string;
  label: string;
}

export function missingOf(c: Contract, t: Template): Missing[] {
  const out: Missing[] = [];
  if (!c.title.trim()) out.push({ tab: "parties", label: "Title" });
  if (t.structure !== "master" && !c.projectId) out.push({ tab: "parties", label: "Project" });
  if (t.structure === "task" && !c.parentId) out.push({ tab: "parties", label: "Master agreement" });
  if (!c.counterpartyId) out.push({ tab: "parties", label: CATEGORIES[t.category].party });
  for (const s of t.sections) for (const f of s.fields) if (f.required && !(c.values[f.key] ?? "").trim()) out.push({ tab: s.id, label: f.label });
  for (const x of t.exhibits) {
    const st = c.exhibits.find((e) => e.key === x.key);
    const done = !!st && ((x.standard && st.standard) || st.files.length > 0 || !!st.note?.trim() || (!x.required && st.na));
    if (x.required && !done) out.push({ tab: "exhibits", label: `Exhibit: ${x.title}` });
  }
  return out;
}

/** Soft checks against the master agreement: they warn but don't block. */
export function warningsOf(c: Contract, t: Template, all: Contract[]): string[] {
  const out: string[] = [];
  const v = t.value(c.values);
  if (t.structure === "task" && c.parentId) {
    const m = all.find((x) => x.id === c.parentId);
    if (m) {
      const mt = templateById(m.templateId)!;
      const max = n(m.values.maxOrder);
      if (max && v > max) out.push(`${money(v)} is over the master's single-order limit of ${money(max)}.`);
      const used = all.filter((x) => x.parentId === m.id && x.id !== c.id && x.status !== "draft").reduce((a, x) => a + templateById(x.templateId)!.value(x.values), 0);
      const ceiling = mt.value(m.values);
      if (used + v > ceiling) out.push(`Released and pending orders would reach ${money(used + v)}, over the ${money(ceiling)} ceiling. The master needs an amendment first.`);
      if (m.values.termEnd && c.values.finish && c.values.finish > m.values.termEnd) out.push(`The finish date is after the master's term ends (${fmtDate(m.values.termEnd)}).`);
    }
  }
  const start = c.values.ntp || c.values.start || c.values.termStart;
  const end = endOf(c);
  if (start && end && end < start) out.push("The end date is before the start date.");
  return out;
}

/* ---------------------------------------------------------------------------
 * The document: articles with the blanks filled
 * ------------------------------------------------------------------------- */

export type Piece = string | { key: string; label: string; value: string | null; required: boolean };

export interface DocArticle {
  heading: string;
  pieces: Piece[];
}

export function renderDoc(c: Contract, t: Template, all: Contract[]): DocArticle[] {
  const p = c.projectId ? projectById(c.projectId) : null;
  const parent = c.parentId ? all.find((x) => x.id === c.parentId) : null;
  const fields = new Map(allFields(t).map((f) => [f.key, f]));
  const builtin: Record<string, { label: string; value: string | null; required: boolean }> = {
    owner: { label: "Owner", value: ORG.name, required: true },
    counterparty: { label: CATEGORIES[t.category].party, value: c.counterpartyId ? whoName({ kind: "firm", id: c.counterpartyId }) : null, required: true },
    party: { label: "party", value: CATEGORIES[t.category].party, required: true },
    project: { label: "Project", value: p?.name ?? null, required: true },
    projectCode: { label: "Project code", value: p?.code ?? null, required: true },
    master: { label: "Master agreement", value: parent ? `${parent.number}, ${parent.title}` : null, required: true },
    masterDate: { label: "Master date", value: parent?.executed ? fmtDate(parent.executed) : null, required: true },
    effective: { label: "Date of execution", value: c.executed ? fmtDate(c.executed) : null, required: false },
  };
  return t.articles.map((a) => {
    const pieces: Piece[] = [];
    let last = 0;
    for (const m of a.body.matchAll(/\{\{(\w+)\}\}/g)) {
      if (m.index! > last) pieces.push(a.body.slice(last, m.index));
      const key = m[1]!;
      const f = fields.get(key);
      if (f) pieces.push({ key, label: f.label, value: fmtField(f, c.values[key]), required: !!f.required });
      else if (builtin[key]) pieces.push({ key, ...builtin[key]! });
      else pieces.push(`{{${key}}}`);
      last = m.index! + m[0].length;
    }
    if (last < a.body.length) pieces.push(a.body.slice(last));
    return { heading: a.heading, pieces };
  });
}

/* ---------------------------------------------------------------------------
 * Rows and roll-ups
 * ------------------------------------------------------------------------- */

export interface ModRow {
  m: Mod;
  c: Contract;
  t: Template;
  number: string;
  /** Contract and change number together, for places without the contract column. */
  ref: string;
  /** Days since it was submitted, for open changes. */
  age: number | null;
  waiting: { who: Who; name: string; why: string } | null;
  /** What the change is worth now: approved amount, else the estimate or price. */
  value: number;
}

export interface Row {
  c: Contract;
  t: Template;
  project: Project | null;
  parent: Contract | null;
  counterparty: string;
  /** Value from the blanks; a master's ceiling. */
  original: number;
  approved: number;
  approvedDays: number;
  current: number;
  pending: number;
  pendingCount: number;
  mods: ModRow[];
  /** Masters: task orders under them. */
  children: Row[];
  /** Masters: executed and closed orders' current value. */
  released: number;
  /** Masters: orders still being drafted, reviewed, or signed. */
  inFlight: number;
  missing: Missing[];
  end: string | null;
}

function waitingOn(m: Mod, c: Contract): ModRow["waiting"] {
  const cp: Who = { kind: "firm", id: c.counterpartyId };
  const rep: Who = { kind: "staff", id: c.ownerRepId };
  const name = (w: Who) => whoName(w);
  if (m.status === "draft") return { who: m.by, name: name(m.by), why: "Drafting" };
  if (m.status === "priced") return { who: rep, name: name(rep), why: "Owner review of the price" };
  if (m.status !== "open") return null;
  if (m.type === "PR" || m.type === "CCD") return { who: cp, name: name(cp), why: "Pricing" };
  if (m.type === "CO" || m.type === "AMD") return { who: rep, name: name(rep), why: "Owner approval and signature" };
  if (m.by.kind === "staff") return { who: cp, name: name(cp), why: "Response" };
  return { who: rep, name: name(rep), why: "Owner review" };
}

export function modRowOf(m: Mod, c: Contract): ModRow {
  const number = modNumber(m);
  return {
    m,
    c,
    t: templateById(c.templateId)!,
    number,
    ref: `${c.number} · ${number}`,
    age: isPending(m) && m.submitted ? daysBetween(m.submitted, TODAY) : null,
    waiting: waitingOn(m, c),
    value: m.status === "approved" ? (m.approvedAmount ?? 0) : (m.amount ?? 0),
  };
}

export function rowsOf(contracts: Contract[], mods: Mod[]): Row[] {
  const byContract = new Map<string, Mod[]>();
  for (const m of mods) byContract.set(m.contractId, [...(byContract.get(m.contractId) ?? []), m]);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const rows: Row[] = contracts.map((c) => {
    const t = templateById(c.templateId)!;
    const ms = (byContract.get(c.id) ?? []).map((m) => modRowOf(m, c)).sort((a, b) => MOD_ORDER(a.m) - MOD_ORDER(b.m) || a.m.seq - b.m.seq);
    const applied = ms.filter((x) => isApplied(x.m));
    const pending = ms.filter((x) => isPending(x.m));
    const original = t.value(c.values);
    const approved = applied.reduce((a, x) => a + (x.m.approvedAmount ?? 0), 0);
    return {
      c,
      t,
      project: c.projectId ? (projectById(c.projectId) ?? null) : null,
      parent: c.parentId ? (byId.get(c.parentId) ?? null) : null,
      counterparty: whoName({ kind: "firm", id: c.counterpartyId }),
      original,
      approved,
      approvedDays: applied.reduce((a, x) => a + (x.m.approvedDays ?? 0), 0),
      current: original + approved,
      pending: pending.reduce((a, x) => a + x.value, 0),
      pendingCount: pending.length,
      mods: ms,
      children: [],
      released: 0,
      inFlight: 0,
      missing: missingOf(c, t),
      end: endOf(c),
    };
  });
  const rowById = new Map(rows.map((r) => [r.c.id, r]));
  for (const r of rows) {
    if (!r.c.parentId) continue;
    const m = rowById.get(r.c.parentId);
    if (!m) continue;
    m.children.push(r);
    if (r.c.status === "executed" || r.c.status === "closed") m.released += r.current;
    else m.inFlight += r.current;
  }
  return rows;
}

const MOD_ORDER = (m: Mod) => ["PCI", "PR", "CCD", "CO", "ASR", "AMD"].indexOf(m.type);

export const isMaster = (r: Row) => r.t.structure === "master";
export const isLive = (r: Row) => r.c.status === "executed" || r.c.status === "closed";

export interface Kpis {
  committed: number;
  executed: number;
  original: number;
  approved: number;
  approvedCount: number;
  pending: number;
  pendingCount: number;
  pendingStale: number;
  inProgress: number;
  byStatus: Record<ContractStatus, number>;
  ceiling: number;
  released: number;
  masters: number;
  mastersHot: number;
}

/** Roll-ups over contracts (masters count toward capacity, never commitments). */
export function kpis(rows: Row[]): Kpis {
  const work = rows.filter((r) => !isMaster(r));
  const live = work.filter(isLive);
  const masters = rows.filter(isMaster).filter(isLive);
  const pendingMods = work.flatMap((r) => r.mods).filter((x) => isPending(x.m));
  const byStatus = { draft: 0, review: 0, signature: 0, executed: 0, closed: 0 } as Record<ContractStatus, number>;
  for (const r of rows) byStatus[r.c.status]++;
  return {
    committed: live.reduce((a, r) => a + r.current, 0),
    executed: live.length,
    original: live.reduce((a, r) => a + r.original, 0),
    approved: live.reduce((a, r) => a + r.approved, 0),
    approvedCount: live.flatMap((r) => r.mods).filter((x) => isApplied(x.m)).length,
    pending: pendingMods.reduce((a, x) => a + x.value, 0),
    pendingCount: pendingMods.length,
    pendingStale: pendingMods.filter((x) => (x.age ?? 0) > 30).length,
    inProgress: rows.filter((r) => IN_PROGRESS.includes(r.c.status)).length,
    byStatus,
    ceiling: masters.reduce((a, r) => a + r.current, 0),
    released: masters.reduce((a, r) => a + r.released, 0),
    masters: masters.length,
    mastersHot: masters.filter((r) => r.current > 0 && r.released / r.current >= 0.8).length,
  };
}

/** Seeded RFIs that point at a change: by its project-record number, or "CO #n" for a change order. */
export function rfisFor(m: Mod, c: Contract): Rfi[] {
  if (!c.projectId) return [];
  const keys = new Set([modNumber(m), m.ref, m.type === "CO" ? `CO #${m.seq}` : undefined].filter(Boolean) as string[]);
  return RFIS.filter((r) => r.projectId === c.projectId && r.changeRef && keys.has(r.changeRef));
}

/* ---------------------------------------------------------------------------
 * Store: user changes over the seeded records
 * ------------------------------------------------------------------------- */

export interface Store {
  /** Changed or added records by id; null deletes a seeded one. */
  contracts: Record<string, Contract | null>;
  mods: Record<string, Mod | null>;
}

export const EMPTY_STORE: Store = { contracts: {}, mods: {} };

function overlay<T extends { id: string }>(base: T[], over: Record<string, T | null>): T[] {
  const ids = new Set(base.map((x) => x.id));
  return [...base.map((x) => (x.id in over ? over[x.id] : x)), ...Object.entries(over).filter(([id]) => !ids.has(id)).map(([, x]) => x)].filter((x): x is T => !!x);
}

export const mergedContracts = (s: Store) => overlay(CONTRACTS, s.contracts);
export const mergedMods = (s: Store) => overlay(MODS, s.mods);
export const isSeededContract = (id: string) => CONTRACTS.some((c) => c.id === id);
export const isSeededMod = (id: string) => MODS.some((m) => m.id === id);

/** Files kept in this browser, to clear on reset. */
export function storedFileIds(contracts: Contract[], mods: Mod[]): string[] {
  return [...contracts.flatMap((c) => c.exhibits.flatMap((x) => x.files)), ...mods.flatMap((m) => m.files)].filter((f) => f.stored).map((f) => f.id);
}

/* ---------------------------------------------------------------------------
 * Actions. Each returns new records with an entry appended to the log.
 * ------------------------------------------------------------------------- */

let uid = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(uid++).toString(36)}`;

function logged<T extends { id: string; log: LogEntry[] }>(x: T, kind: LogKind, by: Who, text?: string, date = TODAY): T {
  const e: LogEntry = { id: newId(`${x.id}:log`), kind, date, by, text: text?.trim() || undefined };
  return { ...x, log: [...x.log, e] };
}

/** Next number: CN-24017-03 on a project, MSA-AE-03 for a master, MSA-AE-01-TO04 under one. */
export function nextNumber(all: Contract[], t: Template, projectId: string | null, parentId: string | null): string {
  if (t.structure === "task" && parentId) {
    const m = all.find((x) => x.id === parentId);
    if (m) {
      const kids = all.filter((x) => x.parentId === parentId).map((x) => Number(/(\d+)$/.exec(x.number)?.[1] ?? 0));
      return `${m.number}-${ORDER_NAME[t.category].abbr}${String(Math.max(0, ...kids) + 1).padStart(2, "0")}`;
    }
  }
  if (t.structure === "master") {
    const prefix = `MSA-${CATEGORIES[t.category].prefix}-`;
    const used = all.filter((x) => x.number.startsWith(prefix) && !x.parentId).map((x) => Number(x.number.slice(prefix.length)) || 0);
    return `${prefix}${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
  }
  const p = projectId ? projectById(projectId) : null;
  const digits = p ? p.code.replace(/\D/g, "") : "00000";
  const used = all.filter((x) => x.number.slice(3).startsWith(`${digits}-`)).map((x) => Number(x.number.split("-")[2]) || 0);
  return `${CATEGORIES[t.category].prefix}-${digits}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}

/** A blank contract from a template, with its defaults filled. */
export function blankContract(t: Template, by: string): Contract {
  const values: Record<string, string> = {};
  for (const f of t.sections.flatMap((s) => s.fields)) if (f.default !== undefined) values[f.key] = f.default;
  return {
    id: "",
    number: "",
    templateId: t.id,
    title: "",
    projectId: null,
    parentId: null,
    counterpartyId: "",
    ownerRepId: by,
    code: CATEGORIES[t.category].code,
    values,
    exhibits: t.exhibits.map((x) => ({ key: x.key, standard: !!x.standard, na: false, files: [] })),
    status: "draft",
    created: TODAY,
    log: [],
  };
}

/** Save the form: a new contract gets its id, number, and first log entry; an edit is logged. */
export function saveContract(c: Contract, all: Contract[], by: Who, submit: boolean): Contract {
  const t = templateById(c.templateId)!;
  const projectId = t.structure === "master" ? null : c.projectId;
  const parentId = t.structure === "task" ? c.parentId : null;
  let out: Contract;
  if (!c.id) {
    const id = newId(`${projectId ?? "program"}:contract`);
    out = logged({ ...c, id, projectId, parentId, number: nextNumber(all, t, projectId, parentId), created: TODAY, log: [] }, "created", by);
  } else {
    out = logged({ ...c, projectId, parentId }, "edited", by, "Blanks or exhibits updated");
  }
  return submit ? logged({ ...out, status: "review" }, "submitted", by, "To Legal & Risk") : out;
}

const CONTRACT_MOVE: Record<ContractStatus, LogKind> = { draft: "returned", review: "submitted", signature: "signature", executed: "executed", closed: "closed" };

export function moveContract(c: Contract, to: ContractStatus, by: Who, text?: string, date = TODAY): Contract {
  const next: Contract = { ...c, status: to };
  if (to === "executed") next.executed = date;
  if (to === "closed") next.closed = date;
  if (to === "draft") delete next.executed;
  return logged(next, CONTRACT_MOVE[to], by, text, date);
}

export const commentContract = (c: Contract, by: Who, text: string) => logged(c, "comment", by, text);

/* ---- SignVault -------------------------------------------------------- */

const signerList = (e: Esign) =>
  [...e.recipients]
    .sort((a, b) => a.routingOrder - b.routingOrder)
    .map((r) => `${r.name} (${r.role.toLowerCase()}${e.maxRoutingOrder > 1 ? `, tier ${r.routingOrder}` : ""})`)
    .join(", ");

/** Sent through SignVault: the contract goes out for signature carrying its envelope. */
export function sendForSignature(c: Contract, e: Esign, by: Who, note?: string): Contract {
  const where = e.mode === "simulated" ? "the simulated SignVault" : "SignVault";
  return { ...moveContract(c, "signature", by, [`Envelope ${e.envelopeId.slice(0, 8)} sent through ${where} to ${signerList(e)}.`, note?.trim()].filter(Boolean).join(" ")), esign: e };
}

/** Keep the contract's copy of the envelope current; completion executes the contract. */
export function applyEnvelope(c: Contract, e: Esign, by: Who): Contract {
  if (e.status === "COMPLETED" && c.status === "signature") {
    const date = (e.completedAt ?? new Date().toISOString()).slice(0, 10);
    const seal = e.mode === "simulated" ? "Simulated envelope completed; no PAdES seal applied." : `PAdES-sealed${e.finalSha256 ? `, final SHA-256 ${e.finalSha256.slice(0, 12)}…` : ""}.`;
    return { ...moveContract(c, "executed", by, `All ${e.recipients.length} signatures completed in SignVault. ${seal}`, date), esign: e };
  }
  return { ...c, esign: e };
}

/** Voided in SignVault: the contract steps back so it can be fixed and resent. */
export function voidedContract(c: Contract, e: Esign, by: Who, reason: string, to: "review" | "draft"): Contract {
  const next: Contract = { ...c, status: to, esign: e };
  if (to === "draft") delete next.executed;
  return logged(next, "voided", by, `Envelope ${e.envelopeId.slice(0, 8)} voided: ${reason}. Back to ${to === "review" ? "Legal review" : "draft"}.`);
}

/* ---- Modifications ------------------------------------------------------- */

export function nextModSeq(mods: Mod[], contractId: string, type: ModType): number {
  return Math.max(0, ...mods.filter((m) => m.contractId === contractId && m.type === type).map((m) => m.seq)) + 1;
}

export interface ModInput {
  contractId: string;
  type: ModType;
  title: string;
  description: string;
  classifier: Mod["classifier"];
  code: string;
  funding: Funding | null;
  amount: number | null;
  days: number | null;
  ref?: string;
  files: Mod["files"];
}

export function createMod(input: ModInput, mods: Mod[], by: Who, submit: boolean): Mod {
  const id = newId(`${input.contractId}:mod`);
  let m: Mod = {
    id,
    contractId: input.contractId,
    type: input.type,
    seq: nextModSeq(mods, input.contractId, input.type),
    title: input.title.trim(),
    description: input.description.trim(),
    classifier: input.classifier,
    code: input.code,
    funding: input.funding,
    amount: input.amount,
    days: input.days,
    status: "draft",
    by,
    created: TODAY,
    ref: input.ref?.trim() || undefined,
    files: input.files,
    log: [],
  };
  m = logged(m, "created", by);
  return submit ? submitMod(m, by) : m;
}

export function editMod(m: Mod, input: Omit<ModInput, "contractId" | "type">, by: Who): Mod {
  return logged({ ...m, ...input, title: input.title.trim(), description: input.description.trim(), ref: input.ref?.trim() || undefined }, "edited", by);
}

export const submitMod = (m: Mod, by: Who, text?: string) => logged({ ...m, status: "open" as const, submitted: TODAY }, "submitted", by, text);

export function priceMod(m: Mod, amount: number, days: number, by: Who, text?: string): Mod {
  return logged({ ...m, status: "priced", amount, days, priced: TODAY }, "priced", by, text || `Priced at ${money(amount)}${days ? `, ${days} days` : ""}`);
}

export function approveMod(m: Mod, a: { amount: number; days: number; funding: Funding | null; date: string }, by: Who, text?: string): Mod {
  return logged(
    { ...m, status: "approved", approvedAmount: a.amount, approvedDays: a.days, funding: a.funding, decided: a.date },
    "approved",
    by,
    text || `${m.type === "ASR" ? "Approved" : "Executed"} at ${money(a.amount)}${a.days ? ` and ${a.days} days` : ""}`,
    a.date,
  );
}

export const rejectMod = (m: Mod, by: Who, text?: string) => logged({ ...m, status: "rejected" as const, decided: TODAY }, "rejected", by, text);
export const withdrawMod = (m: Mod, by: Who, text?: string) => logged({ ...m, status: "withdrawn" as const, decided: TODAY }, "withdrawn", by, text);
export const commentMod = (m: Mod, by: Who, text: string) => logged(m, "comment", by, text);

/** Carry a precursor forward (PCI → PR or CO, PR → CCD or CO, CCD → CO): the new change opens with the same backup, and the old one closes as converted. */
export function convertMod(m: Mod, to: ModType, a: { amount: number | null; days: number | null }, mods: Mod[], by: Who, text?: string): [Mod, Mod] {
  let next = createMod(
    { contractId: m.contractId, type: to, title: m.title, description: m.description, classifier: m.classifier, code: m.code, funding: m.funding, amount: a.amount, days: a.days, ref: m.ref, files: m.files },
    mods,
    by,
    true,
  );
  next = { ...next, fromId: m.id };
  const toNumber = modNumber(next);
  const src = logged({ ...m, status: "converted" as const, decided: TODAY, toId: next.id }, "converted", by, text || `Converted to ${toNumber}`);
  return [src, logged(next, "comment", by, `From ${modNumber(m)}`)];
}
