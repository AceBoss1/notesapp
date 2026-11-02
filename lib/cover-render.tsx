import React from "react";
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { iconSvg, patternSvg, type PatternColors } from "./cover-art";
import { balance, fitText, lineWidth, parseMetrics, wrap, type Metrics } from "./font-metrics";
import { COVER_HEIGHT as H, COVER_WIDTH as W, PALETTES, type CoverSpec, type CoverTemplate, type Palette } from "./covers";

// Draws a course cover (lib/covers.ts CoverSpec) at 1600 × 900 with next/og (satori), then makes it WebP. Server only. Free to run:
// no AI here. Every template is one SVG of shapes, patterns and the icon behind the words; the words are set by us line by line at a
// size measured from the font files (lib/font-metrics.ts), so a title never runs out of its box: long titles get smaller type and more
// lines, and anything that still can't fit is cut at a word with "…".
type Font = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" };
const read = (p: string) => readFile(path.join(process.cwd(), p));
type Loaded = { fonts: Font[]; m: { display: Metrics; sans: Metrics; sub: Metrics; tag: Metrics; mark: Metrics }; logo: string };
let loaded: Promise<Loaded> | null = null;
function load(): Promise<Loaded> {
  loaded ??= (async (): Promise<Loaded> => {
    const [i6, i7, i8, n7, logo] = await Promise.all(["Inter-600.ttf", "Inter-700.ttf", "Inter-800.ttf", "Newsreader-700.ttf"].map((f) => read(`assets/fonts/${f}`)).concat(read("public/images/brand/icon-512.png")));
    return {
      fonts: [{ name: "Inter", data: i6, weight: 600, style: "normal" }, { name: "Inter", data: i7, weight: 700, style: "normal" }, { name: "Inter", data: i8, weight: 800, style: "normal" }, { name: "Newsreader", data: n7, weight: 700, style: "normal" }] as Font[],
      m: { display: parseMetrics(n7), sans: parseMetrics(i8), sub: parseMetrics(i6), tag: parseMetrics(i7), mark: parseMetrics(i7) },
      logo: `data:image/png;base64,${logo.toString("base64")}`,
    };
  })().catch((e) => { loaded = null; throw e; });
  return loaded!;
}

// ── The templates ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each is drawn for words on the left; for "right" the shapes are mirrored and the icon and words moved across (the icon itself is
// never mirrored). "center" is for frame (and poster, which stays left-aligned).
type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  shapes: string; icon: { cx: number; cy: number; size: number; disc?: number; ring?: boolean; tile?: number };
  text: Box; align: "left" | "center"; font: "display" | "sans"; maxSize: number; maxLines: number; mark: { x: number; y: number }; mirror: boolean;
};
const pc = (p: Palette): PatternColors => ({ fg: p.pat, fg2: p.accent, bg: p.deep });
const clip = (id: string, shape: string, body: string) => `<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${body}</g>`;

