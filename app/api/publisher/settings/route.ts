import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { createPlan } from "@/lib/paystack";
import { LIMITS, PublisherSettings } from "@/lib/booking-time";
import { rateLimit } from "@/lib/rate-limit";

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
    const limited = rateLimit(req, "pub-settings", uid, 20, 3600);
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

    // ---- subscription ----
    const subIn = body.subscription || {};
    const subEnabled = !!subIn.enabled;
    const subPriceKobo = Math.round(Number(subIn.priceNaira) * 100);
    let planCode = existing?.subscription?.planCode;
    if (subEnabled) {
      if (!(subPriceKobo >= LIMITS.subscriptionMinKobo && subPriceKobo <= LIMITS.subscriptionMaxKobo)) {
        return NextResponse.json({ error: "Subscription price must be between ₦1,000 and ₦100,000 per month." }, { status: 400 });
      }
      if (!planCode || existing?.subscription?.priceKobo !== subPriceKobo) {
        planCode = (await createPlan({ name: `@${user.username} monthly`, amountKobo: subPriceKobo })).plan_code;
      }
    }

    const settings: PublisherSettings = {
      uid,
      username: user.username,
      session: {
        enabled: sessionEnabled,
        priceKobo: sessionEnabled ? sessionPriceKobo : existing?.session?.priceKobo ?? LIMITS.sessionMinKobo,
        minutes: sessionEnabled ? minutes : existing?.session?.minutes ?? 45,
        availability,
      },
      subscription: {
        enabled: subEnabled,
        priceKobo: subEnabled ? subPriceKobo : existing?.subscription?.priceKobo ?? LIMITS.subscriptionMinKobo,
        ...(planCode ? { planCode } : {}),
      },
      gifts: { enabled: body.gifts?.enabled !== undefined ? !!body.gifts.enabled : existing?.gifts?.enabled ?? true },
      ...(existing?.payoutReady ? { payoutReady: true } : {}),
      updatedAt: new Date().toISOString(),
    };
    await db.doc(`publisherSettings/${uid}`).set(settings);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("Publisher settings failed:", err);
    { const f = friendlyMessage(err, "Couldn't save"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
