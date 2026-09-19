/** SignVault client. One interface, two transports: the real REST API
 *  (see reference.ts) and a simulator that follows the same rules in this
 *  browser: routing tiers, out-of-turn refusals, and a SHA-256 hash-chained
 *  audit log built exactly as the server builds it. The simulator can't apply
 *  a PAdES signature, and says so. */

import type { Mode } from "./config";

/** The server root (for /health), from an API base like http://host:4000/api/v1. */
export const serverRoot = (baseUrl: string) => baseUrl.replace(/\/api\/v\d+$/, "");

export type EnvelopeStatus = "DRAFT" | "SENT" | "COMPLETED" | "VOIDED";
export type RecipientStatus = "PENDING" | "SENT" | "DELIVERED" | "SIGNED";
export type FieldType = "SIGNATURE" | "INITIAL" | "DATE_SIGNED" | "TEXT" | "CHECKBOX";

export interface RecipientInput {
  id: string;
  name: string;
  email: string;
  role: "SIGNER";
  routingOrder: number;
}

export interface FieldInput {
  recipientId: string;
  type: FieldType;
  pageNumber: number;
  coordX: number;
  coordY: number;
  width: number;
  height: number;
  isRequired?: boolean;
}

export interface EnvelopeInput {
  title: string;
  emailSubject?: string;
  emailBlurb?: string;
  documents: Array<{ fileName: string; pdfBase64: string; pageCount: number }>;
  recipients: RecipientInput[];
  fields: FieldInput[];
}

export interface Invite {
  recipientId: string;
  email: string;
  name: string;
  token: string;
  signingUrl: string;
}

export interface EnvelopeView {
  envelope: { id: string; title: string; status: EnvelopeStatus; currentRoutingOrder: number; maxRoutingOrder: number; sentAt?: string | null; completedAt?: string | null; voidReason?: string | null };
  documents: Array<{ id: string; fileName: string; fileSizeBytes: number; pageCount: number; originalSha256?: string | null; finalSha256?: string | null }>;
  recipients: Array<{ id: string; name: string; email: string; routingOrder: number; status: RecipientStatus; signedAt?: string | null }>;
  fields: Array<{ id: string; recipientId: string; type: FieldType; pageNumber: number }>;
}

export interface AuditEvent {
  sequenceNumber: number;
  eventType: string;
  actorType: string;
  actorIdentifier: string;
  actorIp?: string;
  payloadHash: string;
  previousEventHash: string;
  eventHash: string;
  recordedAt: string;
}

export interface AuditTrail {
  envelopeId: string;
  eventCount: number;
  merkleRoot: string | null;
  events: AuditEvent[];
}

export type SignerContext =
  | { status: "READY_TO_SIGN"; recipient: { id: string; name: string; email: string; consentAffirmed: boolean }; fields: Array<{ id: string; type: FieldType }>; legalDisclosure: string }
  | { status: "WAITING_FOR_OTHERS" | "ALREADY_SIGNED" | "COMPLETED" | "VOIDED"; message: string };

export interface SignResult {
  recipientStatus: "SIGNED";
  envelopeStatus: EnvelopeStatus;
  padesDigest: string;
  nextTierInvites: Invite[];
}

export interface Transport {
  mode: Mode;
  baseUrl: string;
  health(): Promise<{ version: string }>;
  create(input: EnvelopeInput): Promise<{ id: string }>;
  send(id: string): Promise<{ status: EnvelopeStatus; currentRoutingOrder: number; invitationLinks: Invite[] }>;
  get(id: string): Promise<EnvelopeView>;
  void(id: string, reason: string): Promise<{ status: EnvelopeStatus }>;
  audit(id: string): Promise<AuditTrail>;
  document(id: string): Promise<Blob>;
  signerContext(token: string): Promise<SignerContext>;
  consent(token: string): Promise<{ affirmedAt: string }>;
  sign(token: string, body: { fieldValues: Record<string, string>; signaturePngBase64: string }): Promise<SignResult>;
}

export class SignVaultError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "http",
    readonly status?: number,
  ) {
    super(message);
  }
}

export function transport(mode: Mode, baseUrl: string, tenantId: string, userId: string): Transport {
  return mode === "simulated" ? simulated(tenantId, userId) : http(baseUrl, tenantId, userId);
}

/* ---------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------- */

