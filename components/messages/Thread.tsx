"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MESSAGE_MAX, type ThreadMessage } from "@/lib/messages-rules";
import { isMomentExpired } from "@/lib/moments-rules";
import ReportDialog from "@/components/moments/ReportDialog";

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
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [reporting, setReporting] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Who it's with, and whether you've blocked them (this also marks the conversation read).
  const loadMeta = useCallback(() => {
    if (!user || !cid) return;
    api<{ with: Who; blockedByMe: boolean }>(`/api/messages/${cid}`).then((r) => { setWho(r.with); setBlockedByMe(r.blockedByMe); }).catch((e) => setError(e.message));
  }, [user, cid]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // The messages themselves, live: they appear as they arrive. Only the two people in a conversation can read it (firestore.rules).
  useEffect(() => {
    if (!user || !cid) return;
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, `conversations/${cid}/messages`), orderBy("createdAt", "desc"), limit(100)),
      (snap) => {
        const rows: ThreadMessage[] = snap.docs.reverse().map((d) => {
          const m = d.data();
          // A reply to a moment says whether the moment has expired; the moment itself is never in the message.
          return { id: d.id, from: m.from, text: m.text, createdAt: m.createdAt, ...(m.momentRef ? { moment: { momentId: m.momentRef.momentId, expired: isMomentExpired(m.momentRef.expiresAt) } } : {}) };
        });
        setMessages(rows);
        // Something new from them while this is open: it's read.
        if (snap.docChanges().some((c) => c.type === "added" && c.doc.data().from !== uid && !c.doc.metadata.hasPendingWrites)) api(`/api/messages/${cid}`, { method: "POST", body: {} }).catch(() => {});
      },
      (e) => setError(e.message)
    );
  }, [user, cid]);
  // Braces matter: an effect must return nothing or a clean-up function. Some browsers' scrollIntoView() now returns a Promise, and
  // returning it made React call it as a clean-up ("destroy is not a function"), which crashed the page.
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send() {
    setBusy(true); setError(null);
    try {
      const r = await api<{ conversationId: string }>("/api/messages", { body: to ? { toUsername: to, text } : { toUid: who?.uid, text } });
      setText(""); setCid(r.conversationId);
      if (!id) window.history.replaceState(null, "", `/messages/${r.conversationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!who) return;
    if (!blockedByMe && !confirm(`Block ${who.displayName}? They won't be able to message you or see your moments, and you won't see theirs.`)) return;
    setError(null);
    try { await api("/api/messages/block", { body: { uid: who.uid, block: !blockedByMe } }); setBlockedByMe(!blockedByMe); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the block."); }
  }

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to message.</p>;
  return (
    <div className="flex flex-col">
      <p className="mb-4 text-sm text-slate"><Link href="/messages" className="text-crimson underline">← Messages</Link>{who ? <> · <Link href={`/u/${who.username}`} className="font-bold text-ink">{who.displayName}</Link></> : to ? ` · @${to}` : ""}</p>
      {cid && who && (
        <p className="-mt-2 mb-4 flex gap-4 text-xs">
          <button onClick={toggleBlock} className="text-slate underline">{blockedByMe ? "Unblock" : "Block"}</button>
          <button onClick={() => setReporting(true)} className="text-slate underline">Report</button>
        </p>
      )}
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
      {blockedByMe && <p className="mt-3 text-sm text-slate">You&apos;ve blocked this member. Unblock them to send a message.</p>}
      {reporting && cid && <ReportDialog kind="conversation" targetId={cid} onClose={() => setReporting(false)} />}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MESSAGE_MAX} placeholder="Write a message" className="min-w-0 flex-1 rounded border border-rule px-3 py-2 text-sm" />
        <button disabled={busy || !text.trim() || blockedByMe} className="btn-primary disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
