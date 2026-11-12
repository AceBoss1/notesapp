import { createHmac, timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { setting } from "./config";
import { addonOn, type Order } from "./hotel";
import { HotelError, bumpPulse, tillOrder, type TillCtx } from "./hotel-server";
import { afterSettle, readSettle, writeSettle } from "./hotel-pay-server";
import { hotelChat, type NanaHotelDeps } from "./hotel-nana-server";

// Two add-ons that need outside accounts (docs/HOTEL_KIT.md). Both stay "not set up yet" until their settings are in place (lib/config.ts,
// group "Hotel kit"), and both check every webhook's signature before reading it.
//
// The card-machine link (Moniepoint): a till sends a card sale's exact amount to the counter's machine (push payment), the items held for
// three minutes; Moniepoint's signed webhook (HMAC-SHA256 of "<id>__<timestamp>__<body>", base64, in moniepoint-webhook-signature) says
// how it went. Every event is stored once by the machine's transaction reference (hotelPosEvents), so a repeat delivery changes nothing;
// an approval for our sale settles it (lib/hotel-pay-server.ts), a decline cancels it, an approval after the sale was cancelled or ran out
// is kept and flagged as late money. Approved events also give the cash-up its "card machine says" figure.
//
// WhatsApp ordering: Meta's webhook, signed with the app secret (X-Hub-Signature-256: sha256=<hex HMAC of the body>), each message
// handled once (hotelWaMessages/{id}); Nana answers from the hotel's own number (lib/hotel-nana-server.ts).

// ---- Moniepoint ----
export const moniepointConfigured = () => !!(setting("MONIEPOINT_WEBHOOK_SECRET") && setting("MONIEPOINT_CLIENT_ID") && setting("MONIEPOINT_CLIENT_SECRET") && setting("MONIEPOINT_API_URL"));
export const moniepointWebhookReady = () => (setting("MONIEPOINT_WEBHOOK_SECRET") ?? "").length >= 16;
const amountToKobo = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return 0; return (setting("MONIEPOINT_AMOUNT_UNIT") ?? "").trim().toLowerCase() === "kobo" ? Math.round(n) : Math.round(n * 100); };
const koboToAmount = (k: number) => ((setting("MONIEPOINT_AMOUNT_UNIT") ?? "").trim().toLowerCase() === "kobo" ? k : k / 100);
export function signMoniepoint(id: string, timestamp: string, raw: string, secret: string) {
  return createHmac("sha256", secret).update(`${id}__${timestamp}__${raw}`, "utf8").digest("base64");
}
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
// Fails closed: no secret, or any header missing, is a bad signature.
export function verifyMoniepoint(h: { id?: string | null; timestamp?: string | null; signature?: string | null }, raw: string): boolean {
  const secret = setting("MONIEPOINT_WEBHOOK_SECRET") ?? "";
  if (secret.length < 16 || !h.id || !h.timestamp || !h.signature) return false;
  return same(h.signature.trim(), signMoniepoint(h.id, h.timestamp, raw, secret));
}

