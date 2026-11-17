import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { AVATAR_PHOTO_MAX, AvatarError } from "@/lib/avatar-maker";
import { makePortrait } from "@/lib/avatar-maker-server";
import { cleanPortraitNote, cleanStrength, isPortraitStyle, portraitPrompt } from "@/lib/nana-portrait";
import { NO_STORE, fail, planOf, who } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// POST (Authorization: Bearer <ID token>; form: image=<file>, style=studio|editorial|journal, prompt?, intensity=30..100)
//   → { image: "data:image/…;base64,…", marked, left }. Needs a verified email. The photo is sent to the image model and not kept.
export async function POST(req: NextRequest) {
  try {
    const user = await who(req);
    if (!user) return NextResponse.json({ error: "Sign in with NotesApp first." }, { status: 401, headers: NO_STORE });
    if (!user.emailVerified) throw new AvatarError("Verify your NotesApp email before creating a portrait.", 403);
    const limited = await rateLimit(req, "portrait-make", user.uid, 20, 3600);
    if (limited) return limited;
    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!file || typeof file === "string") throw new AvatarError("Choose a photo first.");
    if (file.size > AVATAR_PHOTO_MAX) throw new AvatarError("That photo is too large. Choose one under 8 MB.");
    const style = form!.get("style");
    if (!isPortraitStyle(style)) throw new AvatarError("Pick a style first.");
    const prompt = portraitPrompt(style, cleanPortraitNote(form!.get("prompt")), cleanStrength(form!.get("intensity")));
    const plan = await planOf(user.uid);
    return NextResponse.json(await makePortrait(getAdminDb(), user.uid, Buffer.from(await file.arrayBuffer()), { prompt, paid: plan.paid }), { headers: NO_STORE });
  } catch (err) { return fail(err, "Portrait generation could not finish. Please try again."); }
}
