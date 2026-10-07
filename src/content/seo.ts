/** Fit a meta description into 130-160 characters by trying suffixes, then trimming at a word. */
export function fitDescription(base: string, suffixes: string[]): string {
  const clean = base.trim().replace(/\s+/g, " ");
  const ok = (s: string) => s.length >= 130 && s.length <= 160;
  if (ok(clean)) return clean;
  for (const suf of suffixes) {
    const c = `${clean.replace(/[.\s]+$/, "")}. ${suf}`;
    if (ok(c)) return c;
  }
  const withFirst = suffixes[0] ? `${clean.replace(/[.\s]+$/, "")}. ${suffixes[0]}` : clean;
  const target = withFirst.length >= 130 ? withFirst : clean;
  if (target.length <= 160) return target;
  const cut = target.slice(0, 157);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
