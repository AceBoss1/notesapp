// Notes Tasks against the Firestore emulator (lib/tasks-server.ts, the escrow in lib/wallet-server.ts, payouts in lib/payouts.ts):
// only verified posters; a draft, then publishing holds reward × places from NotesApp Credit (and takes the anonymous fee); applying
// with the terms; accepting up to the places; submitting; asking for changes, rejecting (the place opens again) and approving (one
// reward from the hold into a held ledger entry, less 10%); ratings; the anonymous poster hidden from everyone but the poster; the
// sweep approving unreviewed work and ending late workers; closing gives back what's left. Run: npm run test:tasks-server → "TASKS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  applyTo, closeTask, decide, publishTask, rate, review, saveTask, startUpload, submitWork, sweepTasks, viewTask, withdraw, type FileDeps,
} from "../../lib/tasks-server";
import { ANON_FEE_KOBO, REVIEW_DAYS, type Task, type TaskApplication } from "../../lib/tasks";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const DAY = 86_400_000;
const bells: { uid: string; message: string }[] = [];
const notify = async (n: { uid: string; message: string }) => { bells.push(n); };
const files: FileDeps = { presignPut: async (k) => `https://put/${k}`, presignGet: async (k) => `https://get/${k}` };
const me = (uid: string) => ({ uid, emailVerified: true });
const user = (uid: string, extra = {}, credit = 200_000) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), avatar: "", role: "reader", accountTier: "standard", ...extra }),
  db.doc(`wallets/${uid}`).set({ creditKobo: credit * 100, bonusLots: [] }),
]);
const credit = async (uid: string) => (await db.doc(`wallets/${uid}`).get()).data()!.creditKobo as number;
const task = async (id: string) => (await db.doc(`tasks/${id}`).get()).data() as Task;
const app = async (id: string, uid: string) => (await db.doc(`taskApplications/${id}_${uid}`).get()).data() as TaskApplication;
const input = { title: "Translate 500 sentences", summary: "English to Hausa, typed by hand, for a language dataset.", details: "Translate each English sentence into natural Hausa. A Hausa reviewer checks a sample.", category: "language", rewardNaira: 40000, slots: 2, days: 3, openDays: 7, anonymous: true, brief: "Sheet: https://example.test/sheet", terms: "Keep everything confidential." };

