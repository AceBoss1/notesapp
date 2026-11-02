// How wide a line of text is in one of our fonts (assets/fonts), read straight from the font file's own tables (head, hhea, hmtx and
// cmap), so a picture made on the server (lib/cover-render.tsx) can choose a size at which a title fits before drawing it. Kerning
// is left out, which only ever makes a line look a little wider than it is: the safe side. Server only (it reads the disk).
export type Metrics = { unitsPerEm: number; advance: (codePoint: number) => number };

export function parseMetrics(buf: Buffer): Metrics {
  const tables = new Map<string, number>();
  const count = buf.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    tables.set(buf.toString("latin1", at, at + 4), buf.readUInt32BE(at + 8));
  }
  const need = (t: string) => { const o = tables.get(t); if (o === undefined) throw new Error(`font has no ${t} table`); return o; };
  const unitsPerEm = buf.readUInt16BE(need("head") + 18);
  const nh = buf.readUInt16BE(need("hhea") + 34);
  const hmtx = need("hmtx");
  const widthOf = (glyph: number) => buf.readUInt16BE(hmtx + Math.min(glyph, nh - 1) * 4);

  // cmap: a Unicode subtable, format 12 (full range) preferred, else format 4 (the basic plane).
  const cmap = need("cmap");
  let f4 = -1, f12 = -1;
  for (let i = 0, n = buf.readUInt16BE(cmap + 2); i < n; i++) {
    const rec = cmap + 4 + i * 8, platform = buf.readUInt16BE(rec), encoding = buf.readUInt16BE(rec + 2), off = cmap + buf.readUInt32BE(rec + 4);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const format = buf.readUInt16BE(off);
    if (format === 12 && f12 < 0) f12 = off;
    if (format === 4 && f4 < 0) f4 = off;
  }
  const glyphOf = (cp: number): number => {
    if (f12 >= 0) {
      for (let i = 0, n = buf.readUInt32BE(f12 + 12); i < n; i++) {
        const g = f12 + 16 + i * 12, start = buf.readUInt32BE(g), end = buf.readUInt32BE(g + 4);
        if (cp >= start && cp <= end) return buf.readUInt32BE(g + 8) + (cp - start);
      }
      return 0;
    }
    if (f4 < 0 || cp > 0xffff) return 0;
    const segX2 = buf.readUInt16BE(f4 + 6), ends = f4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      if (cp > buf.readUInt16BE(ends + i * 2)) continue;
      const start = buf.readUInt16BE(starts + i * 2);
      if (cp < start) return 0;
      const delta = buf.readInt16BE(deltas + i * 2), ro = buf.readUInt16BE(ranges + i * 2);
      if (!ro) return (cp + delta) & 0xffff;
      const g = buf.readUInt16BE(ranges + i * 2 + ro + (cp - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  const cache = new Map<number, number>();
  return {
    unitsPerEm,
    advance: (cp) => {
      let w = cache.get(cp);
      if (w === undefined) { const g = glyphOf(cp); w = g ? widthOf(g) : unitsPerEm * 0.6; cache.set(cp, w); }
      return w;
    },
  };
}

// The width of a line at a font size, in pixels, with optional letter spacing (pixels per character).
export function lineWidth(m: Metrics, text: string, size: number, letterSpacing = 0): number {
  let units = 0, n = 0;
  for (const ch of text) { units += m.advance(ch.codePointAt(0)!); n++; }
  return (units / m.unitsPerEm) * size + letterSpacing * n;
}

// Words into lines no wider than `width`, the way a browser (and satori) breaks them: greedily, at spaces. A word wider than the box
// on its own stays whole on its own line, and the caller sees it in `widest`.
export function wrap(m: Metrics, text: string, size: number, width: number, letterSpacing = 0): { lines: string[]; widest: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && lineWidth(m, next, size, letterSpacing) > width) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return { lines, widest: Math.max(0, ...lines.map((l) => lineWidth(m, l, size, letterSpacing))) };
}

// The largest size, from `max` down to `min`, at which the text fits the box in at most `maxLines` lines. A little room is kept
// (`slack`) for kerning and for the renderer's own rounding. At `min` it fits by contract: the caller shortens the text first.
export function fitText(m: Metrics, text: string, box: { width: number; height: number; maxLines: number; lineHeight: number; max: number; min: number; letterSpacing?: (size: number) => number }, slack = 0.94): { size: number; lines: string[]; fits: boolean } {
  for (let size = box.max; size >= box.min; size -= 2) {
    const ls = box.letterSpacing?.(size) ?? 0;
    const { lines, widest } = wrap(m, text, size, box.width * slack, ls);
    if (lines.length <= box.maxLines && widest <= box.width * slack && lines.length * size * box.lineHeight <= box.height) return { size, lines, fits: true };
  }
  const ls = box.letterSpacing?.(box.min) ?? 0;
  const { lines, widest } = wrap(m, text, box.min, box.width * slack, ls);
  return { size: box.min, lines, fits: lines.length <= box.maxLines && widest <= box.width * slack && lines.length * box.min * box.lineHeight <= box.height };
}

// The same number of lines, but as even as they can be: the narrowest width that still gives that many (no lone short last word).
export function balance(m: Metrics, text: string, size: number, width: number, letterSpacing = 0): string[] {
  const n = wrap(m, text, size, width, letterSpacing).lines.length;
  if (n < 2) return wrap(m, text, size, width, letterSpacing).lines;
  let lo = width * 0.4, hi = width;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (wrap(m, text, size, mid, letterSpacing).lines.length <= n) hi = mid; else lo = mid; }
  return wrap(m, text, size, hi, letterSpacing).lines;
}
