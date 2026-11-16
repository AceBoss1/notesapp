// "Set it up for me" for an organisation (docs/SITES.md): fills an account's site, its About and Contact pages, a community with
// Spaces, courses on Notes Academy and news from a preset, through the same server functions the pages use, so every plan check and
// every content check still applies. Run from scripts/site-setup.ts; a dry run by default.
//
// The rules it keeps:
//  - The account must already exist. It never creates accounts, changes a plan or touches a picture.
//  - It never wipes what the organisation wrote: a site that already has content, a page with words in it, a course or a news post with the
//    same title are left as they are (unless `force`, which only covers the site's sections and pages).
//  - The site is marked as a preview (lib/site-kits.ts SiteDoc.preview: a notice on every page, kept out of search engines) until it is
//    run again with `live`, after the organisation has taken the site over. Courses and news stay drafts unless `publish`.
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "./users";
import { effectiveTier } from "./effective-tier";
import { kitAllowed, kitOf, type BlockId, type SiteFocus } from "./site-kits";
import { tierName } from "./site-themes";
import { SITE_PAGE_MAX } from "./site-settings";
import { applyKit, linkCommunity, readSite, saveSite } from "./site-server";
import { createCommunity, updateSettings } from "./community-server";
import { addLesson, createCourse, setPublished, updateCourse } from "./courses-server";
import { gateJournal } from "./content-checks-server";
import { roleLabelFor } from "./users";

export type PresetCourse = { title: string; summary: string; topics: string[]; cover?: string; level?: "beginner" | "intermediate" | "advanced"; outcomes?: string[]; lessons: { title: string; minutes: number; body: string }[] };
export type PresetNews = { slug: string; title: string; date: string; topics: string[]; content: string; image?: string };
export type SitePreset = {
  username: string; kit: string;
  bio?: string; // only where the account has none
  palette?: { id: string; custom?: string; bg?: string }; cover?: string; announce?: string; focus?: SiteFocus;
  blocks: Record<string, unknown>; order?: BlockId[];
  pages?: { about?: string; contact?: string };
  community?: { id: string; name: string; tagline: string; about: string; contact?: string; cover?: string; joinMode?: "open" | "approval" | "invite"; questions?: string[]; spaces?: { id?: string; name: string; visibility: "public" | "members"; whoPosts: "members" | "admins" }[] };
  courses?: PresetCourse[];
  news?: PresetNews[];
};
export type SetupOptions = { apply?: boolean; force?: boolean; publish?: boolean; live?: boolean };
export class SetupError extends Error {}

