// Live mode in audio rooms (lib/rooms-live.ts): the settings, who may send and receive video, the video-minutes budget, the drop and
// back-to-audio prompts, Audio only's default, and the figures in the help and on the Audio rooms page. Pure; no network, no database.
// Run: npm run test:rooms → "ALL OK".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_ROOM_FIGURES, ROOM_DEFAULTS, ROOM_LISTENERS_CEILING, ROOM_SETTINGS, cleanRoomOverrides, roomFigures, roomSettings, type RoomDoc } from "../../lib/rooms";
import {
  AUDIO_ONLY_KEY, CHALLENGE_POSTER, addSample, anyVideo, audioOnlyDefault, budgetUsed, canPullVideo, canVideo, chooseAudioOnly, dropping, emptyLive,
  liveUsedMs, liveVideoOff, liveVideoOn, minutesLeft, minutesLeftText, promptDue, promptFresh, promptText, videoConstraints, videoEncoding, videoPullsFor,
} from "../../lib/rooms-live";
import { builtInArticles } from "../../lib/kb-articles";
import { communityFeature } from "../../lib/community-features";
import { webpPlan } from "../../lib/upload-rules";

const T0 = Date.parse("2026-11-02T10:00:00Z");
const at = (secs: number) => new Date(T0 + secs * 1000).toISOString();
const S = ROOM_DEFAULTS;

// ── settings: the defaults the owner chose, all in Admin → Limits under "Live" ──
const live = ROOM_SETTINGS.filter((s) => s.group === "live");
assert.deepEqual(live.map((s) => [s.key, s.def]), [
  ["videoOn", 1], ["videoBudgetMinutes", 15], ["videoGraceSeconds", 30], ["videoNearlyLeftMinutes", 2], ["videoBurstMinutes", 3], ["videoTryMinutes", 2],
  ["dropPercent", 10], ["dropWindowMinutes", 2], ["videoKbps", 600], ["videoFps", 24], ["videoHeight", 480],
]);
for (const s of live) assert.ok(s.def >= s.min && s.def <= s.max, `${s.key} default in range`);
assert.deepEqual(cleanRoomOverrides({ videoBudgetMinutes: 20, dropPercent: 0, videoOn: false, videoFps: 60 }), { videoBudgetMinutes: 20, videoOn: 0 }, "0% and 60 fps are out of range");
assert.equal(roomSettings({ videoBudgetMinutes: 20 }).videoBudgetMinutes, 20);
// Room size: the default stays 500; the owner can raise it to 10,000.
assert.equal(S.relayListeners, 500);
assert.equal(ROOM_LISTENERS_CEILING, 10_000);
assert.deepEqual(cleanRoomOverrides({ relayListeners: 10_000 }), { relayListeners: 10_000 });
assert.deepEqual(cleanRoomOverrides({ relayListeners: 10_001 }), {});
assert.deepEqual(DEFAULT_ROOM_FIGURES.live, { video: true, budgetMinutes: 15, graceSeconds: 30, nearlyLeftMinutes: 2, burstMinutes: 3, tryMinutes: 2, dropPercent: 10, dropWindowMinutes: 2, height: 480, fps: 24, kbps: 600 });

// ── who may turn video on, and receive it ──
const p = { name: "x", avatar: "", at: at(0), seen: at(0) };
const room = (extra: Partial<RoomDoc> = {}): RoomDoc => ({
  cid: "c", communityName: "C", title: "T", hostUid: "h", hostName: "H", speakers: ["s1"], hands: {}, joined: { h: p, s1: p }, status: "live", mode: "relay", createdAt: at(0), ...extra,
});
const now = T0 + 5_000;
assert.equal(canVideo(room(), "h", S, now), true, "the host");
assert.equal(canVideo(room(), "s1", S, now), false, "a speaker, until the host allows");
assert.equal(canVideo(room({ stageVideo: true }), "s1", S, now), true);
assert.equal(canVideo(room({ stageVideo: true }), "l1", S, now), false, "a listener never");
assert.equal(canVideo(room(), "h", roomSettings({ videoOn: 0 }), now), false, "Live mode switched off");
assert.equal(canVideo(room({ mode: "p2p" }), "h", S, now), false, "phone-to-phone rooms: sound only");
assert.equal(canVideo(room({ status: "ended" }), "h", S, now), false);
const withVideo = room({ videoOn: { h: at(1) } });
assert.equal(canPullVideo(withVideo, "l1", "h", now, true), true, "a listener here pulls the host's camera");
assert.equal(canPullVideo(withVideo, "l1", "s1", now, true), false, "not a camera that isn't up");
assert.equal(canPullVideo(withVideo, "l1", "h", now, false), false, "not someone who isn't here");
assert.equal(canPullVideo(withVideo, "h", "h", now), false, "not their own");
assert.deepEqual(videoPullsFor(withVideo, "l1", false, now), [{ uid: "h", key: `h@${at(1)}` }]);
assert.deepEqual(videoPullsFor(withVideo, "l1", true, now), [], "Audio only pulls no video");
assert.equal(anyVideo(withVideo, now), true); assert.equal(anyVideo(room(), now), false);
assert.deepEqual(videoEncoding(S), { maxBitrate: 600_000, maxFramerate: 24 });
assert.deepEqual(videoConstraints(S), { height: { ideal: 480, max: 480 }, frameRate: { ideal: 24, max: 24 }, facingMode: "user" });

