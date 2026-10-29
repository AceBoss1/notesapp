import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getPrefs, setPrefs } from "@/lib/messages-server";
import { pushConfigured, vapidPublicKey } from "@/lib/push-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET  → { emailMessages, quickReactions, chatBackground, chatBackgroundAllowed, pushAvailable }
// POST { emailMessages?, quickReactions? (null = the default), chatBackground? (Pro and above) } → saved
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    return NextResponse.json({ ...(await getPrefs(getAdminDb(), me.uid)), pushAvailable: pushConfigured(), vapidKey: pushConfigured() ? vapidPublicKey() : null });
  } catch (err) {
    return fail(err, "Couldn't load your settings");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const body = await req.json().catch(() => ({}));
    await setPrefs(getAdminDb(), me.uid, { emailMessages: body.emailMessages, quickReactions: body.quickReactions, chatBackground: body.chatBackground });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't save your settings");
  }
}
