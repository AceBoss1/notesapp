// Moments tidy up and captions on the server (lib/moments-server.ts, lib/moments-captions-server.ts) against the Firestore emulator:
// a trim kept on a moment and held to 90 seconds of playing time, a trim that saves a video moment from the week's allowance, captions
// cleaned and kept, reshared and taken off, voice-over captions and trims, and the caption service (switched off, bad sound, the daily
// count, a failed piece not counted, either answer shape).
// Run: npm run test:moments-tidy → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MomentError, createMoment, removeCaptions, reshare, startMomentVideo, type MomentDeps } from "../../lib/moments-server";
import { captionPiece, looksLikeWav, type SpeechDeps } from "../../lib/moments-captions-server";
import { CAPTION_CHUNKS_PER_DAY, CAPTION_CHUNK_MAX_BYTES, MOMENT_TIDY_LIVE } from "../../lib/moments-tidy";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const NOW = new Date("2026-11-16T10:00:00Z");
const rejects = (p: Promise<unknown>, status: number, re?: RegExp) => assert.rejects(p, (e: unknown) => e instanceof MomentError && e.status === status && (!re || re.test(e.message)));

let sv = 0;
const videos = new Map<string, { readyToStream: boolean; state: string }>();
const deps: MomentDeps = {
  publicUrl: (k) => `https://cdn.test/${k}`,
  remove: async () => {},
  stream: {
    configured: true,
    create: async () => { const uid = `sv${++sv}`; videos.set(uid, { readyToStream: true, state: "ready" }); return { uploadURL: "https://upload.test/one-time", uid }; },
    copy: async () => ({ uid: `copy${++sv}` }),
    get: async (uid) => videos.get(uid) ?? null,
    token: async (uid, secs) => `tok-${uid}-${secs}`,
    watermark: async () => ({ uid: "wm1" }),
    dropWatermark: async () => {},
    markPng: async () => Buffer.from("\x89PNG"),
  },
};
const WORDS = [{ w: "Every", s: 0.2, e: 0.5 }, { w: "order", s: 0.5, e: 0.8 }, { w: "pays", s: 0.8, e: 1.1 }, { word: "<i>half</i>", start: 1.1, end: 1.4 }];
const wav = (bytes = 2000) => { const b = Buffer.alloc(bytes); b.write("RIFF", 0); b.write("WAVE", 8); return new Uint8Array(b); };

