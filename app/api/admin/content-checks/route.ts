import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasAnyDept, isSuper } from "@/lib/admin-access";
import { ContentAdminError, adminOverview, legalStep, reviewFlag, saveCheckSettings } from "@/lib/content-checks-server";

export const dynamic = "force-dynamic";

// Admin → Reports → Content checks (Trust & safety; the Legal team also sees the child-safety queue).
// GET → { today, week, waitingRecheck, queue, legal, settings }
// POST { action: "restore" | "keep", id, note? } · { action: "settings", settings } (super admins) · { action: "legal", id, step: "reported" | "keep" | "not_csam", reference? } (Legal)
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
async function who(req: NextRequest) {
  const a = await verifyAdminAccess(bearer(req));
  const legal = isSuper(a.access) || hasAnyDept(a.access, ["legal"]);
  if (!legal && !hasAnyDept(a.access, ["moderation"])) throw new ContentAdminError(403, "Your role doesn't include this area");
  return { uid: a.uid, legal, super: isSuper(a.access) };
}
const fail = (err: unknown, what: string) => {
  if (err instanceof ContentAdminError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET(req: NextRequest) {
  try {
    const a = await who(req);
    return NextResponse.json({ ...(await adminOverview(getAdminDb(), { legal: a.legal })), canEditSettings: a.super, legalTeam: a.legal }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err, "Couldn't load content checks"); }
}

export async function POST(req: NextRequest) {
  try {
    const a = await who(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (b.action === "settings") {
      if (!a.super) throw new ContentAdminError(403, "Only super admins change these figures.");
      return NextResponse.json({ settings: await saveCheckSettings(db, b.settings, a.uid) });
    }
    if (b.action === "legal") {
      if (!a.legal) throw new ContentAdminError(403, "Only the Legal team decides child-safety items.");
      await legalStep(db, a.uid, String(b.id ?? ""), b.step, b.reference);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "restore" || b.action === "keep") {
      await reviewFlag(db, a.uid, String(b.id ?? ""), b.action, b.note, { legal: a.legal });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) { return fail(err, "Couldn't do that"); }
}
