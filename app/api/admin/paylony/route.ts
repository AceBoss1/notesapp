import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { accountCryptoConfigured } from "@/lib/account-crypto";
import { paylonyConfig, reconcilePaylonyPayouts } from "@/lib/paylony-payouts";
import {
  SIGN_FORMATS, accountName, bankList, bankTransfer, createCheckoutAccount, paylonyCodeText, paylonyDiagnostics, paylonyMode, replyCode,
  type PaylonyReply,
} from "@/lib/paylony";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const show = (r: PaylonyReply) => ({ httpStatus: r.httpStatus, code: replyCode(r), meaning: replyCode(r) ? paylonyCodeText(replyCode(r)) : "", body: typeof r.body === "string" ? r.body.slice(0, 1500) : r.body });

// Admin: GET → does our Paylony key work, which keys are set, the saved signing format and the latest webhook events.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const [diagnostics, events, cfg, accounts, secrets, pending] = await Promise.all([
      paylonyDiagnostics(),
      db.collection("paylonyEvents").orderBy("receivedAt", "desc").limit(25).get(),
      db.doc("paylonyConfig/main").get(),
      db.collection("payoutAccounts").get(),
      db.collection("payoutSecrets").get(),
      db.collection("ledger").where("status", "==", "transferring").limit(100).get(),
    ]);
    const have = new Set(secrets.docs.map((d) => d.id));
    const pc = await paylonyConfig();
    return NextResponse.json({
      diagnostics,
      config: { signFormat: (cfg.data()?.signFormat as string) || null, verifiedAt: (cfg.data()?.verifiedAt as string) || null, payoutProvider: pc.payoutProvider, accountKeySet: accountCryptoConfigured() },
      payouts: {
        accounts: accounts.size,
        ready: accounts.docs.filter((d) => d.data().paylonyBankCode && have.has(d.id)).length, // has Paylony's bank code and the encrypted number
        waiting: pending.docs.filter((d) => d.data().transferProvider === "paylony").map((d) => ({ id: d.id, reference: d.data().transferReference, netKobo: d.data().netKobo, note: d.data().failureReason || "" })),
      },
      events: events.docs.map((d) => {
        const e = d.data();
        return { id: d.id, event: e.event, status: e.status, amount: e.amount, trx: e.trx, reference: e.reference, receivedAt: e.receivedAt, handled: e.handled === true };
      }),
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check Paylony");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// Admin tools for learning how Paylony answers. Anything that creates something or sends money (the signature test, the test
// checkout account) refuses unless the key is a TEST key (sk_test_…), where no real money moves.
//   { action: "banks" }
//   { action: "account_name", bankCode, accountNumber }
//   { action: "signature_test" }   — tries each signing format on a ₦100 test transfer until Paylony accepts one, and saves it
//   { action: "checkout_test" }    — creates a one-time test virtual account so we can see the reply
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "set_provider") {
      const want = body.provider === "paylony" ? "paylony" : "paystack";
      if (want === "paylony") {
        const cfg = await paylonyConfig();
        const missing = [!cfg.signFormat && "the signing format isn't verified (run the Signature test with a test key)", !process.env.PAYLONY_ENCRYPTION_KEY && "PAYLONY_ENCRYPTION_KEY isn't set", !accountCryptoConfigured() && "ACCOUNT_DATA_KEY isn't set", paylonyMode() === "unset" && "PAYLONY_SECRET_KEY isn't set"].filter(Boolean);
        if (missing.length) return NextResponse.json({ error: `Can't switch to Paylony yet: ${missing.join("; ")}.` }, { status: 409 });
      }
      await getAdminDb().doc("paylonyConfig/main").set({ payoutProvider: want, providerChangedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ ok: true, provider: want });
    }
    if (action === "reconcile") return NextResponse.json({ result: await reconcilePaylonyPayouts({ ageMs: 0 }) });
    if (action === "banks") {
      const r = await bankList();
      const list = (r.body as { data?: unknown })?.data;
      return NextResponse.json({ result: { ...show(r), count: Array.isArray(list) ? list.length : undefined } });
    }
    if (action === "account_name") {
      const r = await accountName(String(body.bankCode || ""), String(body.accountNumber || ""));
      return NextResponse.json({ result: show(r) });
    }

    if (paylonyMode() !== "test") return NextResponse.json({ error: "This tool only runs with a Paylony TEST key (sk_test_…)." }, { status: 409 });

    if (action === "checkout_test") {
      const r = await createCheckoutAccount({ name: "NotesApp Test", email: "test@notesapp.name.ng", amount: "100", phone: "08000000000", reference: `na-test-${Date.now()}`, title: "Test", description: "Connection test" });
      return NextResponse.json({ result: show(r) });
    }

    if (action === "signature_test") {
      const attempts: { format: string; reference: string; result: ReturnType<typeof show> }[] = [];
      for (const format of SIGN_FORMATS) {
        const reference = `na-sigtest-${Date.now()}-${format}`;
        const r = await bankTransfer({ account_number: "1019651961", amount: "100", bank_code: "999999", narration: "Signature test", reference, sender_name: "NotesApp Test" }, format);
        attempts.push({ format, reference, result: show(r) });
        if (replyCode(r) !== "22") {
          // Not "invalid signature": Paylony accepted the signature (whatever it then said about the transfer itself).
          await getAdminDb().doc("paylonyConfig/main").set({ signFormat: format, verifiedAt: new Date().toISOString(), verifiedWith: "test key" }, { merge: true });
          return NextResponse.json({ accepted: format, attempts });
        }
      }
      return NextResponse.json({ accepted: null, attempts });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't run that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
