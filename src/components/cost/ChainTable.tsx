"use client";

import type { ReactNode } from "react";
import { CHAIN_COLUMNS, type Chain, type ChainKey } from "@/lib/budget";
import { cx, money, pct } from "@/lib/format";

export function chainCell(c: Chain, key: ChainKey, compact = false): ReactNode {
  const v = c[key];
  if (key === "K") return pct(v as number);
  const n = v as number;
  const s = money(n, { compact });
  if (key === "H" || key === "B") {
    if (n < 0) return <span className="font-semibold text-neg-ink">{s}</span>;
    if (n > 0 && key === "H") return <span className="font-semibold text-pos-ink">{s}</span>;
  }
  if (n === 0) return <span className="text-ink-4">–</span>;
  return s;
}

/**
 * The Owner's Budget Summary Report, column for column (A–K), with the
 * derivation printed under each calculated heading.
 */
export function ChainTable({
  rows,
  total,
  firstHeader,
  onRow,
  selected,
  columns = CHAIN_COLUMNS.map((c) => c.key),
}: {
  rows: Array<{ id: string; label: ReactNode; sub?: ReactNode; chain: Chain }>;
  total?: Chain;
  firstHeader: string;
  onRow?: (id: string) => void;
  selected?: string | null;
  columns?: ChainKey[];
}) {
  const cols = CHAIN_COLUMNS.filter((c) => columns.includes(c.key));
  return (
    <div className="scroll-x">
      <table className="dt min-w-[64rem]">
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] min-w-[15rem] bg-surface">{firstHeader}</th>
            {cols.map((c) => (
              <th key={c.key} className="r align-bottom" title={`${c.label}${c.formula ? ` (${c.formula})` : ""} — ${c.source}`}>
                <span className="block text-2xs font-bold text-accent-ink">{c.letter}</span>
                <span className="block font-semibold text-ink-2">{c.short}</span>
                <span className="block font-normal text-ink-3">{c.formula ?? c.source}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={cx(onRow && "row-link cursor-pointer")}
              data-selected={selected === r.id || undefined}
              aria-current={selected === r.id || undefined}
              onClick={onRow ? () => onRow(r.id) : undefined}
            >
              <td className="sticky left-0 z-[1] bg-surface">
                {onRow ? (
                  <button type="button" className="text-left font-semibold text-ink hover:text-accent-ink" onClick={(e) => { e.stopPropagation(); onRow(r.id); }}>
                    {r.label}
                  </button>
                ) : (
                  <span className="font-semibold text-ink">{r.label}</span>
                )}
                {r.sub && <div className="text-xs text-ink-3">{r.sub}</div>}
              </td>
              {cols.map((c) => (
                <td key={c.key} className={cx("r", (c.key === "C" || c.key === "G") && "font-semibold text-ink")}>
                  {chainCell(r.chain, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              <td className="sticky left-0 z-[1] bg-surface">Total</td>
              {cols.map((c) => (
                <td key={c.key} className="r num">
                  {chainCell(total, c.key)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
