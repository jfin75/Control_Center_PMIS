"use client";

import { cx } from "@/lib/format";
import type { ImpactInput } from "@/lib/rfis";
import { IMPACT_LABEL, type ImpactLevel } from "@/mock/rfis";

const LEVELS: ImpactLevel[] = ["none", "possible", "yes"];
/** No single RFI answer outruns a project budget; anything larger is a typo. */
const MAX_ESTIMATE = 50_000_000;

/** Cost and schedule impact, with the PCO or change order that carries it. */
export function ImpactFields({ value, onChange, compact }: { value: ImpactInput; onChange: (v: ImpactInput) => void; compact?: boolean }) {
  const set = (patch: Partial<ImpactInput>) => onChange({ ...value, ...patch });
  const lab = compact ? "text-xs font-semibold text-ink-2" : "text-sm font-semibold text-ink";
  return (
    <div className={cx("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_5.5rem]" : "grid-cols-1 sm:grid-cols-2")}>
      <label className="block">
        <span className={lab}>Cost impact</span>
        <select className="field mt-1 w-full" value={value.costImpact} onChange={(e) => set({ costImpact: e.target.value as ImpactLevel })}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {IMPACT_LABEL[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={lab}>Estimate</span>
        <span className="relative mt-1 block">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-ink-3">$</span>
          <input
            type="number"
            min={0}
            step={500}
            inputMode="numeric"
            className="field num w-full pl-6 text-right"
            disabled={value.costImpact === "none"}
            value={value.costImpact === "none" ? "" : (value.costEstimate ?? "")}
            onChange={(e) => set({ costEstimate: e.target.value === "" ? null : Math.max(0, Math.min(MAX_ESTIMATE, Math.round(Number(e.target.value)))) })}
          />
        </span>
      </label>
      <label className="block">
        <span className={lab}>Schedule impact</span>
        <select className="field mt-1 w-full" value={value.scheduleImpact} onChange={(e) => set({ scheduleImpact: e.target.value as ImpactLevel })}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {IMPACT_LABEL[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={lab}>Days</span>
        <input
          type="number"
          min={0}
          max={365}
          className="field num mt-1 w-full text-right"
          disabled={value.scheduleImpact === "none"}
          value={value.scheduleImpact === "none" ? "" : (value.scheduleDays ?? "")}
          onChange={(e) => set({ scheduleDays: e.target.value === "" ? null : Math.max(0, Math.min(365, Math.round(Number(e.target.value)))) })}
        />
      </label>
      <label className={cx("block", compact ? "col-span-2 sm:max-w-xs" : "sm:col-span-2")}>
        <span className={lab}>PCO or change order</span>
        <input className="field num mt-1 w-full" value={value.changeRef} onChange={(e) => set({ changeRef: e.target.value })} placeholder="PCO-024" disabled={value.costImpact === "none" && value.scheduleImpact === "none"} />
      </label>
    </div>
  );
}
