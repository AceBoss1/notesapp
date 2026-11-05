// Audio rooms on the Cloudflare relay (lib/rooms.ts, lib/rooms-relay-server.ts): which mode a new room takes, who may send and receive,
// the listener cap, the settings, the help's live figures, and the Cloudflare client against a stand-in fetch (no network).
// Run: npm run test:rooms → "ALL OK".
import assert from "node:assert/strict";
import {
  DEFAULT_ROOM_FIGURES, ROOM_DEFAULTS, ROOM_LISTENERS_MAX_P2P, ROOM_LISTENERS_MAX_RELAY, ROOM_SETTINGS, canPull, canPush, chooseRoomMode, cleanRoomOverrides,
  listenerCap, pullsFor, roomFigures, roomFullText, roomIsFull, roomSettings, type RoomDoc,
  ROOM_COUNT_EVERY_MS, chatSlowFor, chatWait, countDue, headcount, isFresh, listenerCount,
} from "../../lib/rooms";
import { RelayError, relayCheck, relayClient, relayConfigured, relayWhy } from "../../lib/rooms-relay-server";
import { builtInArticles } from "../../lib/kb-articles";
import { communityFeature } from "../../lib/community-features";

const now = Date.parse("2026-11-02T10:00:00Z");
const p = (ago = 0) => ({ name: "x", avatar: "", at: "2026-11-02T09:00:00Z", seen: new Date(now - ago).toISOString() });
const base = (extra: Partial<RoomDoc> = {}): RoomDoc => ({
  cid: "c", communityName: "C", title: "T", hostUid: "h", hostName: "H", speakers: ["s1", "s2"], hands: {},
  joined: { h: p(), s1: p(), s2: p(), l1: p(), gone: p(120_000) }, status: "live", mode: "relay", createdAt: "2026-11-02T09:00:00Z",
  published: { h: "2026-11-02T09:00:05Z", s1: "2026-11-02T09:01:00Z" }, ...extra,
});

// ── settings: defaults, ranges, what an admin may save ──
assert.deepEqual(ROOM_DEFAULTS, {
  relayOn: 1, relayListeners: ROOM_LISTENERS_MAX_RELAY, p2pListeners: ROOM_LISTENERS_MAX_P2P, chatSlowAbove: 200, chatSlowSeconds: 10,
  // Live mode (tests/community/rooms-live.test.ts)
  videoOn: 1, videoBudgetMinutes: 15, videoGraceSeconds: 30, videoNearlyLeftMinutes: 2, videoBurstMinutes: 3, videoTryMinutes: 2, dropPercent: 10, dropWindowMinutes: 2, videoKbps: 600, videoFps: 24, videoHeight: 480,
  // Paid lives (tests/live-tickets/live-tickets.test.ts)
  lateWindowMin: 20, liveDiscountMaxPct: 50, paidNoShowMin: 60,
  ppmMinMinutes: 10, ppmMaxMinutes: 240, ppmGraceSec: 60, ppmTopUpWaitSec: 60, ppmNoShowMin: 60,
});
assert.equal(ROOM_LISTENERS_MAX_P2P, 20); assert.equal(ROOM_LISTENERS_MAX_RELAY, 500);
for (const s of ROOM_SETTINGS) assert.ok(s.def >= s.min && s.def <= s.max, `${s.key} default in range`);
assert.deepEqual(cleanRoomOverrides(ROOM_DEFAULTS), {}, "the defaults save as no overrides");
assert.deepEqual(cleanRoomOverrides({ relayOn: false, relayListeners: 300, p2pListeners: 99, junk: 1 }), { relayOn: 0, relayListeners: 300 }, "the switch takes false; 99 is past the phone-to-phone range");
assert.deepEqual(cleanRoomOverrides({ relayOn: 7, relayListeners: 2.5, p2pListeners: "" }), {}, "a switch is 0 or 1; whole numbers only");
assert.deepEqual(roomSettings({ relayListeners: 300 }), { ...ROOM_DEFAULTS, relayListeners: 300 });
assert.deepEqual(roomSettings({ relayListeners: 999_999 } as never), ROOM_DEFAULTS, "out of range: the default");

// ── which mode a new room takes: the relay only with both keys and the switch on ──
assert.equal(chooseRoomMode(ROOM_DEFAULTS, false), "p2p", "no keys: phone to phone, whatever the switch says");
assert.equal(chooseRoomMode(ROOM_DEFAULTS, true), "relay", "keys set, switch on by default: the relay");
assert.equal(chooseRoomMode(roomSettings({ relayOn: 0 }), true), "p2p", "switched off by an admin");

