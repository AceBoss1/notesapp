import { cleanText, normalizePhone } from "./orders";
import { NIGERIAN_STATES } from "./merch";

// Shipments: parcel tracking for logistics businesses (dispatch riders, waybill agents, errand companies) on Business and Enterprise.
// The business books a shipment for its own customer and gets a parcel ID (parcels/{NA-…}, kind "shipment"); its riders hand the
// parcel on with the same no-login links as store orders (/p/<token>), and the receiver follows it on the business's own site
// (Your site → Track, at /track on their domain) or on /track. No order, no payment and no escrow: #NotesApp only keeps the record.
// Pure and client-safe; the server side is lib/shipments-server.ts.

// Logistics businesses differ: some only run errands, some only deliver, some do it all (deliveries, waybills, warehousing and
// errands). Each business picks the services it offers (servicesOf), and only those can be booked and show on its site.
export type ShipmentService = "delivery" | "waybill" | "bulk" | "warehouse" | "errand_home" | "errand_office";
export const SHIPMENT_SERVICES: { id: ShipmentService; name: string; blurb: string }[] = [
  { id: "delivery", name: "Delivery", blurb: "Pick up and drop off in town" },
  { id: "waybill", name: "Waybill", blurb: "Sending or receiving by bus, interstate" },
  { id: "bulk", name: "Bulk delivery", blurb: "Many items or drops for one customer" },
  { id: "warehouse", name: "Warehousing and despatch", blurb: "Kept in your warehouse, despatched when the customer asks" },
  { id: "errand_home", name: "Home errand", blurb: "Shopping, market runs, pick-ups and drop-offs for a household" },
  { id: "errand_office", name: "Office errand", blurb: "Documents, bank runs and office pick-ups" },
];
export const isShipmentService = (v: unknown): v is ShipmentService => SHIPMENT_SERVICES.some((s) => s.id === v);
export const serviceName = (id: string) => SHIPMENT_SERVICES.find((s) => s.id === id)?.name ?? "Delivery";
const ERRANDS: ShipmentService[] = ["errand_home", "errand_office"];
export const isErrand = (id: string) => (ERRANDS as string[]).includes(id);

// The services a business offers, in the list's order. Not chosen yet: all of them.
export const servicesOf = (p: { logistics?: { services?: unknown } } | null | undefined): ShipmentService[] => {
  const chosen = Array.isArray(p?.logistics?.services) ? (p!.logistics!.services as unknown[]) : [];
  const out = SHIPMENT_SERVICES.map((s) => s.id).filter((id) => chosen.includes(id));
  return out.length ? out : SHIPMENT_SERVICES.map((s) => s.id);
};
// A business's choice from a request body: known services only, at least one. Null otherwise.
export function cleanServices(v: unknown): ShipmentService[] | null {
  if (!Array.isArray(v)) return null;
  const out = SHIPMENT_SERVICES.map((s) => s.id).filter((id) => v.includes(id));
  return out.length && v.every(isShipmentService) ? out : null;
}

// On a shipment's parcel: "paid" is the shared first stage (the parcel exists, nobody has picked it up), shown as Booked.
export type ShipmentStatus = "paid" | "dispatched" | "delivered" | "cancelled";
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  paid: "Booked — waiting for pick-up",
  dispatched: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const shipmentOpen = (s: string) => s === "paid" || s === "dispatched";
// The status in words for this service: a warehoused parcel waits in storage, an errand is "on the way" rather than "in transit".
export function shipmentStatusLabel(status: string, service?: string): string {
  if (service === "warehouse" && status === "paid") return "In storage — waiting to be despatched";
  if (service && isErrand(service)) {
    if (status === "paid") return "Booked — a runner will pick it up";
    if (status === "dispatched") return "On the way";
    if (status === "delivered") return "Done — delivered";
  }
  return SHIPMENT_STATUS_LABEL[status as ShipmentStatus] ?? status;
}

export type ShipmentInfo = {
  service: ShipmentService;
  senderName: string;
  receiverName: string;
  receiverPhone: string; // never shown on the public tracking page; the last 4 digits unlock the riders' phone numbers there
  pickup: string; // where it's collected from
  address: string; // the delivery address, for the business and its riders only
  note: string;
  createdBy: string; // uid of the owner or team member who booked it
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
};

export type ShipmentInput = {
  service: ShipmentService; itemTitle: string; quantity: number; senderName: string; receiverName: string; receiverPhone: string;
  pickup: string; address: string; city: string; state: string; note: string;
};
export const SHIPMENT_QTY_MAX = 999;

// What the booking form sends, checked the same way in the browser (friendly errors) and on the server (enforcement).
export function cleanShipment(raw: unknown): { ok: true; value: ShipmentInput } | { ok: false; error: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const service = isShipmentService(b.service) ? b.service : null;
  const itemTitle = cleanText(b.itemTitle, 80);
  const quantity = Number(b.quantity);
  const senderName = cleanText(b.senderName, 60);
  const receiverName = cleanText(b.receiverName, 60);
  const receiverPhone = normalizePhone(b.receiverPhone);
  const pickup = cleanText(b.pickup, 120);
  const address = cleanText(b.address, 200);
  const city = cleanText(b.city, 60);
  const state = String(b.state ?? "");
  const note = cleanText(b.note, 300);
  if (!service) return { ok: false, error: "Choose the service." };
  if (itemTitle.length < 2) return { ok: false, error: "Say what's being sent (for example: 2 cartons of shoes)." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SHIPMENT_QTY_MAX) return { ok: false, error: `The quantity is 1 to ${SHIPMENT_QTY_MAX}.` };
  if (senderName.length < 2) return { ok: false, error: "Enter the sender's name." };
  if (receiverName.length < 2) return { ok: false, error: "Enter the receiver's name." };
  if (!receiverPhone) return { ok: false, error: "Enter the receiver's Nigerian phone number (e.g. 08012345678)." };
  if (pickup.length < 2) return { ok: false, error: "Enter where it's picked up from." };
  if (address.length < 5) return { ok: false, error: "Enter the delivery address." };
  if (city.length < 2) return { ok: false, error: "Enter the city or town it's going to." };
  if (!NIGERIAN_STATES.includes(state)) return { ok: false, error: "Choose the state it's going to." };
  return { ok: true, value: { service, itemTitle, quantity, senderName, receiverName, receiverPhone, pickup, address, city, state, note } };
}

// Where the receiver follows the parcel: the business's own domain when its site shows Track, its site on #NotesApp otherwise, and
// the #NotesApp tracking page when Track is off.
export function trackingLink(o: { siteUrl: string; username: string; domain?: string | null; trackOn: boolean; parcelId: string }): string {
  if (o.trackOn && o.domain) return `https://${o.domain}/track/${o.parcelId}`;
  if (o.trackOn) return `${o.siteUrl}/s/${o.username}/track/${o.parcelId}`;
  return `${o.siteUrl}/track/${o.parcelId}`;
}

// The message the business sends the receiver (WhatsApp or SMS), with the parcel ID and the link.
export function receiverMessage(o: { business: string; receiverName: string; itemTitle: string; parcelId: string; link: string }): string {
  const first = o.receiverName.split(" ")[0];
  return `Hello ${first}, ${o.business} has your parcel (${o.itemTitle}). Your tracking number is ${o.parcelId}. Follow it here: ${o.link}`;
}

// wa.me wants the number in international form without the plus: 0803… → 234803…
export const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.startsWith("0") ? `234${d.slice(1)}` : d; };
