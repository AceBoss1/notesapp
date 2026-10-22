"use client";
import { useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { EXAMS, REFUND_DAYS, PAYLINK_DAYS, suggestNickname, type ExamId } from "@/lib/exam-prep";
import type { Catalogue } from "@/lib/exam-prep-server";
import { ApiError, loadCatalogue, naira, prepApi, shortDate, useMe, usePrepHref } from "@/lib/exam-prep-client";
import { Back, btnGo, btnGold, btnLine, card, input, Note, Spinner } from "./ui";

// The pack for one exam: what it opens, the price, buying it (Paystack), restoring it, and "ask someone to pay".
export default function PackPage({ exam }: { exam: ExamId }) {
  const e = EXAMS[exam];
  const me = useMe();
  const h = usePrepHref();
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string; fix?: "verify" | "consent" } | null>(null);
  const [agree, setAgree] = useState(false);
  useEffect(() => { if (me !== undefined) loadCatalogue(true).then(setCat).catch((x) => setMsg({ tone: "error", text: (x as Error).message })); }, [me]);
  const pack = cat?.packs[exam];
  const access = cat?.access[exam];
  const subjects = cat?.subjects.filter((s) => s.exam === exam) ?? [];
  const total = subjects.reduce((n, s) => n + s.free + s.pack, 0);

  async function buy() {
    setBusy(true); setMsg(null);
    try {
      const r = await prepApi<{ authorizationUrl: string }>("checkout", { body: { exam } });
      window.location.href = r.authorizationUrl;
    } catch (x) {
      const m = (x as Error).message;
      setMsg({ tone: "error", text: m, fix: x instanceof ApiError && x.status === 403 ? (/verify/i.test(m) ? "verify" : /terms/i.test(m) ? "consent" : undefined) : undefined });
      setBusy(false);
    }
  }
  async function verify() {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser).then(() => setMsg({ tone: "ok", text: `Verification email sent to ${auth.currentUser?.email}. Open the link, then come back and tap Buy.` })).catch(() => setMsg({ tone: "error", text: "Couldn't send it just now. Try again in a minute." }));
  }
  async function consent() {
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/consent", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    await auth.currentUser?.getIdToken(true);
    buy();
  }
  async function restore() {
    setBusy(true); setMsg(null);
    try {
      const r = await prepApi<{ checked: number; restored: number }>("restore", { body: {} });
      setCat(await loadCatalogue(true));
      setMsg({ tone: r.restored ? "ok" : "info", text: r.restored ? "Found your payment: your pack is open." : r.checked ? "We checked again with Paystack and that payment didn't go through. You haven't been charged twice." : "No unfinished payments on this account." });
    } catch (x) { setMsg({ tone: "error", text: (x as Error).message }); } finally { setBusy(false); }
  }
  const signIn = h(`/signin?next=${encodeURIComponent(h(`/${exam}/pack`))}`);

  return (
    <div className="mx-auto max-w-2xl">
      <Back href={`/${exam}`}>{e.short}</Back>
      <div className={`${card} border-[#C9A227]/60`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6114]">{e.short} pack</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Every {e.short} question, all subjects</h1>
        {!cat ? <Spinner /> : (
          <>
            <p className="mt-2 text-3xl font-bold">{pack ? naira(pack.priceKobo) : ""} <span className="text-base font-semibold text-[#0F2747]/60">for {pack?.months} months</span></p>
            <ul className="mt-3 space-y-1.5 text-[15px]">
              <li>✓ {total ? `${total} questions` : "All the questions"} across {subjects.map((s) => s.name).join(" and ") || "every subject"}, and new ones as they're added</li>
              <li>✓ Full explanations, and why each wrong option is wrong</li>
              <li>✓ Timed mocks from the whole question bank</li>
              <li>✓ Save to your phone and practise with no data</li>
            </ul>
            {access?.active ? (
              <div className="mt-4"><Note tone="ok">Your pack is open until {shortDate(access.expiresAt!)} ({access.daysLeft} days). Buying again adds {pack?.months} more months.</Note></div>
            ) : null}
            {msg && <div className="mt-4"><Note tone={msg.tone}>{msg.text}</Note></div>}
            {msg?.fix === "verify" && <button onClick={verify} className={`${btnLine} mt-2`}>Send the verification email</button>}
            {msg?.fix === "consent" && (
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(x) => setAgree(x.target.checked)} className="mt-1" />I accept the NotesApp Terms of Service and Privacy Policy.</label>
                <button onClick={consent} disabled={!agree} className={btnLine}>Accept and continue</button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {me ? <button onClick={buy} disabled={busy || !pack?.available} className={btnGold}>{busy ? "Opening Paystack…" : access?.active ? `Add ${pack?.months} months` : `Buy for ${pack ? naira(pack.priceKobo) : ""}`}</button> : <a href={signIn} className={btnGold}>Sign in to buy</a>}
              {me && <button onClick={restore} disabled={busy} className={btnLine}>Restore my pack</button>}
            </div>
            {pack && !pack.available && <p className="mt-2 text-sm text-[#B3261E]">This pack isn't on sale right now.</p>}
            <p className="mt-4 text-xs text-[#0F2747]/65">Paid securely with Paystack (card, bank transfer or USSD). One pack is one exam for one account. Changed your mind? You get your money back in full if you ask within {REFUND_DAYS} days and haven't opened any pack question yet; after that it can't be refunded. Write to us from the contact page.</p>
          </>
        )}
      </div>
      <AskToPay exam={exam} signedIn={!!me} signIn={signIn} />
    </div>
  );
}

// "Ask someone to pay": a link (14 days) a parent, sponsor or friend opens to pay for this student's pack, no account needed.
function AskToPay({ exam, signedIn, signIn }: { exam: ExamId; signedIn: boolean; signIn: string }) {
  const h = usePrepHref();
  const [nick, setNick] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setNick(suggestNickname(Math.floor(Math.random() * 1e6))), []);
  async function make() {
    setBusy(true); setErr("");
    try {
      const r = await prepApi<{ code: string; expiresAt: string }>("paylink", { body: { exam, nickname: nick } });
      setLink({ url: `${window.location.origin}${h(`/pay/${r.code}`)}`, expiresAt: r.expiresAt });
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const text = link ? `Please help me pay for my ${EXAMS[exam].short} practice pack on Naija Exam Prep: ${link.url}` : "";
  return (
    <div id="ask" className={`${card} mt-4`}>
      <h2 className="text-lg font-bold">Ask someone to pay</h2>
      <p className="mt-1 text-sm text-[#0F2747]/70">Send a link to a parent, sponsor or friend. They pay with Paystack without an account, and the pack opens on your account. The link lasts {PAYLINK_DAYS} days. They see only the name below, so use a nickname if you like.</p>
      {!signedIn ? <a href={signIn} className={`${btnLine} mt-3`}>Sign in to make a link</a> : link ? (
        <div className="mt-3 space-y-2">
          <input readOnly value={link.url} className={input} onFocus={(x) => x.currentTarget.select()} aria-label="Pay link" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigator.clipboard.writeText(link.url).then(() => setCopied(true))} className={btnLine}>{copied ? "Copied" : "Copy link"}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={btnGo}>Send on WhatsApp</a>
            {typeof navigator !== "undefined" && "share" in navigator && <button onClick={() => navigator.share({ text }).catch(() => undefined)} className={btnLine}>Share…</button>}
          </div>
          <p className="text-xs text-[#0F2747]/60">Works until {shortDate(link.expiresAt)}.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={input} value={nick} onChange={(x) => setNick(x.target.value)} maxLength={20} aria-label="Name the payer sees" />
          <button onClick={make} disabled={busy} className={btnGo}>{busy ? "Making…" : "Make a pay link"}</button>
        </div>
      )}
      {err && <div className="mt-2"><Note tone="error">{err}</Note></div>}
    </div>
  );
}
