import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { closeJob, deleteJob, firmBoard, inviteToApply, postJob, setApplicationStatus, suggestedCandidates, updateJob } from "@/lib/jobs-server";
import { JobsError } from "@/lib/jobs";
import { jobsFail, signedIn } from "@/lib/jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The organisations a member can post jobs for: their own organisation account, and those they're an admin of.
async function firmsOf(uid: string) {
  const db = getAdminDb();
  const out: { uid: string; name: string; username: string; verified: boolean }[] = [];
  const me = (await db.doc(`users/${uid}`).get()).data();
  if (me?.accountKind === "organisation") out.push({ uid, name: String(me.displayName || me.username), username: String(me.username), verified: me.org?.rcStatus === "verified" });
  const rows = await db.collection("orgMembers").where("memberUid", "==", uid).get();
  for (const r of rows.docs.filter((d) => d.data().role === "admin")) {
    const o = (await db.doc(`users/${r.data().orgUid}`).get()).data();
    if (o) out.push({ uid: String(r.data().orgUid), name: String(o.displayName || o.username), username: String(o.username), verified: o.org?.rcStatus === "verified" });
  }
  return out;
}

// GET ?org=<uid>: the firm's jobs and applications (and whether matching is on); without org, the organisations you can post for.
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req, false);
    const org = req.nextUrl.searchParams.get("org");
    if (!org) return NextResponse.json({ firms: await firmsOf(me.uid) });
    return NextResponse.json(await firmBoard(getAdminDb(), me, org));
  } catch (err) {
    return jobsFail(err, "Couldn't load your jobs");
  }
}

// POST { action: "post" | "update" | "close" | "delete" | "appStatus" | "suggested" | "invite", … }
export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const limited = await rateLimit(req, "jobs-manage", me.uid, 120, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    switch (b.action) {
      case "post": return NextResponse.json({ job: await postJob(db, me, b.org, b.job ?? {}) });
      case "update": return NextResponse.json({ job: await updateJob(db, me, b.id, b.job ?? {}) });
      case "close": await closeJob(db, me, b.id); return NextResponse.json({ ok: true });
      case "delete": return NextResponse.json({ ok: true, ...(await deleteJob(db, me, b.id)) });
      case "appStatus": await setApplicationStatus(db, me, b.id, b.status); return NextResponse.json({ ok: true });
      case "suggested": return NextResponse.json({ candidates: await suggestedCandidates(db, me, b.id) });
      case "invite": await inviteToApply(db, me, b.id, b.uid); return NextResponse.json({ ok: true });
      default: throw new JobsError("Unknown action.");
    }
  } catch (err) {
    return jobsFail(err, "Couldn't do that");
  }
}
