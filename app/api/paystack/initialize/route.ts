import { NextRequest, NextResponse } from "next/server";
import { AD_TEXT_MAX, AD_TITLE_MAX } from "@/lib/ad-config";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { isKidUid } from "@/lib/kids";
import { slotLockId, initializeTransaction, newReference } from "@/lib/paystack";
import { PaymentRecord } from "@/lib/payments";
import { loadPublisher } from "@/lib/publishers";
import { weekdayOf } from "@/lib/booking-time";
import { LEGAL_VERSION } from "@/lib/legal";
import { GIFT_MAX_KOBO, GIFT_MESSAGE_MAX, GIFT_MIN_KOBO, getBoostPackage } from "@/lib/boost-config";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { getTierPlanCode, getBadgePlanCode, getGoldPlanCode, tierPrice } from "@/lib/tier-billing";
import { GOLD_PRICING, isGoldKind, isGoldTrack } from "@/lib/gold";
import { getAdPackage } from "@/lib/ad-packages";
import { ensurePricing } from "@/lib/pricing-server";
import { currentPricing } from "@/lib/pricing";
import { isPlacement } from "@/lib/ads";
import { r2PublicUrl } from "@/lib/r2";
import { getMerchItem, LOGO_OPTIONS, MERCH_BATCH, MERCH_DELIVERY_KOBO, MERCH_MAX_QTY, merchBatchOpen, validateAddress } from "@/lib/merch";
import { TIERS, badgeIncluded, digitalCommissionRateFor, physicalCommissionRateFor } from "@/lib/tiers";
import { privateFilesConfigured } from "@/lib/private-files";
import { STORE_ITEM_MAX_KOBO, STORE_MAX_QTY } from "@/lib/orders";
import { RESERVATION_MINUTES, StockError, canActForSeller, releaseExpiredReservations, reserveStock, returnStock } from "@/lib/orders-server";
import type { AccountTier } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";
import { callbackOrigin } from "@/lib/origin";
import { fulfillPayment } from "@/lib/payments";
import { TOPUP_MAX_KOBO, TOPUP_MIN_KOBO, WALLET_LIVE, bonusFor, isWalletKind } from "@/lib/wallet";
import { WalletError, payFromWallet } from "@/lib/wallet-server";
import { BUY_NAIRA_MAX, BUY_NAIRA_MIN, LIFE_LIVE } from "@/lib/life/catalog";
import { AcademyError } from "@/lib/certificates";
import { checkoutFor } from "@/lib/certificates-server";
import { courseCheckout } from "@/lib/course-sales-server";
import { CourseError } from "@/lib/courses-server";
import { accessOf, partnerQuote } from "@/lib/logistics-server";
import { accessFor as inventoryAccessFor } from "@/lib/inventory-server";
import { itemKg } from "@/lib/logistics";
import { cartAmounts, cartChildRef, cleanCartLines } from "@/lib/cart";
import { basketDelivery } from "@/lib/cart-server";
import { DiscountError, NOTESAPP_OWNER, spreadDiscount, type DiscountTarget } from "@/lib/discounts";
import { applyCode, paymentDiscount } from "@/lib/discounts-server";
import { REFERRAL_COOKIE, firstPeriodOffer } from "@/lib/referrals";
import { affiliateFor, offerIdFor, offerPercent, referralOfferFor, referrerByUsername, type Referrer } from "@/lib/referrals-server";

