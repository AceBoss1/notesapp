import { NextRequest, NextResponse } from "next/server";
import { CART_MAX_LINES } from "@/lib/cart";
import { basketDelivery } from "@/lib/cart-server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NIGERIAN_STATES } from "@/lib/merch";
import { currentPricing } from "@/lib/pricing";
import { itemKg } from "@/lib/logistics";
import { LogisticsError, accessOf, listProviders, partnerOf, partnerQuote, providerDoc, saveProfile, setPartner, startTrial, type ProviderDoc } from "@/lib/logistics-server";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// What stores see of a provider: its listing without the rate card's internals (they see a sample of prices).
const publicView = (d: ProviderDoc) => ({
  uid: d.uid, username: d.username, name: d.name, avatar: d.avatar, about: d.about, areas: d.areas, coverage: d.coverage, services: d.services,
  base: d.rateCard.base, from: { city: d.rateCard.prices.city[0], national: d.rateCard.prices.national[0] }, sameDay: d.rateCard.sameDayKobo > 0,
});

// GET ?view=network[&state=Lagos]   → { providers }: the network, optionally only those covering a state (anyone may look)
// GET ?view=me                      → { access, profile, partner, price, trialDays }: the signed-in member as a provider and as a store
// GET ?view=basket&items=… → a basket's delivery. GET ?view=quote&seller=uid&itemId=…&qty=…&city=…&state=… → { carrier | null }: what the store's partner charges for this delivery
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const db = getAdminDb();
    const view = q.get("view") || "network";
    if (view === "network") {
      const limited = await rateLimit(req, "logistics-network", clientIp(req), 60, 60);
      if (limited) return limited;
      const state = q.get("state") || "";
      if (state && !NIGERIAN_STATES.includes(state)) return NextResponse.json({ error: "Choose a state." }, { status: 400 });
      return NextResponse.json({ providers: (await listProviders(db, state || undefined)).map(publicView) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (view === "quote") {
      const limited = await rateLimit(req, "logistics-quote", clientIp(req), 60, 60);
      if (limited) return limited;
      const item = (await db.doc(`storeItems/${String(q.get("itemId") || "")}`).get()).data();
      const qty = Math.max(1, Math.min(99, Math.floor(Number(q.get("qty")) || 1)));
      const state = String(q.get("state") || ""), city = String(q.get("city") || "").trim();
      if (!item || item.kind === "digital") return NextResponse.json({ carrier: null });
      if (!NIGERIAN_STATES.includes(state)) return NextResponse.json({ carrier: null, partner: await partnerOf(db, item.ownerUid) });
      const c = await partnerQuote(db, item.ownerUid, { city, state }, itemKg(item.weightKg) * qty);
      // The buyer sees the partner and the fee, never our commission (that comes out of the partner's earnings).
      return NextResponse.json({ carrier: c ? { name: c.name, username: c.username, feeKobo: c.feeKobo } : null, partner: await partnerOf(db, item.ownerUid) });
    }
    // A basket's delivery (lib/cart-server.ts): ?view=basket&items=id:qty,id:qty&city=…&state=… → { deliveryKobo, carrier | null }
    if (view === "basket") {
      const limited = await rateLimit(req, "logistics-quote", clientIp(req), 60, 60);
      if (limited) return limited;
      const pairs = String(q.get("items") || "").split(",").slice(0, CART_MAX_LINES).map((x) => x.split(":")).filter(([id]) => /^[A-Za-z0-9_-]{1,64}$/.test(id ?? ""));
      const snaps = pairs.length ? await db.getAll(...pairs.map(([id]) => db.doc(`storeItems/${id}`))) : [];
      const lines = snaps.map((d, i) => ({ item: d.data() ?? {}, quantity: Math.max(1, Math.min(99, Math.floor(Number(pairs[i][1])) || 1)), owner: d.data()?.ownerUid as string | undefined })).filter((l) => l.owner && l.item.kind !== "digital");
      const state = String(q.get("state") || ""), city = String(q.get("city") || "").trim();
      if (!lines.length || lines.some((l) => l.owner !== lines[0].owner)) return NextResponse.json({ deliveryKobo: 0, carrier: null });
      const covered = NIGERIAN_STATES.includes(state);
      const { deliveryKobo, carrier } = await basketDelivery(db, lines[0].owner!, lines, covered ? { city, state } : { city: "", state: "" });
      return NextResponse.json({ deliveryKobo, carrier: carrier && covered ? { name: carrier.name, username: carrier.username, feeKobo: carrier.feeKobo } : null });
    }
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const p = (await db.doc(`users/${me.uid}`).get()).data() as UserProfile | undefined;
    if (!p) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const l = currentPricing().logistics;
    return NextResponse.json({
      access: await accessOf(db, p), profile: await providerDoc(db, me.uid), partner: await partnerOf(db, me.uid),
      price: l.addonMonthlyKobo, trialDays: l.trialDays, tier: p.accountTier ?? "standard",
      payouts: !!(await db.doc(`payoutAccounts/${me.uid}`).get()).data()?.recipientCode,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof LogisticsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load the logistics network");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// POST { action: "save_profile", profile, providerUid? } → { profile }
// POST { action: "start_trial" } → { access }
// POST { action: "set_partner", providerUid | null, storeUid? } → { partner }
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "logistics", me.uid, 60, 3600);
    if (limited) return limited;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (body.action === "save_profile") return NextResponse.json({ profile: await saveProfile(db, me.uid, String(body.providerUid || me.uid), body.profile) });
    if (body.action === "start_trial") return NextResponse.json({ access: await startTrial(db, me.uid) });
    if (body.action === "set_partner") return NextResponse.json({ partner: await setPartner(db, me.uid, String(body.storeUid || me.uid), body.providerUid ? String(body.providerUid) : null) });
    throw new LogisticsError("Unknown action.");
  } catch (err) {
    if (err instanceof LogisticsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the logistics network");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
