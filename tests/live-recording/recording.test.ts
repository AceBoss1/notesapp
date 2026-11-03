// Live recording and replays, the pure parts (lib/live-recording.ts) and the signing between the app and the recorder
// (lib/recorder-sign.ts, services/room-recorder/sign.mjs). Run: npm run test:recording → "ALL OK".
import assert from "node:assert/strict";
import * as L from "../../lib/live-recording";
import { canPush, type RoomDoc } from "../../lib/rooms";
import { readRecorderToken, recorderToken, signBody, verifySignature } from "../../lib/recorder-sign";
import { replayCard, cleanShareRef } from "../../lib/share-targets";
import { parseCardLink } from "../../lib/chat-cards";

(async () => {
  const svc = await import("../../services/room-recorder/sign.mjs");
  const now = Date.parse("2026-11-02T10:00:00Z");
  const seen = { name: "H", avatar: "", at: new Date(now).toISOString(), seen: new Date(now).toISOString() };

  // ── Who is told, who must agree ──
  const base = { hostUid: "host", speakers: ["spk"] } as const;
  assert.equal(L.recordingPrompt({ ...base, speakers: ["spk"] }, "spk"), "none", "not recorded: nothing to say");
  const rec = { ...base, speakers: ["spk"], recording: { on: true as const, rid: "r1", status: "on" as const } };
  assert.equal(L.recordingPrompt(rec, "listener"), "notice", "a listener sees the notice");
  assert.equal(L.recordingPrompt(rec, "host"), "notice", "the host agreed when switching it on");
  assert.equal(L.recordingPrompt(rec, "spk"), "consent", "a speaker on stage taps to agree first");
  assert.equal(L.recordingPrompt({ ...rec, consent: { spk: "t" } }, "spk"), "notice", "and then just sees the notice");
  assert.equal(L.hasConsented(rec, "spk"), false); assert.equal(L.hasConsented(rec, "host"), true);
  // The server refuses the microphone until they agree (lib/rooms.ts canPush).
  const room = { hostUid: "host", speakers: ["spk"], joined: { host: seen, spk: seen }, status: "live", mode: "relay", recording: rec.recording } as Pick<RoomDoc, "hostUid" | "speakers" | "joined" | "status" | "mode" | "recording" | "consent">;
  assert.equal(canPush(room, "spk", now), false, "no microphone before agreeing");
  assert.equal(canPush({ ...room, consent: { spk: "t" } }, "spk", now), true);
  assert.equal(canPush(room, "host", now), true);
  assert.equal(canPush({ ...room, recording: undefined }, "spk", now), true, "an unrecorded room is as before");

  // ── Whether a room records ──
  const s = L.recordingSettings();
  const ask = (o: Partial<Parameters<typeof L.shouldRecord>[0]>) => L.shouldRecord({ asked: true, s, recorderReady: true, relay: true, planAllows: true, ...o });
  assert.equal(ask({}), true);
  assert.equal(ask({ asked: false }), false, "off by default");
  assert.equal(ask({ recorderReady: false }), false, "never without the recorder");
  assert.equal(ask({ relay: false }), false, "never phone to phone");
  assert.equal(ask({ planAllows: false }), false, "the plan switch");
  assert.equal(ask({ asked: false, planAllows: false, s: { ...s, forceRecord: 1 } }), true, "Admin's force switch records anyway");
  assert.equal(ask({ s: { ...s, forceRecord: 1 }, recorderReady: false }), false);

  // ── Settings ──
  assert.deepEqual(L.RECORDING_DEFAULTS, { keepDays: 30, maxHours: 4, forceRecord: 0 });
  assert.deepEqual(L.cleanRecordingOverrides({ keepDays: "21", maxHours: 99, forceRecord: true, junk: 1 }), { keepDays: 21, forceRecord: 1 });
  assert.deepEqual(L.cleanRecordingOverrides({ keepDays: 30 }), {}, "a default isn't saved");
  assert.equal(L.recordingSettings({ keepDays: 0 }).keepDays, 30, "out of range: the default");
  assert.deepEqual(L.recordingFigures(L.recordingSettings({ keepDays: 14, forceRecord: 1 }), true), { available: true, forced: true, keepDays: 14, maxHours: 4, transcripts: false });
  assert.equal(L.recordingFigures(L.recordingSettings({ forceRecord: 1 }), false).forced, false, "nothing is forced without the recorder");

  // ── Keep dates ──
  const ended = "2026-11-02T10:00:00.000Z";
  assert.equal(L.keepUntilFrom(ended, 30), "2026-12-02T10:00:00.000Z");
  assert.equal(L.daysLeft("2026-12-02T10:00:00.000Z", now), 30);
  assert.equal(L.daysLeft("2026-11-02T10:00:01.000Z", now), 1, "part of a day left counts as a day");
  assert.equal(L.daysLeft("2026-11-01T00:00:00.000Z", now), 0, "never negative");
  const doc = { keepUntil: L.keepUntilFrom(ended, 30), published: false, status: "ready" as const, startedAt: ended };
  assert.equal(L.dueForDeletion(doc, 30, now + 29 * L.DAY_MS), false);
  assert.equal(L.dueForDeletion(doc, 30, now + 30 * L.DAY_MS), true, "deleted on the keep date");
  assert.equal(L.dueForDeletion({ ...doc, published: true }, 30, now + 90 * L.DAY_MS), false, "a published replay's recording stays");
  assert.equal(L.dueForDeletion({ ...doc, status: "deleted" }, 30, now + 90 * L.DAY_MS), false, "already gone");
  assert.equal(L.dueForDeletion({ published: false, status: "recording", startedAt: ended }, 30, now + 31 * L.DAY_MS), true, "a stuck one without a keep date uses its start");
  const first = { firstKeepUntil: L.keepUntilFrom(ended, 30), keepUntil: L.keepUntilFrom(ended, 30) };
  assert.deepEqual(L.afterUnpublish(first, 30, now + 10 * L.DAY_MS), { keep: true, keepUntil: new Date(now + 40 * L.DAY_MS).toISOString() }, "inside the first window: the timer restarts");
  assert.deepEqual(L.afterUnpublish(first, 30, now + 31 * L.DAY_MS), { keep: false }, "after it: deleted");
  assert.equal(L.partReady([{ size: 3 * 1024 * 1024 }, { size: 2 * 1024 * 1024 }]), true);
  assert.equal(L.partReady([{ size: 5 * 1024 * 1024 - 1 }]), false);

  // ── Audience and teen mode ──
  assert.deepEqual(L.audienceFor("public", { hostTeen: false, teenOnStage: false }), { audience: "public" });
  assert.deepEqual(L.audienceFor("nonsense", { hostTeen: false, teenOnStage: false }), { audience: "public" });
  assert.equal(L.audienceFor("public", { hostTeen: true, teenOnStage: false }).audience, "community", "a teen host's replay stays in the community");
  assert.equal(L.audienceFor("subscribers", { hostTeen: false, teenOnStage: true }).audience, "community", "a teen speaker keeps it in too");
  assert.equal(L.isListed("public"), true); assert.equal(L.isListed("subscribers"), true); assert.equal(L.isListed("community"), false);
  const pub = { audience: "public" as const, hostUid: "h" }, subs = { audience: "subscribers" as const, hostUid: "h" }, comm = { audience: "community" as const, hostUid: "h" };
  assert.equal(L.mayWatch(pub, { subscribed: false, member: false }), true, "public: even signed out");
  assert.equal(L.mayWatch(subs, { uid: "x", subscribed: false, member: true }), false);
  assert.equal(L.mayWatch(subs, { uid: "x", subscribed: true, member: false }), true);
  assert.equal(L.mayWatch(comm, { uid: "x", subscribed: true, member: false }), false);
  assert.equal(L.mayWatch(comm, { uid: "x", subscribed: false, member: true }), true);
  assert.equal(L.mayWatch(comm, { uid: "h", subscribed: false, member: false }), true, "the host always");
  assert.equal(L.mayWatch(comm, { subscribed: false, member: true }), false, "never signed out");

  // ── Share cards and the journal draft ──
  assert.deepEqual(cleanShareRef({ kind: "replay", id: "abc123" }), { kind: "replay", id: "abc123" });
  assert.equal(replayCard("abc123", { title: "Q&A", audience: "community" }), null, "a community replay can't be shared out");
  assert.equal(replayCard("abc123", { title: "Q&A", audience: "public", hostUsername: "ada", hostName: "Ada" })?.path, "/replays/abc123");
  assert.equal(replayCard("abc123", { title: "Q&A", audience: "subscribers" })?.label, "Replay · subscribers");
  // In a chat, a replay's link shows as a card (lib/chat-cards.ts); the id keeps its case.
  assert.deepEqual(parseCardLink("https://www.example.ng/replays/mhAbC123def", ["example.ng"]), { kind: "replay", id: "mhAbC123def" });
  assert.equal(parseCardLink("https://www.example.ng/replays/x", ["example.ng"]), null, "too short to be an id");
  const draft = L.replayJournalDraft({ title: "Sunday *Q&A*", summary: "We talked.\n\n## Chapters\n- 0: hello", transcript: "Hello everyone.", replayPath: "/replays/x" });
  assert.match(draft, /^\*A replay of the live "Sunday Q&A"\. \[Watch it on its own page\]\(\/replays\/x\)\.\*/);
  assert.match(draft, /## Chapters/); assert.match(draft, /## Transcript\n\nHello everyone\./);
  assert.match(L.replayJournalDraft({ title: "T", replayPath: "/r", transcriptNote: "Still being made." }), /_Add a few lines about what was covered\._\n\n_Still being made\._$/);

  // ── Signing: the app and the recorder agree; tampering, age and the wrong secret are refused ──
  const secret = "s3cret-for-tests";
  const body = JSON.stringify({ rid: "r1" });
  const t = Math.floor(now / 1000);
  const h = signBody(secret, body, t);
  assert.equal(h, svc.signBody(secret, body, t), "the same header from both sides");
  assert.equal(verifySignature(secret, h, body, now), true);
  assert.equal(svc.verifySignature(secret, h, body, now), true);
  assert.equal(verifySignature(secret, svc.signBody(secret, new Uint8Array([1, 2, 3]), t), new Uint8Array([1, 2, 3]), now), true, "binary chunks too");
  assert.equal(verifySignature(secret, h, body + " ", now), false, "a changed body");
  assert.equal(verifySignature("other", h, body, now), false, "the wrong secret");
  assert.equal(verifySignature(secret, h, body, now + 301_000), false, "older than five minutes");
  assert.equal(verifySignature(secret, h, body, now - 301_000), false, "from the future");
  assert.equal(verifySignature(secret, null, body, now), false);
  assert.equal(verifySignature(secret, "t=1,v1=zz", body, now), false);
  assert.equal(svc.verifySignature(secret, h.replace(/.$/, (c: string) => (c === "0" ? "1" : "0")), body, now), false);

  // ── The recorder page's token: one room, receive-only, short-lived; never a signature ──
  const tok = recorderToken(secret, { rid: "r1", roomId: "room1" }, now, 600);
  assert.deepEqual(readRecorderToken(secret, tok, now), { rid: "r1", roomId: "room1", scope: "receive", exp: t + 600 });
  assert.equal(readRecorderToken(secret, tok, now + 601_000), null, "expired");
  assert.equal(readRecorderToken("other", tok, now), null, "another secret");
  const [p, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ rid: "r1", roomId: "room2", scope: "receive", exp: t + 600 })).toString("base64url");
  assert.equal(readRecorderToken(secret, `${forged}.${sig}`, now), null, "another room with the old signature");
  assert.equal(readRecorderToken(secret, `${p}.${sig}.x`, now), null);
  assert.equal(verifySignature(secret, `t=${t},v1=${sig}`, p, now), false, "a page token isn't a request signature");

  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
