"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Copy, FileSignature } from "lucide-react";
import { Badge, Chip } from "@/components/ui/data";
import { Button, Segmented } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { cx } from "@/lib/format";
import {
  BASE_URLS,
  CHAPTERS,
  cssToPdf,
  ENDPOINTS,
  ERROR_SHAPE,
  FORMULAS,
  LIFECYCLE,
  MANAGEMENT_HEADER_EXAMPLE,
  MANAGEMENT_HEADERS,
  PAGE_SIZES,
  QUICKSTART_CURL,
  QUICKSTART_TS,
  SIGNER_TOKEN,
  STANDARDS,
  STATUS_CODES,
  SUCCESS_SHAPE,
  TRANSPORT,
  WEBHOOK_EVENTS,
  WEBHOOK_REQUEST,
  WEBHOOK_VERIFY,
  type ChapterId,
  type Endpoint,
  type Env,
} from "@/lib/signvault";
import { CURRENT_USER_ID } from "@/mock/org";

/** Placeholder tenant and secret until SignVault provisions the real ones. */
const TENANT_ID = "7c1e2a90-4b3d-4f6e-9a21-5d8c0b7e3f14";
const WEBHOOK_SECRET = "whsec_4e9b1c7a2f6d8e0b3a5c7d9f1e2b4a6c";

const copy = (text: string, what: string) =>
  navigator.clipboard?.writeText(text).then(
    () => toast(`${what} copied`),
    () => toast("Copy failed — select the text and copy it manually"),
  );

