// Nana Lite on the server (lib/nana-lite-server.ts) against the Firestore emulator, with a stand-in model. → "NANA LITE SERVER OK"
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const { explain, limitKey } = await import("../../lib/nana-lite-server");
  const { PrepError } = await import("../../lib/exam-prep-server");
  const { LITE_DAILY_PER_STUDENT } = await import("../../lib/nana-lite");
  const base = { exam: "waec", subject: "biology", topic: "cells", stem: "Which organelle makes ATP?", options: [{ key: "A", text: "Ribosome" }, { key: "B", text: "Mitochondrion" }], answer: "B", explanation: "Mitochondria release energy as ATP.", difficulty: 1, provenance: { kind: "original", by: "editor" }, reviews: [], approvals: 2, createdAt: "2026-11-01", updatedAt: "2026-11-01", version: 1 };
  await db.doc("prepQuestions/free1").set({ ...base, id: "free1", access: "free", status: "published" });
  await db.doc("prepQuestions/pack1").set({ ...base, id: "pack1", access: "pack", status: "published" });
  await db.doc("prepQuestions/draft1").set({ ...base, id: "draft1", access: "free", status: "draft" });
  const seen: string[] = [];
  const call = async (a: { system: string; user: string; maxTokens: number }) => { seen.push(a.user + a.system); return { text: "Mitochondria are the cell's power stations…", ms: 40 }; };
  const refused = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof PrepError && e.status === status);
  const now = new Date("2026-11-15T10:00:00Z");

  const r = await explain(db, { uid: null, ip: "1.2.3.4" }, { questionId: "free1", chosen: "A", followUp: "why not A?", lang: "pcm" }, call, now);
  assert.ok(r.text.startsWith("Mitochondria")); assert.ok(seen[0].includes("THE STUDENT CHOSE: A (wrong)") && seen[0].includes("Nigerian Pidgin"));
  await refused(explain(db, { uid: null, ip: "1.2.3.4" }, { questionId: "pack1" }, call, now), 403); // paid question, no pack
  await refused(explain(db, { uid: null, ip: "1.2.3.4" }, { questionId: "draft1" }, call, now), 404); // never an unpublished one
  await refused(explain(db, { uid: null, ip: "1.2.3.4" }, {}, call, now), 400);
  // with the pack, the paid question opens
  await db.doc("prepAccess/s1_waec").set({ uid: "s1", pack: "waec", expiresAt: "2027-11-01T00:00:00Z", events: [] });
  assert.ok((await explain(db, { uid: "s1", ip: "9.9.9.9" }, { questionId: "pack1" }, call, now)).text);
  // the daily limit, per account or hashed address; the address itself is never stored
  const key = limitKey(null, "1.2.3.4");
  assert.ok(key.startsWith("ip_") && !key.includes("1.2.3.4"));
  await db.doc(`prepLiteDaily/${key}_2026-11-15`).set({ n: LITE_DAILY_PER_STUDENT, day: "2026-11-15" });
  await refused(explain(db, { uid: null, ip: "1.2.3.4" }, { questionId: "free1" }, call, now), 429);
  // nothing the student typed is stored anywhere
  const all = (await db.collection("prepLiteDaily").get()).docs.map((d) => JSON.stringify(d.data())).join(" ");
  assert.ok(!all.includes("why not A"));
  assert.equal((await db.doc("prepStats/2026-11-15").get()).data()?.liteAsks, 2);
  console.log("NANA LITE SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
