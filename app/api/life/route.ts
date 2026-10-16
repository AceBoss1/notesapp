import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { LIFE_LIVE } from "@/lib/life/catalog";
import { LifeError, act, friends, invites, mutate, richList, statement, view, type Action } from "@/lib/life/server";
import { awardReferral } from "@/lib/life/referral";

export const dynamic = "force-dynamic";

// Notes Life. GET → your player (created the first time, with N$ 100,000); ?view=rich|friends|tx for the Billionaires List, your
// friends who follow you back, or your Notesville Naira statement. POST { action, ... } (see lib/life/server.ts) → your player after it.
async function who(req: NextRequest) {
  if (!LIFE_LIVE) throw new LifeError(404, "Notes Life isn't open yet.");
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!me) throw new LifeError(401, "Sign in with your NotesApp account to play.");
  return me;
}
function fail(err: unknown) {
  if (err instanceof LifeError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Notes Life couldn't do that");
  return NextResponse.json({ error: f.message }, { status: f.status });
}

export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "life-get", me.uid, 60, 60);
    if (limited) return limited;
    const db = getAdminDb();
    const v = req.nextUrl.searchParams.get("view");
    if (v === "rich") return NextResponse.json(await richList(db, me.uid, 20, req.nextUrl.searchParams.get("real") === "1"));
    if (v === "friends") return NextResponse.json(await friends(db, me.uid));
    if (v === "tx") return NextResponse.json(await statement(db, me.uid));
    if (v === "invites") return NextResponse.json(await invites(db, me.uid));
    // ?ref=<username>: the friend who invited you, kept only if this is your first time and they play Notes Life themselves.
    const ref = (req.nextUrl.searchParams.get("ref") || "").trim().toLowerCase().replace(/^@/, "");
    let inviter = /^[a-z0-9_.-]{2,30}$/.test(ref) ? String((await db.doc(`usernames/${ref}`).get()).data()?.uid ?? "") || null : null;
    if (inviter && !(await db.doc(`lifePlayers/${inviter}`).get()).exists) inviter = null;
    const { player } = await mutate(db, me.uid, () => null, Date.now(), inviter);
    return NextResponse.json({ player: view(player) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "life-act", me.uid, 90, 60);
    if (limited) return limited;
    const body = (await req.json().catch(() => ({}))) as Action;
    const db = getAdminDb();
    const { player, result } = await act(db, me.uid, body);
    const r = result as { referral?: string | null };
    let referral: string | null = null;
    if (r?.referral) referral = await awardReferral(db, me.uid, r.referral).catch((e) => { console.error("referral bonus failed", e); return null; });
    return NextResponse.json({ player: view(player), result: referral ? { ...result, referralBonus: referral } : result });
  } catch (err) {
    return fail(err);
  }
}