// ── Audio only: on by itself on slow connections or Save-Data, and the device's own choice wins ──
for (const t of ["slow-2g", "2g", "3g"]) assert.equal(audioOnlyDefault({ effectiveType: t }), true, t);
assert.equal(audioOnlyDefault({ effectiveType: "4g" }), false);
assert.equal(audioOnlyDefault({ effectiveType: "4g", saveData: true }), true, "Save-Data");
assert.equal(audioOnlyDefault(undefined), false, "no Network Information API (Safari, Firefox): video");
assert.equal(chooseAudioOnly(null, { effectiveType: "3g" }), true);
assert.equal(chooseAudioOnly("0", { effectiveType: "3g" }), false, "chose video on this device");
assert.equal(chooseAudioOnly("1", { effectiveType: "4g" }), true, "chose Audio only on this device");
assert.equal(AUDIO_ONLY_KEY, "rooms.audioOnly");

// ── the budget: counted from on and off events, idempotent ──
let st = emptyLive();
st = liveVideoOn(st, "h", at(0));
assert.equal(liveVideoOn(st, "h", at(30)), st, "a second 'on' keeps the first start");
assert.equal(liveUsedMs(st, T0 + 60_000), 60_000, "one camera, one minute");
st = liveVideoOn(st, "s1", at(30));
assert.equal(liveUsedMs(st, T0 + 60_000), 90_000, "each camera on counts");
st = liveVideoOff(st, "s1", at(60));
assert.equal(liveVideoOff(st, "s1", at(90)), st, "a second 'off' changes nothing");
assert.equal(st.usedMs, 30_000); assert.equal(st.burstSince, at(0), "the host's camera is still up: the burst goes on");
st = liveVideoOff(st, "h", at(120));
assert.equal(st.usedMs, 150_000); assert.equal(st.burstSince, null); assert.deepEqual(st.open, {});
assert.equal(liveVideoOff(liveVideoOn(emptyLive(), "h", at(10)), "h", at(5)).usedMs, 0, "an off before its on never goes negative");
assert.equal(minutesLeft(st, S, T0 + 200_000), 12, "15 minutes less 2.5 used: 12 whole minutes left");
assert.equal(minutesLeftText(12), "12 video minutes left"); assert.equal(minutesLeftText(1), "1 video minute left");
let full = liveVideoOn(emptyLive(), "h", at(0));
assert.equal(budgetUsed(full, S, T0 + 15 * 60_000 - 1), false);
assert.equal(budgetUsed(full, S, T0 + 15 * 60_000), true);
assert.equal(minutesLeft(full, S, T0 + 20 * 60_000), 0, "never below nothing");

// ── listener samples: at most one per count window, kept to the drop window ──
let samples = addSample([], 100, at(0), S);
assert.equal(addSample(samples, 99, at(5), S), samples, "within 15 seconds: no new sample");
for (let i = 1; i <= 20; i++) samples = addSample(samples, 100 - i, at(i * 15), S);
assert.ok(samples.length <= 10 && Date.parse(samples[0].at) >= T0 + 300_000 - (120_000 + 15_000), "only the last window (and a little) is kept");
// dropping: 10% or more below the peak within 2 minutes
const s = (pairs: [number, number][]) => pairs.map(([sec, n]) => ({ at: at(sec), n }));
assert.equal(dropping(s([[0, 100], [60, 95], [120, 91]]), S, T0 + 120_000), false, "9% down: not yet");
assert.equal(dropping(s([[0, 100], [60, 95], [120, 90]]), S, T0 + 120_000), true, "10% down within 2 minutes");
assert.equal(dropping(s([[0, 200], [150, 100], [180, 100]]), S, T0 + 280_000), false, "the peak is older than the window");
assert.equal(dropping(s([[0, 0], [30, 0]]), S, T0 + 30_000), false, "an empty room isn't dropping");
assert.equal(dropping(s([[0, 100]]), S, T0), false, "one sample isn't a trend");
assert.equal(dropping(s([[0, 100], [60, 95]]), roomSettings({ dropPercent: 5 }), T0 + 60_000), true, "the percentage is a setting");