// ── the listener cap comes from the room's own mode and the settings ──
assert.equal(listenerCap("p2p", ROOM_DEFAULTS), 20); assert.equal(listenerCap("relay", ROOM_DEFAULTS), 500);
assert.equal(listenerCap(undefined, ROOM_DEFAULTS), 20, "rooms from before the relay have no mode: phone to phone");
assert.equal(listenerCap("relay", roomSettings({ relayListeners: 120 })), 120);
const crowd = (n: number) => base({ speakers: [], joined: { h: p(), ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, p()])) } });
assert.equal(roomIsFull(crowd(499), 500, now), false); assert.equal(roomIsFull(crowd(500), 500, now), true);
assert.equal(roomIsFull(crowd(25), listenerCap("relay", ROOM_DEFAULTS), now), false, "a relay room is not full at 25");
assert.equal(roomIsFull(crowd(20), listenerCap("p2p", ROOM_DEFAULTS), now), true);
assert.equal(roomFullText(1500), "The room is full: 1,500 people can listen at a time.");

// ── who may send (push) and receive (pull) ──
const r = base();
assert.equal(canPush(r, "h", now), true, "the host sends"); assert.equal(canPush(r, "s1", now), true, "a speaker sends");
assert.equal(canPush(r, "l1", now), false, "a listener never sends");
assert.equal(canPush(r, "stranger", now), false); assert.equal(canPush(r, "gone", now), false, "not heard from: out");
assert.equal(canPush(base({ mode: "p2p" }), "h", now), false, "phone-to-phone rooms never use the relay");
assert.equal(canPush(base({ status: "ended" }), "h", now), false);
assert.equal(canPull(r, "l1", "h", now), true, "a listener receives the host"); assert.equal(canPull(r, "l1", "s1", now), true);
assert.equal(canPull(r, "l1", "s2", now), false, "s2 is on stage but not sending yet");
assert.equal(canPull(r, "s1", "h", now), true, "the stage receives each other");
assert.equal(canPull(r, "h", "h", now), false, "never your own microphone");
assert.equal(canPull(r, "l1", "l1", now), false); assert.equal(canPull(base({ published: { l1: "t" } }), "h", "l1", now), false, "a listener's track is never pulled, even if marked");
assert.equal(canPull(r, "stranger", "h", now), false, "only people in the room");
assert.equal(canPull(base({ speakers: ["s2"] }), "l1", "s1", now), false, "moved off stage: no longer pulled");
// what each person pulls: the other stage members who are sending, keyed by when they went up
assert.deepEqual(pullsFor(r, "l1", now), [{ uid: "h", key: "h@2026-11-02T09:00:05Z" }, { uid: "s1", key: "s1@2026-11-02T09:01:00Z" }]);
assert.deepEqual(pullsFor(r, "h", now).map((x) => x.uid), ["s1"]);
assert.deepEqual(pullsFor(base({ published: undefined }), "l1", now), []);

// ── presence at scale: the aggregated count, and slow mode for big rooms' chat ──
assert.equal(ROOM_COUNT_EVERY_MS, 15_000);
assert.equal(countDue({}, now), true, "never counted: due");
assert.equal(countDue({ countedAt: new Date(now - 14_999).toISOString() }, now), false, "counted within the window: not due");
assert.equal(countDue({ countedAt: new Date(now - 15_000).toISOString() }, now), true);
// A room of 500 listeners each beating every 20 s, with the count refreshed at most every 15 s: the room doc gets the stage's 5 beats
// and at most 2 count writes per window, far under a document's ~1 write a second.
const stageBeatsPerSec = 5 / 20, countWritesPerSec = 2 / 15;
assert.ok(stageBeatsPerSec + countWritesPerSec < 0.5, "the room doc stays well under one write a second");
assert.equal(isFresh({ seen: new Date(now - 59_000).toISOString() }, now), true); assert.equal(isFresh({ seen: new Date(now - 61_000).toISOString() }, now), false);
assert.equal(isFresh(undefined, now), false);
const big = base({ speakers: ["s1"], joined: { h: p(), s1: p() }, listening: 437 });
assert.equal(headcount(big, now), 439, "the stage here plus the count"); assert.equal(listenerCount(big, now), 437);
assert.equal(headcount(base({ mode: "p2p" }), now), 4, "phone to phone: everyone in joined who is here"); assert.equal(listenerCount(base({ mode: "p2p" }), now), 1);
assert.equal(chatSlowFor(200, ROOM_DEFAULTS), 0, "at the line: off"); assert.equal(chatSlowFor(201, ROOM_DEFAULTS), 10);
assert.equal(chatSlowFor(60, roomSettings({ chatSlowAbove: 50, chatSlowSeconds: 30 })), 30);
assert.equal(chatWait(undefined, 10, now), 0, "first message: no wait"); assert.equal(chatWait(new Date(now - 3_000).toISOString(), 0, now), 0, "slow mode off");
assert.equal(chatWait(new Date(now - 3_000).toISOString(), 10, now), 7); assert.equal(chatWait(new Date(now - 10_000).toISOString(), 10, now), 0);
assert.equal(canPull(big, "l9", "h", now), false, "a relay listener isn't in joined…");
assert.equal(canPull({ ...big, published: { h: "t" } }, "l9", "h", now, true), true, "…so the server passes what it read from people/");

