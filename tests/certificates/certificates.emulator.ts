// Certificates against the Firestore emulator (lib/certificates-server.ts, the "certificate" payment in lib/payments.ts): the price
// with the late claim fee, issuing through a paid (wallet) payment, one certificate per course, the teacher's held share, the
// accreditation review, the Certified seal and revoking. Run: npm run test:certificates-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { certificateOf, checkoutFor, decideAccreditation, quote, revokeCertificate, revokeForPayment, saveAcademy, setCertified } from "../../lib/certificates-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { isCertificateId } from "../../lib/certificates";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date("2026-10-20T10:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const rejects = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status);

(async () => {
  await db.doc("users/u_teach").set({ displayName: "Tola Bello", username: "tola", accountTier: "pro" });
  await db.doc("users/u_ada").set({ displayName: "Ada Okoye", username: "ada", accountTier: "basic" });
  await db.doc("courses/c1").set({ title: "AI & Automation", slug: "ai-automation", minutes: 24 * 60, ownerUid: "u_teach", ownerName: "Tola Bello", status: "published", lessonIds: ["l1"] });
  await db.doc("enrolments/c1_u_ada").set({ courseId: "c1", uid: "u_ada", done: { l1: daysAgo(2) }, completedAt: null });

  // A teacher can't claim a certificate for their own course.
  await rejects(quote(db, "u_teach", "c1", "Tola Bello", now), 409);
  // Not finished: no certificate yet.
  await rejects(quote(db, "u_ada", "c1", "Ada Okoye", now), 409);
  await db.doc("enrolments/c1_u_ada").update({ completedAt: daysAgo(2) });

  // Before setup: our part only, the teacher's name issues it.
  let q = await quote(db, "u_ada", "c1", "Ada Okoye", now);
  assert.equal(q.startKobo, 99_900); assert.equal(q.lateKobo, 0); assert.equal(q.kobo, 99_900); assert.equal(q.face.academyName, "Tola Bello"); assert.equal(q.academyReady, false);

  // The teacher sets up with a ₦500 margin and an accrediting institution, which waits for review.
  const a = await saveAcademy(db, "u_teach", { name: "LWB Academy", logoUrl: "https://cdn/academy/u/l.png", signerName: "Tola Bello", marginNaira: 500, accreditation: { name: "LBS", logoUrl: "https://cdn/academy/u/lbs.png", proof: "https://lbs.edu/partners" } }, now, () => true);
  assert.equal(a.accreditation?.status, "pending");
  q = await quote(db, "u_ada", "c1", "Ada Okoye", now);
  assert.equal(q.kobo, 149_900); assert.equal(q.face.academyName, "LWB Academy"); assert.equal(q.face.accreditation, null, "not printed while pending");
  // Saving again unchanged keeps the review; changing it sends it back.
  await decideAccreditation(db, "u_teach", true, "", "staff@x");
  assert.equal((await saveAcademy(db, "u_teach", { name: "LWB Academy", logoUrl: "https://cdn/academy/u/l.png", signerName: "Tola Bello", marginNaira: 500, accreditation: { name: "LBS", logoUrl: "https://cdn/academy/u/lbs.png", proof: "https://lbs.edu/partners" } }, now, () => true)).accreditation?.status, "approved");
  await rejects(decideAccreditation(db, "u_teach", false, "no", "staff@x"), 400);
  q = await quote(db, "u_ada", "c1", "Ada Okoye", now);
  assert.deepEqual(q.face.accreditation, { name: "LBS", logoUrl: "https://cdn/academy/u/lbs.png" });

  // Claimed late: 30 days after finishing → 3 full weeks past the 7 free days → 3% of ₦1,499, rounded up to the naira.
  await db.doc("enrolments/c1_u_ada").update({ completedAt: daysAgo(30) });
  q = await quote(db, "u_ada", "c1", "Ada Okoye", now);
  assert.equal(q.lateKobo, Math.ceil((149_900 * 0.03) / 100) * 100); assert.equal(q.kobo, 149_900 + q.lateKobo);

  // Paid (from the wallet, so no Paystack call): issued once, linked from the enrolment, the teacher's share held in the ledger.
  await setCertified(db, "c1", true, "staff@x");
  const co = await checkoutFor(db, "u_ada", "c1", "  Ada  Okoye ", new Date());
  assert.equal(co.name, "Ada Okoye"); assert.equal(co.ownerUid, "u_teach");
  const ref = "na_test_cert_1";
  const record: PaymentRecord = {
    reference: ref, kind: "certificate", uid: "u_ada", email: "ada@x.test", amountKobo: co.q.kobo, status: "pending", payWith: "wallet",
    publisherUid: "u_teach", publisherUsername: "tola", commissionRate: 0.1,
    certificate: { courseId: "c1", courseTitle: "AI & Automation", learnerName: co.name, startKobo: co.q.startKobo, lateKobo: co.q.lateKobo, teacherKobo: co.teacherKobo },
    createdAt: new Date().toISOString(),
  };
  await db.doc(`payments/${ref}`).set(record);
  const paid = await fulfillPayment(ref);
  assert.equal(paid.status, "paid");
  const id = paid.certificate?.issuedId ?? "";
  assert.ok(isCertificateId(id), id);
  const cert = (await certificateOf(db, id))!;
  assert.equal(cert.learnerName, "Ada Okoye"); assert.equal(cert.academyName, "LWB Academy"); assert.equal(cert.certified, true);
  assert.deepEqual(cert.accreditation, { name: "LBS", logoUrl: "https://cdn/academy/u/lbs.png" }); assert.equal(cert.status, "valid"); assert.equal(cert.hours, 24);
  assert.equal((await db.doc("enrolments/c1_u_ada").get()).data()!.certificateId, id);
  const ledger = (await db.doc(`ledger/${ref}`).get()).data()!;
  assert.equal(ledger.kind, "certificate"); assert.equal(ledger.grossKobo, co.teacherKobo); assert.equal(ledger.commissionKobo, Math.round(co.teacherKobo * 0.1)); assert.equal(ledger.publisherUid, "u_teach");
  assert.ok(co.teacherKobo > 50_000, "the margin plus its share of the late fee");
  const bells = (await db.collection("notifications").where("recipientUid", "in", ["u_ada", "u_teach"]).get()).docs.map((d) => String(d.data().message));
  assert.ok(bells.some((m) => /certificate for “AI & Automation” is ready/.test(m)), "the learner is told");
  assert.ok(bells.some((m) => /Ada Okoye got their certificate/.test(m)), "and the teacher");
  assert.equal((await fulfillPayment(ref)).certificate?.issuedId, id, "fulfilling again changes nothing");

  // One per course.
  await rejects(checkoutFor(db, "u_ada", "c1", "Ada Okoye", new Date()), 409);
  assert.equal((await quote(db, "u_ada", "c1", "Ada Okoye", now)).certificateId, id);

  // Revoking: needs a reason; a refund revokes it too.
  await rejects(revokeCertificate(db, id, "no", "staff@x"), 400);
  await revokeForPayment(db, ref);
  const r = (await certificateOf(db, id))!;
  assert.equal(r.status, "revoked"); assert.match(r.revokeReason ?? "", /refunded/);
  assert.equal(await certificateOf(db, "NA-C-NOTREAL1"), null);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
