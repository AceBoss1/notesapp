import { SITE_URL } from "@/lib/host";

// Notes Academy certificates (docs/COURSES.md, "Certificates"): pure and shared by the pages and the server.
//
//   academies/{ownerUid}  → the teacher's one-time setup (who issues, who signs, an accrediting institution, their margin)
//   certificates/{id}     → an issued certificate: a snapshot of everything printed on it, so later edits never change it
// Both are written only by the server. A learner who finishes a free course pays our part (Admin → Pricing → certificate minimum)
// plus the teacher's margin; after the grace days a late claim fee is added (lib/pricing.ts certificatePrice).

export type Accreditation = {
  name: string; logoUrl: string; proof: string;
  status: "pending" | "approved" | "rejected"; submittedAt: string; decidedAt?: string; decidedBy?: string; note?: string;
};
export type Academy = {
  ownerUid: string; name: string; subtext: string; website: string; logoUrl: string;
  signerName: string; signerTitle: string; signatureUrl: string;
  marginKobo: number; accreditation: Accreditation | null; updatedAt: string;
};
// What's printed on a certificate. The accrediting institution only appears once #NotesApp has approved it; "certified" is set by
// our team per course (Admin → Academy).
export type CertificateFace = {
  academyName: string; subtext: string; website: string; logoUrl: string;
  signerName: string; signerTitle: string; signatureUrl: string;
  accreditation: { name: string; logoUrl: string } | null; certified: boolean;
  learnerName: string; courseTitle: string; hours: number; completedAt: string; issuedAt: string; id: string;
};
export type Certificate = CertificateFace & {
  uid: string; courseId: string; courseSlug: string; ownerUid: string; paymentRef: string;
  status: "valid" | "revoked"; revokedAt?: string; revokeReason?: string;
};

export const NAME_MAX = 80, SUBTEXT_MAX = 120, TITLE_MAX = 80, PROOF_MAX = 500;
export const MARGIN_MAX_KOBO = 10_000_000 * 100; // no ceiling by policy; this only catches a typo
export const LEARNER_NAME_MAX = 70;

// NA-C- and eight characters people can read out loud: no I, L, O or U (Crockford's alphabet).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function newCertificateId(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `NA-C-${s}`;
}
export const isCertificateId = (v: unknown): v is string => typeof v === "string" && /^NA-C-[0-9A-HJKMNP-TV-Z]{8}$/.test(v);
// What people type: lower case, spaces, the letters people confuse with digits.
export const normaliseCertificateId = (v: string) => {
  const s = v.trim().toUpperCase().replace(/\s+/g, "").replace(/^NAC-?|^NA-?C-?/, "");
  return `NA-C-${s.replace(/[IL]/g, "1").replace(/O/g, "0").replace(/-/g, "")}`;
};

export const hoursOf = (minutes: number) => Math.max(1, Math.round(minutes / 60));

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const httpsUrl = (v: unknown) => {
  const s = clean(v, 300);
  if (!s) return "";
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return u.protocol === "https:" || u.protocol === "http:" ? u.toString().replace(/\/$/, "") : ""; } catch { return ""; }
};
export class AcademyError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// The setup form (app/(main)/academy/setup). Images must already be uploaded to our bucket (their public address is checked by the
// server); the accreditation goes back to "pending" whenever its name, logo or proof changes.
export type SetupInput = {
  name?: unknown; subtext?: unknown; website?: unknown; logoUrl?: unknown; signerName?: unknown; signerTitle?: unknown; signatureUrl?: unknown;
  marginNaira?: unknown; accreditation?: { name?: unknown; logoUrl?: unknown; proof?: unknown } | null;
};
export function cleanSetup(i: SetupInput, ours: (url: string) => boolean): Omit<Academy, "ownerUid" | "updatedAt" | "accreditation"> & { accreditation: { name: string; logoUrl: string; proof: string } | null } {
  const name = clean(i.name, NAME_MAX);
  if (name.length < 2) throw new AcademyError("Give your academy or institution a name.");
  const img = (v: unknown, what: string) => { const u = clean(v, 500); if (u && !ours(u)) throw new AcademyError(`Upload the ${what} again.`); return u; };
  const margin = Math.round(Number(i.marginNaira ?? 0) * 100);
  if (!Number.isFinite(margin) || margin < 0 || margin > MARGIN_MAX_KOBO) throw new AcademyError("Enter your margin in naira (0 or more).");
  const a = i.accreditation;
  const acc = a && (clean(a.name, NAME_MAX) || clean(a.logoUrl, 500)) ? { name: clean(a.name, NAME_MAX), logoUrl: img(a.logoUrl, "accrediting institution's logo"), proof: clean(a.proof, PROOF_MAX) } : null;
  if (acc && (acc.name.length < 2 || !acc.logoUrl || acc.proof.length < 5)) throw new AcademyError("For an accrediting institution, add its name, its logo and the proof (a link or a short note).");
  return {
    name, subtext: clean(i.subtext, SUBTEXT_MAX), website: httpsUrl(i.website), logoUrl: img(i.logoUrl, "logo"),
    signerName: clean(i.signerName, NAME_MAX), signerTitle: clean(i.signerTitle, TITLE_MAX), signatureUrl: img(i.signatureUrl, "signature"),
    marginKobo: margin, accreditation: acc,
  };
}