// ── the prompts ──
const dropRoom = { ...emptyLive(), samples: s([[0, 100], [60, 80]]) };
assert.equal(promptDue(dropRoom, S, T0 + 60_000), "drop", "video off, minutes left, listeners dropping");
assert.equal(promptDue({ ...dropRoom, usedMs: 15 * 60_000 }, S, T0 + 60_000), null, "no minutes left: no drop prompt");
assert.equal(promptDue(dropRoom, roomSettings({ videoOn: 0 }), T0 + 60_000), null, "Live mode off: no drop prompt");
assert.equal(promptDue(liveVideoOn(dropRoom, "h", at(0)), S, T0 + 60_000), null, "video already on: no drop prompt, and no burst yet");
assert.equal(promptDue(liveVideoOn(emptyLive(), "h", at(0)), S, T0 + 3 * 60_000), "back", "a 3-minute burst");
assert.equal(promptDue({ ...liveVideoOn(emptyLive(), "h", at(0)), usedMs: 12 * 60_000 }, S, T0 + 60_000), "back", "2 minutes or fewer left");
assert.equal(promptDue(full, S, T0 + 15 * 60_000), "budget");
assert.equal(promptText("drop", S), "Listeners are dropping. Try 2 minutes of video?");
assert.equal(promptText("drop", roomSettings({ videoTryMinutes: 1 })), "Listeners are dropping. Try 1 minute of video?");
assert.equal(promptText("back", S), "Back to audio to keep your video minutes.");
assert.equal(promptText("budget", S), "Your video minutes for this live are used up. Video turns off in 30 seconds.");
// each prompt once in a while
assert.equal(promptFresh(dropRoom, "drop", S, T0), true);
assert.equal(promptFresh({ ...dropRoom, prompted: { drop: at(0) } }, "drop", S, T0 + 60_000), false, "not again within the drop window");
assert.equal(promptFresh({ ...dropRoom, prompted: { drop: at(0) } }, "drop", S, T0 + 120_000), true);
full = { ...full, prompted: { back: at(200) } };
assert.equal(promptFresh(full, "back", S, T0 + 300_000), false, "back: once per burst");
assert.equal(promptFresh({ ...full, burstSince: at(400) }, "back", S, T0 + 500_000), true, "a new burst: again");

// ── posters: the challenge art is a path on our own site, and uploads are made WebP like other pictures ──
assert.ok(CHALLENGE_POSTER.startsWith("/images/") && CHALLENGE_POSTER.endsWith(".webp"));
assert.deepEqual(webpPlan("image/jpeg", "poster"), { maxSide: 1600 });
assert.deepEqual(webpPlan("image/png", "poster"), { maxSide: 1600 });

// ── the help and the Audio rooms page quote the settings, not the defaults ──
const custom = roomFigures(roomSettings({ videoBudgetMinutes: 25, videoGraceSeconds: 45, dropPercent: 12, dropWindowMinutes: 3, videoBurstMinutes: 4, videoTryMinutes: 3, videoNearlyLeftMinutes: 5, videoHeight: 360, videoFps: 20 }), true);
const help = builtInArticles({ rooms: custom }).find((a) => a.slug === "community-audio-rooms")!.body;
for (const x of ["25 video minutes", "45 seconds later", "fall by 12% or more within 3 minutes", "Try 3 minutes of video?", "for 4 minutes in a row", "5 or fewer video minutes", "360p, 20 frames", "Audio only", "poster", "Book a session"]) assert.ok(help.includes(x), `help: ${x}`);
for (const x of ["15 video minutes", "30 seconds later", "Try 2 minutes"]) assert.ok(!help.includes(x), `help has no default: ${x}`);
const off = builtInArticles({ rooms: roomFigures(roomSettings({ videoOn: 0 }), true) }).find((a) => a.slug === "community-audio-rooms")!.body;
assert.match(off, /Video in audio rooms is switched off for now/);
const page = JSON.stringify(communityFeature("audio-rooms", custom));
for (const x of ["25 video minutes", "45 seconds", "12% within 3 minutes", "Try 3 minutes of video?", "360p at 20 frames", "Audio only", "Book a session"]) assert.ok(page.includes(x), `page: ${x}`);
assert.ok(!page.includes("15 video minutes"));
// No Live figure is typed into the help or the page: each comes from the settings.
for (const f of ["lib/kb-articles.ts", "lib/community-features.ts"]) {
  const src = readFileSync(join(__dirname, "..", "..", f), "utf8");
  assert.doesNotMatch(src, /\b15 video minutes|\b30 seconds later|Try 2 minutes|\b10% or more within|480p|24 frames/, `${f} quotes Live mode's settings`);
}
console.log("ALL OK");