(async () => {
  assert.equal(MOMENT_TIDY_LIVE, true, "run with NEXT_PUBLIC_MOMENT_TIDY_LIVE=true (npm run test:moments-tidy)");
  const person = (uid: string, username: string, extra: object = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username, avatar: "", role: "reader", accountTier: "pro", ...extra });
  await person("u_ada", "ada"); await person("u_fan", "fan");
  await db.doc("follows/u_fan_ada").set({ followerUid: "u_fan", username: "ada", followedAt: "x" });
  const ada = { uid: "u_ada", username: "ada" };
  const weekUse = async () => (await db.collection("videoUsage").where("uid", "==", "u_ada").get()).docs.reduce((n, d) => n + Number(d.data().count ?? 0), 0);

  // ── A trim saves a video moment: 102 seconds of file, 81 seconds of playing, so one moment, not two ──
  const untrimmed = await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 102 }, deps, NOW);
  assert.deepEqual([untrimmed.partsNeeded, await weekUse()], [2, 2]);
  const st = await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 102, playSec: 81 }, deps, NOW);
  assert.deepEqual([st.partsNeeded, st.partsAllowed, await weekUse()], [1, 1, 3], "one of the week's video moments, not two");
  // A playing time that isn't shorter than the file, or isn't a number, is ignored.
  assert.equal((await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 102, playSec: 500 }, deps, NOW)).partsNeeded, 2);
  assert.equal((await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 102, playSec: "x" }, deps, NOW)).partsNeeded, 2);

  // ── The trim is kept on the moment; what plays is held to 90 seconds, though the part of the file it comes from is longer ──
  const spans = [[0, 40.004], [48, 70], [83, 102]];
  const m = await createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 0, clipEnd: 102, spans, captions: { words: WORDS, style: "colour", place: "middle" }, text: "New price list" }, deps, NOW);
  assert.deepEqual(m.spans, [[0, 40], [48, 70], [83, 102]]);
  assert.deepEqual([m.clipStart, m.clipEnd], [0, 102]);
  const raw = (await db.doc(`moments/${m.id}`).get()).data()!;
  assert.deepEqual(raw.spans, [0, 40, 48, 70, 83, 102], "kept flat: Firestore has no list of lists");
  // Captions: cleaned (tags out), with her look and place, on the video's own sound.
  assert.deepEqual(m.captions, { words: [{ w: "Every", s: 0.2, e: 0.5 }, { w: "order", s: 0.5, e: 0.8 }, { w: "pays", s: 0.8, e: 1.1 }, { w: "ihalf/i", s: 1.1, e: 1.4 }], style: "colour", place: "middle", of: "video" });
  // The one part it was allowed is used; a second moment from the same upload is refused.
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 0, clipEnd: 80 }, deps, NOW), 400, /every part there was room for/);
  // Bad trims: more than 90 seconds of playing, outside this moment's part, out of order.
  const st2 = await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 200, playSec: 170 }, deps, NOW);
  assert.equal(st2.partsNeeded, 2);
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st2.id, clipStart: 0, clipEnd: 150, spans: [[0, 60], [70, 150]] }, deps, NOW), 413, /up to 90 seconds/);
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st2.id, clipStart: 0, clipEnd: 100, spans: [[0, 60], [120, 140]] }, deps, NOW), 400, /trim isn't valid/);
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st2.id, clipStart: 0, clipEnd: 100, spans: [[50, 60], [10, 20]] }, deps, NOW), 400, /trim isn't valid/);
  // Two moments from one trimmed recording, each with its own stretches.
  const a = await createMoment(db, ada, { kind: "video", videoUploadId: st2.id, clipStart: 0, clipEnd: 100, spans: [[0, 60], [70, 100]] }, deps, NOW);
  const b = await createMoment(db, ada, { kind: "video", videoUploadId: st2.id, clipStart: 100, clipEnd: 200, spans: [[100, 130], [150, 200]] }, deps, NOW);
  assert.deepEqual([a.spans?.length, b.spans?.[1], b.clipStart, b.captions], [2, [150, 200], 100, undefined]);
  // No trim and no captions: a moment exactly as before.
  const st3 = await startMomentVideo(db, ada, "business", { size: 1000, contentType: "video/mp4", durationSec: 30 }, deps, NOW);
  const plain = await createMoment(db, ada, { kind: "video", videoUploadId: st3.id, captions: { words: [] } }, deps, NOW);
  assert.deepEqual([plain.spans, plain.captions, plain.clipStart], [undefined, undefined, undefined]);

  // ── A reshare carries the trim and the captions; the owner can take captions off ──
  const rs = await reshare(db, { uid: "u_fan", username: "fan" }, m.id, deps, NOW);
  assert.deepEqual([rs.spans?.length, rs.captions?.words.length], [3, 4]);
  await rejects(removeCaptions(db, "u_fan", m.id), 404);
  await removeCaptions(db, "u_ada", m.id);
  assert.equal((await db.doc(`moments/${m.id}`).get()).data()!.captions, undefined);
  assert.deepEqual((await db.doc(`moments/${m.id}`).get()).data()!.spans, [0, 40, 48, 70, 83, 102], "the trim stays");

  // ── A voice-over: its own trim, and the captions are of the voice-over ──
  await db.doc("momentAudio/a1").set({ uid: "u_ada", key: "moments/u_ada/a1.webm", durationSec: 20, verified: true });
  const v = await createMoment(db, ada, { kind: "text", text: "Four days of work", audioUploadId: "a1", audioSpans: [[0, 8], [10, 20]], captions: { words: [...WORDS, { w: "late", s: 40, e: 41 }] } }, deps, NOW);
  assert.deepEqual([v.audioSpans, v.captions?.of, v.captions?.words.length, v.captions?.style, v.spans], [[[0, 8], [10, 20]], "voice", 4, "bold", undefined]);
  await db.doc("momentAudio/a2").set({ uid: "u_ada", key: "moments/u_ada/a2.webm", durationSec: 20, verified: true });
  await rejects(createMoment(db, ada, { kind: "text", text: "x", audioUploadId: "a2", audioSpans: [[0, 30]] }, deps, NOW), 400, /trim isn't valid/);
  // A text moment with no sound has nothing to caption.
  assert.equal((await createMoment(db, ada, { kind: "text", text: "Just words", captions: { words: WORDS } }, deps, NOW)).captions, undefined);

  // ── The caption service ──
  assert.equal(looksLikeWav(wav()), true); assert.equal(looksLikeWav(new Uint8Array(100)), false);
  const calls: string[] = [];
  const speech: SpeechDeps = { transcribe: async (_b, lang) => { calls.push(lang); return { text: "So you", words: [{ word: "So", start: 0, end: 0.2 }, { word: "you", start: 0.2, end: 0.5 }] }; } };
  await rejects(captionPiece(db, "u_ada", wav(), "en", speech, NOW, false), 503, /aren't switched on/);
  await rejects(captionPiece(db, "u_ada", new Uint8Array(500), "en", speech, NOW, true), 400, /couldn't read/);
  await rejects(captionPiece(db, "u_ada", wav(CAPTION_CHUNK_MAX_BYTES + 1), "en", speech, NOW, true), 413);
  assert.equal(calls.length, 0, "nothing is sent on for sound we refuse");
  assert.deepEqual(await captionPiece(db, "u_ada", wav(), "pcm", speech, NOW, true), { words: [{ w: "So", s: 0, e: 0.2 }, { w: "you", s: 0.2, e: 0.5 }] });
  assert.deepEqual(await captionPiece(db, "u_ada", wav(), "klingon", speech, NOW, true).then(() => calls), ["pcm", "en"], "an unknown language is treated as English");
  const use = () => db.doc("momentCaptionUse/u_ada_2026-11-16").get().then((d) => d.data()!);
  assert.equal((await use()).count, 2);
  assert.deepEqual(Object.keys(await use()).sort(), ["count", "day", "expireAt", "uid"], "only a count is kept: no sound, no words");
  // Segment-only answers still give words. A piece that fails isn't counted, and she is told plainly.
  assert.deepEqual((await captionPiece(db, "u_ada", wav(), "en", { transcribe: async () => ({ segments: [{ start: 1, end: 2, text: "pays half" }] }) }, NOW, true)).words.map((w) => w.w), ["pays", "half"]);
  await rejects(captionPiece(db, "u_ada", wav(), "en", { transcribe: async () => { throw new Error("speech service answered 500"); } }, NOW, true), 502, /couldn't be written/);
  assert.equal((await use()).count, 3);
  assert.deepEqual(await captionPiece(db, "u_ada", wav(), "en", { transcribe: async () => ({ text: "" }) }, NOW, true), { words: [] }, "silence: no words, no error");
  // The day's limit.
  await db.doc("momentCaptionUse/u_ada_2026-11-16").update({ count: CAPTION_CHUNKS_PER_DAY });
  await rejects(captionPiece(db, "u_ada", wav(), "en", speech, NOW, true), 429, /today's limit/);
  assert.deepEqual(await captionPiece(db, "u_ada", wav(), "en", speech, new Date("2026-11-17T10:00:00Z"), true).then((r) => r.words.length), 2, "a new day");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
