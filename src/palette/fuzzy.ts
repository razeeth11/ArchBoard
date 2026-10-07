/** Subsequence fuzzy score: higher is better, -1 means no match. Rewards prefixes and word starts. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - t.length;
  const at = t.indexOf(q);
  if (at >= 0) return 600 - at - t.length / 10;
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    const wordStart = found === 0 || /[\s\-_/]/.test(t[found - 1]!);
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 + (wordStart ? 15 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return score;
}

export function rank<T>(
  items: readonly T[],
  query: string,
  text: (t: T) => string,
  limit = 50,
): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((it) => ({ it, s: fuzzyScore(query, text(it)) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
