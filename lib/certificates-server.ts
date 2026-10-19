import type { Firestore, Transaction } from "firebase-admin/firestore";
import { currentPricing, certificatePrice } from "./pricing";
import { r2PublicUrl } from "./r2";
import {
  NOTES_ACADEMY_LOGO, STAFF_ROLES, reservedAcademyName, AcademyError, cleanLearnerName, cleanSetup, faceFor, isCertificateId, newCertificateId, teacherGross,
  type Academy, type Certificate, type CertificateFace, type SetupInput,
} from "./certificates";
import { SITE_URL } from "@/lib/host";

// The server side of certificates (lib/certificates.ts has the shapes and the rules). Server only.

export const verifyUrlFor = (id: string) => `${SITE_URL}/certificates/${id}`;
// Our own bucket's addresses only: a logo or signature has to have been uploaded through /api/upload.
const ours = (url: string) => { try { const base = r2PublicUrl("academy/"); return url.startsWith(base); } catch { return false; } };

export async function academyOf(db: Firestore, uid: string): Promise<Academy | null> {
  const d = (await db.doc(`academies/${uid}`).get()).data();
  return d ? (d as Academy) : null;
}

export async function saveAcademy(db: Firestore, uid: string, input: SetupInput, now = new Date(), isOurs = ours, staff = false): Promise<Academy> {
  const c = cleanSetup(input, (url) => isOurs(url) || (staff && url === NOTES_ACADEMY_LOGO));
  if (!staff && reservedAcademyName(c.name)) throw new AcademyError("That name belongs to #NotesApp. Use your own academy's or institution's name.");
  const ref = db.doc(`academies/${uid}`);
  return db.runTransaction(async (t) => {
    const before = (await t.get(ref)).data() as Academy | undefined;
    const prev = before?.accreditation ?? null;
    // Unchanged → keeps its review; anything changed → back in the queue.
    const same = prev && c.accreditation && prev.name === c.accreditation.name && prev.logoUrl === c.accreditation.logoUrl && prev.proof === c.accreditation.proof;
    const accreditation = !c.accreditation ? null : same ? prev : { ...c.accreditation, status: "pending" as const, submittedAt: now.toISOString() };
    const a: Academy = { ...c, accreditation, ownerUid: uid, updatedAt: now.toISOString() };
    t.set(ref, a);
    return a;
  });
}

type CourseDoc = { title: string; slug: string; minutes: number; ownerUid: string; ownerName: string; ownerUsername?: string; status: string; certified?: unknown; priceKobo?: number; certificateIncluded?: boolean; tutorUids?: string[] };
type EnrolDoc = { completedAt?: string | null; certificateId?: string; purchaseRef?: string };

export type Quote = {
  course: { id: string; title: string; slug: string; ownerName: string; hours: number };
  completedAt: string; academyReady: boolean;
  startKobo: number; lateKobo: number; kobo: number; marginKobo: number;
  graceUntil: string; weeklyKobo: number; capKobo: number;
  face: CertificateFace; certificateId: string | null;
  included: boolean; // a paid course whose price includes the certificate: claimed without paying (POST /api/academy/certificate)
};

// What a learner who finished the course would pay today, and the certificate they'd get (shown as a preview until paid).
export async function quote(db: Firestore, uid: string, courseId: string, learnerName: string, now = new Date()): Promise<Quote> {
  const [cs, es] = await Promise.all([db.doc(`courses/${courseId}`).get(), db.doc(`enrolments/${courseId}_${uid}`).get()]);
  if (!cs.exists) throw new AcademyError("That course doesn't exist (any more).", 404);
  const c = cs.data() as CourseDoc;
  if (c.ownerUid === uid || (c.tutorUids ?? []).includes(uid)) throw new AcademyError("You teach this course, so there's no certificate to claim. Set up the one your learners get in Your academy.", 409);
  const e = es.data() as EnrolDoc | undefined;
  if (!e?.completedAt) throw new AcademyError("Finish every lesson first, then claim your certificate.", 409);
  const [academy, owner] = await Promise.all([academyOf(db, c.ownerUid), db.doc(`users/${c.ownerUid}`).get()]);
  const staff = STAFF_ROLES.includes(String(owner.data()?.role));
  const late = currentPricing().certificateLate;
  const marginKobo = academy?.marginKobo ?? 0;
  const startKobo = currentPricing().coursePackages.certificateMinKobo + marginKobo;
  const price = certificatePrice(startKobo, e.completedAt, now, late);
  const roundUp = (k: number) => Math.ceil(k / 100) * 100;
  return {
    course: { id: courseId, title: c.title, slug: c.slug, ownerName: c.ownerName, hours: Math.max(1, Math.round(c.minutes / 60)) },
    completedAt: e.completedAt, academyReady: !!academy,
    startKobo, lateKobo: price.lateKobo, kobo: price.kobo, marginKobo,
    graceUntil: new Date(Date.parse(e.completedAt) + (late.graceDays + 1) * 86_400_000).toISOString(),
    weeklyKobo: roundUp(startKobo * late.weeklyRate), capKobo: roundUp(startKobo * late.capRate),
    face: faceFor(academy, { ...c, staff }, { name: learnerName, completedAt: e.completedAt }, { id: "NA-C-XXXXXXXX", issuedAt: now.toISOString() }),
    certificateId: e.certificateId ?? null,
    included: (Number(c.priceKobo) || 0) > 0 && c.certificateIncluded === true && !!e.purchaseRef,
  };
}

