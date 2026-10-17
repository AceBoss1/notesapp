// The look of a Business or Enterprise member's own site (their profile, journal and store on their domain or at /s/<username>).
// Legacy is the original, plain look and stays the default so nobody's site changes by surprise; Aurora and Maroon are the newer ones.
import { effectiveTier, type UserProfile } from "./users";

export const SITE_THEMES = [
  { id: "legacy", name: "Legacy", blurb: "The original look: a light page, a simple header and a clean list of your notes and shop." },
  { id: "aurora", name: "Aurora", blurb: "The new look: a deep crimson band with your profile on a card, shop categories, a featured item and a reading page with your booking card beside it." },
  { id: "maroon", name: "Maroon", blurb: "Like the #NotesApp journal feed: a crimson header, your profile on a card, and your notes as posts on white cards that readers can like, share and save." },
] as const;
export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];
export const isSiteTheme = (v: unknown): v is SiteThemeId => typeof v === "string" && SITE_THEMES.some((t) => t.id === v);
export const siteThemeOf = (p: { siteTheme?: string } | null | undefined): SiteThemeId => (isSiteTheme(p?.siteTheme) ? p!.siteTheme as SiteThemeId : "legacy");
// Aurora and Maroon share the crimson header, the band at the top of each page, the profile card and the wide reading page.
export const isCrimsonTheme = (t: string | undefined) => t === "aurora" || t === "maroon";
// The names joined for messages ("Legacy, Aurora or Maroon").
export const siteThemeNames = () => SITE_THEMES.map((t) => t.name).join(", ").replace(/, ([^,]*)$/, " or $1");

// Choosing a theme is for Business and Enterprise (the plans that have a branded site).
export const canChooseSiteTheme = (p: Pick<UserProfile, "username" | "role" | "accountTier">) => ["business", "enterprise"].includes(effectiveTier(p));
