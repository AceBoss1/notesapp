import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { slotLockId, initializeTransaction, newReference } from "@/lib/paystack";
import { PaymentRecord } from "@/lib/payments";
import { loadPublisher } from "@/lib/publishers";
import { weekdayOf } from "@/lib/booking-time";
import { LEGAL_VERSION } from "@/lib/legal";
import { GIFT_MAX_KOBO, GIFT_MESSAGE_MAX, GIFT_MIN_KOBO, getBoostPackage } from "@/lib/boost-config";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { getTierPlanCode, getBadgePlanCode, getGoldPlanCode } from "@/lib/tier-billing";
import { GOLD_PRICING, isGoldKind, isGoldTrack } from "@/lib/gold";
import { getAdPackage } from "@/lib/ad-packages";
import { isPlacement } from "@/lib/ads";
import { r2PublicUrl } from "@/lib/r2";
import { getMerchItem, LOGO_OPTIONS, MERCH_BATCH, MERCH_DELIVERY_KOBO, MERCH_MAX_QTY, merchBatchOpen, validateAddress } from "@/lib/merch";
import { TIERS, badgeIncluded, physicalCommissionRateFor } from "@/lib/tiers";
import { STORE_ITEM_MAX_KOBO, STORE_MAX_QTY } from "@/lib/orders";
import { RESERVATION_MINUTES, StockError, releaseExpiredReservations, reserveStock, returnStock } from "@/lib/orders-server";
import type { AccountTier } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";

