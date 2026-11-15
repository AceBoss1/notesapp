// AI content checks against the Firestore emulator (lib/content-checks-server.ts and the create paths that call it). The checker is
// stubbed by injection (setContentCheckDeps): no test ever calls the AI or the network. Run: npm run test:content-checks-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Finding } from "../../lib/content-checks";
import { ContentCheckError } from "../../lib/content-checks";
import type { CheckItem } from "../../lib/content-checks-ai";
import { CheckerDown, CheckerRefused } from "../../lib/content-checks-ai";
import * as K from "../../lib/content-checks-server";
import * as C from "../../lib/community-server";
import * as E from "../../lib/events-server";
import { createMoment } from "../../lib/moments-server";
import { postComment } from "../../lib/comments-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

// The stub: words in the text or the picture's link say what it "finds". BAD = sexual 0.95, MAYBE = sexual 0.7, NEWS = violence 0.95 in
// a news context, CSAM = child sexual abuse material 0.95, DOWN = the checker is unavailable, REFUSE = it declines.
let calls = 0;
let seen: string[] = [];
let clock = new Date("2026-11-15T10:00:00Z");
const find = (it: CheckItem): Finding[] => {
  const s = it.url ?? it.text ?? "";
  if (/CSAM/.test(s)) return [{ item: it.name, category: "csam", confidence: 0.95, context: "none", reason: "child" }];
  if (/BAD/.test(s)) return [{ item: it.name, category: "sexual", confidence: 0.95, context: "none", reason: "nudity" }];
  if (/MAYBE/.test(s)) return [{ item: it.name, category: "sexual", confidence: 0.7, context: "none", reason: "suggestive" }];
  if (/NEWS/.test(s)) return [{ item: it.name, category: "violence", confidence: 0.95, context: "news", reason: "protest" }];
  return [];
};
K.setContentCheckDeps({
  now: () => clock,
  frames: async (v) => [`https://stream.test/${v.streamUid}/poster.jpg`, `https://stream.test/${v.streamUid}/frame-1.jpg`],
  check: async (items) => {
    calls++;
    seen = items.map((i) => i.url ?? i.text ?? "");
    if (items.some((i) => /DOWN/.test(i.url ?? i.text ?? ""))) throw new CheckerDown("stub: down");
    if (items.some((i) => /REFUSE/.test(i.url ?? i.text ?? ""))) throw new CheckerRefused();
    return items.flatMap(find);
  },
});

const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "reader", accountTier: "basic", suspended: false, ...extra });
const caught = async (p: Promise<unknown>): Promise<ContentCheckError> => {
  try { await p; } catch (e) { if (e instanceof ContentCheckError) return e; throw e; }
  throw new Error("expected a content check to stop it");
};
const flag = async (id: string) => (await db.doc(`contentFlags/${id}`).get()).data()!;
const standing = async (uid: string) => (await db.doc(`contentStanding/${uid}`).get()).data();
const days = (n: number) => { clock = new Date(clock.getTime() + n * 86_400_000); };

