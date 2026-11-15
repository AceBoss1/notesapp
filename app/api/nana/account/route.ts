import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { ensurePricing } from "@/lib/pricing-server";
import { nanaStatus } from "@/lib/nana-meter";
import { aiStatus } from "@/lib/ai-connect";
import { liteConfigured } from "@/lib/nana-lite-server";

export const dynamic = "force-dynamic";

// GET → the signed-in member's Nana standing (lib/nana-meter.ts): their plan's gems and efforts, this period's allowance and what's
// left, when it refreshes, their Nana credit, and the credit packs on sale. ownKey: true when they use their own AI account (not metered).
// lite: true when Nana Lite (our free small model) can be chosen in the picker.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const d = token ? await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null) : null;
  if (!d) return NextResponse.json({ error: "Sign in to see your Nana allowance." }, { status: 401 });
  await ensurePricing();
  const db = getAdminDb();
  const [status, ai] = await Promise.all([nanaStatus(db, d.uid, new Date()), aiStatus(db, d.uid).catch(() => ({ connected: false }))]);
  return NextResponse.json({ ...status, ownKey: !!ai.connected, lite: liteConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
