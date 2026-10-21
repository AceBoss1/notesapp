import type { Firestore } from "firebase-admin/firestore";
import { setting } from "./config";
import { payWithCardtap, paylonyConfigured, paylonyCodeText, replyCode } from "./paylony";
import { CardtapNotPaid, fulfillPayment, type PaymentRecord } from "./payments";
import { TOPUP_MAX_KOBO, TOPUP_MIN_KOBO, WALLET_LIVE, bonusFor } from "./wallet";
import { CARDTAP_APP_URL, cardtapQuote, readStart } from "./cardtap-topup";
import { newReference } from "./paystack";

// Server-only. Wallet top-ups with Paylony CardTap (the pure rules are in lib/cardtap-topup.ts):
//   startCardtap  — a pending payments/{reference} (kind wallet_topup, payWith cardtap) and Paylony's code for the CardTap app
//   checkCardtap  — asked by the wallet page every few seconds and by the Paylony webhook: credits the wallet once Paylony says it's
//                   paid (fulfillPayment → confirmCardtap → creditTopup), so it's added once however many times it's asked
// The launch offer (Admin → Credits): walletConfig/main.cardtapFeeWaived, server-only. While it's on we pay Paylony's fee.
export const cardtapReady = () => WALLET_LIVE && paylonyConfigured() && !!setting("PAYLONY_CARDTAP_TERMINAL_ID");

export class CardtapError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function cardtapConfig(db: Firestore): Promise<{ feeWaived: boolean; byUid?: string; at?: string }> {
  const d = (await db.doc("walletConfig/main").get()).data() ?? {};
  return { feeWaived: d.cardtapFeeWaived === true, byUid: d.cardtapByUid, at: d.cardtapAt };
}
export async function setCardtapFeeWaived(db: Firestore, waived: boolean, byUid: string): Promise<void> {
  await db.doc("walletConfig/main").set({ cardtapFeeWaived: waived, cardtapByUid: byUid, cardtapAt: new Date().toISOString() }, { merge: true });
}

export type CardtapStart = { reference: string; initiationRef: string; instruction: string; topupKobo: number; feeKobo: number; waived: boolean; payKobo: number; bonusKobo: number; appUrl: string };

type Starter = typeof payWithCardtap;
export async function startCardtap(db: Firestore, me: { uid: string; email: string }, amountNaira: unknown, origin: string, call: Starter = payWithCardtap): Promise<CardtapStart> {
  if (!cardtapReady()) throw new CardtapError(409, "Topping up with CardTap isn't switched on yet.");
  const naira = Number(amountNaira);
  const topupKobo = Math.round(naira * 100);
  if (!Number.isInteger(naira) || topupKobo < TOPUP_MIN_KOBO || topupKobo > TOPUP_MAX_KOBO) throw new CardtapError(400, "Top up a whole amount from ₦1,000 to ₦500,000.");
  const q = cardtapQuote(topupKobo, (await cardtapConfig(db)).feeWaived);
  const u = (await db.doc(`users/${me.uid}`).get()).data() ?? {};
  const reference = newReference();
  const record: PaymentRecord = {
    reference, kind: "wallet_topup", uid: me.uid, email: me.email, amountKobo: topupKobo, status: "pending", publisherUid: me.uid, publisherUsername: "",
    commissionRate: 0, topup: { bonusKobo: bonusFor(topupKobo) }, payWith: "cardtap", cardtap: { feeKobo: q.feeKobo, waived: q.waived, payKobo: q.payKobo }, createdAt: new Date().toISOString(),
  };
  await db.doc(`payments/${reference}`).set(record);
  const r = await call({
    amount: q.payKobo / 100, currency: "NGN", name: String(u.displayName || u.username || me.email), email: me.email, phone: String(u.phone ?? ""),
    terminal_id: setting("PAYLONY_CARDTAP_TERMINAL_ID")!, reference, title: "NotesApp Credit", description: "#NotesApp wallet top-up",
    redirectUrl: `${origin}/profile/wallet?cardtap=${reference}`,
  } as Parameters<Starter>[0]).catch((e) => ({ ok: false, httpStatus: 0, body: e instanceof Error ? e.message : "request failed" }));
  const start = r.ok ? readStart(r.body) : null;
  if (!start) {
    await db.doc(`payments/${reference}`).update({ cardtapFailed: true, cardtapStartHttp: r.httpStatus, cardtapStartError: (typeof r.body === "string" ? r.body : JSON.stringify(r.body)).slice(0, 1500) });
    // Also in the Vercel function log, so a refusal can be read there (Paylony's reply holds no keys).
    console.warn("[cardtap] start refused", reference, r.httpStatus, (typeof r.body === "string" ? r.body : JSON.stringify(r.body)).slice(0, 800));
    const code = replyCode(r);
    throw new CardtapError(502, `CardTap couldn't start the payment${code ? ` (${paylonyCodeText(code)})` : ""}. Try again, or top up by card.`);
  }
  await db.doc(`payments/${reference}`).update({ "cardtap.initiationRef": start.initiationRef });
  return { reference, ...start, topupKobo, feeKobo: q.feeKobo, waived: q.waived, payKobo: q.payKobo, bonusKobo: record.topup!.bonusKobo, appUrl: CARDTAP_APP_URL };
}

export type CardtapCheck = { status: "paid" | "waiting" | "failed"; topupKobo: number; bonusKobo: number };
// uid: the member asking (the wallet page); left out when the webhook asks.
export async function checkCardtap(db: Firestore, reference: string, uid?: string, fulfil: typeof fulfillPayment = fulfillPayment): Promise<CardtapCheck> {
  const p = (await db.doc(`payments/${reference}`).get()).data() as PaymentRecord | undefined;
  if (!p || p.payWith !== "cardtap" || (uid && p.uid !== uid)) throw new CardtapError(404, "That CardTap top-up wasn't found.");
  const out = (status: CardtapCheck["status"]): CardtapCheck => ({ status, topupKobo: p.amountKobo, bonusKobo: p.topup?.bonusKobo ?? 0 });
  if ((p as { cardtapFailed?: boolean }).cardtapFailed) return out("failed");
  if (p.status !== "pending") return out("paid");
  try {
    await fulfil(reference);
    return out("paid");
  } catch (e) {
    if (e instanceof CardtapNotPaid) {
      if (e.state === "failed") await db.doc(`payments/${reference}`).update({ cardtapFailed: true }).catch(() => {});
      return out(e.state);
    }
    throw e;
  }
}
