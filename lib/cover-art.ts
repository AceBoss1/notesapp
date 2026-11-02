// The drawings on Notes Academy course covers (lib/cover-render.tsx): our own simple vector icons and our own African-inspired
// patterns, all drawn here as SVG. Nothing is traced from anyone's artwork.
//   Icons: a 100 × 100 box, a 5-unit round stroke. `s` is the line colour, `a` the accent fill and `f` the light fill, so one drawing
//   works on every palette.
//   Patterns: fill a w × h box. adire (indigo resist-dye squares), kente (woven strips of blocks), mudcloth (bogolan rows of marks),
//   diamonds (a lattice), waves (scales and arcs), dots (a soft halftone).
type Ink = { s: string; a: string; f: string };
const I = (body: (c: Ink) => string) => body;

export const COVER_ICONS = {
  laptop: I(({ s, a, f }) => `<rect x="18" y="20" width="64" height="44" rx="4" fill="${f}" stroke="${s}"/><rect x="25" y="27" width="50" height="30" rx="2" fill="${a}" stroke="none"/><path d="M31 50 L42 40 L52 46 L68 33" stroke="${f}" fill="none"/><path d="M8 70 H92 L86 80 H14 Z" fill="${f}" stroke="${s}"/>`),
  chart: I(({ s, a }) => `<path d="M14 12 V86 H90" fill="none" stroke="${s}"/><rect x="24" y="58" width="13" height="28" fill="${a}" stroke="${s}"/><rect x="45" y="44" width="13" height="42" fill="${a}" stroke="${s}"/><rect x="66" y="30" width="13" height="56" fill="${a}" stroke="${s}"/><path d="M22 44 L42 30 L58 36 L84 14" fill="none" stroke="${s}"/><path d="M72 14 H84 V26" fill="none" stroke="${s}"/>`),
  book: I(({ s, a, f }) => `<path d="M50 26 Q34 16 12 20 V78 Q34 74 50 84 Q66 74 88 78 V20 Q66 16 50 26 Z" fill="${f}" stroke="${s}"/><path d="M50 26 V84" stroke="${s}"/><path d="M21 33 Q32 31 42 36 M21 45 Q32 43 42 48 M21 57 Q32 55 42 60 M58 36 Q68 31 79 33 M58 48 Q68 43 79 45" stroke="${a}" fill="none"/>`),
  cap: I(({ s, a, f }) => `<path d="M26 46 V68 Q50 84 74 68 V46" fill="${f}" stroke="${s}"/><path d="M50 16 L94 36 L50 56 L6 36 Z" fill="${a}" stroke="${s}"/><path d="M86 40 V64" stroke="${s}"/><circle cx="86" cy="69" r="5" fill="${a}" stroke="${s}"/>`),
  globe: I(({ s, a, f }) => `<circle cx="50" cy="50" r="37" fill="${f}" stroke="${s}"/><path d="M46 22 Q58 20 62 30 Q67 40 59 48 Q57 60 50 72 Q44 62 44 53 Q35 47 37 37 Q39 27 46 22 Z" fill="${a}" stroke="none"/><ellipse cx="50" cy="50" rx="16" ry="37" fill="none" stroke="${s}"/><path d="M13 50 H87 M19 32 H81 M19 68 H81" stroke="${s}" fill="none"/>`),
  chip: I(({ s, a, f }) => `<path d="M36 9 V24 M50 9 V24 M64 9 V24 M36 76 V91 M50 76 V91 M64 76 V91 M9 36 H24 M9 50 H24 M9 64 H24 M76 36 H91 M76 50 H91 M76 64 H91" stroke="${s}"/><rect x="24" y="24" width="52" height="52" rx="8" fill="${f}" stroke="${s}"/><rect x="35" y="35" width="30" height="30" rx="5" fill="${a}" stroke="${s}"/><path d="M50 40 L53 47 L60 50 L53 53 L50 60 L47 53 L40 50 L47 47 Z" fill="${f}" stroke="none"/>`),
  plant: I(({ s, a, f }) => `<path d="M50 62 V34" stroke="${s}"/><path d="M50 46 Q28 46 21 22 Q44 19 50 42" fill="${f}" stroke="${s}"/><path d="M50 38 Q56 14 81 13 Q79 38 50 42" fill="${f}" stroke="${s}"/><path d="M30 62 H70 L64 88 H36 Z" fill="${a}" stroke="${s}"/><path d="M25 62 H75" stroke="${s}"/>`),
  coins: I(({ s, a, f }) => {
    const coin = (y: number) => `<path d="M12 ${y} V${y + 10} A24 8 0 0 0 60 ${y + 10} V${y}" fill="${f}" stroke="${s}"/><ellipse cx="36" cy="${y}" rx="24" ry="8" fill="${f}" stroke="${s}"/>`;
    return `${coin(70)}${coin(58)}${coin(46)}<circle cx="66" cy="36" r="24" fill="${a}" stroke="${s}"/><path d="M58 26 V46 M58 26 L74 46 M74 26 V46 M53 34 H79 M53 39 H79" stroke="${s}" stroke-width="4" fill="none"/>`;
  }),
  people: I(({ s, a, f }) => `<circle cx="32" cy="34" r="12" fill="${f}" stroke="${s}"/><path d="M10 84 Q10 54 32 54 Q54 54 54 84 Z" fill="${f}" stroke="${s}"/><circle cx="67" cy="30" r="13" fill="${a}" stroke="${s}"/><path d="M42 86 Q42 52 67 52 Q92 52 92 86 Z" fill="${a}" stroke="${s}"/>`),
  heart: I(({ s, a, f }) => `<path d="M50 84 Q13 60 13 35 Q13 17 31 17 Q44 17 50 29 Q56 17 69 17 Q87 17 87 35 Q87 60 50 84 Z" fill="${a}" stroke="${s}"/><path d="M27 36 Q27 28 35 27" stroke="${f}" fill="none"/>`),
  phone: I(({ s, a, f }) => `<rect x="28" y="8" width="44" height="84" rx="8" fill="${f}" stroke="${s}"/><rect x="34" y="20" width="32" height="54" rx="2" fill="${a}" stroke="none"/><path d="M44 14 H56" stroke="${s}"/><circle cx="50" cy="83" r="3" fill="${s}" stroke="none"/>`),
  headset: I(({ s, a, f }) => `<path d="M20 58 V48 Q20 17 50 17 Q80 17 80 48 V58" fill="none" stroke="${s}"/><path d="M79 76 Q79 89 61 89 H56" fill="none" stroke="${s}"/><rect x="12" y="50" width="18" height="28" rx="6" fill="${a}" stroke="${s}"/><rect x="70" y="50" width="18" height="28" rx="6" fill="${a}" stroke="${s}"/><rect x="43" y="84" width="13" height="10" rx="3" fill="${f}" stroke="${s}"/>`),
  cloud: I(({ s, a, f }) => `<path d="M28 74 Q10 74 10 58 Q10 44 26 42 Q28 22 48 22 Q64 22 70 36 Q90 34 90 54 Q90 74 70 74 Z" fill="${f}" stroke="${s}"/><path d="M50 66 V44 M40 53 L50 43 L60 53" fill="none" stroke="${a}" stroke-width="6"/>`),
  bulb: I(({ s, a }) => `<path d="M36 64 Q22 54 22 38 Q22 14 50 14 Q78 14 78 38 Q78 54 64 64 V72 H36 Z" fill="${a}" stroke="${s}"/><path d="M38 80 H62 M42 88 H58" stroke="${s}"/><path d="M44 64 V48 L50 54 L56 48 V64" fill="none" stroke="${s}"/>`),
  tools: I(({ s, a, f }) => `<path d="M22 22 L60 60" stroke="${s}" stroke-width="7"/><path d="M56 56 L80 80 Q84 86 78 90 Q72 94 68 88 L50 64 Z" fill="${a}" stroke="${s}"/><path d="M66 12 Q55 14 53 25 Q52 30 55 35 L16 74 Q11 80 17 85 Q23 90 28 84 L66 46 Q72 49 78 47 Q89 43 89 32 L77 38 L67 34 L63 24 Z" fill="${f}" stroke="${s}"/>`),
  sunrise: I(({ s, a }) => `<path d="M50 14 V28 M20 28 L29 37 M80 28 L71 37 M6 52 H18 M82 52 H94" stroke="${s}"/><path d="M24 70 Q24 42 50 42 Q76 42 76 70 Z" fill="${a}" stroke="${s}"/><path d="M8 70 H92 M26 81 H74 M38 91 H62" stroke="${s}"/>`),
  wheat: I(({ s, a }) => {
    const grain = (x: number, y: number, r: number) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="12" transform="rotate(${r} ${x} ${y})" fill="${a}" stroke="${s}" stroke-width="4"/>`;
    return `<path d="M50 94 V24" stroke="${s}"/>${grain(41, 38, -32)}${grain(59, 38, 32)}${grain(41, 55, -32)}${grain(59, 55, 32)}${grain(41, 72, -32)}${grain(59, 72, 32)}${grain(50, 20, 0)}`;
  }),
  church: I(({ s, a, f }) => `<path d="M50 6 V22 M43 13 H57" stroke="${s}"/><path d="M12 90 V58 L30 46 M88 90 V58 L70 46" fill="none" stroke="${s}"/><path d="M30 46 L50 24 L70 46 V90 H30 Z" fill="${f}" stroke="${s}"/><path d="M42 90 V71 Q50 60 58 71 V90" fill="${a}" stroke="${s}"/><circle cx="50" cy="48" r="6" fill="${a}" stroke="${s}"/><path d="M6 90 H94" stroke="${s}"/>`),
  school: I(({ s, a, f }) => `<path d="M50 18 V5 L63 9 L50 13" fill="${a}" stroke="${s}" stroke-width="4"/><rect x="18" y="40" width="64" height="48" fill="${f}" stroke="${s}"/><path d="M10 42 L50 18 L90 42" fill="none" stroke="${s}"/><rect x="42" y="62" width="16" height="26" fill="${a}" stroke="${s}"/><rect x="26" y="50" width="10" height="10" fill="${a}" stroke="${s}" stroke-width="4"/><rect x="64" y="50" width="10" height="10" fill="${a}" stroke="${s}" stroke-width="4"/><path d="M6 88 H94" stroke="${s}"/>`),
  shop: I(({ s, a, f }) => `<rect x="16" y="42" width="68" height="46" fill="${f}" stroke="${s}"/><path d="M10 30 L18 12 H82 L90 30 Z" fill="${a}" stroke="${s}"/><path d="M10 30 Q10 44 23 44 Q36 44 36 30 Q36 44 50 44 Q64 44 64 30 Q64 44 77 44 Q90 44 90 30" fill="${f}" stroke="${s}"/><rect x="26" y="56" width="20" height="32" fill="${a}" stroke="${s}"/><rect x="56" y="56" width="20" height="16" fill="none" stroke="${s}"/>`),
  megaphone: I(({ s, a, f }) => `<path d="M26 58 L32 82 H42 L38 58" fill="${f}" stroke="${s}"/><path d="M18 42 H32 L72 20 V80 L32 58 H18 Z" fill="${a}" stroke="${s}"/><path d="M82 38 Q88 50 82 62 M87 26 Q99 50 87 74" fill="none" stroke="${s}"/>`),
  shield: I(({ s, a, f }) => `<path d="M50 9 L84 21 V48 Q84 76 50 91 Q16 76 16 48 V21 Z" fill="${a}" stroke="${s}"/><path d="M34 50 L46 62 L67 38" fill="none" stroke="${f}" stroke-width="7"/>`),
  rocket: I(({ s, a, f }) => `<path d="M40 66 Q42 82 50 93 Q58 82 60 66" fill="${a}" stroke="${s}"/><path d="M30 46 L15 64 L31 62 M70 46 L85 64 L69 62" fill="${a}" stroke="${s}"/><path d="M50 7 Q73 24 70 62 H30 Q27 24 50 7 Z" fill="${f}" stroke="${s}"/><circle cx="50" cy="35" r="9" fill="${a}" stroke="${s}"/>`),
  compass: I(({ s, a, f }) => `<circle cx="50" cy="50" r="38" fill="${f}" stroke="${s}"/><path d="M50 16 V24 M50 76 V84 M16 50 H24 M76 50 H84" stroke="${s}"/><path d="M64 36 L57 57 L36 64 L43 43 Z" fill="${a}" stroke="${s}"/><circle cx="50" cy="50" r="3.5" fill="${s}" stroke="none"/>`),
  chat: I(({ s, a, f }) => `<path d="M40 44 H84 Q92 44 92 52 V72 Q92 80 84 80 H78 V90 L66 80 H48 Q40 80 40 72 Z" fill="${a}" stroke="${s}"/><path d="M14 12 H60 Q68 12 68 20 V44 Q68 52 60 52 H34 L22 63 V52 H14 Q8 52 8 44 V20 Q8 12 14 12 Z" fill="${f}" stroke="${s}"/><path d="M20 26 H56 M20 38 H44" stroke="${s}"/>`),
  code: I(({ s, a, f }) => `<rect x="8" y="14" width="84" height="72" rx="8" fill="${f}" stroke="${s}"/><path d="M8 30 H92" stroke="${s}"/><circle cx="18" cy="22" r="2.5" fill="${a}" stroke="none"/><circle cx="27" cy="22" r="2.5" fill="${a}" stroke="none"/><path d="M38 44 L26 57 L38 70 M62 44 L74 57 L62 70 M55 40 L45 74" fill="none" stroke="${a}" stroke-width="6"/>`),
  pen: I(({ s, a, f }) => `<path d="M70 10 L90 30 L38 82 L14 88 L20 64 Z" fill="${a}" stroke="${s}"/><path d="M62 18 L82 38 M20 64 L38 82" stroke="${s}"/><path d="M14 88 L24 85 L17 78 Z" fill="${s}" stroke="none"/><path d="M10 94 H52" stroke="${f}"/>`),
  health: I(({ s, a, f }) => `<circle cx="50" cy="50" r="38" fill="${f}" stroke="${s}"/><path d="M42 26 H58 V42 H74 V58 H58 V74 H42 V58 H26 V42 H42 Z" fill="${a}" stroke="${s}"/>`),
  calendar: I(({ s, a, f }) => `<rect x="12" y="18" width="76" height="70" rx="8" fill="${f}" stroke="${s}"/><path d="M12 36 H88" stroke="${s}"/><rect x="12" y="18" width="76" height="18" rx="8" fill="${a}" stroke="${s}"/><path d="M32 10 V26 M68 10 V26" stroke="${s}"/><rect x="26" y="48" width="12" height="10" fill="${a}" stroke="none"/><rect x="44" y="48" width="12" height="10" fill="${s}" stroke="none" opacity="0.35"/><rect x="62" y="48" width="12" height="10" fill="${s}" stroke="none" opacity="0.35"/><rect x="26" y="66" width="12" height="10" fill="${s}" stroke="none" opacity="0.35"/><rect x="44" y="66" width="12" height="10" fill="${s}" stroke="none" opacity="0.35"/>`),
  camera: I(({ s, a, f }) => `<path d="M10 32 Q10 26 16 26 H32 L38 16 H62 L68 26 H84 Q90 26 90 32 V78 Q90 84 84 84 H16 Q10 84 10 78 Z" fill="${f}" stroke="${s}"/><circle cx="50" cy="54" r="19" fill="${a}" stroke="${s}"/><circle cx="50" cy="54" r="8" fill="${f}" stroke="${s}"/><circle cx="78" cy="38" r="3" fill="${s}" stroke="none"/>`),
  music: I(({ s, a }) => `<path d="M38 74 V22 L84 12 V64" fill="none" stroke="${s}"/><path d="M38 34 L84 24" stroke="${s}"/><ellipse cx="28" cy="76" rx="12" ry="9" fill="${a}" stroke="${s}"/><ellipse cx="74" cy="66" rx="12" ry="9" fill="${a}" stroke="${s}"/>`),
  tractor: I(({ s, a, f }) => `<path d="M20 64 V40 H46 L52 20 H70 V58" fill="${a}" stroke="${s}"/><path d="M56 26 H66 V42 H52 Z" fill="${f}" stroke="${s}" stroke-width="4"/><path d="M70 46 H86 V64" fill="none" stroke="${s}"/><path d="M80 46 V30" stroke="${s}"/><circle cx="32" cy="70" r="16" fill="${f}" stroke="${s}"/><circle cx="32" cy="70" r="5" fill="${s}" stroke="none"/><circle cx="78" cy="76" r="10" fill="${f}" stroke="${s}"/><path d="M8 92 H94" stroke="${s}"/>`),
} as const;
export type CoverIcon = keyof typeof COVER_ICONS;
export const COVER_ICON_IDS = Object.keys(COVER_ICONS) as CoverIcon[];

// A drawing as an SVG fragment at (x, y), size × size.
export function iconSvg(id: CoverIcon, x: number, y: number, size: number, c: Ink, width = 5): string {
  const k = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${k})" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${COVER_ICONS[id](c)}</g>`;
}

// ── Patterns ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// fg: the main line colour; fg2: a second colour; bg: what's under it (for cut-outs). Every pattern fills (0,0)–(w,h).
export type PatternColors = { fg: string; fg2: string; bg: string };
const r1 = (n: number) => Math.round(n * 10) / 10;

function adire(w: number, h: number, c: PatternColors, cell = 120): string {
  let out = "";
  const motifs = [
    (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.8)}"/><circle cx="${cx}" cy="${cy}" r="${r1(r * 0.55)}"/><circle cx="${cx}" cy="${cy}" r="${r1(r * 0.28)}" fill="${c.fg}"/>`,
    (cx: number, cy: number, r: number) => [0, 90, 180, 270].map((a) => `<ellipse cx="${r1(cx + Math.cos((a * Math.PI) / 180) * r * 0.42)}" cy="${r1(cy + Math.sin((a * Math.PI) / 180) * r * 0.42)}" rx="${r1(r * 0.36)}" ry="${r1(r * 0.2)}" transform="rotate(${a} ${r1(cx + Math.cos((a * Math.PI) / 180) * r * 0.42)} ${r1(cy + Math.sin((a * Math.PI) / 180) * r * 0.42)})"/>`).join("") + `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.12)}" fill="${c.fg}"/>`,
    (cx: number, cy: number, r: number) => { let s = ""; for (let i = -3; i <= 3; i++) s += `<path d="M${r1(cx - r * 0.8)} ${r1(cy + i * r * 0.24)} L${r1(cx + r * 0.8)} ${r1(cy + i * r * 0.24)}"/>`; return `<g stroke="${c.fg2}">${s}</g>`; },
    (cx: number, cy: number, r: number) => Array.from({ length: 8 }, (_, i) => `<circle cx="${r1(cx + Math.cos((i * Math.PI) / 4) * r * 0.62)}" cy="${r1(cy + Math.sin((i * Math.PI) / 4) * r * 0.62)}" r="${r1(r * 0.1)}" fill="${c.fg}"/>`).join("") + `<circle cx="${cx}" cy="${cy}" r="${r1(r * 0.22)}"/>`,
    (cx: number, cy: number, r: number) => `<path d="M${r1(cx - r * 0.8)} ${r1(cy + r * 0.5)} Q${r1(cx - r * 0.4)} ${r1(cy - r * 0.5)} ${cx} ${r1(cy + r * 0.5)} Q${r1(cx + r * 0.4)} ${r1(cy - r * 0.5)} ${r1(cx + r * 0.8)} ${r1(cy + r * 0.5)}"/><path d="M${r1(cx - r * 0.8)} ${r1(cy)} Q${r1(cx - r * 0.4)} ${r1(cy - r)} ${cx} ${r1(cy)} Q${r1(cx + r * 0.4)} ${r1(cy - r)} ${r1(cx + r * 0.8)} ${r1(cy)}"/>`,
    (cx: number, cy: number, r: number) => `<rect x="${r1(cx - r * 0.5)}" y="${r1(cy - r * 0.5)}" width="${r1(r)}" height="${r1(r)}" transform="rotate(45 ${cx} ${cy})"/><rect x="${r1(cx - r * 0.22)}" y="${r1(cy - r * 0.22)}" width="${r1(r * 0.44)}" height="${r1(r * 0.44)}" transform="rotate(45 ${cx} ${cy})" fill="${c.fg2}" stroke="none"/>`,
  ];
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    out += `<rect x="${x * cell + 5}" y="${y * cell + 5}" width="${cell - 10}" height="${cell - 10}" stroke-dasharray="2 7"/>`;
    out += motifs[(x * 2 + y * 3) % motifs.length](cx, cy, cell / 2 - 10);
  }
  return `<g fill="none" stroke="${c.fg}" stroke-width="${r1(cell / 40)}" stroke-linecap="round">${out}</g>`;
}

