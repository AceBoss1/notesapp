// Kiswahili journals and voice notes on the server (lib/kiswahili-server.ts) against the Firestore emulator. NKENNEAi is a
// stand-in `fetch` (no network, no tokens) that counts what we ask of it. Part of npm run test:kiswahili-server → "KISWAHILI OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { nkenneUsage, swahiliAudioPart, swahiliNote, voiceNoteText, type Deps } from "../../lib/kiswahili-server";
import { encodeWav } from "../../lib/wav";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

const asked: { path: string; body: unknown }[] = [];
const standIn = (async (url: string | URL | Request, init?: RequestInit) => {
  const path = new URL(String(url)).pathname;
  const body = init?.body instanceof FormData ? "form" : init?.body ? JSON.parse(String(init.body)) : null;
  asked.push({ path, body });
  const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  if (path === "/api/translate/with-api-key") {
    const b = body as { text: string };
    return json({ translatedText: b.text.split("\n\n").map((s) => `[sw] ${s}`).join("\n\n") });
  }
  if (path === "/api/tts/v1/swahili/voices") return json({ default_voice: "swahili_female_1", voices: [{ id: "swahili_female_1", name: "F", gender: "Female" }, { id: "swahili_male_1", name: "M", gender: "Male" }] });
  if (path === "/api/tts/v1/swahili/with-api-key") return new Response(new Uint8Array([9, 9, 9]), { status: 200, headers: { "content-type": "audio/mpeg" } });
  if (path === "/api/stt/v1/swahili/with-api-key") return json({ text: "Habari, ningependa kujua bei.", duration: 2 });
  if (path === "/api/st/v1/swahili-to-english/with-api-key") return json({ translated_text: "Hello, I would like to know the price." });
  return new Response("{}", { status: 404 });
}) as typeof fetch;
const put: string[] = [];
const deps: Deps = { nkenne: { key: "test", fetch: standIn }, putAudio: async (key) => { put.push(key); return `https://media.test/${key}`; }, now: () => new Date("2026-10-22T10:00:00Z") };
const count = (p: string) => asked.filter((a) => a.path === p).length;

