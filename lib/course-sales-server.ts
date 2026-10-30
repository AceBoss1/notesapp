import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { digitalCommissionRateFor, type CustomRates } from "./tiers";
import { cleanLearnerName, AcademyError } from "./certificates";
import { issueInTransaction } from "./certificates-server";
import { CourseError, accessTo, courseOf, enrolmentOf, lessonOf, tierOf } from "./courses-server";
import { COURSE_REFUND_DAYS, canSellCourses, isPaid, type Course, type Lesson } from "./courses";
import type { LedgerEntry, PaymentRecord } from "./payments";
import type { AccountTier, UserProfile } from "./users";

// Server-only. Paid courses (docs/COURSES.md step 3): checking a purchase can start, what the payment creates once it's paid (the
// purchase, the learner's enrolment, the tutors' held earnings), opening a lesson (free previews for anyone; the rest for buyers on
// at most two devices, lib/view-access.ts) and refunds (within COURSE_REFUND_DAYS, only if the learner hasn't started).
//   coursePurchases/{reference} { buyerUid, buyerEmail, courseId, courseTitle, ownerUid, amountKobo, createdAt, startedAt, status }
export type CoursePurchase = {
  reference: string; buyerUid: string; buyerEmail: string; courseId: string; courseTitle: string; courseSlug: string; ownerUid: string;
  amountKobo: number; createdAt: string; startedAt: string | null; status: "active" | "refunded"; refundedAt?: string;
};
const safeId = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const HOLD_DAYS = 7; // as digital sales (lib/payments.ts DIGITAL_HOLD_DAYS): a refund window, then paid out

// Everything checkout needs to know before taking money for a course (app/api/paystack/initialize, kind "course").
export async function courseCheckout(db: Firestore, uid: string, courseId: unknown): Promise<{ course: Course; owner: UserProfile; commissionRate: number }> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  const cs = await db.doc(`courses/${courseId}`).get();
  if (!cs.exists) throw new CourseError("That course isn't for sale.", 404);
  const course = courseOf(cs.id, cs.data()!);
  if (course.status !== "published" || !isPaid(course)) throw new CourseError("That course isn't for sale.", 404);
  if (await accessTo(db, uid, course)) throw new CourseError("You teach this course, so there's nothing to buy.", 409);
  const owned = (await db.doc(`enrolments/${course.id}_${uid}`).get()).data();
  if (owned?.purchaseRef) throw new CourseError("You already have this course: open it from its page.", 409);
  const owner = (await db.doc(`users/${course.ownerUid}`).get()).data() as UserProfile | undefined;
  if (!owner || owner.suspended === true || !canSellCourses(tierOf(owner))) throw new CourseError("This course isn't on sale right now.", 409);
  const payout = (await db.doc(`payoutAccounts/${course.ownerUid}`).get()).data();
  if (!payout?.recipientCode) throw new CourseError("This course isn't on sale right now: its teacher hasn't set up payouts yet.", 409);
  return { course, owner, commissionRate: digitalCommissionRateFor((owner.accountTier as AccountTier) || "basic", (owner as UserProfile & { customRates?: CustomRates }).customRates) };
}

// Who shares a sale: the lead (the course's owner, at the rate fixed at checkout) and each accepted co-tutor with a share, at THEIR
// OWN plan's commission, exactly like a co-authored post's gift. Suspended co-tutors' shares stay with the lead.
export type SaleShare = { uid: string; username: string; percent: number; rate: number };
export async function courseShares(db: Firestore, p: PaymentRecord): Promise<SaleShare[]> {
  const lead: SaleShare = { uid: p.publisherUid, username: p.publisherUsername, percent: 100, rate: p.commissionRate };
  const courseId = p.course?.courseId;
  if (!courseId) return [lead];
  const inv = await db.collection("courseTutorInvites").where("courseId", "==", courseId).where("status", "==", "accepted").get();
  const co: SaleShare[] = [];
  for (const d of inv.docs) {
    const i = d.data();
    if (!(Number(i.percent) > 0)) continue;
    const u = (await db.doc(`users/${i.uid}`).get()).data();
    if (!u || u.suspended) continue;
    co.push({ uid: String(i.uid), username: String(i.username), percent: Number(i.percent), rate: digitalCommissionRateFor((u.accountTier as AccountTier) || "basic", u.customRates) });
  }
  if (!co.length) return [lead];
  lead.percent = 100 - co.reduce((s, c) => s + c.percent, 0);
  return [lead, ...co];
}

