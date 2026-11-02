import { COVER_ICON_IDS, COVER_PATTERN_IDS, type CoverIcon, type CoverPattern } from "./cover-art";
import type { AccountTier } from "./users";

// Course covers made with Nana (docs/COURSES.md "Covers"). There is no picture model: Nana's Pearl turns the course and the publisher's
// words into a small design (a CoverSpec: template, palette, pattern, icon, headline, subline, tag, layout) and our own renderer
// (lib/cover-render.tsx) draws it at 1600 × 900 and saves it as WebP. This file is the plain part, safe in the browser too: the design's
// shape and its checks, the daily limits, Lagos days, and a design made without the AI (the fallback when the AI's answer can't be read,
// and the stand-in in development when no AI key is set). The server side is lib/covers-server.ts.
export { COVER_ICON_IDS, COVER_PATTERN_IDS, type CoverIcon, type CoverPattern };

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 900;
export const COVER_TEMPLATES = ["band", "split", "frame", "stripes", "medallion", "poster", "tiles", "arch"] as const;
export type CoverTemplate = (typeof COVER_TEMPLATES)[number];
export const COVER_LAYOUTS = ["left", "right", "center"] as const;
export type CoverLayout = (typeof COVER_LAYOUTS)[number];
export const HEADLINE_MAX = 90;
export const SUBLINE_MAX = 90;
export const TAG_MAX = 32;
export const PROMPT_MAX = 300;
export const COVER_HISTORY_MAX = 8; // the last few kept per course, to go back to

export type CoverSpec = {
  template: CoverTemplate; palette: PaletteId; pattern: CoverPattern; icon: CoverIcon;
  headline: string; subline: string; tag: string; layout: CoverLayout;
};
export type CoverCourse = { id?: string; title: string; summary?: string; topics?: string[]; level?: string };
// One saved generation, newest first in the course's history.
export type CoverItem = { id: string; url: string; spec: CoverSpec; at: string; by: string; prompt?: string; baseId?: string; via: "own" | "platform" | "design" | "admin" };

// ── Palettes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// bg: the field behind the words; deep: the art panels; ink and sub: the headline and subline; accent: the tag and highlights;
// pat: the pattern's main line (on deep); disc: the circle or tile behind the icon; line, fill and pop: the icon's own colours.
export type Palette = { name: string; bg: string; deep: string; ink: string; sub: string; accent: string; pat: string; disc: string; line: string; fill: string; pop: string };
export const PALETTES = {
  crimson: { name: "Crimson", bg: "#7A0328", deep: "#4E0119", ink: "#FFF8F1", sub: "#F6D6DE", accent: "#F0B44C", pat: "#B3365F", disc: "#FBF6F2", line: "#4E0119", fill: "#FFFFFF", pop: "#F0B44C" },
  ivory: { name: "Ivory", bg: "#FBF6F2", deep: "#7A0328", ink: "#1A1210", sub: "#5C534E", accent: "#A6093D", pat: "#C23A64", disc: "#FBF6F2", line: "#1A1210", fill: "#FFFFFF", pop: "#E8B04B" },
  ink: { name: "Ink", bg: "#1A1210", deep: "#2E201C", ink: "#FBF6F2", sub: "#D3C8C1", accent: "#E8B04B", pat: "#5A433C", disc: "#E8B04B", line: "#1A1210", fill: "#FBF6F2", pop: "#C2185B" },
  moss: { name: "Moss", bg: "#3D5A45", deep: "#26392C", ink: "#FBF6F2", sub: "#DCE7D8", accent: "#F2C14E", pat: "#5E8467", disc: "#FBF6F2", line: "#22362A", fill: "#FFFFFF", pop: "#F2C14E" },
  indigo: { name: "Indigo", bg: "#1F2A5A", deep: "#141C40", ink: "#F6F1E7", sub: "#CBD5F2", accent: "#F4A259", pat: "#4A5FA8", disc: "#F6F1E7", line: "#141C40", fill: "#FFFFFF", pop: "#F4A259" },
  gold: { name: "Gold", bg: "#F0C35A", deep: "#5A3510", ink: "#1A1210", sub: "#4A3418", accent: "#7A0328", pat: "#9C6420", disc: "#FFF6E0", line: "#1A1210", fill: "#FFFFFF", pop: "#7A0328" },
  teal: { name: "Teal", bg: "#0F5E63", deep: "#0A4044", ink: "#F4EFE6", sub: "#CFE6E3", accent: "#F2A65A", pat: "#23868B", disc: "#F4EFE6", line: "#0A4044", fill: "#FFFFFF", pop: "#F2A65A" },
  earth: { name: "Earth", bg: "#8A4B2A", deep: "#4F2714", ink: "#FBF1E6", sub: "#F2D7BE", accent: "#F2D7A6", pat: "#A8643D", disc: "#FBF1E6", line: "#3B1D0E", fill: "#FFFFFF", pop: "#D9822B" },
} satisfies Record<string, Palette>;
export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

