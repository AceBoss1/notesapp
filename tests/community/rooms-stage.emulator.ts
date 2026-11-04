// The stage in audio rooms (lib/rooms.ts "Stage seats") against the Firestore emulator: the stage modes (Solo, Approve, Open), the empty
// seats, requests, invitations, teen mode and bans, moderators and their permissions (never against the host or a moderator with as
// much say), turning a speaker's microphone off (on the relay: unpublished, cut at Cloudflare, refused until turned back on), the pin,
// and the moderators' log. Run: npm run test:rooms-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import type { RelayClient, Sdp } from "../../lib/rooms-relay-server";
import { MOD_PRESETS, pullsFor, type RoomDoc } from "../../lib/rooms";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const log: { op: string; detail?: unknown }[] = [];
let n = 0;
const fake: RelayClient = {
  async newSession() { return `s-${++n}`; },
  async push(_s, _o, tracks) { log.push({ op: "push" }); return { answer: { type: "answer", sdp: "v=0 a" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
  async pull(_s, tracks) { return { offer: { type: "offer", sdp: "v=0 o" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(10 + i), ...t })) }; },
  async renegotiate() {},
  async close(_s, mids) { log.push({ op: "close", detail: mids }); },
};
const deps: R.RoomDeps = { relay: () => fake };
const offer: Sdp = { type: "offer", sdp: "v=0 o" };
const FULL = MOD_PRESETS[1].perms;

(async () => {
  const ppl = ["host", "basic", "basic2", "full", "ender", "l1", "l2", "l3", "l4", "l5", "teen"];
  for (const u of [...ppl, "outsider"]) await db.doc(`users/${u}`).set({ uid: u, username: u, displayName: u.toUpperCase(), role: "publisher", accountTier: "basic", ...(u === "teen" ? { teen: true } : {}) });
  const c = await C.createCommunity(db, "host", { name: "Stage Chapel" });
  for (const u of ppl.slice(1)) await db.doc(`communityMembers/${c.id}_${u}`).set({ cid: c.id, uid: u, username: u, displayName: u.toUpperCase(), avatar: "", role: u === "full" ? "moderator" : "member", status: "active", joinedAt: new Date().toISOString() });
  delete process.env.CLOUDFLARE_REALTIME_APP_ID; delete process.env.CLOUDFLARE_REALTIME_APP_TOKEN;
  R.resetRoomSettingsCache();

  // ── the form: the community's moderators and admins to pick from; moderators by uid or @username, with their permissions ──
  assert.deepEqual((await R.roomStaff(db, "host", c.id)).map((s) => s.uid), ["full"]);
  assert.deepEqual(await R.roomStaff(db, "l1", c.id), [], "only someone who may host sees it");
  await fails(R.startRoom(db, "host", c.id, "Stage night", new Date(), deps, undefined, { mods: ["@nobody"] }), 400, /@nobody isn't a member/);
  await fails(R.startRoom(db, "host", c.id, "Stage night", new Date(), deps, undefined, { mods: ["outsider"] }), 400, /isn't a member/);
  const { id } = await R.startRoom(db, "host", c.id, "Stage night", new Date(), deps, undefined, {
    stageMode: "solo", mods: ["@basic", { who: "basic2", perms: ["approve", "invite", "down", "mic", "chatRemove", "nonsense"] }, { who: "full", perms: FULL }, { who: "ender", perms: ["end"] }, "host"],
  });
  let r = await roomDoc(id);
  assert.equal(r.stageMode, "solo");
  assert.deepEqual(Object.keys(r.mods!).sort(), ["basic", "basic2", "ender", "full"], "the host isn't their own moderator");
  assert.deepEqual(r.mods!.basic.perms, MOD_PRESETS[0].perms, "a plain name gets the Basic preset");
  assert.deepEqual(r.mods!.basic2.perms, MOD_PRESETS[0].perms, "unknown permissions are dropped");
  for (const u of ppl.slice(1)) await R.joinRoom(db, u, id);

  // ── Solo: nobody asks; the host and moderators can still invite, and the invited person answers ──
  await fails(R.raiseHand(db, "l1", id, true), 409, /keeping the stage/);
  await fails(R.takeSeat(db, "l1", id), 409, /keeping the stage/);
  assert.deepEqual(await R.setSpeaker(db, "basic", id, "l1", true), { speakers: [], invited: true }, "no request: bringing up is an invitation");
  assert.equal((await roomDoc(id)).invites!.l1.byName, "BASIC");
  await R.answerInvite(db, "l1", id, false);
  assert.equal((await roomDoc(id)).invites!.l1, undefined, "declined: it goes");
  await fails(R.answerInvite(db, "l1", id, true), 409, /lapsed/);
  await R.inviteToStage(db, "host", id, "l1");
  await fails(R.answerInvite(db, "l1", id, true, new Date(Date.now() + 3 * 60_000)), 409, /lapsed/, );
  assert.deepEqual((await R.answerInvite(db, "l1", id, true)).speakers, ["l1"]);
  assert.equal((await roomDoc(id)).invites!.l1, undefined, "accepted: on stage, the invitation gone");
  await fails(R.inviteToStage(db, "l2", id, "l3"), 403, /invite/, );

  // ── the mode: only with the "mode" permission (the host, or a moderator given it) ──
  await fails(R.setStageMode(db, "basic", id, "open"), 403, /stage mode/);
  await fails(R.setStageMode(db, "host", id, "party"), 400);
  assert.deepEqual(await R.setStageMode(db, "full", id, "open"), { stageMode: "open" });

  // ── Open: + takes the seat at once; a member in teen mode asks instead ──
  assert.deepEqual((await R.takeSeat(db, "l2", id)).speakers, ["l1", "l2"]);
  assert.deepEqual(await R.takeSeat(db, "teen", id), { speakers: ["l1", "l2"], requested: true });
  r = await roomDoc(id);
  assert.ok(r.hands.teen, "the teen's tap is a request"); assert.equal(r.speakers.includes("teen"), false);
  // inviting a teen: only from someone they follow (lib/young.ts mayReach)
  await fails(R.inviteToStage(db, "basic", id, "teen"), 403, /teen mode/);
  await db.doc("follows/teen_basic").set({ at: new Date().toISOString() });
  assert.equal((await R.inviteToStage(db, "basic", id, "teen")).invited, true, "they follow the inviter: invited");
  // ── Approve: + is a request; a moderator with "approve" lets them up; one without it can't ──
  await R.setStageMode(db, "host", id, "approve");
  assert.deepEqual(await R.takeSeat(db, "l3", id), { speakers: ["l1", "l2"], requested: true });
  await fails(R.setSpeaker(db, "ender", id, "l3", true), 403, /approve/);
  assert.deepEqual((await R.setSpeaker(db, "basic", id, "l3", true)).speakers, ["l1", "l2", "l3"]);
  await R.declineRequest(db, "basic2", id, "teen");
  assert.equal((await roomDoc(id)).hands.teen, undefined, "declined: the hand goes down");
  // the stage holds ROOM_SPEAKERS_MAX besides the host
  await R.setStageMode(db, "host", id, "open");
  await R.takeSeat(db, "l4", id);
  await fails(R.takeSeat(db, "l5", id), 409, /Every seat/);

  // ── turning a microphone off: never the host; a moderator only over those with less say ──
  await fails(R.muteSpeaker(db, "basic", id, "host", true), 403, /host/);
  await fails(R.muteSpeaker(db, "ender", id, "l2", true), 403, /microphone/);
  assert.deepEqual(await R.muteSpeaker(db, "basic", id, "l2", true), { muted: true });
  assert.ok((await roomDoc(id)).micMuted!.l2);
  await R.muteSpeaker(db, "basic", id, "l2", false);
  assert.equal((await roomDoc(id)).micMuted!.l2, undefined);
  // moderators against moderators: equal say (Basic and Basic) → no; Full over Basic → yes; Basic over Full → no
  await R.setSpeaker(db, "host", id, "l4", false);
  await R.raiseHand(db, "basic2", id, true); await R.setSpeaker(db, "host", id, "basic2", true);
  await fails(R.setSpeaker(db, "basic", id, "basic2", false), 403, /as much say/);
  await fails(R.muteSpeaker(db, "basic", id, "basic2", true), 403, /as much say/);
  await R.muteSpeaker(db, "full", id, "basic2", true);
  await fails(R.setSpeaker(db, "basic", id, "host", false), 400, /always on stage/);
  await R.setSpeaker(db, "full", id, "basic2", false);
  assert.equal((await roomDoc(id)).micMuted?.basic2, undefined, "off the stage: the mark goes");
  // a speaker steps down themselves
  await R.setSpeaker(db, "l3", id, "l3", false);
  // only the host names moderators, and changes their permissions
  await fails(R.setRoomMods(db, "full", id, ["l5"]), 403, /Only the host/);

  // ── removing someone from the live: "ban" permission (the community's own moderators keep it), never the host ──
  await fails(R.banFromLive(db, "basic", id, "l5"), 403, /remove people/);
  await fails(R.banFromLive(db, "full", id, "host"), 403, /host/);
  await R.banFromLive(db, "full", id, "l2");
  r = await roomDoc(id);
  assert.equal(r.speakers.includes("l2"), false); assert.equal(r.joined.l2, undefined, "out of the room");
  await fails(R.joinRoom(db, "l2", id), 403, /removed/);
  await fails(R.raiseHand(db, "l2", id, true), 409, /Join/); // and out of the room: nothing to ask from

  // ── chat, pin, poster, end ──
  await db.doc(`communityRooms/${id}/chat/0000000000001_host`).set({ from: "host", name: "HOST", avatar: "", text: "Welcome", at: new Date().toISOString() });
  await db.doc(`communityRooms/${id}/chat/0000000000002_l5`).set({ from: "l5", name: "L5", avatar: "", text: "Hi", at: new Date().toISOString() });
  await fails(R.removeChat(db, "basic", id, "0000000000001_host"), 403, /host/);
  await R.removeChat(db, "basic", id, "0000000000002_l5");
  await fails(R.removeChat(db, "ender", id, "0000000000001_host"), 403, /remove messages/);
  await fails(R.pinMessage(db, "basic", id, "Offering at 8"), 403, /pin/);
  assert.equal((await R.pinMessage(db, "full", id, "  Offering   at 8 ")).pinned!.text, "Offering at 8");
  await fails(R.setPoster(db, "basic", id, "challenge", ""), 403, /poster/);
  await R.setPoster(db, "full", id, "challenge", "");
  await fails(R.closeRoom(db, "basic", id), 403, /end the room/);

  // ── the log: every moderator action, read by the host only ──
  await fails(R.roomModLog(db, "full", id), 403);
  const entries = (await R.roomModLog(db, "host", id)).log;
  const said = entries.map((e) => `${e.by}:${e.action}`);
  for (const want of ["basic:invite on stage", "full:stage mode: open", "basic:approve request", "basic2:decline request", "basic:microphone off", "full:bring down", "full:remove from the live", "basic:remove a chat message", "full:pin a message", "full:change the poster"]) {
    assert.ok(said.includes(want), `logged: ${want}`);
  }
  assert.equal(said.some((x) => x.startsWith("host:")), false, "the host's own actions aren't logged");
  await R.closeRoom(db, "ender", id); // "end" ticked
  assert.equal((await roomDoc(id)).status, "ended");
  assert.equal((await R.roomModLog(db, "host", id)).log[0].action, "end the live");

  // ── rooms from before have no stage mode: they work as Approve ──
  const old = await R.startRoom(db, "host", c.id, "Old style", new Date(), deps);
  await db.doc(`communityRooms/${old.id}`).update({ stageMode: null, mods: null });
  await R.joinRoom(db, "l1", old.id);
  assert.deepEqual(await R.takeSeat(db, "l1", old.id), { speakers: [], requested: true });
  await R.closeRoom(db, "host", old.id);

  // ── the relay: a microphone turned off is unpublished, cut at Cloudflare, and refused until it's turned back on ──
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  const relay = await R.startRoom(db, "host", c.id, "Relay stage", new Date(), deps, undefined, { stageMode: "open", mods: [{ who: "basic", perms: ["mic"] }] });
  for (const u of ["basic", "l1", "l3"]) await R.joinRoom(db, u, relay.id);
  assert.deepEqual((await R.takeSeat(db, "l1", relay.id, new Date(), deps)).speakers, ["l1"]);
  assert.equal((await roomDoc(relay.id)).joined.l1?.name, "L1", "up from people/ onto the room doc");
  await R.relayStep(db, "l1", relay.id, { op: "push", offer, mid: "0", fresh: true }, new Date(), deps);
  assert.ok((await roomDoc(relay.id)).published?.l1);
  log.length = 0;
  await R.muteSpeaker(db, "basic", relay.id, "l1", true, new Date(), deps);
  r = await roomDoc(relay.id);
  assert.equal(r.published?.l1, undefined, "not forwarded: nobody pulls it");
  assert.deepEqual(log, [{ op: "close", detail: ["0"] }], "cut at Cloudflare");
  assert.deepEqual(pullsFor(r, "l3"), []);
  await fails(R.relayStep(db, "l1", relay.id, { op: "push", offer, mid: "1" }, new Date(), deps), 403, /turned your microphone off/);
  await fails(R.relayStep(db, "l3", relay.id, { op: "pull", uids: ["l1"], fresh: true }, new Date(), deps), 409);
  await R.muteSpeaker(db, "basic", relay.id, "l1", false, new Date(), deps);
  await R.relayStep(db, "l1", relay.id, { op: "push", offer, mid: "1" }, new Date(), deps);
  assert.ok((await roomDoc(relay.id)).published?.l1, "turned back on: it goes up again");
  await fails(R.cameraOff(db, "basic", relay.id, "l1"), 403, /camera/);
  await fails(R.setStageVideo(db, "basic", relay.id, true), 403, /video/);
  // the host changes a moderator's permissions during the live
  await R.setRoomMods(db, "host", relay.id, [{ who: "basic", perms: ["mic", "down", "video"] }]);
  assert.deepEqual((await R.setStageVideo(db, "basic", relay.id, true)).stageVideo, true);
  await R.setSpeaker(db, "basic", relay.id, "l1", false, new Date(), deps);
  assert.equal((await db.doc(`communityRooms/${relay.id}/people/l1`).get()).exists, true, "back with the listeners");
  // a beat: moderators get the hands too (only on the live-rooms worker; here nothing extra)
  assert.deepEqual(await R.beatRoom(db, "basic", relay.id, new Date(), deps), { live: true });
  await R.closeRoom(db, "host", relay.id);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
