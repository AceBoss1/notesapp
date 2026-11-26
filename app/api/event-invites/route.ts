import { NextRequest, NextResponse } from "next/server";
import { checkReply } from "@/lib/content-checks-reply";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { invitesConfig } from "@/lib/pricing";
import { INVITE_PACKS } from "@/lib/event-invites";
import { InviteError, inviteWeek, sendInvites } from "@/lib/event-invites-server";

export const dynamic = "force-dynamic";

// Invitations to an event or meeting (lib/event-invites.ts). GET → this week (allowance, sent, left, followers, pack). POST { kind, id,
// followers?: true, emails?: "a@b.ng, c@d.ng", message? } → { invited, notInvited, skipped, left }.
async function who(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
}
export async function GET(req: NextRequest) {
  const uid = await who(req);
  if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await ensurePricing();
  const c = invitesConfig();
  return NextResponse.json({ ...(await inviteWeek(getAdminDb(), uid)), packs: INVITE_PACKS.map((p) => ({ id: p.id, sends: p.sends, priceKobo: c[p.priceKey] })) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  try {
    const uid = await who(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "event-invites", uid, 20, 3600);
    if (limited) return limited;
    await ensurePricing();
    return NextResponse.json(await sendInvites(getAdminDb(), uid, await req.json().catch(() => ({}))));
  } catch (err) {
    const cc = checkReply(err);
    if (cc) return cc;
    if (err instanceof InviteError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't send the invitations");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
