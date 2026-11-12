import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { addonOn, cashUp, cleanKobo } from "@/lib/hotel";
import { HotelError, openTill, tillContext, tillDay, tillMenu, tillOrder } from "@/lib/hotel-server";
import { settleCounter } from "@/lib/hotel-pay-server";
import { moniepointConfigured, sendToMachine } from "@/lib/hotel-pos-server";

// A till on its counter device (Hotel Standard and up). Opened with the till's own PIN (five wrong PINs lock it for 15 minutes); the
// session token then rides on every call, and the till only sells its own department's menu.
// POST { action: "open", till, pin, cashier } → { token, till } | { action, token, … }: menu | cash (lines, method cash|pos|transfer) |
//   machine (lines: sent to the card machine) | status (id) | day | cashup (countedKobo, machineKobo?)
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    await ensurePricing();
    if (b.action === "open") {
      const l = await rateLimit(req, "hotel-till-open", clientIp(req), 20, 900);
      if (l) return NextResponse.json({ error: "Too many tries. Wait a little and try again." }, { status: 429 });
      return NextResponse.json(await openTill(db, b.till, b.pin, b.cashier));
    }
    const tc = await tillContext(db, b.token);
    const l = await rateLimit(req, "hotel-till", tc.till.id, 600, 600);
    if (l) return l;
    switch (b.action) {
      case "menu": return NextResponse.json({ items: await tillMenu(tc), machine: !!tc.till.machineSerial && addonOn(tc.hotel.addons, "cardMachine", tc.now) && moniepointConfigured(), machineAddon: addonOn(tc.hotel.addons, "cardMachine", tc.now), till: { name: tc.till.name }, cashier: tc.cashier });
      case "cash": {
        const o = await tillOrder(tc, b, b.method === "pos" ? "till_card" : "till_cash");
        const r = await settleCounter(db, { till: tc }, { target: "order", id: o.id, method: b.method });
        return NextResponse.json({ order: { id: o.id, number: o.number, totalKobo: o.totalKobo }, settled: r });
      }
      case "machine": {
        const o = await sendToMachine(tc, b);
        return NextResponse.json({ order: { id: o.id, number: o.number, totalKobo: o.totalKobo, holdUntil: o.holdUntil } });
      }
      case "status": {
        const o = (await db.doc(`hotelOrders/${String(b.id ?? "x").replace(/\//g, "")}`).get()).data();
        if (!o || o.tillId !== tc.till.id) throw new HotelError(404, "Sale not found.");
        return NextResponse.json({ status: o.status, late: !!o.late, expired: o.status === "awaiting_payment" && Date.parse(o.holdUntil) < Date.now() });
      }
      case "day": return NextResponse.json(await tillDay(tc));
      case "cashup": {
        const day = await tillDay(tc);
        const counted = cleanKobo(b.countedKobo);
        if (counted < 0) throw new HotelError(400, "Enter the cash you counted.");
        const typed = b.machineKobo === undefined || b.machineKobo === "" ? null : cleanKobo(b.machineKobo);
        const machine = day.machineKobo ?? (typed !== null && typed >= 0 ? typed : null);
        const r = cashUp(day.sales, counted, machine);
        const ref = await db.collection("hotelCashups").add({ hotelId: tc.hotel.id, tillId: tc.till.id, till: tc.till.name, cashier: tc.cashier, day: day.start.slice(0, 10), ...r, machineFrom: day.machineKobo !== null ? "machine" : machine === null ? "none" : "typed", at: tc.now.toISOString() });
        return NextResponse.json({ id: ref.id, ...r });
      }
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof HotelError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "The till couldn't do that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
