/** A contract's trip through SignVault: who signs and in what order, the
 *  envelope built from the filled-in document, and keeping the contract's
 *  copy of the envelope current. The contract record holds an `esign` summary
 *  (with the signing tokens SignVault issues to the sender); SignVault holds
 *  the envelope, the sealed PDF, and the audit trail. */

import { renderDoc } from "@/lib/contracts";
import { money } from "@/lib/format";
import { CATEGORIES, type Contract, type Template } from "@/mock/contracts";
import { contractor, ORG, person } from "@/mock/org";
import { SignVaultError, transport, type EnvelopeStatus, type EnvelopeView, type Invite, type RecipientStatus, type Transport } from "./client";
import type { Mode } from "./config";
import { buildContractPdf, type BuiltPdf, type DocBlock } from "./pdf";

export interface EsignRecipient {
  id: string;
  /** "Owner", "Contractor", "Architect"… */
  role: string;
  party: string;
  name: string;
  email: string;
  routingOrder: number;
  status: RecipientStatus;
  signedAt?: string | null;
  /** The signing token SignVault issued for this recipient's turn. */
  token?: string;
}

export interface Esign {
  envelopeId: string;
  mode: Mode;
  baseUrl: string;
  tenantId: string;
  status: EnvelopeStatus;
  currentRoutingOrder: number;
  maxRoutingOrder: number;
  recipients: EsignRecipient[];
  fileName: string;
  pageCount: number;
  originalSha256?: string | null;
  finalSha256?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  voidReason?: string | null;
  /** When Control Center last read the envelope. */
  checkedAt: string;
}

export interface SignerDraft {
  key: "counterparty" | "owner";
  role: string;
  party: string;
  name: string;
  email: string;
  routingOrder: number;
}

/** Owner signatory for capital contracts. */
export const OWNER_SIGNATORY_ID = "u-okafor";

/** The counterparty signs first; the Owner countersigns. */
export function defaultSigners(c: Contract, t: Template): SignerDraft[] {
  const firm = c.counterpartyId ? contractor(c.counterpartyId) : null;
  const owner = person(OWNER_SIGNATORY_ID);
  const slug = (firm?.name ?? "counterparty").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return [
    { key: "counterparty", role: CATEGORIES[t.category].party, party: firm?.name ?? "Counterparty", name: "", email: `contracts@${slug}.example`, routingOrder: 1 },
    { key: "owner", role: "Owner", party: ORG.name, name: owner.name, email: owner.email, routingOrder: 2 },
  ];
}

export const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** The contract as PDF blocks, reading the same as the Document tab. */
export function documentBlocks(c: Contract, t: Template, all: Contract[]): DocBlock[] {
  const doc = renderDoc(c, t, all);
  const blocks: DocBlock[] = [
    { kind: "meta", text: `${ORG.name} · ${t.form}` },
    { kind: "title", text: t.name },
    { kind: "subtitle", text: `${c.number}${c.title ? ` · ${c.title}` : ""}` },
  ];
  doc.forEach((a, i) => {
    blocks.push({ kind: "heading", text: `${i + 1}. ${a.heading}` });
    blocks.push({
      kind: "para",
      text: a.pieces.map((p) => (typeof p === "string" ? p : p.value ? p.value : p.required ? `[${p.label}]` : p.key === "effective" ? "the date of execution" : "none")).join(""),
    });
  });
  blocks.push({ kind: "heading", text: `${doc.length + 1}. Exhibits` });
  t.exhibits.forEach((x, i) => blocks.push({ kind: "item", text: `Exhibit ${String.fromCharCode(65 + i)}, ${x.title}` }));
  blocks.push({ kind: "para", text: `${t.valueLabel}: ${money(t.value(c.values))}.` });
  return blocks;
}

export function buildPdf(c: Contract, t: Template, all: Contract[], signers: Array<SignerDraft & { id: string }>): BuiltPdf {
  return buildContractPdf(
    documentBlocks(c, t, all),
    [...signers].sort((a, b) => a.routingOrder - b.routingOrder).map((s) => ({ recipientId: s.id, role: s.role, party: s.party, name: s.name.trim(), email: s.email.trim() })),
    `${ORG.name} · ${c.number}`,
  );
}

export const fileNameOf = (c: Contract) => `${c.number.replace(/[^\w.-]+/g, "_")}.pdf`;

export function transportFor(e: Pick<Esign, "mode" | "baseUrl" | "tenantId">, userId: string): Transport {
  return transport(e.mode, e.baseUrl, e.tenantId, userId);
}

