"use client";
import { useEffect, useState } from "react";
import { prepApi, useMe } from "@/lib/exam-prep-client";
import { btnGo, btnLine, card, input, Note } from "./ui";

// Asked once after signing in: under 18? Teen mode hides them from people search, lets only people they follow message them and
// shows only a nickname on the board. A parent or guardian confirms by email; they can still practise (and buy) meanwhile.
const KEY = "prep-age-answered";
export default function TeenCard() {
  const me = useMe();
  const [state, setState] = useState<{ teen: boolean; confirmed: boolean; emailSent: boolean | null } | null>(null);
  const [hidden, setHidden] = useState(true);
  const [asking, setAsking] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (!me) return;
    let answered = false;
    try { answered = localStorage.getItem(`${KEY}:${me.uid}`) === "1"; } catch { /* private window */ }
    prepApi<{ teen: boolean; confirmed: boolean; emailSent: boolean | null }>("teen").then((s) => { setState(s); setHidden(answered && !s.teen ? true : s.teen && s.confirmed); }).catch(() => undefined);
  }, [me]);
  if (!me || !state || hidden) return null;
  const remember = () => { try { localStorage.setItem(`${KEY}:${me.uid}`, "1"); } catch { /* fine */ } };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await prepApi<{ emailSent: boolean }>("teen", { body: { parentEmail: email } });
      remember();
      setState({ teen: true, confirmed: false, emailSent: r.emailSent });
      setMsg(r.emailSent ? { tone: "ok", text: "Teen mode is on. We've emailed your parent or guardian to confirm. You can keep practising." } : { tone: "error", text: "Teen mode is on, but the email didn't send. Check the address and try again." });
      setAsking(false);
    } catch (err) { setMsg({ tone: "error", text: (err as Error).message }); } finally { setBusy(false); }
  }
  if (state.teen) {
    return (
      <div className={`${card} mb-5 border-[#C9A227]/40`}>
        <p className="font-semibold">Teen mode is on</p>
        <p className="mt-1 text-sm text-[#0F2747]/75">You're hidden from people search, only people you follow can message you, and the board shows only your nickname. {state.confirmed ? "" : "We're waiting for your parent or guardian to confirm by email."}</p>
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
      <p className="mt-1 text-sm text-[#0F2747]/75">We'll turn on teen mode: you won't show in people search, only people you follow can message you, and the weekly board shows a nickname, never your name. We'll ask a parent or guardian to confirm by email.</p>
      {msg && <div className="mt-2"><Note tone={msg.tone}>{msg.text}</Note></div>}
      {asking ? (
        <form onSubmit={send} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Parent's or guardian's email" aria-label="Parent's or guardian's email" />
          <button disabled={busy} className={btnGo}>{busy ? "Sending…" : "Turn on teen mode"}</button>
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
