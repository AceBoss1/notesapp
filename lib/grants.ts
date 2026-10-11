import { FinanceError } from "./finance";

// Grants and subscriptions the company holds (free credits, free-period plans) in plain rules. Money here is USD cents because that is how
// providers quote it; the ledger needs naira, so the person recording it enters the exchange rate (nothing is assumed).
export type GrantKind = "credit" | "subscription";
export type GrantStatus = "active" | "ended" | "cancelled";
export type Usage = { on: string; cents: number; note: string };
export type Grant = {
  id: string;
  kind: GrantKind;
  provider: string;
  title: string;
  seats: number;
  seatsUsed: number;
  rateCents: number; // per seat per month, list price (subscriptions)
  months: number;
  valueCents: number; // what the grant is worth in total (credits: the amount; subscriptions: seats × rate × months unless set)
  fxNgn: number; // naira per US dollar, entered by the person
  startsOn: string;
  endsOn: string;
  becomesPaid: boolean; // charges start when the free period ends
  paidRateCents: number; // per seat per month once it becomes paid
  status: GrantStatus;
  notes: string;
  usage: Usage[];
  remindedDays: number[];
  ledgerEntryId?: string;
  createdAt: string;
  createdByEmail: string;
  updatedAt?: string;
};
export type GrantInput = Partial<Record<keyof Grant, unknown>>;

// Reminders go out when a grant is this many days from ending (one message covers every threshold crossed since the last one).
export const REMIND_DAYS = [30, 14, 7, 3, 1, 0];
export const MAX_USAGE = 200;

export const TEMPLATES: { key: string; label: string; input: GrantInput }[] = [
  { key: "claude-credit", label: "Claude API credit", input: { kind: "credit", provider: "Anthropic (Claude Startups)", title: "Claude API program credit", valueCents: 100000, notes: "$1,000 API credits, expire 180 days after the grant." } },
  { key: "claude-team", label: "Claude Team plan", input: { kind: "subscription", provider: "Anthropic (Claude Startups)", title: "Claude Team plan, 12 months", seats: 2, months: 12, rateCents: 3000, valueCents: 750000, becomesPaid: true, notes: "Offer: up to $625/month off for 12 months, 2-seat minimum. The value is the maximum; confirm the real saving on the invoice." } },
  { key: "moda", label: "Moda Pro", input: { kind: "subscription", provider: "Moda", title: "Moda Pro, 3 months free", seats: 10, months: 3, rateCents: 3000, becomesPaid: true, notes: "10 members. Offer also includes up to $3k AI credits. List price $30/user/month, verify on moda.app/pricing." } },
  { key: "granola", label: "Granola Business", input: { kind: "subscription", provider: "Granola", title: "Granola Business, 3 months free", seats: 10, months: 3, rateCents: 1400, becomesPaid: true, notes: "10 seats. List price $14/user/month, verify on granola.ai/pricing." } },
];

const int = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? String(v) : "");
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const addMonths = (d: string, n: number) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); };
export const daysLeft = (endsOn: string, today: string) => Math.round((Date.parse(`${endsOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
export const usedCents = (g: Pick<Grant, "usage">) => g.usage.reduce((s, u) => s + u.cents, 0);
export const remainingCents = (g: Pick<Grant, "usage" | "valueCents">) => Math.max(0, g.valueCents - usedCents(g));
export const kobo = (cents: number, fxNgn: number) => Math.round(cents * fxNgn);
export const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
// What it costs per month once the free period is over (zero if it doesn't turn paid).
export const monthlyAfter = (g: Pick<Grant, "becomesPaid" | "seats" | "paidRateCents" | "rateCents">) => (g.becomesPaid ? g.seats * (g.paidRateCents || g.rateCents) : 0);

export type CleanGrant = Omit<Grant, "id" | "usage" | "remindedDays" | "createdAt" | "createdByEmail" | "ledgerEntryId" | "updatedAt" | "status">;
export function cleanGrant(input: GrantInput, today: string): CleanGrant {
  const kind: GrantKind = input.kind === "credit" ? "credit" : "subscription";
  const provider = String(input.provider ?? "").trim().slice(0, 80);
  const title = String(input.title ?? "").trim().slice(0, 120);
  if (!provider) throw new FinanceError("Say who the grant is from.");
  if (!title) throw new FinanceError("Give it a name.");
  const startsOn = day(input.startsOn) || today;
  const sub = kind === "subscription";
  const seats = sub ? int(input.seats, 1, 10000) : 0;
  const months = sub ? int(input.months, 1, 60) : 0;
  const rateCents = sub ? int(input.rateCents, 0, 10_000_000) : 0;
  let valueCents = int(input.valueCents, 0, 1_000_000_000);
  if (sub && !valueCents) valueCents = seats * rateCents * months;
  if (!valueCents) throw new FinanceError("Enter what the grant is worth in US dollars.");
  const endsOn = day(input.endsOn) || (sub ? addMonths(startsOn, months) : addDays(startsOn, 180));
  if (endsOn < startsOn) throw new FinanceError("The end date is before the start date.");
  const fx = Number(input.fxNgn);
  const fxNgn = Number.isFinite(fx) && fx > 0 ? Math.round(fx * 100) / 100 : 0;
  const paidRateCents = sub ? int(input.paidRateCents, 0, 10_000_000) : 0;
  return {
    kind, provider, title, seats, seatsUsed: sub ? int(input.seatsUsed, 0, seats) : 0, rateCents, months, valueCents, fxNgn, startsOn, endsOn,
    becomesPaid: sub && input.becomesPaid === true, paidRateCents, notes: String(input.notes ?? "").trim().slice(0, 600),
  };
}

export function cleanUsage(input: { on?: unknown; cents?: unknown; note?: unknown }, today: string): Usage {
  const cents = int(input.cents, 1, 1_000_000_000);
  if (!Number(input.cents) || Number(input.cents) <= 0) throw new FinanceError("Enter how much was used.");
  return { on: day(input.on) || today, cents, note: String(input.note ?? "").trim().slice(0, 200) };
}

// Thresholds newly reached for a grant that is still running and hasn't had them reminded yet. Empty when nothing is due.
export function dueReminders(g: Pick<Grant, "status" | "endsOn" | "remindedDays">, today: string): number[] {
  if (g.status !== "active") return [];
  const left = daysLeft(g.endsOn, today);
  if (left < 0) return [];
  return REMIND_DAYS.filter((d) => left <= d && !g.remindedDays.includes(d));
}

export function reminderText(g: Pick<Grant, "title" | "provider" | "endsOn" | "becomesPaid" | "seats" | "paidRateCents" | "rateCents">, left: number): string {
  const when = left <= 0 ? "ends today" : left === 1 ? "ends tomorrow" : `ends in ${left} days (${g.endsOn})`;
  const after = g.becomesPaid ? ` After that it becomes paid, about ${usd(monthlyAfter(g))} a month. Cancel before it ends if you don't want to be charged.` : "";
  return `${g.title} from ${g.provider} ${when}.${after}`;
}
