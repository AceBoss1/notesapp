import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { createPlan } from "@/lib/paystack";
import { LIMITS, PublisherSettings } from "@/lib/booking-time";
import { rateLimit } from "@/lib/rate-limit";
import { SUB_TIERS, TIER_NAME, tierOffers, tierRangeKobo, type TierOffer } from "@/lib/fans";
import { getFanSettings } from "@/lib/fans-server";
import { getRoomSettings } from "@/lib/rooms-server";
import { cleanDiscountPct } from "@/lib/live-tickets";
import { PpmError, savePpmOffer } from "@/lib/ppm-server";

const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Saves a publisher's own session rate / availability / subscription
// price. Validation happens HERE (limits can't be trusted from the
// browser). A new Paystack plan is created whenever the subscription
// price changes; existing subscribers stay on their old plan.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const uid = await verifyPublisherRequest(idToken).catch(() => null);
    if (!uid) return NextResponse.json({ error: "Only publishing accounts can set rates." }, { status: 403 });
    const limited = await rateLimit(req, "pub-settings", uid, 20, 3600);
    if (limited) return limited;

    const body = await req.json();
    const db = getAdminDb();
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (!user?.username) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const existing = (await db.doc(`publisherSettings/${uid}`).get()).data() as PublisherSettings | undefined;

    // ---- session ----
    const sIn = body.session || {};
    const sessionPriceKobo = Math.round(Number(sIn.priceNaira) * 100);
    const minutes = Number(sIn.minutes);
    const availability: Record<string, string[]> = {};
    for (let d = 0; d < 7; d++) {
      const slots: unknown = sIn.availability?.[String(d)] ?? [];
      if (Array.isArray(slots) && slots.length > LIMITS.maxSlotsPerDay) {
        return NextResponse.json({ error: `Too many times on one day (max ${LIMITS.maxSlotsPerDay}).` }, { status: 400 });
      }
      if (!Array.isArray(slots) || !slots.every((x) => typeof x === "string" && SLOT_RE.test(x))) {
        return NextResponse.json({ error: "Invalid availability." }, { status: 400 });
      }
      availability[String(d)] = Array.from(new Set(slots as string[])).sort();
    }
    const sessionEnabled = !!sIn.enabled;
    // Pay-per-minute sessions (lib/ppm.ts) use the same weekly times.
    const ppmOn = body.ppm?.enabled === true;
    if (ppmOn && !Object.values(availability).some((a) => a.length)) {
      return NextResponse.json({ error: "Pay-per-minute sessions: add at least one available time." }, { status: 400 });
    }
    if (sessionEnabled) {
      if (!(sessionPriceKobo >= LIMITS.sessionMinKobo && sessionPriceKobo <= LIMITS.sessionMaxKobo)) {
        return NextResponse.json({ error: "Session price must be between ₦5,000 and ₦500,000." }, { status: 400 });
      }
      if (!LIMITS.sessionMinutes.includes(minutes)) {
        return NextResponse.json({ error: "Invalid session length." }, { status: 400 });
      }
      if (!Object.values(availability).some((a) => a.length)) {
        return NextResponse.json({ error: "Add at least one available time." }, { status: 400 });
      }
    }

    // ---- subscription: three tiers (lib/fans.ts), each priced within its range from Admin → Limits ----
    // A form from before tiers sends one price: it is Premium. A new Paystack plan is made for a tier whose price changed; existing
    // subscribers stay on their old plan (their tier is on their subscription record).
    const subIn = body.subscription || {};
    const fanCfg = await getFanSettings(db);
    const before = tierOffers(existing?.subscription);
    // Each tier's paid-live ticket discount (lib/live-tickets.ts), 0 up to Admin's cap; a form without it keeps what was saved.
    const discountCap = (await getRoomSettings(db)).liveDiscountMaxPct;
    const tiersIn: Record<string, { enabled?: unknown; priceNaira?: unknown; liveDiscountPct?: unknown }> = subIn.tiers && typeof subIn.tiers === "object"
      ? subIn.tiers
      : { premium: { enabled: subIn.enabled, priceNaira: subIn.priceNaira }, vip: before.vip.enabled ? { enabled: true, priceNaira: before.vip.priceKobo / 100 } : { enabled: false }, vvip: before.vvip.enabled ? { enabled: true, priceNaira: before.vvip.priceKobo / 100 } : { enabled: false } };
    const tiers = {} as Record<(typeof SUB_TIERS)[number], TierOffer>;
    for (const t of SUB_TIERS) {
      const tin = tiersIn[t] ?? {};
      const on = !!tin.enabled;
      const priceKobo = on ? Math.round(Number(tin.priceNaira) * 100) : before[t].priceKobo;
      const { minKobo, maxKobo } = tierRangeKobo(t, fanCfg);
      if (on && !(priceKobo >= minKobo && priceKobo <= maxKobo)) {
        return NextResponse.json({ error: `${TIER_NAME[t]} must be between ₦${(minKobo / 100).toLocaleString("en-NG")} and ₦${(maxKobo / 100).toLocaleString("en-NG")} per month.` }, { status: 400 });
      }
      let planCode = before[t].planCode;
      if (on && (!planCode || before[t].priceKobo !== priceKobo)) {
        planCode = (await createPlan({ name: `@${user.username} ${TIER_NAME[t]} monthly`, amountKobo: priceKobo })).plan_code;
      }
      const rawPct = tin.liveDiscountPct;
      if (rawPct !== undefined && rawPct !== "" && rawPct !== null) {
        const n = Number(rawPct);
        if (!Number.isFinite(n) || n < 0 || n > discountCap) return NextResponse.json({ error: `${TIER_NAME[t]}: a paid-live discount from 0% to ${discountCap}%.` }, { status: 400 });
      }
      const liveDiscountPct = rawPct === undefined ? before[t].liveDiscountPct ?? 0 : cleanDiscountPct(rawPct, discountCap);
      tiers[t] = { enabled: on, priceKobo: priceKobo || minKobo, ...(planCode ? { planCode } : {}), ...(liveDiscountPct > 0 ? { liveDiscountPct } : {}) };
    }
    const subEnabled = tiers.premium.enabled || tiers.vip.enabled || tiers.vvip.enabled;
    const subPriceKobo = tiers.premium.priceKobo;
    const planCode = tiers.premium.planCode;

    const settings: PublisherSettings = {
      uid,
      username: user.username,
      session: {
        enabled: sessionEnabled,
        priceKobo: sessionEnabled ? sessionPriceKobo : existing?.session?.priceKobo ?? LIMITS.sessionMinKobo,
        minutes: sessionEnabled ? minutes : existing?.session?.minutes ?? 45,
        availability,
      },
      // enabled/priceKobo/planCode mirror Premium for older readers; tiers is the source of truth.
      subscription: {
        enabled: subEnabled,
        priceKobo: subPriceKobo || LIMITS.subscriptionMinKobo,
        ...(planCode ? { planCode } : {}),
        tiers,
      },
      fansHidden: body.fans?.hidden !== undefined ? !!body.fans.hidden : existing?.fansHidden === true,
      gifts: { enabled: body.gifts?.enabled !== undefined ? !!body.gifts.enabled : existing?.gifts?.enabled ?? true },
      ...(existing?.payoutReady ? { payoutReady: true } : {}),
      updatedAt: new Date().toISOString(),
    };
    // Pay-per-minute prices and who may book (ppmOffers/{uid}); checked before anything is saved.
    if (body.ppm !== undefined) {
      try { await savePpmOffer(db, uid, body.ppm); }
      catch (e) { if (e instanceof PpmError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
    }
    await db.doc(`publisherSettings/${uid}`).set(settings);
    // Ad opt-in is a public flag on the profile so pages can decide whether to
    // show ads without reading private settings. Only paid tiers can choose.
    if (body.shop?.listed !== undefined) await db.doc(`users/${uid}`).update({ shopListed: !!body.shop.listed });
    if (body.ads?.optIn !== undefined && ["pro", "business", "enterprise"].includes(user.accountTier)) {
      await db.doc(`users/${uid}`).update({ adsOptIn: !!body.ads.optIn });
    }
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("Publisher settings failed:", err);
    { const f = friendlyMessage(err, "Couldn't save"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
