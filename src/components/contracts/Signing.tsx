"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Copy, Download, PenLine, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { cx, fmtDate } from "@/lib/format";
import { applyEnvelope, voidedContract, type Row } from "@/lib/contracts";
import { verifyAudit, type AuditCheck, type AuditTrail } from "@/lib/signvault/client";
import { ENVELOPE_STATUS, envelopeSummary, fileNameOf, RECIPIENT_STATUS, refreshEnvelope, signAsRecipient, transportFor, type Esign } from "@/lib/signvault/contract";
import { plural, SubHead } from "./parts";
import { useContracts } from "./state";

const when = (iso: string | null | undefined) => (iso ? `${fmtDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC` : "—");
const short = (h: string | null | undefined) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");

/** Sandbox and simulated envelopes can be signed from here to test the routing; production signers sign in SignVault. */
export const canSignHere = (e: Esign) => e.mode === "simulated" || !e.baseUrl.startsWith("https://api.signvault.io");

/** Everything the drawer does with the contract's envelope, with one busy flag and one error between them. */
export function useEnvelope(r: Row) {
  const { saveContracts, me } = useContracts();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = r.c;
  const e = c.esign;

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(label);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "SignVault didn't respond.";
        setError(msg);
        // The automatic catch-up on open reports inline only; anything the user asked for also toasts.
        if (label !== "auto") toast(msg);
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const save = useCallback(
    (next: Esign) => {
      const out = applyEnvelope(c, next, me);
      saveContracts(out);
      if (out.status === "executed" && c.status !== "executed") toast(`${c.number} executed: every signature is in`);
    },
    [c, me, saveContracts],
  );

  const refresh = useCallback(
    async (auto = false) => {
      if (!e) return;
      const next = await run(auto ? "auto" : "refresh", () => refreshEnvelope(transportFor(e, me.id), e));
      if (next) save(next);
    },
    [e, me.id, run, save],
  );

  const signAs = useCallback(
    async (recipientId: string) => {
      if (!e) return;
      const name = e.recipients.find((x) => x.id === recipientId)?.name ?? "The signer";
      const res = await run(`sign:${recipientId}`, () => signAsRecipient(transportFor(e, me.id), e, recipientId));
      if (res) {
        save(res.esign);
        toast(`${name} signed${e.mode === "simulated" ? " (simulated)" : `; PAdES digest ${res.digest.slice(0, 10)}…`}`);
      }
    },
    [e, me.id, run, save],
  );

  const voidIt = useCallback(
    async (reason: string, to: "review" | "draft") => {
      if (!e) return;
      const next = await run("void", async () => {
        const tr = transportFor(e, me.id);
        await tr.void(e.envelopeId, reason);
        return refreshEnvelope(tr, e);
      });
      if (next) {
        saveContracts(voidedContract(c, next, me, reason, to));
        toast(`Envelope voided; ${c.number} is back in ${to === "review" ? "Legal review" : "draft"}`);
      }
    },
    [c, e, me, run, saveContracts],
  );

  const download = useCallback(async () => {
    if (!e) return;
    const blob = await run("download", () => transportFor(e, me.id).document(e.envelopeId));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = e.status === "COMPLETED" ? fileNameOf(c).replace(/\.pdf$/, "_signed.pdf") : fileNameOf(c);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${a.download} downloaded${e.mode === "simulated" ? " (simulated envelopes aren't sealed)" : ""}`);
  }, [c, e, me.id, run]);

  const audit = useCallback(async (): Promise<{ trail: AuditTrail; check: AuditCheck } | undefined> => {
    if (!e) return;
    return run("audit", async () => {
      const trail = await transportFor(e, me.id).audit(e.envelopeId);
      return { trail, check: await verifyAudit(trail) };
    });
  }, [e, me.id, run]);

  // Catch up once when the drawer opens on a contract that's out for signature: SignVault can't call back into a static build.
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (!e || e.status !== "SENT" || checked.current === e.envelopeId) return;
    checked.current = e.envelopeId;
    void refresh(true);
  }, [e, refresh]);

  return { e, busy, error, refresh, signAs, voidIt, download, audit };
}

export type EnvelopeCtl = ReturnType<typeof useEnvelope>;

/** One line under the drawer header while a contract is with SignVault. */
export function EnvelopeStrip({ ctl, onOpen }: { ctl: EnvelopeCtl; onOpen: () => void }) {
  const e = ctl.e;
  if (!e || e.status === "DRAFT") return null;
  const st = ENVELOPE_STATUS[e.status];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
      <Badge tone={st.tone}>SignVault · {st.label}</Badge>
      <span className="min-w-0 flex-1 text-ink-2">{envelopeSummary(e)}</span>
      <button type="button" onClick={onOpen} className="text-xs font-semibold text-accent-ink hover:underline">
        Signatures
      </button>
    </div>
  );
}

/** The Signatures tab: tiers, signer progress, the document's hashes, and the verified audit trail. */
export function SigningPanel({ ctl }: { ctl: EnvelopeCtl }) {
  const e = ctl.e;
  const [trail, setTrail] = useState<{ trail: AuditTrail; check: AuditCheck } | null>(null);
  useEffect(() => setTrail(null), [e?.envelopeId, e?.checkedAt]);
  if (!e) return <p className="text-sm text-ink-2">This contract hasn't been sent through SignVault.</p>;
  const tiers = [...new Set(e.recipients.map((x) => x.routingOrder))].sort((a, b) => a - b);
  const st = ENVELOPE_STATUS[e.status];

  return (
    <div className="space-y-6">
      {ctl.error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-neg-tint px-3 py-2.5 text-sm text-neg-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {ctl.error}
        </p>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <span className="text-sm text-ink-2">{envelopeSummary(e)}</span>
          </div>
          <Button size="sm" icon={<RefreshCw className={cx("size-3.5", ctl.busy === "refresh" && "animate-spin")} aria-hidden />} disabled={!!ctl.busy} onClick={() => void ctl.refresh()}>
            Refresh
          </Button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Fact label="Envelope">
            <button type="button" className="num text-ink hover:text-accent-ink" title="Copy envelope id" onClick={() => void navigator.clipboard?.writeText(e.envelopeId).then(() => toast("Envelope id copied"))}>
              {e.envelopeId.slice(0, 8)}… <Copy className="inline size-3" aria-hidden />
            </button>
          </Fact>
          <Fact label="Through">{e.mode === "simulated" ? "Simulated SignVault" : e.baseUrl}</Fact>
          <Fact label="Last checked">{when(e.checkedAt)}</Fact>
          <Fact label="Sent">{when(e.sentAt)}</Fact>
          <Fact label="Completed">{when(e.completedAt)}</Fact>
          {e.voidReason && <Fact label="Void reason">{e.voidReason}</Fact>}
        </dl>
        {e.mode === "simulated" && <p className="mt-2 text-xs text-ink-3">Simulated envelopes follow SignVault’s routing and audit rules in this browser but aren’t digitally sealed. Use the SignVault sandbox or production for a binding signature.</p>}
      </section>

      <section>
        <SubHead aside={e.maxRoutingOrder > 1 ? "Each tier signs after the one before it finishes" : "Everyone signs at once"}>Signers</SubHead>
        <ol className="space-y-3">
          {tiers.map((t) => (
            <li key={t}>
              <p className="mb-1.5 text-xs font-semibold text-ink-3">
                Tier {t}
                {e.status === "SENT" && t === e.currentRoutingOrder ? " · signing now" : e.status === "SENT" && t > e.currentRoutingOrder ? " · waiting" : ""}
              </p>
              <ul className="divide-y divide-line-soft rounded-md border border-line">
                {e.recipients
                  .filter((x) => x.routingOrder === t)
                  .map((x) => {
                    const rs = RECIPIENT_STATUS[x.status];
                    const turn = e.status === "SENT" && x.routingOrder === e.currentRoutingOrder && x.status !== "SIGNED";
                    return (
                      <li key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{x.name}</p>
                          <p className="text-xs text-ink-3">
                            {x.role} · {x.party} · {x.email}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge tone={rs.tone}>{rs.label}</Badge>
                          {x.signedAt && <p className="mt-0.5 text-2xs text-ink-3">{when(x.signedAt)}</p>}
                        </div>
                        {turn && x.token && (
                          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                            <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void navigator.clipboard?.writeText(`/signing/${x.token}`).then(() => toast(`Signing link for ${x.name} copied`))}>
                              Signing link
                            </Button>
                            {canSignHere(e) && (
                              <Button size="sm" variant="tint" icon={<PenLine className="size-3.5" aria-hidden />} loading={ctl.busy === `sign:${x.id}`} disabled={!!ctl.busy} onClick={() => void ctl.signAs(x.id)} title="Affirm ESIGN consent and sign with a typed signature, as this recipient would">
                                Sign as {x.name.split(" ")[0]}
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ol>
        {e.status === "SENT" && canSignHere(e) && <p className="mt-2 text-xs text-ink-3">“Sign as” is for testing the routing in the sandbox. In production, each signer opens their own link.</p>}
      </section>

      <section>
        <SubHead aside={`${e.pageCount} ${e.pageCount === 1 ? "page" : "pages"}`}>Document</SubHead>
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2.5">
          <dl className="min-w-0 flex-1 space-y-0.5 text-xs">
            <div className="font-semibold text-ink">{e.fileName}</div>
            <div className="text-ink-3">
              Original SHA-256 <span className="num">{short(e.originalSha256)}</span>
            </div>
            {e.finalSha256 && e.finalSha256 !== e.originalSha256 && (
              <div className="text-ink-3">
                {e.status === "COMPLETED" ? "Sealed" : "Current"} SHA-256 <span className="num">{short(e.finalSha256)}</span>
              </div>
            )}
          </dl>
          <Button size="sm" icon={<Download className="size-3.5" aria-hidden />} loading={ctl.busy === "download"} disabled={!!ctl.busy} onClick={() => void ctl.download()}>
            {e.status === "COMPLETED" ? "Signed PDF" : "Current PDF"}
          </Button>
        </div>
      </section>

      <section>
        <SubHead aside="Merkle hash chain">Audit trail</SubHead>
        {trail ? (
          <>
            <p className={cx("mb-2 flex items-start gap-2 rounded-md px-3 py-2 text-sm", trail.check.ok ? "bg-pos-tint text-pos-ink" : "bg-neg-tint text-neg-ink")}>
              {trail.check.ok ? <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {trail.check.ok
                ? `Verified here: all ${plural(trail.check.checked, "event")} hash back to the envelope, and the last one is the Merkle root.`
                : `Doesn't verify at event ${trail.check.brokenAt ?? "—"}: ${trail.check.reason}`}
            </p>
            <ol className="space-y-1.5">
              {trail.trail.events.map((ev) => (
                <li key={ev.sequenceNumber} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-baseline gap-2 text-xs">
                  <span className="num text-ink-3">{ev.sequenceNumber}</span>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{ev.eventType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</span>
                    <span className="text-ink-3"> · {ev.actorIdentifier}</span>
                    <span className="num block truncate text-2xs text-ink-4" title={ev.eventHash}>
                      {ev.eventHash}
                    </span>
                  </span>
                  <span className="num whitespace-nowrap text-ink-3">{when(ev.recordedAt)}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <Button size="sm" icon={<ShieldCheck className="size-3.5" aria-hidden />} loading={ctl.busy === "audit"} disabled={!!ctl.busy} onClick={() => void ctl.audit().then((t) => t && setTrail(t))}>
            Load and verify
          </Button>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="truncate text-ink">{children}</dd>
    </div>
  );
}
