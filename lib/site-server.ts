import type { Firestore } from "firebase-admin/firestore";
import { effectiveTier, type UserProfile } from "./users";
import { canCustomColour, canHaveSite, tierName } from "./site-themes";
import { applyKitTo, blockAllowed, bookingHoursText, cleanBlocks, cleanOrder, cleanPalette, DEFAULT_ORDER, kitAllowed, kitOf, siteDocOf, type SiteDoc } from "./site-kits";

// Sites (lib/site-kits.ts): the server's side of sites/{uid}, the content sections, colour set and kit of a member's site. Every write is
// checked against the member's plan here; the security rules let anyone read sites/{uid} (it is a public website) and nobody write it.

// The member's booking calendar (publisherSettings/{uid}.session), for the hours strip and the card under posts: whether sessions are on, and
// their opening hours in words when they are.
export async function bookingOf(db: Firestore, uid: string): Promise<{ offered: boolean; hours: string }> {
  const s = (await db.doc(`publisherSettings/${uid}`).get()).data()?.session as { enabled?: boolean; availability?: unknown; minutes?: number } | undefined;
  return s?.enabled ? { offered: true, hours: bookingHoursText(s.availability, s.minutes ?? 60) } : { offered: false, hours: "" };
}

export class SiteError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function readSite(db: Firestore, uid: string): Promise<SiteDoc> {
  return siteDocOf((await db.doc(`sites/${uid}`).get()).data());
}

async function owner(db: Firestore, uid: string): Promise<{ p: UserProfile; tier: string }> {
  const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!p) throw new SiteError(404, "Profile not found.");
  if (!canHaveSite(p)) throw new SiteError(403, "Your own site comes with Free Basic and above: apply for Free Basic under Rates & payouts.");
  return { p, tier: effectiveTier(p) };
}

// Saves what the member sends: their sections' content, their order, the colour set and background, and the booking card under posts. A section the plan doesn't cover is saved switched
// off; a custom colour is kept only from Pro.
export async function saveSite(db: Firestore, uid: string, raw: { blocks?: unknown; order?: unknown; palette?: unknown; bookBelowPosts?: unknown }, now = new Date()): Promise<SiteDoc> {
  const { tier } = await owner(db, uid);
  const cur = await readSite(db, uid);
  const blocks = raw.blocks === undefined ? cur.blocks : cleanBlocks(raw.blocks);
  const locked: string[] = [];
  for (const id of DEFAULT_ORDER) if (blocks[id].on && !blockAllowed(id, tier)) { blocks[id].on = false; locked.push(id); }
  let palette = raw.palette === undefined ? cur.palette : cleanPalette(raw.palette);
  if (palette.custom && !canCustomColour(tier)) {
    if (raw.palette !== undefined) throw new SiteError(403, `Your own brand colour comes with ${tierName("pro")} and above; choose one of the colour sets.`);
    palette = { id: palette.id, ...(palette.bg ? { bg: palette.bg } : {}) };
  }
  const bookBelowPosts = raw.bookBelowPosts === undefined ? cur.bookBelowPosts : raw.bookBelowPosts === true;
  const next: SiteDoc = { ...cur, blocks, order: raw.order === undefined ? cur.order : cleanOrder(raw.order), palette, bookBelowPosts, updatedAt: now.toISOString() };
  await db.doc(`sites/${uid}`).set({ ...next, uid }, { merge: false });
  return next;
}

// Applies a kit (lib/site-kits.ts applyKitTo): look, colours, sections and starter words where nothing is written yet.
export async function applyKit(db: Firestore, uid: string, kitId: unknown, now = new Date()): Promise<{ site: SiteDoc; theme: string; sections: Record<string, boolean> }> {
  const k = kitOf(kitId);
  if (!k) throw new SiteError(400, "Choose a kit.");
  const { tier } = await owner(db, uid);
  if (!kitAllowed(k, tier)) throw new SiteError(403, `The ${k.name} kit comes with ${tierName(k.minTier)} and above.`);
  const cur = await readSite(db, uid);
  const r = applyKitTo(cur, k, tier);
  const site = { ...r.site, updatedAt: now.toISOString() };
  const batch = db.batch();
  batch.set(db.doc(`sites/${uid}`), { ...site, uid });
  batch.update(db.doc(`users/${uid}`), { siteTheme: r.theme, siteSections: r.sections });
  await batch.commit();
  return { site, theme: r.theme, sections: r.sections };
}
