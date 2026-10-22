"use client";
import { useEffect, useState } from "react";
import { EXAMS, type ExamId } from "@/lib/exam-prep";
import { prepApi, shortDate, useMe } from "@/lib/exam-prep-client";
import { btnGo, btnLine, card, Note, PLink, Spinner } from "@/components/exam-prep/ui";

// Back from Paystack: confirm the payment with Paystack (never trusting the address alone) and open the pack.
type Res = { paid: boolean; status: string; pack: ExamId; packName: string; access?: { active: boolean; expiresAt: string | null } };
export default function PaidPage() {
  const me = useMe();
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    if (me === undefined) return;
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("reference") || q.get("trxref") || "";
    const c = q.get("code") || "";
    setCode(c);
    if (!ref) { setErr("We couldn't tell which payment this was."); return; }
    prepApi<Res>(`paid?reference=${encodeURIComponent(ref)}${c ? `&code=${encodeURIComponent(c)}` : ""}`).then(setRes).catch((e) => setErr((e as Error).message));
  }, [me]);
  return (
    <div className="mx-auto max-w-md">
      {!res && !err && <Spinner label="Checking your payment with Paystack…" />}
      {err && <Note tone="error">{err} If you were charged, sign in and tap “Restore my pack” on the pack page.</Note>}
      {res && (
        <div className={`${card} text-center`}>
          {res.paid ? (
            <>
              <p className="text-4xl" aria-hidden>🎉</p>
              <h1 className="mt-2 font-display text-2xl font-bold">{code ? "Thank you!" : `Your ${EXAMS[res.pack].short} pack is open`}</h1>
              <p className="mt-2 text-[15px] text-[#0F2747]/75">{code ? `The ${EXAMS[res.pack].short} pack is now open on the student's account. We've let them know.` : res.access?.expiresAt ? `Every ${EXAMS[res.pack].short} question is yours until ${shortDate(res.access.expiresAt)}.` : "Every question is open."}</p>
              {!code && <div className="mt-4 flex flex-wrap justify-center gap-2"><PLink href={`/${res.pack}`} className={btnGo}>Start practising</PLink><PLink href={`/${res.pack}`} className={btnLine}>Save it for offline</PLink></div>}
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold">Payment not finished</h1>
              <p className="mt-2 text-[15px] text-[#0F2747]/75">Paystack says this payment is {res.status === "pending" ? "still pending" : res.status}. Nothing has been charged twice. {code ? "You can try the link again." : "You can try again from the pack page."}</p>
              {!code && <PLink href={`/${res.pack}/pack`} className={`${btnLine} mt-4`}>Back to the pack</PLink>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