// Courses by our own team carry the Notes Academy logo (top centre, and faintly behind the text); a staff teacher who hasn't set up
// an academy issues as Notes Academy.
export const NOTES_ACADEMY_LOGO = "/images/academy/notes-academy-logo.png";
export const STAFF_ROLES = ["admin", "staff"];
// Under the signature on our team's courses (until they set their own in Your academy): who they are at Notes Academy.
const STAFF_TITLES: Record<string, string> = { emmanuel: "Founder/Dean, Notes Academy" };
const academyUrl = () => `${SITE_URL}/academy`;
export const NOTES_ACADEMY_SUBTEXT = "Learn from people who've done it";
// Where a staff teacher's setup starts (Your academy), so saving it keeps our branding.
export const staffDefaults = (username: string) => ({ name: "Notes Academy", subtext: NOTES_ACADEMY_SUBTEXT, logoUrl: NOTES_ACADEMY_LOGO, signerTitle: STAFF_TITLES[username] ?? "Notes Academy", website: academyUrl() });
// Only our team may issue as Notes Academy or #NotesApp, or use the Notes Academy logo.
export const reservedAcademyName = (name: string) => /notes\s*academy|notes\s*app/i.test(name);

// The face for a course whose teacher hasn't set up yet: their own name issues and signs it.
export function faceFor(
  academy: Academy | null, course: { title: string; minutes: number; ownerName: string; ownerUsername?: string; certified?: unknown; staff?: boolean },
  learner: { name: string; completedAt: string }, issue: { id: string; issuedAt: string },
): CertificateFace {
  const acc = academy?.accreditation?.status === "approved" ? { name: academy.accreditation.name, logoUrl: academy.accreditation.logoUrl } : null;
  return {
    academyName: academy?.name || (course.staff ? "Notes Academy" : course.ownerName),
    subtext: academy ? academy.subtext : course.staff ? NOTES_ACADEMY_SUBTEXT : "",
    website: academy?.website || (course.staff ? academyUrl() : ""),
    logoUrl: academy?.logoUrl || (course.staff ? NOTES_ACADEMY_LOGO : ""),
    signerName: academy?.signerName || course.ownerName,
    signerTitle: academy?.signerTitle || (course.staff ? STAFF_TITLES[course.ownerUsername ?? ""] ?? "Notes Academy" : ""), signatureUrl: academy?.signatureUrl ?? "",
    accreditation: acc, certified: !!course.certified,
    learnerName: learner.name, courseTitle: course.title, hours: hoursOf(course.minutes), completedAt: learner.completedAt, issuedAt: issue.issuedAt, id: issue.id,
  };
}

export const cleanLearnerName = (v: unknown) => {
  const s = clean(v, LEARNER_NAME_MAX);
  if (s.length < 2) throw new AcademyError("Type your name as it should appear on the certificate.");
  return s;
};

// The teacher's share of a certificate sale: their margin, plus the same share of any late claim fee (the fee is a percentage of the
// whole price, so it grows with their part of it). Our commission comes off this, as on any sale.
export function teacherGross(startKobo: number, marginKobo: number, lateKobo: number): number {
  if (startKobo <= 0 || marginKobo <= 0) return 0;
  return marginKobo + Math.round((lateKobo * marginKobo) / startKobo);
}

// LinkedIn's "Add licence or certification" link, prefilled.
export function linkedInAddUrl(c: Pick<CertificateFace, "courseTitle" | "academyName" | "issuedAt" | "id">, verifyUrl: string): string {
  const d = new Date(c.issuedAt);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME", name: c.courseTitle, organizationName: c.academyName,
    issueYear: String(d.getUTCFullYear()), issueMonth: String(d.getUTCMonth() + 1), certUrl: verifyUrl, certId: c.id,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}

export const certificateDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Only what's printed: what the pages may hand to the browser (never the payment reference).
export const faceOnly = (c: CertificateFace): CertificateFace => ({
  academyName: c.academyName, subtext: c.subtext, website: c.website, logoUrl: c.logoUrl, signerName: c.signerName, signerTitle: c.signerTitle,
  signatureUrl: c.signatureUrl, accreditation: c.accreditation, certified: c.certified, learnerName: c.learnerName, courseTitle: c.courseTitle,
  hours: c.hours, completedAt: c.completedAt, issuedAt: c.issuedAt, id: c.id,
});