// What Nana is told about the choices (lib/covers-server.ts), and what the editor shows.
export const TEMPLATE_INFO: Record<CoverTemplate, string> = {
  band: "the words on a plain field beside a tall patterned band with the icon in a circle",
  split: "a diagonal split: pattern and a large icon on one side, the words on the other",
  frame: "a patterned border all round a calm card with the icon above the words (centred)",
  stripes: "bold woven stripes down one edge, big words, the icon in a rounded tile",
  medallion: "a large patterned circle holding the icon, the words beside it",
  poster: "very large words across the top, a patterned strip along the bottom with the icon",
  tiles: "a grid of patterned tiles on one side, one tile holding the icon",
  arch: "an arched doorway filled with pattern and the icon, the words beside it",
};
export const PATTERN_INFO: Record<CoverPattern, string> = {
  adire: "adire: indigo resist-dye squares with circles, petals and lines", kente: "kente-like woven strips of coloured blocks",
  mudcloth: "mud cloth (bogolan): rows of crosses, dots, zigzags and ticks", diamonds: "a diamond lattice", waves: "fish scales and arcs", dots: "a soft halftone of dots", none: "no pattern",
};

// ── Checking a design ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isOne = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
// One line of plain words: no control characters, markup or emoji clutter, at most `max` characters, cut at a word.
export function cleanLine(v: unknown, max: number): string {
  let s = String(v ?? "").replace(/[\u0000-\u001f\u007f<>{}[\]`*_#|\\]/g, " ").replace(/\s+/g, " ").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (s.length > max) { const cut = s.slice(0, max + 1); const sp = cut.lastIndexOf(" "); s = (sp > max * 0.5 ? cut.slice(0, sp) : s.slice(0, max)).replace(/[\s,;:–—-]+$/, ""); }
  return s;
}

// Any object into a design every renderer can draw: each field that is missing or not one of ours comes from `base` and is named in `fixed`.
export function cleanSpec(raw: unknown, base: CoverSpec): { spec: CoverSpec; fixed: string[] } {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const fixed: string[] = [];
  const pick = <T extends string>(k: keyof CoverSpec, list: readonly T[]): T => {
    const v = typeof o[k] === "string" ? String(o[k]).trim().toLowerCase() : o[k];
    if (isOne(list, v)) return v;
    fixed.push(k);
    return base[k] as T;
  };
  const line = (k: "headline" | "subline" | "tag", max: number, required: boolean): string => {
    if (o[k] === undefined || o[k] === null) { if (required || o[k] === undefined) fixed.push(k); return base[k]; }
    const s = cleanLine(o[k], max);
    if (!s && required) { fixed.push(k); return base[k]; }
    if (String(o[k]).trim().length > max) fixed.push(k);
    return s;
  };
  const spec: CoverSpec = {
    template: pick("template", COVER_TEMPLATES), palette: pick("palette", PALETTE_IDS), pattern: pick("pattern", COVER_PATTERN_IDS), icon: pick("icon", COVER_ICON_IDS),
    headline: line("headline", HEADLINE_MAX, true), subline: line("subline", SUBLINE_MAX, false), tag: line("tag", TAG_MAX, false), layout: pick("layout", COVER_LAYOUTS),
  };
  return { spec, fixed };
}
export const isCoverSpec = (v: unknown): v is CoverSpec => { const o = v as CoverSpec; return !!o && typeof o === "object" && cleanSpec(o, o).fixed.length === 0; };

// The AI's answer: the first JSON object in it (with or without a ```json fence). null when there isn't one that parses.
export function parseSpecReply(text: string): Record<string, unknown> | null {
  const t = String(text ?? "");
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { const v = JSON.parse(t.slice(start, i + 1)); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
    }
  }
  return null;
}

// ── Daily limits ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Covers a member can make a day, by plan. Every new design counts 1 and every edit counts 1, so "one cover and two edits" and "three
// different covers" are both 3. Free (Standard) can't publish, so 0. The values live in the editable pricing (lib/pricing.ts
// academyCovers, Admin → Pricing); these are the defaults (the owner's 3 for Free Basic). Admins get at least Enterprise's number.
export type CoverLimits = { freeDaily: number; basicDaily: number; proDaily: number; businessDaily: number; enterpriseDaily: number };
export const DEFAULT_COVER_LIMITS: CoverLimits = { freeDaily: 0, basicDaily: 3, proDaily: 10, businessDaily: 25, enterpriseDaily: 50 };
export const COVER_LIMIT_MAX = 500;
const KEY: Record<AccountTier, keyof CoverLimits> = { standard: "freeDaily", basic: "basicDaily", pro: "proDaily", business: "businessDaily", enterprise: "enterpriseDaily" };
export function coverDailyLimit(tier: AccountTier, limits: CoverLimits = DEFAULT_COVER_LIMITS, admin = false): number {
  const n = Math.max(0, Math.floor(Number(limits[KEY[tier]] ?? 0)));
  return admin ? Math.max(n, Math.floor(limits.enterpriseDaily)) : n;
}
// The better of two plans' numbers (an organisation's course: the member's own plan or the organisation's, whichever gives more).
export const coverLimitFor = (tiers: AccountTier[], limits: CoverLimits, admin: boolean) => Math.max(0, ...tiers.map((t) => coverDailyLimit(t, limits, admin)));

// Days are Lagos days (UTC+1, no summer time): the count starts again at midnight in Lagos.
const LAGOS_MS = 3_600_000;
export const lagosDay = (now: Date) => new Date(now.getTime() + LAGOS_MS).toISOString().slice(0, 10);
export function nextLagosMidnight(now: Date): Date {
  const d = new Date(now.getTime() + LAGOS_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - LAGOS_MS);
}
export const leftText = (left: number, limit: number) => (limit <= 0 ? "Not on your plan" : `${Math.max(0, left)} of ${limit} left today`);

// ── A design without the AI ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// Used when the AI's answer can't be read, and in development with no AI key. It reads the course and the publisher's words for
// colours, pictures, patterns and layouts it knows, so "make it green" or "add a laptop" still do what they say.
const ICON_WORDS: [CoverIcon, string[]][] = [
  ["chip", ["ai", "artificial intelligence", "machine learning", "chatgpt", "claude", "robot", "robots", "prompt", "prompts", "automation"]],
  ["code", ["code", "coding", "programming", "developer", "developers", "python", "javascript", "web development", "html", "software development"]],
  ["headset", ["it support", "help desk", "helpdesk", "customer service", "customer support", "call centre", "call center", "headset"]],
  ["tools", ["repair", "repairs", "maintenance", "technician", "troubleshooting", "hardware", "engineering", "tools", "fix"]],
  ["laptop", ["laptop", "computer", "computers", "digital", "excel", "office", "tech", "technology", "software", "online"]],
  ["wheat", ["farmer", "farmers", "agribusiness", "crop", "crops", "harvest", "grain", "wheat", "rice", "maize"]],
  ["tractor", ["tractor", "mechanised", "mechanized"]],
  ["plant", ["farm", "farming", "agriculture", "garden", "gardening", "plant", "plants", "climate", "growth", "sustainability"]],
  ["school", ["teacher", "teachers", "schools", "school", "classroom", "teaching", "lesson plans"]],
  ["cap", ["students", "student", "university", "exam", "exams", "education", "graduation", "waec", "jamb", "scholarship"]],
  ["church", ["church", "churches", "ministry", "faith", "pastor", "worship"]],
  ["people", ["ngo", "ngos", "nonprofit", "community", "communities", "team", "teams", "leadership", "people", "organisations", "organizations", "public", "volunteers", "hr"]],
  ["shop", ["shop", "store", "retail", "small business", "small businesses", "traders", "trader", "market", "vendors", "pos"]],
  ["coins", ["money", "finance", "savings", "budget", "naira", "investing", "investment", "accounting", "bookkeeping", "price", "pricing", "coins", "wealth"]],
  ["chart", ["business", "sales", "analytics", "data", "growth hacking", "strategy", "chart", "excel dashboards", "trading"]],
  ["megaphone", ["marketing", "advertising", "ads", "brand", "branding", "publicity", "announcement", "megaphone"]],
  ["sunrise", ["restart", "new beginning", "fresh start", "breakdown", "recovery", "hope", "rebuild", "resilience", "sunrise", "morning"]],
  ["heart", ["life", "wellbeing", "well-being", "mental health", "love", "relationships", "relationship", "care", "self-care", "heart", "marriage"]],
  ["health", ["health", "medical", "nursing", "first aid", "nutrition", "doctor", "hospital"]],
  ["shield", ["security", "cybersecurity", "cyber", "safety", "privacy", "fraud", "scam", "scams", "protection"]],
  ["rocket", ["startup", "startups", "launch", "founder", "founders", "scale", "rocket"]],
  ["compass", ["career", "careers", "guide", "direction", "purpose", "path", "compass", "jobs"]],
  ["chat", ["communication", "english", "speaking", "conversation", "language", "languages", "whatsapp", "customer chat", "chat"]],
  ["phone", ["phone", "phones", "mobile", "smartphone", "app", "apps", "social media", "instagram", "tiktok"]],
  ["cloud", ["cloud", "aws", "azure", "google cloud", "storage", "backup", "saas"]],
  ["pen", ["writing", "writer", "copywriting", "journal", "journalling", "poetry", "blogging", "pen", "author"]],
  ["calendar", ["planning", "productivity", "schedule", "time management", "calendar", "events", "habits"]],
  ["camera", ["photography", "photo", "photos", "video", "film", "filmmaking", "content creation", "youtube", "camera"]],
  ["music", ["music", "singing", "audio", "podcast", "podcasting", "producer", "guitar", "piano"]],
  ["globe", ["world", "global", "africa", "africans", "travel", "international", "export", "geography", "globe"]],
  ["bulb", ["idea", "ideas", "creativity", "innovation", "everyday", "basics", "beginner", "beginners", "introduction", "thinking", "bulb"]],
  ["book", ["book", "books", "reading", "literature", "study", "research", "history", "law"]],
];
const COLOUR_WORDS: [PaletteId, string[]][] = [
  ["moss", ["green", "moss", "forest", "olive", "leaf", "nature"]], ["indigo", ["blue", "indigo", "navy", "adire", "ocean"]],
  ["gold", ["gold", "golden", "yellow", "sunny", "bright"]], ["teal", ["teal", "turquoise", "aqua", "cyan"]],
  ["earth", ["brown", "earth", "earthy", "terracotta", "clay", "orange", "rust"]], ["ink", ["black", "dark", "night", "ink", "charcoal"]],
  ["ivory", ["white", "light", "cream", "ivory", "clean", "minimal", "plain"]], ["crimson", ["red", "crimson", "maroon", "wine", "burgundy", "brand", "notesapp"]],
];
const PATTERN_WORDS: [CoverPattern, string[]][] = [
  ["adire", ["adire", "tie-dye", "tie dye", "resist"]], ["kente", ["kente", "woven", "stripes", "striped", "weave"]], ["mudcloth", ["mud cloth", "mudcloth", "bogolan", "marks"]],
  ["diamonds", ["diamond", "diamonds", "lattice", "geometric"]], ["waves", ["wave", "waves", "scales", "arcs"]], ["dots", ["dots", "dotted", "halftone", "spots"]],
  ["none", ["no pattern", "without pattern", "without the pattern", "remove the pattern", "plain background"]],
];
const TEMPLATE_WORDS: [CoverTemplate, string[]][] = [
  ["frame", ["frame", "border", "centred", "centered", "center", "centre", "card"]], ["poster", ["poster", "big text", "bigger text", "huge", "bold title", "bigger title"]],
  ["medallion", ["circle", "round", "medallion", "badge"]], ["arch", ["arch", "doorway", "door"]], ["tiles", ["tiles", "grid", "squares", "tile"]],
  ["stripes", ["stripes", "kente stripes", "edge"]], ["split", ["diagonal", "split", "slanted"]], ["band", ["band", "column", "panel"]],
];
const DEFAULT_PATTERN: Record<CoverTemplate, CoverPattern> = { band: "adire", split: "mudcloth", frame: "kente", stripes: "kente", medallion: "adire", poster: "mudcloth", tiles: "adire", arch: "diamonds" };

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
const has = (text: string, w: string) => text.includes(` ${w} `);
function best<T>(table: [T, string[]][], parts: [string, number][]): T | null {
  let top: T | null = null, score = 0;
  for (const [id, words] of table) {
    const s = parts.reduce((n, [t, wt]) => n + words.filter((w) => has(t, w)).length * wt, 0);
    if (s > score) { top = id; score = s; }
  }
  return top;
}
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const LEVELS: Record<string, string> = { beginner: "Beginner course", intermediate: "Intermediate course", advanced: "Advanced course" };
export const defaultTag = (c: CoverCourse) => LEVELS[c.level ?? ""] ?? "Online course";
export function defaultSubline(c: CoverCourse): string {
  const first = String(c.summary ?? "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return first.length <= 70 ? cleanLine(first.replace(/[.!]$/, ""), SUBLINE_MAX) : cleanLine(first, 64) + "…";
}
// A shorter headline: the part before a colon or dash, else the first few words.
export function shorter(h: string): string {
  const head = h.split(/\s[:–—-]\s|:\s/)[0].trim();
  if (head && head.length < h.length) return head;
  const words = h.split(" ");
  return words.length > 4 ? words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ") : h;
}

// seed varies "Try another"; base and instruction make an edit.
export function designFor(c: CoverCourse, opts: { prompt?: string; base?: CoverSpec; seed?: number } = {}): CoverSpec {
  const said = norm(opts.prompt ?? "");
  const text: [string, number][] = [[norm(c.title), 3], [norm((c.topics ?? []).join(" ")), 2], [norm(c.summary ?? ""), 1]];
  if (opts.base) {
    const s = { ...opts.base };
    let changed = false;
    const colour = best(COLOUR_WORDS, [[said, 1]]); if (colour && colour !== s.palette) { s.palette = colour; changed = true; }
    const icon = best(ICON_WORDS, [[said, 1]]); if (icon && icon !== s.icon) { s.icon = icon; changed = true; }
    const pattern = best(PATTERN_WORDS, [[said, 1]]); if (pattern && pattern !== s.pattern) { s.pattern = pattern; changed = true; }
    const template = best(TEMPLATE_WORDS, [[said, 1]]); if (template && template !== s.template) { s.template = template; changed = true; }
    if (/\b(shorter|short|fewer words|less text)\b/.test(said)) { s.headline = shorter(s.headline); changed = true; }
    if (/\b(no subline|remove the subline|no subtitle|remove the subtitle|without subtitle)\b/.test(said)) { s.subline = ""; changed = true; }
    if (/\b(flip|mirror|other side|swap sides)\b/.test(said)) { s.layout = s.layout === "right" ? "left" : "right"; changed = true; }
    else if (has(said, "right")) { s.layout = "right"; changed = true; }
    else if (has(said, "left")) { s.layout = "left"; changed = true; }
    if (!changed) { s.template = COVER_TEMPLATES[(COVER_TEMPLATES.indexOf(s.template) + 1 + (opts.seed ?? 0)) % COVER_TEMPLATES.length]; s.pattern = DEFAULT_PATTERN[s.template]; }
    return s;
  }
  const h = hash(`${c.id ?? ""}|${c.title}|${opts.seed ?? 0}`);
  const template = best(TEMPLATE_WORDS, [[said, 1]]) ?? COVER_TEMPLATES[h % COVER_TEMPLATES.length];
  return {
    template,
    palette: best(COLOUR_WORDS, [[said, 1]]) ?? PALETTE_IDS[(h >>> 5) % PALETTE_IDS.length],
    pattern: best(PATTERN_WORDS, [[said, 1]]) ?? DEFAULT_PATTERN[template],
    icon: best(ICON_WORDS, [[said, 5], ...text]) ?? (["book", "bulb", "cap", "globe"] as CoverIcon[])[(h >>> 9) % 4],
    headline: cleanLine(c.title, HEADLINE_MAX) || "Untitled course",
    subline: defaultSubline(c),
    tag: defaultTag(c),
    layout: (h >>> 12) % 2 ? "right" : "left",
  };
}
