import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { CommunityError } from "@/lib/community-server";
import { communityGifts, myGifts, setGiving } from "@/lib/giving-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const ok = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

// Community giving (lib/giving-server.ts). Paying a gift is /api/paystack/initialize with kind "giving".
//   GET            → { gifts }: my receipts
//   GET ?cid=      → the community's gifts and totals per fund (its admins)
//   POST { action: "settings", cid, enabled, funds } (admins)
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const cid = req.nextUrl.searchParams.get("cid");
    if (cid) return ok(await communityGifts(getAdminDb(), uid, cid));
    return ok({ gifts: await myGifts(getAdminDb(), uid) });
  } catch (err) {
    return fail(err, "Couldn't load giving");
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "giving", uid, 60, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (b.action === "settings") return ok({ giving: await setGiving(getAdminDb(), uid, String(b.cid ?? ""), b) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't save");
  }
}
