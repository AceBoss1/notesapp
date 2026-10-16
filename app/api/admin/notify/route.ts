import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { moderationMessage } from "@/lib/moderation-messages";

export const dynamic = "force-dynamic";

// POST { uid, kind } — the bell after a moderation action an admin took in the browser (lib/moderation.ts). The message is built
// here from what is stored (the suspension, the role, the tier request), so it always says what really happened.
//   kind: "suspended" | "unsuspended" | "appeal_rejected" | "role_changed" | "tier_decision"
export async function POST(req: NextRequest) {
  try { await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")); }
  catch { return NextResponse.json({ error: "Admins only." }, { status: 403 }); }
  const { uid, kind } = (await req.json().catch(() => ({}))) as { uid?: unknown; kind?: unknown };
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return NextResponse.json({ error: "Who?" }, { status: 400 });
  const db = getAdminDb();
  const [u, s] = await Promise.all([db.doc(`users/${uid}`).get().then((d) => d.data()), db.doc(`suspensions/${uid}`).get().then((d) => d.data())]);
  if (!u) return NextResponse.json({ error: "That member wasn't found." }, { status: 404 });
  const profile = `/u/${String(u.username ?? "")}`;
  let note: { type: string; message: string; linkHref: string } | null = null;
  if (kind === "suspended" && u.suspended === true && s) note = { type: "suspended", message: moderationMessage.suspended(String(s.reason ?? ""), s.until), linkHref: profile };
  else if (kind === "unsuspended" && u.suspended !== true) note = { type: "unsuspended", message: moderationMessage.unsuspended(s?.appealStatus === "upheld"), linkHref: profile };
  else if (kind === "appeal_rejected" && s?.appealStatus === "rejected") note = { type: "appeal_rejected", message: moderationMessage.appealRejected(), linkHref: profile };
  else if (kind === "role_changed" && typeof u.role === "string") note = { type: "role_changed", message: moderationMessage.roleChanged(u.role), linkHref: profile };
  else if (kind === "tier_decision" && (u.tierRequest?.status === "approved" || u.tierRequest?.status === "rejected")) {
    const ok = u.tierRequest.status === "approved";
    note = { type: "role_changed", message: moderationMessage.tierDecision(ok), linkHref: ok ? "/profile/publishing" : profile };
  }
  if (!note) return NextResponse.json({ error: "Nothing to tell them: that change isn't saved." }, { status: 409 });
  await db.collection("notifications").add({ recipientUid: uid, ...note, read: false, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
