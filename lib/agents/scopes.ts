import { AGENT_SPEND_KOBO, accessDayChoices, actionChoices, discountChoices, type AgentSettings } from "./config";

// What a connected agent may see and do on a member's account (the Connect NotesApp screen, Console → Connected agents), and the one
// function every agent call goes through: decide(). Pure, so the screen, the server and the tests share it.
//
// Fixed rules (owner, 2 Nov 2026) that no member setting can switch off:
//   - publishing a journal and changing a price always ask the member first;
//   - money never moves through an agent, Nana included: refunds, payouts, withdrawals, Boost and purchases are refused, and agents spend ₦0.

export type ReadScope = "read:profile" | "read:posts" | "read:bookings" | "read:orders" | "read:earnings" | "read:messages";
export type AbilityId = "drafts" | "publish" | "bookings" | "store" | "ship";
export type Ask = "never" | "always" | "except_confirmations";
export type Icon = "user" | "doc" | "calendar" | "bag" | "card" | "chat" | "pen" | "up" | "reply" | "tag" | "truck" | "lock";

export const READ_SCOPES: { id: ReadScope; label: string; about: string; on: boolean; icon: Icon }[] = [
  { id: "read:profile", label: "Your profile and plan", about: "Name, bio, links, plan, whether payouts are set up.", on: true, icon: "user" },
  { id: "read:posts", label: "Your journals and drafts", about: "Published journals and drafts, with their stats.", on: true, icon: "doc" },
  { id: "read:bookings", label: "Your bookings and open times", about: "Who booked, when and for what. Never the client's phone or email.", on: true, icon: "calendar" },
  { id: "read:orders", label: "Orders and download sales", about: "Items, amounts and status. Delivery city and state only, not addresses.", on: true, icon: "bag" },
  { id: "read:earnings", label: "Earnings and payouts", about: "What's held, on its way and paid. Off unless you switch it on.", on: false, icon: "card" },
  { id: "read:messages", label: "Your messages", about: "Conversations are private to the people in them. Leave this off unless you want the assistant to answer customers.", on: false, icon: "chat" },
];

export const ASK_LABEL: Record<Ask, string> = { never: "No, just save", always: "Always ask me", except_confirmations: "Ask, except confirmations" };

export const ABILITIES: { id: AbilityId; label: string; about: string; on: boolean; ask: Ask; choices: Ask[]; icon: Icon; fixedNote?: string }[] = [
  { id: "drafts", label: "Write journal drafts", about: "Saved as drafts only. Nobody sees them until you publish.", on: true, ask: "never", choices: ["never", "always"], icon: "pen" },
  { id: "publish", label: "Publish journals", about: "Puts a journal live on your profile and in followers' feeds.", on: true, ask: "always", choices: ["always"], icon: "up", fixedNote: "Publishing always asks you." },
  { id: "bookings", label: "Reply to booking requests", about: "Accept, offer another time or decline, with your booking link.", on: true, ask: "except_confirmations", choices: ["always", "except_confirmations", "never"], icon: "reply" },
  { id: "store", label: "Edit store items", about: "Descriptions, stock and prices. Price changes always ask you.", on: false, ask: "always", choices: ["always", "never"], icon: "tag" },
  { id: "ship", label: "Mark orders as shipped", about: "Adds the courier and tracking number, and tells the buyer.", on: false, ask: "always", choices: ["always", "never"], icon: "truck" },
];
// Shown on every Connect screen, never a switch.
export const MONEY_NOTE = { label: "Move money", about: "Refunds, payouts, withdrawals, Boost and purchases. No agent can do these, Nana included. They stay with you." };

export type AbilityRule = { on: boolean; ask: Ask };
export type GrantLimits = { actionsPerDay: number; discountCapKobo: number; accessDays: number; spendKobo: 0 };
export type GrantPolicy = { scopes: ReadScope[]; abilities: Record<AbilityId, AbilityRule>; limits: GrantLimits };

export const isReadScope = (v: unknown): v is ReadScope => READ_SCOPES.some((s) => s.id === v);
const abilityDef = (id: AbilityId) => ABILITIES.find((a) => a.id === id)!;

export function defaultGrant(s: AgentSettings): GrantPolicy {
  return {
    scopes: READ_SCOPES.filter((r) => r.on).map((r) => r.id),
    abilities: Object.fromEntries(ABILITIES.map((a) => [a.id, { on: a.on, ask: a.ask }])) as Record<AbilityId, AbilityRule>,
    limits: { actionsPerDay: s.actionsPerDay, discountCapKobo: s.discountCapNaira * 100, accessDays: s.accessDays, spendKobo: AGENT_SPEND_KOBO },
  };
}

// What a member chose on the Connect screen or in Edit permissions, made safe: known scopes only, each ability's ask among its choices
// (publishing can only be "always"), limits among the offered choices (else the default), spend fixed at ₦0.
export function cleanGrant(input: unknown, s: AgentSettings): GrantPolicy {
  const d = defaultGrant(s);
  const i = (input && typeof input === "object" ? input : {}) as Partial<{ scopes: unknown; abilities: Record<string, Partial<AbilityRule>>; limits: Record<string, unknown> }>;
  const scopes = Array.isArray(i.scopes) ? [...new Set(i.scopes.filter(isReadScope))] : d.scopes;
  const abilities = { ...d.abilities };
  for (const a of ABILITIES) {
    const r = i.abilities?.[a.id];
    if (!r || typeof r !== "object") continue;
    abilities[a.id] = { on: r.on === true, ask: a.choices.includes(r.ask as Ask) ? (r.ask as Ask) : a.ask };
  }
  const pick = (v: unknown, choices: number[], dflt: number) => (choices.includes(Number(v)) ? Number(v) : dflt);
  const l = i.limits ?? {};
  return {
    scopes,
    abilities,
    limits: {
      actionsPerDay: pick(l.actionsPerDay, actionChoices(s), d.limits.actionsPerDay),
      discountCapKobo: pick(Number(l.discountCapKobo) / 100, discountChoices(s), s.discountCapNaira) * 100,
      accessDays: pick(l.accessDays, accessDayChoices(s), d.limits.accessDays),
      spendKobo: AGENT_SPEND_KOBO,
    },
  };
}

