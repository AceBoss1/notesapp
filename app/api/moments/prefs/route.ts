import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getMomentPrefs, setMomentPrefs } from "@/lib/moments-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → { momentsPublic }   POST { momentsPublic: boolean } → saved. Off (the default): only your followers see your moments.
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "moments");
    return NextResponse.json(await getMomentPrefs(getAdminDb(), me.uid));
  } catch (err) {
    return fail(err, "Couldn't load your settings");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "moments", true);
    const body = await req.json().catch(() => ({}));
    await setMomentPrefs(getAdminDb(), me.uid, body.momentsPublic);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't save your settings");
  }
}
