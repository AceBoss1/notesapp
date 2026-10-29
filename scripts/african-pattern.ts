// Draws the #NotesApp African pattern: line drawings of music, art, business and everyday Naija life, scattered on a tile that
// repeats without a seam. Writes public/images/patterns/africa-day.svg (maroon lines for the warm ivory Day look) and
// africa-night.svg (ivory lines for the maroon Night look). Run: npx -y tsx scripts/african-pattern.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { AFRICA_DRAWINGS as ICONS } from "../lib/africa-drawings";


// Small marks between the drawings, like the confetti in a doodle wallpaper.
const FILLERS = [
  `<path d="M-6 0 L6 0 M0 -6 L0 6"/>`,
  `<circle r="3.5"/>`,
  `<path d="M-6 4 L0 -6 L6 4 Z"/>`,
  `<path d="M-8 2 L-4 -2 L0 2 L4 -2 L8 2"/>`,
  `<path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"/>`,
  `<rect x="-4" y="-4" width="8" height="8" transform="rotate(45)"/>`,
];

// A small seeded random, so the tile is the same every time it is drawn.
let seed = 20261029;
const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const TILE = 840, CELL = 105, N = TILE / CELL;
const names = Object.keys(ICONS);
// Shuffle once and walk the list, so no two neighbours repeat and every drawing shows up.
const order = [...names];
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

// A drawing near an edge is drawn again on the far side, so the tile repeats without a seam.
let body = "";
const put = (x: number, y: number, reach: number, inner: string) => {
  for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) {
    if (x + dx + reach < 0 || x + dx - reach > TILE || y + dy + reach < 0 || y + dy - reach > TILE) continue;
    body += `<g transform="translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)})">${inner}</g>`;
  }
};
let k = 0;
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const name = order[k++ % order.length];
    const size = 46 + rnd() * 30; // the drawing's width in px: some small, some large, like a doodle wallpaper
    const cx = c * CELL + CELL / 2 + (r % 2 ? CELL / 2 : 0) + (rnd() - 0.5) * 26;
    const cy = r * CELL + CELL / 2 + (rnd() - 0.5) * 26;
    const rot = Math.round((rnd() - 0.5) * 50);
    put(cx, cy, size * 0.75, `<g transform="rotate(${rot}) translate(${(-size / 2).toFixed(1)} ${(-size / 2).toFixed(1)}) scale(${(size / 100).toFixed(3)})">${ICONS[name]}</g>`);
    // little marks in the gaps
    for (let f = 0; f < 2; f++) {
      if (rnd() < 0.35) continue;
      const fx = cx + (f ? 1 : -1) * (CELL / 2) + (rnd() - 0.5) * 10;
      const fy = cy + (rnd() < 0.5 ? -1 : 1) * (CELL / 2 - 6) + (rnd() - 0.5) * 10;
      put(fx, fy, 10, `<g transform="rotate(${Math.round(rnd() * 90)})">${FILLERS[Math.floor(rnd() * FILLERS.length)]}</g>`);
    }
  }
}

const svg = (stroke: string, opacity: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><g fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;

const dir = new URL("../public/images/patterns/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("africa-day.svg", dir), svg("#7A0328", 0.16));
writeFileSync(new URL("africa-night.svg", dir), svg("#FBF6F2", 0.15));
console.log(`${names.length} drawings on a ${TILE}px tile → public/images/patterns/africa-{day,night}.svg`);
