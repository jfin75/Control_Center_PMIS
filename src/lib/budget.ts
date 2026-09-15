/**
 * The Owner's budget formula chain, from Private/Budget Fortmat/Budget Summary
 * Report.csv. A, D and I are Finance feeds; B moves only through a tracked
 * add/deduct funding action; F is a PM input reviewed by PM Leadership.
 * Everything else is derived here and nowhere else.
 */

export interface ChainInputs {
  /** A — Original Budget (Finance) */
  A: number;
  /** B — Approved Budget Adjustments (tracked funding action) */
  B: number;
  /** D — Commitments to Date (Finance) */
  D: number;
  /** F — Projected Remaining Commitments Against Approved Budget (PM) */
  F: number;
  /** I — Payments to Date Against Total Commitments (Finance) */
  I: number;
}

export interface Chain extends ChainInputs {
  /** C = A + B — Total Approved Budget */
  C: number;
  /** E = C − D — Balance Remaining Against Approved Budget */
  E: number;
  /** G = D + F — Forecast Cost at Completion */
  G: number;
  /** H = C − G — Projected Cost Variance Against Approved Budget */
  H: number;
  /** J = C − I — Funds Remaining Available Against Approved Budget */
  J: number;
  /** K = I / D — % Complete of Commitment to Date (NaN when D = 0) */
  K: number;
}

export function chain(x: ChainInputs): Chain {
  const C = x.A + x.B;
  const G = x.D + x.F;
  return {
    ...x,
    C,
    E: C - x.D,
    G,
    H: C - G,
    J: C - x.I,
    K: x.D === 0 ? Number.NaN : x.I / x.D,
  };
}

export function sumChain(rows: ChainInputs[]): Chain {
  return chain(
    rows.reduce<ChainInputs>(
      (acc, r) => ({ A: acc.A + r.A, B: acc.B + r.B, D: acc.D + r.D, F: acc.F + r.F, I: acc.I + r.I }),
      { A: 0, B: 0, D: 0, F: 0, I: 0 },
    ),
  );
}

export type ChainKey = keyof Chain;

export const CHAIN_COLUMNS: Array<{ key: ChainKey; letter: string; label: string; short: string; formula?: string; source: string }> = [
  { key: "A", letter: "A", label: "Original Budget", short: "Original", source: "Finance" },
  { key: "B", letter: "B", label: "Approved Budget Adjustments", short: "Adjustments", source: "Funding action" },
  { key: "C", letter: "C", label: "Total Approved Budget", short: "Approved", formula: "A + B", source: "Calculated" },
  { key: "D", letter: "D", label: "Commitments to Date", short: "Committed", source: "Finance" },
  { key: "E", letter: "E", label: "Balance Remaining Against Approved Budget", short: "Uncommitted", formula: "C − D", source: "Calculated" },
  { key: "F", letter: "F", label: "Projected Remaining Commitments", short: "Proj. remaining", source: "PM input" },
  { key: "G", letter: "G", label: "Forecast Cost at Completion", short: "Forecast (EAC)", formula: "D + F", source: "Calculated" },
  { key: "H", letter: "H", label: "Projected Cost Variance", short: "Variance", formula: "C − G", source: "Calculated" },
  { key: "I", letter: "I", label: "Payments to Date", short: "Paid", source: "Finance" },
  { key: "J", letter: "J", label: "Funds Remaining Available", short: "Funds avail.", formula: "C − I", source: "Calculated" },
  { key: "K", letter: "K", label: "% Complete of Commitment", short: "% Paid of committed", formula: "I ÷ D", source: "Calculated" },
];

/** Split `total` across `weights` into integers (multiples of `step`) that sum exactly to `total`. */
export function allocate(total: number, weights: number[], step = 1): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW === 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sumW);
  const out = raw.map((v) => Math.floor(v / step) * step);
  let rem = total - out.reduce((a, b) => a + b, 0);
  // Hand the remainder to the largest weights first, in whole steps, then any sub-step dust to the largest.
  const order = weights.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  let k = 0;
  while (Math.abs(rem) >= step && order.length) {
    const i = order[k % order.length]!;
    out[i] += Math.sign(rem) * step;
    rem -= Math.sign(rem) * step;
    k++;
  }
  if (rem !== 0) out[order[0]!] += rem;
  return out;
}

/** Deterministic PRNG so mock data is identical on every render and build. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