// ── what the pages and help say: from the settings, never fixed numbers ──
assert.deepEqual({ ...DEFAULT_ROOM_FIGURES, live: undefined }, { relay: false, listeners: 20, p2pListeners: 20, relayListeners: 500, speakers: 4, chatSlowAbove: 200, chatSlowSeconds: 10, live: undefined });
const relayFig = roomFigures(roomSettings({ relayListeners: 750, p2pListeners: 15 }), true);
assert.equal(relayFig.relay, true); assert.equal(relayFig.listeners, 750);
const room = (f = DEFAULT_ROOM_FIGURES) => builtInArticles({ rooms: f }).find((a) => a.slug === "community-audio-rooms")!.body;
assert.match(room(), /Up to \*\*20 listeners\*\*/); assert.match(room(), /phone to phone/);
assert.match(room(relayFig), /Up to \*\*750 listeners\*\*/); assert.match(room(relayFig), /Cloudflare/);
assert.match(room(relayFig), /passes 200 listeners its chat goes into slow mode: each listener can send one message every 10 seconds/, "slow mode from the settings");
assert.match(room(relayFig), /phone to phone \(up to 15 listeners\)/, "rooms already open: the phone-to-phone setting");
assert.doesNotMatch(room(relayFig), /\b20\b/, "no fixed 20 anywhere");
const p2pFig = roomFigures(roomSettings({ p2pListeners: 12 }), false);
assert.match(room(p2pFig), /Up to \*\*12 listeners\*\*/);
for (const a of builtInArticles({ rooms: relayFig })) if (/audio room/i.test(a.body)) assert.doesNotMatch(a.body, /(up to|and) 20 listening|holds 20 listeners/i, `${a.slug} reads the setting`);
const page = communityFeature("audio-rooms", relayFig)!;
assert.ok(page.facts.some((f) => f.value.includes("750")), "the public page reads the figures");
assert.ok(!JSON.stringify(page).includes(" 20 "), "and nothing fixed at 20");
assert.ok(JSON.stringify(communityFeature("events", relayFig)).includes("750 listening"));

// ── the Cloudflare client, against a stand-in fetch ──
type Call = { url: string; method: string; auth: string; body: unknown };
const calls: Call[] = [];
const fake = (answer: (c: Call) => { status: number; json: unknown }): typeof fetch => (async (url: string, init: RequestInit) => {
  const c: Call = { url, method: String(init.method), auth: String((init.headers as Record<string, string>).Authorization), body: init.body ? JSON.parse(String(init.body)) : undefined };
  calls.push(c);
  const a = answer(c);
  return new Response(JSON.stringify(a.json), { status: a.status, headers: { "Content-Type": "application/json" } });
}) as unknown as typeof fetch;