function layoutFor(s: CoverSpec): Layout {
  const p: Palette = PALETTES[s.palette];
  const pat = (w: number, h: number, scale = 1) => patternSvg(s.pattern, w, h, pc(p), scale);
  const bg = `<rect width="${W}" height="${H}" fill="${p.bg}"/>`;
  const t: CoverTemplate = s.template;
  const mirror = s.layout === "right" && t !== "frame";
  switch (t) {
    case "band": return {
      shapes: `${bg}<rect x="1000" y="0" width="600" height="${H}" fill="${p.deep}"/>${clip("band", `<rect x="1000" y="0" width="600" height="${H}"/>`, `<g transform="translate(1000 0)">${pat(600, H)}</g>`)}<rect x="1000" y="0" width="14" height="${H}" fill="${p.accent}"/>`,
      icon: { cx: 1300, cy: 450, size: 230, disc: 190, ring: true }, text: { x: 110, y: 110, w: 800, h: 590 }, align: "left", font: "display", maxSize: 112, maxLines: 4, mark: { x: 110, y: 770 }, mirror,
    };
    case "split": return {
      shapes: `${bg}<path d="M930 0 H${W} V${H} H690 Z" fill="${p.deep}"/>${clip("split", `<path d="M930 0 H${W} V${H} H690 Z"/>`, pat(W, H))}<path d="M930 0 L690 ${H}" stroke="${p.accent}" stroke-width="16"/>`,
      icon: { cx: 1250, cy: 450, size: 250, disc: 185 }, text: { x: 100, y: 110, w: 600, h: 590 }, align: "left", font: "sans", maxSize: 104, maxLines: 5, mark: { x: 100, y: 770 }, mirror,
    };
    case "frame": return {
      shapes: `<rect width="${W}" height="${H}" fill="${p.deep}"/>${pat(W, H)}<rect x="130" y="80" width="1340" height="740" rx="30" fill="${p.bg}"/><rect x="152" y="102" width="1296" height="696" rx="20" fill="none" stroke="${p.accent}" stroke-width="5"/>`,
      icon: { cx: 800, cy: 205, size: 120, disc: 88, ring: true }, text: { x: 250, y: 312, w: 1100, h: 380 }, align: "center", font: "display", maxSize: 100, maxLines: 3, mark: { x: 800, y: 712 }, mirror: false,
    };
    case "stripes": return {
      shapes: `${bg}<rect x="1290" y="0" width="310" height="${H}" fill="${p.deep}"/>${clip("stripes", `<rect x="1290" y="0" width="310" height="${H}"/>`, `<g transform="translate(1290 0)">${pat(310, H, 0.9)}</g>`)}<rect x="1262" y="0" width="12" height="${H}" fill="${p.accent}"/><rect x="1240" y="0" width="6" height="${H}" fill="${p.accent}" opacity="0.6"/>`,
      icon: { cx: 1095, cy: 450, size: 170, tile: 236 }, text: { x: 110, y: 110, w: 840, h: 590 }, align: "left", font: "sans", maxSize: 108, maxLines: 4, mark: { x: 110, y: 770 }, mirror,
    };
    case "medallion": return {
      shapes: `${bg}<g opacity="0.22">${pat(W, H, 0.7)}</g><defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.bg}" stop-opacity="1"/><stop offset="0.5" stop-color="${p.bg}" stop-opacity="0.94"/><stop offset="0.72" stop-color="${p.bg}" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#fade)"/><circle cx="1240" cy="450" r="352" fill="${p.accent}"/><circle cx="1240" cy="450" r="336" fill="${p.deep}"/>${clip("med", `<circle cx="1240" cy="450" r="336"/>`, pat(W, H))}<circle cx="1240" cy="450" r="214" fill="${p.deep}"/>`,
      icon: { cx: 1240, cy: 450, size: 250, disc: 190, ring: true }, text: { x: 100, y: 110, w: 700, h: 590 }, align: "left", font: "display", maxSize: 106, maxLines: 5, mark: { x: 100, y: 770 }, mirror,
    };
    case "poster": return {
      shapes: `${bg}<rect x="0" y="650" width="${W}" height="250" fill="${p.deep}"/>${clip("poster", `<rect x="0" y="650" width="${W}" height="250"/>`, `<g transform="translate(0 650)">${pat(W, 250, 0.9)}</g>`)}<rect x="0" y="640" width="${W}" height="12" fill="${p.accent}"/>`,
      icon: { cx: 1340, cy: 640, size: 190, disc: 150, ring: true }, text: { x: 110, y: 120, w: 1060, h: 480 }, align: "left", font: "sans", maxSize: 150, maxLines: 3, mark: { x: 1190, y: 60 }, mirror,
    };
    case "tiles": {
      let tiles = "";
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x = 930 + c * 204, y = 146 + r * 204, id = `t${r}${c}`;
        if (r === 1 && c === 1) continue;
        const odd = (r + c) % 2 === 1;
        tiles += `<rect x="${x}" y="${y}" width="190" height="190" rx="18" fill="${odd ? p.accent : p.deep}"/>`;
        tiles += clip(id, `<rect x="${x}" y="${y}" width="190" height="190" rx="18"/>`, `<g transform="translate(${x} ${y})" opacity="${odd ? 0.55 : 1}">${patternSvg(s.pattern, 190, 190, odd ? { fg: p.deep, fg2: p.bg, bg: p.accent } : pc(p), 0.6)}</g>`);
      }
      return {
        shapes: `${bg}${tiles}<rect x="1134" y="350" width="190" height="190" rx="18" fill="${p.disc}"/><rect x="1134" y="350" width="190" height="190" rx="18" fill="none" stroke="${p.accent}" stroke-width="8"/>`,
        icon: { cx: 1229, cy: 445, size: 150 }, text: { x: 100, y: 110, w: 740, h: 590 }, align: "left", font: "sans", maxSize: 100, maxLines: 5, mark: { x: 100, y: 770 }, mirror,
      };
    }
    case "arch": {
      const arch = `<path d="M1010 ${H} V340 A230 230 0 0 1 1470 340 V${H} Z"/>`;
      return {
        shapes: `${bg}<path d="M992 ${H} V340 A248 248 0 0 1 1488 340 V${H} Z" fill="${p.accent}"/><path d="M1010 ${H} V340 A230 230 0 0 1 1470 340 V${H} Z" fill="${p.deep}"/>${clip("arch", arch, pat(W, H))}`,
        icon: { cx: 1240, cy: 470, size: 220, disc: 165, ring: true }, text: { x: 110, y: 110, w: 800, h: 590 }, align: "left", font: "display", maxSize: 110, maxLines: 4, mark: { x: 110, y: 770 }, mirror,
      };
    }
  }
}

