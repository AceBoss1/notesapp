// Naija Exam Prep on the server (lib/exam-prep-server.ts and its step in lib/payments.ts) against the Firestore emulator. Paystack is
// a stand-in `fetch` here that answers the verify call as the test says (no network, no money). npm run test:exam-prep-server → "EXAM PREP OK".
import starter from "../../content/exam-prep/starter.json";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateKeyPairSync, createPublicKey, verify as edVerify } from "node:crypto";
process.env.EXAM_PREP_PASS_KEY = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
import {
  acceptInvite, closeInvite, inviteInfo, reviewerOf, adminGrant, adminRefund, board, catalogue, confirmPackPayment, createInvite, createPayLink, importQuestions, joinBoard, lookupAccess,
  mockStatus, packForSaving, payLinkInfo, practiceSet, publishQuestion, recordAttempt, reportQuestion, restorePurchases, reviewQuestion, reviewQueue,
  saveMockAnswers, saveQuestion, setTeen, confirmTeen, startMock, startPackCheckout, startPayLinkCheckout, submitMock, syncProgress, teenStatus,
} from "../../lib/exam-prep-server";
import { fulfillPayment } from "../../lib/payments";
import type { QuestionInput } from "../../lib/exam-prep";
import { sendMessage } from "../../lib/messages-server";
import { createGroup } from "../../lib/groups-server";
import { emptyProgress, passPayload, recordAnswer } from "../../lib/exam-prep";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, status: number, re?: RegExp) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status && (!re || re.test(String((e as Error).message))));

// Paystack stand-in: what verify says for each reference.
const paystack = new Map<string, { status: string; amount: number }>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (u.startsWith("https://api.paystack.co/transaction/verify/")) {
    const ref = decodeURIComponent(u.split("/").pop()!);
    const t = paystack.get(ref);
    return new Response(JSON.stringify(t ? { status: true, data: { status: t.status, amount: t.amount, requested_amount: t.amount, currency: "NGN", reference: ref } } : { status: false, message: "Transaction reference not found" }), { status: t ? 200 : 400, headers: { "content-type": "application/json" } });
  }
  return realFetch(url as RequestInfo, init);
}) as typeof fetch;
let n = 0;
const newRef = () => `na_prep_test_${++n}`;
const checkout = async () => ({ authorization_url: "https://checkout.paystack.test/x" });
const editor = { uid: "u_editor", name: "Tola (editor)" }, reviewer = { uid: "u_rev", name: "Mrs Adebayo" };
const Q = (id: string, access: "free" | "pack", topic = "algebra", answer = "B") => ({ line: 1, input: { id, exam: "jamb" as const, subject: "mathematics", topic, stem: `Question ${id}: solve for x.`, options: ["1", "2", "3", "4"], answer: answer as "B", explanation: "Worked steps here.", difficulty: 2, access } });