(async () => {
  delete process.env.CLOUDFLARE_REALTIME_APP_ID; delete process.env.CLOUDFLARE_REALTIME_APP_TOKEN;
  assert.equal(relayConfigured(), false);
  assert.deepEqual(await relayCheck(fake(() => ({ status: 200, json: {} }))), { ok: false, why: "not set up" });
  assert.equal(calls.length, 0, "no keys: Cloudflare is never called");
  await assert.rejects(relayClient(fake(() => ({ status: 200, json: {} }))).newSession(), (e: unknown) => e instanceof RelayError && /isn't set up/.test(e.why));
  process.env.CLOUDFLARE_REALTIME_APP_ID = "app123"; process.env.CLOUDFLARE_REALTIME_APP_TOKEN = "secret-token";
  assert.equal(relayConfigured(), true);

  const offer = { type: "offer" as const, sdp: "v=0 offer" }, answer = { type: "answer" as const, sdp: "v=0 answer" };
  const cf = relayClient(fake((c) => {
    if (c.url.endsWith("/sessions/new")) return { status: 201, json: { sessionId: "sess-1" } };
    if (c.url.endsWith("/tracks/new") && (c.body as { sessionDescription?: unknown }).sessionDescription) return { status: 200, json: { sessionDescription: answer, tracks: [{ mid: "0", trackName: "h-mic" }], requiresImmediateRenegotiation: false } };
    if (c.url.endsWith("/tracks/new")) return { status: 200, json: { sessionDescription: { type: "offer", sdp: "v=0 sfu" }, requiresImmediateRenegotiation: true, tracks: [{ mid: "1", trackName: "h-mic", sessionId: "sess-1" }, { trackName: "gone-mic", errorCode: "not_found", errorDescription: "track not found" }] } };
    return { status: 200, json: {} };
  }));
  calls.length = 0;
  assert.equal(await cf.newSession(), "sess-1");
  assert.deepEqual(calls[0], { url: "https://rtc.live.cloudflare.com/v1/apps/app123/sessions/new", method: "POST", auth: "Bearer secret-token", body: undefined });
  assert.deepEqual(await cf.push("sess-1", offer, [{ mid: "0", trackName: "h-mic" }]), { answer, tracks: [{ mid: "0", trackName: "h-mic" }] });
  assert.deepEqual(calls[1].body, { sessionDescription: offer, tracks: [{ location: "local", mid: "0", trackName: "h-mic" }] });
  const pulled = await cf.pull("sess-2", [{ sessionId: "sess-1", trackName: "h-mic" }]);
  assert.equal(calls[2].url, "https://rtc.live.cloudflare.com/v1/apps/app123/sessions/sess-2/tracks/new");
  assert.deepEqual(calls[2].body, { tracks: [{ location: "remote", sessionId: "sess-1", trackName: "h-mic" }] });
  assert.equal(pulled.renegotiate, true); assert.deepEqual(pulled.offer, { type: "offer", sdp: "v=0 sfu" }); assert.equal(pulled.tracks.length, 2);
  await cf.renegotiate("sess-2", answer);
  assert.deepEqual([calls[3].method, calls[3].url.split("/apps/app123/")[1], calls[3].body], ["PUT", "sessions/sess-2/renegotiate", { sessionDescription: answer }]);
  await cf.close("sess-2", ["1"]);
  assert.deepEqual([calls[4].method, calls[4].url.split("/apps/app123/")[1], calls[4].body], ["PUT", "sessions/sess-2/tracks/close", { tracks: [{ mid: "1" }], force: true }]);
  await cf.close("sess-2", []); assert.equal(calls.length, 5, "closing nothing calls nothing");

  // friendly errors, like the TURN ones; never the token
  const why = async (status: number, json: unknown = {}) => {
    try { await relayClient(fake(() => ({ status, json }))).newSession(); return ""; } catch (e) { return e instanceof RelayError ? e.why : "?"; }
  };
  assert.match(await why(401), /refused the token: CLOUDFLARE_REALTIME_APP_TOKEN/);
  assert.match(await why(404), /can't find that app: CLOUDFLARE_REALTIME_APP_ID/);
  assert.match(await why(503), /having trouble/);
  assert.match(await why(400, { errorCode: "invalid_request", errorDescription: "bad thing" }), /Cloudflare said: bad thing/);
  assert.match(await why(201, { errorCode: "x" }), /Cloudflare said: x/, "an errorCode in a 2xx is still an error");
  for (const w of [await why(401), await why(404)]) assert.ok(!w.includes("secret-token"));
  assert.match(relayWhy(404, null, "sessions/abc/tracks/new"), /no longer has that session/);
  const down = relayClient((async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch);
  await assert.rejects(down.newSession(), (e: unknown) => e instanceof RelayError && e.why === "could not reach Cloudflare in time");
  // a push whose track Cloudflare refused is an error, not a silent mic
  await assert.rejects(relayClient(fake(() => ({ status: 200, json: { sessionDescription: answer, tracks: [{ mid: "0", trackName: "x", errorCode: "bad_mid", errorDescription: "no such mid" }] } }))).push("s", offer, [{ mid: "0", trackName: "x" }]),
    (e: unknown) => e instanceof RelayError && /no such mid/.test(e.why));
  assert.deepEqual(await relayCheck(fake(() => ({ status: 201, json: { sessionId: "probe" } }))), { ok: true });
  assert.deepEqual(await relayCheck(fake(() => ({ status: 403, json: {} }))), { ok: false, why: await why(403) });
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
