import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getFanSettings } from "@/lib/fans-server";

export const dynamic = "force-dynamic";

// GET → the tier price ranges and the VIP/VVIP commission shares in force (Admin → Limits → Subscriptions and fans), for the creator's
// settings form and the subscribe sheet. Nothing private.
export async function GET() {
  const s = await getFanSettings(getAdminDb()).catch(() => null);
  return NextResponse.json({ settings: s }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
}
