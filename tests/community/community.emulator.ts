// Community and events against the emulators (lib/community-server.ts, lib/events-server.ts). Run: npm run test:community-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as E from "../../lib/events-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => (e instanceof C.CommunityError || e instanceof E.EventError) && e.status === status && (!re || re.test(e.message))); };
const user = (uid: string, tier = "basic", extra = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: tier, ...extra });

(async () => {
  await Promise.all([user("pastor", "basic"), user("ada"), user("bisi"), user("chi"), user("dan"), user("biz", "business", { accountKind: "organisation", org: { rcStatus: "verified" } })]);

  // Starting one: any account; the address is unique; an unverified owner shows the notice.
  const c = await C.createCommunity(db, "pastor", { name: "Grace Chapel", tagline: "Sundays 8am" });
  assert.equal(c.id, "grace-chapel"); assert.equal(c.memberCount, 1);
  await fails(C.createCommunity(db, "ada", { name: "Grace Chapel" }), 409, /taken/);
  let v = await C.viewCommunity(db, "grace-chapel", null);
  assert.ok(v.notice); assert.equal(v.role, null); assert.ok(v.canJoin); assert.equal("inviteCode" in v.community, false);
  assert.equal(v.community.memberLimit, 200); assert.equal(v.community.circlesAllowed, false);
  assert.equal((await C.viewCommunity(db, (await C.createCommunity(db, "biz", { name: "Big Org" })).id, null)).notice, "", "a verified organisation: no notice");

  // Joining: open, then by approval with questions, then by invite only.
  assert.equal((await C.join(db, "ada", "grace-chapel", {})).status, "active");
  await C.updateSettings(db, "pastor", "grace-chapel", { joinMode: "approval", questions: ["Which branch?"] });
  await fails(C.join(db, "bisi", "grace-chapel", {}), 400, /Answer/);
  assert.equal((await C.join(db, "bisi", "grace-chapel", { answers: ["Lekki"] })).status, "pending");
  assert.equal((await C.listMembers(db, "pastor", "grace-chapel", undefined, "pending"))[0].answers?.[0], "Lekki");
  await fails(C.listMembers(db, "ada", "grace-chapel", undefined, "pending"), 403);
  await C.decide(db, "pastor", "grace-chapel", "bisi", true);
  const code = (await C.readCommunity(db, "grace-chapel")).inviteCode;
  await C.updateSettings(db, "pastor", "grace-chapel", { joinMode: "invite" });
  await fails(C.join(db, "chi", "grace-chapel", {}), 403, /invitation/);
  assert.equal((await C.join(db, "chi", "grace-chapel", { invite: code })).status, "active");
  assert.equal((await C.readCommunity(db, "grace-chapel")).memberCount, 4);

  // Roles: the owner makes an admin; an admin makes a moderator but not an admin; a moderator removes members, not other moderators.
  await C.setRole(db, "pastor", "grace-chapel", "ada", "admin");
  await fails(C.setRole(db, "ada", "grace-chapel", "bisi", "admin"), 403);
  await C.setRole(db, "ada", "grace-chapel", "bisi", "moderator");
  await fails(C.removeMember(db, "bisi", "grace-chapel", "ada", false), 403);
  await fails(C.removeMember(db, "ada", "grace-chapel", "pastor", true), 403);

  // Posting: General is for admins; Spaces as set; members comment and like; slow mode for members.
  await fails(C.createPost(db, "chi", "grace-chapel", "general", { text: "hi" }), 403, /admins post/);
  const ann = await C.createPost(db, "ada", "grace-chapel", "general", { text: "Service starts at 8." });
  assert.equal(ann.public, true);
  const bells = await db.collection("notifications").where("recipientUid", "==", "chi").get();
  assert.ok(bells.docs.some((d) => /Grace Chapel: Service starts/.test(d.data().message)), "an announcement reaches every member");
  const corner = await C.createPost(db, "chi", "grace-chapel", "members", { text: "Prayer request" });
  assert.equal(corner.public, false, "a members-only Space");
  await fails(C.listPosts(db, null, "grace-chapel", "members", undefined), 403);
  assert.equal((await C.listPosts(db, null, "grace-chapel", "general", undefined)).posts.length, 1, "non-members read General when it's public");
  await C.updateSettings(db, "pastor", "grace-chapel", { slowModeSec: 300 });
  await fails(C.addComment(db, "chi", corner.id, "Amen"), 429, /Slow mode/);
  await C.addComment(db, "bisi", corner.id, "Praying with you"); // moderators aren't slowed
  await C.like(db, "ada", corner.id, true); await C.like(db, "ada", corner.id, true);
  const p = (await C.listPosts(db, "ada", "grace-chapel", "members", undefined)).posts[0];
  assert.equal(p.likes, 1); assert.equal(p.liked, true); assert.equal(p.comments, 1);
  await C.pinPost(db, "bisi", corner.id, true);
  await fails(C.removePost(db, "dan", ann.id), 403);

  // View as: an admin sees exactly what a non-member would.
  v = await C.viewCommunity(db, "grace-chapel", "ada", "nonmember");
  assert.equal(v.role, null); assert.equal(v.realRole, "admin"); assert.ok(!v.tabs.includes("admin")); assert.ok(!v.channels.some((ch) => ch.id === "members"));
  await C.updateSettings(db, "pastor", "grace-chapel", { publicView: { general: false } });
  assert.ok(!(await C.viewCommunity(db, "grace-chapel", null)).tabs.includes("general"), "admins can hide General from non-members");

  // Ban: gone, and can't come back.
  await C.removeMember(db, "ada", "grace-chapel", "chi", true);
  await fails(C.join(db, "chi", "grace-chapel", { invite: code }), 403);
  await C.unban(db, "ada", "grace-chapel", "chi");
  assert.equal((await C.readCommunity(db, "grace-chapel")).memberCount, 3);

  // Circles: Business only.
  await fails(C.createCircle(db, "pastor", "grace-chapel", { title: "Choir", memberUids: ["ada"] }), 402);
  await Promise.all([user("x1"), user("x2")]);
  await C.join(db, "x1", "big-org", {}); await C.join(db, "x2", "big-org", {});
  const circle = await C.createCircle(db, "biz", "big-org", { title: "Board", memberUids: ["x1", "dan"] });
  assert.equal(circle.members, 2, "only community members go in");
  assert.deepEqual((await C.listCircles(db, "x2", "big-org")).length, 0, "not in it: not shown");
  const ins = await C.insights(db, "pastor", "grace-chapel");
  assert.equal(ins.members, 3); assert.ok(ins.posts30 >= 2);

  // Free communities stop at 200 members.
  await db.doc("communities/grace-chapel").update({ memberCount: 200, joinMode: "open" });
  await fails(C.join(db, "dan", "grace-chapel", {}), 409, /full/);

  // Events: anyone; a community's members-only event; RSVP counts; reminders once.
  const now = new Date();
  const ev = await E.createEvent(db, "ada", { cid: "grace-chapel", title: "Choir practice", startsAt: new Date(now.getTime() + 30 * 60_000).toISOString(), place: "Hall", visibility: "members", repeat: "weekly" });
  await fails(E.createEvent(db, "bisi", { cid: "grace-chapel", title: "Not mine", startsAt: new Date(now.getTime() + 3_600_000).toISOString(), place: "Hall" }), 403);
  await fails(E.getEvent(db, ev.id, "dan"), 403);
  await E.rsvp(db, "bisi", ev.id, "going"); const r = await E.rsvp(db, "bisi", ev.id, "interested");
  assert.deepEqual([r.going, r.interested], [0, 1]);
  const pub = await E.createEvent(db, "dan", { title: "Book launch", startsAt: new Date(now.getTime() + 20 * 3_600_000).toISOString(), place: "Freedom Park", state: "Lagos", city: "Lagos Island" });
  await E.rsvp(db, "ada", pub.id, "going");
  const listed = await E.upcoming(db, { state: "Lagos" }, null);
  assert.deepEqual(listed.map((x) => x.id), [pub.id], "members-only events aren't listed publicly");
  assert.equal((await E.upcoming(db, { cid: "grace-chapel" }, "bisi")).length, 1, "members see their community's");
  const pushes: string[] = [];
  const sent = await E.sendEventReminders(db, now, async (uid, p) => { pushes.push(`${uid}:${p.title}`); return 1; });
  assert.equal(sent, 2); assert.ok(pushes.includes("bisi:Choir practice")); assert.ok(pushes.includes("ada:Book launch"));
  assert.equal(await E.sendEventReminders(db, now, async () => 1), 0, "each reminder once");
  await E.cancelEvent(db, "dan", pub.id);
  assert.equal((await E.upcoming(db, { state: "Lagos" }, null)).length, 0);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
