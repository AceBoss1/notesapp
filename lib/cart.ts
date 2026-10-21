import { STORE_MAX_QTY } from "./orders";

// The basket on a member's site (owner, 21 Oct 2026: "I want it"): items from ONE shop, paid together in one card payment. Each line still
// becomes its own ordinary store order (payments/{cart}_{n}, kind "store"), so escrow, dispatch, delivery, refunds and stock work as for a
// single item; the basket is one more payment record (kind "store_cart") that Paystack charges, listing its orders. Delivery is charged
// once, on the first order, priced for the basket's total weight. Refunding one order refunds that part of the basket's payment.
export const CART_MAX_LINES = 20;
export type CartLine = { itemId: string; quantity: number; variant?: string[] };

// What the browser sends, cleaned: known shape, quantities 1–STORE_MAX_QTY, the same item and options merged into one line.
export function cleanCartLines(v: unknown): CartLine[] | string {
  if (!Array.isArray(v) || !v.length) return "Your basket is empty.";
  const out: CartLine[] = [];
  for (const raw of v) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const itemId = typeof o.itemId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.itemId) ? o.itemId : "";
    const quantity = Number(o.quantity);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1) return "Something in your basket isn't right. Refresh and try again.";
    const variant = Array.isArray(o.variant) ? o.variant.map((c) => String(c).slice(0, 60)) : undefined;
    const same = out.find((l) => l.itemId === itemId && lineKey(l) === lineKey({ itemId, quantity, variant }));
    if (same) same.quantity += quantity;
    else out.push({ itemId, quantity, ...(variant?.length ? { variant } : {}) });
  }
  if (out.length > CART_MAX_LINES) return `A basket holds up to ${CART_MAX_LINES} different items.`;
  const tooMany = out.find((l) => l.quantity > STORE_MAX_QTY);
  if (tooMany) return `You can buy up to ${STORE_MAX_QTY} of each item at a time.`;
  return out;
}
export const lineKey = (l: CartLine) => `${l.itemId}|${(l.variant ?? []).join("|")}`;
// The orders inside a basket's payment: the basket's reference with _1, _2 …
export const cartChildRef = (cartRef: string, i: number) => `${cartRef}_${i + 1}`;
// The money for each line's order: its goods, and the whole delivery on the first.
export function cartAmounts(lines: { unitKobo: number; quantity: number }[], deliveryKobo: number): number[] {
  return lines.map((l, i) => l.unitKobo * l.quantity + (i === 0 ? deliveryKobo : 0));
}
