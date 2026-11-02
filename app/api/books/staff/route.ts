import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { BooksError } from "@/lib/books-server";
import { answerStaffInvite, leaveBooks, myStaffInvites, staffInvite } from "@/lib/books-staff-server";

// The invited member's side of Business books staff (lib/books-staff-server.ts). The seller's side is /api/books (staffInvite, …).
// GET ?id=<inviteId> → the invitation (to the member it's for, or the seller who sent it); GET → my waiting invitations.
// POST { action: "accept" | "decline", id } → { ok, owner }; POST { action: "leave", owner } → { ok }.
export const dynamic = "force-dynamic";
const fail = (err: unknown) => {
  if (err instanceof BooksError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't do that");
  return NextResponse.json({ error: f.message }, { status: f.status });
};
async function who(req: NextRequest) { return verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null); }

export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const id = req.nextUrl.searchParams.get("id");
    const db = getAdminDb();
    return NextResponse.json(id ? await staffInvite(db, me.uid, id) : { invites: await myStaffInvites(db, me.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err); }
}
export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const l = await rateLimit(req, "books-staff-answer", me.uid, 30, 600);
    if (l) return l;
    await ensurePricing();
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "accept" || b.action === "decline") return NextResponse.json(await answerStaffInvite(db, me.uid, String(b.id ?? ""), b.action === "accept"));
    if (b.action === "leave") { await leaveBooks(db, me.uid, String(b.owner ?? "")); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) { return fail(err); }
}
