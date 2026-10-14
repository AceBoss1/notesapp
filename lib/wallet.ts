// NotesApp Credit: a prepaid balance a member tops up through Paystack and spends across #NotesApp (and, later, Notes Life).
// Shared rules for the server, the screens and the tests. Amounts are in kobo.
//
// - Credit can't be withdrawn or sent to another member. Sellers and publishers are still paid to their bank accounts.
// - Bonus Credits come with larger top-ups, last BONUS_DAYS, are spent before credit (soonest-ending first), and only on
//   BONUS_KINDS (boosts, verification badges, advert banners; calls once paid calls exist).
// - Refunds of a wallet payment go back to the wallet, the bonus share as a fresh bonus lot.

export const WALLET_LIVE = process.env.NEXT_PUBLIC_WALLET_LIVE !== "false";

export const TOPUP_MIN_KOBO = 1_000 * 100;
export const TOPUP_MAX_KOBO = 500_000 * 100;
export const BONUS_DAYS = 90;
export const TOPUP_PRESETS_NAIRA = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000];

// The bonus for the largest step a top-up reaches (₦30,000 gets the ₦20,000 step's bonus).
export const BONUS_STEPS: { fromKobo: number; bonusKobo: number }[] = [
  { fromKobo: 5_000 * 100, bonusKobo: 250 * 100 },
  { fromKobo: 10_000 * 100, bonusKobo: 700 * 100 },
  { fromKobo: 20_000 * 100, bonusKobo: 2_000 * 100 },
  { fromKobo: 50_000 * 100, bonusKobo: 6_000 * 100 },
];
export function bonusFor(topupKobo: number): number {
  let b = 0;
  for (const s of BONUS_STEPS) if (topupKobo >= s.fromKobo) b = s.bonusKobo;
  return b;
}

// What can be paid from the wallet, and which of those may use Bonus Credits.
export const WALLET_KINDS = ["boost", "ad", "badge", "gift", "store", "digital", "booking", "life_naira"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];
export const BONUS_KINDS: readonly string[] = ["boost", "ad", "badge"];
export const isWalletKind = (k: unknown): k is WalletKind => typeof k === "string" && (WALLET_KINDS as readonly string[]).includes(k);

export type BonusLot = { id: string; kobo: number; expiresAt: string; source: "topup" | "refund" | "adjust" };
export type Wallet = { creditKobo: number; bonusLots: BonusLot[] };
export const EMPTY_WALLET: Wallet = { creditKobo: 0, bonusLots: [] };

export const liveLots = (w: Wallet, now = new Date()) => w.bonusLots.filter((l) => l.kobo > 0 && Date.parse(l.expiresAt) > now.getTime());
export const bonusBalance = (w: Wallet, now = new Date()) => liveLots(w, now).reduce((n, l) => n + l.kobo, 0);

export type Split = { bonusKobo: number; creditKobo: number; lots: { id: string; kobo: number }[] };

// How a payment would be taken: bonus first (if this kind allows it, soonest-ending lot first), then credit. Null if it doesn't cover it.
export function splitSpend(w: Wallet, amountKobo: number, bonusAllowed: boolean, now = new Date()): Split | null {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) return null;
  let left = amountKobo;
  const lots: { id: string; kobo: number }[] = [];
  if (bonusAllowed) {
    for (const l of [...liveLots(w, now)].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))) {
      if (!left) break;
      const use = Math.min(l.kobo, left);
      lots.push({ id: l.id, kobo: use });
      left -= use;
    }
  }
  if (left > w.creditKobo) return null;
  const bonusKobo = amountKobo - left;
  return { bonusKobo, creditKobo: left, lots };
}

// The wallet after taking a split (expired lots dropped).
export function applySpend(w: Wallet, s: Split, now = new Date()): Wallet {
  const used = new Map(s.lots.map((l) => [l.id, l.kobo]));
  return {
    creditKobo: w.creditKobo - s.creditKobo,
    bonusLots: liveLots(w, now).map((l) => ({ ...l, kobo: l.kobo - (used.get(l.id) ?? 0) })).filter((l) => l.kobo > 0),
  };
}

// A refund of `amountKobo` out of a wallet payment that took `debit`: back in the same proportions (the bonus share as bonus).
export function refundSplit(debit: { creditKobo: number; bonusKobo: number }, alreadyKobo: number, amountKobo?: number): { creditKobo: number; bonusKobo: number } {
  const total = debit.creditKobo + debit.bonusKobo;
  const left = Math.max(0, total - alreadyKobo);
  const amt = Math.min(left, amountKobo === undefined ? left : Math.max(0, Math.round(amountKobo)));
  if (!amt || !total) return { creditKobo: 0, bonusKobo: 0 };
  const bonusKobo = Math.min(debit.bonusKobo, Math.round((amt * debit.bonusKobo) / total));
  return { creditKobo: amt - bonusKobo, bonusKobo };
}

export type WalletTxType = "topup" | "spend" | "refund" | "bonus_expired" | "topup_refund";
export type WalletTx = {
  uid: string; type: WalletTxType; creditKobo: number; bonusKobo: number; // signed: + into the wallet, − out of it
  label: string; reference?: string; kind?: string; held?: boolean; at: string;
};

export const nairaOf = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: kobo % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// The "wallet or card?" chooser (components/PayChooser.tsx), opened from lib/checkout.ts.
export const PAY_EVENT = "notesapp:choose-payment";
export type PayAsk = { kind: string; amountKobo?: number; creditKobo: number; bonusKobo: number };
