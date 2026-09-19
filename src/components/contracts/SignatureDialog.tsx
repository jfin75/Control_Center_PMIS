"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Eye, FileSignature, Send } from "lucide-react";
import { Button, Segmented, Spinner } from "@/components/ui/controls";
import { Modal, toast } from "@/components/ui/overlay";
import { cx } from "@/lib/format";
import { sendForSignature, type Row } from "@/lib/contracts";
import { SignVaultError, transport } from "@/lib/signvault/client";
import { target, useSignVaultConfig } from "@/lib/signvault/config";
import { buildPdf, defaultSigners, emailOk, fileNameOf, sendEnvelope, type SignerDraft } from "@/lib/signvault/contract";
import { plural } from "./parts";
import { useContracts } from "./state";

type Health = { state: "checking" } | { state: "up"; version: string } | { state: "down"; message: string };

/** Send a Legal-approved contract through SignVault: who signs, in what order, and the PDF they'll sign. */
export function SignatureDialog({ r, open, onClose, onSent }: { r: Row; open: boolean; onClose: () => void; onSent: () => void }) {
  const { contracts, saveContracts, me } = useContracts();
  const [cfg, setCfg] = useSignVaultConfig();
  const id = useId();
  const c = r.c;
  const [signers, setSigners] = useState<SignerDraft[]>([]);
  const [parallel, setParallel] = useState(false);
  const [subject, setSubject] = useState("");
  const [blurb, setBlurb] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health>({ state: "checking" });
  // Recipient ids must be unique across envelopes, including a resend of the same contract.
  const [nonce, setNonce] = useState("");
  const dest = target(cfg);

  useEffect(() => {
    if (!open) return;
    setSigners(defaultSigners(c, r.t));
    setNonce(crypto.randomUUID().slice(0, 8));
    setParallel(false);
    setSubject(`Please sign: ${c.number} ${c.title}`.trim());
    setBlurb("");
    setNote("");
    setTried(false);
    setError(null);
  }, [open, c, r.t]);

  // Check the server is up before anyone fills the form in.
  useEffect(() => {
    if (!open || dest.blocked) return;
    let live = true;
    setHealth({ state: "checking" });
    transport(dest.mode, dest.baseUrl, dest.tenantId, me.id)
      .health()
      .then((h) => live && setHealth({ state: "up", version: h.version }))
      .catch((e: unknown) => live && setHealth({ state: "down", message: e instanceof Error ? e.message : "SignVault didn't answer." }));
    return () => {
      live = false;
    };
  }, [open, dest.mode, dest.baseUrl, dest.tenantId, dest.blocked, me.id]);

  const withIds = useMemo(() => signers.map((s) => ({ ...s, id: `rec_${s.key}_${nonce}`, routingOrder: parallel ? 1 : s.routingOrder })), [signers, parallel, nonce]);
  const problems = withIds.flatMap((s) => [!s.name.trim() && `${s.role} signer's name`, !emailOk(s.email) && `${s.role} signer's email`].filter((x): x is string => !!x));
  const duplicate = new Set(withIds.map((s) => s.email.trim().toLowerCase())).size < withIds.length;
  const canSend = !dest.blocked && health.state === "up" && !problems.length && !duplicate && !busy;

  const preview = () => {
    const pdf = buildPdf(c, r.t, contracts, withIds);
    const url = URL.createObjectURL(new Blob([pdf.bytes as BlobPart], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const send = async () => {
    setTried(true);
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const pdf = buildPdf(c, r.t, contracts, withIds);
      const tr = transport(dest.mode, dest.baseUrl, dest.tenantId, me.id);
      const esign = await sendEnvelope(tr, dest.tenantId, c, withIds, pdf, { subject, blurb });
      saveContracts(sendForSignature(c, esign, me, note));
      toast(`${c.number} sent for signature through ${dest.mode === "simulated" ? "the simulated SignVault" : "SignVault"}`);
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof SignVaultError || e instanceof Error ? e.message : "SignVault refused the envelope.");
    } finally {
      setBusy(false);
    }
  };

  const set = (key: SignerDraft["key"], patch: Partial<SignerDraft>) => setSigners((xs) => xs.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const ordered = [...withIds].sort((a, b) => a.routingOrder - b.routingOrder || (a.key === "counterparty" ? -1 : 1));

  return (
    <Modal open={open} onClose={onClose} title={`Send ${c.number} for signature`} description="Legal & Risk approved the terms. SignVault routes the PDF to each signer in turn and seals it when the last one signs." className="w-[min(46rem,calc(100vw-2rem))]">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className={cx("flex flex-wrap items-start gap-3 rounded-md px-3 py-2.5 text-sm", dest.blocked || health.state === "down" ? "bg-neg-tint text-neg-ink" : "bg-surface-2 text-ink-2")}>
          <span className="mt-0.5 shrink-0">
            {dest.blocked || health.state === "down" ? <CircleAlert className="size-4" aria-hidden /> : health.state === "checking" ? <Spinner /> : <CircleCheck className="size-4 text-pos-ink" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="font-semibold">{dest.mode === "simulated" ? "Simulated SignVault in this browser" : cfg.env === "production" ? "SignVault production" : "SignVault sandbox"}</span>
              {dest.mode === "api" && <code className="ml-1.5 text-xs">{dest.baseUrl}</code>}
              {health.state === "up" && !dest.blocked && <span className="text-ink-3"> · {dest.mode === "simulated" ? "no PAdES seal; for trying the flow" : `v${health.version}, reachable`}</span>}
            </p>
            {dest.blocked && <p className="mt-1">{dest.blocked}</p>}
            {!dest.blocked && health.state === "down" && <p className="mt-1">{health.message}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {!dest.blocked && health.state === "down" && (
              <Button size="sm" onClick={() => setCfg((x) => ({ ...x, mode: "simulated" }))}>
                Use simulated SignVault
              </Button>
            )}
            <Link href="/settings/" className="inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold text-accent-ink hover:bg-accent-tint">
              Settings
            </Link>
          </div>
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Signers</h3>
            <Segmented size="sm" label="Signing order" value={parallel ? "parallel" : "sequential"} onChange={(v) => setParallel(v === "parallel")} options={[{ value: "sequential", label: `${ordered.find((s) => s.key === "counterparty")?.role ?? "Counterparty"} first` }, { value: "parallel", label: "At the same time" }]} />
          </div>
          <ol className="space-y-3">
            {ordered.map((s) => {
              const nameBad = tried && !s.name.trim();
              const emailBad = tried && !emailOk(s.email);
              return (
                <li key={s.key} className="rounded-md border border-line p-3">
                  <p className="mb-2 text-xs text-ink-3">
                    <span className="num font-semibold text-ink-2">{parallel ? "Tier 1" : `Tier ${s.routingOrder}`}</span> · {s.role} · {s.party}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-ink-2">Full legal name</span>
                      <input className="field w-full" value={s.name} placeholder={s.key === "counterparty" ? "Who signs for the firm" : ""} aria-invalid={nameBad} onChange={(e) => set(s.key, { name: e.target.value })} />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-semibold text-ink-2">Email</span>
                      <input type="email" className="field w-full" value={s.email} aria-invalid={emailBad} onChange={(e) => set(s.key, { email: e.target.value })} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
          {tried && (problems.length > 0 || duplicate) && (
            <p role="alert" className="mt-2 text-xs font-medium text-neg-ink">
              {problems.length ? `Fill in the ${problems.join(" and ")}.` : "Each signer needs their own email address."}
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-3">
          <label htmlFor={`${id}-subject`}>
            <span className="mb-1 block text-xs font-semibold text-ink-2">Email subject</span>
            <input id={`${id}-subject`} className="field w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label htmlFor={`${id}-blurb`}>
            <span className="mb-1 block text-xs font-semibold text-ink-2">Message to signers (optional)</span>
            <textarea id={`${id}-blurb`} rows={2} className="field w-full" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
          </label>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <FileSignature className="size-4 text-ink-3" aria-hidden />
            <span>
              <span className="font-semibold text-ink">{fileNameOf(c)}</span> · the filled-in contract with a signature page, {plural(withIds.length * 2, "signature and date field", "signature and date fields")}
            </span>
          </p>
          <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" aria-hidden />} onClick={preview}>
            Preview PDF
          </Button>
        </section>

        <label htmlFor={`${id}-note`} className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Note for the contract history (optional)</span>
          <input id={`${id}-note`} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-neg-tint px-3 py-2.5 text-sm text-neg-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon={<Send className="size-3.5" aria-hidden />} loading={busy} disabled={dest.blocked !== null || health.state !== "up"} onClick={send}>
          Send through SignVault
        </Button>
      </div>
    </Modal>
  );
}
