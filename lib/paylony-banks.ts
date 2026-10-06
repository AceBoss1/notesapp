// Paylony uses its own bank codes (six digits, for example 000013), which are not Paystack's. A payout account therefore
// keeps both: `bankCode` (Paystack's) and `paylonyBankCode`, found by matching the bank's name against Paylony's /bank_list.
export type BankRow = { code: string; name: string };

// Paylony's reply shape isn't documented, so look for the list in the usual places and the usual field names.
export function parseBankList(body: unknown): BankRow[] {
  const root = body as Record<string, unknown> | unknown[] | null;
  const list = Array.isArray(root) ? root : Array.isArray((root as { data?: unknown })?.data) ? (root as { data: unknown[] }).data : Array.isArray((root as { banks?: unknown })?.banks) ? (root as { banks: unknown[] }).banks : [];
  const rows: BankRow[] = [];
  for (const b of list) {
    const o = b as Record<string, unknown>;
    const code = o?.code ?? o?.bank_code ?? o?.bankCode;
    const name = o?.name ?? o?.bank_name ?? o?.bankName;
    if ((typeof code === "string" || typeof code === "number") && typeof name === "string") rows.push({ code: String(code), name });
  }
  return rows;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/\b(plc|ltd|limited|nigeria|nig|bank|microfinance|mfb|of|the|and)\b/g, " ").replace(/[^a-z0-9]/g, "");

// The Paylony code for a bank name, or null when there's no single clear match (the payout then stays on Paystack).
export function matchBankCode(rows: BankRow[], bankName: string): string | null {
  const want = norm(bankName);
  if (!want) return null;
  const exact = rows.filter((r) => norm(r.name) === want);
  if (exact.length === 1) return exact[0].code;
  if (exact.length > 1) return null;
  const loose = rows.filter((r) => norm(r.name).startsWith(want) || want.startsWith(norm(r.name)));
  return loose.length === 1 ? loose[0].code : null;
}