(async () => {
  await Promise.all([user("ade"), user("bisi"), user("teen", { teen: true }), user("chi"), user("dan"), user("eve"), user("owner"), user("mod")]);
  K.forgetCheckSettings();

  // ── Passing, and only new or changed items are checked ──
  assert.deepEqual(await K.gateContent(db, { uid: "ade", kind: "community_post", label: "hi", text: "Hello everyone", pictures: ["https://img.test/beach.jpg"] }), { status: "pass" });
  assert.equal(calls, 1);
  await K.gateContent(db, { uid: "ade", kind: "community_post", label: "hi", text: "Hello everyone", pictures: ["https://img.test/beach.jpg"] });
  assert.equal(calls, 1, "the same text and picture aren't checked twice");
  await K.gateContent(db, { uid: "ade", kind: "community_post", label: "hi", text: "Hello everyone", pictures: ["https://img.test/beach.jpg", "https://img.test/new.jpg"] });
  assert.equal(calls, 2); assert.deepEqual(seen, ["https://img.test/new.jpg"], "only the new picture is sent");

  // ── A video: the poster and frames ──
  await K.gateContent(db, { uid: "ade", kind: "media", label: "v", videos: [{ streamUid: "vid1", durationSec: 30 }] });
  assert.deepEqual(seen, ["https://stream.test/vid1/poster.jpg", "https://stream.test/vid1/frame-1.jpg"]);

  // ── Blocked: not published, a strike, and the member is told what and where ──
  let e = await caught(K.gateContent(db, { uid: "bisi", kind: "moment", label: "Weekend at the beach", text: "Weekend at the beach", pictures: ["https://img.test/BAD.jpg"], path: "moments/m1", restore: { set: { text: "Weekend at the beach" } } }));
  assert.equal(e.status, 422); assert.equal(e.detail.outcome, "blocked"); assert.equal(e.detail.item, "picture 1"); assert.equal(e.detail.url, "https://img.test/BAD.jpg");
  assert.equal(e.detail.title, "This photo can't be posted");
  assert.match(e.message, /sexual content in photo 1.*strike 1 of 3/);
  assert.equal((await db.doc("moments/m1").get()).exists, false, "nothing was published");
  const f1 = e.detail.flagId!;
  assert.equal((await flag(f1)).status, "blocked"); assert.equal((await flag(f1)).strike, true);
  assert.equal((await standing("bisi"))!.strikes.length, 1);
  const bells = await db.collection("notifications").where("recipientUid", "==", "bisi").get();
  assert.ok(bells.docs.some((d) => /strike/.test(d.data().message)));

  // ── Held: borderline goes to a person, no strike; news in context too ──
  e = await caught(K.gateContent(db, { uid: "chi", kind: "journal", label: "Before and after", text: "Before and after MAYBE" }));
  assert.equal(e.detail.outcome, "held"); assert.equal((await flag(e.detail.flagId!)).strike, false);
  const heldId = e.detail.flagId!;
  e = await caught(K.gateContent(db, { uid: "chi", kind: "journal", label: "Protest", pictures: ["https://img.test/NEWS.jpg"] }));
  assert.equal(e.detail.outcome, "held");
  assert.equal(await standing("chi"), undefined, "no strikes for held posts");
  // The checker declining is held too.
  e = await caught(K.gateContent(db, { uid: "chi", kind: "media", label: "x", text: "REFUSE this" }));
  assert.equal(e.detail.outcome, "held"); assert.equal(e.detail.category, "unclear");

  // ── Teens: stricter ──
  e = await caught(K.gateContent(db, { uid: "teen", kind: "moment", label: "x", text: "MAYBE teen" }));
  assert.equal(e.detail.outcome, "blocked");

  // ── Three strikes in 90 days pause posting for 14 days; reading and messaging aren't touched ──
  await caught(K.gateContent(db, { uid: "bisi", kind: "community_comment", label: "x", text: "BAD two" }));
  days(10);
  e = await caught(K.gateContent(db, { uid: "bisi", kind: "media", label: "x", text: "BAD three" }));
  assert.ok(e.detail.until); assert.match(e.message, /posting is paused until/);
  assert.equal((await db.doc("users/bisi").get()).data()!.suspended, false, "a pause from posting is not an account suspension");
  e = await caught(K.gateContent(db, { uid: "bisi", kind: "moment", label: "x", text: "Totally fine" }));
  assert.equal(e.status, 403); assert.equal(e.detail.outcome, "paused");
  let mine = await K.myChecks(db, "bisi");
  assert.ok(mine.pausedUntil); assert.equal(mine.activeStrikes, 3); assert.equal(mine.items.filter((i) => i.strike).length, 3);

  // ── Appeals and review: restoring publishes, removes the strike and lifts the pause ──
  await K.appealSuspension(db, "bisi", "That was my art.");
  await assert.rejects(K.appealSuspension(db, "bisi", "again"), /already appealed/);
  let ov = await K.adminOverview(db, { legal: false });
  assert.ok(ov.queue.some((r) => r.id === f1 && r.status === "appealed"));
  await K.reviewFlag(db, "admin1", f1, "restore", "fine");
  assert.equal((await db.doc("moments/m1").get()).data()!.text, "Weekend at the beach", "restored = published");
  assert.equal((await flag(f1)).status, "restored");
  mine = await K.myChecks(db, "bisi");
  assert.equal(mine.activeStrikes, 2); assert.equal(mine.pausedUntil, null, "under the figure again: the pause is lifted");
  await K.gateContent(db, { uid: "bisi", kind: "moment", label: "x", text: "Weekend at the beach", pictures: ["https://img.test/BAD.jpg"] });
  // ^ the restored picture now goes straight through (cleared in the cache)
  // Keep blocked on a held item: it becomes a strike.
  await K.reviewFlag(db, "admin1", heldId, "keep", "");
  assert.equal((await flag(heldId)).status, "blocked"); assert.equal((await standing("chi"))!.strikes.length, 1);
  // A member appeals one strike; a person keeps it.
  await K.appealFlag(db, "chi", heldId, "please");
  await assert.rejects(K.appealFlag(db, "dan", heldId, "x"), /wasn't found/, "only your own");
  await K.reviewFlag(db, "admin1", heldId, "keep", "");
  assert.equal((await flag(heldId)).status, "kept");
  await assert.rejects(K.reviewFlag(db, "admin1", heldId, "restore", ""), /already been decided/);

  // ── A further strike after a suspension is a ban, with the existing suspension records ──
  days(20);
  e = await caught(K.gateContent(db, { uid: "bisi", kind: "moment", label: "x", text: "BAD four" }));
  assert.ok(e.detail.until, "three active strikes again: paused again (the overturned one doesn't count)");
  days(15); // the pause is over
  e = await caught(K.gateContent(db, { uid: "bisi", kind: "moment", label: "x", text: "BAD five" }));
  assert.ok((await standing("bisi"))!.banned);
  assert.equal((await db.doc("users/bisi").get()).data()!.suspended, true);
  assert.equal((await db.doc("suspensions/bisi").get()).data()!.suspendedByUid, "content-checks");
  e = await caught(K.gateContent(db, { uid: "bisi", kind: "moment", label: "x", text: "hello" }));
  assert.equal(e.detail.outcome, "banned");

  // ── Child sexual abuse material: instant ban and the Legal queue; nobody but Legal decides it ──
  e = await caught(K.gateContent(db, { uid: "dan", kind: "media", label: "x", pictures: ["https://img.test/CSAM.jpg"] }));
  assert.equal(e.detail.outcome, "banned");
  assert.equal((await db.doc("users/dan").get()).data()!.suspended, true);
  const legal = await db.collection("legalQueue").where("uid", "==", "dan").get();
  assert.equal(legal.size, 1); assert.equal(legal.docs[0].data().ban, true);
  ov = await K.adminOverview(db, { legal: false });
  assert.equal(ov.legal, null); assert.ok(!ov.queue.some((r) => r.uid === "dan"), "Trust & safety don't see it");
  await assert.rejects(K.reviewFlag(db, "mod1", legal.docs[0].id, "restore", ""), /Legal team/);
  await assert.rejects(K.legalStep(db, "legal1", legal.docs[0].id, "reported", ""), /reference/);
  await K.legalStep(db, "legal1", legal.docs[0].id, "reported", "CT-123");
  assert.equal((await db.doc(`legalQueue/${legal.docs[0].id}`).get()).data()!.status, "reported");

  // ── The checker unavailable: published, queued, re-checked later and taken down ──
  const r = await K.gateContent(db, { uid: "eve", kind: "community_post", label: "x", text: "DOWN and BAD", path: "communityPosts/q1", takedown: { delete: true } });
  assert.equal(r.status, "queued");
  await db.doc("communityPosts/q1").set({ text: "DOWN and BAD" }); // what the create path writes after a pass
  assert.equal(await K.recheckQueued(db), 0, "still down: it waits");
  K.setContentCheckDeps({ now: () => clock, frames: async () => [], check: async (items) => { calls++; return items.flatMap(find); } });
  assert.equal(await K.recheckQueued(db), 1);
  assert.equal((await db.doc("communityPosts/q1").get()).exists, false, "taken down");
  assert.equal((await flag(r.flagId!)).status, "blocked");
  assert.equal((await standing("eve"))!.strikes.length, 1);
  const q2 = await (async () => {
    K.setContentCheckDeps({ now: () => clock, frames: async () => [], check: async () => { throw new CheckerDown(); } });
    return K.gateContent(db, { uid: "eve", kind: "moment", label: "x", text: "all good" });
  })();
  K.setContentCheckDeps({ now: () => clock, frames: async () => [], check: async (items) => { calls++; return items.flatMap(find); } });
  await K.recheckQueued(db);
  assert.equal((await flag(q2.flagId!)).status, "cleared");

  // ── Check passes for browser-saved content ──
  await db.doc("notes/j1").set({ authorUid: "ade", title: "My day", content: "Lovely ![](https://img.test/ok.jpg)", featured_image: "", status: "draft" });
  const pass = await K.issuePass(db, "ade", "journal", { noteId: "j1" });
  assert.ok(pass.passId);
  const pd = (await db.doc(`contentPasses/${pass.passId}`).get()).data()!;
  assert.equal(pd.uid, "ade"); assert.equal(pd.title, "My day"); assert.equal(pd.image, ""); assert.equal(pd.poster, "");
  await assert.rejects(K.issuePass(db, "chi", "journal", { noteId: "j1" }), /isn't your journal/);
  await db.doc("notes/j2").set({ authorUid: "ade", title: "Oops", content: "![](https://img.test/BAD-j2.jpg)", status: "draft" });
  e = await caught(K.issuePass(db, "ade", "journal", { noteId: "j2" }));
  assert.equal(e.detail.item, "picture 1");
  await K.reviewFlag(db, "admin1", e.detail.flagId!, "restore", "");
  assert.equal((await db.doc("notes/j2").get()).data()!.status, "published", "a restored journal is published");
  const sp = await K.issuePass(db, "ade", "store_item", { title: "Ankara dress", subtitle: "Size 10", image: "https://img.test/dress.jpg" });
  assert.deepEqual((await db.doc(`contentPasses/${sp.passId}`).get()).data()!.images, []);
  const pp = await K.issuePass(db, "ade", "profile", { bio: "I write about food." });
  assert.equal((await db.doc(`contentPasses/${pp.passId}`).get()).data()!.displayName, "ADE", "unchanged fields come from the profile");
  await caught(K.issuePass(db, "ade", "profile", { avatar: "https://img.test/BAD-avatar.jpg" }));

  // ── The create paths call the gate ──
  const c = await C.createCommunity(db, "owner", { name: "Lagos Fitness" });
  await C.join(db, "mod", c.id, {});
  await C.setRole(db, "owner", c.id, "mod", "admin");
  await C.join(db, "ade", c.id, {});
  const post = await C.createPost(db, "ade", c.id, "members", { text: "Morning run" });
  assert.ok((await db.doc(`communityPosts/${post.id}`).get()).exists);
  e = await caught(C.createPost(db, "ade", c.id, "members", { text: "BAD", image: "https://img.test/x.jpg" }));
  assert.equal(e.detail.outcome, "blocked");
  await caught(C.addComment(db, "ade", post.id, "BAD comment"));
  await caught(E.createEvent(db, "ade", { title: "BAD party", startsAt: new Date(Date.now() + 86_400_000).toISOString(), place: "Lekki", state: "Lagos", city: "Lekki" }));
  e = await caught(createMoment(db, { uid: "eve", username: "eve" }, { kind: "text", text: "BAD moment" }, { publicUrl: (k) => k, remove: async () => {} }));
  assert.equal(e.detail.outcome, "blocked");
  await db.doc("notes/pub1").set({ authorUid: "chi", title: "A post", status: "published", slug: "a-post" });
  await caught(postComment(db, "eve", { noteId: "pub1", content: "BAD reply" }, false));

  // ── A community: its owner or moderators keep breaking the rules → warned, then closed; the owner can appeal ──
  K.forgetCheckSettings();
  await K.saveCheckSettings(db, { communityStrikes: 2, strikesToSuspend: 10 }, "super1");
  await caught(C.createPost(db, "mod", c.id, "general", { text: "BAD one" }));
  await caught(C.createPost(db, "owner", c.id, "general", { text: "BAD two" }));
  assert.ok((await db.doc(`communities/${c.id}`).get()).data()!.rulesWarning, "warned first");
  assert.ok(((await C.viewCommunity(db, c.id, "ade")).community as { rulesWarning?: string }).rulesWarning, "members see the warning");
  await caught(C.createPost(db, "owner", c.id, "general", { text: "BAD three" }));
  assert.equal((await db.doc(`communities/${c.id}`).get()).data()!.closedForRules, true, "then closed");
  e = await caught(C.createPost(db, "ade", c.id, "members", { text: "Morning run again" }));
  assert.equal(e.status, 403); assert.match(e.message, /community was closed/);
  const closure = (await db.collection("contentFlags").where("uid", "==", "owner").get()).docs.find((d) => d.data().kind === "community")!;
  await K.appealFlag(db, "owner", closure.id, "We've removed them.");
  await K.reviewFlag(db, "admin1", closure.id, "restore", "");
  assert.equal((await db.doc(`communities/${c.id}`).get()).data()!.closedForRules, false, "reopened on review");

  // ── Admin: the figures, the numbers ──
  await assert.rejects(K.saveCheckSettings(db, { reviewAt: 0.99 }, "super1"), /below the block level/);
  ov = await K.adminOverview(db, { legal: true });
  assert.ok(ov.today.checked > 0); assert.ok(ov.week.strikes >= 5); assert.ok(ov.week.overturned >= 1); assert.ok(Array.isArray(ov.legal));
  // Switched off: nothing is checked, and no pass is given.
  await K.saveCheckSettings(db, { enabled: false }, "super1");
  const before = calls;
  assert.deepEqual(await K.gateContent(db, { uid: "ade", kind: "moment", label: "x", text: "BAD but off" }), { status: "off" });
  assert.equal((await K.issuePass(db, "ade", "store_item", { title: "x", image: "y" })).passId, null);
  assert.equal(calls, before);

  K.setContentCheckDeps(null);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