function kente(w: number, h: number, c: PatternColors, strip = 90): string {
  let out = "";
  const cols = Math.ceil(w / strip);
  const block = strip * 0.9;
  for (let x = 0; x < cols; x++) {
    const x0 = x * strip;
    const base = x % 2 ? c.fg : c.fg2;
    out += `<rect x="${x0}" y="0" width="${strip}" height="${h}" fill="${base}"/>`;
    for (let y = 0, k = x; y < h; y += block, k++) {
      const t = k % 4;
      if (t === 0) for (let i = 0; i < 4; i++) out += `<rect x="${x0}" y="${r1(y + i * block / 4 + block / 16)}" width="${strip}" height="${r1(block / 9)}" fill="${c.bg}"/>`;
      else if (t === 1) { out += `<rect x="${x0 + strip * 0.12}" y="${r1(y + block * 0.12)}" width="${r1(strip * 0.76)}" height="${r1(block * 0.76)}" fill="${c.bg}"/>`; out += `<rect x="${r1(x0 + strip * 0.32)}" y="${r1(y + block * 0.32)}" width="${r1(strip * 0.36)}" height="${r1(block * 0.36)}" fill="${base}"/>`; }
      else if (t === 2) { const q = strip / 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) out += `<rect x="${r1(x0 + i * q)}" y="${r1(y + j * block / 4)}" width="${r1(q)}" height="${r1(block / 4)}" fill="${c.bg}"/>`; }
      else out += `<path d="M${x0} ${r1(y + block * 0.75)} L${r1(x0 + strip / 4)} ${r1(y + block * 0.25)} L${r1(x0 + strip / 2)} ${r1(y + block * 0.75)} L${r1(x0 + strip * 0.75)} ${r1(y + block * 0.25)} L${x0 + strip} ${r1(y + block * 0.75)}" fill="none" stroke="${c.bg}" stroke-width="${r1(strip / 11)}"/>`;
    }
    out += `<rect x="${x0}" y="0" width="${r1(strip / 30)}" height="${h}" fill="${c.bg}" opacity="0.6"/>`;
  }
  return out;
}

