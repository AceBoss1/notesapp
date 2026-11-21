// Watching a live without an account, on the server (lib/live-guests-server.ts) against the Firestore emulator, with a stand-in
// Cloudflare relay: what a guest sees, joining and the guest limit, receive-only relay steps, the count on the live, a guest who joins
// #NotesApp from it, Admin's switch and limit, the host keeping a live to members, and the teen rules.
// Run: npm run test:live-guests-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as C from "../../lib/community-server";
import * as R from "../../lib/rooms-server";
import * as G from "../../lib/live-guests-server";
import type { RoomDoc } from "../../lib/rooms";
import type { RelayClient } from "../../lib/rooms-relay-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof C.CommunityError && e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`); };
const user = (uid: string, extra: Record<string, unknown> = {}) => db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid.toUpperCase(), role: "publisher", accountTier: "basic", createdAt: "2026-01-01T00:00:00.000Z", ...extra });
const log: { op: string; sessionId?: string; detail?: unknown }[] = [];
let sessions = 0;
const fake: RelayClient = {
  async newSession() { log.push({ op: "new" }); return `sess-${++sessions}`; },
  async push(sessionId, _o, tracks) { log.push({ op: "push", sessionId }); return { answer: { type: "answer", sdp: "v=0 a" }, tracks: tracks.map((t) => ({ location: "local" as const, ...t })) }; },
  async pull(sessionId, tracks) { log.push({ op: "pull", sessionId, detail: tracks }); return { offer: { type: "offer", sdp: "v=0 o" }, renegotiate: true, tracks: tracks.map((t, i) => ({ location: "remote" as const, mid: String(10 + i), trackName: t.trackName, sessionId: t.sessionId })) }; },
  async renegotiate(sessionId) { log.push({ op: "renegotiate", sessionId }); },
  async close(sessionId, mids) { log.push({ op: "close", sessionId, detail: mids }); },
};
const deps: R.RoomDeps = { relay: () => fake };
const roomDoc = async (id: string) => (await db.doc(`communityRooms/${id}`).get()).data() as RoomDoc;
const profile = (over: Partial<NonNullable<RoomDoc["profile"]>> = {}) => ({ audience: "everyone" as const, hostUsername: "host", gifts: true, notified: false, guests: true, ...over });

