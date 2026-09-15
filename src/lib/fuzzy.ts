/**
 * Small subsequence fuzzy matcher for the omnibox. Scores contiguous runs,
 * word-start hits, and prefix matches; returns matched character indexes so
 * the palette can highlight them. Dependency-free on purpose.
 */
export interface FuzzyResult {
  score: number;
  indexes: number[];
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indexes: [] };
  const t = text.toLowerCase();

  // Whole-substring hit is always best.
  const direct = t.indexOf(q);
  if (direct !== -1) {
    const idx = Array.from({ length: q.length }, (_, i) => direct + i);
    const wordStart = direct === 0 || /[\s\-–—./#(]/.test(t[direct - 1]!);
    return { score: 1000 - direct + (wordStart ? 200 : 0) - (t.length - q.length) * 0.5, indexes: idx };
  }

  let score = 0;
  let ti = 0;
  let prev = -2;
  const indexes: number[] = [];
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!;
    if (ch === " ") continue;
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return null;
    indexes.push(found);
    const atWordStart = found === 0 || /[\s\-–—./#(]/.test(t[found - 1]!);
    score += 10;
    if (found === prev + 1) score += 15;
    if (atWordStart) score += 25;
    prev = found;
  }
  score -= (indexes[0] ?? 0) * 0.8;
  score -= (t.length - indexes.length) * 0.2;
  return { score, indexes };
}
