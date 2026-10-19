// Paid courses, course details, organisations and co-tutors (lib/courses-server.ts, lib/course-sales-server.ts) against the Firestore
// emulator, with fake Stream and bucket checks. Run: npm run test:courses-server → "PAID OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  CourseError, accessTo, addLesson, courseForOwner, createCourse, deleteCourse, enrol, inviteTutor, linksFor, markLesson, myCourses, removeTutor, respondTutor,
  setPublished, updateCourse, type UploadChecks,
} from "../../lib/courses-server";
import { DeviceLimit, claimIncludedCertificate, courseCheckout, courseShares, fulfilCourseInTransaction, myPurchase, openLesson, refundable, splitGross, undoCoursePurchase, type LessonDeps } from "../../lib/course-sales-server";
import { includesOf, orderedLessons, type Course } from "../../lib/courses";
import type { PaymentRecord } from "../../lib/payments";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, why: string) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof CourseError, `${why}: expected a CourseError, got ${e}`);
  assert.equal((e as CourseError).status, status, `${why}: ${(e as Error).message}`);
};
const VID = "a".repeat(32), VID2 = "b".repeat(32);
const checks: UploadChecks = {
  video: async (uid) => (uid === VID ? { creator: "u_biz", duration: 610 } : uid === VID2 ? { creator: "someone_else", duration: 60 } : null),
  file: async (key) => (key.endsWith("notes.pdf") ? { size: 1000 } : null),
};
const devices = new Map<string, string[]>();
const deps: LessonDeps = {
  playerUrlFor: async (uid) => `https://iframe.videodelivery.net/token-for-${uid}`,
  checkDevice: async (ref, _uid, _c, deviceId) => {
    const d = devices.get(ref) ?? [];
    if (d.includes(deviceId)) return { ok: true, used: d.length, max: 2, devices: d };
    if (d.length >= 2) return { ok: false, used: d.length, max: 2, devices: d };
    devices.set(ref, [...d, deviceId]);
    return { ok: true, used: d.length + 1, max: 2, devices: [...d, deviceId] };
  },
};
const pay = (ref: string, c: Course, buyer: string, amountKobo: number, rate: number): PaymentRecord => ({
  reference: ref, kind: "course", uid: buyer, email: `${buyer}@x.ng`, amountKobo, status: "pending", publisherUid: c.ownerUid, publisherUsername: c.ownerUsername,
  commissionRate: rate, course: { courseId: c.id, courseTitle: c.title, courseSlug: c.slug }, createdAt: new Date().toISOString(),
} as PaymentRecord);
const buy = async (ref: string, c: Course, buyer: string, rate = 0.04) => {
  const p = pay(ref, c, buyer, c.priceKobo!, rate);
  const shares = await courseShares(db, p);
  await db.runTransaction((t) => fulfilCourseInTransaction(t, db, p, shares, new Date().toISOString()));
  return shares;
};

