// What a Business or Enterprise member's own site shows (Journals, Shop, Courses) and its About and Contact pages.
// Both live on users/{uid} and are written only by the server (/api/site/sections, /api/site/pages) after the plan check.
import type { UserProfile } from "./users";
import { ACADEMY_LIVE } from "./courses";

export const SITE_SECTIONS = [
  { id: "journals", name: "Journals", blurb: "Your notes, on Home and on the Notes page." },
  { id: "shop", name: "Shop", blurb: "Your store items, on Home and on the Shop page." },
  { id: "courses", name: "Courses", blurb: "The courses you teach on Notes Academy, on Home and on the Courses page." },
] as const;
export type SiteSectionId = (typeof SITE_SECTIONS)[number]["id"];
export type SiteSections = Record<SiteSectionId, boolean>;

// Courses follow Notes Academy's switch (NEXT_PUBLIC_ACADEMY_LIVE): while it's off, no Courses link or listing shows.
export const COURSES_LIVE = ACADEMY_LIVE;

// Everything is on unless the member switched it off, so sites made before this setting look the same.
export const siteSectionsOf = (p: Pick<UserProfile, "siteSections"> | null | undefined): SiteSections => ({
  journals: p?.siteSections?.journals !== false,
  shop: p?.siteSections?.shop !== false,
  courses: p?.siteSections?.courses !== false,
});

// A valid choice from a request body: every section a true/false, and at least one on. Null otherwise.
export function cleanSiteSections(v: unknown): SiteSections | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!SITE_SECTIONS.every((s) => typeof o[s.id] === "boolean")) return null;
  const out = Object.fromEntries(SITE_SECTIONS.map((s) => [s.id, o[s.id] as boolean])) as SiteSections;
  return Object.values(out).some(Boolean) ? out : null;
}

export const SITE_PAGES = [
  { id: "about", name: "About", hint: "Who you are, what you do and who you do it for." },
  { id: "contact", name: "Contact", hint: "How to reach you: email, phone, WhatsApp, office address and hours." },
] as const;
export type SitePageId = (typeof SITE_PAGES)[number]["id"];
export const isSitePage = (v: unknown): v is SitePageId => v === "about" || v === "contact";
export const SITE_PAGE_MAX = 20_000; // characters of Markdown per page

// The pages a member hasn't written yet (empty or only spaces counts as not written).
export const missingSitePages = (p: Pick<UserProfile, "sitePages"> | null | undefined): SitePageId[] =>
  SITE_PAGES.filter((x) => !p?.sitePages?.[x.id]?.trim()).map((x) => x.id);
