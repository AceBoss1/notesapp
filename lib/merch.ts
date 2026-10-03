// Official #NotesApp merch — sold in pre-order batches through Paystack
// (flat Nigeria delivery, manual fulfilment). Each item can carry any of
// the brand's core or seasonal logos, matching /brand's wardrobe.

export type MerchShape = "tshirt" | "cap" | "mug" | "stanley" | "mousepad" | "coffeecup" | "laptopbag";

export type MerchItem = {
  id: string;
  name: string;
  shape: MerchShape; // drawn mockup used until a real photo is supplied
  // Drop a plain product photo at /public/images/merch/<id>.webp and set
  // `photo` to "/images/merch/<id>.webp" — the logo is overlaid at `print`.
  photo?: string;
  // Where the logo sits on the mockup/photo, as % of the square image box.
  print: { left: number; top: number; size: number };
  priceKobo: number;
  sizes?: string[];
};

const TEE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const MERCH_ITEMS: MerchItem[] = [
  { id: "tshirt", name: "T-Shirt", shape: "tshirt", print: { left: 35, top: 34, size: 30 }, priceKobo: 12_000_00, sizes: TEE_SIZES },
  { id: "cap", name: "Cap", shape: "cap", print: { left: 38, top: 42, size: 24 }, priceKobo: 8_000_00 },
  { id: "mug", name: "Mug", shape: "mug", print: { left: 37, top: 44, size: 26 }, priceKobo: 6_500_00 },
  { id: "stanley", name: "Stanley-Style Cup", shape: "stanley", print: { left: 39, top: 42, size: 22 }, priceKobo: 18_000_00 },
  { id: "mousepad", name: "Mouse Pad", shape: "mousepad", print: { left: 39, top: 42, size: 22 }, priceKobo: 5_000_00 },
  { id: "coffeecup", name: "Coffee Cup", shape: "coffeecup", print: { left: 38, top: 46, size: 24 }, priceKobo: 6_000_00 },
  { id: "laptopbag", name: "Laptop Bag", shape: "laptopbag", print: { left: 38, top: 42, size: 24 }, priceKobo: 25_000_00 },
];

export const getMerchItem = (id: string) => MERCH_ITEMS.find((i) => i.id === id);

// Pre-order batches: people pay now, we print after the batch closes.
// EDIT THESE when you open a new batch (dates are Lagos time).
export const MERCH_BATCH = {
  id: "batch-1",
  label: "Batch 1",
  closesOn: "2026-11-15", // last day to order, inclusive
  deliveryNote: "Printed after the batch closes; delivered within about 3 weeks of closing.",
};
export const MERCH_DELIVERY_KOBO = 3_000_00; // flat delivery fee, Nigeria only — EDIT to your real fee
export const MERCH_MAX_QTY = 10;

export function merchBatchOpen(now = Date.now()): boolean {
  return now <= new Date(`${MERCH_BATCH.closesOn}T23:59:59+01:00`).getTime();
}

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export type DeliveryAddress = { fullName: string; phone: string; street: string; city: string; state: string };

// Shared by the checkout form (friendly errors) and the server (enforcement).
export function validateAddress(a: Partial<DeliveryAddress> | undefined): string | null {
  if (!a) return "Enter a delivery address.";
  const fullName = String(a.fullName ?? "").trim();
  const phone = String(a.phone ?? "").replace(/[\s-]/g, "");
  const street = String(a.street ?? "").trim();
  const city = String(a.city ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) return "Enter the recipient's full name.";
  if (!/^(\+234|0)\d{10}$/.test(phone)) return "Enter a valid Nigerian phone number (e.g. 08012345678).";
  if (street.length < 5 || street.length > 200) return "Enter the street address.";
  if (city.length < 2 || city.length > 80) return "Enter the city or town.";
  if (!NIGERIAN_STATES.includes(String(a.state ?? ""))) return "Choose a state.";
  return null;
}

export type LogoOption = {
  id: string;
  label: string;
  image: string;
};

export const LOGO_OPTIONS: LogoOption[] = [
  { id: "core", label: "Core Mark", image: "/images/brand/notesapp-icon.webp" },
  { id: "valentines", label: "Valentine's Day", image: "/images/seasonal/valentines.webp" },
  { id: "eid-al-fitr", label: "Eid al-Fitr", image: "/images/seasonal/eid-al-fitr.webp" },
  { id: "eid-al-adha", label: "Eid al-Adha", image: "/images/seasonal/eid-al-adha.webp" },
  { id: "igbo-new-yam", label: "Igbo New Yam Festival", image: "/images/seasonal/igbo-new-yam-festival.webp" },
  { id: "eyo", label: "Lagos Eyo Festival", image: "/images/seasonal/lagos-eyo-festival.webp" },
  { id: "calabar", label: "Calabar Carnival", image: "/images/seasonal/calabar-carnival.webp" },
  { id: "argungu", label: "Argungu Fishing Festival", image: "/images/seasonal/arugungu-fishing-festival.webp" },
  { id: "christmas", label: "Christmas", image: "/images/seasonal/christmas.webp" },
];

// A pre-order as stored in merchOrders/{reference}. Written only by the server
// (payment confirmation + /api/admin/merch); the owner and admins can read it.
export type MerchOrderStatus = "preordered" | "printed" | "shipped" | "delivered" | "refunded";
export type MerchOrder = {
  reference: string;
  uid: string;
  email: string;
  itemName: string;
  logoLabel: string;
  size?: string;
  quantity: number;
  amountKobo: number;
  status: MerchOrderStatus;
  batchId: string;
  createdAt: string;
  printedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  courier?: string;
  trackingNumber?: string;
  address: { fullName: string; phone: string; street: string; city: string; state: string };
};

export const MERCH_STEPS: { status: Exclude<MerchOrderStatus, "refunded">; label: string; at: "createdAt" | "printedAt" | "shippedAt" | "deliveredAt" }[] = [
  { status: "preordered", label: "Pre-ordered", at: "createdAt" },
  { status: "printed", label: "Printed", at: "printedAt" },
  { status: "shipped", label: "Shipped", at: "shippedAt" },
  { status: "delivered", label: "Delivered", at: "deliveredAt" },
];
