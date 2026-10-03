// Seller checkout for physical goods + parcel tracking.
//
// A buyer pays on-platform for an item in a publisher's store. The money is held
// (ledger kind "order") until the buyer confirms delivery, or 7 days after the
// parcel is marked delivered, whichever comes first. The SELLER is responsible for
// getting the parcel to the buyer and for keeping its custody log (#NotesApp is not
// the carrier). Either a courier (name + tracking number + link) or a hand-off chain
// (bike / bus / park holders, each with a phone number) describes where it is.
export type OrderStatus = "paid" | "dispatched" | "delivered" | "confirmed" | "disputed" | "refunded";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid — waiting for the seller to dispatch",
  dispatched: "On its way",
  delivered: "Marked delivered",
  confirmed: "Delivery confirmed",
  disputed: "Problem reported — under review",
  refunded: "Refunded",
};

export const ESCROW_AUTO_RELEASE_DAYS = 7; // after "delivered", if the buyer says nothing
export const ESCROW_PLACEHOLDER_DAYS = 120; // ledger hold until a confirmation sets the real release time
export const STORE_MAX_QTY = 10;
export const STORE_ITEM_MIN_KOBO = 100 * 100;
export const STORE_ITEM_MAX_KOBO = 5_000_000 * 100;
export const STORE_DELIVERY_MAX_KOBO = 50_000 * 100;

export type HolderType = "seller" | "bike" | "bus" | "park" | "courier" | "buyer";
export const HOLDER_LABEL: Record<HolderType, string> = {
  seller: "Seller",
  bike: "Bike rider",
  bus: "Bus / driver",
  park: "Motor park / agent",
  courier: "Courier",
  buyer: "Buyer",
};
export const isHolderType = (v: unknown): v is HolderType => typeof v === "string" && v in HOLDER_LABEL;

export type CustodyEntry = {
  id: string;
  holderType: HolderType;
  holderName: string;
  holderPhone?: string; // shown only to the buyer/seller, or to someone who proves they're the receiver
  location: string; // where the parcel is / was handed over
  at: string;
  status: "confirmed" | "pending"; // pending = handed on, waiting for the next holder to confirm
  by: "seller" | "holder";
};

export type CourierInfo = { name: string; trackingNumber: string; trackingUrl: string };

// parcels/{parcelId} — the public face of an order (server-written; read only through /api/track)
export type Parcel = {
  parcelId: string;
  orderRef: string; // payments/storeOrders doc id
  sellerUid: string;
  sellerUsername: string;
  sellerName: string;
  buyerUid: string;
  buyerPhoneLast4: string;
  itemTitle: string;
  quantity: number;
  city: string;
  state: string;
  status: OrderStatus;
  // Official #NotesApp merch uses the same tracking page; its own four stages replace
  // the escrow-flavoured `status` wording (see lib/merch.ts MERCH_STEPS).
  kind?: "store" | "merch";
  merchStatus?: "preordered" | "printed" | "shipped" | "delivered" | "refunded";
  mode?: "courier" | "handoff";
  courier?: CourierInfo;
  custody: CustodyEntry[];
  createdAt: string;
  failedLookups?: { count: number; windowStart: string };
  lockedUntil?: string;
};

export type StoreOrder = {
  reference: string;
  parcelId: string;
  sellerUid: string;
  sellerUsername: string;
  buyerUid: string;
  buyerEmail: string;
  itemId: string;
  itemTitle: string;
  itemImage: string;
  quantity: number;
  unitKobo: number;
  deliveryKobo: number;
  amountKobo: number;
  commissionKobo: number;
  address: { fullName: string; phone: string; street: string; city: string; state: string };
  status: OrderStatus;
  mode?: "courier" | "handoff";
  courier?: CourierInfo;
  paidAt: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  autoReleaseAt?: string;
  confirmedAt?: string;
  autoConfirmed?: boolean;
  disputeReason?: string;
};

const ID_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I
export function newParcelId(): string {
  let s = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += ID_CHARS[b % ID_CHARS.length];
  return `NA-${s}`;
}
export const normalizeParcelId = (v: unknown): string | null => {
  const s = String(v ?? "").toUpperCase().replace(/\s/g, "");
  const m = s.match(/^(?:NA-?)?([2-9A-HJ-NP-Z]{8})$/);
  return m ? `NA-${m[1]}` : null;
};

export const phoneLast4 = (phone: string) => String(phone).replace(/\D/g, "").slice(-4);
export const normalizePhone = (v: unknown): string | null => {
  const p = String(v ?? "").replace(/[\s-]/g, "");
  return /^(\+234|0)\d{10}$/.test(p) ? p : null;
};

export function cleanText(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isHttpsUrl(v: unknown): v is string {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}
