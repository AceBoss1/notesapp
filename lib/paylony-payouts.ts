import { getAdminDb } from "./firebase-admin";
import { decryptAccountNumber, accountCryptoConfigured } from "./account-crypto";
import { PaylonyReply, SIGN_FORMATS, SignFormat, bankList, bankTransfer, fetchTransfer, paylonyConfigured, replyCode } from "./paylony";
import { matchBankCode, parseBankList } from "./paylony-banks";
import { ttlCache } from "./ttl-cache";

// Server-only. Sending a publisher payout through Paylony, and settling its result. The provider is chosen in the admin
// (paylonyConfig/main.payoutProvider, default "paystack"); Paylony is used only for an account that has everything it needs.
// Paylony's bank list, cached for six hours.
const paylonyBanks = ttlCache(6 * 3_600_000, async () => parseBankList((await bankList()).body));

// Paylony's code for a bank, found by name; null when Paylony isn't set up or there's no single clear match.
export async function paylonyBankCodeFor(bankName: string): Promise<string | null> {
  if (!paylonyConfigured()) return null;
  try {
    return matchBankCode(await paylonyBanks(), bankName);
  } catch {
    return null;
  }
}

export type PayoutProvider = "paystack" | "paylony";

export type PaylonyConfig = { payoutProvider?: PayoutProvider; signFormat?: SignFormat };

export async function paylonyConfig(): Promise<PaylonyConfig> {
  const d = (await getAdminDb().doc("paylonyConfig/main").get()).data() ?? {};
  return {
    payoutProvider: d.payoutProvider === "paylony" ? "paylony" : "paystack",
    signFormat: SIGN_FORMATS.includes(d.signFormat) ? d.signFormat : undefined,
  };
}

// Codes that mean Paylony definitely did NOT create the transfer, so trying Paystack instead cannot pay twice.
// (09 "already exists" and 99 "possible duplicate" mean it MAY exist, so they are never in this list.)
export const DEFINITE_REFUSAL = new Set(["07", "10", "11", "13", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"]);

export type PaylonyPayoutResult =
  | { state: "sent"; reference: string } // accepted (or already exists): the final result arrives later
  | { state: "refused"; code: string; reason: string } // definitely not created: safe to fall back
  | { state: "uncertain"; reference: string; reason: string }; // may or may not exist: never fall back, check by reference

// Naira as Paylony wants it: "4600", or "4600.50" when there are kobo.
export const nairaString = (kobo: number) => (kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2));

export type PayoutAccountForPaylony = { uid: string; accountName: string; paylonyBankCode?: string };

// Whether this account can be paid through Paylony right now: the admin chose it, the signing format is verified, the keys
// are set, and we hold the full number and Paylony's code for the bank.
export async function canUsePaylony(account: PayoutAccountForPaylony): Promise<boolean> {
  if (!paylonyConfigured() || !process.env.PAYLONY_ENCRYPTION_KEY || !accountCryptoConfigured()) return false;
  const cfg = await paylonyConfig();
  if (cfg.payoutProvider !== "paylony" || !cfg.signFormat || !account.paylonyBankCode) return false;
  return (await getAdminDb().doc(`payoutSecrets/${account.uid}`).get()).exists;
}

export async function payViaPaylony(args: { account: PayoutAccountForPaylony; amountKobo: number; reference: string; narration: string }): Promise<PaylonyPayoutResult> {
  const cfg = await paylonyConfig();
  const secret = (await getAdminDb().doc(`payoutSecrets/${args.account.uid}`).get()).data();
  const accountNumber = decryptAccountNumber(String(secret?.accountNumberEnc));
  let r: PaylonyReply;
  try {
    r = await bankTransfer(
      { account_number: accountNumber, amount: nairaString(args.amountKobo), bank_code: String(args.account.paylonyBankCode), narration: args.narration.slice(0, 60), reference: args.reference, sender_name: "NotesApp Technologies" },
      cfg.signFormat!
    );
  } catch (e) {
    return { state: "uncertain", reference: args.reference, reason: e instanceof Error ? e.message : "No answer from Paylony" };
  }
  const code = replyCode(r);
  if (code === "00" || code === "09") return { state: "sent", reference: args.reference };
  if (DEFINITE_REFUSAL.has(code)) return { state: "refused", code, reason: `Paylony: ${code}` };
  return { state: "uncertain", reference: args.reference, reason: `Paylony answered ${code || `HTTP ${r.httpStatus}`}` };
}

// Reads a transfer's state out of a fetch_transfer_details reply. Paylony's reply shape isn't documented, so this looks for
// the `statusMessage` field its payout webhook uses (anywhere in the reply) and treats anything else as "unknown".
export function transferState(body: unknown): "success" | "failed" | "pending" | "unknown" {
  const found: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 4 || !v || typeof v !== "object") return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if ((k === "statusMessage" || k === "status_message" || k === "transaction_status") && typeof val === "string") found.push(val.toLowerCase());
      else walk(val, depth + 1);
    }
  };
  walk(body, 0);
  const s = found[0] ?? "";
  if (/success|completed|paid/.test(s)) return "success";
  if (/fail|reject|revers|refund/.test(s)) return "failed";
  if (/pend|process|queue/.test(s)) return "pending";
  return "unknown";
}

// Settles the Paylony payouts still marked "transferring": asks Paylony for each one (by OUR reference) and applies a clear
// success or failure. Anything unclear is left alone. Returns how many were settled.
export async function reconcilePaylonyPayouts(opts: { ageMs?: number } = {}): Promise<{ checked: number; paid: number; failed: number }> {
  const db = getAdminDb();
  const snap = await db.collection("ledger").where("status", "==", "transferring").limit(200).get();
  const out = { checked: 0, paid: 0, failed: 0 };
  const cutoff = Date.now() - (opts.ageMs ?? 2 * 60_000);
  for (const d of snap.docs) {
    const l = d.data() as { transferProvider?: string; transferReference?: string; transferStartedAt?: string; paylonyAttempts?: number };
    if (l.transferProvider !== "paylony" || !l.transferReference) continue;
    if (l.transferStartedAt && new Date(l.transferStartedAt).getTime() > cutoff) continue;
    out.checked++;
    const r = await fetchTransfer(l.transferReference).catch(() => null);
    if (!r) continue;
    const state = transferState(r.body);
    if (state === "success") {
      await d.ref.update({ status: "paid_out", failureReason: "" });
      if (d.id.startsWith("adshare_")) await db.doc(`adShareStatements/${d.id.slice("adshare_".length)}`).update({ status: "paid" }).catch(() => {});
      out.paid++;
    } else if (state === "failed") {
      // A failed Paylony transfer's reference can't be reused, so the next attempt gets a new one (see attempt below).
      await d.ref.update({ status: "held", failureReason: `Paylony transfer failed (${l.transferReference})`, paylonyAttempts: (l.paylonyAttempts ?? 0) + 1 });
      out.failed++;
    }
  }
  return out;
}
