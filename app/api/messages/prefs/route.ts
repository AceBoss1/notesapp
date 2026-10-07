import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getPrefs, setPrefs } from "@/lib/messages-server";
import { pushConfigured } from "@/lib/push-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET  → { emailMessages, pushAvailable }   POST { emailMessages } → saved
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    return NextResponse.json({ ...(await getPrefs(getAdminDb(), me.uid)), pushAvailable: pushConfigured(), vapidKey: pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null });
  } catch (err) {
    return fail(err, "Couldn't load your settings");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const body = await req.json().catch(() => ({}));
    await setPrefs(getAdminDb(), me.uid, { emailMessages: body.emailMessages });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't save your settings");
  }
}