// The amounts each share gets (the lead keeps the rounding remainder), shared with the gift split.
export function splitGross(amountKobo: number, shares: { percent: number }[]): number[] {
  const co = shares.slice(1).map((s) => Math.floor((amountKobo * s.percent) / 100));
  return [amountKobo - co.reduce((a, b) => a + b, 0), ...co];
}

// Inside fulfillPayment's transaction (reads first, then writes): the purchase, the enrolment (a learner who'd enrolled for free
// before the course went paid keeps their progress), one more learner on the course, and the tutors' earnings held for HOLD_DAYS.
export async function fulfilCourseInTransaction(t: Transaction, db: Firestore, p: PaymentRecord, shares: SaleShare[], now: string): Promise<void> {
  if (!p.course) throw new Error("course payment without its details");
  const { courseId } = p.course;
  const eref = db.doc(`enrolments/${courseId}_${p.uid}`), cref = db.doc(`courses/${courseId}`);
  const e = await t.get(eref);
  t.set(db.doc(`coursePurchases/${p.reference}`), {
    reference: p.reference, buyerUid: p.uid, buyerEmail: p.email, courseId, courseTitle: p.course.courseTitle, courseSlug: p.course.courseSlug,
    ownerUid: p.publisherUid, amountKobo: p.amountKobo, createdAt: now, startedAt: null, status: "active",
  } satisfies CoursePurchase);
  if (e.exists) t.set(eref, { purchaseRef: p.reference }, { merge: true });
  else t.set(eref, { courseId, uid: p.uid, enrolledAt: now, done: {}, lastLessonId: null, completedAt: null, purchaseRef: p.reference });
  if (!e.exists) t.update(cref, { enrolCount: FieldValue.increment(1) });
  const releaseAfter = new Date(Date.parse(now) + HOLD_DAYS * 86_400_000).toISOString();
  const grosses = splitGross(p.amountKobo, shares);
  shares.forEach((s, i) => {
    const commissionKobo = Math.round(grosses[i] * s.rate);
    const id = i === 0 ? p.reference : `${p.reference}_${s.uid}`;
    // An affiliate's share (lib/referrals-server.ts) comes out of the lead tutor's part, who set it.
    const affiliateKobo = i === 0 ? p.affiliate?.kobo ?? 0 : 0;
    const entry: LedgerEntry = {
      reference: id, kind: "course", publisherUid: s.uid, publisherUsername: s.username, payerUid: p.uid,
      grossKobo: grosses[i], commissionKobo, netKobo: grosses[i] - commissionKobo - affiliateKobo, ...(affiliateKobo ? { affiliateKobo } : {}),
      status: "held", releaseAfter, createdAt: now,
      ...(shares.length > 1 ? { paymentReference: p.reference, sharePercent: s.percent } : {}),
    };
    t.set(db.doc(`ledger/${id}`), entry);
  });
}