(async () => {
  await db.doc("users/u_basic").set({ username: "basic", displayName: "Basic Teacher", role: "reader", accountTier: "basic" });
  await db.doc("users/u_pro").set({ username: "pro", displayName: "Pro Teacher", role: "reader", accountTier: "pro" });
  await db.doc("users/u_biz").set({ username: "biz", displayName: "Biz Teacher", role: "reader", accountTier: "business" });
  await db.doc("users/u_co").set({ username: "cotutor", displayName: "Co Tutor", role: "reader", accountTier: "pro" });
  await db.doc("users/u_co2").set({ username: "cotwo", displayName: "Co Two", role: "reader", accountTier: "basic" });
  await db.doc("users/u_l").set({ username: "learner", displayName: "Lara Learner", role: "reader", accountTier: "standard" });
  await db.doc("users/u_l2").set({ username: "learner2", displayName: "Second Learner", role: "reader", accountTier: "standard" });
  await db.doc("users/org_dw").set({ username: "digitalwitch", displayName: "Digital Witch", role: "reader", accountTier: "business", accountKind: "organisation" });
  await db.doc("users/u_writer").set({ username: "writer", displayName: "Wendy Writer", role: "reader", accountTier: "standard" });
  await db.doc("users/u_admin").set({ username: "orgadmin", displayName: "Ada Admin", role: "reader", accountTier: "standard" });
  await db.doc("orgMembers/org_dw_u_writer").set({ orgUid: "org_dw", memberUid: "u_writer", role: "writer" });
  await db.doc("orgMembers/org_dw_u_admin").set({ orgUid: "org_dw", memberUid: "u_admin", role: "admin" });
  await db.doc("payoutAccounts/u_biz").set({ recipientCode: "RCP_1" });
  await db.doc("payoutAccounts/org_dw").set({ recipientCode: "RCP_2" });

  // ---- course details (every course, free or paid) ----
  const free = await createCourse(db, "u_basic", { title: "Free Course" });
  const d = await updateCourse(db, "u_basic", free.id, {
    level: "beginner", language: "Yoruba", format: "live", outcomes: "- Set up a help desk\n\n✓ Handle calls\n", requirements: ["A phone"], runsFor: "6 weeks", schedule: "Tue, Thu · 9 am",
    classUrl: "https://zoom.us/j/123", communityUrl: "https://chat.whatsapp.com/abc",
  });
  assert.deepEqual(d.outcomes, ["Set up a help desk", "Handle calls"], "outcomes are tidied, one per line");
  assert.equal(d.format, "live"); assert.equal(d.hasClassLink, true); assert.equal(d.communityKind, "WhatsApp");
  const pub = (await db.doc(`courses/${free.id}`).get()).data()!;
  assert.equal(JSON.stringify(pub).includes("zoom.us"), false, "the class link isn't on the public course");
  await fails(updateCourse(db, "u_basic", free.id, { level: "expert" }), 400, "levels come from the list");
  await fails(updateCourse(db, "u_basic", free.id, { classUrl: "zoom.us/j/1" }), 400, "links are full https addresses");
  await fails(updateCourse(db, "u_basic", free.id, { outcomes: Array(13).fill("x") }), 400, "up to 12 outcomes");

  // modules order the lessons
  const withMods = await updateCourse(db, "u_basic", free.id, { summary: "Learn.", modules: [{ title: "Getting started" }, { title: "Going further" }] });
  const [m1, m2] = withMods.modules!;
  const a = await addLesson(db, "u_basic", free.id, { kind: "text", title: "A", body: "a", moduleId: m2.id, minutes: 5 });
  const b = await addLesson(db, "u_basic", free.id, { kind: "youtube", title: "B", url: "https://youtu.be/Vl0H-qTclOg", moduleId: m1.id, minutes: 10 });
  const c0 = await addLesson(db, "u_basic", free.id, { kind: "text", title: "C", body: "c" });
  let doc = (await db.doc(`courses/${free.id}`).get()).data()!;
  assert.deepEqual(doc.lessonIds, [c0.id, b.id, a.id], "no module first, then module 1, then module 2");
  assert.deepEqual(doc.outline.map((o: { title: string }) => o.title), ["C", "B", "A"], "the public outline follows the same order");
  await updateCourse(db, "u_basic", free.id, { modules: [m2, m1] });
  doc = (await db.doc(`courses/${free.id}`).get()).data()!;
  assert.deepEqual(doc.lessonIds, [c0.id, a.id, b.id], "moving a module moves its lessons");
  assert.deepEqual(orderedLessons([{ id: "x", order: 1, moduleId: "zz" }, { id: "y", order: 0 }], []).map((x) => x.id), ["y", "x"], "unknown modules count as none");
  assert.ok(includesOf({ format: "live", schedule: "Tue", priceKobo: 0 }, [{ kind: "youtube", minutes: 10 }, { kind: "text", minutes: 5 }]).includes("10 min on-demand video"));

  // the links: enrolled learners and tutors only
  await setPublished(db, "u_basic", free.id, true);
  assert.equal(await linksFor(db, "u_l", free.id), null, "not enrolled: no links");
  await enrol(db, "u_l", free.id);
  assert.equal((await linksFor(db, "u_l", free.id))?.classUrl, "https://zoom.us/j/123");

  // ---- price: Pro and up; uploads: paid courses, video on Business ----
  await fails(updateCourse(db, "u_basic", free.id, { priceNaira: "5000" }), 403, "Basic can't sell");
  const proC = await createCourse(db, "u_pro", { title: "Pro Course" });
  await fails(updateCourse(db, "u_pro", proC.id, { priceNaira: "200" }), 400, "at least ₦500");
  const priced = await updateCourse(db, "u_pro", proC.id, { priceNaira: "15,000" });
  assert.equal(priced.priceKobo, 1_500_000); assert.equal(priced.free, false); assert.equal(priced.certificateIncluded, true, "a paid course includes the certificate by default");
  await fails(addLesson(db, "u_pro", proC.id, { kind: "video", title: "V", streamUid: VID }, new Date(), checks), 403, "video uploads are Business");
  const pdf = await addLesson(db, "u_pro", proC.id, { kind: "pdf", title: "Notes", fileKey: `courses/${proC.id}/1-notes.pdf`, fileName: "notes.pdf" }, new Date(), checks);
  assert.equal(pdf.kind, "pdf");
  await fails(addLesson(db, "u_pro", proC.id, { kind: "pdf", title: "Stolen", fileKey: `courses/other/1-notes.pdf` }, new Date(), checks), 404, "a PDF from another course's folder");
  await fails(updateCourse(db, "u_pro", proC.id, { priceKobo: 0 }), 409, "uploads keep a course paid");
  await updateCourse(db, "u_pro", proC.id, { summary: "Pro." });
  await fails(setPublished(db, "u_pro", proC.id, true), 409, "no payout account: can't publish a paid course");

  const course = await createCourse(db, "u_biz", { title: "Customer Support Mastery" });
  await updateCourse(db, "u_biz", course.id, { summary: "Support.", priceNaira: "40000", communityUrl: "https://chat.whatsapp.com/xyz" });
  await fails(addLesson(db, "u_biz", course.id, { kind: "video", title: "Not mine", streamUid: VID2 }, new Date(), checks), 404, "someone else's Stream video");
  const intro = await addLesson(db, "u_biz", course.id, { kind: "text", title: "Welcome", body: "Hello", preview: true }, new Date(), checks);
  const vid = await addLesson(db, "u_biz", course.id, { kind: "video", title: "Angry customers", streamUid: VID }, new Date(), checks);
  assert.equal(vid.minutes, 10, "minutes read from the video");
  const lessonsPublic = (await db.doc(`courses/${course.id}`).get()).data()!;
  assert.equal(JSON.stringify(lessonsPublic.outline).includes(VID), false, "the outline never carries the video");
  const live = await setPublished(db, "u_biz", course.id, true);
  assert.equal(live.status, "published");

  // ---- co-tutors ----
  const inv = await inviteTutor(db, "u_biz", course.id, { username: "@CoTutor", percent: 30 });
  assert.equal(inv.status, "pending");
  await fails(inviteTutor(db, "u_biz", course.id, { username: "cotwo", percent: 65 }), 400, "the lead keeps at least 10%");
  await fails(inviteTutor(db, "u_co", course.id, { username: "cotwo", percent: 5 }), 403, "only the lead invites");
  assert.equal(await accessTo(db, "u_co", (await courseForOwner(db, "u_biz", { id: course.id })).course), null, "not a tutor until they accept");
  await respondTutor(db, "u_co", course.id, true);
  const asTutor = await courseForOwner(db, "u_co", { id: course.id });
  assert.equal(asTutor.access, "tutor");
  await updateCourse(db, "u_co", course.id, { outcomes: "Calm angry customers" });
  await fails(updateCourse(db, "u_co", course.id, { priceNaira: "1000" }), 403, "a co-tutor doesn't set the price");
  await fails(setPublished(db, "u_co", course.id, false), 403, "a co-tutor doesn't unpublish");
  assert.ok((await myCourses(db, "u_co")).some((x) => x.id === course.id && x.access === "tutor"), "co-taught courses are on Teach");

  // ---- checkout, the split, and what the payment creates ----
  await fails(courseCheckout(db, "u_co", course.id), 409, "tutors don't buy their own course");
  await fails(courseCheckout(db, "u_l", free.id), 404, "a free course isn't for sale");
  const co = await courseCheckout(db, "u_l", course.id);
  assert.equal(co.commissionRate, 0.04, "Business: 4%");
  assert.deepEqual(splitGross(4_000_000, [{ percent: 70 }, { percent: 30 }]), [2_800_000, 1_200_000]);
  const shares = await buy("ref_1", co.course, "u_l", co.commissionRate);
  assert.deepEqual(shares.map((s) => [s.uid, s.percent, s.rate]), [["u_biz", 70, 0.04], ["u_co", 30, 0.06]], "each share at its own plan's rate");
  const lead = (await db.doc("ledger/ref_1").get()).data()!, coShare = (await db.doc("ledger/ref_1_u_co").get()).data()!;
  assert.equal(lead.grossKobo, 2_800_000); assert.equal(lead.commissionKobo, 112_000); assert.equal(lead.kind, "course");
  assert.equal(coShare.grossKobo, 1_200_000); assert.equal(coShare.commissionKobo, 72_000); assert.equal(coShare.paymentReference, "ref_1");
  assert.equal((await db.doc(`enrolments/${course.id}_u_l`).get()).data()!.purchaseRef, "ref_1");
  assert.equal((await db.doc(`courses/${course.id}`).get()).data()!.enrolCount, 1);
  await fails(courseCheckout(db, "u_l", course.id), 409, "bought once");
  assert.equal((await linksFor(db, "u_l", course.id))?.communityUrl, "https://chat.whatsapp.com/xyz");
  assert.equal(await linksFor(db, "u_l2", course.id), null);
  await fails(enrol(db, "u_l2", course.id), 402, "a paid course isn't enrolled in for free");

  // ---- opening lessons: previews for anyone; the rest for buyers on two devices; tutors always ----
  const prev = await openLesson(db, null, { courseId: course.id, lessonId: intro.id }, deps);
  assert.equal(prev.content.body, "Hello", "a free preview opens signed out");
  await fails(openLesson(db, null, { courseId: course.id, lessonId: vid.id }, deps), 401, "signed out: sign in first");
  await fails(openLesson(db, { uid: "u_l2", email: "l2@x.ng" }, { courseId: course.id, lessonId: vid.id, deviceId: "dev-aaaaaaaaaaaaaaaa1" }, deps), 402, "not bought");
  const p0 = await myPurchase(db, "u_l", course.id);
  assert.equal(p0?.refundable, true, "not started: refundable");
  const v1 = await openLesson(db, { uid: "u_l", email: "l@x.ng" }, { courseId: course.id, lessonId: vid.id, deviceId: "dev-aaaaaaaaaaaaaaaa1" }, deps);
  assert.ok(v1.content.playerUrl?.includes(VID)); assert.deepEqual(v1.content.watermark, { username: "@learner", email: "l@x.ng" });
  assert.equal((await refundable(db, "ref_1")).ok, false, "opening a paid lesson starts the course: no refund");
  await openLesson(db, { uid: "u_l", email: "l@x.ng" }, { courseId: course.id, lessonId: vid.id, deviceId: "dev-aaaaaaaaaaaaaaaa2" }, deps);
  const third = await openLesson(db, { uid: "u_l", email: "l@x.ng" }, { courseId: course.id, lessonId: vid.id, deviceId: "dev-aaaaaaaaaaaaaaaa3" }, deps).then(() => null, (e) => e);
  assert.ok(third instanceof DeviceLimit, "a third device is refused");
  assert.ok((await openLesson(db, { uid: "u_co", email: "co@x.ng" }, { courseId: course.id, lessonId: vid.id }, deps)).content.playerUrl, "a co-tutor opens it without a device check");

  // ---- the certificate, included in the price ----
  await markLesson(db, "u_l", course.id, intro.id, true);
  const e1 = await claimIncludedCertificate(db, "u_l", course.id, "Lara Learner").then(() => null, (e) => e);
  assert.ok(e1 && /Finish every lesson/.test(e1.message), "finish first");
  await markLesson(db, "u_l", course.id, vid.id, true);
  const certId = await claimIncludedCertificate(db, "u_l", course.id, "Lara Learner");
  const cert = (await db.doc(`certificates/${certId}`).get()).data()!;
  assert.equal(cert.paymentRef, "ref_1"); assert.equal(cert.learnerName, "Lara Learner");
  assert.equal(await claimIncludedCertificate(db, "u_l", course.id, "Lara Learner"), certId, "claimed once");

  // ---- refunds: within 7 days, before starting ----
  await buy("ref_2", co.course, "u_l2");
  assert.equal((await refundable(db, "ref_2")).ok, true);
  await db.doc("coursePurchases/ref_old").set({ reference: "ref_old", buyerUid: "u_x", courseId: course.id, status: "active", startedAt: null, createdAt: new Date(Date.now() - 8 * 86_400_000).toISOString() });
  assert.equal((await refundable(db, "ref_old")).ok, false, "after 7 days: no refund");
  await db.doc("payments/ref_2").set({ status: "paid" });
  await undoCoursePurchase(db, "ref_2");
  assert.equal((await db.doc("coursePurchases/ref_2").get()).data()!.status, "refunded");
  assert.equal((await db.doc(`enrolments/${course.id}_u_l2`).get()).exists, false, "the refunded learner's access goes");
  assert.equal((await db.doc("ledger/ref_2").get()).data()!.status, "refunded");
  assert.equal((await db.doc("ledger/ref_2_u_co").get()).data()!.status, "refunded", "the co-tutor's share is refunded too");
  assert.equal((await db.doc(`courses/${course.id}`).get()).data()!.enrolCount, 1);
  await fails(deleteCourse(db, "u_biz", course.id), 409, "a bought course can't be deleted");

  // a co-tutor leaves; their access goes
  await removeTutor(db, "u_co", course.id, "u_co");
  assert.equal(await accessTo(db, "u_co", (await courseForOwner(db, "u_biz", { id: course.id })).course), null);

  // ---- organisations ----
  await fails(createCourse(db, "u_l", { title: "Not a member", orgUid: "org_dw" }), 403, "only its team teaches for an organisation");
  const orgC = await createCourse(db, "u_writer", { title: "IT Support Skills", orgUid: "org_dw" });
  assert.equal(orgC.ownerUid, "org_dw"); assert.equal(orgC.ownerName, "Digital Witch"); assert.equal(orgC.isOrg, true); assert.equal(orgC.createdByUid, "u_writer");
  await updateCourse(db, "u_writer", orgC.id, { summary: "IT.", priceNaira: "25000" });
  assert.equal((await courseForOwner(db, "u_admin", { id: orgC.id })).access, "lead", "the organisation's admins lead its courses");
  await db.doc("orgMembers/org_dw_u_writer2").set({ orgUid: "org_dw", memberUid: "u_l2", role: "writer" });
  await fails(updateCourse(db, "u_l2", orgC.id, { summary: "Mine now" }), 403, "a writer edits only the courses they made");
  assert.ok((await myCourses(db, "u_admin")).some((x) => x.id === orgC.id), "the admin sees the organisation's courses");

  console.log("PAID OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
