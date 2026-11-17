// Notes Live Studio on the server (lib/rooms-server.ts studioStep) against the Firestore emulator: who switches it on, the gate while
// the team tests it, what an editor and a moderator may do, files only from one's own folder, comments taken from the chat's own copy,
// the queue, clips and the shared screen. Run: npm run test:rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import { MOD_PRESETS, type RoomDoc } from "../../lib/rooms";
import { STUDIO_CLOSED } from "../../lib/studio";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const BASE = "https://media.test";
const EDITOR = MOD_PRESETS.find((p) => p.id === "editor")!.perms;

(async () => {
  const ppl = ["shost", "sed", "smod", "sbasic", "sguest", "sview"];
  for (const u of ppl) await db.doc(`users/${u}`).set({ uid: u, username: u, displayName: u.toUpperCase(), role: "publisher", accountTier: "basic" });
  const c = await C.createCommunity(db, "shost", { name: "Studio Chapel" });
  for (const u of ppl.slice(1)) await db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, username: u, displayName: u.toUpperCase(), avatar: "", role: "member", status: "active", joinedAt: new Date().toISOString() });
  delete process.env.CLOUDFLARE_REALTIME_APP_ID; delete process.env.CLOUDFLARE_REALTIME_APP_TOKEN;
  R.resetRoomSettingsCache();
  const { id } = await R.startRoom(db, "shost", c.id, "Studio night", new Date(), undefined, undefined, {
    stageMode: "approve", mods: [{ who: "sed", perms: EDITOR }, { who: "smod", perms: ["onair", "chatRemove"] }, "sbasic"],
  });
  for (const u of ppl.slice(1)) await R.joinRoom(db, u, id);
  const step = (uid: string, body: Record<string, unknown>) => R.studioStep(db, uid, id, body);

  // ── off until the host switches it on; while the team tests, only in a live on the staff pass ──
  await fails(step("sed", { op: "set", patch: { layout: "grid" } }), 409, /hasn't switched the studio on/);
  await fails(step("sed", { op: "on", on: true }), 403, /Only the host/);
  await fails(step("shost", { op: "on", on: true }), 403, new RegExp(STUDIO_CLOSED.slice(0, 30)));
  await db.doc(`communityRooms/${id}`).update({ staffPass: true });
  assert.equal((await step("shost", { op: "on", on: true })).studio.on, true);
  assert.equal((await roomDoc(id)).studio?.on, true);

  // ── the graphics: the host and the editor; not a moderator without "studio", not a viewer ──
  let s = (await step("sed", { op: "set", patch: { layout: "spotlight", theme: "midnight", lower: { on: true, head: "African Mental Freedom", name: "Dr. N" }, ticker: { on: true, lines: ["one", "two"] }, caption: "hello" } })).studio;
  assert.equal(s.layout, "spotlight"); assert.equal(s.lower.on, true); assert.deepEqual(s.ticker.lines, ["one", "two"]); assert.equal(s.caption, "hello"); assert.equal(s.on, true);
  await fails(step("smod", { op: "set", patch: { layout: "grid" } }), 403, /editor/);
  await fails(step("sbasic", { op: "set", patch: { layout: "grid" } }), 403);
  await fails(step("sview", { op: "set", patch: { layout: "grid" } }), 403);
  await fails(step("sed", { op: "set", patch: { lower: { on: true, head: "", name: "" } } }), 400, /headline or a name/);
  await fails(step("sed", { op: "on", on: false }), 403, /Only the host/);

  // ── files: only from the editor's own folder in our storage ──
  await fails(step("sed", { op: "set", patch: { bug: { logo: "https://evil.test/x.png" } } }), 400, /logo/);
  await fails(step("sed", { op: "set", patch: { bug: { logo: `${BASE}/posters/shost/logo.webp` } } }), 400, /logo/);
  s = (await step("sed", { op: "set", patch: { bug: { logo: `${BASE}/posters/sed/logo.webp`, show: "THE EMERGING VOICES" } } })).studio;
  assert.equal(s.bug.logo, `${BASE}/posters/sed/logo.webp`); assert.equal(s.bug.show, "THE EMERGING VOICES");
  await fails(step("sed", { op: "clip", url: `${BASE}/studio/shost/intro.mp4` }), 400, /clip/);
  await fails(step("smod", { op: "clip", url: `${BASE}/studio/smod/intro.mp4` }), 403);
  s = (await step("sed", { op: "clip", url: `${BASE}/studio/sed/1-intro.mp4`, label: "Intro", ad: true })).studio;
  assert.equal(s.clip?.kind, "video"); assert.equal(s.clip?.ad, true); assert.equal(s.clip?.by, "sed"); assert.ok(s.clip?.at);
  assert.equal((await step("shost", { op: "clip", url: "" })).studio.clip, null);
  s = (await step("shost", { op: "set", patch: { sponsor: { url: `${BASE}/posters/shost/ad.gif`, slot: "banner" } } })).studio;
  assert.equal(s.sponsor?.slot, "banner"); assert.equal(s.sponsor?.kind, "image");

  // ── comments on air: a moderator holding "onair"; the chat's own copy wins over what the moderator's screen sent ──
  await db.doc(`communityRooms/${id}/chat/m1`).set({ from: "sview", name: "SVIEW", avatar: "", text: "What I really said", at: new Date().toISOString() });
  s = (await step("smod", { op: "comment", message: { id: "m1", from: "sview", name: "Someone Else", avatar: "", text: "Words put in my mouth" } })).studio;
  assert.equal(s.comment?.text, "What I really said"); assert.equal(s.comment?.name, "SVIEW"); assert.equal(s.comment?.by, "smod");
  await fails(step("sbasic", { op: "comment", message: { id: "m1", from: "sview", name: "x", text: "y" } }), 403);
  await fails(step("sview", { op: "comment", message: null }), 403);
  await fails(step("smod", { op: "comment", message: { id: "", text: "" } }), 400);
  s = (await step("smod", { op: "queue", message: { id: "m2", from: "sguest", name: "SGUEST", avatar: "", text: "Second" } })).studio;
  assert.deepEqual(s.queue.map((q) => q.id), ["m2"]);
  s = (await step("sed", { op: "comment", message: s.queue[0] })).studio;
  assert.equal(s.comment?.id, "m2"); assert.equal(s.queue.length, 0, "it leaves the queue when it goes on air");
  s = (await step("smod", { op: "queue", message: { id: "m3", from: "sview", name: "SVIEW", avatar: "", text: "Third" } })).studio;
  assert.equal((await step("smod", { op: "unqueue", messageId: "m3" })).studio.queue.length, 0);
  assert.equal((await step("smod", { op: "comment", message: null })).studio.comment, null);
  const logged = (await R.roomModLog(db, "shost", id)).log.map((e) => `${e.by}:${e.action}`);
  assert.ok(logged.includes("smod:put a comment on air") && logged.includes("sed:play a clip") && logged.includes("sed:change the studio's graphics"), "moderators' studio actions are in the log");

  // ── a shared screen: someone on stage, when the host lets speakers use video ──
  await fails(step("sview", { op: "screen", on: true }), 403, /on stage/);
  await R.raiseHand(db, "sguest", id, true);
  await R.setSpeaker(db, "shost", id, "sguest", true);
  assert.ok((await roomDoc(id)).speakers.includes("sguest"));
  await fails(step("sguest", { op: "screen", on: true }), 403, /hasn't let speakers use video/);
  assert.equal((await step("shost", { op: "screen", on: true })).studio.screen, "shost");
  assert.equal((await step("sed", { op: "screen", on: false }).catch(() => ({ studio: { screen: "refused" } }))).studio.screen, "refused", "the editor isn't on stage");
  assert.equal((await roomDoc(id)).studio?.screen, "shost", "only the sharer clears their own screen");
  assert.equal((await step("shost", { op: "screen", on: false })).studio.screen, "");
  await fails(step("shost", { op: "nonsense" }), 400);

  // ── the host switches it off: everything stays as it was for next time, and steps are refused; then the room ends ──
  // ── automatic subtitles: the editor switches them on; each person on stage posts their own lines; a lone voice has no name ──
  await fails(step("sguest", { op: "say", text: "hello", ms: 3000 }), 403, /switched off/);
  await fails(step("sbasic", { op: "set", patch: { subs: { on: true } } }), 403);
  s = (await step("sed", { op: "set", patch: { subs: { on: true, look: "bold" } } })).studio;
  assert.deepEqual([s.subs.on, s.subs.look, s.subs.names], [true, "bold", true]);
  await fails(step("sview", { op: "say", text: "I'm only watching", ms: 3000 }), 403, /on stage/);
  const stageNow = [(await roomDoc(id)).hostUid, ...(await roomDoc(id)).speakers];
  const guestOn = stageNow.includes("sguest");
  s = (await step("shost", { op: "say", text: "  good evening\nand welcome ", ms: 3500, name: "Someone Else" })).studio;
  assert.deepEqual([s.said[0].uid, s.said[0].text, s.said[0].ms], ["shost", "good evening and welcome", 3500]);
  assert.notEqual(s.said[0].name, "Someone Else", "the name is the room's, never what was sent");
  assert.equal(s.said[0].solo, stageNow.length === 1, "alone on stage: no name");
  await fails(step("shost", { op: "say", text: "too soon", ms: 3000 }), 429);
  await fails(step("shost", { op: "say", text: "   ", ms: 3000 }), 400);
  if (guestOn) {
    s = (await step("sguest", { op: "say", text: "thank you for having me", ms: 3000 })).studio;
    assert.deepEqual(s.said.map((l) => [l.uid, l.solo]), [["shost", false], ["sguest", false]].slice(-s.said.length));
    // The guest mutes themselves: the host's next line goes out alone, without a name. Unmuted, the name is back.
    await step("sguest", { op: "mymic", quiet: true });
    s = (await R.studioStep(db, "shost", id, { op: "say", text: "back to our question", ms: 3000 }, new Date(Date.now() + 5000))).studio;
    assert.equal(s.said.find((l) => l.uid === "shost")!.solo, stageNow.length === 2);
    await step("sguest", { op: "mymic", quiet: false });
    // A speaker turns their own off; the editor can do it too, and it is logged; then they can't post.
    s = (await step("sguest", { op: "mysubs", off: true })).studio;
    assert.ok(s.subs.off.includes("sguest") && !s.said.some((l) => l.uid === "sguest"));
    await fails(step("sguest", { op: "say", text: "can you hear me", ms: 3000 }), 403, /Your subtitles are switched off/);
    s = (await step("sed", { op: "subsfor", uid: "sguest", off: false })).studio;
    assert.ok(!s.subs.off.includes("sguest"));
    await fails(step("smod", { op: "subsfor", uid: "sguest", off: true }), 403);
  }
  await fails(step("sed", { op: "subsfor", uid: "sview", off: true }), 400, /isn't on stage/);
  await fails(step("sview", { op: "mysubs", off: true }), 403);
  await fails(step("sview", { op: "mymic", quiet: true }), 403);
  // Switched off, the lines go at once; a line the editor types is still theirs to show.
  s = (await step("sed", { op: "set", patch: { subs: { on: false } } })).studio;
  assert.deepEqual([s.subs.on, s.said.length], [false, 0]);

  s = (await step("shost", { op: "on", on: false })).studio;
  assert.equal(s.on, false); assert.equal(s.layout, "spotlight");
  await fails(step("sed", { op: "set", patch: { layout: "grid" } }), 409);
  await R.closeRoom(db, "shost", id);
  await fails(step("shost", { op: "on", on: true }), 410);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
