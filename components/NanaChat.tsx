"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid } from "@/lib/users";
import { NANA_HISTORY_MAX, NANA_NAME, NANA_USER_MAX, firstName, type NanaMsg } from "@/lib/nana";
import Markdownish from "./Markdownish";

// Nana AI: the chat helper in the corner of every page. Members are recognised automatically; visitors give a name and email first. The
// conversation is kept in this tab (sessionStorage) and the visitor's name and email in this browser (localStorage), so Nana does not ask twice.
const CHAT_KEY = "na-nana-chat", VISITOR_KEY = "na-nana-visitor";
const SUGGESTIONS = ["How much does it cost?", "How do I get paid?", "How do bookings and refunds work?", "How do I sell something?"];
const read = <T,>(store: "session" | "local", key: string): T | null => {
  try { const v = (store === "session" ? sessionStorage : localStorage).getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
};
const write = (store: "session" | "local", key: string, value: unknown) => {
  try { (store === "session" ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); } catch { /* the chat still works for this visit */ }
};

type Shown = NanaMsg & { error?: boolean };

export default function NanaChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [memberName, setMemberName] = useState("");
  const [visitor, setVisitor] = useState<{ name: string; email: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [formError, setFormError] = useState("");
  const [msgs, setMsgs] = useState<Shown[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [loaded, setLoaded] = useState(false); // nothing is saved until the saved chat has been read back
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = read<{ msgs: Shown[]; chatId?: string }>("session", CHAT_KEY);
    if (saved) { setMsgs(saved.msgs ?? []); setChatId(saved.chatId); }
    setVisitor(read("local", VISITOR_KEY));
    setLoaded(true);
  }, []);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setMemberName("");
    if (u) setMemberName((await getUserByUid(u.uid).catch(() => null))?.displayName || u.displayName || "");
  }), []);
  useEffect(() => { if (loaded) write("session", CHAT_KEY, { msgs: msgs.slice(-40), chatId }); }, [loaded, msgs, chatId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [open, visitor, user]);

  const name = user ? memberName : visitor?.name ?? "";
  const ready = !!user || !!visitor;
  const first = firstName(name);

  const send = useCallback(async (raw: string) => {
    const content = raw.trim().slice(0, NANA_USER_MAX);
    if (!content || busy || !ready) return;
    const next: Shown[] = [...msgs.filter((m) => !m.error), { role: "user", content }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
      const res = await fetch("/api/nana", {
        method: "POST", headers,
        body: JSON.stringify({ messages: next.slice(-NANA_HISTORY_MAX).map(({ role, content: c }) => ({ role, content: c })), chatId, page: pathname, ...(user ? {} : visitor) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setChatId(j.chatId);
      if (j.handoff) setHandoff(true);
      setMsgs((m) => [...m, { role: "assistant", content: j.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong. Please try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, chatId, msgs, pathname, ready, user, visitor]);

  function startAsVisitor(e: React.FormEvent) {
    e.preventDefault();
    const n = form.name.trim(), em = form.email.trim();
    if (n.length < 2) return setFormError("Please tell me your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return setFormError("That email doesn't look right. Could you check it?");
    setFormError("");
    const v = { name: n, email: em };
    write("local", VISITOR_KEY, v);
    setVisitor(v);
  }
  const reset = () => { setMsgs([]); setChatId(undefined); setHandoff(false); };

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Ask ${NANA_NAME}`} className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-rule bg-card py-1.5 pl-1.5 pr-4 shadow-lg transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson sm:bottom-6 sm:right-6">
          <Image src="/images/nana/nana-sm.webp" alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
          <span className="hidden font-ui text-sm font-bold text-ink sm:inline">Ask Nana</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label={NANA_NAME} className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-rule bg-paper shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[390px] sm:rounded-2xl">
          <header className="flex items-center gap-3 border-b border-rule bg-card px-4 py-3">
            <Image src="/images/nana/nana-sm.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="font-ui text-sm font-bold text-ink">{NANA_NAME}</p>
              <p className="truncate text-xs text-slate">Your #NotesApp helper · ask me anything</p>
            </div>
            {msgs.length > 0 && <button type="button" onClick={reset} className="rounded px-2 py-1 font-ui text-xs text-slate hover:text-crimson">New chat</button>}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded px-2 py-1 text-lg leading-none text-slate hover:text-crimson">×</button>
          </header>

          {!ready ? (
            <form onSubmit={startAsVisitor} className="flex-1 overflow-y-auto p-5">
              <Image src="/images/nana/nana.webp" alt="Nana, the #NotesApp helper" width={120} height={120} className="mx-auto h-28 w-28" />
              <p className="mt-3 text-center font-display text-xl text-ink">Hi, I&apos;m Nana!</p>
              <p className="mt-1 text-center text-sm text-slate">I can answer questions about #NotesApp and point you to the right page. First, who am I talking to?</p>
              <label className="mt-5 block text-xs text-slate">Your name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={60} className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson" /></label>
              <label className="mt-3 block text-xs text-slate">Your email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" className="mt-1 w-full border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson" /></label>
              {formError && <p className="mt-2 text-xs text-red-700" role="alert">{formError}</p>}
              <button type="submit" className="btn-primary mt-4 w-full">Start chatting</button>
              <p className="mt-3 text-xs text-slate">We keep this chat so our team can help and follow up if you ask for a person. See the <Link href="/privacy" className="underline">Privacy Policy</Link>. Members who are signed in skip this step.</p>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                <div className="flex gap-2">
                  <Image src="/images/nana/nana-sm.webp" alt="" width={28} height={28} className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-rule bg-card px-3.5 py-2.5 text-sm text-ink">
                    {first ? `Hi ${first}! ` : "Hi! "}I&apos;m Nana, your #NotesApp helper. Ask me about plans, payouts, bookings, selling, badges, anything on the platform, and I&apos;ll point you to the right page.
                  </div>
                </div>
                {msgs.map((m, i) => m.role === "user" ? (
                  <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-crimson px-3.5 py-2.5 text-sm text-paper">{m.content}</div></div>
                ) : (
                  <div key={i} className="flex gap-2">
                    <Image src="/images/nana/nana-sm.webp" alt="" width={28} height={28} className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
                    <div className={`max-w-[85%] rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm ${m.error ? "border-red-200 bg-red-50 text-red-800" : "border-rule bg-card text-ink"}`}>
                      {m.error ? m.content : <Markdownish text={m.content} />}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-2" aria-label="Nana is typing">
                    <Image src="/images/nana/nana-sm.webp" alt="" width={28} height={28} className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
                    <div className="rounded-2xl rounded-tl-sm border border-rule bg-card px-4 py-3"><span className="inline-flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate" style={{ animationDelay: `${d * 150}ms` }} />)}</span></div>
                  </div>
                )}
                {msgs.length === 0 && !busy && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-rule bg-card px-3 py-1.5 text-left text-xs font-semibold text-ink hover:border-crimson hover:text-crimson">{s}</button>)}
                  </div>
                )}
                {handoff && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-ink">A person from the team will follow up by email. You can also <Link href="/contact" className="font-semibold underline">use the contact page</Link>.</p>}
                <div ref={endRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="border-t border-rule bg-card p-3">
                <div className="flex items-end gap-2">
                  <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} rows={1} maxLength={NANA_USER_MAX} placeholder="Type your question…" aria-label="Your message" className="max-h-28 min-h-[2.5rem] flex-1 resize-none border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-crimson" />
                  <button type="submit" disabled={busy || !text.trim()} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Send</button>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate">Nana is an AI and can get things wrong. Please don&apos;t share passwords or card details. Need a person? <Link href="/contact" className="underline">Contact the team</Link>.</p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