function http(baseUrl: string, tenantId: string, userId: string): Transport {
  const call = async <T>(path: string, init: RequestInit & { raw?: boolean } = {}, root = baseUrl): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        ...init,
        headers: { "X-Tenant-ID": tenantId, "X-User-ID": userId, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      });
    } catch {
      throw new SignVaultError(`Couldn't reach SignVault at ${root}. Start it from the Sign_Vault project with \`node apps/api/src/index.js\`, or switch to the simulated SignVault in Settings › Integrations & API.`, "network");
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {
        /* not JSON */
      }
      if (res.status === 404) msg = `${msg}. The sandbox keeps envelopes in memory, so a restart clears them.`;
      throw new SignVaultError(msg, "http", res.status);
    }
    return (init.raw ? res.blob() : res.json()) as Promise<T>;
  };
  const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  const enc = encodeURIComponent;
  return {
    mode: "api",
    baseUrl,
    health: () => call<{ version: string }>("/health", {}, serverRoot(baseUrl)),
    create: async (input) => (await call<{ envelope: { id: string } }>("/envelopes", post(input))).envelope,
    send: (id) => call(`/envelopes/${enc(id)}/send`, post()),
    get: (id) => call(`/envelopes/${enc(id)}`),
    void: (id, reason) => call(`/envelopes/${enc(id)}/void`, post({ reason })),
    audit: (id) => call(`/envelopes/${enc(id)}/audit`),
    document: (id) => call<Blob>(`/envelopes/${enc(id)}/document`, { raw: true }),
    signerContext: (t) => call(`/signing/${enc(t)}`),
    consent: (t) => call(`/signing/${enc(t)}/consent`, post()),
    sign: (t, body) => call(`/signing/${enc(t)}/sign`, post(body)),
  };
}

/* ---------------------------------------------------------------------------
 * Hashing and audit verification
 * ------------------------------------------------------------------------- */

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

/** SignVault's chain rule: eventHash = SHA-256(payloadHash + previousEventHash + eventType + actorIdentifier + recordedAt). */
const eventHashOf = (e: Pick<AuditEvent, "payloadHash" | "previousEventHash" | "eventType" | "actorIdentifier" | "recordedAt">) =>
  sha256(e.payloadHash + e.previousEventHash + e.eventType + e.actorIdentifier + e.recordedAt);

export interface AuditCheck {
  ok: boolean;
  checked: number;
  /** Sequence number of the first event that doesn't hold, and why. */
  brokenAt?: number;
  reason?: string;
}

/** Recompute every link from the genesis hash (SHA-256 of the envelope id) to the Merkle root. */
export async function verifyAudit(trail: AuditTrail): Promise<AuditCheck> {
  let prev = await sha256(trail.envelopeId);
  for (const [i, e] of trail.events.entries()) {
    if (e.sequenceNumber !== i + 1) return { ok: false, checked: i, brokenAt: e.sequenceNumber, reason: "Sequence numbers skip or repeat." };
    if (e.previousEventHash !== prev) return { ok: false, checked: i, brokenAt: e.sequenceNumber, reason: "It doesn't point at the event before it." };
    if ((await eventHashOf(e)) !== e.eventHash) return { ok: false, checked: i, brokenAt: e.sequenceNumber, reason: "Its hash doesn't match its contents." };
    prev = e.eventHash;
  }
  if (trail.events.length && trail.merkleRoot !== prev) return { ok: false, checked: trail.events.length, reason: "The Merkle root isn't the last event's hash." };
  return { ok: true, checked: trail.events.length };
}

/* ---------------------------------------------------------------------------
 * Simulator
 * ------------------------------------------------------------------------- */

const SIM_KEY = "cc.signvault.sim.v1";

interface SimEnvelope {
  view: EnvelopeView;
  pdfBase64: string;
  fieldsByRecipient: Record<string, Array<{ id: string; type: FieldType }>>;
  tokens: Record<string, string>;
  consent: Record<string, string>;
  audit: AuditEvent[];
}

type SimDb = Record<string, SimEnvelope>;

function load(): SimDb {
  try {
    return JSON.parse(localStorage.getItem(SIM_KEY) || "{}") as SimDb;
  } catch {
    return {};
  }
}

function save(db: SimDb) {
  try {
    localStorage.setItem(SIM_KEY, JSON.stringify(db));
  } catch {
    throw new SignVaultError("This browser's storage is full, so the simulated SignVault couldn't save the envelope.", "http", 507);
  }
}

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

