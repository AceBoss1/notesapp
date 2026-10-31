import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest, verifySignedInRequest } from "@/lib/firebase-admin";
import { DiscountError, NOTESAPP_OWNER } from "@/lib/discounts";
import { listCodes, recentUses, saveCode, setCodeActive } from "@/lib/discounts-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// A member's own discount codes (for their shop, downloads, courses and sessions), or #NotesApp's own (owner=notesapp: staff in
// Growth or Finance). Who used a code is never shown; only how often, when and for how much.
//   GET  ?owner=notesapp            → { codes, uses }
//   POST { owner?, action: "save", ...code } | { owner?, action: "active", code, active }
async function ownerFor(req: NextRequest, wanted: unknown): Promise<{ owner: string; actor: string }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (wanted === NOTESAPP_OWNER) {
    const uid = await verifyAdminRequest(token, ["growth", "finance"]).catch(() => null);
    if (!uid) throw new DiscountError(403, "#NotesApp's codes are for Growth and Finance staff.");
    return { owner: NOTESAPP_OWNER, actor: uid };
  }
  const me = await verifySignedInRequest(token).catch(() => null);
  if (!me) throw new DiscountError(401, "Sign in first.");
  if (!me.emailVerified) throw new DiscountError(403, "Verify your email first.");
  return { owner: me.uid, actor: me.uid };
}

const fail = (e: unknown) => {
  if (e instanceof DiscountError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("discounts", e);
  return NextResponse.json({ error: "Couldn't do that. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    const { owner } = await ownerFor(req, req.nextUrl.searchParams.get("owner"));
    const db = getAdminDb();
    const [codes, uses, username] = await Promise.all([listCodes(db, owner), recentUses(db, owner),
      owner === "notesapp" ? Promise.resolve("") : db.doc(`users/${owner}`).get().then((d) => String(d.data()?.username ?? ""))]);
    return NextResponse.json({ codes, uses, username }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { owner, actor } = await ownerFor(req, body.owner);
    const limited = await rateLimit(req, "discounts", actor, 60, 600);
    if (limited) return limited;
    const db = getAdminDb();
    if (body.action === "active") {
      await setCodeActive(db, owner, String(body.code ?? ""), body.active === true);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "save") return NextResponse.json({ code: await saveCode(db, owner, actor, body) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}