(async () => {
  for (const u of ["u_student", "u_teen", "u_editor", "u_rev", "u_other"]) await db.doc(`users/${u}`).set({ uid: u, username: u.slice(2), displayName: u });

  // the catalogue starts with its subjects and packs; nothing shows until something is published
  let cat = await catalogue(db, null);
  assert.equal(cat.subjects.length, 0, "no published questions: no subjects shown");
  assert.equal(cat.packs.jamb.priceKobo, 100_000); assert.equal(cat.packs.jamb.months, 12);

  // editorial: import (AI-assisted drafts go for review), review by someone else, publish
  const imp = await importQuestions(db, editor, [Q("t_free1", "free"), Q("t_free2", "free", "statistics", "A"), Q("t_pack1", "pack"), Q("t_pack2", "pack"), { line: 9, input: { exam: "jamb", subject: "mathematics", topic: "nope", stem: "x", options: ["a"], answer: "A", access: "free" } }], "ai-draft");
  assert.equal(imp.added, 4); assert.equal(imp.errors[0].line, 9);
  assert.equal((await importQuestions(db, editor, [Q("t_free1", "free")], "ai-draft")).skipped, 1, "importing twice adds nothing");
  assert.equal((await reviewQueue(db, { status: "in_review" })).length, 4);
  await rejects(publishQuestion(db, "t_free1", true), 409, /approved/);
  const mine = await saveQuestion(db, editor, { exam: "jamb", subject: "mathematics", topic: "algebra", stem: "Editor's own: solve 3x = 9.", options: ["2", "3", "4"], answer: "B", explanation: "Divide by 3.", difficulty: 1, access: "free" });
  await rejects(reviewQuestion(db, editor, mine.id, "approve", ""), 403, /someone else/);
  await rejects(reviewQuestion(db, reviewer, "t_pack2", "changes", ""), 400, /what needs changing/);
  assert.equal((await reviewQuestion(db, reviewer, "t_pack2", "changes", "Option C is also right")).status, "changes");
  for (const id of ["t_free1", "t_free2", "t_pack1"]) assert.equal((await reviewQuestion(db, reviewer, id, "approve", "")).status, "approved");
  for (const id of ["t_free1", "t_free2", "t_pack1"]) await publishQuestion(db, id, true);
  // two approvals for a subject once there are enough reviewers
  await db.doc("prepSubjects/jamb_mathematics").update({ approvalsNeeded: 2 });
  assert.equal((await reviewQuestion(db, reviewer, mine.id, "approve", "")).status, "in_review");
  await rejects(reviewQuestion(db, reviewer, mine.id, "approve", ""), 409, /already/);
  assert.equal((await reviewQuestion(db, { uid: "u_rev2", name: "Mr Okon" }, mine.id, "approve", "")).status, "approved");
  await db.doc("prepSubjects/jamb_mathematics").update({ approvalsNeeded: 1 });
  // editing a published question takes it back for review (out of practice until approved again)
  const pub = (await db.doc("prepQuestions/t_free2").get()).data()!;
  assert.equal(pub.status, "published"); assert.equal(pub.reviewedBy, "Mrs Adebayo");

  cat = await catalogue(db, null);
  assert.equal(cat.subjects.length, 1); assert.equal(cat.subjects[0].free, 2); assert.equal(cat.subjects[0].pack, 1, "counts are what's published");

  // free practice for anyone; the pack's questions only with access
  let set = await practiceSet(db, null, { exam: "jamb", subject: "mathematics" });
  assert.deepEqual(set.questions.map((q) => q.id).sort(), ["t_free1", "t_free2"]); assert.equal(set.lockedCount, 1); assert.equal(set.hasPack, false);
  assert.equal(set.questions[0].answer, "B"); assert.ok(set.questions[0].explanation);
  assert.equal((set.questions[0] as Record<string, unknown>).status, undefined);
  set = await practiceSet(db, "u_student", { exam: "jamb" });
  assert.equal(set.hasPack, false); assert.equal(set.questions.length, 2);

  // buying: a failed or abandoned payment opens nothing
  const c1 = await startPackCheckout(db, { uid: "u_student", email: "s@x.test" }, "jamb", "https://prep.test", checkout, newRef);
  const p1 = (await db.doc(`payments/${c1.reference}`).get()).data()!;
  assert.equal(p1.amountKobo, 100_000, "the price comes from the pack, not the browser"); assert.equal(p1.examPack.months, 12);
  paystack.set(c1.reference, { status: "failed", amount: 100_000 });
  let conf = await confirmPackPayment(db, c1.reference, { uid: "u_student" }, fulfillPayment);
  assert.equal(conf.paid, false); assert.equal(conf.access!.active, false);
  paystack.set(c1.reference, { status: "abandoned", amount: 100_000 });
  assert.equal((await confirmPackPayment(db, c1.reference, { uid: "u_student" }, fulfillPayment)).paid, false);
  // paid less than the price: nothing opens
  const c2 = await startPackCheckout(db, { uid: "u_student", email: "s@x.test" }, "jamb", "https://prep.test", checkout, newRef);
  paystack.set(c2.reference, { status: "success", amount: 10_000 });
  assert.equal((await confirmPackPayment(db, c2.reference, { uid: "u_student" }, fulfillPayment)).paid, false);
  assert.ok((await db.doc(`payments/${c2.reference}`).get()).data()!.mismatch, "the mismatch is kept");
  // someone else can't confirm (or learn about) my payment
  await rejects(confirmPackPayment(db, c1.reference, { uid: "u_other" }, fulfillPayment), 404);

  // Paystack says success: 12 months of JAMB only; the webhook arriving again (and again) adds nothing
  paystack.set(c1.reference, { status: "success", amount: 100_000 });
  conf = await confirmPackPayment(db, c1.reference, { uid: "u_student" }, fulfillPayment);
  assert.equal(conf.paid, true); assert.equal(conf.access!.active, true); assert.ok(conf.access!.daysLeft >= 364 && conf.access!.daysLeft <= 366);
  const exp1 = (await db.doc("prepAccess/u_student_jamb").get()).data()!.expiresAt;
  await fulfillPayment(c1.reference); await fulfillPayment(c1.reference);
  const acc = (await db.doc("prepAccess/u_student_jamb").get()).data()!;
  assert.equal(acc.expiresAt, exp1); assert.equal(acc.sources.length, 1, "one payment, one grant");
  assert.equal((await db.doc("prepAccess/u_student_waec").get()).exists, false, "WAEC and NECO stay closed");
  set = await practiceSet(db, "u_student", { exam: "jamb" });
  assert.equal(set.hasPack, true); assert.equal(set.questions.length, 3); assert.equal(set.lockedCount, 0);
  assert.ok((await db.doc("prepAccess/u_student_jamb").get()).data()!.firstPaidQuestionAt, "opening paid questions is noted");
  assert.equal((await catalogue(db, "u_student")).access.jamb?.active, true);
  assert.equal((await practiceSet(db, "u_student", { exam: "waec" })).hasPack, false);

  // refunds: not after a paid question was opened
  const look = await lookupAccess(db, "u_student");
  assert.equal(look.access.find((a) => a.exam === "jamb")!.refundable[0].ok, false);
  await rejects(adminRefund(db, c1.reference, async () => {}), 409, /paid question was opened/);

  // expiry: access ends, the pack's questions close again, renewing starts from now
  await db.doc("prepAccess/u_student_jamb").update({ expiresAt: "2026-01-01T00:00:00.000Z" });
  set = await practiceSet(db, "u_student", { exam: "jamb" });
  assert.equal(set.hasPack, false); assert.equal(set.questions.length, 2);

  // "Ask someone to pay": the payer needs no account; it opens the pack on the student's account; a used or expired link refuses
  const link = await createPayLink(db, "u_teen", "neco", "SharpLion42");
  const info = await payLinkInfo(db, link.code);
  assert.equal(info.nickname, "SharpLion42"); assert.equal(info.priceKobo, 100_000); assert.equal(info.paid, false);
  await rejects(startPayLinkCheckout(db, link.code, "not-an-email", "https://prep.test", checkout, newRef), 400);
  const pl = await startPayLinkCheckout(db, link.code, "Mum@Example.com", "https://prep.test", checkout, newRef);
  const plRec = (await db.doc(`payments/${pl.reference}`).get()).data()!;
  assert.equal(plRec.email, "mum@example.com"); assert.equal(plRec.examPack.forUid, "u_teen");
  await rejects(confirmPackPayment(db, pl.reference, { code: "WRONGCODE" }, fulfillPayment), 404);
  paystack.set(pl.reference, { status: "success", amount: 100_000 });
  assert.equal((await confirmPackPayment(db, pl.reference, { code: link.code }, fulfillPayment)).paid, true);
  assert.equal((await practiceSet(db, "u_teen", { exam: "neco" })).hasPack, true);
  await rejects(startPayLinkCheckout(db, link.code, "dad@example.com", "https://prep.test", checkout, newRef), 409, /paid for already/);
  await db.doc(`prepPayLinks/${link.code}`).update({ expiresAt: "2026-01-01T00:00:00.000Z", paidRef: null });
  await rejects(startPayLinkCheckout(db, link.code, "dad@example.com", "https://prep.test", checkout, newRef), 410);

  // restore: a payment whose confirmation was missed is checked again, and nothing is charged
  const c3 = await startPackCheckout(db, { uid: "u_other", email: "o@x.test" }, "waec", "https://prep.test", checkout, newRef);
  paystack.set(c3.reference, { status: "success", amount: 100_000 });
  const r = await restorePurchases(db, "u_other", fulfillPayment);
  assert.equal(r.restored, 1); assert.equal(r.access.waec.active, true);
  assert.equal((await restorePurchases(db, "u_other", fulfillPayment)).checked, 0, "nothing left to check");

  // refund within 7 days before opening a paid question: money back and the months off
  let refunded = "";
  assert.equal((await lookupAccess(db, "u_other")).access.find((a) => a.exam === "waec")!.refundable[0].ok, true);
  await adminRefund(db, c3.reference, async (ref) => { refunded = ref; });
  assert.equal(refunded, c3.reference);
  assert.equal((await practiceSet(db, "u_other", { exam: "waec" })).hasPack, false);
  await rejects(adminRefund(db, c3.reference, async () => {}), 409);

  // admin grants are kept with who and why
  await rejects(adminGrant(db, editor, "u_other", "jamb", 6, ""), 400);
  assert.equal((await adminGrant(db, editor, "u_other", "jamb", 6, "School sponsorship, letter on file")).active, true);

  // the offline pass: signed, for this account and pack, until no later than the access
  const saved = await packForSaving(db, "u_teen", "neco");
  assert.ok(saved.pass && saved.publicKey);
  const key = createPublicKey({ key: Buffer.from(saved.publicKey!, "base64"), format: "der", type: "spki" });
  assert.equal(edVerify("sha256", Buffer.from(passPayload(saved.pass!)), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(saved.pass!.sig, "base64")), true);
  assert.equal(edVerify("sha256", Buffer.from(passPayload({ ...saved.pass!, exp: "2099-01-01T00:00:00.000Z" })), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(saved.pass!.sig, "base64")), false, "an edited date fails");
  const freeSave = await packForSaving(db, null, "jamb");
  assert.equal(freeSave.pass, undefined); assert.equal(freeSave.questions.every((q) => q.access === "free"), true);

  // mocks: the server keeps time; answers after the deadline don't count; results match the answer keys
  const t0 = new Date("2026-10-22T10:00:00Z");
  const mk = await startMock(db, { uid: null }, { exam: "jamb", subject: "mathematics", size: 10, minutes: 5 }, t0);
  assert.ok(mk.token); assert.equal(mk.total, 2); assert.equal(mk.fewer, true);
  assert.equal("answer" in mk.questions[0], false, "no answers while the mock runs");
  await rejects(saveMockAnswers(db, mk.id, { token: "wrong" }, {}, t0), 404);
  await saveMockAnswers(db, mk.id, { token: mk.token }, { t_free1: "B", t_free2: "C", t_pack1: "B" }, new Date(t0.getTime() + 60_000));
  const st = await mockStatus(db, mk.id, { token: mk.token }, new Date(t0.getTime() + 120_000));
  assert.equal(st.submitted, false); if (!st.submitted) assert.deepEqual(st.answers, { t_free1: "B", t_free2: "C" }, "only this mock's questions");
  await rejects(saveMockAnswers(db, mk.id, { token: mk.token }, { t_free2: "A" }, new Date(t0.getTime() + 6 * 60_000)), 409, /Time is up/);
  const res = await submitMock(db, mk.id, { token: mk.token }, { t_free1: "B", t_free2: "A" }, new Date(t0.getTime() + 6 * 60_000));
  assert.equal(res.result.score, 1, "late answers are ignored: the saved ones are marked"); assert.equal(res.result.total, 2);
  assert.equal(res.questions.find((q) => q.id === "t_free2")!.answer, "A", "results show the keys");
  assert.equal((await submitMock(db, mk.id, { token: mk.token }, { t_free2: "A" }, new Date(t0.getTime() + 7 * 60_000))).result.score, 1, "submitting again changes nothing");
  const mk2 = await startMock(db, { uid: "u_teen" }, { exam: "jamb", subject: "mathematics", size: 10 }, t0);
  const r2 = await submitMock(db, mk2.id, { uid: "u_teen" }, { t_free1: "B", t_free2: "A" }, new Date(t0.getTime() + 60_000));
  assert.equal(r2.result.score, 2);
  await rejects(mockStatus(db, mk2.id, { uid: "u_other" }), 404);
  await rejects(startMock(db, { uid: null }, { exam: "jamb", size: 7 }), 400);

  // progress sync and the effort board (opt-in, nicknames, once per question a day)
  const local = recordAnswer(emptyProgress(), { id: "t_free1", topic: "algebra", answer: "B" }, "B", "2026-10-22T10:00:00.000Z");
  assert.equal(Object.keys((await syncProgress(db, "u_teen", local)).byQuestion).length, 1);
  await rejects(syncProgress(db, "u_teen", { v: 2 }), 400);
  assert.equal((await recordAttempt(db, "u_teen", "t_free1")).counted, false, "not on the board until joining");
  await rejects(joinBoard(db, "u_teen", "Ngozi Obi", true), 400);
  await joinBoard(db, "u_teen", "SharpLion42", true);
  await rejects(joinBoard(db, "u_other", "sharplion42", true), 409);
  assert.equal((await recordAttempt(db, "u_teen", "t_free2")).counted, true);
  assert.equal((await recordAttempt(db, "u_teen", "t_free2")).counted, false, "the same question again today doesn't count");
  const b = await board(db, "u_teen");
  assert.equal(b.top[0].nickname, "SharpLion42"); assert.equal(b.top[0].count, 1); assert.equal(b.me?.count, 1);
  assert.equal(JSON.stringify(b).includes("u_teen"), false, "no account ids on the board");

  // reports
  await reportQuestion(db, null, { questionId: "t_free1", reason: "wrong-answer", note: "B looks wrong" });
  await rejects(reportQuestion(db, null, { questionId: "t_free1", reason: "spam" }), 400);

  // reviewers come by invite link, for the subjects chosen first: one person, or an open link for volunteers
  await rejects(createInvite(db, editor, { subjects: [] }), 400, /at least one subject/);
  const inv = await createInvite(db, editor, { subjects: ["jamb_mathematics", "nope_subject"], note: "Maths teacher" });
  assert.deepEqual(inv.subjects, ["jamb_mathematics"], "unknown subjects are dropped");
  assert.equal((await inviteInfo(db, inv.token)).subjects[0], "JAMB Mathematics");
  await acceptInvite(db, { uid: "u_rev3", name: "Mrs Eze" }, inv.token);
  assert.deepEqual((await db.doc("prepReviewers/u_rev3").get()).data()!.subjects, ["jamb_mathematics"]);
  await acceptInvite(db, { uid: "u_rev3", name: "Mrs Eze" }, inv.token); // opening it again changes nothing
  await rejects(acceptInvite(db, { uid: "u_rev4", name: "X" }, inv.token), 410, /used/);
  await rejects(acceptInvite(db, { uid: "u_rev4", name: "X" }, "nope"), 404);
  const open = await createInvite(db, editor, { subjects: ["waec_english-language"], kind: "open", days: 30, maxUses: 2 });
  await acceptInvite(db, { uid: "u_vol1", name: "Vol One" }, open.token);
  await acceptInvite(db, { uid: "u_rev3", name: "Mrs Eze" }, open.token);
  assert.deepEqual((await db.doc("prepReviewers/u_rev3").get()).data()!.subjects.sort(), ["jamb_mathematics", "waec_english-language"], "a second link adds its subjects");
  await rejects(acceptInvite(db, { uid: "u_vol3", name: "Vol Three" }, open.token), 410, /all the reviewers/);
  const open2 = await createInvite(db, editor, { subjects: ["neco_mathematics"], kind: "open" });
  const id2 = (await db.collection("prepInvites").where("subjects", "array-contains", "neco_mathematics").get()).docs[0].id;
  await closeInvite(db, id2);
  await rejects(acceptInvite(db, { uid: "u_vol4", name: "Vol Four" }, open2.token), 410, /closed/);
  assert.equal((await inviteInfo(db, open2.token)).ok, false);

  // teen mode: the flag on the profile, the parent's email kept privately, confirmation by link
  let sentTo = "", link2 = "";
  await rejects(setTeen(db, "u_teen", "parent@example.com", async () => true, "https://prep.test", new Date("2026-10-23T12:00:00Z"), { month: 3, year: 2005 }), 400); // 21: not needed
  await rejects(setTeen(db, "u_teen", "parent@example.com", async () => true, "https://prep.test", new Date("2026-10-23T12:00:00Z"), { month: 3, year: 2015 }), 400); // 11: a child profile
  const tm = await setTeen(db, "u_teen", "Parent@Example.com", async (to, l) => { sentTo = to; link2 = l; return true; }, "https://prep.test", new Date("2026-10-23T12:00:00Z"), { month: 11, year: 2010 });
  assert.equal((await db.doc("prepTeens/u_teen").get()).data()!.birth, "2010-11", "kept with the parent's email, off the profile");
  assert.equal(tm.emailSent, true); assert.equal(sentTo, "parent@example.com");
  const prof = (await db.doc("users/u_teen").get()).data()!;
  assert.equal(prof.teen, true); assert.equal(JSON.stringify(prof).includes("parent@"), false, "the parent's email isn't on the profile");
  const u = new URL(link2);
  await rejects(confirmTeen(db, "u_teen", "wrong"), 404);
  await confirmTeen(db, u.searchParams.get("u"), u.searchParams.get("t"));
  assert.equal((await teenStatus(db, "u_teen")).confirmed, true);

  // teen mode in NotesApp: messages and groups only from people the teen follows
  const quiet = async () => {};
  await db.doc("follows/u_other_teen").set({ followerUid: "u_other", username: "teen" }); // u_other follows the teen; the teen doesn't follow back
  await rejects(sendMessage(db, "u_other", "u_teen", { text: "Hi" }, new Date(), quiet), 403, /only gets messages from people they follow/);
  await rejects(createGroup(db, "u_other", { title: "Study group", memberUids: ["u_teen"] }), 403, /only be added by people they follow/);
  await db.doc("follows/u_teen_other").set({ followerUid: "u_teen", username: "other" });
  assert.ok((await sendMessage(db, "u_other", "u_teen", { text: "Hi" }, new Date(), quiet)).conversationId, "once the teen follows them, they can message");
  assert.ok((await sendMessage(db, "u_student", "u_other", { text: "Hi" }, new Date(), quiet)).conversationId, "adults' messages are unchanged");

  // the starter set goes in for review, labelled as AI-assisted drafts, once
  const rows = (starter.questions as (QuestionInput & { id: string })[]).map((input, i) => ({ input, line: i + 1 }));
  const first = await importQuestions(db, editor, rows, "ai-draft");
  assert.deepEqual([first.added, first.errors.length], [rows.length, 0], "every starter question imports");
  assert.equal((await importQuestions(db, editor, rows, "ai-draft")).added, 0, "importing the starter set twice adds nothing");
  const sample = (await db.doc(`prepQuestions/${rows[0].input.id}`).get()).data()!;
  assert.deepEqual([sample.status, sample.provenance.by], ["in_review", "ai-draft"]);

  // a reviewer sees and reviews only their subjects; each review is counted for them
  const vol = (await reviewerOf(db, "u_vol1"))!;
  const queue = await reviewQueue(db, { status: "in_review", subjects: vol.subjects });
  assert.ok(queue.length > 0 && queue.every((q) => q.exam === "waec" && q.subject === "english-language"), "only WAEC English in the volunteer's queue");
  await rejects(reviewQuestion(db, { uid: "u_vol1", name: "Vol One", subjects: vol.subjects }, "jamb-maths-01", "approve", ""), 403, /subject you review/);
  await reviewQuestion(db, { uid: "u_vol1", name: "Vol One", subjects: vol.subjects }, queue[0].id, "approve", "");
  const counted = (await db.doc("prepReviewers/u_vol1").get()).data()!;
  assert.equal(counted.reviews, 1); assert.equal(Object.values(counted.reviewsByMonth as Record<string, number>)[0], 1);

  console.log("EXAM PREP OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
