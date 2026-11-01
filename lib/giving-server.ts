import type { Firestore, Transaction } from "firebase-admin/firestore";
import { can, isDiscoverable } from "./community";
import { CommunityError, communityVerified, memberOf, readCommunity } from "./community-server";
import { DEFAULT_FUNDS, cleanGiftNote, cleanGivingSettings, giftProblem, quoteGift, type GiftQuote } from "./giving";
import type { PaymentRecord } from "./payments";

// Community giving on the server (the rules are lib/giving.ts). A gift is a payment of kind "giving" (app/api/paystack/initialize),
// settled by lib/payments.ts fulfillPayment, which writes the receipt here (communityGifts/{reference}) and a "giving" ledger entry to
// the community owner's account, paid out to their verified bank account by the usual payout run. communityGifts is server-only:
// givers read their own receipts and admins the community's gifts through /api/giving. No card details are ever kept.

export type GiftDoc = {
  reference: string; cid: string; communityName: string; fund: string; note: string; anonymous: boolean;
  giverUid: string; giverName: string; giverEmail: string;
  giftKobo: number; paidKobo: number; bandKobo: number; cardChargeKobo: number; netKobo: number; covered: boolean;
  payWith: "card" | "wallet"; status: "paid" | "refunded"; createdAt: string;
};
export type GivingInfo = NonNullable<PaymentRecord["giving"]>;

async function adminOf(db: Firestore, cid: string, uid: string) {
  const [c, me] = await Promise.all([readCommunity(db, cid), memberOf(db, cid, uid)]);
  if (!me || me.status !== "active" || !can(me.role, "giving")) throw new CommunityError(403, "Only the community's admins look after giving.");
  return c;
}

// Admins switch giving on or off and name the funds.
export async function setGiving(db: Firestore, uid: string, cid: string, raw: unknown, now = new Date()) {
  const c = await adminOf(db, cid, uid);
  const s = cleanGivingSettings(raw);
  if (s.enabled) {
    const payout = (await db.doc(`payoutAccounts/${c.ownerUid}`).get()).data();
    if (!payout?.recipientCode) throw new CommunityError(409, "Gifts are paid to the bank account of the community's owner. The owner adds it first, under Rates & payouts.");
  }
  await db.doc(`communities/${cid}`).update({ giving: s, updatedAt: now.toISOString() });
  return s;
}

// Checks a gift before checkout and prices it. Errors are words for the giver.
export async function giftCheckout(db: Firestore, uid: string, raw: { cid?: unknown; amountNaira?: unknown; fund?: unknown; note?: unknown; anonymous?: unknown; cover?: unknown }, method: "card" | "wallet") {
  const cid = String(raw.cid ?? "");
  const c = await readCommunity(db, cid);
  if (!c.giving?.enabled) throw new CommunityError(409, "This community isn't taking gifts here.");
  const me = await memberOf(db, cid, uid);
  if (me?.status === "banned") throw new CommunityError(403, "You can't give to this community.");
  if (me?.status !== "active" && !isDiscoverable(c)) throw new CommunityError(403, "Giving here is for members.");
  if (c.ownerUid === uid) throw new CommunityError(409, "You run this community, so you can't give to it here.");
  const owner = (await db.doc(`users/${c.ownerUid}`).get()).data();
  if (!owner || owner.suspended) throw new CommunityError(409, "This community can't take gifts right now.");
  const payout = (await db.doc(`payoutAccounts/${c.ownerUid}`).get()).data();
  if (!payout?.recipientCode) throw new CommunityError(409, "This community hasn't added its bank account yet, so it can't take gifts.");
  const giftKobo = Math.round(Number(raw.amountNaira) * 100);
  const verified = await communityVerified(db, c);
  const problem = giftProblem(giftKobo, verified);
  if (problem) throw new CommunityError(400, problem);
  const funds = c.giving.funds?.length ? c.giving.funds : DEFAULT_FUNDS;
  const fund = funds.find((f) => f === raw.fund) ?? funds[0];
  const quote: GiftQuote = quoteGift(giftKobo, { method, cover: raw.cover === true });
  const giver = (await db.doc(`users/${uid}`).get()).data();
  const info: GivingInfo = {
    cid, communityName: c.name, fund, note: cleanGiftNote(raw.note), anonymous: raw.anonymous === true,
    giverName: String(giver?.displayName || giver?.username || "A member"),
    giftKobo: quote.giftKobo, bandKobo: quote.bandKobo, cardChargeKobo: quote.cardChargeKobo, netKobo: quote.netKobo, covered: quote.covered,
  };
  return { info, payKobo: quote.payKobo, ownerUid: c.ownerUid, ownerUsername: String(owner.username ?? "") };
}

// In fulfillPayment's transaction (writes only): the receipt.
export function writeGiftReceipt(t: Transaction, db: Firestore, p: PaymentRecord, now: string) {
  const g = p.giving!;
  t.set(db.doc(`communityGifts/${p.reference}`), {
    reference: p.reference, cid: g.cid, communityName: g.communityName, fund: g.fund, note: g.note, anonymous: g.anonymous,
    giverUid: p.uid, giverName: g.giverName, giverEmail: p.email,
    giftKobo: g.giftKobo, paidKobo: p.amountKobo, bandKobo: g.bandKobo, cardChargeKobo: g.cardChargeKobo, netKobo: g.netKobo, covered: g.covered,
    payWith: p.payWith === "wallet" ? "wallet" : "card", status: "paid", createdAt: now,
  } satisfies GiftDoc);
}

// A giver's own receipts, newest first.
export async function myGifts(db: Firestore, uid: string) {
  const snap = await db.collection("communityGifts").where("giverUid", "==", uid).limit(500).get();
  return snap.docs.map((d) => d.data() as GiftDoc).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ giverEmail: _e, ...g }) => g);
}

// The community's gifts for its admins: each gift (an anonymous giver's name hidden) and the totals per fund. Never card details
// (none are kept) or the giver's email.
export async function communityGifts(db: Firestore, uid: string, cid: string) {
  await adminOf(db, cid, uid);
  const snap = await db.collection("communityGifts").where("cid", "==", cid).limit(5000).get();
  const all = snap.docs.map((d) => d.data() as GiftDoc).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const funds = new Map<string, { fund: string; count: number; giftKobo: number; netKobo: number }>();
  for (const g of all.filter((x) => x.status === "paid")) {
    const f = funds.get(g.fund) ?? { fund: g.fund, count: 0, giftKobo: 0, netKobo: 0 };
    f.count++; f.giftKobo += g.giftKobo; f.netKobo += g.netKobo;
    funds.set(g.fund, f);
  }
  const paid = all.filter((x) => x.status === "paid");
  return {
    totals: { count: paid.length, giftKobo: paid.reduce((n, g) => n + g.giftKobo, 0), netKobo: paid.reduce((n, g) => n + g.netKobo, 0) },
    funds: [...funds.values()].sort((a, b) => b.giftKobo - a.giftKobo),
    gifts: all.slice(0, 300).map((g) => ({
      reference: g.reference, fund: g.fund, note: g.note, giverName: g.anonymous ? "Anonymous" : g.giverName, giftKobo: g.giftKobo,
      netKobo: g.netKobo, covered: g.covered, status: g.status, createdAt: g.createdAt,
    })),
  };
}