(async () => {
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "token";
  R.resetRoomSettingsCache();
  await R.saveRoomSettings(db, { guestsPerLive: 2 }, "admin");
  await Promise.all([user("host"), user("ada"), user("teenie", { teen: true }), user("teenhost", { teen: true }), user("newbie", { createdAt: new Date().toISOString() })]);
  const T = Date.now(), t = (secs: number) => new Date(T + secs * 1000);
  const { id, mode } = await R.startProfileRoom(db, "host", { title: "Pricing your work", poster: "", profile: profile(), record: false }, t(0), deps);
  assert.equal(mode, "relay");
  await R.joinRoom(db, "ada", id, t(1));
  await R.relayStep(db, "host", id, { op: "push", offer: { type: "offer", sdp: "v=0" }, mid: "0", fresh: true }, t(2), deps);
  await R.sendRoomChat(db, "ada", id, "Great tip", t(3));

  // ── What a guest sees ──
  G.resetGuestViews();
  const v = await G.guestView(db, id, t(4));
  assert.equal(v.no, null);
  assert.equal(v.title, "Pricing your work");
  assert.equal(v.host.name, "HOST");
  assert.equal(v.stage.length, 1);
  assert.equal(v.stage[0].uid, "host");
  assert.match(v.stage[0].sound!, /^host@/);
  assert.deepEqual(v.chat.filter((c) => !c.ev).map((c) => [c.name, c.text]), [["ADA", "Great tip"]]);
  assert.ok(!JSON.stringify(v.chat).includes("\"from\""), "no account ids");
  await fails(G.guestView(db, "nope", t(4)), 404);

  // ── Joining, the limit (Admin set 2), and someone already in isn't put out ──
  await G.guestJoin(db, id, "g_aaaaaaaaa1", t(5));
  await G.guestJoin(db, id, "g_bbbbbbbbb2", t(5));
  await fails(G.guestJoin(db, id, "g_ccccccccc3", t(6)), 403, /full/);
  await G.guestJoin(db, id, "g_aaaaaaaaa1", t(6));
  assert.equal((await roomDoc(id)).guests, 2, "the live's count of guests");
  await fails(G.guestJoin(db, id, "u_ada", t(6)), 401);

  // ── Receive only ──
  log.length = 0;
  const pulled = await G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "pull", uids: ["host"], fresh: true }, deps, t(7));
  assert.equal(pulled.offer?.type, "offer");
  assert.deepEqual(pulled.tracks, [{ uid: "host", mid: "10" }]);
  assert.deepEqual(log.map((x) => x.op), ["new", "pull"]);
  const guestSession = log.find((x) => x.op === "pull")!.sessionId;
  await G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "answer", answer: { type: "answer", sdp: "v=0 me" } }, deps, t(7));
  await fails(G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "push", offer: { type: "offer", sdp: "x" }, mid: "0" }, deps, t(8)), 400, /only watch/);
  await fails(G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "pull", uids: ["ada"] }, deps, t(8)), 409, /Nobody on stage/);
  await fails(G.guestRelay(db, id, "g_zzzzzzzzz9", { op: "pull", uids: ["host"] }, deps, t(8)), 409, /Open the live again/);
  await G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "close", mids: ["10"] }, deps, t(9));
  assert.deepEqual(log.at(-1), { op: "close", sessionId: guestSession, detail: ["10"] }, "on the guest's own session");

  // ── Still here, then gone ──
  assert.deepEqual(await G.guestBeat(db, id, "g_aaaaaaaaa1", t(25)), { live: true });
  await fails(G.guestBeat(db, id, "g_ccccccccc3", t(25)), 409);
  await G.guestLeave(db, id, "g_bbbbbbbbb2", deps);
  await G.guestJoin(db, id, "g_ccccccccc3", t(26)); // a seat is free again
  // A guest gone quiet for over a minute stops counting, so a new one fits.
  await G.guestJoin(db, id, "g_ddddddddd4", t(26 + 70)).catch(() => assert.fail("a quiet guest should no longer count"));

  // ── A guest who joins #NotesApp, or signs in, from the live: counted once ──
  assert.deepEqual(await G.guestConverted(db, id, "g_aaaaaaaaa1", "newbie", t(30)), { counted: true, joined: true });
  assert.deepEqual(await G.guestConverted(db, id, "g_aaaaaaaaa1", "newbie", t(31)), { counted: false, joined: true });
  assert.deepEqual(await G.guestConverted(db, id, "g_ccccccccc3", "ada", t(32)), { counted: true, joined: false });
  let r = await roomDoc(id);
  assert.deepEqual([r.guestJoins, r.guestSignIns], [1, 1]);
  const stats = await G.guestStats(db, t(40));
  assert.ok(stats.views >= 4 && stats.joined === 1 && stats.signedIn === 1, JSON.stringify(stats));

  // ── Teens: their lines are hidden from guests; they can't come on stage in a live guests can watch ──
  await R.joinRoom(db, "teenie", id, t(41));
  await R.sendRoomChat(db, "teenie", id, "hello from a teen", t(42));
  G.resetGuestViews();
  assert.ok(!(await G.guestView(db, id, t(43))).chat.some((c) => c.text === "hello from a teen"));
  await fails(R.inviteToStage(db, "host", id, "teenie", t(44)), 403, /teen mode, and people without an account/);
  // A teen host's live is never open to guests.
  const teenLive = await R.startProfileRoom(db, "teenhost", { title: "Study with me", poster: "", profile: profile({ hostUsername: "teenhost" }), record: false }, t(50), deps);
  G.resetGuestViews();
  assert.equal((await G.guestView(db, teenLive.id, t(51))).no, "teen");
  await fails(G.guestJoin(db, teenLive.id, "g_eeeeeeeee5", t(51)), 403, /teen/);

  // ── The host keeps a live to members; Admin switches guests off ──
  const members = await R.startProfileRoom(db, "ada", { title: "Members only", poster: "", profile: profile({ hostUsername: "ada", guests: false }), record: false }, t(60), deps);
  G.resetGuestViews();
  assert.equal((await G.guestView(db, members.id, t(61))).no, "off");
  assert.deepEqual((await G.guestView(db, members.id, t(61))).stage, [], "nothing of the live itself");
  await R.saveRoomSettings(db, { guestsOn: false }, "admin");
  G.resetGuestViews();
  assert.equal((await G.guestView(db, id, t(62))).no, "off");
  await fails(G.guestRelay(db, id, "g_aaaaaaaaa1", { op: "pull", uids: ["host"] }, deps, t(62)), 403, /off/);
  await R.saveRoomSettings(db, {}, "admin");

  // ── Ended ──
  await R.endRoom(db, id, t(70));
  G.resetGuestViews();
  assert.equal((await G.guestView(db, id, t(71))).no, "ended");
  assert.deepEqual(await G.guestBeat(db, id, "g_aaaaaaaaa1", t(71)), { live: false });

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
