/** Formatting helpers. Negative currency uses Finance's accounting
 *  parentheses, matching the Owner's Budget Summary Report. */

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function money(n: number, opts: { compact?: boolean; signed?: boolean; parens?: boolean } = {}): string {
  const { compact = false, signed = false, parens = true } = opts;
  const abs = Math.abs(n);
  let body: string;
  if (compact) {
    if (abs >= 1e9) body = `$${trim(abs / 1e9, abs >= 1e10 ? 1 : 2)}B`;
    else if (abs >= 1e6) body = `$${trim(abs / 1e6, abs >= 1e8 ? 0 : 1)}M`;
    else if (abs >= 1e3) body = `$${trim(abs / 1e3, abs >= 1e5 ? 0 : 1)}K`;
    else body = `$${num0.format(abs)}`;
  } else {
    body = usd0.format(abs);
  }
  if (n < 0) return parens ? `(${body})` : `−${body}`;
  if (signed && n > 0) return `+${body}`;
  return body;
}

function trim(v: number, digits: number): string {
  return v.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function sf(n: number): string {
  return `${num0.format(n)} sf`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Dates in mock data are ISO `YYYY-MM-DD` strings, parsed as local calendar dates. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function fmtDate(iso: string, style: "long" | "short" | "month" = "long"): string {
  const d = parseISO(iso);
  if (style === "month") return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (style === "short") return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((parseISO(bIso).getTime() - parseISO(aIso).getTime()) / 86_400_000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
