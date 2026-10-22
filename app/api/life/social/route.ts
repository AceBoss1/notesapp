import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { feedCard, playsNotesLife, setLifePrivacy } from "@/lib/life/social-server";
import { lifePrivacyOf } from "@/lib/life/social";

export const dynamic = "force-dynamic";
// Notes Life on the rest of NotesApp (lib/life/social.ts):
//   GET ?feed=1            → the feed card for this viewer (signed out: the card without the friends line)
//   GET ?uid=<uid>         → { plays } whether this viewer may see that member plays Notes Life (both follow each other, theirs on)
//   GET ?privacy=1         → my two switches; POST { lifeShow?, lifeCard? } → change them (teen mode keeps both off)
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const ok = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
const fail = (e: unknown) => { const f = friendlyMessage(e, "Something went wrong"); return NextResponse.json({ error: f.message }, { status: f.status }); };

export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("feed")) return ok(await feedCard(db, uid));
    if (q.get("privacy")) { if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 }); return ok(lifePrivacyOf((await db.doc(`users/${uid}`).get()).data())); }
    const target = String(q.get("uid") ?? "").replace(/\//g, "").slice(0, 128);
    if (target) {
      const limited = await rateLimit(req, "life-plays", uid ?? "anon", 120, 600);
      if (limited) return limited;
      return ok(await playsNotesLife(db, uid, target));
    }
    return NextResponse.json({ error: "Nothing asked." }, { status: 400 });
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return ok(await setLifePrivacy(getAdminDb(), uid, { lifeShow: b.lifeShow, lifeCard: b.lifeCard }));
  } catch (e) { return fail(e); }
}