// Which tool needs what. Reading tools need a read scope; changing tools an ability.
export const TOOL_NEEDS: Record<string, { scope?: ReadScope; ability?: AbilityId }> = {
  my_profile: { scope: "read:profile" }, my_posts: { scope: "read:posts" }, my_bookings: { scope: "read:bookings" }, my_orders: { scope: "read:orders" },
  my_earnings: { scope: "read:earnings" }, my_messages: { scope: "read:messages" },
  create_draft: { ability: "drafts" }, publish_post: { ability: "publish" }, reply_booking: { ability: "bookings" }, update_store_item: { ability: "store" }, mark_shipped: { ability: "ship" },
};
// Anything that sounds like moving money is refused outright, whatever the tool list says (defence in depth).
const MONEY = /(refund|payout|withdraw|transfer|purchase|checkout|boost|top_?up|send_money|pay_|_pay\b|wallet|buy_)/i;
export const isMoneyMoving = (tool: string) => MONEY.test(tool);

export type Decision =
  | { kind: "allow" }
  | { kind: "ask"; why: string }
  | { kind: "deny"; code: "money" | "not_allowed" | "discount"; reason: string };

// One agent call against the member's rules. ctx: a booking confirmation (reply_booking with action confirm), a price change, a discount offered.
export function decide(p: GrantPolicy, tool: string, ctx: { confirmation?: boolean; priceChange?: boolean; discountKobo?: number } = {}): Decision {
  if (isMoneyMoving(tool)) return { kind: "deny", code: "money", reason: "Agents can't move money on #NotesApp: refunds, payouts, withdrawals, Boost and purchases stay with the member." };
  const need = TOOL_NEEDS[tool];
  if (!need) return { kind: "allow" }; // a public tool (search, profiles, open times)
  if (need.scope) return p.scopes.includes(need.scope) ? { kind: "allow" } : { kind: "deny", code: "not_allowed", reason: `The member hasn't let this assistant use ${need.scope}.` };
  const rule = p.abilities[need.ability!];
  if (!rule?.on) return { kind: "deny", code: "not_allowed", reason: `The member hasn't let this assistant ${abilityDef(need.ability!).label.toLowerCase()}.` };
  if ((ctx.discountKobo ?? 0) > p.limits.discountCapKobo) return { kind: "deny", code: "discount", reason: `That discount is over this assistant's limit (₦${(p.limits.discountCapKobo / 100).toLocaleString("en-NG")}).` };
  if (need.ability === "publish") return { kind: "ask", why: "Publishing always asks the member." };
  if (need.ability === "store" && ctx.priceChange) return { kind: "ask", why: "Price changes always ask the member." };
  if (rule.ask === "never") return { kind: "allow" };
  if (rule.ask === "except_confirmations" && ctx.confirmation) return { kind: "allow" };
  return { kind: "ask", why: rule.ask === "except_confirmations" ? "The member's rule: booking replies ask first, confirmations go." : "The member's rule: this asks first." };
}

// "If you connect now": how many things it sees, does, and asks about first.
export function grantCounts(p: GrantPolicy): { sees: number; does: number; asks: number } {
  const on = ABILITIES.filter((a) => p.abilities[a.id]?.on);
  return { sees: p.scopes.length, does: on.length, asks: on.filter((a) => p.abilities[a.id].ask !== "never" || a.id === "publish").length };
}

// "Publishing journals · replies to new booking requests (confirmations go without asking)": what always asks, for Console.
export function askSummary(p: GrantPolicy): string {
  const parts: string[] = [];
  for (const a of ABILITIES) {
    const r = p.abilities[a.id];
    if (!r?.on) continue;
    if (a.id === "publish") parts.push("publishing journals");
    else if (a.id === "store") parts.push(r.ask === "always" ? "store edits" : "price changes");
    else if (r.ask === "always") parts.push(a.id === "bookings" ? "replies to booking requests" : a.id === "drafts" ? "journal drafts" : "marking orders shipped");
    else if (r.ask === "except_confirmations") parts.push("replies to new booking requests (confirmations go without asking)");
  }
  const s = parts.join(" · ") || "nothing it can change";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The short labels Console shows for a grant: read:posts, write:posts · asks to publish …
export function scopeChips(p: GrantPolicy): { label: string; write: boolean }[] {
  const chips: { label: string; write: boolean }[] = p.scopes.map((s) => ({ label: s, write: false }));
  const w: Record<AbilityId, string> = { drafts: "write:posts", publish: "write:posts", bookings: "write:bookings", store: "write:store", ship: "write:orders" };
  const seen = new Set<string>();
  for (const a of ABILITIES) {
    const r = p.abilities[a.id];
    if (!r?.on) continue;
    const base = w[a.id];
    const asks = a.id === "publish" ? " · asks to publish" : r.ask === "always" || r.ask === "except_confirmations" ? " · asks" : "";
    if (seen.has(base)) {
      const prev = chips.find((c) => c.label.startsWith(base));
      if (prev && asks && !prev.label.includes("asks")) prev.label = `${base}${asks}`;
      continue;
    }
    seen.add(base);
    chips.push({ label: `${base}${asks}`, write: true });
  }
  return chips;
}