async function main() {
  await user("acme", { accountKind: "organisation", industry: "tech", org: { rcStatus: "verified" } });
  await user("ada"); await user("bayo"); await user("chi"); await user("nobody");

  // Only verified posters.
  await assert.rejects(saveTask(db, me("nobody"), "", input), /verified/);
  await assert.rejects(saveTask(db, { uid: "acme", emailVerified: false }, "", input), /Confirm your email/);

  // A draft with a private file, then publishing: 2 × ₦40,000 held, and ₦5,000 for anonymous posting (Standard plan).
  const up = await startUpload(db, me("acme"), { name: "guide.pdf", size: 1000, purpose: "brief" }, files);
  await assert.rejects(startUpload(db, me("acme"), { name: "run.exe", size: 10, purpose: "brief" }, files), /can't be added/);
  const { id } = await saveTask(db, me("acme"), "", { ...input, fileIds: [up.id] });
  assert.equal((await task(id)).status, "draft");
  await assert.rejects(viewTask(db, "ada", id), /isn't here/, "drafts are the poster's only");
  await assert.rejects(applyTo(db, me("ada"), id, { pitch: "I am a native Hausa speaker from Kano.", agree: true }, notify), /isn't taking/);
  await user("acme", { accountKind: "organisation", industry: "tech", org: { rcStatus: "verified" } }, 50_000);
  await assert.rejects(publishTask(db, me("acme"), id), /holds ₦80,000.*₦5,000/);
  await db.doc("wallets/acme").set({ creditKobo: 200_000 * 100, bonusLots: [] });
  await publishTask(db, me("acme"), id);
  assert.equal(await credit("acme"), (200_000 - 80_000 - 5_000) * 100);
  assert.equal((await db.doc(`payments/task_anon_${id}`).get()).data()?.amountKobo, ANON_FEE_KOBO);
  let t = await task(id);
  assert.equal(t.status, "open"); assert.equal(t.heldKobo, 80_000 * 100); assert.equal(t.anonLabel, "Verified organisation · Technology or software");
  assert.equal((await db.doc(`walletHolds/task_${id}`).get()).data()?.kobo, 80_000 * 100, "the fee is out of the hold; the rewards stay held");
  await assert.rejects(publishTask(db, me("acme"), id), /already published/);

  // Visitors see the task but never who posted it, nor the private brief.
  const pub = await viewTask(db, null, id);
  assert.equal(pub.role, "visitor"); assert.equal(pub.brief, null);
  assert.equal((pub.task as Record<string, unknown>).posterUid, undefined); assert.equal(pub.task.posterName, "Verified organisation · Technology or software"); assert.equal(pub.task.posterUsername, "");

  // Applying: the terms must be agreed; once each; not your own.
  await assert.rejects(applyTo(db, me("ada"), id, { pitch: "I am a native Hausa speaker from Kano.", agree: false }, notify), /terms/);
  await applyTo(db, me("ada"), id, { pitch: "I am a native Hausa speaker from Kano.", agree: true }, notify);
  await assert.rejects(applyTo(db, me("ada"), id, { pitch: "I am a native Hausa speaker from Kano.", agree: true }, notify), /already applied/);
  await assert.rejects(applyTo(db, me("acme"), id, { pitch: "My own task, applying anyway.", agree: true }, notify), /own task/);
  await applyTo(db, me("bayo"), id, { pitch: "Translator, Zaria, five years of work.", agree: true }, notify);
  await applyTo(db, me("chi"), id, { pitch: "Linguistics graduate, fluent Hausa and English.", agree: true }, notify);
  assert.ok(bells.some((b) => b.uid === "acme" && /applied/.test(b.message)));

  // Accepting up to the places; the brief opens for those accepted.
  await decide(db, me("acme"), id, "ada", true, notify);
  await decide(db, me("acme"), id, "bayo", true, notify);
  await assert.rejects(decide(db, me("acme"), id, "chi", true, notify), /taken/);
  await assert.rejects(decide(db, me("ada"), id, "chi", true, notify), /isn't here/, "only the poster decides");
  const wv = await viewTask(db, "ada", id);
  assert.equal(wv.brief?.brief, "Sheet: https://example.test/sheet"); assert.equal(wv.brief?.files.length, 1); assert.equal((wv.brief?.files[0] as Record<string, unknown>).key, undefined, "storage keys stay server-side");
  assert.equal((await viewTask(db, "chi", id)).brief, null, "not accepted: no brief");

  // Work: ada submits with a file; changes asked; resubmits; approved → one reward from the hold to a held ledger entry (less 10%).
  const wf = await startUpload(db, me("ada"), { name: "hausa.csv", size: 500, purpose: "work", taskId: id }, files);
  await assert.rejects(startUpload(db, me("chi"), { name: "x.csv", size: 5, purpose: "work", taskId: id }, files), /Only a worker/);
  await submitWork(db, me("ada"), id, { note: "Done, see the file.", fileIds: [wf.id] }, notify);
  await assert.rejects(review(db, me("acme"), id, "ada", "changes", "fix", notify), /10 characters/);
  await review(db, me("acme"), id, "ada", "changes", "Rows 40 to 60 need hooked letters.", notify);
  assert.equal((await app(id, "ada")).status, "changes");
  await submitWork(db, me("ada"), id, { note: "Fixed rows 40 to 60.", fileIds: [wf.id] }, notify);
  await review(db, me("acme"), id, "ada", "approve", "", notify);
  const led = (await db.doc(`ledger/task_${id}_ada`).get()).data()!;
  assert.equal(led.kind, "task"); assert.equal(led.grossKobo, 40_000 * 100); assert.equal(led.netKobo, 36_000 * 100); assert.equal(led.status, "held"); assert.equal(led.publisherUid, "ada");
  t = await task(id);
  assert.equal(t.approved, 1); assert.equal(t.accepted, 1); assert.equal(t.heldKobo, 40_000 * 100); assert.equal(t.paidKobo, 40_000 * 100);
  assert.equal((await db.doc(`walletHolds/task_${id}`).get()).data()?.kobo, 40_000 * 100);
  await assert.rejects(review(db, me("acme"), id, "ada", "approve", "", notify), /no submitted work/, "paid once");

  // bayo's work is rejected: no pay, and the place opens again for chi.
  await submitWork(db, me("bayo"), id, { note: "Here it is." }, notify);
  await review(db, me("acme"), id, "bayo", "reject", "Most rows were machine translated.", notify);
  assert.equal((await task(id)).accepted, 0);
  await decide(db, me("acme"), id, "chi", true, notify);

  // Ratings both ways, once each; the poster's rating shows on the task.
  await rate(db, me("ada"), id, null, 5, "Clear brief, quick review.");
  await assert.rejects(rate(db, me("ada"), id, null, 4, ""), /already rated/);
  await rate(db, me("acme"), id, "ada", 4, "Good work.");
  await assert.rejects(rate(db, me("chi"), id, null, 5, ""), /Ratings open/);
  assert.equal((await task(id)).ratingSum, 5);
  assert.equal((await db.doc("users/ada").get()).data()?.taskWorkerRatingSum, 4);

  // Closing while chi works is refused. chi submits and nobody reviews: the sweep approves and pays after REVIEW_DAYS.
  await assert.rejects(closeTask(db, me("acme"), id, notify), /still working/);
  await submitWork(db, me("chi"), id, { note: "All 500 done." }, notify);
  assert.equal(await sweepTasks(db, notify), 0, "not yet");
  await sweepTasks(db, notify, new Date(Date.now() + (REVIEW_DAYS + 1) * DAY));
  const c = await app(id, "chi");
  assert.equal(c.status, "approved"); assert.equal(c.autoApproved, true);
  t = await task(id);
  assert.equal(t.approved, 2); assert.equal(t.status, "closed", "every place done: the sweep closes it");
  assert.equal((await db.doc(`walletHolds/task_${id}`).get()).data()?.status, "settled");
  assert.equal(await credit("acme"), (200_000 - 80_000 - 5_000) * 100, "both rewards paid out, nothing left to give back");

  // A second task: a late worker loses their place; closing gives the unpaid rewards back; withdrawing frees a place.
  const second = await saveTask(db, me("acme"), "", { ...input, anonymous: false, slots: 3, terms: "" });
  await db.doc("wallets/acme").set({ creditKobo: 150_000 * 100, bonusLots: [] });
  await publishTask(db, me("acme"), second.id);
  assert.equal(await credit("acme"), 30_000 * 100, "3 × ₦40,000 held, no anonymous fee");
  await applyTo(db, me("ada"), second.id, { pitch: "Happy to do this one as well." }, notify);
  await applyTo(db, me("bayo"), second.id, { pitch: "I'd like another go at this." }, notify);
  await decide(db, me("acme"), second.id, "ada", true, notify);
  await decide(db, me("acme"), second.id, "bayo", true, notify);
  await withdraw(db, me("bayo"), second.id);
  assert.equal((await task(second.id)).accepted, 1);
  await sweepTasks(db, notify, new Date(Date.now() + 4 * DAY));
  assert.equal((await app(second.id, "ada")).status, "expired");
  const before = await credit("acme");
  const r = await closeTask(db, me("acme"), second.id, notify);
  assert.equal(r.returnedKobo, 120_000 * 100); assert.equal(await credit("acme"), before + 120_000 * 100);
  assert.equal((await viewTask(db, null, second.id)).task.posterName, "Acme", "not anonymous: the name shows");
  console.log("TASKS SERVER OK");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
