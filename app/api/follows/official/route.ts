import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isOwnerEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { FollowError, naFollowing, setNaFollow } from "@/lib/follows-server";

export const dynamic = "force-dynamic";

// The accounts @na-notesapp follows, managed by the owner alone. Anyone else gets { owner: false } and nothing more.
async function owner(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  return me && me.emailVerified && isOwnerEmail(me.email) ? me : null;
}

// GET → { owner, following: ["ify", …] }
export async function GET(req: NextRequest) {
  try {
    if (!(await owner(req))) return NextResponse.json({ owner: false });
    return NextResponse.json({ owner: true, following: await naFollowing(getAdminDb()) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// POST { username, follow: boolean } → follow or unfollow as @na-notesapp
export async function POST(req: NextRequest) {
  try {
    if (!(await owner(req))) return NextResponse.json({ error: "Only the account owner can do this." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const r = await setNaFollow(getAdminDb(), String(body.username ?? ""), body.follow !== false);
    return NextResponse.json({ ok: true, username: r.username, following: body.follow !== false });
  } catch (err) {
    if (err instanceof FollowError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
