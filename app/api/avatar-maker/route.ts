import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { AVATAR_PHOTO_MAX, AvatarError } from "@/lib/avatar-maker";
import { avatarStatus, makeAvatar } from "@/lib/avatar-maker-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Nana's avatar maker (lib/avatar-maker-server.ts), for the signed-in member's own profile picture.
// GET → { open, ready, limit, used, left, closed? }: whether this member may use it now and how many are left today.
// POST (form: photo=<file>) → { url, left }: the illustrated avatar, marked "Made with Nana AI", in the media bucket. The member then
// saves it as their picture on Edit profile, like an upload.
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (err: unknown, fallback: string) => {
  if (err instanceof AvatarError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const who = (req: NextRequest) => verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);

export async function GET(req: NextRequest) {
  try {
    const user = await who(req);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "avatar-read", user.uid, 120, 600);
    if (limited) return limited;
    return NextResponse.json(await avatarStatus(getAdminDb(), user.uid), { headers: NO_STORE });
  } catch (err) { return fail(err, "Couldn't load the avatar maker"); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await who(req);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "avatar-make", user.uid, 20, 3600);
    if (limited) return limited;
    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!file || typeof file === "string") throw new AvatarError("Choose a photo first.");
    if (file.size > AVATAR_PHOTO_MAX) throw new AvatarError("That photo is too large. Choose one under 8 MB.");
    return NextResponse.json(await makeAvatar(getAdminDb(), user.uid, Buffer.from(await file.arrayBuffer())), { headers: NO_STORE });
  } catch (err) { return fail(err, "Couldn't make the avatar"); }
}
