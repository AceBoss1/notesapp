// Invitations to an event or a meeting (docs/EVENTS_DISCOVER.md; owner approved 26 Nov 2026). Pure. A host invites their followers and
// people by email; each person invited counts toward the host's week (Monday to Sunday, Lagos time), up to their plan's allowance plus
// any add-on pack. Messages to people already going or booked are always unlimited (reminders, changes). Allowances and pack prices are
// in Admin → Pricing (lib/pricing.ts invites). The server side is lib/event-invites-server.ts.
import type { PricingConfig } from "./pricing";

export const INVITE_PACKS = [
  { id: "10k", sends: 10_000, priceKey: "pack10kKobo" },
  { id: "25k", sends: 25_000, priceKey: "pack25kKobo" },
  { id: "50k", sends: 50_000, priceKey: "pack50kKobo" },
] as const;
export type InvitePackId = (typeof INVITE_PACKS)[number]["id"];
export const isPackId = (v: unknown): v is InvitePackId => INVITE_PACKS.some((p) => p.id === v);
export const packOf = (id: unknown) => INVITE_PACKS.find((p) => p.id === id) ?? null;
export const PACK_DAYS = 31;
export const EMAILS_PER_SEND = 500; // pasted addresses in one go
export const INVITE_MESSAGE_MAX = 500;

// The week an invitation counts in: the Monday it falls in, Lagos time (UTC+1), as "2026-11-23".
export function weekOf(now: Date): string {
  const lagos = new Date(now.getTime() + 3_600_000);
  const dow = (lagos.getUTCDay() + 6) % 7; // Monday 0
  const monday = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - dow));
  return monday.toISOString().slice(0, 10);
}
// The plan's weekly allowance (Free Standard and Free Basic share Free Basic's), plus a pack while it runs.
export function allowanceFor(tier: string, cfg: PricingConfig["invites"], pack?: { sends: number; until: string } | null, now = new Date()): number {
  const base = tier === "enterprise" ? cfg.perWeekEnterprise : tier === "business" ? cfg.perWeekBusiness : tier === "pro" ? cfg.perWeekPro : cfg.perWeekBasic;
  const extra = pack && Date.parse(pack.until) > now.getTime() ? pack.sends : 0;
  return base + extra;
}

// Pasted email addresses, made safe: one per line, comma or space; lower-cased, deduplicated, at most EMAILS_PER_SEND.
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
export function cleanEmails(raw: unknown): { emails: string[]; skipped: number } {
  const parts = String(raw ?? "").toLowerCase().split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const ok = [...new Set(parts.filter((x) => EMAIL.test(x) && x.length <= 200))];
  return { emails: ok.slice(0, EMAILS_PER_SEND), skipped: parts.length - Math.min(ok.length, EMAILS_PER_SEND) };
}
export const cleanMessage = (v: unknown) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, INVITE_MESSAGE_MAX);

// Who gets invited this time: everyone asked, minus people already in and duplicates, cut to what's left of the week.
export function pickRecipients(asked: { uids: string[]; emails: string[] }, already: Set<string>, left: number): { uids: string[]; emails: string[]; cut: number } {
  const uids = [...new Set(asked.uids)].filter((u) => !already.has(u));
  const emails = [...new Set(asked.emails)];
  const total = uids.length + emails.length;
  const room = Math.max(0, left);
  const takeU = Math.min(uids.length, room);
  const takeE = Math.min(emails.length, room - takeU);
  return { uids: uids.slice(0, takeU), emails: emails.slice(0, takeE), cut: total - takeU - takeE };
}