function artSvg(s: CoverSpec, l: Layout): string {
  const p = PALETTES[s.palette];
  const shapes = l.mirror ? `<g transform="translate(${W} 0) scale(-1 1)">${l.shapes}</g>` : l.shapes;
  const cx = l.mirror ? W - l.icon.cx : l.icon.cx, { cy, size } = l.icon;
  const disc = l.icon.disc ? `<circle cx="${cx}" cy="${cy}" r="${l.icon.disc}" fill="${p.disc}"/>${l.icon.ring ? `<circle cx="${cx}" cy="${cy}" r="${l.icon.disc - 14}" fill="none" stroke="${p.accent}" stroke-width="4" stroke-dasharray="3 10" stroke-linecap="round"/>` : ""}` : "";
  const t = l.icon.tile;
  const tile = t ? `<rect x="${cx - t / 2 + 12}" y="${cy - t / 2 + 12}" width="${t}" height="${t}" rx="${t * 0.2}" fill="${p.accent}"/><rect x="${cx - t / 2}" y="${cy - t / 2}" width="${t}" height="${t}" rx="${t * 0.2}" fill="${p.disc}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${shapes}${disc}${tile}${iconSvg(s.icon, cx - size / 2, cy - size / 2, size, { s: p.line, a: p.pop, f: p.fill })}</svg>`;
}

const lh = (l: Layout) => (l.font === "display" ? 1.12 : 1.06);

// Lines that fit `width` at `size`, at most `max` of them; the last is cut at a word with "…" when the text runs on.
function clampLines(m: Metrics, text: string, size: number, width: number, max: number, ls = 0): string[] {
  const { lines } = wrap(m, text, size, width, ls);
  if (lines.length <= max) return balance(m, text, size, width, ls).map((l) => fitWord(m, l, size, width, ls));
  const out = lines.slice(0, max);
  let last = out[max - 1];
  while (last.includes(" ") && lineWidth(m, `${last}…`, size, ls) > width) last = last.slice(0, last.lastIndexOf(" "));
  out[max - 1] = fitWord(m, `${last.replace(/[\s,;:–—-]+$/, "")}…`, size, width, ls);
  return out;
}
// One very long word on its own: cut letters off until it fits.
function fitWord(m: Metrics, line: string, size: number, width: number, ls = 0): string {
  let l = line;
  while (l.length > 2 && lineWidth(m, l, size, ls) > width) l = `${l.slice(0, -2)}…`;
  return l;
}

