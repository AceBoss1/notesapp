import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MomentError, deleteMoment, listViewers, recordView, replyToMoment, reshare, toggleLike } from "@/lib/moments-server";
import { authed, fail, momentDeps } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// POST { action: "like" | "view" | "reshare" | "reply", text? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const me = await authed(req, "moments", action !== "view");
    const limited = rateLimit(req, "moment-act", me.uid, 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    if (action === "like") return NextResponse.json(await toggleLike(db, me.uid, params.id));
    if (action === "view") { await recordView(db, me.uid, params.id); return NextResponse.json({ ok: true }); }
    if (action === "reshare") return NextResponse.json({ moment: await reshare(db, me, params.id, momentDeps) });
    if (action === "reply") return NextResponse.json(await replyToMoment(db, me.uid, params.id, String(body.text ?? "")));
    throw new MomentError(400, "Unknown action.");
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "moments", true);
    await deleteMoment(getAdminDb(), me.uid, params.id, momentDeps);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't delete the moment");
  }
}

// GET → who has seen this moment (the owner only)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "moments");
    return NextResponse.json({ viewers: await listViewers(getAdminDb(), me.uid, params.id) });
  } catch (err) {
    return fail(err, "Couldn't load the viewers");
  }
}
