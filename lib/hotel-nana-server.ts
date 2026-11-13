import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { aiCandidates, chargePlatform, nanaModel } from "./nana-server";
import { NANA_LANGUAGES, accountsGrounded, addonOn, hasFeature, naira, priceLines, pricesGrounded, t, targetText, type Order } from "./hotel";
import { HotelError, availability, createBooking, createOrder, hotelById, menuAt, type HotelRec } from "./hotel-server";
import { guestUrl, startPay } from "./hotel-pay-server";

// Nana takes orders and bookings by chat (Hotel Grand on the website; the WhatsApp ordering add-on on the hotel's own number). She uses
// tools that read the live menu and rooms and place the order; every price, total, room and account number she gives comes from a tool
// result, never from the model. A reply that states a figure no tool returned is replaced by the tool's own words (pricesGrounded in
// lib/hotel.ts). She answers in English, Nigerian Pidgin, Yorùbá, Igbo or Hausa, as the guest writes. Every chat, with her steps and the
// order it made, is kept in hotelChats for Conversations.
//
// Who pays for the AI: the hotel owner's own connected AI account (lib/ai-connect.ts), then #NotesApp's, within the daily limits.

export type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ModelReply = { content: Block[]; stop_reason: string | null };
export type ModelArgs = { apiKey: string; model: string; system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[]; maxTokens: number };
export type NanaHotelDeps = { create: (a: ModelArgs) => Promise<ModelReply>; now: () => Date; pay?: typeof startPay };
const realCreate: NanaHotelDeps["create"] = async ({ apiKey, model, system, messages, tools, maxTokens }) => {
  const res = await new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 }).messages.create({ model, system, messages, tools, max_tokens: maxTokens });
  return { content: res.content.filter((b) => b.type === "text" || b.type === "tool_use").map((b) => (b.type === "text" ? { type: "text" as const, text: b.text } : { type: "tool_use" as const, id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> })), stop_reason: res.stop_reason };
};
export const liveNanaDeps = (): NanaHotelDeps => ({ create: realCreate, now: () => new Date() });

export const TOOLS: Anthropic.Tool[] = [
  { name: "list_menu", description: "The live menu of one department (or of every department when none is given): item ids, names, prices and what is sold out.", input_schema: { type: "object", properties: { department: { type: "string", description: "The department's id or name, e.g. grill" } } } },
  { name: "check_rooms", description: "Rooms free for the dates, with the price a night and the total for the stay.", input_schema: { type: "object", properties: { check_in: { type: "string", description: "YYYY-MM-DD" }, check_out: { type: "string", description: "YYYY-MM-DD" } }, required: ["check_in", "check_out"] } },
  { name: "quote_order", description: "The total for an order, priced from the menu. Use it to read the order back to the guest before placing it.", input_schema: { type: "object", properties: { department: { type: "string" }, items: { type: "array", items: { type: "object", properties: { item_id: { type: "string" }, qty: { type: "integer" } }, required: ["item_id", "qty"] } } }, required: ["department", "items"] } },
  { name: "place_order", description: "Place a food or drink order the guest has confirmed. Returns the order number, the total and how to pay.", input_schema: { type: "object", properties: {
    department: { type: "string" }, items: { type: "array", items: { type: "object", properties: { item_id: { type: "string" }, qty: { type: "integer" } }, required: ["item_id", "qty"] } },
    deliver_to: { type: "string", enum: ["room", "table", "pickup"] }, room_or_table: { type: "string" }, name: { type: "string" }, phone: { type: "string" },
    pay: { type: "string", enum: ["online", "transfer", "room_bill"] }, room_bill_code: { type: "string" }, guest_confirmed: { type: "boolean", description: "true only after the guest said yes to the order as read back" },
  }, required: ["department", "items", "deliver_to", "pay", "guest_confirmed"] } },
  { name: "book_room", description: "Book a room the guest has confirmed, held while they pay. Returns the booking link and the total.", input_schema: { type: "object", properties: {
    room_id: { type: "string" }, check_in: { type: "string" }, check_out: { type: "string" }, guests: { type: "integer" }, name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
    pay: { type: "string", enum: ["online", "transfer"] }, guest_confirmed: { type: "boolean" },
  }, required: ["room_id", "check_in", "check_out", "name", "phone", "email", "guest_confirmed"] } },
  { name: "order_status", description: "Where an order stands, by its number (like #G-121).", input_schema: { type: "object", properties: { number: { type: "string" } }, required: ["number"] } },
];

