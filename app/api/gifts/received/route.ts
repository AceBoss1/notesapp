import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { loadLivePricing } from "@/lib/pricing-server";
import { GiftEarningsError, receivedGifts, setArchived, withdrawDoneText, withdrawGifts } from "@/lib/gift-earnings-server";
import { releaseLedgerEntry } from "@/lib/payouts";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const fail = (err: unknown, fallback: string) => {
  if (err instanceof GiftEarningsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// GET ?username= → a member's received gifts (lib/gift-earnings-server.ts): the gifts with count and value, the archived ones, their gift
// points and this week's place; for the member themselves also what is ready to withdraw, what is in review and their withdrawals.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "gifts-received", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    await loadLivePricing();
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const me = token ? await verifySignedInRequest(token).catch(() => null) : null;
    const view = await receivedGifts(getAdminDb(), me ? { uid: me.uid } : null, (req.nextUrl.searchParams.get("username") ?? "").replace(/^@/, ""));
    if (!view) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the gifts");
  }
}

// POST { action: "archive" | "unarchive", key } or { action: "withdraw" }, for your own gifts. A withdrawal under the line is sent at
// once through the usual payout (and again by the scheduled payouts if that fails); from the line up it waits for Admin → Payments.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const limited = await rateLimit(req, "gifts-received-post", me.uid, 20, 600);
    if (limited) return limited;
    if (!me.emailVerified) return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
    const db = getAdminDb();
    const u = (await db.doc(`users/${me.uid}`).get()).data();
    if (!u || u.suspended === true) return NextResponse.json({ error: "Your account can't do that right now." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.action === "archive" || body.action === "unarchive") {
      await setArchived(db, me.uid, body.key, body.action === "archive");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "withdraw") {
      await loadLivePricing(); // the withdrawal line in force
      const r = await withdrawGifts(db, me.uid);
      let transferStatus: string | null = null;
      if (r.route === "auto") {
        const sent = await releaseLedgerEntry(r.id).catch((e) => { console.error("[gifts] withdrawal will be retried", r.id, e); return null; });
        if (sent?.ok) {
          transferStatus = sent.transferStatus;
          await db.doc(`ledger/${r.id}`).update({ autoReleasedAt: new Date().toISOString() }).catch(() => {});
        }
      }
      return NextResponse.json({ ok: true, ...r, transferStatus, message: withdrawDoneText(r) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
