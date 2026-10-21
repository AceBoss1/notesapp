// The look of a member's own site (Free Basic and above; their profile, journal and store at /s/<username>, and on Business and
// Enterprise their own domain).
// Legacy is the original, plain look and stays the default so nobody's site changes by surprise; Aurora and Maroon are the newer ones.
import type { UserProfile } from "./users";
import { effectiveTier } from "./effective-tier";

export const SITE_THEMES = [
  { id: "legacy", name: "Legacy", blurb: "The original look: a light page, a simple header and a clean list of your notes and shop.", minTier: "basic" },
  { id: "clean", name: "Clean", blurb: "White and rounded, with your main button at the top (Book now, Order on WhatsApp, Call us), a banner with your picture, and your opening hours and contacts in a strip.", minTier: "basic" },
  { id: "scholar", name: "Scholar", blurb: "Plain and academic, made for reading: a narrow page with your photo and links, your publications by year, awards, talks on a globe and news, with a dark mode.", minTier: "basic" },
  { id: "aurora", name: "Aurora", blurb: "A deep colour band with your profile on a card, shop categories, a featured item and a reading page with your booking card beside it.", minTier: "pro" },
  { id: "maroon", name: "Maroon", blurb: "Like the #NotesApp journal feed: a coloured header, your profile on a card, and your notes as posts on white cards that readers can like, share and save.", minTier: "pro" },
] as const;
export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];
export const isSiteTheme = (v: unknown): v is SiteThemeId => typeof v === "string" && SITE_THEMES.some((t) => t.id === v);
export const siteThemeOf = (p: { siteTheme?: string } | null | undefined): SiteThemeId => (isSiteTheme(p?.siteTheme) ? p!.siteTheme as SiteThemeId : "legacy");
// Aurora and Maroon share the crimson header, the band at the top of each page, the profile card and the wide reading page.
export const isCrimsonTheme = (t: string | undefined) => t === "aurora" || t === "maroon";
// The names joined for messages ("Legacy, Aurora or Maroon").
export const siteThemeNames = () => SITE_THEMES.map((t) => t.name).join(", ").replace(/, ([^,]*)$/, " or $1");

