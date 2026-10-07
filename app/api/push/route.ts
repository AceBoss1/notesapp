import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { pushConfigured, removeSubscription, saveSubscription, validSubscription } from "@/lib/push-server";
import { authed, fail } from "@/lib/moments-api";
import { MomentError } from "@/lib/moments-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Turning notifications on or off for one browser or phone.
// POST   { subscription } → saved for this member
// DELETE { endpoint }     → forgotten
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    if (!pushConfigured()) throw new MomentError(503, "Notifications aren't switched on yet.");
    const body = await req.json().catch(() => ({}));
    if (!validSubscription(body.subscription)) throw new MomentError(400, "That device can't receive notifications.");
    await saveSubscription(getAdminDb(), me.uid, body.subscription, req.headers.get("user-agent") || "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't turn notifications on");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const body = await req.json().catch(() => ({}));
    await removeSubscription(getAdminDb(), me.uid, String(body.endpoint ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't turn notifications off");
  }
}
