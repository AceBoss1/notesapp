"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MESSAGE_MAX, type ThreadMessage } from "@/lib/messages-rules";

type Who = { uid: string; username: string; displayName: string; avatar: string };

// One conversation. `to` (a username) starts a new one; `id` opens an existing one. Replies to moments carry a small note:
// "Replied to a moment" while it's live, "…that has expired" after — the moment itself can't be opened once it's gone.
export default function Thread({ id, to }: { id?: string; to?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cid, setCid] = useState(id);
  const [who, setWho] = useState<Who | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const load = useCallback(() => {
    if (!user || !cid) return;
    api<{ messages: ThreadMessage[]; with: Who }>(`/api/messages/${cid}`).then((r) => { setMessages(r.messages); setWho(r.with); }).catch((e) => setError(e.message));
  }, [user, cid]);
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // simple polling for now; live updates can read the conversation directly later
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);

  async function send() {
    setBusy(true); setError(null);
    try {
      const r = await api<{ conversationId: string }>("/api/messages", { body: to ? { toUsername: to, text } : { toUid: who?.uid, text } });
      setText(""); setCid(r.conversationId);
      if (!id) window.history.replaceState(null, "", `/messages/${r.conversationId}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to message.</p>;
  return (
    <div className="flex flex-col">
      <p className="mb-4 text-sm text-slate"><Link href="/messages" className="text-crimson underline">← Messages</Link>{who ? <> · <Link href={`/u/${who.username}`} className="font-bold text-ink">{who.displayName}</Link></> : to ? ` · @${to}` : ""}</p>
      <div className="min-h-[40vh] space-y-2">
        {messages.map((m) => {
          const mine = m.from === user?.uid;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-crimson text-white" : "bg-paper text-ink"}`}>
                {m.moment && (
                  <p className={`mb-1 text-xs italic ${mine ? "text-white/80" : "text-slate"}`}>
                    {m.moment.expired ? "Replied to a moment that has expired" : "Replied to a moment"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MESSAGE_MAX} placeholder="Write a message" className="min-w-0 flex-1 rounded border border-rule px-3 py-2 text-sm" />
        <button disabled={busy || !text.trim()} className="btn-primary disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
