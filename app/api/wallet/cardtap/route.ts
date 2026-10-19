import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { callbackOrigin } from "@/lib/origin";
import { CardtapError, cardtapConfig, cardtapReady, checkCardtap, startCardtap } from "@/lib/cardtap-topup-server";

export const dynamic = "force-dynamic";

// Wallet top-ups with Paylony CardTap (lib/cardtap-topup-server.ts), for the signed-in member.
// GET → { ready, feeWaived } (whether to offer it, and the launch offer); GET ?ref= → { status: paid | waiting | failed, … }
// POST { amountNaira } → the code for the CardTap app, what they pay (top-up + Paylony's fee, unless it's waived) and the bonus.
async function member(req: NextRequest) {
  return verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
}
const fail = (e: unknown) => e instanceof CardtapError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : (console.error("[cardtap]", e), NextResponse.json({ error: "Couldn't reach CardTap. Try again in a moment." }, { status: 502 }));

export async function GET(req: NextRequest) {
  const me = await member(req);
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const ref = req.nextUrl.searchParams.get("ref");
  const db = getAdminDb();
  if (!ref) return NextResponse.json({ ready: cardtapReady(), feeWaived: (await cardtapConfig(db)).feeWaived }, { headers: { "Cache-Control": "no-store" } });
  const limited = await rateLimit(req, "cardtap-check", me.uid, 40, 60); // the page asks every few seconds
  if (limited) return limited;
  try { return NextResponse.json(await checkCardtap(db, ref.slice(0, 80), me.uid), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const me = await member(req);
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!me.emailVerified) return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
  const limited = await rateLimit(req, "cardtap-start", me.uid, 6, 600);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { amountNaira?: unknown };
  try { return NextResponse.json(await startCardtap(getAdminDb(), { uid: me.uid, email: me.email }, body.amountNaira, await callbackOrigin(req))); }
  catch (e) { return fail(e); }
}
