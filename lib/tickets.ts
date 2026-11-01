// Paid event tickets with QR check-in (docs/COMMUNITY.md, phase 2). Pure: the ticket types an organiser sets, what's left, the codes
// on tickets and reading one back from a scan. The server side is lib/tickets-server.ts; payment is lib/payments.ts (kind "ticket").
//
// eventTickets/{eventId}: { eventId, hostUid, types: TicketType[] } — kept apart from events/{id} so editing the event never touches
// the sold counts. tickets/{code}: one per admission (TicketDoc). Both server-only.

export const TICKET_TYPES_MAX = 10;
export const TICKETS_PER_ORDER_MAX = 10;
export const TICKET_PRICE_MIN_KOBO = 100 * 100;
export const TICKET_PRICE_MAX_KOBO = 1_000_000 * 100;
export const TICKET_QTY_MAX = 100_000;

export type TicketType = { id: string; name: string; priceKobo: number; quantity: number; sold: number };
export type TicketDoc = {
  code: string; eventId: string; eventTitle: string; typeId: string; typeName: string; priceKobo: number;
  holderUid: string; holderName: string; reference: string; startsAt: string; endsAt: string;
  status: "valid" | "refunded"; checkedInAt?: string; checkedInBy?: string; createdAt: string;
};

export const ticketsLeft = (t: Pick<TicketType, "quantity" | "sold">) => Math.max(0, t.quantity - t.sold);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

// What an organiser sends, checked against what's already sold: a type that has sold can't be removed or go below what's sold.
export function cleanTicketTypes(v: unknown, current: TicketType[]): { ok: true; types: TicketType[] } | { ok: false; error: string } {
  const list = Array.isArray(v) ? v : [];
  if (list.length > TICKET_TYPES_MAX) return { ok: false, error: `Up to ${TICKET_TYPES_MAX} ticket types.` };
  const out: TicketType[] = [];
  const ids = new Set<string>();
  for (const raw of list) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = String(o.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) return { ok: false, error: "Give each ticket type a name (for example Regular or VIP)." };
    const naira = Number(o.priceNaira ?? (Number(o.priceKobo) / 100));
    const priceKobo = Math.round(naira * 100);
    if (!Number.isFinite(naira) || priceKobo < TICKET_PRICE_MIN_KOBO || priceKobo > TICKET_PRICE_MAX_KOBO) return { ok: false, error: `${name}: a price from ₦100 to ₦1,000,000.` };
    const quantity = Number(o.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > TICKET_QTY_MAX) return { ok: false, error: `${name}: how many tickets (1 or more).` };
    const prev = current.find((c) => c.id === o.id);
    let id = prev ? prev.id : slug(name) || "ticket";
    if (!prev) { let n = 2; const base = id; while (ids.has(id) || current.some((c) => c.id === id)) id = `${base}-${n++}`; }
    if (ids.has(id)) return { ok: false, error: "Each ticket type once." };
    ids.add(id);
    const sold = prev?.sold ?? 0;
    if (quantity < sold) return { ok: false, error: `${name}: ${sold} already sold, so at least ${sold}.` };
    out.push({ id, name, priceKobo, quantity, sold });
  }
  const dropped = current.find((c) => c.sold > 0 && !ids.has(c.id));
  if (dropped) return { ok: false, error: `${dropped.name} has tickets sold, so it can't be removed. Set its number to what's sold to stop selling it.` };
  return { ok: true, types: out };
}

// Ticket codes: 10 letters and digits that can't be mistaken for each other (no 0/O, 1/I/L), in groups of 5 to read out at the door.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function makeTicketCode(randomBytes: (n: number) => Uint8Array): string {
  const b = randomBytes(10);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}
export const showCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;
// The check-in link a ticket's QR holds; scanning it with a phone camera opens the organiser's check-in page with the code filled in.
export const checkInPath = (eventId: string, code: string) => `/events/${eventId}/checkin?code=${code}`;
// A code from what was typed or scanned (the code, with or without its dash, or the check-in link).
export function readTicketCode(input: string): string {
  const s = String(input ?? "").trim();
  const fromUrl = s.match(/[?&]code=([A-Za-z0-9-]+)/);
  const raw = (fromUrl ? fromUrl[1] : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[2-9A-HJKMNP-Z]{10}$/.test(raw) ? raw : "";
}
