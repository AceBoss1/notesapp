// The look of a Business or Enterprise member's own site (their profile, journal and store on their domain or at /s/<username>).
// Legacy is the original, plain look and stays the default so nobody's site changes by surprise; Aurora is the new one.
import { effectiveTier, type UserProfile } from "./users";

export const SITE_THEMES = [
  { id: "legacy", name: "Legacy", blurb: "The original look: a light page, a simple header and a clean list of your notes and shop." },
  { id: "aurora", name: "Aurora", blurb: "The new look: a deep crimson band with your profile on a card, shop categories, a featured item and a reading page with your booking card beside it." },
] as const;
export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];
export const isSiteTheme = (v: unknown): v is SiteThemeId => typeof v === "string" && SITE_THEMES.some((t) => t.id === v);
export const siteThemeOf = (p: { siteTheme?: string } | null | undefined): SiteThemeId => (isSiteTheme(p?.siteTheme) ? p!.siteTheme as SiteThemeId : "legacy");

// Choosing a theme is for Business and Enterprise (the plans that have a branded site).
export const canChooseSiteTheme = (p: Pick<UserProfile, "username" | "role" | "accountTier">) => ["business", "enterprise"].includes(effectiveTier(p));