// Who has a site (docs/SITES.md, owner's decision of 20 Oct 2026): Free Basic and above, at /s/<username>; their own domain is Business and
// Enterprise (lib/tiers.ts customDomain). Readers who don't publish have no site.
const TIER_RANK: Record<string, number> = { standard: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
export const tierRank = (tier: string) => TIER_RANK[tier] ?? 0;
export const meetsTier = (tier: string, min: string) => tierRank(tier) >= tierRank(min);
export const canHaveSite = (p: Pick<UserProfile, "username" | "role" | "accountTier">) => meetsTier(effectiveTier(p), "basic");
export const themeAllowed = (id: SiteThemeId, tier: string) => meetsTier(tier, SITE_THEMES.find((t) => t.id === id)?.minTier ?? "business");
// The plan a look, kit or section needs, in words ("Pro", "Business").
export const tierName = (min: string) => ({ basic: "Free Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" } as Record<string, string>)[min] ?? min;

// ── Colour sets ──
// Every look draws its accent from three CSS variables (--c-crimson, --c-crimson-bright, --c-crimson-deep: "r g b"), which
// tailwind.config.ts uses for the crimson colours; on the main site they fall back to #NotesApp's own. A site sets them on its wrapper, so the
// whole site follows the member's colours in any look. Presets for every site; a custom brand colour from Pro.
type RGB = [number, number, number];
export const SITE_PALETTES = [
  { id: "crimson", name: "#NotesApp crimson", base: [122, 3, 40], bright: [166, 9, 61], deep: [78, 1, 25] },
  { id: "forest", name: "Forest green", base: [16, 110, 74], bright: [22, 150, 98], deep: [8, 66, 44] },
  { id: "ocean", name: "Ocean blue", base: [18, 82, 160], bright: [37, 112, 214], deep: [10, 48, 98] },
  { id: "royal", name: "Royal purple", base: [88, 44, 150], bright: [120, 70, 196], deep: [52, 24, 92] },
  { id: "sunset", name: "Sunset orange", base: [196, 84, 18], bright: [232, 116, 40], deep: [128, 50, 8] },
  { id: "gold", name: "Gold", base: [150, 112, 20], bright: [196, 150, 34], deep: [96, 70, 10] },
  { id: "charcoal", name: "Charcoal", base: [48, 52, 58], bright: [82, 88, 98], deep: [24, 26, 30] },
] as const satisfies readonly { id: string; name: string; base: RGB; bright: RGB; deep: RGB }[];
export type PaletteId = (typeof SITE_PALETTES)[number]["id"];
export const isPalette = (v: unknown): v is PaletteId => SITE_PALETTES.some((x) => x.id === v);
export const canCustomColour = (tier: string) => meetsTier(tier, "pro");
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const hexRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const mix = (c: RGB, to: number, t: number): RGB => c.map((v) => Math.round(v + (to - v) * t)) as RGB;
// The three shades for a site: a preset, or (Pro and above) a custom colour with a lighter and a darker shade made from it. Too-light custom
// colours are darkened so white text on them stays readable.
export function paletteRgb(palette: { id?: string; custom?: string } | null | undefined, tier: string): { base: RGB; bright: RGB; deep: RGB } {
  if (palette?.custom && HEX_RE.test(palette.custom) && canCustomColour(tier)) {
    let base = hexRgb(palette.custom);
    const lum = (0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]) / 255;
    if (lum > 0.55) base = mix(base, 0, (lum - 0.5) / lum);
    return { base, bright: mix(base, 255, 0.22), deep: mix(base, 0, 0.38) };
  }
  const p = SITE_PALETTES.find((x) => x.id === palette?.id) ?? SITE_PALETTES[0];
  return { base: [...p.base] as RGB, bright: [...p.bright] as RGB, deep: [...p.deep] as RGB };
}
// The page background, with every colour set and every look (owner, 21 Oct 2026): white, or #NotesApp's warm paper. Without a choice, Clean
// is white and the other looks paper, as they were.
export const SITE_BACKGROUNDS = [{ id: "white", name: "White" }, { id: "paper", name: "Paper (warm ivory)" }] as const;
export type SiteBackground = (typeof SITE_BACKGROUNDS)[number]["id"];
export const isBackground = (v: unknown): v is SiteBackground => v === "white" || v === "paper";
export const backgroundOf = (palette: { bg?: string } | null | undefined, theme: string): SiteBackground =>
  isBackground(palette?.bg) ? palette!.bg as SiteBackground : theme === "clean" ? "white" : "paper";
export function paletteVars(palette: { id?: string; custom?: string; bg?: string } | null | undefined, tier: string, theme = "legacy"): Record<string, string> {
  const { base, bright, deep } = paletteRgb(palette, tier);
  // --c-crimson-light and --c-crimson-lighter are the accent on a dark page (the Scholar look's dark mode, app/globals.css).
  const vars: Record<string, string> = {
    "--c-crimson": base.join(" "), "--c-crimson-bright": bright.join(" "), "--c-crimson-deep": deep.join(" "),
    "--c-crimson-light": mix(base, 255, 0.45).join(" "), "--c-crimson-lighter": mix(base, 255, 0.6).join(" "),
  };
  if (backgroundOf(palette, theme) === "white") vars["--c-paper"] = "255 255 255"; // tailwind.config.ts: paper reads --c-paper
  return vars;
}
// Where a visitor's light or dark choice for Scholar sites is kept on their device (components/site/SiteDarkToggle.tsx; read before the first
// paint by the site layout, so it has to live outside the client component).
export const SITE_DARK_KEY = "site-dark";
// The crimson-style band and header, in the site's colours.
export const BAND_GRADIENT = "linear-gradient(100deg, rgb(var(--c-crimson-deep, 78 1 25)) 0%, rgb(var(--c-crimson, 122 3 40)) 70%, rgb(var(--c-crimson-bright, 166 9 61)) 100%)";