// Starts a Paystack checkout for a 1:1 session or a monthly journal
// subscription. Price, slots and plan all come from the publisher's
// server-side settings — the client only says who/what/when.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Your account needs an email to pay." }, { status: 400 });

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verify your email first — use the banner at the top of the page to resend the link." },
        { status: 403 }
      );
    }

    const limited = rateLimit(req, "pay-init", user.uid, 10, 600);
    if (limited) return limited;
    const payer = (await getAdminDb().doc(`users/${user.uid}`).get()).data();
    if (payer?.consent?.version !== LEGAL_VERSION) {
      return NextResponse.json(
        { error: "Please accept the Terms of Service and Privacy Policy first.", code: "consent_required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { kind, username } = body;
    const db = getAdminDb();

    // ---- verified badge add-on (₦999/month) ----
    if (kind === "badge") {
      const me = (await db.doc(`users/${user.uid}`).get()).data();
      if (!me || me.suspended === true) return NextResponse.json({ error: "This account can't buy a badge." }, { status: 403 });
      if (badgeIncluded((me.accountTier as string as any) || "standard") || ["admin", "staff", "volunteer"].includes(me.role)) {
        return NextResponse.json({ error: "Your account already includes the verified badge." }, { status: 409 });
      }
      const cur = (await db.doc(`badgeSubscriptions/${user.uid}`).get()).data();
      if (cur && cur.status !== "expired" && new Date(cur.currentPeriodEnd).getTime() > Date.now() - 3 * 86_400_000) {
        return NextResponse.json({ error: "You already have an active verified badge." }, { status: 409 });
      }
      const { planCode, amountKobo } = await getBadgePlanCode();
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const tx = await initializeTransaction({
        plan: planCode, email: user.email, amountKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "badge", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        badge: { planCode }, createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- advertiser campaign (self-serve banner ads; reviewed before going live) ----
    if (kind === "ad") {
      const pk = getAdPackage(body.packageId);
      if (!pk) return NextResponse.json({ error: "Choose a package." }, { status: 400 });
      const advertiserName = String(body.advertiserName || "").trim().slice(0, 80);
      const title = String(body.title || "").trim().slice(0, 90);
      const text = String(body.text || "").trim().slice(0, 180);
      const href = String(body.href || "").trim().slice(0, 500);
      const image = String(body.image || "").trim().slice(0, 500);
      if (advertiserName.length < 2) return NextResponse.json({ error: "Enter your business or advertiser name." }, { status: 400 });
      if (title.length < 3) return NextResponse.json({ error: "Add a headline." }, { status: 400 });
      if (!/^https:\/\/[^\s]+$/i.test(href)) return NextResponse.json({ error: "The ad link must start with https://" }, { status: 400 });
      // Images must be ones we host (uploaded through the campaign form).
      if (image && !image.startsWith(r2PublicUrl("ads/"))) return NextResponse.json({ error: "Upload the ad image through the form." }, { status: 400 });
      const placements = Array.isArray(body.placements) ? Array.from(new Set(body.placements.filter(isPlacement))) : [];
      if (placements.length === 0) return NextResponse.json({ error: "Pick at least one placement." }, { status: 400 });
      if (body.agreed !== true) return NextResponse.json({ error: "Please confirm you've read the advertising rules." }, { status: 400 });
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const tx = await initializeTransaction({
        email: user.email, amountKobo: pk.priceKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, packageId: pk.id, uid: user.uid },
      });
      const now = new Date().toISOString();
      await db.doc(`adCampaigns/${reference}`).set({
        id: reference, uid: user.uid, email: user.email, advertiserName, packageId: pk.id, packageName: pk.name,
        impressionsBudget: pk.impressions, windowDays: pk.windowDays, amountKobo: pk.priceKobo, placements,
        creative: { title, text, image, href }, status: "awaiting_payment", createdAt: now,
      });
      const record: PaymentRecord = {
        reference, kind: "ad", uid: user.uid, email: user.email, amountKobo: pk.priceKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        ad: { campaignId: reference, packageId: pk.id }, createdAt: now,
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- official merch pre-order (price, delivery and batch all server-side) ----
    // ---- physical goods from a publisher's store (money held until delivery) ----
    if (kind === "store") {
      const itemSnap = await db.doc(`storeItems/${String(body.itemId)}`).get();
      const item = itemSnap.data();
      if (!item || item.sellable !== true || !Number.isInteger(item.priceKobo)) return NextResponse.json({ error: "This item isn't for sale here." }, { status: 404 });
      if (item.ownerUid === user.uid) return NextResponse.json({ error: "You can't buy your own item." }, { status: 409 });
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > STORE_MAX_QTY) {
        return NextResponse.json({ error: `Choose a quantity from 1 to ${STORE_MAX_QTY}.` }, { status: 400 });
      }
      const addrProblem = validateAddress(body.address);
      if (addrProblem) return NextResponse.json({ error: addrProblem }, { status: 400 });
      const seller = (await db.doc(`users/${item.ownerUid}`).get()).data();
      if (!seller || seller.suspended === true || (seller.accountTier === "standard" && !["staff", "volunteer", "admin"].includes(seller.role))) {
        return NextResponse.json({ error: "This seller isn't taking orders right now." }, { status: 409 });
      }
      const payout = (await db.doc(`payoutAccounts/${item.ownerUid}`).get()).data();
      if (!payout?.recipientCode) return NextResponse.json({ error: "This seller hasn't set up payouts yet, so they can't take orders." }, { status: 409 });
      const a = body.address;
      const address = {
        fullName: String(a.fullName).trim(),
        phone: String(a.phone).replace(/[\s-]/g, ""),
        street: String(a.street).trim(),
        city: String(a.city).trim(),
        state: String(a.state),
      };
      const deliveryKobo = Number(item.deliveryKobo) || 0;
      const amountKobo = item.priceKobo * quantity + deliveryKobo;
      if (amountKobo > STORE_ITEM_MAX_KOBO * 2) return NextResponse.json({ error: "That order is too large." }, { status: 400 });
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      // Managed stock: take the quantity out now so nobody else can order it while this
      // buyer pays (given back after RESERVATION_MINUTES if the payment never lands).
      await releaseExpiredReservations(itemSnap.id).catch(() => 0);
      try {
        await reserveStock(itemSnap.id, quantity);
      } catch (e) {
        if (e instanceof StockError) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }
      let tx;
      try {
        tx = await initializeTransaction({
          email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
          metadata: { kind, itemId: itemSnap.id, uid: user.uid },
        });
      } catch (e) {
        await returnStock(itemSnap.id, quantity).catch(() => {});
        throw e;
      }
      const record: PaymentRecord = {
        reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString(),
        reference, kind: "store", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: item.ownerUid, publisherUsername: seller.username || "",
        commissionRate: physicalCommissionRateFor((seller.accountTier as AccountTier) || "basic"),
        store: {
          itemId: itemSnap.id, itemTitle: String(item.title), itemImage: String(item.image || ""), quantity,
          unitKobo: item.priceKobo, deliveryKobo, address,
        },
        createdAt: new Date().toISOString(),
      };
      try {
        await db.doc(`payments/${reference}`).set(record);
      } catch (e) {
        await returnStock(itemSnap.id, quantity).catch(() => {});
        throw e;
      }
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    if (kind === "merch") {
      const item = getMerchItem(String(body.itemId));
      const logo = LOGO_OPTIONS.find((l) => l.id === body.logoId);
      if (!item || !logo) return NextResponse.json({ error: "Unknown item or logo." }, { status: 400 });
      if (!merchBatchOpen()) return NextResponse.json({ error: "This batch has closed." }, { status: 409 });
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MERCH_MAX_QTY) {
        return NextResponse.json({ error: `Choose a quantity from 1 to ${MERCH_MAX_QTY}.` }, { status: 400 });
      }
      const size = item.sizes ? String(body.size) : undefined;
      if (item.sizes && !item.sizes.includes(size as string)) return NextResponse.json({ error: "Choose a size." }, { status: 400 });
      const addrProblem = validateAddress(body.address);
      if (addrProblem) return NextResponse.json({ error: addrProblem }, { status: 400 });
      const a = body.address;
      const address = {
        fullName: String(a.fullName).trim(),
        phone: String(a.phone).replace(/[\s-]/g, ""),
        street: String(a.street).trim(),
        city: String(a.city).trim(),
        state: String(a.state),
      };
      const amountKobo = item.priceKobo * quantity + MERCH_DELIVERY_KOBO;
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const tx = await initializeTransaction({
        email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, itemId: item.id, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "merch", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        merch: {
          itemId: item.id, itemName: item.name, logoId: logo.id, logoLabel: logo.label,
          ...(size ? { size } : {}), quantity, unitKobo: item.priceKobo, deliveryKobo: MERCH_DELIVERY_KOBO,
          batchId: MERCH_BATCH.id, address,
        },
        createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- gold badge: identity-check deposit (one-off) and the monthly plan ----
    if (kind === "gold_deposit" || kind === "gold") {
      const me = (await db.doc(`users/${user.uid}`).get()).data();
      if (!me || me.suspended === true) return NextResponse.json({ error: "This account can't buy a badge." }, { status: 403 });
      const req0 = (await db.doc(`badgeRequests/${user.uid}`).get()).data();
      if (!req0 || !isGoldKind(req0.kind) || !isGoldTrack(req0.track)) {
        return NextResponse.json({ error: "Apply for the gold badge first." }, { status: 409 });
      }
      const { kind: gKind, track } = req0;
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const reference = newReference();
      if (kind === "gold_deposit") {
        if (gKind !== "identity" || req0.status !== "awaiting_deposit") {
          return NextResponse.json({ error: "No deposit is due for your application." }, { status: 409 });
        }
        const amountKobo = GOLD_PRICING[track as "personal" | "corporate"].identityDepositKobo;
        const tx = await initializeTransaction({
          email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
          metadata: { kind, uid: user.uid },
        });
        const record: PaymentRecord = {
          reference, kind: "gold_deposit", uid: user.uid, email: user.email, amountKobo,
          status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
          gold: { kind: gKind, track }, createdAt: new Date().toISOString(),
        };
        await db.doc(`payments/${reference}`).set(record);
        return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
      }
      if (req0.status !== "approved" && req0.status !== "active") {
        return NextResponse.json({ error: "Your application hasn't been approved yet." }, { status: 409 });
      }
      const cur = (await db.doc(`goldSubscriptions/${user.uid}`).get()).data();
      if (cur && cur.status === "active" && new Date(cur.currentPeriodEnd).getTime() > Date.now() - 3 * 86_400_000) {
        return NextResponse.json({ error: "Your gold badge is already active." }, { status: 409 });
      }
      const { planCode, amountKobo } = await getGoldPlanCode(track);
      const tx = await initializeTransaction({
        plan: planCode, email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "gold", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        gold: { kind: gKind, track, planCode }, createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- paid plan (Pro / Business) ----
    if (kind === "tier") {
      const tier = String(body.tier);
      const interval = body.interval === "annually" ? "annually" : "monthly";
      if (tier !== "pro" && tier !== "business") return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      const existing = (await db.doc(`tierSubscriptions/${user.uid}`).get()).data();
      if (existing && existing.status !== "expired" && new Date(existing.currentPeriodEnd).getTime() > Date.now() - 3 * 86_400_000) {
        return NextResponse.json(
          {
            error:
              existing.tier === tier && existing.interval === interval
                ? "You're already on this plan."
                : `You're on ${existing.tier === "pro" ? "Pro" : "Business"} until ${String(existing.currentPeriodEnd).slice(0, 10)}. Cancel it under Rates & payouts, then choose a new plan when it ends.`,
          },
          { status: 409 }
        );
      }
      const currentTier = ((await db.doc(`users/${user.uid}`).get()).data()?.accountTier as string) || "standard";
      const rank = ["standard", "basic", "pro", "business", "enterprise"];
      if (rank.indexOf(currentTier) > rank.indexOf(tier) && rank.indexOf(currentTier) >= 2) {
        return NextResponse.json({ error: "Your account is already on a higher plan." }, { status: 409 });
      }
      const { planCode, amountKobo } = await getTierPlanCode(tier, interval);
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const tx = await initializeTransaction({
        plan: planCode, email: user.email, amountKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, tier, interval, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "tier", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        tier: { tier, interval, planCode }, createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- boost: the payer must own the post (or be an admin); no publisher lookup ----
    if (kind === "boost") {
      const pk = getBoostPackage(String(body.packageId));
      if (!pk) return NextResponse.json({ error: "Unknown boost package." }, { status: 400 });
      const noteId = String(body.noteId || "");
      const noteSnap = noteId ? await db.doc(`notes/${noteId}`).get() : null;
      const note = noteSnap?.data();
      if (!note || note.status !== "published") {
        return NextResponse.json({ error: "Only published posts can be boosted." }, { status: 400 });
      }
      const isAdmin = await verifyAdminRequest(idToken).then(() => true).catch(() => false);
      if (!isAdmin && note.authorUid !== user.uid) {
        return NextResponse.json({ error: "You can only boost your own posts." }, { status: 403 });
      }
      const active = await db.collection("boosts").where("noteId", "==", noteId).where("status", "==", "active").get();
      if (active.docs.some((d) => new Date(d.data().endsAt).getTime() > Date.now())) {
        return NextResponse.json({ error: "This post already has an active boost." }, { status: 409 });
      }
      const reference = newReference();
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
      const tx = await initializeTransaction({
        email: user.email, amountKobo: pk.priceKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, noteId, packageId: pk.id, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "boost", uid: user.uid, email: user.email, amountKobo: pk.priceKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        boost: { noteId, packageId: pk.id }, createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    if (typeof username !== "string" || !/^[a-z0-9_-]{2,30}$/.test(username)) {
      return NextResponse.json({ error: "Invalid journal." }, { status: 400 });
    }
    const pub = await loadPublisher(username);
    if (pub.uid === user.uid) return NextResponse.json({ error: "You can't pay yourself." }, { status: 400 });
    if (!pub.hasPayoutAccount) {
      return NextResponse.json({ error: "This publisher hasn't set up payouts yet." }, { status: 409 });
    }

    const reference = newReference();
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
    let record: PaymentRecord;
    let plan: string | undefined;

    if (kind === "booking") {
      const { date, slot } = body;
      const s = pub.settings?.session;
      if (!s?.enabled) return NextResponse.json({ error: "Booking isn't open for this journal." }, { status: 409 });
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Pick a date." }, { status: 400 });
      }
      if (date <= new Date().toISOString().slice(0, 10)) {
        return NextResponse.json({ error: "Pick a future date." }, { status: 400 });
      }
      if (!(s.availability[String(weekdayOf(date))] || []).includes(slot)) {
        return NextResponse.json({ error: "That time isn't available." }, { status: 400 });
      }
      if ((await db.doc(`slotLocks/${slotLockId(username, date, slot)}`).get()).exists) {
        return NextResponse.json({ error: "That slot was just taken — pick another." }, { status: 409 });
      }
      record = {
        reference, kind: "booking", uid: user.uid, email: user.email, amountKobo: s.priceKobo,
        status: "pending", publisherUid: pub.uid, publisherUsername: username,
        commissionRate: pub.commissionRate,
        booking: { username, date, slot, minutes: s.minutes },
        createdAt: new Date().toISOString(),
      };
    } else if (kind === "subscription") {
      const sub = pub.settings?.subscription;
      if (!sub?.enabled || !sub.planCode) {
        return NextResponse.json({ error: "Subscriptions aren't open for this journal." }, { status: 409 });
      }
      plan = sub.planCode;
      record = {
        reference, kind: "subscription", uid: user.uid, email: user.email, amountKobo: sub.priceKobo,
        status: "pending", publisherUid: pub.uid, publisherUsername: username,
        commissionRate: pub.commissionRate,
        subscription: { username, planCode: sub.planCode },
        createdAt: new Date().toISOString(),
      };
    } else if (kind === "gift") {
      if (pub.settings?.gifts?.enabled === false) {
        return NextResponse.json({ error: "This publisher isn't accepting gifts." }, { status: 409 });
      }
      const amountKobo = Math.round(Number(body.amountNaira) * 100);
      if (!Number.isFinite(amountKobo) || amountKobo < GIFT_MIN_KOBO || amountKobo > GIFT_MAX_KOBO) {
        return NextResponse.json({ error: "Gifts must be between ₦200 and ₦500,000." }, { status: 400 });
      }
      const message = typeof body.message === "string" ? body.message.trim().slice(0, GIFT_MESSAGE_MAX) : "";
      let noteSlug: string | undefined;
      let noteId: string | undefined;
      if (body.noteId) {
        const n = (await db.doc(`notes/${String(body.noteId)}`).get()).data();
        if (n && n.status === "published") {
          noteId = String(body.noteId);
          noteSlug = n.slug;
        }
      }
      const senderName = ((await db.doc(`users/${user.uid}`).get()).data()?.displayName as string) || "A reader";
      record = {
        reference, kind: "gift", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: pub.uid, publisherUsername: username,
        commissionRate: pub.commissionRate,
        gift: { username, ...(noteId ? { noteId, noteSlug } : {}), message, anonymous: !!body.anonymous, senderName },
        createdAt: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: "Unknown payment type." }, { status: 400 });
    }

    const tx = await initializeTransaction({
      plan,
      email: user.email,
      amountKobo: record.amountKobo,
      reference,
      callbackUrl: `${origin}/booking/confirm`,
      metadata: { kind, username, uid: user.uid },
    });
    await db.doc(`payments/${reference}`).set(record);
    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    console.error("Paystack initialize failed:", err);
    { const f = friendlyMessage(err, "Couldn't start payment"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
