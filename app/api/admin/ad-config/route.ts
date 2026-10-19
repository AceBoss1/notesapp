import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { readAdConfig, saveAdConfig } from "@/lib/ad-config-server";

export const dynamic = "force-dynamic";

// Admin → Ads: the advert and boost numbers (how many boosts show at once, how long boosts and adverts stay, the digest's
// sponsored slots, which spots are on). Growth admins. GET → the current numbers; PUT { …AdConfig } → saved and returned.
async function admin(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["growth"]);
}

export async function GET(req: NextRequest) {
  try { await admin(req); } catch { return NextResponse.json({ error: "Growth admins only." }, { status: 403 }); }
  return NextResponse.json({ config: await readAdConfig(getAdminDb()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Growth admins only." }, { status: 403 }); }
  const body = await req.json().catch(() => null);
  return NextResponse.json({ config: await saveAdConfig(getAdminDb(), body, uid) });
}
