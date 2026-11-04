// The staff test pass (lib/staff-pass.ts): when it counts as on, who it covers, what a super admin may send, and what it changes.
// Run: npm run test:limits → "ALL OK".
import assert from "node:assert/strict";
import {
  STAFF_PASS_DEFAULT_DAYS, STAFF_PASS_MAX_DAYS, STAFF_PASS_RECORDING_HOURS, STAFF_PASS_VIDEO_MINUTES, cleanPassInput, defaultUntil, describePass,
  liveSettingsWithPass, passActive, passApplies, passNotice, recordingHoursWithPass, roomPassActive, staffListenerCap,
} from "../../lib/staff-pass";
import { ROOM_DEFAULTS, ROOM_LISTENERS_CEILING, ROOM_SETTINGS } from "../../lib/rooms";
import { RECORDING_SETTINGS } from "../../lib/live-recording";
import { budgetUsed, emptyLive, liveVideoOn } from "../../lib/rooms-live";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const DAY = 86_400_000;
const later = new Date(NOW + DAY).toISOString();

// ── on only with an end still ahead ──
assert.equal(passActive({ on: true, until: later }, NOW), true);
assert.equal(passActive({ on: true, until: later }, NOW + 2 * DAY), false, "past its end it is off by itself");
assert.equal(passActive({ on: false, until: later }, NOW), false);
assert.equal(passActive({ on: true, until: null }, NOW), false, "never on without an end");
assert.equal(passActive(null, NOW), false);
// team accounts only
assert.equal(passApplies({ on: true, until: later }, true, NOW), true);
assert.equal(passApplies({ on: true, until: later }, false, NOW), false);
// a room opened under it keeps it only while the pass is on
assert.equal(roomPassActive({ staffPass: true }, { on: true, until: later }, NOW), true);
assert.equal(roomPassActive({ staffPass: true }, { on: false, until: null }, NOW), false);
assert.equal(roomPassActive({}, { on: true, until: later }, NOW), false);

// ── what a super admin may send ──
assert.deepEqual(cleanPassInput({ on: false, until: later }, NOW), { ok: true, pass: { on: false, until: null } });
assert.deepEqual(cleanPassInput(null, NOW), { ok: true, pass: { on: false, until: null } });
const def = cleanPassInput({ on: true }, NOW);
assert.ok(def.ok && def.pass.until === defaultUntil(NOW) && Date.parse(def.pass.until) === NOW + STAFF_PASS_DEFAULT_DAYS * DAY, "default: 7 days");
assert.equal(STAFF_PASS_DEFAULT_DAYS, 7);
assert.deepEqual(cleanPassInput({ on: true, until: later }, NOW), { ok: true, pass: { on: true, until: later } });
assert.equal(cleanPassInput({ on: true, until: "soon" }, NOW).ok, false);
assert.equal(cleanPassInput({ on: true, until: new Date(NOW - 1000).toISOString() }, NOW).ok, false, "never in the past");
assert.equal(cleanPassInput({ on: true, until: new Date(NOW + (STAFF_PASS_MAX_DAYS + 1) * DAY).toISOString() }, NOW).ok, false, "at most 30 days");
assert.equal(cleanPassInput({ on: "yes" }, NOW).ok && (cleanPassInput({ on: "yes" }, NOW) as { pass: { on: boolean } }).pass.on, false, "only a real true turns it on");

// ── what it changes: the listener cap up to the hard ceiling, the video budget, the longest recording ──
assert.equal(staffListenerCap("relay"), ROOM_LISTENERS_CEILING);
assert.equal(staffListenerCap("p2p"), ROOM_SETTINGS.find((s) => s.key === "p2pListeners")!.max, "phone to phone: the top of the setting's range");
assert.ok(staffListenerCap("p2p") >= ROOM_DEFAULTS.p2pListeners);
const s = liveSettingsWithPass(ROOM_DEFAULTS, true);
assert.equal(s.videoBudgetMinutes, STAFF_PASS_VIDEO_MINUTES);
assert.equal(s.videoKbps, ROOM_DEFAULTS.videoKbps, "the video quality caps are unchanged");
assert.equal(liveSettingsWithPass(ROOM_DEFAULTS, false), ROOM_DEFAULTS, "off: the same settings object");
const st = liveVideoOn(emptyLive(), "host", new Date(NOW).toISOString());
const threeHours = NOW + 3 * 3600_000;
assert.equal(budgetUsed(st, ROOM_DEFAULTS, threeHours), true);
assert.equal(budgetUsed(st, s, threeHours), false, "on the pass the budget doesn't run out");
assert.equal(STAFF_PASS_RECORDING_HOURS, RECORDING_SETTINGS.find((x) => x.key === "maxHours")!.max);
assert.equal(recordingHoursWithPass(4, true), STAFF_PASS_RECORDING_HOURS);
assert.equal(recordingHoursWithPass(4, false), 4);

// ── what staff see ──
assert.match(passNotice({ on: true, until: "2026-11-10T17:00:00Z" }, NOW), /^Staff test pass is on until 10 Nov 2026, 18:00 \(Lagos\)$/);
assert.equal(passNotice({ on: true, until: later }, NOW + 2 * DAY), "");
assert.equal(describePass({ on: false, until: null }), "off");
assert.match(describePass({ on: true, until: later }), /^on until /);

console.log("ALL OK");
