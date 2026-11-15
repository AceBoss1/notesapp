import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { deleteCv, reviewCv, saveCv } from "@/lib/nana-jobs-server";
import { liveDeps, me, njFail, noStore } from "@/lib/nana-jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// Longer than the CV review's own wait for the member's AI (AI_TIMEOUT_MS.cv in lib/ai-providers.ts), so a slow AI gets our message,
// not the platform's bare timeout page (the "Something went wrong" of 15 Nov 2026).
export const maxDuration = 120;

// Your CV. The browser reads the PDF or Word file and sends only the text. POST { text, fileName? } keeps it (encrypted) and has the
// member's own AI review it; POST { again: true } reviews the saved one again; DELETE removes the CV and its review.
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const limited = await rateLimit(req, "nana-jobs-cv", uid, 10, 86400);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    return NextResponse.json(b.again === true ? await reviewCv(db, uid, liveDeps()) : await saveCv(db, uid, b, liveDeps()), noStore);
  } catch (err) { return njFail(err, "Couldn't read your CV"); }
}
export async function DELETE(req: NextRequest) {
  try { await deleteCv(getAdminDb(), await me(req)); return NextResponse.json({ ok: true }); }
  catch (err) { return njFail(err, "Couldn't delete it"); }
}
