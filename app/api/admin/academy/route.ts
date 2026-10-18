import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasAnyDept } from "@/lib/admin-access";
import { AcademyError, normaliseCertificateId } from "@/lib/certificates";
import { certificateOf, decideAccreditation, pendingAccreditations, revokeCertificate, setCertified } from "@/lib/certificates-server";
import { notifyBell } from "@/lib/email";

export const dynamic = "force-dynamic";

// Admin → Academy (app/(main)/admin/academy): accreditations waiting for a decision, the "#NotesApp Certified Course" seal per course,
// and finding or revoking a certificate. Content and moderation staff.
// GET → { pending, courses }   GET ?id=NA-C-… → { certificate }
// POST { action: "accreditation", ownerUid, approve, note } | { action: "certified", courseId, on } | { action: "revoke", id, reason }
async function staff(req: NextRequest) {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (!hasAnyDept(a.access, ["content", "moderation"])) throw new AcademyError("Content and moderation staff only.", 403);
  return a;
}
const fail = (e: unknown) => NextResponse.json({ error: e instanceof AcademyError ? e.message : "Staff only." }, { status: e instanceof AcademyError ? e.status : 403 });

export async function GET(req: NextRequest) {
  try { await staff(req); } catch (e) { return fail(e); }
  const db = getAdminDb();
  const id = req.nextUrl.searchParams.get("id");
  if (id !== null) return NextResponse.json({ certificate: await certificateOf(db, normaliseCertificateId(id)) }, { headers: { "Cache-Control": "no-store" } });
  const [pending, courses] = await Promise.all([
    pendingAccreditations(db),
    db.collection("courses").where("status", "==", "published").limit(300).get(),
  ]);
  const owners = await Promise.all(pending.map((a) => db.doc(`users/${a.ownerUid}`).get()));
  return NextResponse.json({
    pending: pending.map((a, i) => ({ ...a, ownerUsername: String(owners[i].data()?.username ?? "") })),
    courses: courses.docs.map((d) => ({ id: d.id, title: String(d.data().title ?? ""), slug: String(d.data().slug ?? ""), ownerName: String(d.data().ownerName ?? ""), enrolCount: Number(d.data().enrolCount) || 0, certified: d.data().certified ?? null }))
      .sort((a, b) => b.enrolCount - a.enrolCount),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let who: Awaited<ReturnType<typeof staff>>;
  try { who = await staff(req); } catch (e) { return fail(e); }
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getAdminDb();
  try {
    if (b.action === "accreditation") {
      const a = await decideAccreditation(db, String(b.ownerUid ?? ""), b.approve === true, String(b.note ?? ""), who.email);
      await notifyBell({ uid: a.ownerUid, type: "plan", linkHref: "/academy/teach/setup", message: b.approve === true ? `${a.accreditation!.name} now shows on your certificates.` : `We couldn't add ${a.accreditation!.name} to your certificates: ${a.accreditation!.note}` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "certified") { await setCertified(db, String(b.courseId ?? ""), b.on === true, who.email); return NextResponse.json({ ok: true }); }
    if (b.action === "revoke") {
      const id = normaliseCertificateId(String(b.id ?? ""));
      await revokeCertificate(db, id, String(b.reason ?? ""), who.email);
      return NextResponse.json({ certificate: await certificateOf(db, id) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof AcademyError) return fail(e);
    console.error("[admin academy]", e);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
}