// ---- opening a lesson ----
export type LessonContent = {
  id: string; title: string; kind: Lesson["kind"]; preview: boolean;
  body?: string; youtubeId?: string; playerUrl?: string; pdf?: boolean;
  watermark?: { username: string; email: string };
};
export type LessonDeps = {
  playerUrlFor: (streamUid: string) => Promise<string>;
  checkDevice: (reference: string, uid: string, courseId: string, deviceId: string, label: string) => Promise<{ ok: boolean; used: number; max: number; devices: unknown[] }>;
};
export class DeviceLimit extends CourseError {
  constructor(public devices: unknown[], public max: number) { super(`This course is already open on ${max} devices. Remove one of them to watch here.`, 403); }
}
// Who's asking (uid null: signed out), the lesson, and their device. Free courses and free previews: anyone. Otherwise the tutors,
// or a buyer on one of their two devices; a buyer's first look at a paid lesson starts the course (no refund after that).
export async function openLesson(db: Firestore, viewer: { uid: string; email: string } | null, q: { courseId?: unknown; lessonId?: unknown; deviceId?: string; deviceLabel?: string }, deps: LessonDeps, now = new Date()): Promise<{ content: LessonContent; lesson: Lesson; purchaseRef: string | null }> {
  if (!safeId(q.courseId) || !safeId(q.lessonId)) throw new CourseError("Which lesson?");
  const cref = db.doc(`courses/${q.courseId}`);
  const [cs, ls] = await Promise.all([cref.get(), cref.collection("lessons").doc(String(q.lessonId)).get()]);
  if (!cs.exists || !ls.exists) throw new CourseError("That lesson doesn't exist (any more).", 404);
  const c = courseOf(cs.id, cs.data()!), l = lessonOf(ls.id, ls.data()!);
  const access = viewer ? await accessTo(db, viewer.uid, c) : null;
  if (c.status !== "published" && !access) throw new CourseError("That course isn't open.", 404);
  let purchaseRef: string | null = null;
  if (isPaid(c) && !l.preview && !access) {
    if (!viewer) throw new CourseError("Sign in, and buy the course to open this lesson.", 401);
    const e = (await db.doc(`enrolments/${c.id}_${viewer.uid}`).get()).data();
    const ref = e ? enrolmentOf(e).purchaseRef : undefined;
    const purchase = ref ? ((await db.doc(`coursePurchases/${ref}`).get()).data() as CoursePurchase | undefined) : undefined;
    if (!ref || !purchase || purchase.status !== "active" || purchase.buyerUid !== viewer.uid) throw new CourseError("Buy the course to open this lesson.", 402);
    if (!q.deviceId) throw new CourseError("This browser couldn't be identified. Reload the page and try again.");
    const d = await deps.checkDevice(ref, viewer.uid, c.id, q.deviceId, q.deviceLabel ?? "");
    if (!d.ok) throw new DeviceLimit(d.devices, d.max);
    if (!purchase.startedAt) await db.doc(`coursePurchases/${ref}`).update({ startedAt: now.toISOString() });
    purchaseRef = ref;
  }
  const who = viewer ? ((await db.doc(`users/${viewer.uid}`).get()).data() as UserProfile | undefined) : undefined;
  const content: LessonContent = {
    id: l.id, title: l.title, kind: l.kind, preview: !!l.preview,
    ...(l.kind === "text" ? { body: l.body ?? "" } : {}), ...(l.kind === "youtube" ? { youtubeId: l.youtubeId } : {}), ...(l.kind === "pdf" ? { pdf: true } : {}),
    ...(l.kind === "video" && l.streamUid ? { playerUrl: await deps.playerUrlFor(l.streamUid) } : {}),
    ...(isPaid(c) && viewer ? { watermark: { username: who?.username ? `@${who.username}` : "", email: viewer.email } } : {}),
  };
  return { content, lesson: l, purchaseRef };
}