/** SignVault connection details and the full API reference, in the reference's own eight chapters. */
export function SignVaultApi() {
  const [env, setEnv] = useState<Env>("sandbox");
  const [chapter, setChapter] = useState<ChapterId>("protocol");
  const [revealed, setRevealed] = useState(false);
  const base = BASE_URLS[env].url;

  return (
    <Panel
      id="signvault"
      title="SignVault e-signature API"
      info="Mirrors docs/api/api-reference.md in the SignVault project. Envelopes are sent server-side; this static build doesn't call the API or hold its key."
      actions={<FileSignature className="size-4 text-ink-3" aria-hidden />}
    >
      <p className="max-w-[72ch] text-sm text-ink-2">
        Routes contracts, change orders, and task orders for signature and returns sealed PDFs with a hash-chained audit trail. Signatures conform to:
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {STANDARDS.map((s) => (
          <li key={s}>
            <Badge tone="neutral" dot={false}>
              {s}
            </Badge>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-surface-2 p-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <dt className="mb-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink-2">
            Base URL
            <Segmented size="sm" label="Environment" value={env} onChange={setEnv} options={[{ value: "sandbox", label: "Sandbox" }, { value: "production", label: "Production" }]} />
          </dt>
          <dd>
            <CopyLine value={base} what="Base URL" />
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs font-semibold text-ink-2">X-Tenant-ID</dt>
          <dd>
            <CopyLine value={TENANT_ID} what="Tenant ID" />
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs font-semibold text-ink-2">X-User-ID (acting user)</dt>
          <dd>
            <CopyLine value={CURRENT_USER_ID} what="User ID" />
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="mb-1 text-xs font-semibold text-ink-2">Webhook signing secret</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code className="num flex h-8 min-w-0 flex-1 items-center truncate rounded-md border border-line bg-surface px-3 text-xs text-ink">{revealed ? WEBHOOK_SECRET : `whsec_${"•".repeat(24)}${WEBHOOK_SECRET.slice(-4)}`}</code>
            <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => !r)}>
              {revealed ? "Hide" : "Reveal"}
            </Button>
            <Button size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => copy(WEBHOOK_SECRET, "Webhook secret")}>
              Copy
            </Button>
          </dd>
          <dd className="mt-1 text-xs text-ink-3">Verifies the X-SignVault-Signature header on events SignVault sends back (chapter 7).</dd>
        </div>
      </dl>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="SignVault API reference" className="lg:sticky lg:top-0 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={chapter === c.id ? "true" : undefined}
                  onClick={() => setChapter(c.id)}
                  className={cx("flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left whitespace-nowrap lg:whitespace-normal", chapter === c.id ? "bg-accent-tint text-accent-ink" : "text-ink-2 hover:bg-sunk hover:text-ink")}
                >
                  <span className="num w-4 shrink-0 text-xs font-bold">{c.n}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{c.title}</span>
                    <span className="hidden text-2xs text-ink-3 lg:block">{c.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section aria-live="polite" className="min-w-0">
          <Chapter id={chapter} base={base} />
        </section>
      </div>
    </Panel>
  );
}

function Chapter({ id, base }: { id: ChapterId; base: string }) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return (
    <div className="space-y-4">
      <header>
        <p className="num text-xs font-semibold text-ink-3">Chapter {c.n}</p>
        <h3 className="text-md font-semibold text-ink">{c.title}</h3>
      </header>
      {id === "protocol" && <Protocol />}
      {id === "auth" && <Auth />}
      {id === "errors" && <Errors />}
      {id === "envelopes" && <Endpoints chapter="envelopes" base={base} />}
      {id === "signing" && <Endpoints chapter="signing" base={base} />}
      {id === "coords" && <Coords />}
      {id === "webhooks" && <Webhooks />}
      {id === "quickstart" && <Quickstart />}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Chapters
 * ------------------------------------------------------------------------- */

function Protocol() {
  return (
    <>
      <Table head={["Environment", "Base URL"]} rows={Object.values(BASE_URLS).map((b) => [b.label, <code key="u" className="text-xs">{b.url}</code>])} />
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
        {TRANSPORT.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

function Auth() {
  return (
    <>
      <p className="text-sm text-ink-2">Management operations (creating and managing envelopes) and signer operations (recipients executing documents) authenticate differently.</p>
      <Table
        head={["Who", "Authenticates with"]}
        rows={[
          ["API consumer or enterprise admin", "HTTP headers: X-Tenant-ID and an API key"],
          ["External recipient or signer", "An HMAC-SHA256-signed URL token: /signing/{token}"],
        ]}
      />
      <h4 className="text-sm font-semibold text-ink">Management headers</h4>
      <Table head={["Header", "Required", "Purpose"]} rows={MANAGEMENT_HEADERS.map((h) => [<code key="h" className="text-xs">{h.name}</code>, h.required ? "Yes" : "No", h.about])} />
      <Code text={MANAGEMENT_HEADER_EXAMPLE} label="Management headers" />
      <h4 className="text-sm font-semibold text-ink">Signer tokens</h4>
      <p className="text-sm text-ink-2">Signers need no account or password. When an envelope reaches their routing tier, SignVault issues a URL-safe, tamper-evident token:</p>
      <Code text={SIGNER_TOKEN} label="Token format" />
    </>
  );
}

function Errors() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Code text={SUCCESS_SHAPE} label="Success · 200 or 201" />
        <Code text={ERROR_SHAPE} label="Error · RFC 7807 problem details" />
      </div>
      <Table head={["Code", "Meaning", "When"]} rows={STATUS_CODES.map((s) => [<span key="c" className={cx("num font-semibold", s.code >= 400 ? "text-neg-ink" : "text-pos-ink")}>{s.code}</span>, s.meaning, s.about])} />
    </>
  );
}

function Endpoints({ chapter, base }: { chapter: "envelopes" | "signing"; base: string }) {
  const list = ENDPOINTS.filter((e) => e.chapter === chapter);
  return (
    <>
      <p className="text-sm text-ink-2">
        Base route <code className="text-xs">/api/v1/{chapter}</code>.{" "}
        {chapter === "envelopes" ? "Every call carries the management headers." : "Called by signers and embedded signing UI; the HMAC token in the path is the only credential."}
      </p>
      {chapter === "envelopes" && (
        <ol aria-label="Envelope lifecycle" className="grid gap-1.5 rounded-md bg-surface-2 p-3 sm:grid-cols-2">
          {LIFECYCLE.map((l) => (
            <li key={l.via} className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
              <Chip>{l.from}</Chip>
              <span aria-hidden>→</span>
              <span className="sr-only">to</span>
              <Chip tone={l.to === "COMPLETED" ? "pos" : l.to === "VOIDED" ? "neg" : "accent"}>{l.to}</Chip>
              <span className="min-w-0">{l.via}</span>
            </li>
          ))}
        </ol>
      )}
      <ul className="space-y-2">
        {list.map((e) => (
          <EndpointCard key={e.id} e={e} base={base} />
        ))}
      </ul>
    </>
  );
}

function EndpointCard({ e, base }: { e: Endpoint; base: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="rounded-md border border-line">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-surface-2">
        <Badge tone={e.method === "GET" ? "info" : "accent"} dot={false} className="w-12 justify-center">
          {e.method}
        </Badge>
        <code className="min-w-0 text-xs font-semibold text-ink">{e.path}</code>
        <span className="min-w-0 flex-1 text-sm text-ink-2">{e.title}</span>
        <span className="num text-2xs text-ink-3">§{e.ref}</span>
        <ChevronDown className={cx("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={id} className="space-y-3 border-t border-line-soft px-3 py-3">
          <p className="text-sm text-ink-2">{e.summary}</p>
          <p className="text-xs text-ink-3">
            <span className="font-semibold text-ink-2">Auth:</span> {e.auth}
          </p>
          <CopyLine value={`${e.method} ${base}${e.path}`} what="Endpoint" />
          {e.params && <Table head={["Field", "Type", "Required", "Description"]} rows={e.params.map((p) => [<code key="n" className="text-xs">{p.name}</code>, <code key="t" className="text-xs text-ink-3">{p.type}</code>, p.required ? "Yes" : "No", p.about])} />}
          {e.request && <Code text={e.request} label="Request body" />}
          {e.responses.map((r) => (
            <Code key={r.label} text={r.body} label={`Response · ${r.label}`} />
          ))}
        </div>
      )}
    </li>
  );
}

function Coords() {
  const id = useId();
  const [size, setSize] = useState(PAGE_SIZES[0]!.id);
  const [vp, setVp] = useState({ width: 816, height: 1056 });
  const [f, setF] = useState({ x: 67, y: 320, width: 293, height: 80 });
  const page = PAGE_SIZES.find((p) => p.id === size)!;
  const out = vp.width > 0 && vp.height > 0 ? cssToPdf(f, vp, page) : null;
  const num = (label: string, value: number, set: (n: number) => void, key: string) => (
    <label key={key} className="min-w-0">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      <input type="number" inputMode="decimal" className="field w-full" value={value} onChange={(e) => set(Number(e.target.value) || 0)} />
    </label>
  );
  return (
    <>
      <p className="text-sm text-ink-2">
        The signing UI works in CSS pixels from the top-left of the page preview. SignVault stores fields in ISO 32000 PostScript points (72 per inch) from the bottom-left of the page, so every field placed on screen is converted before <code className="text-xs">POST /envelopes</code>.
      </p>
      <ul className="space-y-1 rounded-md bg-surface-2 p-3">
        {FORMULAS.map((m) => (
          <li key={m} className="num font-mono text-xs text-ink">
            {m}
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-line p-4">
        <h4 className="text-sm font-semibold text-ink">Converter</h4>
        <p className="mt-0.5 text-xs text-ink-3">A field drawn on screen, and what to send as coordX, coordY, width, and height.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 min-w-0" htmlFor={`${id}-size`}>
            <span className="mb-1 block text-xs font-semibold text-ink-2">PDF page size</span>
            <select id={`${id}-size`} className="field w-full" value={size} onChange={(e) => setSize(e.target.value)}>
              {PAGE_SIZES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.width} × {p.height} pt
                </option>
              ))}
            </select>
          </label>
          {num("Preview width (px)", vp.width, (n) => setVp((v) => ({ ...v, width: n })), "vw")}
          {num("Preview height (px)", vp.height, (n) => setVp((v) => ({ ...v, height: n })), "vh")}
          {num("Field left (px)", f.x, (n) => setF((v) => ({ ...v, x: n })), "x")}
          {num("Field top (px)", f.y, (n) => setF((v) => ({ ...v, y: n })), "y")}
          {num("Field width (px)", f.width, (n) => setF((v) => ({ ...v, width: n })), "w")}
          {num("Field height (px)", f.height, (n) => setF((v) => ({ ...v, height: n })), "h")}
        </div>
        {out ? (
          <div className="mt-3">
            <Code text={JSON.stringify({ coordX: out.x, coordY: out.y, width: out.width, height: out.height }, null, 2)} label="Field coordinates in points" />
            {(out.x < 0 || out.y < 0 || out.x + out.width > page.width || out.y + out.height > page.height) && (
              <p role="alert" className="mt-2 text-xs font-medium text-neg-ink">
                The field runs off the page. Check the preview size and field position.
              </p>
            )}
          </div>
        ) : (
          <p role="alert" className="mt-3 text-xs font-medium text-neg-ink">
            Preview width and height must be greater than zero.
          </p>
        )}
      </div>
    </>
  );
}

function Webhooks() {
  return (
    <>
      <p className="text-sm text-ink-2">SignVault posts envelope lifecycle events to an HTTPS endpoint so Control Center can move a contract to executed without polling.</p>
      <Table head={["Event", "Fires when"]} rows={WEBHOOK_EVENTS.map((e) => [<code key="e" className="text-xs">{e.name}</code>, e.about])} />
      <h4 className="text-sm font-semibold text-ink">Signature verification</h4>
      <p className="text-sm text-ink-2">
        Each request carries an HMAC-SHA256 signature in <code className="text-xs">X-SignVault-Signature</code>. Recompute it over <code className="text-xs">timestamp.payload</code> with the webhook secret above and compare in constant time.
      </p>
      <Code text={WEBHOOK_REQUEST} label="Request headers" />
      <Code text={WEBHOOK_VERIFY} label="Verify (Node.js)" />
    </>
  );
}

function Quickstart() {
  const [lang, setLang] = useState<"ts" | "curl">("ts");
  return (
    <>
      <p className="text-sm text-ink-2">Create a draft, then send it. The send response carries each tier-1 signer’s link.</p>
      <Segmented size="sm" label="Example language" value={lang} onChange={setLang} options={[{ value: "ts", label: "Node.js / TypeScript" }, { value: "curl", label: "cURL" }]} />
      <Code text={lang === "ts" ? QUICKSTART_TS : QUICKSTART_CURL} label={lang === "ts" ? "sendContract.ts" : "Terminal"} tall />
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Parts
 * ------------------------------------------------------------------------- */

function CopyLine({ value, what }: { value: string; what: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="num flex h-8 min-w-0 flex-1 items-center truncate rounded-md border border-line bg-surface px-3 text-xs text-ink">{value}</code>
      <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => copy(value, what)} aria-label={`Copy ${what}`}>
        <span className="hidden sm:inline">Copy</span>
      </Button>
    </div>
  );
}

function Code({ text, label, tall }: { text: string; label: string; tall?: boolean }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-md border border-line">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-2 px-3 py-1.5">
        <span className="text-2xs font-semibold text-ink-3">{label}</span>
        <button type="button" onClick={() => copy(text, label)} className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-semibold text-ink-3 hover:bg-sunk hover:text-ink">
          <Copy className="size-3" aria-hidden />
          Copy
        </button>
      </figcaption>
      <pre tabIndex={0} className={cx("overflow-auto bg-surface px-3 py-2.5 text-xs leading-5 text-ink", tall ? "max-h-[32rem]" : "max-h-80")}>
        <code>{text}</code>
      </pre>
    </figure>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="scroll-x rounded-md border border-line">
      <table className="dt compact">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cx("align-top text-sm", j === 0 && "whitespace-nowrap")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
