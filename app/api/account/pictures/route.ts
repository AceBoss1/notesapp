import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { setting } from "@/lib/config";
import { PictureError, recordPicture, removePicture } from "@/lib/profile-pictures";

export const dynamic = "force-dynamic";

async function signedIn(req: NextRequest) {
  const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!user) throw new PictureError("Sign in first.", 401);
  return user;
}
const fail = (err: unknown) => {
  if (err instanceof PictureError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't update your pictures");
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// POST { url, previous? }: record the profile picture just set (and, the first time, the one it replaced).
export async function POST(req: NextRequest) {
  try {
    const user = await signedIn(req);
    const limited = await rateLimit(req, "pictures", user.uid, 30, 3600);
    if (limited) return limited;
    await recordPicture(getAdminDb(), user.uid, await req.json().catch(() => ({})), setting("NEXT_PUBLIC_R2_PUBLIC_URL") ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}

// DELETE ?id=: take an old picture out of your history.
export async function DELETE(req: NextRequest) {
  try {
    const user = await signedIn(req);
    const limited = await rateLimit(req, "pictures", user.uid, 30, 3600);
    if (limited) return limited;
    await removePicture(getAdminDb(), user.uid, req.nextUrl.searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}
