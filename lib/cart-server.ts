import type { Firestore } from "firebase-admin/firestore";
import { itemKg } from "./logistics";
import { partnerQuote, type Carrier } from "./logistics-server";

// A basket's one delivery (lib/cart.ts): the store's delivery partner's rate for the basket's total weight to this address, or, without a
// partner that covers it, the highest of the items' own delivery fees. The checkout charges it and the basket page shows it.
export async function basketDelivery(db: Firestore, sellerUid: string, lines: { item: { weightKg?: unknown; deliveryKobo?: unknown }; quantity: number }[], to: { city: string; state: string }): Promise<{ deliveryKobo: number; carrier: Carrier | null }> {
  const carrier = await partnerQuote(db, sellerUid, to, lines.reduce((kg, l) => kg + itemKg(l.item.weightKg as number | undefined) * l.quantity, 0));
  return { carrier, deliveryKobo: carrier ? carrier.feeKobo : Math.max(0, ...lines.map((l) => Number(l.item.deliveryKobo) || 0)) };
}
