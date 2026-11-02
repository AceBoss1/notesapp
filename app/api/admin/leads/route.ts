import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess, verifyAdminRequest } from "@/lib/firebase-admin";
import { maskContacts } from "@/lib/pii";
import { hasDept } from "@/lib/admin-access";
import type { Lead } from "@/lib/leads";
import { LeadError, approveVolunteer, declineVolunteer, reviewersCommunityLink, seedReviewersCommunity } from "@/lib/leads-server";
import { PrepError } from "@/lib/exam-prep-server";

export const dynamic = "force-dynamic";

// Admin → Leads (app/(main)/admin/leads): the /contact form's messages, the one-month feedback (category "feedback", with its scores)
// and Naija Exam Prep reviewer sign-ups (category "volunteer"). Customer care and growth. Leads are server-only to staff browsers
// (firestore.rules), so the sender's email and phone reach the page masked (lib/pii.ts) and are shown with a reason through
// /api/admin/reveal. GET → { leads, community, can } newest first. POST { id, action }:
//   "read" | "archived" | "delete"     any lead
//   "approve" | "decline" { note? }    a volunteer: reviewer access for their subjects (needs Editorial, which runs Naija Exam Prep)
//   "seed_community" (no id)           makes the Naija Exam Prep Reviewers community once (owner and super admins; you run it)
async function staff(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["support", "growth"]).then(() => true, () => false);
}
const no = () => NextResponse.json({ error: "Customer care and growth only." }, { status: 403 });
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

export async function GET(req: NextRequest) {
  if (!(await staff(req))) return no();
  const db = getAdminDb();
  const caller = await verifyAdminAccess(bearer(req));
  const [snap, community] = await Promise.all([db.collection("leads").orderBy("createdAt", "desc").limit(500).get(), reviewersCommunityLink(db).catch(() => null)]);
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
  return NextResponse.json({
    leads: maskContacts(leads), community,
    can: { approve: hasDept(caller.access, "content"), seed: caller.access.role === "super" },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await staff(req))) return no();
  const { id, action, note } = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown; note?: unknown };
  const db = getAdminDb();
  try {
    if (action === "seed_community" || action === "approve" || action === "decline") {
      const caller = await verifyAdminAccess(bearer(req));
      const me = (await db.doc(`users/${caller.uid}`).get()).data();
      const who = { uid: caller.uid, name: String(me?.displayName || me?.username || "Admin") };
      if (action === "seed_community") {
        if (caller.access.role !== "super") return NextResponse.json({ error: "Owner and super admins only: whoever sets it up runs the community." }, { status: 403 });
        return NextResponse.json(await seedReviewersCommunity(db, caller.uid));
      }
      if (!hasDept(caller.access, "content")) return NextResponse.json({ error: "Approving reviewers is for Editorial (they run Naija Exam Prep). Ask an editor or a super admin." }, { status: 403 });
      return NextResponse.json(action === "approve" ? await approveVolunteer(db, id, who) : await declineVolunteer(db, id, who, note));
    }
    if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Which lead?" }, { status: 400 });
    const ref = db.doc(`leads/${id}`);
    if (action === "delete") await ref.delete();
    else if (action === "read" || action === "archived") await ref.update({ status: action });
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof LeadError || e instanceof PrepError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[leads]", e);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