(async () => {
  await db.doc("users/ka").set({ username: "ka", displayName: "Ka" });
  const note = (id: string, data: object) => db.doc(`notes/${id}`).set({ title: "Five questions", content: "# Ask first\n\nShort answers.\n\n- Fees\n- Time", status: "published", authorUid: "ka", offerSwahili: true, ...data });
  await note("n1", {}); await note("n2", { offerSwahili: false }); await note("n3", { premium: true }); await note("n4", { status: "draft" });

  // first reader: translated (the title and four blocks, one call each), kept; second reader: from what was kept, no call
  const a = await swahiliNote(db, "n1", deps);
  assert.equal(a.title, "[sw] Five questions"); assert.deepEqual(a.blocks.map((b) => b.kind), ["h1", "p", "li", "li"]); assert.equal(a.fromKept, false);
  assert.equal(count("/api/translate/with-api-key"), 5);
  const b = await swahiliNote(db, "n1", deps);
  assert.equal(b.fromKept, true); assert.equal(count("/api/translate/with-api-key"), 5, "no second call");
  // only what the author offers: not switched on, subscriber-only, unpublished
  await assert.rejects(swahiliNote(db, "n2", deps), /hasn't offered/); await assert.rejects(swahiliNote(db, "n3", deps), /Subscriber-only/); await assert.rejects(swahiliNote(db, "n4", deps), /wasn't found/);
  // a reader arriving while another is translating is asked to wait, not charged twice
  await db.doc("swahili/note_n5").set({ pendingAt: "2026-10-22T09:59:30Z" }); await note("n5", {});
  await assert.rejects(swahiliNote(db, "n5", deps), (e: unknown) => (e as { status?: number }).status === 425);

  // audio: one part at a time, kept per voice
  const p0 = await swahiliAudioPart(db, "n1", "female", 0, deps);
  assert.equal(p0.fromKept, false); assert.match(p0.url, /swahili\/n1\/[0-9a-f]{16}\/female-0\.mp3$/);
  assert.equal(count("/api/tts/v1/swahili/voices"), 1);
  const again = await swahiliAudioPart(db, "n1", "female", 0, deps);
  assert.equal(again.fromKept, true); assert.equal(count("/api/tts/v1/swahili/with-api-key"), 1);
  await swahiliAudioPart(db, "n1", "male", 0, deps);
  assert.equal((asked.filter((x) => x.path === "/api/tts/v1/swahili/with-api-key").at(-1)!.body as { voice_name: string }).voice_name, "swahili_male_1");
  await assert.rejects(swahiliAudioPart(db, "n1", "female", 99, deps), /doesn't exist/);
  await assert.rejects(swahiliAudioPart(db, "n1", "robot" as "female", 0, deps), /female or male/);

  // the journal changes: translated again, and the old audio isn't reused
  await db.doc("notes/n1").update({ content: "# Ask first\n\nNew answers." });
  const c = await swahiliNote(db, "n1", deps);
  assert.equal(c.fromKept, false); assert.equal(c.blocks.length, 2); assert.equal(count("/api/translate/with-api-key"), 8, "the title and two blocks again");
  assert.equal(((await db.doc("swahili/note_n1").get()).data()!.audio as object | undefined) && Object.keys((await db.doc("swahili/note_n1").get()).data()!.audio).length, 0);

  // voice notes: only people in the chat, only voice notes, a WAV we can read, and kept on the message
  await db.doc("conversations/ka_kb").set({ participants: ["ka", "kb"] });
  await db.doc("conversations/ka_kb/messages/v1").set({ from: "kb", text: "", attachments: [{ kind: "audio", name: "v.webm", type: "audio/webm", size: 1000, key: "k" }], createdAt: "2026-10-22T09:00:00Z" });
  await db.doc("conversations/ka_kb/messages/t1").set({ from: "kb", text: "hi", createdAt: "2026-10-22T09:00:00Z" });
  const wav = encodeWav(new Float32Array(16000 * 3));
  const t = await voiceNoteText(db, "ka", { cid: "ka_kb", mid: "v1", i: 0, mode: "transcript", wav }, deps);
  assert.equal(t.text, "Habari, ningependa kujua bei."); assert.equal(t.fromKept, false);
  assert.equal(((await db.doc("conversations/ka_kb/messages/v1").get()).data()!.voiceText as Record<string, Record<string, string>>)["0"].transcript, t.text);
  const kept = await voiceNoteText(db, "kb", { cid: "ka_kb", mid: "v1", i: 0, mode: "transcript", wav: null }, deps);
  assert.equal(kept.fromKept, true, "the other person sees it without another call");
  assert.equal((await voiceNoteText(db, "ka", { cid: "ka_kb", mid: "v1", i: 0, mode: "to-english", wav }, deps)).text, "Hello, I would like to know the price.");
  await assert.rejects(voiceNoteText(db, "kc", { cid: "ka_kb", mid: "v1", i: 0, mode: "transcript", wav }, deps), /wasn't found/);
  await assert.rejects(voiceNoteText(db, "ka", { cid: "ka_kb", mid: "t1", i: 0, mode: "transcript", wav }, deps), /wasn't found/);
  await db.doc("conversations/ka_kb/messages/v2").set({ from: "kb", text: "", attachments: [{ kind: "audio" }], createdAt: "2026-10-22T09:00:00Z" });
  await assert.rejects(voiceNoteText(db, "ka", { cid: "ka_kb", mid: "v2", i: 0, mode: "to-english", wav: new TextEncoder().encode("not audio at all, really not, no header here").buffer }, deps), /couldn't be read/);
  await assert.rejects(voiceNoteText(db, "ka", { cid: "ka_kb", mid: "v2", i: 0, mode: "transcript", wav: encodeWav(new Float32Array(16000 * 130)) }, deps), /up to 2 minutes/);
  await assert.rejects(voiceNoteText(db, "ka", { cid: "ka_kb", mid: "v1", i: 0, mode: "sing", wav }, deps), /Choose/);

  // the usage log: every call, with its size; the reads served from what was kept
  const u = await nkenneUsage(db);
  assert.equal(u.totals.calls, asked.length, "every call logged");
  assert.ok(u.totals.hits >= 3); assert.ok(u.totals.chars > 0); assert.equal(u.totals.audioSeconds, 6);
  assert.ok(u.calls.every((x) => x.ok && x.httpStatus === 200));
  console.log("KISWAHILI OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