type Push = (a: { serial: string; amountKobo: number; merchantRef: string }) => Promise<{ ok: boolean; note?: string }>;
// Moniepoint's push-payment API: log in, then ask the machine for the amount. A failure leaves the sale to time out (three minutes).
export const pushToMachine: Push = async ({ serial, amountKobo, merchantRef }) => {
  const base = (setting("MONIEPOINT_API_URL") ?? "").replace(/\/+$/, "");
  const auth = await fetch(`${base}/v1/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: setting("MONIEPOINT_CLIENT_ID"), clientSecret: setting("MONIEPOINT_CLIENT_SECRET") }), cache: "no-store" });
  const token = ((await auth.json().catch(() => ({}))) as { accessToken?: string }).accessToken;
  if (!auth.ok || !token) return { ok: false, note: "Moniepoint didn't accept our login." };
  const r = await fetch(`${base}/v1/transactions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store", body: JSON.stringify({ terminalSerial: serial, amount: koboToAmount(amountKobo), merchantReference: merchantRef, transactionType: "PURCHASE", paymentMethod: "CARD_PURCHASE" }) });
  return { ok: r.ok, note: r.ok ? undefined : `Moniepoint said ${r.status}.` };
};

// The till's "Send to card machine": the sale, held for three minutes, with our reference for Moniepoint to send back.
export async function sendToMachine(tc: TillCtx, raw: Record<string, unknown>, push: Push = pushToMachine): Promise<Order> {
  if (!addonOn(tc.hotel.addons, "cardMachine", tc.now)) throw new HotelError(402, "The card-machine link is an add-on. The owner can add it from Plans and add-ons.");
  if (!moniepointConfigured()) throw new HotelError(503, "The card-machine link isn't set up yet. Take the card on the machine and choose Card (machine).");
  if (!tc.till.machineSerial) throw new HotelError(409, "This till has no card machine linked. Ask the manager to add its serial number.");
  const o = await tillOrder(tc, raw, "machine");
  await tc.db.doc(`hotelOrders/${o.id}`).update({ machineRef: o.id });
  const sent = await push({ serial: tc.till.machineSerial, amountKobo: o.totalKobo, merchantRef: o.id! }).catch(() => ({ ok: false, note: "Couldn't reach Moniepoint." }));
  if (!sent.ok) {
    await tc.db.doc(`hotelOrders/${o.id}`).update({ status: "cancelled", cancelledAt: tc.now.toISOString() });
    throw new HotelError(502, `${sent.note ?? "The machine didn't get it."} Nothing was charged; try again or take cash.`);
  }
  await bumpPulse(tc.db, tc.hotel.id, tc.now);
  return { ...o, machineRef: o.id };
}

const APPROVED = /^(approved|successful|success|completed)$/i;
const DECLINED = /^(declined|failed|cancelled|canceled|reversed|expired)$/i;
// A whole Moniepoint webhook. 401 bad signature; 400 unreadable; 200 recorded (or a repeat). Errors throw, so Moniepoint retries.
export async function processMoniepoint(db: Firestore, h: { id?: string | null; timestamp?: string | null; signature?: string | null }, raw: string, now = new Date()): Promise<{ status: number; result: string }> {
  if (!verifyMoniepoint(h, raw)) return { status: 401, result: "bad_signature" };
  let event: { data?: Record<string, unknown> };
  try { event = JSON.parse(raw); } catch { return { status: 400, result: "bad_json" }; }
  const d = event?.data ?? {};
  const txRef = String(d.transactionReference ?? "").replace(/[^A-Za-z0-9|_-]/g, "").slice(0, 120);
  if (!txRef) return { status: 400, result: "no_reference" };
  const status = String(d.transactionStatus ?? d.responseMessage ?? "");
  const approved = APPROVED.test(status) || String(d.responseCode ?? "") === "00";
  const declined = !approved && DECLINED.test(status);
  const amountKobo = amountToKobo(d.amount);
  const merchantRef = String(d.merchantReference ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const docId = txRef.replace(/\|/g, "_");
  try {
    await db.doc(`hotelPosEvents/${docId}`).create({ terminalSerial: String(d.terminalSerial ?? "").toUpperCase(), amountKobo, approved, declined, status: status.slice(0, 40), merchantRef, eventId: String(h.id).slice(0, 80), at: now.toISOString() });
  } catch (e) {
    if ((e as { code?: number }).code === 6) return { status: 200, result: "duplicate" };
    throw e;
  }
  if (!merchantRef) return { status: 200, result: "recorded" };
  const o = await db.doc(`hotelOrders/${merchantRef}`).get();
  if (!o.exists || o.get("machineRef") !== merchantRef) return { status: 200, result: "recorded" };
  if (declined) {
    await db.runTransaction(async (t) => { const x = await t.get(o.ref); if (x.get("status") === "awaiting_payment") t.update(o.ref, { status: "cancelled", cancelledAt: now.toISOString(), machineSaid: status.slice(0, 40) }); });
    await bumpPulse(db, String(o.get("hotelId")), now);
    return { status: 200, result: "declined" };
  }
  if (!approved) return { status: 200, result: "recorded" };
  const w = await db.runTransaction(async (t) => {
    const r = await readSettle(t, db, "order", o.id, `moniepoint_${docId}`);
    return writeSettle(t, db, r, { provider: "moniepoint", ref: txRef, amountKobo, method: "pos", via: "moniepoint", by: String(o.get("by") ?? "card machine") }, now);
  });
  await afterSettle(db, "order", o.id, now);
  return { status: 200, result: w.late ? "late" : "settled" };
}

// ---- WhatsApp ----
export const whatsappConfigured = () => !!(setting("WHATSAPP_APP_SECRET") && setting("WHATSAPP_VERIFY_TOKEN") && setting("WHATSAPP_ACCESS_TOKEN"));
export function verifyWhatsapp(raw: string, header: string | null): boolean {
  const secret = setting("WHATSAPP_APP_SECRET") ?? "";
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  return same(header.slice(7).toLowerCase(), createHmac("sha256", secret).update(raw).digest("hex"));
}
export const verifyChallenge = (mode: string | null, token: string | null) => mode === "subscribe" && !!token && !!setting("WHATSAPP_VERIFY_TOKEN") && same(token, setting("WHATSAPP_VERIFY_TOKEN")!);
type Send = (numberId: string, to: string, text: string) => Promise<boolean>;
export const sendWhatsapp: Send = async (numberId, to, text) => {
  const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(numberId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${setting("WHATSAPP_ACCESS_TOKEN")}` }, cache: "no-store", body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) } }) });
  return r.ok;
};
type WaValue = { metadata?: { phone_number_id?: string }; messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[]; contacts?: { profile?: { name?: string } }[] };
export async function processWhatsapp(db: Firestore, raw: string, signature: string | null, deps: { nana: NanaHotelDeps; send?: Send }): Promise<{ status: number; handled: number }> {
  if (!verifyWhatsapp(raw, signature)) return { status: 401, handled: 0 };
  let body: { entry?: { changes?: { value?: WaValue }[] }[] };
  try { body = JSON.parse(raw); } catch { return { status: 400, handled: 0 }; }
  const send = deps.send ?? sendWhatsapp;
  let handled = 0;
  for (const change of (body.entry ?? []).flatMap((e) => e.changes ?? [])) {
    const v = change.value ?? {};
    const numberId = String(v.metadata?.phone_number_id ?? "").replace(/\D/g, "");
    if (!numberId) continue;
    for (const m of (v.messages ?? []).slice(0, 10)) {
      const id = String(m.id ?? "").replace(/[^A-Za-z0-9._=-]/g, "").slice(0, 120);
      const from = String(m.from ?? "").replace(/\D/g, "").slice(0, 16);
      if (!id || !from) continue;
      try { await db.doc(`hotelWaMessages/${id}`).create({ numberId, from, at: deps.nana.now().toISOString() }); } catch (e) { if ((e as { code?: number }).code === 6) continue; throw e; }
      const hotel = (await db.collection("hotels").where("whatsappNumberId", "==", numberId).limit(1).get()).docs[0];
      if (!hotel) continue;
      const text = m.type === "text" ? String(m.text?.body ?? "") : "";
      const chatId = `wa_${hotel.id}_${from}`.replace(/[^A-Za-z0-9_+-]/g, "").slice(0, 80);
      const answer = text
        ? await hotelChat(db, hotel.id, { chatId, message: text, name: v.contacts?.[0]?.profile?.name }, "whatsapp", deps.nana, { phone: from }).then((r) => r.reply).catch((e) => (e instanceof HotelError ? e.message : "Sorry, something went wrong. Please call the front desk."))
        : "I can read text messages only. Tell me what you'd like to order or book.";
      await send(numberId, from, answer).catch(() => false);
      handled++;
    }
  }
  return { status: 200, handled };
}
