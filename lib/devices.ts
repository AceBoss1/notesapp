// NotesPhone (owner, 19 Nov 2026; docs/DEVICES.md): phones in #NotesApp's name, made with a white-label partner. Pure and client-safe:
// the page (app/(main)/devices, served at devices.<domain>), the reservation form and the server (lib/leads-server.ts
// submitDeviceReservation) share it.
//
// Nothing is on sale. E Pro is the first model; the others wait for research and development in 2027. Reserving is free and
// commits no one: a model is ordered from the factory once MOQ people have reserved it. No price or date is shown until the partner
// confirms them, and the partner is not named on the page until the agreement is signed (PARTNER_NAMED).
export const DEVICES_PATH = "/devices";
export const MOQ = 500; // the factory's minimum order per model
export const PARTNER_NAMED = false;
// Reservations an hour, per address and per member (the route's rate limit).
export const RESERVE_LIMIT = { max: 6, windowSec: 3600 } as const;

export type DeviceStatus = "first" | "2027";
export type Device = {
  id: "e-pro" | "e-ultra" | "e-ultra-plus" | "e-prestige";
  name: string;
  line: string;
  about: string;
  status: DeviceStatus;
  // The planned specification; it may change before launch. Empty until the partner confirms it.
  specs: [label: string, value: string][];
};
export const DEVICES: Device[] = [
  {
    id: "e-pro", name: "NotesPhone E Pro", line: "Flagship performance, #NotesApp built in.", status: "first",
    about: "Our first phone. A fast 5G flagship with a 200 MP camera and a big AMOLED screen, with #NotesApp built into the phone itself: your journal, calls, Market, Academy and Nana from the moment you switch it on.",
    specs: [
      ["Processor", "MediaTek Dimensity 9000"],
      ["Display", "6.7\" AMOLED, 2520 × 1080"],
      ["Rear cameras", "200 MP + 32 MP + 8 MP + 2 MP"],
      ["Front camera", "50 MP"],
      ["Memory", "16 GB + 1 TB, or 12 GB + 256 GB"],
      ["Battery", "5000 mAh, 67 W fast charging"],
      ["Security", "Face unlock, fingerprint"],
      ["Connectivity", "NFC, Wi-Fi, Bluetooth, GPS, FM, USB-C"],
      ["Networks", "5G · 4G LTE · 3G · 2G"],
    ],
  },
  {
    id: "e-ultra", name: "NotesPhone E Ultra", line: "For creators: an expandable lens.", status: "2027",
    about: "Made for creators, with an expandable lens for photos and video you'd normally need a separate camera for. Being designed now; launch date to be announced in 2027.",
    specs: [],
  },
  {
    id: "e-ultra-plus", name: "NotesPhone E Ultra+", line: "For creators: expandable lens and a robotic camera.", status: "2027",
    about: "Everything in E Ultra, with a robotic camera module that follows the shot. Being designed now; launch date to be announced in 2027.",
    specs: [],
  },
  {
    id: "e-prestige", name: "NotesPhone E Prestige", line: "Hand-finished, for the biggest players.", status: "2027",
    about: "Our most exclusive phone, finished by hand. Launch date to be announced in 2027.",
    specs: [],
  },
];
export const isDeviceId = (v: unknown): v is Device["id"] => DEVICES.some((d) => d.id === v);
export const deviceName = (id: string) => DEVICES.find((d) => d.id === id)?.name ?? id;

// The colours asked for (not yet confirmed by the factory). A reservation can name one, so the first order matches what people want.
export const COLOURS = [
  { id: "ivory", label: "Ivory", swatch: "#F4EEDF" },
  { id: "crimson", label: "Crimson", swatch: "#A6093D" },
  { id: "maroon", label: "Maroon", swatch: "#5E0A24" },
  { id: "silver", label: "Silver", swatch: "#C9CBCF" },
  { id: "gold", label: "Gold", swatch: "#C9A24B" },
  { id: "black", label: "Black", swatch: "#1A1716" },
] as const;
export type ColourId = (typeof COLOURS)[number]["id"] | "any";
export const colourLabel = (id: string) => (id === "any" ? "Any colour" : COLOURS.find((c) => c.id === id)?.label ?? id);

export type Reservation = { model: Device["id"]; colour: ColourId; city: string; notify: boolean };
const text = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
export type CheckedReservation = { ok: true; value: Reservation & { name: string; email: string } } | { ok: false; error: string };

// What the server keeps from a reservation, or why it can't.
export function checkReservation(raw: unknown): CheckedReservation {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(o.name, 100);
  const email = text(o.email, 200).toLowerCase();
  if (!name) return { ok: false, error: "Tell us your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter your email address." };
  if (!isDeviceId(o.model)) return { ok: false, error: "Choose a phone." };
  const colour: ColourId = o.colour === "any" || COLOURS.some((c) => c.id === o.colour) ? (o.colour as ColourId) : "any";
  const city = text(o.city, 80);
  if (!city) return { ok: false, error: "Tell us your city or town." };
  return { ok: true, value: { name, email, model: o.model, colour, city, notify: o.notify !== false } };
}

// The lead's message: the answers as plain words, so a reservation reads well anywhere a lead is shown.
export function reservationMessage(r: Reservation): string {
  return [`Phone: ${deviceName(r.model)}`, `Colour: ${colourLabel(r.colour)}`, `City: ${r.city}`, `Email me news: ${r.notify ? "yes" : "no"}`].join("\n");
}
// How far a model is from being ordered.
export const moqProgress = (count: number) => ({ count, left: Math.max(0, MOQ - count), reached: count >= MOQ, pct: Math.min(100, Math.round((count / MOQ) * 100)) });
