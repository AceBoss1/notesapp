import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getFanSettings, saveFanSettings } from "@/lib/fans-server";
import { FanSettingsError } from "@/lib/fans";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin → Limits → Subscriptions and fans (lib/fans.ts FAN_SETTINGS): GET → { fans }; POST { fans } saves the tier price ranges (naira)
// and the VIP/VVIP commission shares. The finance team decides these with product, so either may change them.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["product", "finance"]);
    return NextResponse.json({ fans: await getFanSettings(getAdminDb(), 0) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the subscription settings");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req), ["product", "finance"]);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ fans: await saveFanSettings(getAdminDb(), body.fans, admin) });
  } catch (err) {
    if (err instanceof FanSettingsError) return NextResponse.json({ error: err.message }, { status: 400 });
    const f = friendlyMessage(err, "Couldn't save the subscription settings");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