export type Fitted = { size: number; lines: string[]; sub: { size: number; lines: string[] }; tag: string; ok: boolean };
// The words for one design: the headline as large as it can be in its box, after the tag and the subline have taken their room.
export function fitWords(s: CoverSpec, l: Layout, m: Loaded["m"]): Fitted {
  const hm = l.font === "display" ? m.display : m.sans;
  const hls = (n: number) => (l.font === "sans" ? -0.02 * n : -0.005 * n);
  const tagText = s.tag.toUpperCase();
  const tag = tagText ? fitWord(m.tag, tagText, 24, l.text.w - 60, 4) : "";
  const subSize = s.template === "poster" ? 36 : 32;
  const sub = s.subline ? clampLines(m.sub, s.subline, subSize, l.text.w * 0.94, 2) : [];
  const room = l.text.h - (tag ? 62 : 0) - (sub.length ? 26 + sub.length * subSize * 1.3 : 0);
  const box = { width: l.text.w, height: room, maxLines: l.maxLines, lineHeight: lh(l), max: l.maxSize, min: 40, letterSpacing: hls };
  let f = fitText(hm, s.headline, box);
  // Four lines or more: one fewer line at a slightly smaller size usually reads better ("and / Traders" on lines of their own doesn't).
  if (f.fits && f.lines.length >= 4) { const g = fitText(hm, s.headline, { ...box, maxLines: f.lines.length - 1 }); if (g.fits && g.size >= f.size * 0.85) f = g; }
  if (f.fits) return { size: f.size, lines: balance(hm, s.headline, f.size, l.text.w * 0.94, hls(f.size)), sub: { size: subSize, lines: sub }, tag, ok: true };
  // Smaller still, then cut: the box is never overrun.
  for (let size = 38; size >= 30; size -= 2) {
    const g = fitText(hm, s.headline, { ...box, max: size, min: size });
    if (g.fits) return { size, lines: balance(hm, s.headline, size, l.text.w * 0.94, hls(size)), sub: { size: subSize, lines: sub }, tag, ok: true };
  }
  const lines = Math.max(1, Math.min(l.maxLines + 1, Math.floor(room / (30 * lh(l)))));
  return { size: 30, lines: clampLines(hm, s.headline, 30, l.text.w * 0.94, lines, hls(30)), sub: { size: subSize, lines: sub }, tag, ok: false };
}

function Cover({ s, l, f, logo }: { s: CoverSpec; l: Layout; f: Fitted; logo: string }) {
  const p = PALETTES[s.palette];
  const row = { display: "flex" } as const;
  const x = l.mirror ? W - l.text.x - l.text.w : l.text.x;
  const markX = l.align === "center" ? l.mark.x - 150 : l.mirror ? W - l.mark.x - 300 : l.mark.x;
  const markJustify = l.align === "center" ? "center" : l.mirror !== (s.template === "poster") ? "flex-end" : "flex-start"; // the poster's mark sits top right
  const itemAlign = l.align === "center" ? "center" : l.mirror ? "flex-end" : "flex-start";
  const textAlign = l.align === "center" ? "center" : l.mirror ? "right" : "left";
  const art = `data:image/svg+xml;base64,${Buffer.from(artSvg(s, l)).toString("base64")}`;
  return (
    <div style={{ ...row, position: "relative", width: W, height: H, background: p.bg }}>
      <img src={art} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
      <div style={{ ...row, position: "absolute", left: x, top: l.text.y, width: l.text.w, height: l.text.h, flexDirection: "column", justifyContent: "center", alignItems: itemAlign }}>
        {f.tag && (
          <div style={{ ...row, alignItems: "center", marginBottom: 36, flexDirection: l.mirror ? "row-reverse" : "row" }}>
            <div style={{ ...row, width: 44, height: 6, background: p.accent, borderRadius: 3, margin: l.mirror ? "0 0 0 16px" : "0 16px 0 0" }} />
            <div style={{ ...row, fontFamily: "Inter", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: p.accent, whiteSpace: "nowrap" }}>{f.tag}</div>
          </div>
        )}
        {f.lines.map((t, i) => (
          <div key={i} style={{ ...row, fontFamily: l.font === "display" ? "Newsreader" : "Inter", fontWeight: l.font === "display" ? 700 : 800, fontSize: f.size, lineHeight: lh(l), letterSpacing: l.font === "sans" ? -0.02 * f.size : -0.005 * f.size, color: p.ink, whiteSpace: "nowrap", textAlign }}>{t}</div>
        ))}
        {f.sub.lines.length > 0 && (
          <div style={{ ...row, flexDirection: "column", alignItems: itemAlign, marginTop: 26 }}>
            {f.sub.lines.map((t, i) => <div key={i} style={{ ...row, fontFamily: "Inter", fontWeight: 600, fontSize: f.sub.size, lineHeight: 1.3, color: p.sub, whiteSpace: "nowrap" }}>{t}</div>)}
          </div>
        )}
      </div>
      <div style={{ ...row, position: "absolute", left: markX, top: l.mark.y, width: 300, height: 48, alignItems: "center", justifyContent: markJustify }}>
        <img src={logo} width={40} height={40} alt="" style={{ borderRadius: 9 }} />
        <div style={{ ...row, marginLeft: 12, fontFamily: "Inter", fontWeight: 700, fontSize: 25, color: p.ink, opacity: 0.86, whiteSpace: "nowrap" }}>Notes Academy</div>
      </div>
    </div>
  );
}

