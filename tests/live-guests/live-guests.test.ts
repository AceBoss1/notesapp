// Watching a live without an account: the pure rules (lib/live-guests.ts) and the pass (lib/live-guest-pass.ts).
// Run: npm run test:live-guests → "ALL OK".
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { GUEST_PASS_MS, guestChat, guestLimit, guestNo, isGuestId, livePreview, openToGuests } from "../../lib/live-guests";
import { checkGuestPass, issueGuestPass } from "../../lib/live-guest-pass";
import { ROOM_DEFAULTS, ROOM_SETTINGS, cleanRoomOverrides, roomSettings, type RoomDoc } from "../../lib/rooms";

const NOW = Date.parse("2026-11-19T20:00:00Z");
// ── The pass ──
const key = randomBytes(32), other = randomBytes(32);
const { id, pass } = issueGuestPass(key, NOW);
assert.ok(isGuestId(id));
assert.equal(checkGuestPass(key, pass, NOW + 1000), id);
assert.equal(checkGuestPass(key, pass, NOW + GUEST_PASS_MS + 1), null, "runs out");
assert.equal(checkGuestPass(other, pass, NOW), null, "signed by another key");
assert.equal(checkGuestPass(key, pass.replace(/.$/, (c) => (c === "A" ? "B" : "A")), NOW), null, "tampered");
assert.equal(checkGuestPass(key, `${id}.${NOW + GUEST_PASS_MS * 10}.${pass.split(".")[2]}`, NOW), null, "a longer life isn't accepted");
assert.equal(checkGuestPass(key, undefined, NOW), null);
assert.equal(checkGuestPass(key, "x".repeat(200), NOW), null);
assert.ok(!isGuestId("u_ada") && !isGuestId("g_"));

// ── Admin's settings: on by default, 300 a live, 0 lets none in ──
assert.equal(ROOM_DEFAULTS.guestsOn, 1);
assert.equal(ROOM_DEFAULTS.guestsPerLive, 300);
assert.equal(ROOM_SETTINGS.filter((s) => s.group === "guests").length, 2);
assert.equal(roomSettings(cleanRoomOverrides({ guestsPerLive: 50 })).guestsPerLive, 50);
assert.equal(roomSettings(cleanRoomOverrides({ guestsPerLive: 0 })).guestsPerLive, 0);
assert.equal(roomSettings(cleanRoomOverrides({ guestsOn: false })).guestsOn, 0);
assert.equal(roomSettings(cleanRoomOverrides({ guestsPerLive: -5 })).guestsPerLive, 300, "out of range is ignored");

// ── Who may watch as a guest ──
const s = { ...ROOM_DEFAULTS };
const live = (over: Partial<RoomDoc> = {}) => ({ status: "live" as const, mode: "relay" as const, cid: "", listening: 10, paid: undefined, profile: { audience: "everyone" as const, hostUsername: "ada", gifts: true, notified: true }, ...over });
const no = (over: Partial<RoomDoc> = {}, o: { hostTeen?: boolean; guests?: number; joining?: boolean } = {}, set = s) => guestNo(live(over), set, { hostTeen: false, guests: 0, ...o });
assert.equal(no(), null);
assert.equal(no({ status: "ended" }), "ended");
assert.equal(no({ profile: { audience: "followers", hostUsername: "ada", gifts: true, notified: true } }), "followers");
assert.equal(no({ profile: { audience: "subscribers", hostUsername: "ada", gifts: true, notified: true } }), "subscribers");
assert.equal(no({ paid: { eventId: "e1", record: "off" }, profile: undefined }), "paid");
assert.equal(no({ profile: undefined, cid: "c1" }), "community");
assert.equal(no({ profile: { audience: "everyone", hostUsername: "ada", gifts: true, notified: true, guests: false } }), "off", "the host kept it to members");
assert.equal(no({}, {}, { ...s, guestsOn: 0 }), "off", "Admin switched guests off");
assert.equal(no({}, { hostTeen: true }), "teen");
assert.equal(no({ mode: "p2p" }), "phone", "a phone-to-phone live is members only");
assert.equal(no({}, { guests: 300, joining: true }), "full");
assert.equal(no({}, { guests: 300 }), null, "someone already watching isn't put out");
assert.equal(no({}, { guests: 0, joining: true }, { ...s, guestsPerLive: 0 }), "full", "0 lets none in");
// Members always have room: guests stop when members and guests together reach the listener limit.
assert.equal(guestLimit({ listening: 10 }, s), 300);
assert.equal(guestLimit({ listening: 450 }, s), 50);
assert.equal(guestLimit({ listening: 600 }, s), 0);
assert.equal(openToGuests(live(), s), true);
assert.equal(openToGuests(live({ profile: { audience: "followers", hostUsername: "ada", gifts: true, notified: true } }), s), false);
assert.equal(openToGuests(live(), { guestsOn: 0 }), false);

// ── The chat a guest sees: never a teen's line ──
const m = (n: number, teen = false) => ({ id: `m${n}`, m: { from: `u${n}`, name: `N${n}`, avatar: "", text: `hi ${n}`, at: `2026-11-19T20:00:0${n}Z`, ...(teen ? { teen: true } : {}) } });
assert.deepEqual(guestChat([m(1), m(2, true), m(3)]).map((x) => x.id), ["m1", "m3"]);
assert.ok(!("from" in guestChat([m(1)])[0]), "no account ids are shown to guests");
assert.equal(guestChat(Array.from({ length: 60 }, (_, i) => m(i))).length, 40);

// ── The link preview ──
assert.deepEqual(livePreview({ title: "Pricing", hostName: "Ada Obi", status: "live", profile: live().profile }, true), { title: "Ada Obi is live: Pricing", description: "Watch on #NotesApp. No account needed to watch." });
assert.equal(livePreview({ title: "Pricing", hostName: "Ada Obi", status: "live", paid: { eventId: "e", record: "off" } }, false).description, "A paid live on #NotesApp.");
assert.match(livePreview({ title: "Pricing", hostName: "Ada Obi", status: "ended" }, true).description, /ended/);

console.log("ALL OK");
