/** SignVault e-signature API: the reference shown under Settings ›
 *  Integrations & API, and the coordinate math contracts need to place
 *  signature fields. Mirrors Sign_Vault/docs/api/api-reference.md; update both
 *  together. Nothing here calls the API: the static build has no server to
 *  hold a key, so envelopes are sent from a backend once there is one. */

export type Env = "sandbox" | "production";

export const BASE_URLS: Record<Env, { label: string; url: string }> = {
  sandbox: { label: "Sandbox / Local", url: "http://localhost:4000/api/v1" },
  production: { label: "Production", url: "https://api.signvault.io/api/v1" },
};

export const STANDARDS = ["ETSI PAdES (ISO 32000-1 / ETSI EN 319 142)", "US ESIGN Act", "UETA", "EU eIDAS"];

/** The eight chapters of the reference, in order. */
export const CHAPTERS = [
  { id: "protocol", n: 1, title: "Protocol & architectural conventions", hint: "TLS 1.3, base URLs, JSON and PDF headers" },
  { id: "auth", n: 2, title: "Authentication & tenant context", hint: "Management X-Tenant-ID vs HMAC signer tokens" },
  { id: "errors", n: 3, title: "Standard response & error formats", hint: "RFC 7807 problem details and status codes" },
  { id: "envelopes", n: 4, title: "Envelope management API", hint: "/api/v1/envelopes" },
  { id: "signing", n: 5, title: "Public signer API", hint: "/api/v1/signing" },
  { id: "coords", n: 6, title: "Coordinate translation", hint: "DOM CSS px to PDF 72-pt, bottom-left origin" },
  { id: "webhooks", n: 7, title: "Webhook event delivery", hint: "Payload events and HMAC-SHA256 verification" },
  { id: "quickstart", n: 8, title: "Developer quickstart", hint: "cURL and Node.js / TypeScript" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

/* ---------------------------------------------------------------------------
 * 1–3. Conventions, authentication, errors
 * ------------------------------------------------------------------------- */

export const TRANSPORT = [
  "Production requests require TLS 1.3 (TLS 1.2 minimum).",
  "Request and response bodies are UTF-8 application/json, except PDF downloads (application/pdf).",
  "Timestamps are ISO 8601 UTC: YYYY-MM-DDTHH:mm:ss.sssZ.",
];

export const MANAGEMENT_HEADERS = [
  { name: "X-Tenant-ID", required: true, about: "UUID of the organization. Enforces PostgreSQL row-level security." },
  { name: "X-User-ID", required: false, about: "The acting user, recorded on the audit trail." },
  { name: "Authorization", required: true, about: "Bearer API key or JWT." },
  { name: "Content-Type", required: true, about: "application/json" },
];

export const MANAGEMENT_HEADER_EXAMPLE = `X-Tenant-ID: 12345678-1234-1234-1234-123456789012
X-User-ID: usr_admin_98765
Authorization: Bearer <api_key_or_jwt>
Content-Type: application/json`;

export const SIGNER_TOKEN = "Token = base64url(Payload) || '.' || HMAC-SHA256(base64url(Payload), Secret)";

export const SUCCESS_SHAPE = `{
  "success": true,
  "data": { ... }
}`;

export const ERROR_SHAPE = `{
  "error": "Detailed description of the validation or domain error",
  "code": "OUT_OF_TURN_SIGNING",
  "statusCode": 400
}`;

export const STATUS_CODES: Array<{ code: number; meaning: string; about: string }> = [
  { code: 200, meaning: "OK", about: "Request succeeded." },
  { code: 201, meaning: "Created", about: "Resource created." },
  { code: 400, meaning: "Bad Request", about: "Invalid schema, missing required fields, or an illegal state transition." },
  { code: 401, meaning: "Unauthorized", about: "Missing or invalid API key, or an expired or tampered signer token." },
  { code: 403, meaning: "Forbidden", about: "Out-of-turn signing attempt or cross-tenant access." },
  { code: 404, meaning: "Not Found", about: "The resource doesn't exist in the active tenant." },
  { code: 409, meaning: "Conflict", about: "Optimistic lock failure (version mismatch)." },
  { code: 500, meaning: "Internal Error", about: "Cryptographic engine failure or unexpected server error." },
];

/** Envelope lifecycle from the state diagram in §4. */
export const LIFECYCLE: Array<{ from: string; to: string; via: string }> = [
  { from: "—", to: "DRAFT", via: "POST /envelopes" },
  { from: "DRAFT", to: "SENT", via: "POST /envelopes/{id}/send" },
  { from: "SENT", to: "SENT", via: "Each routing tier completes; the next tier activates" },
  { from: "SENT", to: "COMPLETED", via: "Final tier signs; PAdES seal applied" },
  { from: "DRAFT or SENT", to: "VOIDED", via: "POST /envelopes/{id}/void" },
];

/* ---------------------------------------------------------------------------
 * 4–5. Endpoints
 * ------------------------------------------------------------------------- */

export interface Param {
  name: string;
  type: string;
  required: boolean;
  about: string;
}

export interface Endpoint {
  id: string;
  chapter: "envelopes" | "signing";
  ref: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  summary: string;
  auth: string;
  params?: Param[];
  request?: string;
  responses: Array<{ label: string; body: string }>;
}

export const ENDPOINTS: Endpoint[] = [
  {
    id: "create",
    chapter: "envelopes",
    ref: "4.1",
    method: "POST",
    path: "/envelopes",
    title: "Create envelope draft",
    summary: "Creates a draft envelope with its documents, recipients, routing tiers, and form fields.",
    auth: "Management headers (X-Tenant-ID)",
    params: [
      { name: "title", type: "string", required: true, about: "Human-readable title of the transaction." },
      { name: "emailSubject", type: "string", required: false, about: "Subject line for recipient invitations." },
      { name: "emailBlurb", type: "string", required: false, about: "Custom message in the invitation email." },
      { name: "documents", type: "array", required: true, about: "PDF documents; at least one." },
      { name: "documents[].fileName", type: "string", required: true, about: "File name including .pdf." },
      { name: "documents[].pdfBase64", type: "string", required: true, about: "Base64-encoded PDF." },
      { name: "recipients", type: "array", required: true, about: "Recipient objects." },
      { name: "recipients[].id", type: "string", required: false, about: "Client UUID; generated if omitted." },
      { name: "recipients[].name", type: "string", required: true, about: "Full legal name." },
      { name: "recipients[].email", type: "string", required: true, about: "Email address." },
      { name: "recipients[].role", type: "string", required: false, about: "SIGNER (default), APPROVER, VIEWER, IN_PERSON_SIGNER." },
      { name: "recipients[].routingOrder", type: "integer", required: false, about: "Routing tier (1, 2, 3…). Default 1." },
      { name: "recipients[].authMethod", type: "string", required: false, about: "NONE (default), EMAIL_OTP, SMS_OTP, ACCESS_CODE." },
      { name: "fields", type: "array", required: false, about: "Form fields (tabs) placed on documents." },
      { name: "fields[].recipientId", type: "string", required: true, about: "Recipient assigned to the field." },
      { name: "fields[].documentId", type: "string", required: false, about: "Target document; defaults to the primary document." },
      { name: "fields[].type", type: "string", required: true, about: "SIGNATURE, INITIAL, DATE_SIGNED, TEXT, CHECKBOX." },
      { name: "fields[].pageNumber", type: "integer", required: true, about: "0-indexed page." },
      { name: "fields[].coordX", type: "number", required: true, about: "PDF X in points from the left." },
      { name: "fields[].coordY", type: "number", required: true, about: "PDF Y in points from the bottom." },
      { name: "fields[].width", type: "number", required: true, about: "Width in points." },
      { name: "fields[].height", type: "number", required: true, about: "Height in points." },
      { name: "fields[].isRequired", type: "boolean", required: false, about: "Default true." },
    ],
    request: `{
  "title": "Vendor Master Services Agreement",
  "emailSubject": "Please sign: Vendor Master Services Agreement",
  "documents": [
    { "fileName": "MSA_2026.pdf", "pdfBase64": "JVBERi0xLjcgCiW1tbW1CjEgMCBvYmoKPDw..." }
  ],
  "recipients": [
    { "id": "rec_vendor", "name": "Jane Vendor", "email": "jane@vendor.com", "routingOrder": 1 },
    { "id": "rec_internal_vp", "name": "Alex VP", "email": "alex@company.com", "routingOrder": 2 }
  ],
  "fields": [
    { "recipientId": "rec_vendor", "type": "SIGNATURE", "pageNumber": 0, "coordX": 50.0, "coordY": 520.0, "width": 220.0, "height": 60.0 }
  ]
}`,
    responses: [
      {
        label: "201 Created",
        body: `{
  "success": true,
  "envelope": {
    "id": "7fa84d12-6789-4a0b-9366-0123456789ab",
    "tenantId": "12345678-1234-1234-1234-123456789012",
    "creatorId": "usr_89211",
    "title": "Vendor Master Services Agreement",
    "status": "DRAFT",
    "currentRoutingOrder": 1,
    "maxRoutingOrder": 2,
    "version": 1,
    "createdAt": "2026-09-19T09:30:00.000Z",
    "updatedAt": "2026-09-19T09:30:00.000Z"
  },
  "documentCount": 1,
  "recipientCount": 2,
  "fieldCount": 1
}`,
      },
    ],
  },
  {
    id: "get",
    chapter: "envelopes",
    ref: "4.2",
    method: "GET",
    path: "/envelopes/{id}",
    title: "Get envelope details",
    summary: "Status, documents, recipient progress, and form fields for one envelope.",
    auth: "Management headers (X-Tenant-ID)",
    responses: [
      {
        label: "200 OK",
        body: `{
  "envelope": {
    "id": "7fa84d12-6789-4a0b-9366-0123456789ab",
    "title": "Vendor Master Services Agreement",
    "status": "SENT",
    "currentRoutingOrder": 1,
    "maxRoutingOrder": 2,
    "sentAt": "2026-09-19T09:35:00.000Z"
  },
  "documents": [
    {
      "id": "doc_101",
      "fileName": "MSA_2026.pdf",
      "fileSizeBytes": 524288,
      "pageCount": 3,
      "originalSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "finalSha256": null
    }
  ],
  "recipients": [
    { "id": "rec_vendor", "name": "Jane Vendor", "email": "jane@vendor.com", "routingOrder": 1, "status": "SENT", "signedAt": null },
    { "id": "rec_internal_vp", "name": "Alex VP", "email": "alex@company.com", "routingOrder": 2, "status": "PENDING", "signedAt": null }
  ],
  "fields": [
    { "id": "fld_301", "type": "SIGNATURE", "recipientId": "rec_vendor", "pageNumber": 0, "coordX": 50.0, "coordY": 520.0, "width": 220.0, "height": 60.0, "value": null }
  ]
}`,
      },
    ],
  },
  {
    id: "send",
    chapter: "envelopes",
    ref: "4.3",
    method: "POST",
    path: "/envelopes/{id}/send",
    title: "Send envelope",
    summary: "Locks the draft, moves it to SENT, activates tier 1 routing (sequential or parallel), and issues signing links.",
    auth: "Management headers (X-Tenant-ID)",
    responses: [
      {
        label: "200 OK",
        body: `{
  "success": true,
  "status": "SENT",
  "currentRoutingOrder": 1,
  "invitationLinks": [
    {
      "recipientId": "rec_vendor",
      "email": "jane@vendor.com",
      "name": "Jane Vendor",
      "token": "eyJhbGciOiJIUzI1NiJ9.eyJlbnZlbG9wZUlkIjoiN2ZhOD...k2Yw",
      "signingUrl": "/signing/eyJhbGciOiJIUzI1NiJ9.eyJlbnZlbG9wZUlkIjoiN2ZhOD...k2Yw"
    }
  ]
}`,
      },
    ],
  },
  {
    id: "void",
    chapter: "envelopes",
    ref: "4.4",
    method: "POST",
    path: "/envelopes/{id}/void",
    title: "Void envelope",
    summary: "Cancels a draft or active envelope, invalidates every outstanding signing token, and records an audit event.",
    auth: "Management headers (X-Tenant-ID)",
    params: [{ name: "reason", type: "string", required: true, about: "Why the envelope was voided; kept on the audit trail." }],
    request: `{
  "reason": "Contract renegotiation requested by vendor"
}`,
    responses: [
      {
        label: "200 OK",
        body: `{
  "success": true,
  "status": "VOIDED",
  "reason": "Contract renegotiation requested by vendor"
}`,
      },
    ],
  },
  {
    id: "audit",
    chapter: "envelopes",
    ref: "4.5",
    method: "GET",
    path: "/envelopes/{id}/audit",
    title: "Get audit trail",
    summary: "The immutable, Merkle hash-chained audit log. Each event's hash covers the one before it.",
    auth: "Management headers (X-Tenant-ID)",
    responses: [
      {
        label: "200 OK",
        body: `{
  "envelopeId": "7fa84d12-6789-4a0b-9366-0123456789ab",
  "eventCount": 4,
  "merkleRoot": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "events": [
    {
      "sequenceNumber": 1,
      "eventType": "ENVELOPE_CREATED",
      "actorType": "USER",
      "actorIdentifier": "usr_89211",
      "actorIp": "192.168.1.1",
      "payloadHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "previousEventHash": "7fa84d1267894a0b93660123456789ab00000000000000000000000000000000",
      "eventHash": "b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1",
      "recordedAt": "2026-09-19T09:30:00.100Z"
    },
    {
      "sequenceNumber": 2,
      "eventType": "ENVELOPE_SENT",
      "actorType": "USER",
      "actorIdentifier": "usr_89211",
      "actorIp": "192.168.1.1",
      "payloadHash": "8f4811a2d1d0f...3e01",
      "previousEventHash": "b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1",
      "eventHash": "c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2",
      "recordedAt": "2026-09-19T09:35:00.200Z"
    }
  ]
}`,
      },
    ],
  },
  {
    id: "document",
    chapter: "envelopes",
    ref: "4.6",
    method: "GET",
    path: "/envelopes/{id}/document",
    title: "Download document",
    summary: "The PDF as it stands, or fully executed once the envelope completes.",
    auth: "Management headers (X-Tenant-ID)",
    responses: [{ label: "200 OK · binary", body: `Content-Type: application/pdf\nContent-Disposition: attachment; filename="..."` }],
  },
  {
    id: "signer",
    chapter: "signing",
    ref: "5.1",
    method: "GET",
    path: "/signing/{token}",
    title: "Get signer context",
    summary: "Document metadata, legal disclosures, and the fields assigned to this recipient.",
    auth: "HMAC signer token in the path",
    responses: [
      {
        label: "200 OK · ready to sign",
        body: `{
  "status": "READY_TO_SIGN",
  "envelope": { "id": "7fa84d12-6789-4a0b-9366-0123456789ab", "title": "Vendor Master Services Agreement", "status": "SENT" },
  "recipient": { "id": "rec_vendor", "name": "Jane Vendor", "email": "jane@vendor.com", "consentAffirmed": false },
  "documents": [{ "id": "doc_101", "fileName": "MSA_2026.pdf", "pageCount": 3, "fileSizeBytes": 524288 }],
  "fields": [{ "id": "fld_301", "type": "SIGNATURE", "pageNumber": 0, "coordX": 50.0, "coordY": 520.0, "width": 220.0, "height": 60.0 }],
  "legalDisclosure": "By clicking 'I Agree', you consent to use electronic records and signatures pursuant to the Electronic Signatures in Global and National Commerce Act (ESIGN Act)."
}`,
      },
      {
        label: "200 OK · waiting for others",
        body: `{
  "status": "WAITING_FOR_OTHERS",
  "message": "It is not your turn to sign yet. Prior recipients are currently completing the document.",
  "routingOrder": 2,
  "currentRoutingOrder": 1
}`,
      },
      {
        label: "200 OK · already signed",
        body: `{
  "status": "ALREADY_SIGNED",
  "message": "You have already completed signing this document.",
  "signedAt": "2026-09-19T09:40:12.000Z"
}`,
      },
    ],
  },
  {
    id: "consent",
    chapter: "signing",
    ref: "5.2",
    method: "POST",
    path: "/signing/{token}/consent",
    title: "Affirm ESIGN consent",
    summary: "Records the recipient's affirmative opt-in to electronic records under ESIGN Act §101(c).",
    auth: "HMAC signer token in the path",
    responses: [
      {
        label: "200 OK",
        body: `{
  "success": true,
  "affirmedAt": "2026-09-19T09:38:22.105Z"
}`,
      },
    ],
  },
  {
    id: "sign",
    chapter: "signing",
    ref: "5.3",
    method: "POST",
    path: "/signing/{token}/sign",
    title: "Submit signature",
    summary: "Submits field values and the signature image, applies the PAdES digital signature, and advances routing.",
    auth: "HMAC signer token in the path",
    params: [
      { name: "fieldValues", type: "object", required: false, about: "Field id → value for text, date, and checkbox fields." },
      { name: "signaturePngBase64", type: "string", required: true, about: "Signature image as a PNG data URL." },
    ],
    request: `{
  "fieldValues": {
    "fld_title": "Director of Operations",
    "fld_date": "2026-09-19"
  },
  "signaturePngBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}`,
    responses: [
      {
        label: "200 OK · next tier invited",
        body: `{
  "success": true,
  "recipientStatus": "SIGNED",
  "envelopeStatus": "SENT",
  "padesDigest": "bb67844eee7052163c8cc37aabf45a6ef8ac3aba58a4ef2369617cf2fb5fab8f",
  "nextTierInvites": [
    {
      "recipientId": "rec_internal_vp",
      "email": "alex@company.com",
      "name": "Alex VP",
      "token": "eyJhbGciOiJIUzI1NiJ9.eyJlbnZlbG9wZUlkIjoiN2ZhOD...m0A",
      "signingUrl": "/signing/eyJhbGciOiJIUzI1NiJ9.eyJlbnZlbG9wZUlkIjoiN2ZhOD...m0A"
    }
  ]
}`,
      },
      {
        label: "200 OK · final tier, document sealed",
        body: `{
  "success": true,
  "recipientStatus": "SIGNED",
  "envelopeStatus": "COMPLETED",
  "padesDigest": "4f53cda18c2b9a7123ef00192837465019283746501928374650192837465019",
  "nextTierInvites": []
}`,
      },
    ],
  },
  {
    id: "signer-doc",
    chapter: "signing",
    ref: "5.4",
    method: "GET",
    path: "/signing/{token}/document",
    title: "Stream signer document",
    summary: "Streams the PDF to an authorized recipient for the in-browser viewer.",
    auth: "HMAC signer token in the path",
    responses: [{ label: "200 OK · binary", body: `Content-Type: application/pdf\nContent-Disposition: inline` }],
  },
];

/* ---------------------------------------------------------------------------
 * 6. Coordinate translation
 * ------------------------------------------------------------------------- */

export const FORMULAS = [
  "Scaleₓ = PageWidthₚₜ ÷ ViewportWidthₚₓ",
  "Scaleᵧ = PageHeightₚₜ ÷ ViewportHeightₚₓ",
  "PDFₓ = x × Scaleₓ",
  "PDFᵧ = PageHeightₚₜ − (y + height) × Scaleᵧ",
  "PDF width = width × Scaleₓ;  PDF height = height × Scaleᵧ",
];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A field drawn on the page preview (CSS px, top-left origin) to the
 * coordinates SignVault expects (PDF points, 72 per inch, bottom-left origin).
 */
export function cssToPdf(field: Box, viewport: { width: number; height: number }, page: { width: number; height: number }): Box {
  const sx = page.width / viewport.width;
  const sy = page.height / viewport.height;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(field.x * sx), y: r(page.height - (field.y + field.height) * sy), width: r(field.width * sx), height: r(field.height * sy) };
}

/** Common page sizes in points. */
export const PAGE_SIZES = [
  { id: "letter", label: "US Letter (8.5 × 11 in)", width: 612, height: 792 },
  { id: "legal", label: "US Legal (8.5 × 14 in)", width: 612, height: 1008 },
  { id: "tabloid", label: "Tabloid (11 × 17 in)", width: 792, height: 1224 },
  { id: "a4", label: "A4 (210 × 297 mm)", width: 595.28, height: 841.89 },
];

/* ---------------------------------------------------------------------------
 * 7. Webhooks
 * ------------------------------------------------------------------------- */

export const WEBHOOK_EVENTS: Array<{ name: string; about: string }> = [
  { name: "envelope.created", about: "Envelope draft initiated." },
  { name: "envelope.sent", about: "Envelope dispatched into active routing." },
  { name: "recipient.delivered", about: "Recipient opened the document." },
  { name: "recipient.consent_affirmed", about: "Signer affirmed ESIGN consent." },
  { name: "recipient.signed", about: "Signer completed their digital signature." },
  { name: "envelope.completed", about: "All tiers finished; final PAdES seal applied." },
  { name: "envelope.voided", about: "Envelope cancelled by the sender." },
];

export const WEBHOOK_REQUEST = `POST /webhook-endpoint HTTP/1.1
Host: customer-app.com
X-SignVault-Signature: t=1726738500,v1=a1b2c3d4e5f67890abcdef...
Content-Type: application/json`;

export const WEBHOOK_VERIFY = `const crypto = require('node:crypto');

function verifyWebhook(payloadString, signatureHeader, secret) {
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
  const signature = parts.find(p => p.startsWith('v1=')).split('=')[1];

  const signedPayload = \`\${timestamp}.\${payloadString}\`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}`;

/* ---------------------------------------------------------------------------
 * 8. Quickstart
 * ------------------------------------------------------------------------- */

export const QUICKSTART_TS = `import fs from 'node:fs';

const API_BASE = 'https://api.signvault.io/api/v1';
const TENANT_ID = '12345678-1234-1234-1234-123456789012';

async function sendContract() {
  const pdfBytes = fs.readFileSync('Contract.pdf');

  // 1. Create Draft
  const createRes = await fetch(\`\${API_BASE}/envelopes\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': TENANT_ID,
    },
    body: JSON.stringify({
      title: 'Consulting Agreement 2026',
      documents: [{ fileName: 'Consulting_Agreement.pdf', pdfBase64: pdfBytes.toString('base64') }],
      recipients: [{ name: 'Jane Consultant', email: 'jane@consultant.com', routingOrder: 1 }],
      fields: [{ type: 'SIGNATURE', pageNumber: 0, coordX: 50, coordY: 200, width: 200, height: 60 }],
    }),
  });

  const { envelope } = await createRes.json();
  console.log(\`Created Draft ID: \${envelope.id}\`);

  // 2. Dispatch Envelope
  const sendRes = await fetch(\`\${API_BASE}/envelopes/\${envelope.id}/send\`, {
    method: 'POST',
    headers: { 'X-Tenant-ID': TENANT_ID },
  });

  const sendData = await sendRes.json();
  console.log(\`Signer Link: \${sendData.invitationLinks[0].signingUrl}\`);
}

sendContract().catch(console.error);`;

export const QUICKSTART_CURL = `# 1. Create Envelope Draft
curl -X POST "https://api.signvault.io/api/v1/envelopes" \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: 12345678-1234-1234-1234-123456789012" \\
  -d '{
    "title": "NDA Agreement",
    "documents": [{ "fileName": "NDA.pdf", "pdfBase64": "JVBERi0xLjc..." }],
    "recipients": [{ "name": "Bob Signer", "email": "bob@example.com", "routingOrder": 1 }]
  }'

# 2. Dispatch Envelope
curl -X POST "https://api.signvault.io/api/v1/envelopes/7fa84d12-6789-4a0b-9366-0123456789ab/send" \\
  -H "X-Tenant-ID: 12345678-1234-1234-1234-123456789012"`;