function simulated(tenantId: string, userId: string): Transport {
  const now = () => new Date().toISOString();
  const need = (db: SimDb, id: string) => {
    const e = db[id];
    if (!e) throw new SignVaultError("Envelope not found in the simulated SignVault. Clearing this browser's data removes simulated envelopes.", "http", 404);
    return e;
  };
  const append = async (e: SimEnvelope, eventType: string, actorType: string, actorIdentifier: string, payload: unknown) => {
    const payloadHash = await sha256(JSON.stringify(payload));
    const previousEventHash = e.audit.length ? e.audit[e.audit.length - 1]!.eventHash : await sha256(e.view.envelope.id);
    const recordedAt = now();
    const eventHash = await eventHashOf({ payloadHash, previousEventHash, eventType, actorIdentifier, recordedAt });
    e.audit.push({ sequenceNumber: e.audit.length + 1, eventType, actorType, actorIdentifier, actorIp: "127.0.0.1", payloadHash, previousEventHash, eventHash, recordedAt });
  };
  const issue = async (e: SimEnvelope, tier: number): Promise<Invite[]> => {
    const out: Invite[] = [];
    for (const r of e.view.recipients.filter((x) => x.routingOrder === tier)) {
      const token = `${b64url(JSON.stringify({ envelopeId: e.view.envelope.id, recipientId: r.id, tenantId }))}.sim`;
      e.tokens[token] = r.id;
      r.status = "SENT";
      out.push({ recipientId: r.id, email: r.email, name: r.name, token, signingUrl: `/signing/${token}` });
      await append(e, "SIGNER_INVITATION_SENT", "SYSTEM", r.email, { recipientId: r.id, routingOrder: tier });
    }
    return out;
  };
  const byToken = (db: SimDb, token: string) => {
    let payload: { envelopeId?: string } = {};
    try {
      payload = JSON.parse(unb64url(token.split(".")[0] ?? ""));
    } catch {
      /* fall through */
    }
    const e = payload.envelopeId ? db[payload.envelopeId] : undefined;
    const rid = e?.tokens[token];
    if (!e || !rid) throw new SignVaultError("Unauthorized signer token: invalid or superseded.", "http", 401);
    return { e, r: e.view.recipients.find((x) => x.id === rid)! };
  };

  return {
    mode: "simulated",
    baseUrl: "simulated",
    health: async () => ({ version: "simulated" }),
    async create(input) {
      if (!input.title) throw new SignVaultError("Title is required", "http", 400);
      const db = load();
      const id = crypto.randomUUID();
      const bytes = Uint8Array.from(atob(input.documents[0]!.pdfBase64), (c) => c.charCodeAt(0));
      const e: SimEnvelope = {
        view: {
          envelope: { id, title: input.title, status: "DRAFT", currentRoutingOrder: 1, maxRoutingOrder: Math.max(1, ...input.recipients.map((r) => r.routingOrder)) },
          documents: [{ id: crypto.randomUUID(), fileName: input.documents[0]!.fileName, fileSizeBytes: bytes.length, pageCount: input.documents[0]!.pageCount, originalSha256: await sha256(bytes), finalSha256: null }],
          recipients: input.recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, routingOrder: r.routingOrder, status: "PENDING", signedAt: null })),
          fields: input.fields.map((f, i) => ({ id: `fld_${i + 1}`, recipientId: f.recipientId, type: f.type, pageNumber: f.pageNumber })),
        },
        pdfBase64: input.documents[0]!.pdfBase64,
        fieldsByRecipient: {},
        tokens: {},
        consent: {},
        audit: [],
      };
      for (const f of e.view.fields) (e.fieldsByRecipient[f.recipientId] ??= []).push({ id: f.id, type: f.type });
      await append(e, "ENVELOPE_CREATED", "USER", userId, { title: input.title, documentCount: 1, recipientCount: input.recipients.length, fieldCount: input.fields.length });
      db[id] = e;
      save(db);
      return { id };
    },
    async send(id) {
      const db = load();
      const e = need(db, id);
      if (e.view.envelope.status !== "DRAFT") throw new SignVaultError(`Cannot send envelope in ${e.view.envelope.status} state`, "http", 400);
      e.view.envelope.status = "SENT";
      e.view.envelope.sentAt = now();
      const invitationLinks = await issue(e, 1);
      await append(e, "ENVELOPE_SENT", "USER", userId, { tier1Count: invitationLinks.length });
      save(db);
      return { status: "SENT", currentRoutingOrder: 1, invitationLinks };
    },
    async get(id) {
      return need(load(), id).view;
    },
    async void(id, reason) {
      const db = load();
      const e = need(db, id);
      if (e.view.envelope.status === "COMPLETED") throw new SignVaultError("Cannot void completed envelope", "http", 400);
      e.view.envelope.status = "VOIDED";
      e.view.envelope.voidReason = reason;
      e.tokens = {};
      await append(e, "ENVELOPE_VOIDED", "USER", userId, { reason });
      save(db);
      return { status: "VOIDED" };
    },
    async audit(id) {
      const e = need(load(), id);
      return { envelopeId: id, eventCount: e.audit.length, merkleRoot: e.audit.length ? e.audit[e.audit.length - 1]!.eventHash : null, events: e.audit };
    },
    async document(id) {
      const e = need(load(), id);
      return new Blob([Uint8Array.from(atob(e.pdfBase64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
    },
    async signerContext(token) {
      const db = load();
      const { e, r } = byToken(db, token);
      const env = e.view.envelope;
      if (env.status === "COMPLETED") return { status: "COMPLETED", message: "This document has already been fully executed." };
      if (env.status === "VOIDED") return { status: "VOIDED", message: `This document was voided: ${env.voidReason ?? "No reason provided"}.` };
      if (r.routingOrder > env.currentRoutingOrder) return { status: "WAITING_FOR_OTHERS", message: "It is not your turn to sign yet. Prior recipients are currently completing the document." };
      if (r.status === "SIGNED") return { status: "ALREADY_SIGNED", message: "You have already completed signing this document." };
      if (r.status === "SENT") {
        r.status = "DELIVERED";
        await append(e, "ENVELOPE_DELIVERED", "RECIPIENT", r.email, { recipientId: r.id });
        save(db);
      }
      return {
        status: "READY_TO_SIGN",
        recipient: { id: r.id, name: r.name, email: r.email, consentAffirmed: !!e.consent[r.id] },
        fields: e.fieldsByRecipient[r.id] ?? [],
        legalDisclosure: 'By clicking "I Agree", you consent to use electronic records and signatures pursuant to the Electronic Signatures in Global and National Commerce Act (ESIGN Act).',
      };
    },
    async consent(token) {
      const db = load();
      const { e, r } = byToken(db, token);
      const at = now();
      e.consent[r.id] = at;
      await append(e, "CONSENT_AFFIRMED", "RECIPIENT", r.email, { consentTextHash: await sha256("ESIGN_CONSENT_V1") });
      save(db);
      return { affirmedAt: at };
    },
    async sign(token) {
      const db = load();
      const { e, r } = byToken(db, token);
      const env = e.view.envelope;
      if (env.status !== "SENT") throw new SignVaultError("Envelope not available for signing", "http", 400);
      if (r.routingOrder !== env.currentRoutingOrder) throw new SignVaultError("Out of turn signing is prohibited", "http", 400);
      // No PAdES here: the digest stands in for one so the audit trail reads the same.
      const padesDigest = await sha256(`${e.pdfBase64}|${r.id}|${now()}`);
      r.status = "SIGNED";
      r.signedAt = now();
      await append(e, "DOCUMENT_SIGNED", "RECIPIENT", r.email, { recipientId: r.id, padesDigest, simulated: true });
      let nextTierInvites: Invite[] = [];
      const tier = e.view.recipients.filter((x) => x.routingOrder === env.currentRoutingOrder);
      if (tier.every((x) => x.status === "SIGNED")) {
        const next = env.currentRoutingOrder + 1;
        if (e.view.recipients.some((x) => x.routingOrder === next)) {
          env.currentRoutingOrder = next;
          nextTierInvites = await issue(e, next);
        } else {
          env.status = "COMPLETED";
          env.completedAt = now();
          e.view.documents[0]!.finalSha256 = await sha256(Uint8Array.from(atob(e.pdfBase64), (c) => c.charCodeAt(0)));
          e.tokens = {};
          await append(e, "ENVELOPE_COMPLETED", "SYSTEM", "SYSTEM_SEALER", { totalSigners: e.view.recipients.length });
        }
      }
      save(db);
      return { recipientStatus: "SIGNED", envelopeStatus: env.status, padesDigest, nextTierInvites };
    },
  };
}
