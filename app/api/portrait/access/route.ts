import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { avatarStatus } from "@/lib/avatar-maker-server";
import type { PortraitAccess } from "@/lib/nana-portrait";
import { NO_STORE, fail, planOf, who } from "../shared";

export const dynamic = "force-dynamic";

// GET (Authorization: Bearer <ID token>) → PortraitAccess: the member's plan (paid plans get no mark), whether they may make portraits
// now (the avatar maker's gate: the #NotesApp team on the staff test pass until it opens), whether an image model is set up, and how
// many are left today.
export async function GET(req: NextRequest) {
  try {
    const user = await who(req);
    if (!user) return NextResponse.json({ error: "Sign in with NotesApp first." }, { status: 401, headers: NO_STORE });
    const limited = await rateLimit(req, "portrait-read", user.uid, 120, 600);
    if (limited) return limited;
    const [status, plan] = await Promise.all([avatarStatus(getAdminDb(), user.uid), planOf(user.uid)]);
    const out: PortraitAccess = {
      signedIn: true, open: status.open, ready: status.ready, paid: plan.paid, tier: plan.name, limit: status.limit, left: status.left,
      ...(status.closed ? { closed: status.closed.replace("Nana's avatar maker", "Nana AI") } : {}),
    };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) { return fail(err, "Couldn't load your NotesApp plan"); }
}