function mudcloth(w: number, h: number, c: PatternColors, row = 84): string {
  let out = "";
  const rows = Math.ceil(h / row);
  const marks = [
    (y: number) => { let s = ""; for (let x = 18; x < w; x += 46) s += `<path d="M${x - 10} ${y - 10} L${x + 10} ${y + 10} M${x + 10} ${y - 10} L${x - 10} ${y + 10}"/>`; return s; },
    (y: number) => { let s = ""; for (let x = 14; x < w; x += 30) s += `<circle cx="${x}" cy="${y}" r="5" fill="${c.fg}" stroke="none"/>`; return s; },
    (y: number) => { let s = `M0 ${y + 12}`; for (let x = 0; x < w + 30; x += 30) s += ` L${x + 15} ${y - 12} L${x + 30} ${y + 12}`; return `<path d="${s}"/>`; },
    (y: number) => { let s = ""; for (let x = 10; x < w; x += 22) s += `<path d="M${x} ${y - 14} L${x} ${y + 14}"/>`; return s; },
    (y: number) => { let s = ""; for (let x = 26; x < w; x += 56) s += `<circle cx="${x}" cy="${y}" r="14"/><circle cx="${x}" cy="${y}" r="4" fill="${c.fg}" stroke="none"/>`; return s; },
    (y: number) => { let s = ""; for (let x = 6; x < w; x += 40) s += `<path d="M${x} ${y} L${x + 24} ${y}"/>`; return s; },
  ];
  for (let i = 0; i < rows; i++) {
    const y0 = i * row;
    out += `<path d="M0 ${y0 + 4} H${w} M0 ${y0 + 12} H${w}" stroke="${c.fg2}"/>`;
    out += marks[i % marks.length](y0 + row / 2 + 8);
  }
  return `<g fill="none" stroke="${c.fg}" stroke-width="5" stroke-linecap="round">${out}</g>`;
}

