"use client";

import type { ReactNode } from "react";
import { money } from "@/lib/format";

/** Shared Recharts styling so every chart reads as one system. */
export const AXIS = {
  tick: { fill: "var(--ink-3)", fontSize: 11, fontWeight: 500 },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = { stroke: "var(--line)", strokeDasharray: "0", vertical: false } as const;

export const moneyTick = (v: number) => money(v, { compact: true });

export function ChartTooltip({
  active,
  payload,
  label,
  format = (v: number) => money(v),
  labelFormat,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | null; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }>;
  label?: string | number;
  format?: (v: number, key?: string) => string;
  labelFormat?: (l: string | number) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="min-w-44 rounded-md border border-line bg-surface px-3 py-2.5 shadow-raised">
      {label !== undefined && <div className="mb-1.5 text-xs font-semibold text-ink">{labelFormat ? labelFormat(label) : label}</div>}
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num font-bold text-ink">{format(p.value as number, String(p.dataKey))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
