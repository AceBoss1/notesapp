// NotesPhone reservations on the Firestore emulator (lib/leads-server.ts): one per phone per email, a second phone adds a second,
// a signed-in member gets a bell, the thank-you email, and the counts per phone. Run: npm run test:devices-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/leads-server");
  const sent: { to: string; subject: string; text: string }[] = [];
  const send = async (m: { to: string; subject: string; text: string }) => { sent.push(m); return true; };
  const base = { name: "Ada", email: "ada@x.test", model: "e-pro", colour: "maroon", city: "Lagos" };

  const a = await S.submitDeviceReservation(db, base, { uid: null }, send as never, new Date("2026-11-19T10:00:00Z"));
  assert.equal(a.again, false);
  const lead = (await db.doc(`leads/${a.id}`).get()).data()!;
  assert.equal(lead.category, "device-reservation"); assert.deepEqual(lead.device, { model: "e-pro", colour: "maroon", city: "Lagos", notify: true });
  assert.match(lead.message, /NotesPhone E Pro/);
  assert.equal(sent[0].to, "ada@x.test"); assert.match(sent[0].subject, /E Pro is reserved/); assert.match(sent[0].text, /don't have to buy/); assert.doesNotMatch(sent[0].text, /₦/);

  // the same phone again: updated in place, keeps its place in the queue
  const b = await S.submitDeviceReservation(db, { ...base, colour: "ivory" }, { uid: null }, send as never, new Date("2026-11-20T10:00:00Z"));
  assert.equal(b.id, a.id); assert.equal(b.again, true);
  const again = (await db.doc(`leads/${a.id}`).get()).data()!;
  assert.equal(again.device.colour, "ivory"); assert.equal(again.createdAt, "2026-11-19T10:00:00.000Z"); assert.equal(again.updatedAt, "2026-11-20T10:00:00.000Z");

  // another phone by the same person: a second reservation, and its email says 2027
  const c = await S.submitDeviceReservation(db, { ...base, model: "e-ultra" }, { uid: null }, send as never);
  assert.notEqual(c.id, a.id); assert.match(sent[2].text, /2027/);

  // a signed-in member gets a bell
  await S.submitDeviceReservation(db, { ...base, email: "bola@x.test", name: "Bola" }, { uid: "bola" }, send as never);
  const bells = (await db.collection("notifications").where("recipientUid", "==", "bola").get()).docs.map((d) => d.data());
  assert.equal(bells.length, 1); assert.equal(bells[0].type, "devices");

  // bad input is refused and nothing is written
  await assert.rejects(S.submitDeviceReservation(db, { ...base, model: "x" }, { uid: null }, send as never), (e: unknown) => e instanceof S.LeadError && e.status === 400);

  // Anya on the same list: its own colours, and an email without the phones' minimum order
  await S.submitDeviceReservation(db, { ...base, model: "anya-nana", colour: "pink" }, { uid: null }, send as never);
  const last = sent[sent.length - 1];
  assert.match(last.subject, /Anya Nana is reserved/); assert.match(last.text, /in Pink/); assert.doesNotMatch(last.text, /500/);
  assert.deepEqual(await S.deviceCounts(db), { "e-pro": 2, "e-ultra": 1, "e-ultra-plus": 0, "e-prestige": 0, "anya-display": 0, "anya-nana": 1, "anya-audio": 0 });
  console.log("DEVICES SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
