import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SiteNanaError } from "@/lib/site-nana";
import { answerQuestion, applySetup, editDraft, makeDraft, nanaRead, putBack, redoPart, restartSetup, setupView, siteReview, useRewrite } from "@/lib/site-nana-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Nana sets up your site, and Review my site (lib/site-nana-server.ts, docs/SITE_NANA.md), for a signed-in member with a site.
//   GET                → the setup: questions, answers, Nana's draft, what will change, whether the site before can be put back
//   GET ?review=1      → the checklist (free, no Nana)
//   POST { action: "answer", q, text | skip } · { action: "restart" } · { action: "draft" } (Nana) · { action: "redo", part } (Nana)
//        { action: "edit", draft } · { action: "apply", replace } · { action: "putback" }
//        { action: "read" } (Nana's read of the site) · { action: "rewrite", field, text } (use one of her lines)
const NO_STORE = { "Cache-Control": "no-store, private" };

async function signedIn(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!me) throw new SiteNanaError("Sign in first.", 401);
  return me;
}
function fail(err: unknown, fallback: string) {
  if (err instanceof SiteNanaError) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const limited = await rateLimit(req, "site-nana", me.uid, 300, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const out = req.nextUrl.searchParams.get("review") ? await siteReview(db, me.uid) : await setupView(db, me.uid);
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) { return fail(err, "Couldn't open that"); }
}

export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ai = b.action === "draft" || b.action === "redo" || b.action === "read";
    const limited = await rateLimit(req, ai ? "site-nana-ai" : "site-nana", me.uid, ai ? 30 : 300, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    let out: unknown;
    switch (b.action) {
      case "answer": out = await answerQuestion(db, me.uid, b); break;
      case "restart": out = await restartSetup(db, me.uid); break;
      case "draft": out = await makeDraft(db, me.uid); break;
      case "redo": out = await redoPart(db, me.uid, b.part); break;
      case "edit": out = await editDraft(db, me.uid, b.draft); break;
      case "apply": out = await applySetup(db, me.uid, b.replace); break;
      case "putback": out = await putBack(db, me.uid); break;
      case "read": out = await nanaRead(db, me.uid); break;
      case "rewrite": out = await useRewrite(db, me.uid, b.field, b.text); break;
      default: throw new SiteNanaError("Unknown action.");
    }
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) { return fail(err, "Couldn't do that"); }
}
