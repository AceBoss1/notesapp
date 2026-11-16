// "Set it up for me" against the Firestore emulator (lib/site-setup-server.ts, scripts/site-setup.ts): a dry run changes nothing, the
// account and its plan are checked, a second run keeps what is there, courses and news are drafts unless published, and the preview notice
// only comes off with `live`. Run: npm run test:sites-server → "SETUP OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SetupError, setUpSite, type SitePreset } from "../../lib/site-setup-server";
import { readSite, saveSite } from "../../lib/site-server";
import { unipa } from "../../scripts/site-presets/unipa";
import { cleanBlocks, LIMITS, visibleBlocks } from "../../lib/site-kits";
import { cleanSpaces, SPACES_MAX, QUESTIONS_MAX } from "../../lib/community";
import { cleanCourseFields, cleanLesson } from "../../lib/courses";
import { TOPICS } from "../../lib/topics";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof SetupError && re.test(e.message));
const count = async (col: string, field: string, v: string) => (await db.collection(col).where(field, "==", v).get()).size;

(async () => {
  // The preset fits the limits as written: nothing is cut or dropped when it is saved.
  const b = cleanBlocks(unipa.blocks);
  const raw = unipa.blocks as { services: { items: { name: string; note: string }[] }; faq: { items: { q: string; a: string }[] }; hero: { headline: string; subline: string; eyebrow: string } };
  assert.deepEqual(b.services.items.map((x) => [x.name, x.note]), raw.services.items.map((x) => [x.name, x.note]));
  assert.deepEqual(b.faq.items, raw.faq.items); assert.ok(b.services.items.length <= LIMITS.services);
  assert.deepEqual([b.hero.headline, b.hero.subline, b.hero.eyebrow], [raw.hero.headline, raw.hero.subline, raw.hero.eyebrow]);
  assert.match(b.hero.image, /^https:\/\/.+\/images\/sites\/world-map\.svg$/);
  assert.equal(cleanSpaces(unipa.community!.spaces).length, unipa.community!.spaces!.length); assert.ok(unipa.community!.spaces!.length <= SPACES_MAX && unipa.community!.questions!.length <= QUESTIONS_MAX);
  const slugs = new Set(TOPICS.map((t) => t.slug));
  for (const c of unipa.courses!) {
    assert.equal(typeof cleanCourseFields({ title: c.title, summary: c.summary, topics: c.topics, level: c.level, outcomes: c.outcomes }), "object", c.title);
    assert.ok(c.topics.every((t) => slugs.has(t)), `${c.title}: topics from the list`);
    for (const l of c.lessons) assert.equal(typeof cleanLesson({ kind: "text", title: l.title, minutes: l.minutes, body: l.body }), "object", l.title);
  }
  for (const n of unipa.news!) assert.ok(n.topics.every((t) => slugs.has(t)) && !Number.isNaN(Date.parse(n.date)), n.title);
  // What the site says about itself: not a UN body, in its bio, its questions, its About page and its community.
  const said = [unipa.bio, raw.faq.items.map((x) => x.a).join(" "), unipa.pages!.about, unipa.community!.about];
  for (const s of said) assert.match(String(s), /not a (UN|United Nations) agency/);

  // No account, or a plan below the kit's: refused, and nothing written.
  await refused(setUpSite(db, unipa, { apply: true }), /no account @unipa/);
  await db.doc("users/org").set({ uid: "org", username: "unipa", displayName: "UNIPA", avatar: "", bio: "", role: "reader", accountTier: "pro", accountKind: "organisation", suspended: false });
  await db.doc("usernames/unipa").set({ uid: "org" });
  await refused(setUpSite(db, unipa, { apply: true }), /comes with Business and above/);
  await refused(setUpSite(db, { ...unipa, kit: "nope" }, { apply: true }), /no kit/);
  await db.doc("users/org").update({ accountTier: "enterprise" });

  // A dry run says what it would do and changes nothing.
  const plan = await setUpSite(db, unipa);
  assert.ok(plan.length >= 10 && plan.every((l) => l.startsWith("would: ")), plan.join("\n"));
  assert.equal((await db.doc("sites/org").get()).exists, false); assert.equal((await db.doc("communities/unipa").get()).exists, false);
  assert.equal(await count("courses", "ownerUid", "org"), 0); assert.equal(await count("notes", "authorUid", "org"), 0);

  // Applied: the site with its sections, marked as a preview; the pages and bio; the community with its Spaces, linked; drafts.
  const t0 = new Date("2026-11-16T10:00:00Z");
  await setUpSite(db, unipa, { apply: true }, t0);
  const site = await readSite(db, "org");
  assert.equal(site.kit, "intl"); assert.equal(site.preview, true); assert.equal(site.community, "unipa"); assert.equal(site.focus, "services");
  assert.deepEqual(visibleBlocks(site, "enterprise"), ["hero", "info", "services", "team", "faq"]);
  const u = (await db.doc("users/org").get()).data()!;
  assert.equal(u.siteTheme, "clean"); assert.deepEqual(u.siteSections, { journals: true, shop: false, courses: true, track: false });
  assert.match(u.sitePages.about, /^## Who we are/); assert.match(u.sitePages.contact, /membership@unipa-un\.org/); assert.equal(u.bio, unipa.bio);
  assert.equal(u.accountTier, "enterprise"); assert.equal(u.avatar, "", "the plan and the picture are never touched");
  const c = (await db.doc("communities/unipa").get()).data()!;
  assert.equal(c.ownerUid, "org"); assert.equal(c.joinMode, "approval"); assert.equal(c.questions.length, 4);
  assert.deepEqual(c.spaces.map((s: { id: string; visibility: string }) => [s.id, s.visibility]), [["announcements", "public"], ["members", "members"], ["ambassadors", "members"], ["chapters", "members"], ["fellows", "members"], ["alumni", "members"]]);
  const courses = (await db.collection("courses").where("ownerUid", "==", "org").get()).docs.map((d) => d.data());
  assert.equal(courses.length, 3); assert.ok(courses.every((x) => x.status === "draft" && x.lessonCount === 3 && x.free === true), "courses wait as drafts");
  const news = (await db.collection("notes").where("authorUid", "==", "org").get()).docs.map((d) => d.data());
  assert.equal(news.length, 4); assert.ok(news.every((x) => x.status === "draft" && x.authorUsername === "unipa")); assert.ok(news.some((x) => x.date === "2025-08-26T14:03:53.000Z"), "news keeps its own date");

  // The organisation edits its site; a second run keeps its words, and makes nothing twice.
  await saveSite(db, "org", { blocks: { ...site.blocks, hero: { ...site.blocks.hero, headline: "Our own headline" } } });
  await db.doc("users/org").update({ "sitePages.about": "Our own About." });
  const again = await setUpSite(db, unipa, { apply: true, publish: true });
  assert.ok(again.filter((l) => l.startsWith("kept: ")).length >= 10, again.join("\n"));
  assert.equal((await readSite(db, "org")).blocks.hero.headline, "Our own headline"); assert.equal((await db.doc("users/org").get()).data()!.sitePages.about, "Our own About.");
  assert.equal(await count("courses", "ownerUid", "org"), 3); assert.equal(await count("notes", "authorUid", "org"), 4);
  assert.equal((await readSite(db, "org")).preview, true, "saving the site keeps the preview notice");
  // --force replaces the sections and pages (and only those).
  await setUpSite(db, unipa, { apply: true, force: true });
  assert.equal((await readSite(db, "org")).blocks.hero.headline, "Bridging nations, empowering people."); assert.match((await db.doc("users/org").get()).data()!.sitePages.about, /^## Who we are/);
  assert.equal((await readSite(db, "org")).community, "unipa", "the community stays linked");

  // Published from the start, for another organisation: courses and news go live through the usual checks.
  await db.doc("users/org2").set({ uid: "org2", username: "peaceworks", displayName: "Peaceworks", avatar: "", bio: "Already has a bio.", role: "reader", accountTier: "business", accountKind: "organisation", suspended: false });
  await db.doc("usernames/peaceworks").set({ uid: "org2" });
  const other: SitePreset = { ...unipa, username: "peaceworks", community: { ...unipa.community!, id: "peaceworks" }, courses: unipa.courses!.slice(0, 1), news: [{ ...unipa.news![0], slug: "peaceworks-news" }] };
  await setUpSite(db, other, { apply: true, publish: true });
  assert.equal((await db.collection("courses").where("ownerUid", "==", "org2").get()).docs[0].data().status, "published");
  assert.equal((await db.collection("notes").where("authorUid", "==", "org2").get()).docs[0].data().status, "published");
  assert.equal((await db.doc("users/org2").get()).data()!.bio, "Already has a bio.", "a bio that is there stays");
  // A community address that belongs to someone else is refused.
  await db.doc("users/org3").set({ uid: "org3", username: "third", displayName: "Third", avatar: "", bio: "", role: "reader", accountTier: "business", suspended: false });
  await db.doc("usernames/third").set({ uid: "org3" });
  await refused(setUpSite(db, { ...unipa, username: "third", courses: [], news: [] }, { apply: true }), /belongs to another account/);
  assert.equal((await db.doc("sites/org3").get()).exists, false, "refused before anything is written");

  // Going live: only the notice comes off.
  assert.deepEqual(await setUpSite(db, unipa, { live: true }), ["would: take the preview notice off"]);
  assert.equal((await readSite(db, "org")).preview, true);
  await setUpSite(db, unipa, { apply: true, live: true });
  const live = await readSite(db, "org");
  assert.equal(live.preview, undefined); assert.equal(live.kit, "intl"); assert.equal(live.blocks.hero.headline, "Bridging nations, empowering people.");

  console.log("SETUP OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