// The words of a design as they would be set, and whether every line sits inside its box (tests/covers/covers.test.ts).
export async function measureCover(s: CoverSpec): Promise<{ fitted: Fitted; box: Box; maxLines: number; widest: number; height: number }> {
  const { m } = await load();
  const l = layoutFor(s);
  const f = fitWords(s, l, m);
  const hm = l.font === "display" ? m.display : m.sans;
  const ls = l.font === "sans" ? -0.02 * f.size : -0.005 * f.size;
  const widest = Math.max(...f.lines.map((x) => lineWidth(hm, x, f.size, ls)), ...f.sub.lines.map((x) => lineWidth(m.sub, x, f.sub.size)), f.tag ? lineWidth(m.tag, f.tag, 24, 4) + 60 : 0);
  const height = (f.tag ? 62 : 0) + f.lines.length * f.size * lh(l) + (f.sub.lines.length ? 26 + f.sub.lines.length * f.sub.size * 1.3 : 0);
  return { fitted: f, box: l.text, maxLines: l.maxLines, widest, height };
}

export async function renderCoverPng(s: CoverSpec): Promise<{ png: Buffer; fitted: Fitted }> {
  const { fonts, m, logo } = await load();
  const l = layoutFor(s);
  const fitted = fitWords(s, l, m);
  const res = new ImageResponse(<Cover s={s} l={l} f={fitted} logo={logo} />, { width: W, height: H, fonts });
  return { png: Buffer.from(await res.arrayBuffer()), fitted };
}

// PNG → WebP with the encoder Next.js already ships for its image optimiser (WebAssembly, so nothing to install). null when it can't run;
// callers then keep the PNG.
export async function toWebp(png: Buffer, quality = 82): Promise<Buffer | null> {
  try {
    const req = eval("require") as NodeRequire; // kept out of the bundle: it loads its own .wasm files from node_modules
    const { processBuffer } = req("next/dist/server/lib/squoosh/main") as { processBuffer: (b: Buffer, ops: unknown[], enc: "webp", q: number) => Promise<Buffer> };
    return await processBuffer(png, [], "webp", quality);
  } catch (e) {
    console.error("[covers] webp encoding failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function renderCover(s: CoverSpec): Promise<{ bytes: Buffer; type: "image/webp" | "image/png"; png: Buffer; fitted: Fitted }> {
  const { png, fitted } = await renderCoverPng(s);
  const webp = await toWebp(png);
  return webp ? { bytes: webp, type: "image/webp", png, fitted } : { bytes: png, type: "image/png", png, fitted };
}
