import { notFound } from "next/navigation";
import { getUserByUsername } from "./users";
import { siteSectionsOf, type SiteSectionId } from "./site-settings";

// On a member's site, a section they switched off (on /profile/site) is not found: its page and the pages inside it.
export async function requireSiteSection(username: string, id: SiteSectionId): Promise<void> {
  const p = await getUserByUsername(username).catch(() => null);
  if (p && !siteSectionsOf(p)[id]) notFound();
}

// Track (logistics businesses): with it off, their site's /track sends visitors to #NotesApp's own tracking page instead of "not found".
export async function trackSectionOn(username: string): Promise<boolean> {
  const p = await getUserByUsername(username).catch(() => null);
  return !!p && siteSectionsOf(p).track;
}
