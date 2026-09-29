import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyPublisherRequest } from "@/lib/firebase-admin";
import { createTransferRecipient, resolveAccount } from "@/lib/paystack";
import { rateLimit } from "@/lib/rate-limit";

// Registers where a publisher gets paid. Paystack resolves the
// account name from the bank (so we never pay an unverified account),
// then we create a transfer recipient. Only the last 4 digits and the
// recipient code are stored; the owner can read them, nobody else.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const uid = await verifyPublisherRequest(idToken).catch(() => null);
    if (!uid) return NextResponse.json({ error: "Only publishing accounts can add payout details." }, { status: 403 });
    const limited = rateLimit(req, "payout-acct", uid, 5, 3600);
    if (limited) return limited;

    const { bankCode, bankName, accountNumber } = await req.json();
    if (!/^\d{10}$/.test(String(accountNumber))) {
      return NextResponse.json({ error: "Account number must be 10 digits." }, { status: 400 });
    }
    if (typeof bankCode !== "string" || !/^\d{2,6}$/.test(bankCode)) {
      return NextResponse.json({ error: "Pick a bank." }, { status: 400 });
    }
    const resolved = await resolveAccount(accountNumber, bankCode);
    const recipient = await createTransferRecipient({
      name: resolved.account_name,
      accountNumber,
      bankCode,
    });
    const record = {
      uid,
      bankCode,
      bankName: recipient.details?.bank_name || bankName || "",
      accountName: resolved.account_name,
      accountLast4: String(accountNumber).slice(-4),
      recipientCode: recipient.recipient_code,
      updatedAt: new Date().toISOString(),
    };
    await getAdminDb().doc(`payoutAccounts/${uid}`).set(record);
    return NextResponse.json({ ok: true, accountName: record.accountName, bankName: record.bankName, accountLast4: record.accountLast4 });
  } catch (err) {
    console.error("Payout account failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't verify that account" }, { status: 400 });
  }
}
