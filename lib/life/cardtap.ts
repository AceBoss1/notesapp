import {
  DIGITAL_WITCH, FOOD, FOOD_MODES, FUEL_NAIRA, HOTEL_OF, ITEM, ORDER_MAX_ITEMS, OUTLET, OUTLET_BACKUP, RECIPE, TRANSPORT_OF, DW_COURSE,
  BRAND_NAME, LUX_COURSE, MARKET_SHOPS, RESTROOM, STREET_OF, hotelPrice, itemPrice, outletPrice, type FoodMode,
} from "./catalog";

// Paylony CardTap (partner, from 18 October 2026): in Notes Life every Notesville Naira payment at a counter is a tap of the player's
// CardTap card on the merchant's phone, the way CardTap takes contactless card payments on NFC Android phones in real life. The game only
// shows the tap; the money is still Notesville Naira, charged by the server (lib/life/server.ts) at the price shown here. Pure and client-safe.
export const CARDTAP = {
  name: "CardTap", by: "Paylony", maker: "Lony Tech Solutions", site: "https://paylony.com", tagline: "Pay with CardTap on Paylony",
  lockup: "/images/life/partners/paylony-lockup.webp", logo: "/images/life/partners/cardtap-logo.webp", billboard: "/images/life/billboards/paylony-cardtap.webp",
} as const;

export type TapCharge = { payee: string; what: string; amount: number };
export type TapContext = { jobId: string | null; deal?: { who: string; cost: number; state: string } | null };

const TRAVEL_PAYEE: Record<string, string> = { bus: "Abuja Metro", keke: "Keke rider", taxi: "Taxi driver" };

// Who is paid, for what and how much, or null when nothing is charged (a free ride, declining a deal) or the request isn't one the
// server would accept (then the game shows the server's message instead of a terminal).
export function tapCharge(a: { action: string } & Record<string, unknown>, ctx: TapContext): TapCharge | null {
  const out = (payee: string, what: string, amount: number): TapCharge | null => (Number.isFinite(amount) && amount > 0 ? { payee, what, amount: Math.round(amount) } : null);
  switch (a.action) {
    case "buy": {
      const it = ITEM(String(a.item));
      return it && !it.starter && !it.soon ? out(it.brand === "itel" ? BRAND_NAME.itel : "Wuse market", it.name, itemPrice(it, ctx.jobId)) : null;
    }
    case "food": {
      const mode = FOOD_MODES[a.mode as FoodMode];
      const items = Array.isArray(a.items) ? (a.items as { id: unknown; qty: unknown }[]) : [];
      if (!mode) return null;
      let total = mode.fee, qty = 0;
      for (const i of items) {
        const f = FOOD(String(i.id)), q = Math.max(0, Math.floor(Number(i.qty) || 0));
        if (!f) return null;
        total += f.price * q; qty += q;
      }
      return qty > 0 && qty <= ORDER_MAX_ITEMS ? out(BRAND_NAME.chef_adams, `${mode.label} · ${qty} item${qty === 1 ? "" : "s"}`, total) : null;
    }
    case "travel": {
      const tr = TRANSPORT_OF(String(a.mode));
      return tr ? out(TRAVEL_PAYEE[tr.id] ?? tr.name, `${tr.name} fare`, tr.price) : null;
    }
    case "cook": {
      const r = RECIPE(String(a.recipe));
      return r ? out("Wuse market", `Ingredients: ${r.name}`, r.cost) : null;
    }
    case "hotel": {
      const h = HOTEL_OF(String(a.service));
      return h && !h.soon ? out("Candellux Imperial", h.name, hotelPrice(h, ctx.jobId)) : null;
    }
    case "street": {
      const x = STREET_OF(String(a.service));
      return x ? out(MARKET_SHOPS[x.spot].name, x.name, x.price) : null;
    }
    case "lux_enroll": {
      const c = LUX_COURSE(String(a.course));
      return c ? out("LUXNAS Academy", c.name, c.price) : null;
    }
    case "restroom": {
      const r = RESTROOM(String(a.at));
      return r ? out("Wuse Market mobile WC", r.name, r.price) : null;
    }
    case "fuel": {
      const litres = Math.floor(Number(a.litres));
      return Number.isInteger(litres) && litres > 0 ? out("Filling station", `Petrol: ${litres} L`, litres * FUEL_NAIRA) : null;
    }
    case "deal_answer": {
      const d = ctx.deal;
      return d && d.state === "offered" && (a.answer === "accept" || a.answer === "negotiate") ? out(d.who, "Goods for the deal", d.cost) : null;
    }
    case "outlet_open": {
      const t = OUTLET(String(a.outlet));
      return t ? out(BRAND_NAME[t.brand], t.name, outletPrice(t, a.area === "garki" ? "garki" : "wuse")) : null;
    }
    case "outlet_backup":
      return OUTLET(String(a.outlet)) ? out(BRAND_NAME.itel, OUTLET_BACKUP.name, OUTLET_BACKUP.price) : null;
    case "dw_enroll": {
      const c = DW_COURSE(String(a.course));
      return c ? out(DIGITAL_WITCH.name, `${c.name} course`, c.price) : null;
    }
  }
  return null;
}

// The last four digits printed on a player's card: the same for them on every device, made from their account id (not a real card).
export function cardLast4(uid: string): string {
  let h = 7;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) % 10_000;
  return String(h).padStart(4, "0");
}
