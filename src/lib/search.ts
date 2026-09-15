import { COST_CODES } from "@/mock/costCodes";
import { CONTRACTORS } from "@/mock/org";
import { PROJECTS } from "@/mock/projects";
import { PROPERTIES } from "@/mock/properties";
import { BID_PACKAGES } from "@/mock/bidding";
import { PIPELINE } from "@/mock/planning";
import { fuzzyMatch } from "./fuzzy";
import { NAV } from "./nav";

export type SearchKind = "Page" | "Property" | "Project" | "Cost code" | "Contractor" | "Bid package" | "Planning request";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  meta: string;
  href: string;
  keywords?: string;
}

export const SEARCH_INDEX: SearchItem[] = [
  ...NAV.flatMap((n) => [
    { id: `page-${n.href}`, kind: "Page" as const, title: n.label, meta: n.hint, href: n.href },
    ...(n.children ?? []).map((c) => ({ id: `page-${c.href}`, kind: "Page" as const, title: `${n.label} › ${c.label}`, meta: c.hint, href: c.href })),
  ]),
  ...PROPERTIES.map((p) => ({
    id: `prop-${p.id}`,
    kind: "Property" as const,
    title: p.name,
    meta: `${p.type} · ${p.city}`,
    href: `/portfolio/?property=${p.id}`,
    keywords: `${p.address} ${p.zoning} ${p.leases.map((l) => l.tenant).join(" ")}`,
  })),
  ...PROJECTS.map((p) => ({
    id: `proj-${p.id}`,
    kind: "Project" as const,
    title: p.name,
    meta: `${p.code} · ${p.phase}`,
    href: `/projects/${p.id}/`,
    keywords: p.code,
  })),
  ...COST_CODES.map((c) => ({
    id: `code-${c.code}`,
    kind: "Cost code" as const,
    title: `${c.code} ${c.name}`,
    meta: c.level1,
    href: `/cost/budget/?code=${c.code}`,
  })),
  ...CONTRACTORS.map((c) => ({
    id: `firm-${c.id}`,
    kind: "Contractor" as const,
    title: c.name,
    meta: `${c.kind} · ${c.trade}`,
    href: `/bidding/?firm=${c.id}`,
  })),
  ...BID_PACKAGES.map((b) => ({
    id: `bid-${b.id}`,
    kind: "Bid package" as const,
    title: `${b.number} ${b.name}`,
    meta: b.status,
    href: `/bidding/?pkg=${b.id}`,
  })),
  ...PIPELINE.map((i) => ({
    id: `plan-${i.id}`,
    kind: "Planning request" as const,
    title: i.title,
    meta: `${i.stage} · ${i.department}`,
    href: `/planning/?item=${i.id}`,
  })),
];

export interface SearchHit extends SearchItem {
  indexes: number[];
  score: number;
}

export function search(q: string, limit = 40): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const item of SEARCH_INDEX) {
    const t = fuzzyMatch(q, item.title);
    if (t) {
      hits.push({ ...item, indexes: t.indexes, score: t.score + (item.kind === "Page" ? 30 : 0) });
      continue;
    }
    const k = fuzzyMatch(q, `${item.meta} ${item.keywords ?? ""}`);
    if (k && k.score > 400) hits.push({ ...item, indexes: [], score: k.score * 0.4 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
