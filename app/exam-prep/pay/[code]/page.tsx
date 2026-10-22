"use client";
import { useEffect, useState } from "react";
import { EXAMS, PREP_NAME, type ExamId } from "@/lib/exam-prep";
import { naira, prepApi } from "@/lib/exam-prep-client";
import { btnGold, card, input, Note, Spinner } from "@/components/exam-prep/ui";

// A pay link opened by a parent, sponsor or friend: no account needed, just an email for the Paystack receipt.
type Info = { code: string; pack: ExamId; packName: string; priceKobo: number; months: number; nickname: string; expired: boolean; paid: boolean };
export default function PayLinkPage({ params }: { params: { code: string } }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { prepApi<Info>(`paylink?code=${encodeURIComponent(params.code)}`).then(setInfo).catch((e) => setErr((e as Error).message)); }, [params.code]);
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await prepApi<{ authorizationUrl: string }>("paylink", { body: { code: params.code, email } }); window.location.href = r.authorizationUrl; }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      {!info && !err && <Spinner />}
      {err && !info && <Note tone="error">{err}</Note>}
      {info && (
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6114]">{PREP_NAME}</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{info.nickname} asked you to pay for their {EXAMS[info.pack].short} pack</h1>
          <p className="mt-2 text-[15px] text-[#0F2747]/80">It opens every {EXAMS[info.pack].short} practice question, with explanations and timed mocks, for {info.months} months. Questions are original practice questions; {PREP_NAME} is not affiliated with JAMB, WAEC or NECO.</p>
          <p className="mt-3 text-3xl font-bold">{naira(info.priceKobo)}</p>
          {info.paid ? <div className="mt-4"><Note tone="ok">This pack has been paid for already. Thank you!</Note></div>
            : info.expired ? <div className="mt-4"><Note tone="error">This link has expired. Ask {info.nickname} for a new one.</Note></div>
            : (
              <form onSubmit={pay} className="mt-4 space-y-2">
                <label className="block text-sm font-semibold" htmlFor="payer">Your email, for the receipt</label>
                <input id="payer" className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                {err && <Note tone="error">{err}</Note>}
                <button disabled={busy} className={`${btnGold} w-full`}>{busy ? "Opening Paystack…" : `Pay ${naira(info.priceKobo)} with Paystack`}</button>
                <p className="text-xs text-[#0F2747]/60">You don't need an account. Card, bank transfer or USSD. Refunds within 7 days if no pack question has been opened yet.</p>
              </form>
            )}
        </div>
      )}
    </div>
  );
}