// ---- the certificate, included in the price ----
// A buyer who finished a paid course whose price includes the certificate gets it without paying again. Its paymentRef is the
// course's payment, so refunding the course (before it's started, so never in practice) would also revoke it.
export async function claimIncludedCertificate(db: Firestore, uid: string, courseId: unknown, learnerName: unknown, now = new Date()): Promise<string> {
  if (!safeId(courseId)) throw new AcademyError("Which course?");
  const name = cleanLearnerName(learnerName);
  const [cs, es] = await Promise.all([db.doc(`courses/${courseId}`).get(), db.doc(`enrolments/${courseId}_${uid}`).get()]);
  const c = cs.exists ? courseOf(cs.id, cs.data()!) : null;
  const e = es.exists ? enrolmentOf(es.data()!) : null;
  if (!c || !c.certificateIncluded || !isPaid(c)) throw new AcademyError("This course's certificate isn't included in its price.", 409);
  if (!e?.purchaseRef) throw new AcademyError("Buy the course first.", 402);
  if (!e.completedAt) throw new AcademyError("Finish every lesson first, then claim your certificate.", 409);
  if (e.certificateId) return e.certificateId;
  return db.runTransaction((t) => issueInTransaction(t, db, { uid, reference: e.purchaseRef!, certificate: { courseId: c.id, learnerName: name } }, now));
}

// ---- refunds ----
export type RefundCheck = { ok: true; purchase: CoursePurchase } | { ok: false; reason: string; purchase?: CoursePurchase };
export async function refundable(db: Firestore, reference: string, now = new Date()): Promise<RefundCheck> {
  const purchase = (await db.doc(`coursePurchases/${reference}`).get()).data() as CoursePurchase | undefined;
  if (!purchase) return { ok: false, reason: "That purchase wasn't found." };
  if (purchase.status !== "active") return { ok: false, reason: "It's already been refunded.", purchase };
  const e = (await db.doc(`enrolments/${purchase.courseId}_${purchase.buyerUid}`).get()).data();
  if (purchase.startedAt || (e && Object.keys(e.done ?? {}).length) || e?.certificateId) return { ok: false, reason: "The course has been started, so it can't be refunded.", purchase };
  if (now.getTime() - Date.parse(purchase.createdAt) > COURSE_REFUND_DAYS * 86_400_000) return { ok: false, reason: `Refunds are within ${COURSE_REFUND_DAYS} days of buying.`, purchase };
  return { ok: true, purchase };
}
// After the money has gone back (lib/refunds.ts refundPayment): the purchase is marked refunded, the learner's access and
// devices go, the course has one learner fewer, and every ledger entry of the payment (the lead's and the co-tutors') is refunded.
export async function undoCoursePurchase(db: Firestore, reference: string, now = new Date()): Promise<void> {
  const purchase = (await db.doc(`coursePurchases/${reference}`).get()).data() as CoursePurchase | undefined;
  if (!purchase) return;
  const shares = await db.collection("ledger").where("paymentReference", "==", reference).get();
  const b = db.batch();
  b.update(db.doc(`coursePurchases/${reference}`), { status: "refunded", refundedAt: now.toISOString() });
  b.update(db.doc(`payments/${reference}`), { status: "refunded" });
  b.set(db.doc(`ledger/${reference}`), { status: "refunded" }, { merge: true });
  shares.docs.forEach((d) => b.update(d.ref, { status: "refunded" }));
  b.delete(db.doc(`enrolments/${purchase.courseId}_${purchase.buyerUid}`));
  b.delete(db.doc(`viewAccess/${reference}`));
  b.update(db.doc(`courses/${purchase.courseId}`), { enrolCount: FieldValue.increment(-1) });
  await b.commit();
}

// The buyer's purchase of a course, for its page (Refund while it's allowed). Null when they haven't bought it.
export async function myPurchase(db: Firestore, uid: string, courseId: unknown, now = new Date()): Promise<{ reference: string; refundable: boolean; refundUntil: string } | null> {
  if (!safeId(courseId)) return null;
  const e = (await db.doc(`enrolments/${courseId}_${uid}`).get()).data();
  if (!e?.purchaseRef) return null;
  const r = await refundable(db, String(e.purchaseRef), now);
  const createdAt = r.purchase?.createdAt ?? now.toISOString();
  return { reference: String(e.purchaseRef), refundable: r.ok, refundUntil: new Date(Date.parse(createdAt) + COURSE_REFUND_DAYS * 86_400_000).toISOString() };
}