function diamonds(w: number, h: number, c: PatternColors, size = 76): string {
  let out = "";
  for (let k = -h; k < w + h; k += size) out += `<path d="M${k} 0 L${k + h} ${h} M${k} ${h} L${k + h} 0"/>`;
  for (let y = 0; y <= h + size; y += size / 2) for (let x = (Math.round(y / (size / 2)) % 2) * (size / 2); x <= w + size; x += size) out += `<rect x="${r1(x - 6)}" y="${r1(y - 6)}" width="12" height="12" transform="rotate(45 ${r1(x)} ${r1(y)})" fill="${c.fg2}" stroke="none"/>`;
  return `<g fill="none" stroke="${c.fg}" stroke-width="4">${out}</g>`;
}

function waves(w: number, h: number, c: PatternColors, r = 40): string {
  let out = "";
  for (let y = 0, i = 0; y < h + r; y += r * 0.8, i++) for (let x = (i % 2) * r; x < w + 2 * r; x += 2 * r) {
    out += `<path d="M${x - r} ${r1(y)} A${r} ${r} 0 0 1 ${x + r} ${r1(y)}"/><path d="M${r1(x - r * 0.6)} ${r1(y)} A${r1(r * 0.6)} ${r1(r * 0.6)} 0 0 1 ${r1(x + r * 0.6)} ${r1(y)}" stroke="${c.fg2}"/>`;
  }
  return `<g fill="none" stroke="${c.fg}" stroke-width="4.5">${out}</g>`;
}

function dots(w: number, h: number, c: PatternColors, gap = 34): string {
  let out = "";
  for (let y = gap / 2, i = 0; y < h; y += gap, i++) for (let x = (i % 2 ? gap : gap / 2); x < w; x += gap) out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(3 + 4 * (x / w))}"/>`;
  return `<g fill="${c.fg}">${out}</g>`;
}

export const COVER_PATTERNS = { adire, kente, mudcloth, diamonds, waves, dots } as const;
export type CoverPattern = keyof typeof COVER_PATTERNS | "none";
export const COVER_PATTERN_IDS: CoverPattern[] = [...(Object.keys(COVER_PATTERNS) as (keyof typeof COVER_PATTERNS)[]), "none"];
export function patternSvg(id: CoverPattern, w: number, h: number, c: PatternColors, scale = 1): string {
  if (id === "none") return "";
  const f = COVER_PATTERNS[id];
  const base = { adire: 120, kente: 90, mudcloth: 84, diamonds: 76, waves: 40, dots: 34 }[id];
  return f(w, h, c, Math.round(base * scale));
}