// Starts a Paystack checkout for a 1:1 session or a monthly journal
// subscription. Price, slots and plan all come from the publisher's
// server-side settings — the client only says who/what/when.
export async function POST(req: NextRequest) {
  await ensurePricing();
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
    if (isKidUid(user.uid)) return NextResponse.json({ error: "A child profile can't buy. Ask your parent." }, { status: 403 });
    if (!user.email) return NextResponse.json({ error: "Your account needs an email to pay." }, { status: 400 });

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verify your email first — use the banner at the top of the page to resend the link." },
        { status: 403 }
      );
    }

    const limited = await rateLimit(req, "pay-init", user.uid, 10, 600);
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

    // Pay from the NotesApp Credit wallet instead of Paystack: every check below runs exactly the same; only the money comes from
    // the wallet (taken together with the payment record), and the purchase is completed straight away.
    const payWith = body.payWith === "wallet" ? "wallet" : "card";
    if (payWith === "wallet" && (!WALLET_LIVE || !isWalletKind(kind))) {
      return NextResponse.json({ error: "This can't be paid from your wallet yet. Pay by card instead." }, { status: 400 });
    }
    const initTx: typeof initializeTransaction = payWith === "wallet"
      ? async (a) => ({ authorization_url: `${a.callbackUrl}?reference=${encodeURIComponent(a.reference)}&wallet=1`, reference: a.reference })
      : initializeTransaction;
    const savePayment = async (record: PaymentRecord) => {
      if (payWith !== "wallet") { await db.doc(`payments/${record.reference}`).set(record); return; }
      await payFromWallet(db, record);
      // If this fails for a moment, the confirmation page the buyer lands on finishes it (the money is already set aside).
      await fulfillPayment(record.reference).catch((e) => console.error("wallet payment: fulfil will be retried", record.reference, e));
    };
    // A discount code (lib/discounts.ts), when the buyer typed one: checked against the owner's codes (the seller's, or #NotesApp's
    // for our own products) and worked out on the server's price. A bad code throws DiscountError, answered below with its reason.
    const wantsCode = typeof body.code === "string" && body.code.trim() !== "";
    const codeFor = async (owner: string, target: DiscountTarget, subtotalKobo: number, more: { itemId?: string; itemIds?: string[]; extraKobo?: number } = {}) =>
      wantsCode ? applyCode(db, owner, body.code, user.uid, { target, subtotalKobo, ...more }) : null;
    // An affiliate link the buyer came through (the na_ref cookie, set by /r/<username>, 30 days): looked up once, only when a
    // product with an affiliate share is being bought.
    let referrer: Referrer | null | undefined;
    const affiliate = async (sellerUid: string, offerId: string, paidKobo: number) => {
      const percent = await offerPercent(db, offerId, sellerUid);
      if (!(percent > 0)) return null;
      if (referrer === undefined) referrer = await referrerByUsername(db, req.cookies.get(REFERRAL_COOKIE)?.value, user.uid);
      return affiliateFor(referrer, { buyerUid: user.uid, sellerUid, percent, paidKobo });
    };

    // ---- NotesApp Credit top-up (Paystack only) ----
    if (kind === "wallet_topup") {
      if (!WALLET_LIVE) return NextResponse.json({ error: "The wallet isn't open yet." }, { status: 409 });
      if (payWith === "wallet") return NextResponse.json({ error: "Top up by card or bank." }, { status: 400 });
      const naira = Number(body.amountNaira);
      const amountKobo = Math.round(naira * 100);
      if (!Number.isInteger(naira) || amountKobo < TOPUP_MIN_KOBO || amountKobo > TOPUP_MAX_KOBO) {
        return NextResponse.json({ error: "Top up a whole amount from ₦1,000 to ₦500,000." }, { status: 400 });
      }
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initializeTransaction({
        email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "wallet_topup", uid: user.uid, email: user.email, amountKobo, status: "pending",
        publisherUid: user.uid, publisherUsername: "", commissionRate: 0, topup: { bonusKobo: bonusFor(amountKobo) }, createdAt: new Date().toISOString(),
      };
      await db.doc(`payments/${reference}`).set(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- Notes Academy certificate (lib/certificates-server.ts): the learner finished the course; the price is fixed now ----
    if (kind === "certificate") {
      let co: Awaited<ReturnType<typeof checkoutFor>>;
      try { co = await checkoutFor(db, user.uid, body.courseId, body.learnerName); }
      catch (e) { if (e instanceof AcademyError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
      const teacher = (await db.doc(`users/${co.ownerUid}`).get()).data();
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo: co.q.kobo, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid, courseId: co.q.course.id } });
      const record: PaymentRecord = {
        reference, kind: "certificate", uid: user.uid, email: user.email, amountKobo: co.q.kobo, status: "pending",
        publisherUid: co.ownerUid, publisherUsername: String(teacher?.username ?? ""),
        commissionRate: digitalCommissionRateFor((teacher?.accountTier as AccountTier) || "basic", teacher?.customRates),
        certificate: { courseId: co.q.course.id, courseTitle: co.q.course.title, learnerName: co.name, startKobo: co.q.startKobo, lateKobo: co.q.lateKobo, teacherKobo: co.teacherKobo },
        createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

    // ---- a paid Notes Academy course (lib/course-sales-server.ts): the price, the teacher and their rate are fixed now ----
    if (kind === "course") {
      let co: Awaited<ReturnType<typeof courseCheckout>>;
      try { co = await courseCheckout(db, user.uid, body.courseId); }
      catch (e) { if (e instanceof CourseError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
      const fullKobo = co.course.priceKobo!;
      const code = await codeFor(co.course.ownerUid, "course", fullKobo, { itemId: co.course.id });
      const amountKobo = fullKobo - (code?.discountKobo ?? 0);
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid, courseId: co.course.id } });
      const record: PaymentRecord = {
        reference, kind: "course", uid: user.uid, email: user.email, amountKobo, status: "pending",
        publisherUid: co.course.ownerUid, publisherUsername: String(co.owner.username ?? ""), commissionRate: co.commissionRate,
        course: { courseId: co.course.id, courseTitle: co.course.title, courseSlug: co.course.slug },
        ...(code ? { discount: paymentDiscount(code, fullKobo) } : {}),
        ...await (async () => { const a = await affiliate(co.course.ownerUid, offerIdFor("course", co.course.id), amountKobo); return a ? { affiliate: a } : {}; })(),
        createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

    // ---- Nana AI credit pack (lib/nana-meter.ts), from the wallet or by card; anyone signed in can buy one ----
    // ---- the logistics add-on: a month as a provider in the logistics network, for Free Basic and Pro ----
    if (kind === "logistics_addon") {
      const me = (await db.doc(`users/${user.uid}`).get()).data();
      if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });
      const access = await accessOf(db, me as Parameters<typeof accessOf>[1]);
      if (access.ok && access.via === "plan") return NextResponse.json({ error: "Your plan already includes the logistics tools." }, { status: 409 });
      if (!["basic", "pro"].includes(String(me.accountTier))) return NextResponse.json({ error: "The logistics add-on is for Free Basic and Pro accounts that publish." }, { status: 403 });
      const full = currentPricing().logistics.addonMonthlyKobo;
      const code = await codeFor(NOTESAPP_OWNER, "logistics_addon", full);
      const amount = full - (code?.discountKobo ?? 0);
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo: amount, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid } });
      const record: PaymentRecord = {
        reference, kind: "logistics_addon", uid: user.uid, email: user.email, amountKobo: amount, status: "pending",
        publisherUid: user.uid, publisherUsername: "", commissionRate: 0, ...(code ? { discount: paymentDiscount(code, full) } : {}), createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

    // ---- inventory on Free Basic and Pro: a month of the add-on (Business and Enterprise include it) ----
    if (kind === "inventory_addon") {
      const me = (await db.doc(`users/${user.uid}`).get()).data();
      if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });
      const access = inventoryAccessFor(me as Parameters<typeof inventoryAccessFor>[0]);
      if (access.ok && access.via === "plan") return NextResponse.json({ error: "Your plan already includes inventory." }, { status: 409 });
      if (!["basic", "pro"].includes(String(me.accountTier))) return NextResponse.json({ error: "The inventory add-on is for Free Basic and Pro; Business and Enterprise include it." }, { status: 403 });
      const full = currentPricing().inventory.addonMonthlyKobo;
      const code = await codeFor(NOTESAPP_OWNER, "inventory_addon", full);
      const amount = full - (code?.discountKobo ?? 0);
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo: amount, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid } });
      const record: PaymentRecord = {
        reference, kind: "inventory_addon", uid: user.uid, email: user.email, amountKobo: amount, status: "pending",
        publisherUid: user.uid, publisherUsername: "", commissionRate: 0, ...(code ? { discount: paymentDiscount(code, full) } : {}), createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

    if (kind === "nana_credit") {
      const pack = currentPricing().nana.topUps.find((p) => p.id === body.packId);
      if (!pack) return NextResponse.json({ error: "Choose a Nana credit pack." }, { status: 400 });
      const code = await codeFor(NOTESAPP_OWNER, "nana_credit", pack.priceKobo);
      const amountKobo = pack.priceKobo - (code?.discountKobo ?? 0);
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid, packId: pack.id } });
      const record: PaymentRecord = {
        reference, kind: "nana_credit", uid: user.uid, email: user.email, amountKobo, status: "pending",
        publisherUid: user.uid, publisherUsername: "", commissionRate: 0, nanaPack: { packId: pack.id, name: pack.name, creditKobo: pack.creditKobo },
        ...(code ? { discount: paymentDiscount(code, pack.priceKobo) } : {}), createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

    // ---- Notesville Naira for Notes Life (₦1 = N$ 100), from the wallet or by card ----
    if (kind === "life_naira") {
      if (!LIFE_LIVE) return NextResponse.json({ error: "Notes Life isn't open yet." }, { status: 409 });
      const naira = Number(body.amountNaira);
      if (!Number.isInteger(naira) || naira < BUY_NAIRA_MIN || naira > BUY_NAIRA_MAX) {
        return NextResponse.json({ error: `Buy from ₦${BUY_NAIRA_MIN.toLocaleString("en-NG")} to ₦${BUY_NAIRA_MAX.toLocaleString("en-NG")} at a time.` }, { status: 400 });
      }
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({ email: user.email, amountKobo: naira * 100, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid } });
      const record: PaymentRecord = {
        reference, kind: "life_naira", uid: user.uid, email: user.email, amountKobo: naira * 100, status: "pending",
        publisherUid: user.uid, publisherUsername: "", commissionRate: 0, createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference, paid: payWith === "wallet" });
    }

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
      const origin = await callbackOrigin(req);
      const tx = await initTx({
        plan: planCode, email: user.email, amountKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "badge", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        badge: { planCode }, createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- advertiser campaign (self-serve banner ads; reviewed before going live) ----
    if (kind === "ad") {
      const pk = getAdPackage(body.packageId);
      if (!pk) return NextResponse.json({ error: "Choose a package." }, { status: 400 });
      const advertiserName = String(body.advertiserName || "").trim().slice(0, 80);
      const title = String(body.title || "").trim();
      const text = String(body.text || "").trim();
      if (title.length > AD_TITLE_MAX) return NextResponse.json({ error: `Keep the headline to ${AD_TITLE_MAX} characters.` }, { status: 400 });
      if (text.length > AD_TEXT_MAX) return NextResponse.json({ error: `Keep the text to ${AD_TEXT_MAX} characters.` }, { status: 400 });
      const href = String(body.href || "").trim().slice(0, 500);
      const image = String(body.image || "").trim().slice(0, 500);
      if (advertiserName.length < 2) return NextResponse.json({ error: "Enter your business or advertiser name." }, { status: 400 });
      if (title.length < 3) return NextResponse.json({ error: "Add a headline." }, { status: 400 });
      if (!/^https:\/\/[^\s]+$/i.test(href)) return NextResponse.json({ error: "The ad link must start with https://" }, { status: 400 });
      // Images must be ones we host (uploaded through the campaign form).
      if (!image || !image.startsWith(r2PublicUrl(`ads/${user.uid}/`))) return NextResponse.json({ error: "Upload the advert picture through the form." }, { status: 400 });
      const placements = Array.isArray(body.placements) ? Array.from(new Set(body.placements.filter(isPlacement))) : [];
      if (placements.length === 0) return NextResponse.json({ error: "Pick at least one placement." }, { status: 400 });
      // Notes Life billboards need their own 1600 × 900 picture (lib/ad-config.ts BILLBOARD_IMAGE), uploaded the same way.
      const billboard = placements.includes("life") ? String(body.billboard || "").trim().slice(0, 500) : "";
      if (placements.includes("life") && !billboard.startsWith(r2PublicUrl(`ads/${user.uid}/`))) return NextResponse.json({ error: "Add the Notes Life billboard picture, or untick Notes Life." }, { status: 400 });
      if (body.agreed !== true) return NextResponse.json({ error: "Please confirm you've read the advertising rules." }, { status: 400 });
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({
        email: user.email, amountKobo: pk.priceKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, packageId: pk.id, uid: user.uid },
      });
      const now = new Date().toISOString();
      await db.doc(`adCampaigns/${reference}`).set({
        id: reference, uid: user.uid, email: user.email, advertiserName, packageId: pk.id, packageName: pk.name,
        impressionsBudget: pk.impressions, windowDays: pk.windowDays, amountKobo: pk.priceKobo, placements,
        creative: { title, text, image, href, ...(billboard ? { billboard } : {}) }, status: "awaiting_payment", createdAt: now,
      });
      const record: PaymentRecord = {
        reference, kind: "ad", uid: user.uid, email: user.email, amountKobo: pk.priceKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        ad: { campaignId: reference, packageId: pk.id }, createdAt: now,
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- official merch pre-order (price, delivery and batch all server-side) ----
    // ---- physical goods from a publisher's store (money held until delivery) ----
    // ---- a basket from one shop (lib/cart.ts): one card payment, one ordinary store order per line ----
    if (kind === "store_cart") {
      if (payWith === "wallet") return NextResponse.json({ error: "Pay for a basket by card or bank." }, { status: 400 });
      const cleaned = cleanCartLines(body.lines);
      if (typeof cleaned === "string") return NextResponse.json({ error: cleaned }, { status: 400 });
      const lines: Exclude<Awaited<ReturnType<typeof storeLine>>, { error: string }>[] = [];
      for (const l of cleaned) {
        const line = await storeLine(db, user.uid, l.itemId, l.quantity, l.variant);
        if ("error" in line) return NextResponse.json({ error: line.error }, { status: line.status });
        lines.push(line);
      }
      const sellerUid = String(lines[0].item.ownerUid);
      if (lines.some((l) => l.item.ownerUid !== sellerUid)) return NextResponse.json({ error: "A basket holds items from one shop." }, { status: 400 });
      const addrProblem = validateAddress(body.address);
      if (addrProblem) return NextResponse.json({ error: addrProblem }, { status: 400 });
      const seller = (await db.doc(`users/${sellerUid}`).get()).data();
      if (!seller || seller.suspended === true || (seller.accountTier === "standard" && !["staff", "volunteer", "admin"].includes(seller.role))) {
        return NextResponse.json({ error: "This seller isn't taking orders right now." }, { status: 409 });
      }
      const payout = (await db.doc(`payoutAccounts/${sellerUid}`).get()).data();
      if (!payout?.recipientCode) return NextResponse.json({ error: "This seller hasn't set up payouts yet, so they can't take orders." }, { status: 409 });
      const a = body.address;
      const address = { fullName: String(a.fullName).trim(), phone: String(a.phone).replace(/[\s-]/g, ""), street: String(a.street).trim(), city: String(a.city).trim(), state: String(a.state) };
      // One delivery for the whole basket (lib/cart-server.ts).
      const { carrier, deliveryKobo } = await basketDelivery(db, sellerUid, lines, address);
      const goods = lines.map((l) => l.item.priceKobo * l.quantity);
      const fullAmounts = cartAmounts(lines.map((l) => ({ unitKobo: l.item.priceKobo, quantity: l.quantity })), deliveryKobo);
      const fullKobo = fullAmounts.reduce((x, y) => x + y, 0);
      // A code takes money off the goods (never the delivery), shared across the orders in proportion to each one's goods.
      const code = await codeFor(sellerUid, "store", goods.reduce((x, y) => x + y, 0), { itemIds: lines.map((l) => l.itemSnap.id), extraKobo: deliveryKobo });
      const lineOff = spreadDiscount(goods, code?.discountKobo ?? 0);
      const amounts = fullAmounts.map((a, i) => a - lineOff[i]);
      const amountKobo = amounts.reduce((x, y) => x + y, 0);
      if (amountKobo > STORE_ITEM_MAX_KOBO * 2) return NextResponse.json({ error: "That order is too large." }, { status: 400 });
      const reference = newReference();
      const origin = await callbackOrigin(req);
      // Stock is taken for every line while the buyer pays (and all given back if any line can't be had).
      const reserved: typeof lines = [];
      try {
        for (const l of lines) {
          await releaseExpiredReservations(l.itemSnap.id).catch(() => 0);
          await reserveStock(l.itemSnap.id, l.quantity, l.variant);
          reserved.push(l);
        }
      } catch (e) {
        for (const l of reserved) await returnStock(l.itemSnap.id, l.quantity, l.variant).catch(() => {});
        if (e instanceof StockError) return NextResponse.json({ error: `${String(lines[reserved.length].item.title)}: ${e.message}` }, { status: 409 });
        throw e;
      }
      const giveBack = async () => { for (const l of lines) await returnStock(l.itemSnap.id, l.quantity, l.variant).catch(() => {}); };
      const now = new Date().toISOString();
      const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString();
      const commissionRate = physicalCommissionRateFor((seller.accountTier as AccountTier) || "basic", seller.customRates);
      const lineAff = await Promise.all(lines.map((l, i) => affiliate(sellerUid, offerIdFor("item", l.itemSnap.id), goods[i] - lineOff[i])));
      const children: PaymentRecord[] = lines.map((l, i) => ({
        reference: cartChildRef(reference, i), cartRef: reference, reservedUntil, kind: "store", uid: user.uid, email: user.email!, amountKobo: amounts[i],
        status: "pending", publisherUid: sellerUid, publisherUsername: seller.username || "", commissionRate,
        store: {
          itemId: l.itemSnap.id, itemTitle: String(l.item.title), itemImage: String(l.item.image || ""), quantity: l.quantity,
          ...(l.variant ? { variant: l.variant, variantLabel: l.variantLabel } : {}),
          unitKobo: l.item.priceKobo, ...(lineOff[i] ? { discountKobo: lineOff[i] } : {}), deliveryKobo: i === 0 ? deliveryKobo : 0, address, ...(carrier && i === 0 ? { carrier } : {}),
        },
        ...(lineAff[i] ? { affiliate: lineAff[i]! } : {}),
        createdAt: now,
      }));
      let tx;
      try {
        tx = await initTx({ email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`, metadata: { kind, uid: user.uid, orders: children.length } });
      } catch (e) {
        await giveBack();
        throw e;
      }
      try {
        const batch = db.batch();
        for (const c of children) batch.set(db.doc(`payments/${c.reference}`), c);
        batch.set(db.doc(`payments/${reference}`), {
          reference, kind: "store_cart", uid: user.uid, email: user.email, amountKobo, status: "pending", publisherUid: sellerUid, publisherUsername: seller.username || "",
          commissionRate, cart: { orders: children.map((c) => c.reference) }, ...(code ? { discount: paymentDiscount(code, fullKobo) } : {}), createdAt: now,
        } satisfies PaymentRecord);
        await batch.commit();
      } catch (e) {
        await giveBack();
        throw e;
      }
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    if (kind === "store") {
      const line = await storeLine(db, user.uid, body.itemId, body.quantity, body.variant);
      if ("error" in line) return NextResponse.json({ error: line.error }, { status: line.status });
      const { itemSnap, item, quantity, variant, variantLabel } = line;
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
      // The store's delivery partner prices the delivery from its rate card for this address and weight; with no partner, or one that
      // doesn't cover the address, the item's own delivery fee applies as before.
      const carrier = await partnerQuote(db, item.ownerUid, address, itemKg(item.weightKg) * quantity);
      const deliveryKobo = carrier ? carrier.feeKobo : Number(item.deliveryKobo) || 0;
      const goodsKobo = item.priceKobo * quantity;
      const code = await codeFor(String(item.ownerUid), "store", goodsKobo, { itemId: itemSnap.id, extraKobo: deliveryKobo });
      const amountKobo = goodsKobo - (code?.discountKobo ?? 0) + deliveryKobo;
      if (amountKobo > STORE_ITEM_MAX_KOBO * 2) return NextResponse.json({ error: "That order is too large." }, { status: 400 });
      const reference = newReference();
      const origin = await callbackOrigin(req);
      // Managed stock: take the quantity out now so nobody else can order it while this
      // buyer pays (given back after RESERVATION_MINUTES if the payment never lands).
      await releaseExpiredReservations(itemSnap.id).catch(() => 0);
      try {
        await reserveStock(itemSnap.id, quantity, variant);
      } catch (e) {
        if (e instanceof StockError) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }
      let tx;
      try {
        tx = await initTx({
          email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
          metadata: { kind, itemId: itemSnap.id, uid: user.uid },
        });
      } catch (e) {
        await returnStock(itemSnap.id, quantity, variant).catch(() => {});
        throw e;
      }
      const record: PaymentRecord = {
        reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString(),
        reference, kind: "store", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: item.ownerUid, publisherUsername: seller.username || "",
        commissionRate: physicalCommissionRateFor((seller.accountTier as AccountTier) || "basic", seller.customRates),
        store: {
          itemId: itemSnap.id, itemTitle: String(item.title), itemImage: String(item.image || ""), quantity,
          ...(variant ? { variant, variantLabel } : {}),
          unitKobo: item.priceKobo, ...(code ? { discountKobo: code.discountKobo } : {}), deliveryKobo, address, ...(carrier ? { carrier } : {}),
        },
        ...(code ? { discount: paymentDiscount(code, goodsKobo + deliveryKobo) } : {}),
        ...await (async () => { const a = await affiliate(String(item.ownerUid), offerIdFor("item", itemSnap.id), goodsKobo - (code?.discountKobo ?? 0)); return a ? { affiliate: a } : {}; })(),
        createdAt: new Date().toISOString(),
      };
      try {
        await savePayment(record);
      } catch (e) {
        await returnStock(itemSnap.id, quantity, variant).catch(() => {});
        throw e;
      }
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- digital download: instant, no delivery, final once downloaded ----
    if (kind === "digital") {
      if (body.acceptFinal !== true) return NextResponse.json({ error: "Please confirm you understand a download is final and can't be refunded." }, { status: 400 });
      if (!privateFilesConfigured()) return NextResponse.json({ error: "Downloads aren't available right now." }, { status: 503 });
      const itemSnap = await db.doc(`storeItems/${String(body.itemId)}`).get();
      const item = itemSnap.data();
      if (!item || item.sellable !== true || item.kind !== "digital" || !Number.isInteger(item.priceKobo)) return NextResponse.json({ error: "This download isn't for sale here." }, { status: 404 });
      const sf = (await db.doc(`storeFiles/${itemSnap.id}`).get()).data();
      const ready = item.access === "view" ? sf?.access === "view" && Array.isArray(sf.lessons) && sf.lessons.length > 0 : !!item.fileName && !!sf;
      if (!ready) return NextResponse.json({ error: "The seller hasn't finished setting this download up yet." }, { status: 409 });
      if (item.ownerUid === user.uid) return NextResponse.json({ error: "You can't buy your own item." }, { status: 409 });
      const owned = await db.collection("digitalPurchases").where("buyerUid", "==", user.uid).where("itemId", "==", itemSnap.id).limit(1).get();
      if (!owned.empty) return NextResponse.json({ error: "You already own this download — find it under My orders." }, { status: 409 });
      const seller = (await db.doc(`users/${item.ownerUid}`).get()).data();
      if (!seller || seller.suspended === true || (seller.accountTier === "standard" && !["staff", "volunteer", "admin"].includes(seller.role))) {
        return NextResponse.json({ error: "This seller isn't taking orders right now." }, { status: 409 });
      }
      const payout = (await db.doc(`payoutAccounts/${item.ownerUid}`).get()).data();
      if (!payout?.recipientCode) return NextResponse.json({ error: "This seller hasn't set up payouts yet, so they can't take orders." }, { status: 409 });
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const code = await codeFor(String(item.ownerUid), "digital", item.priceKobo, { itemId: itemSnap.id });
      const amountKobo = item.priceKobo - (code?.discountKobo ?? 0);
      const tx = await initTx({
        email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, itemId: itemSnap.id, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "digital", uid: user.uid, email: user.email, amountKobo, ...(code ? { discount: paymentDiscount(code, item.priceKobo) } : {}),
        ...await (async () => { const a = await affiliate(String(item.ownerUid), offerIdFor("item", itemSnap.id), amountKobo); return a ? { affiliate: a } : {}; })(),
        status: "pending", publisherUid: item.ownerUid, publisherUsername: seller.username || "",
        commissionRate: digitalCommissionRateFor((seller.accountTier as AccountTier) || "basic", seller.customRates),
        digital: { itemId: itemSnap.id, itemTitle: String(item.title), itemImage: String(item.image || "") },
        createdAt: new Date().toISOString(),
      };
      await savePayment(record);
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
      const code = await codeFor(NOTESAPP_OWNER, "merch", item.priceKobo * quantity, { itemId: item.id, extraKobo: MERCH_DELIVERY_KOBO });
      const amountKobo = item.priceKobo * quantity - (code?.discountKobo ?? 0) + MERCH_DELIVERY_KOBO;
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({
        email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, itemId: item.id, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "merch", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        ...(code ? { discount: paymentDiscount(code, item.priceKobo * quantity + MERCH_DELIVERY_KOBO) } : {}),
        merch: {
          itemId: item.id, itemName: item.name, logoId: logo.id, logoLabel: logo.label,
          ...(size ? { size } : {}), quantity, unitKobo: item.priceKobo, deliveryKobo: MERCH_DELIVERY_KOBO,
          batchId: MERCH_BATCH.id, address,
        },
        createdAt: new Date().toISOString(),
      };
      await savePayment(record);
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
      const origin = await callbackOrigin(req);
      const reference = newReference();
      if (kind === "gold_deposit") {
        if (gKind !== "identity" || req0.status !== "awaiting_deposit") {
          return NextResponse.json({ error: "No deposit is due for your application." }, { status: 409 });
        }
        const amountKobo = GOLD_PRICING[track as "personal" | "corporate"].identityDepositKobo;
        const tx = await initTx({
          email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
          metadata: { kind, uid: user.uid },
        });
        const record: PaymentRecord = {
          reference, kind: "gold_deposit", uid: user.uid, email: user.email, amountKobo,
          status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
          gold: { kind: gKind, track }, createdAt: new Date().toISOString(),
        };
        await savePayment(record);
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
      const tx = await initTx({
        plan: planCode, email: user.email, amountKobo, reference, callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "gold", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        gold: { kind: gKind, track, planCode }, createdAt: new Date().toISOString(),
      };
      await savePayment(record);
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
      const { planCode, amountKobo: planKobo } = await getTierPlanCode(tier, interval);
      // A friend who joined through a member's link (lib/referrals.ts): their first month free (a card check, given back) or a
      // month off their first year, charged once now; the plan's subscription starts on Paystack when that period ends.
      const offer = payWith === "card" ? await referralOfferFor(db, user.uid) : null;
      const first = offer ? firstPeriodOffer(interval, tierPrice(tier, "monthly") ?? planKobo, tierPrice(tier, "annually") ?? planKobo) : null;
      const amountKobo = first ? first.chargeKobo : planKobo;
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const tx = await initTx({
        ...(first ? {} : { plan: planCode }), email: user.email, amountKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, tier, interval, uid: user.uid, ...(first ? { referralFirst: true } : {}) },
      });
      const record: PaymentRecord = {
        reference, kind: "tier", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0,
        tier: { tier, interval, planCode, ...(first ? { referralFirst: true } : {}) }, createdAt: new Date().toISOString(),
      };
      await savePayment(record);
      return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
    }

    // ---- boost: the payer must own the post (or be an admin); no publisher lookup ----
    if (kind === "boost") {
      const pk = getBoostPackage(String(body.packageId));
      if (!pk) return NextResponse.json({ error: "Unknown boost package." }, { status: 400 });
      const itemId = String(body.itemId || "");
      const noteId = itemId ? "" : String(body.noteId || "");
      if (itemId) {
        // A store item: the payer must run the store (owner, or a team member with store access).
        const item = (await db.doc(`storeItems/${itemId}`).get()).data();
        if (!item || item.sellable !== true) return NextResponse.json({ error: "Only items on sale can be boosted." }, { status: 400 });
        if (item.kind === "digital" && !item.fileName && !(item.lessonCount > 0)) return NextResponse.json({ error: "Finish setting up the download before boosting it." }, { status: 400 });
        if (!(await canActForSeller(user.uid, String(item.ownerUid)))) return NextResponse.json({ error: "You can only boost items in your own store." }, { status: 403 });
        const active = await db.collection("boosts").where("itemId", "==", itemId).where("status", "==", "active").get();
        if (active.docs.some((d) => new Date(d.data().endsAt).getTime() > Date.now())) {
          return NextResponse.json({ error: "This item already has an active boost." }, { status: 409 });
        }
      } else {
        const noteSnap = noteId ? await db.doc(`notes/${noteId}`).get() : null;
        const note = noteSnap?.data();
        if (!note || note.status !== "published") {
          return NextResponse.json({ error: "Only published posts can be boosted." }, { status: 400 });
        }
        const isAdmin = await verifyAdminRequest(idToken, ["growth"]).then(() => true).catch(() => false);
        if (!isAdmin && note.authorUid !== user.uid) {
          return NextResponse.json({ error: "You can only boost your own posts." }, { status: 403 });
        }
        const active = await db.collection("boosts").where("noteId", "==", noteId).where("status", "==", "active").get();
        if (active.docs.some((d) => new Date(d.data().endsAt).getTime() > Date.now())) {
          return NextResponse.json({ error: "This post already has an active boost." }, { status: 409 });
        }
      }
      const reference = newReference();
      const origin = await callbackOrigin(req);
      const code = await codeFor(NOTESAPP_OWNER, "boost", pk.priceKobo);
      const amountKobo = pk.priceKobo - (code?.discountKobo ?? 0);
      const tx = await initTx({
        email: user.email, amountKobo, reference,
        callbackUrl: `${origin}/booking/confirm`,
        metadata: { kind, ...(itemId ? { itemId } : { noteId }), packageId: pk.id, uid: user.uid },
      });
      const record: PaymentRecord = {
        reference, kind: "boost", uid: user.uid, email: user.email, amountKobo,
        status: "pending", publisherUid: user.uid, publisherUsername: "", commissionRate: 0, ...(code ? { discount: paymentDiscount(code, pk.priceKobo) } : {}),
        boost: { ...(itemId ? { itemId } : { noteId }), packageId: pk.id }, createdAt: new Date().toISOString(),
      };
      await savePayment(record);
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
    const origin = await callbackOrigin(req);
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
      const code = await codeFor(pub.uid, "booking", s.priceKobo);
      record = {
        reference, kind: "booking", uid: user.uid, email: user.email, amountKobo: s.priceKobo - (code?.discountKobo ?? 0),
        ...(code ? { discount: paymentDiscount(code, s.priceKobo) } : {}),
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

    const tx = await initTx({
      plan,
      email: user.email,
      amountKobo: record.amountKobo,
      reference,
      callbackUrl: `${origin}/booking/confirm`,
      metadata: { kind, username, uid: user.uid },
    });
    await savePayment(record);
    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    if (err instanceof WalletError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof DiscountError) return NextResponse.json({ error: err.message, code: "discount" }, { status: err.status });
    console.error("Paystack initialize failed:", err);
    { const f = friendlyMessage(err, "Couldn't start payment"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}

// One item of a store order (a single purchase or one line of a basket), checked against the listing: for sale here, physical, not the
// buyer's own, a quantity from 1 to STORE_MAX_QTY, and one choice from each of its options.
async function storeLine(db: FirebaseFirestore.Firestore, buyerUid: string, itemId: unknown, rawQuantity: unknown, rawVariant: unknown) {
  const itemSnap = await db.doc(`storeItems/${String(itemId)}`).get();
  const item = itemSnap.data();
  if (!item || item.sellable !== true || !Number.isInteger(item.priceKobo)) return { error: "This item isn't for sale here.", status: 404 } as const;
  if (item.kind === "digital") return { error: "That's a digital download — buy it with the download checkout.", status: 409 } as const;
  if (item.ownerUid === buyerUid) return { error: "You can't buy your own item.", status: 409 } as const;
  const quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > STORE_MAX_QTY) return { error: `Choose a quantity from 1 to ${STORE_MAX_QTY}.`, status: 400 } as const;
  // An item with options (Size, Colour …): the buyer must pick one choice from each, checked against the listing.
  let variant: string | undefined;
  let variantLabel: string | undefined;
  const options = (Array.isArray(item.options) ? item.options : []) as { name: string; choices: string[] }[];
  if (options.length) {
    const picked = Array.isArray(rawVariant) ? (rawVariant as unknown[]).map(String) : [];
    if (picked.length !== options.length || picked.some((c, i) => !options[i].choices.includes(c))) {
      return { error: `Choose ${options.map((o) => o.name.toLowerCase()).join(" and ")} for ${String(item.title)} first.`, status: 400 } as const;
    }
    variant = picked.join("|");
    variantLabel = options.map((o, i) => `${o.name}: ${picked[i]}`).join(", ");
  }
  return { itemSnap, item, quantity, variant, variantLabel };
}
