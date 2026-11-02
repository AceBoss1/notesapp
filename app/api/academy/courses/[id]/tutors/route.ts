import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { changeTutor, inviteTutor, removeTutor, respondTutor } from "@/lib/courses-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

// A course's co-tutors.
// POST { action: "invite", username, percent, access: "view" | "edit" } → { invite }: the lead invites a member (their access, and their
//   share of each sale; the lead keeps the rest).
// POST { action: "change", uid, access, percent } → { applied, proposed }: the lead changes a co-tutor's terms (less access applies now;
//   more access or a new share waits for them to agree).
// POST { action: "accept", agree: true, termsVersion, seen: { access, percent } } | { action: "decline" } → { ok }: the invited member
//   answers on /invites/course/<id> (also a change the lead proposed).
// POST { action: "remove", uid } → { ok }: the lead removes a co-tutor or withdraws an invitation; a co-tutor removes themselves to leave.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-tutors", uid, 40, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "invite") return NextResponse.json({ invite: await inviteTutor(db, uid, params.id, b) });
    if (b.action === "change") return NextResponse.json(await changeTutor(db, uid, params.id, b));
    if (b.action === "accept" || b.action === "decline") {
      await respondTutor(db, uid, params.id, { accept: b.action === "accept", agree: b.agree, termsVersion: b.termsVersion, seen: b.seen, userAgent: req.headers.get("user-agent") ?? undefined });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "remove") { await removeTutor(db, uid, params.id, String(b.uid ?? "")); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Invite, accept, decline or remove?" }, { status: 400 });
  } catch (err) {
    return academyError(err, "Couldn't change the tutors");
  }
}
