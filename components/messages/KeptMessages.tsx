"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import type { KeptMessage } from "@/lib/message-forward";

// Saved → From chats: the messages you kept, newest first, with the chat they came from. Only you can see them (firestore.rules); a message
// its sender deletes leaves this list too. Your own words can start a journal draft from here.
export default function KeptMessages({ user }: { user: User }) {
  const [rows, setRows] = useState<(KeptMessage & { id: string })[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, "keptMessages"), where("uid", "==", user.uid)),
    (s) => setRows(s.docs.map((d) => ({ ...(d.data() as KeptMessage), id: d.id })).sort((a, b) => b.keptAt.localeCompare(a.keptAt))), () => setRows([])), [user]);
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  function toDraft(text: string) {
    try { sessionStorage.setItem("notesapp:chatDraft", JSON.stringify({ content: text })); } catch {}
    window.location.href = "/write/new?from=chat";
  }
  if (!rows?.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-ink">From chats</h2>
      <p className="mt-1 text-sm text-slate">Messages you kept with 🔖 Keep. Only you can see this list.</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((k) => (
          <li key={k.id} className="card p-4">
            <p className="flex items-center justify-between gap-2 text-xs text-slate"><span className="truncate"><strong className="text-ink">{k.from === user.uid ? "You" : k.fromName}</strong> in {k.chatTitle}</span><span className="shrink-0">{when(k.sentAt)}</span></p>
            {k.text && <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-[15px] text-ink">{k.text}</p>}
            {k.files.length > 0 && <p className="mt-2 text-xs text-slate">📎 {k.files.join(", ")}</p>}
            {k.sticker && !k.text && <p className="mt-2 text-xs text-slate">🖼 A sticker</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link href={`/messages/${k.cid}#m-${k.messageId}`} className="rounded-full border border-rule px-3 py-1.5 font-semibold text-ink hover:bg-paper">Open the chat</Link>
              {k.from === user.uid && k.text && <button type="button" onClick={() => toDraft(k.text)} className="rounded-full border border-rule px-3 py-1.5 font-semibold text-crimson hover:bg-paper">📝 Start a journal draft</button>}
              <button type="button" onClick={() => api(`/api/messages/${k.cid}`, { body: { action: "keep", messageId: k.messageId, keep: false } }).catch(() => {})} className="ml-auto px-2 py-1.5 text-slate underline">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