// What it did (or, on a dry run, what it would do), a line each.
export async function setUpSite(db: Firestore, preset: SitePreset, o: SetupOptions = {}, now = new Date()): Promise<string[]> {
  const out: string[] = [];
  const did = (done: string, would = done) => out.push(o.apply ? done : `would: ${would}`);
  const uid = (await db.doc(`usernames/${preset.username}`).get()).data()?.uid as string | undefined;
  const p = uid ? ((await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined) : undefined;
  if (!uid || !p) throw new SetupError(`There is no account @${preset.username}. Sign it up first (as an organisation), put it on its plan, then run this again.`);
  const kit = kitOf(preset.kit);
  if (!kit) throw new SetupError(`There is no kit "${preset.kit}".`);
  const tier = effectiveTier(p);
  if (!kitAllowed(kit, tier)) throw new SetupError(`@${preset.username} is on ${tierName(tier)}; the ${kit.name} kit comes with ${tierName(kit.minTier)} and above.`);

  // Checked before anything is written, so a run that can't finish changes nothing.
  const c = preset.community;
  const existing = c ? (await db.doc(`communities/${c.id}`).get()).data() : undefined;
  if (c && existing && existing.ownerUid !== uid) throw new SetupError(`The community address "${c.id}" belongs to another account. Choose another in the preset.`);
  for (const page of ["about", "contact"] as const) {
    const n = preset.pages?.[page]?.trim().length ?? 0;
    if (n > SITE_PAGE_MAX) throw new SetupError(`The ${page} page is ${n} characters; the limit is ${SITE_PAGE_MAX}.`);
  }

  // Going live: only the notice comes off. Everything else was set up before.
  if (o.live) {
    did("the preview notice is off: the site is live and search engines may list it", "take the preview notice off");
    if (o.apply) await db.doc(`sites/${uid}`).set({ preview: false, updatedAt: now.toISOString() }, { merge: true });
    return out;
  }

  // The site: the kit, then the preset's sections. Left alone when it already has content.
  const cur = await readSite(db, uid);
  if (cur.kit && !o.force) out.push(`kept: the site already has content (kit "${cur.kit}"); run with --force to replace its sections`);
  else {
    did(`site: the ${kit.name} kit, with ${Object.keys(preset.blocks).length} sections filled in`);
    if (o.apply) {
      await applyKit(db, uid, kit.id, now);
      await saveSite(db, uid, { blocks: preset.blocks, ...(preset.order ? { order: preset.order } : {}), ...(preset.palette ? { palette: preset.palette } : {}), ...(preset.cover ? { cover: preset.cover } : {}), ...(preset.announce ? { announce: preset.announce } : {}), ...(preset.focus ? { focus: preset.focus } : {}) }, now);
    }
  }
  did("site: marked as a preview (a notice on every page, kept out of search engines)");
  if (o.apply) await db.doc(`sites/${uid}`).set({ preview: true }, { merge: true });

  // The About and Contact pages, and a bio, where there are none.
  for (const page of ["about", "contact"] as const) {
    const words = preset.pages?.[page]?.trim();
    if (!words) continue;
    if (p.sitePages?.[page]?.trim() && !o.force) { out.push(`kept: the ${page} page is already written`); continue; }
    did(`page: ${page} (${words.length} characters)`);
    if (o.apply) await db.doc(`users/${uid}`).update({ [`sitePages.${page}`]: words, "sitePages.updatedAt": now.toISOString() });
  }
  if (preset.bio && !p.bio?.trim()) { did("profile: the bio"); if (o.apply) await db.doc(`users/${uid}`).update({ bio: preset.bio.slice(0, 300) }); }

  // The community, with its Spaces, linked to the site.
  if (c) {
    if (existing) out.push(`kept: the community "${c.id}" already exists`);
    else {
      did(`community: "${c.name}" at /c/${c.id}, with ${c.spaces?.length ?? 0} Spaces, joining ${c.joinMode === "approval" ? "by approval" : c.joinMode === "invite" ? "by invite" : "open"}`);
      if (o.apply) {
        await createCommunity(db, uid, { id: c.id, name: c.name, tagline: c.tagline, about: c.about }, now);
        await updateSettings(db, uid, c.id, { ...(c.contact ? { contact: c.contact } : {}), ...(c.cover ? { cover: c.cover } : {}), ...(c.joinMode ? { joinMode: c.joinMode } : {}), ...(c.questions ? { questions: c.questions } : {}), ...(c.spaces ? { spaces: c.spaces } : {}) }, now);
      }
    }
    if ((o.apply ? (await readSite(db, uid)).community : cur.community) !== c.id) {
      did("site: the community is linked (a Community page in the menu)");
      if (o.apply) await linkCommunity(db, uid, c.id, now, true);
    }
  }

  // Courses on Notes Academy: drafts for the organisation to check, unless `publish`.
  const mine = preset.courses?.length ? (await db.collection("courses").where("ownerUid", "==", uid).get()).docs.map((d) => String(d.data().title)) : [];
  for (const course of preset.courses ?? []) {
    if (mine.includes(course.title)) { out.push(`kept: the course "${course.title}" already exists`); continue; }
    did(`course: "${course.title}", ${course.lessons.length} lessons, ${o.publish ? "published" : "a draft"}`);
    if (!o.apply) continue;
    const made = await createCourse(db, uid, { title: course.title, summary: course.summary, topics: course.topics, ...(course.cover ? { cover: course.cover } : {}) }, now);
    if (course.level || course.outcomes) await updateCourse(db, uid, made.id, { ...(course.level ? { level: course.level } : {}), ...(course.outcomes ? { outcomes: course.outcomes } : {}) }, now);
    for (const l of course.lessons) await addLesson(db, uid, made.id, { kind: "text", title: l.title, minutes: l.minutes, body: l.body }, now);
    if (o.publish) await setPublished(db, uid, made.id, true, now);
  }

  // News: the organisation's own posts, carried over as journals with their own dates. Drafts unless `publish`.
  for (const n of preset.news ?? []) {
    if (!(await db.collection("notes").where("slug", "==", n.slug).limit(1).get()).empty) { out.push(`kept: the news post "${n.title}" already exists`); continue; }
    did(`news: "${n.title}" (${n.date.slice(0, 10)}), ${o.publish ? "published" : "a draft"}`);
    if (!o.apply) continue;
    const ref = db.collection("notes").doc();
    const note = {
      viewCount: 0, likeCount: 0, shareCount: 0, slug: n.slug, title: n.title, date: n.date, topics: n.topics, categories: [], tags: [], featured_image: n.image ?? "", content: n.content,
      author: p.displayName, author_role: roleLabelFor(p), author_avatar: p.avatar || "", authorUid: uid, authorUsername: p.username, status: o.publish ? "published" : "draft",
    };
    if (o.publish) await gateJournal(db, uid, note, ref.path); // the same content check as a post written by hand
    await ref.set(note);
  }
  return out;
}
