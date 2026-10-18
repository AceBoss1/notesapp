// Certificates' rules (lib/certificates.ts): IDs, the setup form's checks, what's printed, the teacher's share and the LinkedIn link.
// Run: npm run test:certificates → "ALL OK".
import assert from "node:assert/strict";
import { AcademyError, cleanLearnerName, cleanSetup, faceFor, isCertificateId, linkedInAddUrl, newCertificateId, normaliseCertificateId, teacherGross, type Academy } from "../../lib/certificates";

// IDs: NA-C- and eight characters without I, L, O or U; typed IDs are tidied.
for (let i = 0; i < 200; i++) assert.ok(isCertificateId(newCertificateId()));
assert.equal(newCertificateId(() => 0), "NA-C-00000000");
assert.equal(isCertificateId("NA-C-7K2M9QXD"), true); assert.equal(isCertificateId("NA-C-7K2M9QXI"), false); assert.equal(isCertificateId("NA-C-7K2"), false);
assert.equal(normaliseCertificateId(" na-c-7k2m9qxd "), "NA-C-7K2M9QXD");
assert.equal(normaliseCertificateId("NA C 7K2M 9QXD"), "NA-C-7K2M9QXD");
assert.equal(normaliseCertificateId("7K2M9QXD"), "NA-C-7K2M9QXD");
assert.equal(normaliseCertificateId("NA-C-7K2M9QXO"), "NA-C-7K2M9QX0", "an O typed for a zero");

// Setup: a name; images only from our bucket; a margin of 0 or more (no ceiling but a typo guard); accreditation all or nothing.
const ours = (u: string) => u.startsWith("https://cdn.x/academy/");
const base = { name: "LWB Academy", subtext: "Living Without Borders", website: "www.lwb.org", logoUrl: "https://cdn.x/academy/u/logo.png", signerName: "Emmanuela", signerTitle: "Founder", signatureUrl: "", marginNaira: 500 };
const c = cleanSetup(base, ours);
assert.equal(c.website, "https://www.lwb.org"); assert.equal(c.marginKobo, 50_000); assert.equal(c.accreditation, null);
assert.throws(() => cleanSetup({ ...base, name: "L" }, ours), AcademyError);
assert.throws(() => cleanSetup({ ...base, logoUrl: "https://evil.example/logo.png" }, ours), /Upload the logo again/);
assert.throws(() => cleanSetup({ ...base, marginNaira: -1 }, ours), AcademyError);
assert.equal(cleanSetup({ ...base, marginNaira: 2_000_000 }, ours).marginKobo, 200_000_000, "no maximum margin");
assert.throws(() => cleanSetup({ ...base, accreditation: { name: "Lagos Business School", logoUrl: "", proof: "" } }, ours), /accrediting institution/);
assert.deepEqual(cleanSetup({ ...base, accreditation: { name: "LBS", logoUrl: "https://cdn.x/academy/u/lbs.png", proof: "https://lbs.edu/partners" } }, ours).accreditation, { name: "LBS", logoUrl: "https://cdn.x/academy/u/lbs.png", proof: "https://lbs.edu/partners" });
assert.equal(cleanSetup({ ...base, accreditation: { name: "", logoUrl: "", proof: "" } }, ours).accreditation, null, "an empty section is no accreditation");
assert.equal(cleanLearnerName("  Ada   Okoye "), "Ada Okoye"); assert.throws(() => cleanLearnerName("A"), AcademyError);

// What's printed: the teacher's name stands in until they set up; an accreditation only once approved.
const course = { title: "AI & Automation", minutes: 24 * 60 + 20, ownerName: "Tola Bello", certified: { at: "x", by: "y" } };
const f0 = faceFor(null, course, { name: "Ada Okoye", completedAt: "2026-10-17T10:00:00Z" }, { id: "NA-C-7K2M9QXD", issuedAt: "2026-10-18T10:00:00Z" });
assert.equal(f0.academyName, "Tola Bello"); assert.equal(f0.signerName, "Tola Bello"); assert.equal(f0.hours, 24); assert.equal(f0.certified, true);
const academy: Academy = { ownerUid: "u", ...c, accreditation: { name: "LBS", logoUrl: "l", proof: "p", status: "pending", submittedAt: "" }, updatedAt: "" };
assert.equal(faceFor(academy, course, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).accreditation, null, "not until approved");
assert.deepEqual(faceFor({ ...academy, accreditation: { ...academy.accreditation!, status: "approved" } }, course, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).accreditation, { name: "LBS", logoUrl: "l" });
assert.equal(faceFor(academy, { ...course, certified: null }, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).certified, false);
const staffFace = faceFor(null, { ...course, staff: true }, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" });
assert.equal(staffFace.academyName, "Notes Academy"); assert.equal(staffFace.signerTitle, "Notes Academy"); assert.equal(staffFace.subtext, "Learn from people who've done it"); assert.match(staffFace.website, /\/academy$/);
assert.equal(faceFor(null, { ...course, staff: true, ownerUsername: "emmanuel" }, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).signerTitle, "Founder/Dean, Notes Academy"); assert.equal(staffFace.logoUrl, "/images/academy/notes-academy-logo.png", "our team's courses carry the Notes Academy logo");
assert.equal(faceFor(academy, { ...course, staff: true }, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).academyName, "LWB Academy", "a staff teacher's own academy still wins");
assert.equal(faceFor(academy, { ...course, minutes: 10 }, { name: "A B", completedAt: "" }, { id: "", issuedAt: "" }).hours, 1, "at least an hour");

// The teacher's share: their margin, and the same share of any late claim fee.
assert.equal(teacherGross(149_900, 50_000, 0), 50_000);
assert.equal(teacherGross(149_900, 50_000, 1_500), 50_000 + Math.round(1_500 * 50_000 / 149_900));
assert.equal(teacherGross(99_900, 0, 1_000), 0, "no margin, no share");

// LinkedIn's prefilled "Add licence or certification".
const li = new URL(linkedInAddUrl({ courseTitle: "AI & Automation", academyName: "LWB Academy", issuedAt: "2026-10-18T10:00:00Z", id: "NA-C-7K2M9QXD" }, "https://www.notesapp.name.ng/certificates/NA-C-7K2M9QXD"));
assert.equal(li.hostname, "www.linkedin.com"); assert.equal(li.searchParams.get("name"), "AI & Automation"); assert.equal(li.searchParams.get("issueMonth"), "10");
assert.equal(li.searchParams.get("certId"), "NA-C-7K2M9QXD"); assert.equal(li.searchParams.get("certUrl"), "https://www.notesapp.name.ng/certificates/NA-C-7K2M9QXD");
console.log("ALL OK");