/** Merge what SignVault reports into the contract's copy, keeping the tokens it issued earlier. */
function merge(prev: Pick<Esign, "recipients"> | null, v: EnvelopeView, base: Omit<Esign, "status" | "currentRoutingOrder" | "maxRoutingOrder" | "recipients" | "checkedAt" | "sentAt" | "completedAt" | "voidReason" | "originalSha256" | "finalSha256">, invites: Invite[] = []): Esign {
  const tokens = new Map([...(prev?.recipients ?? []).map((r) => [r.id, r.token] as const), ...invites.map((i) => [i.recipientId, i.token] as const)]);
  const meta = new Map((prev?.recipients ?? []).map((r) => [r.id, r]));
  return {
    ...base,
    status: v.envelope.status,
    currentRoutingOrder: v.envelope.currentRoutingOrder,
    maxRoutingOrder: v.envelope.maxRoutingOrder,
    sentAt: v.envelope.sentAt ?? null,
    completedAt: v.envelope.completedAt ?? null,
    voidReason: v.envelope.voidReason ?? null,
    originalSha256: v.documents[0]?.originalSha256 ?? null,
    finalSha256: v.documents[0]?.finalSha256 ?? null,
    recipients: v.recipients.map((r) => ({
      id: r.id,
      role: meta.get(r.id)?.role ?? "Signer",
      party: meta.get(r.id)?.party ?? "",
      name: r.name,
      email: r.email,
      routingOrder: r.routingOrder,
      status: r.status,
      signedAt: r.signedAt ?? null,
      token: tokens.get(r.id),
    })),
    checkedAt: new Date().toISOString(),
  };
}

/** Create the draft envelope, send it, and read it back. */
export async function sendEnvelope(
  tr: Transport,
  tenantId: string,
  c: Contract,
  signers: Array<SignerDraft & { id: string }>,
  pdf: BuiltPdf,
  message: { subject: string; blurb: string },
): Promise<Esign> {
  const { id } = await tr.create({
    title: `${c.number} ${c.title}`.trim(),
    emailSubject: message.subject.trim() || undefined,
    emailBlurb: message.blurb.trim() || undefined,
    documents: [{ fileName: fileNameOf(c), pdfBase64: pdf.base64, pageCount: pdf.pageCount }],
    recipients: signers.map((s) => ({ id: s.id, name: s.name.trim(), email: s.email.trim(), role: "SIGNER" as const, routingOrder: s.routingOrder })),
    fields: pdf.fields,
  });
  const sent = await tr.send(id);
  const view = await tr.get(id);
  const seed = { recipients: signers.map((s) => ({ ...s, status: "PENDING" as const })) };
  return merge(seed, view, { envelopeId: id, mode: tr.mode, baseUrl: tr.baseUrl, tenantId, fileName: fileNameOf(c), pageCount: pdf.pageCount }, sent.invitationLinks);
}

export async function refreshEnvelope(tr: Transport, e: Esign, invites: Invite[] = []): Promise<Esign> {
  return merge(e, await tr.get(e.envelopeId), e, invites);
}

/** Draw a typed signature, the way a signer adopting one in SignVault would. */
export function signaturePng(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 108;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#16244a";
  g.font = "italic 44px 'Segoe Script', 'Brush Script MT', 'Snell Roundhand', Georgia, serif";
  g.textBaseline = "middle";
  g.fillText(name, 16, 56, canvas.width - 32);
  return canvas.toDataURL("image/png");
}

/**
 * Sign as a sandbox recipient: open the signer context, affirm ESIGN consent,
 * and submit a typed signature and the date. For testing the routing only;
 * real signers sign in SignVault themselves.
 */
export async function signAsRecipient(tr: Transport, e: Esign, recipientId: string): Promise<{ esign: Esign; digest: string }> {
  const r = e.recipients.find((x) => x.id === recipientId);
  if (!r?.token) throw new SignVaultError(`${r?.name ?? "This recipient"} hasn't been sent a signing link yet.`, "http", 403);
  const ctx = await tr.signerContext(r.token);
  if (ctx.status !== "READY_TO_SIGN") throw new SignVaultError(ctx.message, "http", 409);
  if (!ctx.recipient.consentAffirmed) await tr.consent(r.token);
  const today = new Date().toISOString().slice(0, 10);
  const fieldValues = Object.fromEntries(ctx.fields.filter((f) => f.type === "DATE_SIGNED").map((f) => [f.id, today]));
  const res = await tr.sign(r.token, { fieldValues, signaturePngBase64: signaturePng(r.name) });
  return { esign: await refreshEnvelope(tr, e, res.nextTierInvites), digest: res.padesDigest };
}

/** Where the envelope stands, in a phrase. */
export function envelopeSummary(e: Esign): string {
  if (e.status === "COMPLETED") return e.mode === "simulated" ? "All signatures in (simulated; not sealed)" : "All signatures in; PDF sealed";
  if (e.status === "VOIDED") return `Voided${e.voidReason ? `: ${e.voidReason}` : ""}`;
  if (e.status === "DRAFT") return "Draft, not sent";
  const waiting = e.recipients.filter((r) => r.routingOrder === e.currentRoutingOrder && r.status !== "SIGNED");
  return `Tier ${e.currentRoutingOrder} of ${e.maxRoutingOrder} · waiting on ${waiting.map((r) => r.name).join(" and ") || "SignVault"}`;
}

export const RECIPIENT_STATUS: Record<RecipientStatus, { label: string; tone: "neutral" | "accent" | "info" | "pos" }> = {
  PENDING: { label: "Not yet their turn", tone: "neutral" },
  SENT: { label: "Invited", tone: "accent" },
  DELIVERED: { label: "Opened", tone: "info" },
  SIGNED: { label: "Signed", tone: "pos" },
};

export const ENVELOPE_STATUS: Record<EnvelopeStatus, { label: string; tone: "neutral" | "warn" | "pos" | "neg" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Out for signature", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "pos" },
  VOIDED: { label: "Voided", tone: "neg" },
};
