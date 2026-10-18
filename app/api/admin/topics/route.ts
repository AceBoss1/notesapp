import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { hasAnyDept } from "@/lib/admin-access";
import { SubtopicError, adminList, adminRemove, adminRename, isKind } from "@/lib/subtopics-server";

export const dynamic = "force-dynamic";

// Admin → Topics: the subtopics and subcategories members have created (newest first), to rename or remove. Content and moderation staff.
// GET → { rows }   POST { action: "rename", kind, parent, slug, label } | { action: "remove", kind, parent, slug }
async function staff(req: NextRequest) {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (!hasAnyDept(a.access, ["content", "moderation"])) throw new SubtopicError("Content and moderation staff only.", 403);
}
const fail = (e: unknown) => NextResponse.json({ error: e instanceof SubtopicError ? e.message : "Staff only." }, { status: e instanceof SubtopicError ? e.status : 403 });

export async function GET(req: NextRequest) {
  try { await staff(req); return NextResponse.json({ rows: await adminList(getAdminDb()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    await staff(req);
    const b = await req.json().catch(() => ({}));
    if (!isKind(b.kind) || typeof b.parent !== "string" || typeof b.slug !== "string") throw new SubtopicError("Which one?");
    if (b.action === "rename") await adminRename(getAdminDb(), b.kind, b.parent, b.slug, b.label);
    else if (b.action === "remove") await adminRemove(getAdminDb(), b.kind, b.parent, b.slug);
    else throw new SubtopicError("Unknown action.");
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