// The checkout's record (app/api/paystack/initialize, kind "certificate"): the price fixed now, the name to print, and the teacher's part.
export async function checkoutFor(db: Firestore, uid: string, courseId: unknown, learnerName: unknown, now = new Date()) {
  if (typeof courseId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(courseId)) throw new AcademyError("Which course?");
  const name = cleanLearnerName(learnerName);
  const q = await quote(db, uid, courseId, name, now);
  if (q.certificateId) throw new AcademyError("You already have this certificate.", 409);
  if (q.included) throw new AcademyError("Your certificate is included in the course's price: claim it without paying.", 409);
  const c = (await db.doc(`courses/${courseId}`).get()).data() as CourseDoc;
  return { q, name, ownerUid: c.ownerUid, teacherKobo: teacherGross(q.startKobo, q.marginKobo, q.lateKobo) };
}

// Inside fulfillPayment's transaction: reads first, then writes. Issues the certificate (a snapshot of what's printed), links it from
// the enrolment, and returns its id; an enrolment that already has one keeps it (a payment can't issue two).
export async function issueInTransaction(t: Transaction, db: Firestore, p: { uid: string; reference: string; certificate?: { courseId: string; learnerName: string } }, now: Date): Promise<string> {
  if (!p.certificate) throw new Error("certificate payment without its details");
  const { courseId, learnerName } = p.certificate;
  const eref = db.doc(`enrolments/${courseId}_${p.uid}`);
  const [cs, es] = await Promise.all([t.get(db.doc(`courses/${courseId}`)), t.get(eref)]);
  const e = es.data() as EnrolDoc | undefined;
  if (e?.certificateId) return e.certificateId;
  const c = cs.data() as CourseDoc;
  const [as, os] = await Promise.all([t.get(db.doc(`academies/${c.ownerUid}`)), t.get(db.doc(`users/${c.ownerUid}`))]);
  const academy = as.data() as Academy | undefined;
  const staff = STAFF_ROLES.includes(String(os.data()?.role));
  let id = newCertificateId();
  for (let i = 0; i < 3 && (await t.get(db.doc(`certificates/${id}`))).exists; i++) id = newCertificateId();
  const face = faceFor(academy ?? null, { ...c, staff }, { name: learnerName, completedAt: e?.completedAt || now.toISOString() }, { id, issuedAt: now.toISOString() });
  const cert: Certificate = { ...face, uid: p.uid, courseId, courseSlug: c.slug, ownerUid: c.ownerUid, paymentRef: p.reference, status: "valid" };
  t.set(db.doc(`certificates/${id}`), cert);
  t.set(eref, { certificateId: id }, { merge: true });
  return id;
}

export async function certificateOf(db: Firestore, id: string): Promise<Certificate | null> {
  if (!isCertificateId(id)) return null;
  const d = (await db.doc(`certificates/${id}`).get()).data();
  return d ? (d as Certificate) : null;
}
export async function myCertificates(db: Firestore, uid: string): Promise<Certificate[]> {
  const s = await db.collection("certificates").where("uid", "==", uid).get();
  return s.docs.map((d) => d.data() as Certificate).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

// Revoked certificates stay on the verification page, saying so and why (a refund, a copied course).
export async function revokeCertificate(db: Firestore, id: string, reason: string, by: string, now = new Date()): Promise<void> {
  const r = reason.trim().slice(0, 300);
  if (r.length < 5) throw new AcademyError("Say why it's revoked: it's shown on the verification page.");
  const ref = db.doc(`certificates/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AcademyError("No certificate has that ID.", 404);
  await ref.update({ status: "revoked", revokedAt: now.toISOString(), revokeReason: r, revokedBy: by });
}
export async function revokeForPayment(db: Firestore, reference: string, now = new Date()): Promise<void> {
  const s = await db.collection("certificates").where("paymentRef", "==", reference).limit(1).get();
  if (!s.empty) await revokeCertificate(db, s.docs[0].id, "The payment for it was refunded.", "system", now);
}

// Admin → Academy: accreditations waiting for a decision, and the decision.
export async function pendingAccreditations(db: Firestore): Promise<Academy[]> {
  const s = await db.collection("academies").where("accreditation.status", "==", "pending").limit(100).get();
  return s.docs.map((d) => d.data() as Academy);
}
export async function decideAccreditation(db: Firestore, ownerUid: string, approve: boolean, note: string, by: string, now = new Date()): Promise<Academy> {
  const ref = db.doc(`academies/${ownerUid}`);
  return db.runTransaction(async (t) => {
    const a = (await t.get(ref)).data() as Academy | undefined;
    if (!a?.accreditation) throw new AcademyError("Nothing is waiting for a decision there.", 404);
    if (!approve && note.trim().length < 5) throw new AcademyError("Say why, so the teacher can fix it.");
    const accreditation = { ...a.accreditation, status: approve ? "approved" as const : "rejected" as const, decidedAt: now.toISOString(), decidedBy: by, note: note.trim().slice(0, 300) };
    t.update(ref, { accreditation });
    return { ...a, accreditation };
  });
}
// The "#NotesApp Certified Course" seal: staff only, recorded with who and when. Applies to certificates issued from now on.
export async function setCertified(db: Firestore, courseId: string, on: boolean, by: string, now = new Date()): Promise<void> {
  const ref = db.doc(`courses/${courseId}`);
  if (!(await ref.get()).exists) throw new AcademyError("No course has that ID.", 404);
  await ref.update({ certified: on ? { at: now.toISOString(), by } : null });
}
