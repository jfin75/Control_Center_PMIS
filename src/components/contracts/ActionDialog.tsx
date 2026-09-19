"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/controls";
import { Modal } from "@/components/ui/overlay";
import { money } from "@/lib/format";
import { FUNDING, MOD_TYPES, type Funding, type ModType } from "@/mock/contracts";
import { TODAY } from "@/mock/org";

export interface ActionValues {
  note: string;
  date: string;
  amount: number | null;
  days: number | null;
  funding: Funding | null;
  target: ModType | null;
}

/** One workflow step: which inputs it asks for and what it does with them. */
export interface ActionSpec {
  title: string;
  description?: string;
  confirm: string;
  danger?: boolean;
  note?: "optional" | "required";
  notePlaceholder?: string;
  date?: string;
  amount?: { label: string; initial: number | null; required?: boolean; hint?: string };
  days?: { initial: number | null };
  funding?: { initial: Funding | null; required: boolean };
  target?: { options: ModType[] };
  onConfirm: (v: ActionValues) => void;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function ActionDialog({ spec, onClose }: { spec: ActionSpec | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(TODAY);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [funding, setFunding] = useState<Funding | "">("");
  const [target, setTarget] = useState<ModType | "">("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!spec) return;
    setNote("");
    setDate(spec.date ?? TODAY);
    setAmount(spec.amount?.initial === null || spec.amount?.initial === undefined ? "" : String(spec.amount.initial));
    setDays(spec.days?.initial === null || spec.days?.initial === undefined ? "" : String(spec.days.initial));
    setFunding(spec.funding?.initial ?? "");
    setTarget(spec.target?.options[spec.target.options.length - 1] ?? "");
    setTried(false);
  }, [spec]);

  const errors = {
    note: spec?.note === "required" && !note.trim(),
    amount: !!spec?.amount?.required && amount.trim() === "",
    funding: !!spec?.funding?.required && !funding && (numOrNull(amount) ?? 0) > 0,
    date: !!spec?.date && (!date || date > TODAY),
  };

  const submit = () => {
    setTried(true);
    if (!spec || Object.values(errors).some(Boolean)) return;
    spec.onConfirm({ note, date, amount: numOrNull(amount), days: numOrNull(days), funding: funding || null, target: target || null });
    onClose();
  };

  return (
    <Modal open={!!spec} onClose={onClose} title={spec?.title ?? ""} description={spec?.description}>
      {spec && (
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {spec.target && (
              <fieldset>
                <legend className="text-sm font-semibold text-ink">Convert to</legend>
                <div className="mt-2 space-y-2">
                  {spec.target.options.map((t) => (
                    <label key={t} className="flex cursor-pointer items-start gap-3 rounded-md border border-line-strong px-3 py-2 has-checked:border-accent has-checked:bg-accent-wash">
                      <input type="radio" name="target" className="mt-0.5 size-4 accent-[var(--accent)]" checked={target === t} onChange={() => setTarget(t)} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{MOD_TYPES[t].label}</span>
                        <span className="block text-xs text-ink-3">{MOD_TYPES[t].long}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {(spec.amount || spec.days) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {spec.amount && (
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">{spec.amount.label}</span>
                    <span className="relative mt-1 block">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ink-3">$</span>
                      <input type="number" inputMode="decimal" step={1} className="field num w-full pl-6" value={amount} aria-invalid={(tried && errors.amount) || undefined} onChange={(e) => setAmount(e.target.value)} />
                    </span>
                    {tried && errors.amount ? (
                      <span className="mt-0.5 block text-xs font-medium text-neg-ink">Enter the amount; use 0 for no cost.</span>
                    ) : (
                      <span className="num mt-0.5 block text-xs text-ink-3">{amount ? money(Number(amount) || 0) : (spec.amount.hint ?? "Negative for a credit")}</span>
                    )}
                  </label>
                )}
                {spec.days && (
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">Schedule days</span>
                    <input type="number" inputMode="numeric" step={1} className="field num mt-1 w-full" value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
                    <span className="mt-0.5 block text-xs text-ink-3">Calendar days added to the contract time</span>
                  </label>
                )}
              </div>
            )}
            {(spec.funding || spec.date) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {spec.funding && (
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">Funding</span>
                    <select className="field mt-1 w-full" value={funding} aria-invalid={(tried && errors.funding) || undefined} onChange={(e) => setFunding(e.target.value as Funding)}>
                      <option value="">Choose…</option>
                      {FUNDING.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                    {tried && errors.funding && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Say where the money comes from.</span>}
                  </label>
                )}
                {spec.date && (
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">Date</span>
                    <input type="date" className="field num mt-1 w-full" max={TODAY} value={date} aria-invalid={(tried && errors.date) || undefined} onChange={(e) => setDate(e.target.value)} />
                    {tried && errors.date && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Pick today or earlier.</span>}
                  </label>
                )}
              </div>
            )}
            {spec.note && (
              <label className="block">
                <span className="text-sm font-semibold text-ink">
                  Note{spec.note === "optional" && <span className="font-normal text-ink-3"> · optional</span>}
                </span>
                <textarea className="field mt-1 w-full" rows={3} value={note} aria-invalid={(tried && errors.note) || undefined} onChange={(e) => setNote(e.target.value)} placeholder={spec.notePlaceholder} />
                {tried && errors.note && <span className="mt-0.5 block text-xs font-medium text-neg-ink">Say why, so the history makes sense later.</span>}
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={spec.danger ? "danger" : "primary"}>
              {spec.confirm}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