type ToolOut = { say: string; orderId?: string };
async function runTool(db: Firestore, h: HotelRec, name: string, input: Record<string, unknown>, ctx: { channel: "site" | "whatsapp"; chatId: string; phone?: string; now: Date; pay: typeof startPay }): Promise<ToolOut> {
  const deptOf = (v: unknown) => { const s = String(v ?? "").toLowerCase(); return h.departments.find((d) => d.open && (d.id === s || d.name.toLowerCase() === s)); };
  try {
    if (name === "list_menu") {
      const d = input.department ? deptOf(input.department) : null;
      const items = (await menuAt(db, h.id)).filter((m) => (d ? m.deptId === d.id : h.departments.some((x) => x.open && x.id === m.deptId)));
      if (!items.length) return { say: "There's nothing on that menu right now." };
      return { say: items.map((m) => `${m.id} | ${h.departments.find((x) => x.id === m.deptId)?.name} | ${m.name} | ${naira(m.priceKobo)}${m.soldOut ? " | SOLD OUT" : ""}`).join("\n") };
    }
    if (name === "check_rooms") {
      const rooms = await availability(db, h.id, input.check_in, input.check_out, ctx.now);
      return { say: rooms.map((r) => `${r.id} | ${r.name} | ${naira(r.priceKobo)} a night | ${r.nights} night(s) total ${naira(r.totalKobo)} | ${r.left > 0 ? `${r.left} free` : "full"}`).join("\n") || "No rooms are listed." };
    }
    const lines = (Array.isArray(input.items) ? input.items : []).map((x) => ({ itemId: String((x as Record<string, unknown>).item_id ?? ""), qty: Number((x as Record<string, unknown>).qty) }));
    if (name === "quote_order") {
      const d = deptOf(input.department);
      if (!d) return { say: "That department isn't taking orders." };
      const menu = (await menuAt(db, h.id)).filter((m) => m.deptId === d.id);
      const p = priceLines(lines, menu, d.id);
      return { say: p.ok ? `${p.lines.map((l) => `${l.qty} × ${l.name} (${naira(l.unitKobo)})`).join(", ")}. Total ${naira(p.totalKobo)}.` : p.error };
    }
    if (name === "place_order") {
      if (input.guest_confirmed !== true) return { say: "Read the order and total back to the guest and ask them to confirm first." };
      const d = deptOf(input.department);
      if (!d) return { say: "That department isn't taking orders." };
      const o: Order = await createOrder(db, h.id, {
        deptId: d.id, lines, target: { kind: input.deliver_to, value: input.room_or_table ?? "" }, name: input.name || "Guest", phone: input.phone || ctx.phone || "", pay: input.pay,
        stayCode: input.room_bill_code, chatId: ctx.chatId,
      }, ctx.channel === "whatsapp" ? "whatsapp" : "nana", ctx.now);
      const head = `Order ${o.number} placed: ${o.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")} to ${targetText(o.target)}. Total ${naira(o.totalKobo)}.`;
      if (o.payMethod === "room_bill") return { say: `${head} It's on the room bill and the ${o.deptName.toLowerCase()} has it.`, orderId: o.id };
      if (o.payMethod === "transfer") {
        const r = await ctx.pay(db, { target: "order", id: o.id, code: o.code, method: "transfer", email: `${o.code.toLowerCase()}@guests.invalid` }, undefined, ctx.now).catch(() => null);
        if (r && "account" in r && r.account) return { say: `${head} Pay ${naira(r.amountKobo)} by transfer to ${r.account.bankName} ${r.account.accountNumber} (${r.account.accountName}). It turns paid by itself when the money lands. Track it: ${guestUrl(o.code)}`, orderId: o.id };
      }
      return { say: `${head} Pay here to send it to the ${o.deptName.toLowerCase()}: ${guestUrl(o.code)}`, orderId: o.id };
    }
    if (name === "book_room") {
      if (input.guest_confirmed !== true) return { say: "Read the room, dates and total back to the guest and ask them to confirm first." };
      const b = await createBooking(db, h.id, { roomId: input.room_id, checkIn: input.check_in, checkOut: input.check_out, guests: input.guests, name: input.name, phone: input.phone || ctx.phone, email: input.email, pay: input.pay === "transfer" ? "transfer" : "online" }, ctx.now);
      return { say: `Booking held: ${b.roomName}, ${b.checkIn} to ${b.checkOut}, ${b.nights} night(s), total ${naira(b.totalKobo)}. Pay here to confirm it before the hold runs out: ${guestUrl(b.code)}` };
    }
    if (name === "order_status") {
      const n = String(input.number ?? "").trim().replace(/^#?/, "#").toUpperCase();
      const s = (await db.collection("hotelOrders").where("hotelId", "==", h.id).where("number", "==", n).limit(1).get()).docs[0];
      const o = s?.data() as Order | undefined;
      if (!o || (o.chatId !== ctx.chatId && (!ctx.phone || o.phone !== ctx.phone))) return { say: "I can only check orders placed in this chat." };
      return { say: `${o.number}: ${o.status.replace("_", " ")}.` };
    }
    return { say: "I can't do that." };
  } catch (e) {
    if (e instanceof HotelError) return { say: e.message };
    console.error("[hotel nana] tool failed", name, e instanceof Error ? e.message : e);
    return { say: "That didn't work just now. Try again in a moment." };
  }
}

function systemFor(h: HotelRec, now: Date) {
  return [
    `You are Nana, the ordering assistant for ${h.name}${h.branch ? ` (${h.branch})` : ""}${h.city ? ` in ${h.city}` : ""}, on #NotesApp. Today is ${now.toISOString().slice(0, 10)}.`,
    `You take food and drink orders from the hotel's departments (${h.departments.filter((d) => d.open).map((d) => `${d.name} [${d.id}]`).join(", ")}) to a room, a table or for pick-up, and you book rooms.`,
    "Rules:",
    "- Never state a price, total, room or account number yourself. Use the tools and repeat only what they return, word for word.",
    "- Before placing an order or a booking, read it back with the total from quote_order or check_rooms, and ask the guest to confirm. Only then call place_order or book_room with guest_confirmed true.",
    "- Room-bill orders need the room-bill code the guest got at check-in.",
    `- Reply in the guest's own language: ${NANA_LANGUAGES.join(", ")}. Match how they write (Pidgin to Pidgin).`,
    "- Be short and warm. No markdown tables. If you can't help, say so and suggest the front desk.",
    `- Check-in from ${h.policy.checkIn}, check-out by ${h.policy.checkOut}. Cancellation: ${h.policy.cancellation}`,
  ].join("\n");
}

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type Step = { tool: string; input: string; result: string };
export async function hotelChat(db: Firestore, hotelId: string, raw: { chatId?: unknown; message?: unknown; name?: unknown }, channel: "site" | "whatsapp", deps: NanaHotelDeps, extra: { phone?: string } = {}) {
  const now = deps.now();
  const found = await hotelById(db, hotelId);
  if (!found) throw new HotelError(404, "Hotel not found.");
  const h = found.hotel;
  if (channel === "site" && !hasFeature(found.tier, "nana")) throw new HotelError(402, "Chat ordering isn't on at this hotel.");
  if (channel === "whatsapp" && !addonOn(h.addons, "whatsapp", now)) throw new HotelError(402, "WhatsApp ordering isn't on at this hotel.");
  const message = t(raw.message, 1000);
  if (!message) throw new HotelError(400, "Type a message.");
  const chatId = typeof raw.chatId === "string" && /^[A-Za-z0-9_+-]{8,80}$/.test(raw.chatId) ? raw.chatId : `c_${randomBytes(9).toString("hex")}`;
  const ref = db.doc(`hotelChats/${chatId}`);
  const prior = (await ref.get()).data();
  if (prior && prior.hotelId !== h.id) throw new HotelError(404, "Chat not found.");
  const history: ChatTurn[] = ((prior?.messages ?? []) as ChatTurn[]).slice(-20);
  const steps: Step[] = (prior?.steps ?? []) as Step[];
  if (history.length >= 80) throw new HotelError(429, "This chat is long. Start a new one, or call the front desk.");
  const turn: ChatTurn[] = [...history, { role: "user", text: message }];
  const messages: Anthropic.MessageParam[] = turn.map((m) => ({ role: m.role, content: m.text }));
  const newSteps: Step[] = [];
  let reply = "", orderId = (prior?.orderId as string | undefined) ?? "";
  const keys = await aiCandidates(db, h.ownerUid);
  let key: string | null = null;
  for (const k of keys) { if (k.source === "own" || (await chargePlatform(db, now, h.ownerUid, 400))) { key = k.apiKey; break; } }
  if (!key) reply = "Chat ordering is resting right now. You can still order and book on this page, or call the front desk.";
  else {
    try {
      for (let round = 0; round < 6; round++) {
        const res = await deps.create({ apiKey: key, model: nanaModel(), system: systemFor(h, now), messages, tools: TOOLS, maxTokens: 800 });
        const uses = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
        const text = res.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim();
        if (!uses.length) { reply = text; break; }
        messages.push({ role: "assistant", content: res.content.map((b) => (b.type === "text" ? { type: "text" as const, text: b.text } : { type: "tool_use" as const, id: b.id, name: b.name, input: b.input })) });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const u of uses.slice(0, 4)) {
          const out = await runTool(db, h, u.name, u.input, { channel, chatId, phone: extra.phone, now, pay: deps.pay ?? startPay });
          if (out.orderId) orderId = out.orderId;
          newSteps.push({ tool: u.name, input: JSON.stringify(u.input).slice(0, 600), result: out.say.slice(0, 1500) });
          results.push({ type: "tool_result", tool_use_id: u.id, content: out.say });
        }
        messages.push({ role: "user", content: results });
      }
    } catch (e) {
      console.error("[hotel nana] model failed", e instanceof Error ? e.message : e);
      reply = "";
    }
    const toolText = [...steps, ...newSteps].map((s) => s.result).join("\n");
    // The AI never states a price itself: a figure (or an account number) no tool gave is not sent; the last tool's own words are.
    if (!reply || !pricesGrounded(reply, toolText) || !accountsGrounded(reply, toolText)) {
      const last = newSteps[newSteps.length - 1]?.result;
      reply = last ?? "Sorry, I couldn't answer that just now. You can order and book on this page, or call the front desk.";
    }
  }
  const out: ChatTurn[] = [...turn, { role: "assistant", text: reply }];
  await ref.set({ hotelId: h.id, channel, guest: t(raw.name, 60) || (prior?.guest as string) || extra.phone || "Guest", at: now.toISOString(), startedAt: (prior?.startedAt as string) ?? now.toISOString(), messages: out.slice(-40), steps: [...steps, ...newSteps].slice(-60), ...(orderId ? { orderId } : {}), ...(extra.phone ? { phone: extra.phone } : {}) });
  return { chatId, reply, orderId: orderId || null };
}
