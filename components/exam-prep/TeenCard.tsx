"use client";
import { useEffect, useState } from "react";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { MONTHS } from "@/lib/young";
import { btnGo, btnLine, card, input, Note } from "./ui";

// Asked once after signing in: under 18? Teen mode hides them from people search, lets only people they follow message them and
// shows only a nickname on the board. A parent or guardian confirms by email; they can still practise (and buy) meanwhile. We also ask
// the month and year they were born (kept on the server, never shown: lib/young.ts), so we know when they turn 18.
const KEY = "prep-age-answered";
export default function TeenCard() {
  const me = useMe();
  const [state, setState] = useState<{ teen: boolean; confirmed: boolean; emailSent: boolean | null; hasBirth?: boolean } | null>(null);
  const [born, setBorn] = useState({ month: "", year: "" });
  const [hidden, setHidden] = useState(true);
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (!me) return;
    let answered = false;
    try { answered = localStorage.getItem(`${KEY}:${me.uid}`) === "1"; } catch { /* private window */ }
    prepApi<{ teen: boolean; kid?: boolean; confirmed: boolean; emailSent: boolean | null; hasBirth?: boolean }>("teen").then((s) => { setState(s); setHidden(s.kid === true || (answered && !s.teen ? true : s.teen && s.confirmed && s.hasBirth === true)); }).catch(() => undefined);
  }, [me]);
  if (!me || !state || hidden) return null;
  const remember = () => { try { localStorage.setItem(`${KEY}:${me.uid}`, "1"); } catch { /* fine */ } };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await prepApi<{ emailSent: boolean }>("teen", { body: { parentEmail: email, birthMonth: born.month, birthYear: born.year } });
      remember();
      setState({ teen: true, confirmed: false, emailSent: r.emailSent, hasBirth: true });
      setMsg(r.emailSent ? { tone: "ok", text: "Teen mode is on. We've emailed your parent or guardian to confirm. You can keep practising." } : { tone: "error", text: "Teen mode is on, but the email didn't send. Check the address and try again." });
      setAsking(false);
    } catch (err) { setMsg({ tone: "error", text: (err as Error).message }); } finally { setBusy(false); }
  }
  const year = new Date().getFullYear();
  const birthFields = (
    <div className="grid grid-cols-2 gap-2">
      <select className={input} required value={born.month} onChange={(e) => setBorn({ ...born, month: e.target.value })} aria-label="Month you were born"><option value="">Month born</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <select className={input} required value={born.year} onChange={(e) => setBorn({ ...born, year: e.target.value })} aria-label="Year you were born"><option value="">Year born</option>{Array.from({ length: 8 }, (_, i) => year - 11 - i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
    </div>
  );
  async function saveBirth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await prepApi("teen", { body: { birthMonth: born.month, birthYear: born.year } }); setState((s) => (s ? { ...s, hasBirth: true } : s)); setMsg({ tone: "ok", text: "Thanks. It's kept private and never shown." }); }
    catch (err) { setMsg({ tone: "error", text: (err as Error).message }); } finally { setBusy(false); }
  }
  if (state.teen) {
    return (
      <div className={`${card} mb-5 border-[#C9A227]/40`}>
        <p className="font-semibold">Teen mode is on</p>
        <p className="mt-1 text-sm text-[#0F2747]/75">You're hidden from people search, only people you follow can message you or reply to what you post, only people you follow back see your moments, and the board shows only your nickname. {state.confirmed ? "" : "We're waiting for your parent or guardian to confirm by email."}</p>
        {state.hasBirth === false && (
          <form onSubmit={saveBirth} className="mt-3 space-y-2">
            <p className="text-sm font-semibold">When were you born? <span className="font-normal text-[#0F2747]/70">Month and year only, kept private, so teen mode ends on your 18th birthday.</span></p>
            {birthFields}
            <button disabled={busy} className={btnGo}>{busy ? "Saving…" : "Save"}</button>
          </form>
        )}
        {msg && <div className="mt-2"><Note tone={msg.tone}>{msg.text}</Note></div>}
        {!state.confirmed && (asking ? (
          <form onSubmit={send} className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Parent's or guardian's email" /><button disabled={busy} className={btnGo}>{busy ? "Sending…" : "Send again"}</button></form>
        ) : <button onClick={() => setAsking(true)} className={`${btnLine} mt-3`}>Resend or change the email</button>)}
      </div>
    );
  }
  return (
    <div className={`${card} mb-5`}>
      <p className="font-semibold">Are you under 18?</p>
      <p className="mt-1 text-sm text-[#0F2747]/75">We'll turn on teen mode: you won't show in people search, only people you follow can message you or reply to what you post, and the weekly board shows a nickname, never your name. We'll ask a parent or guardian to confirm by email.</p>
      {msg && <div className="mt-2"><Note tone={msg.tone}>{msg.text}</Note></div>}
      {asking ? (
        <form onSubmit={send} className="mt-3 space-y-2">
          <p className="text-sm font-semibold">When were you born? <span className="font-normal text-[#0F2747]/70">Month and year, kept private.</span></p>
          {birthFields}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Parent's or guardian's email" aria-label="Parent's or guardian's email" />
            <button disabled={busy} className={btnGo}>{busy ? "Sending…" : "Turn on teen mode"}</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setAsking(true)} className={btnGo}>Yes, I'm under 18</button>
          <button onClick={() => { remember(); setHidden(true); }} className={btnLine}>I'm 18 or older</button>
        </div>
      )}
    </div>
  );
}
