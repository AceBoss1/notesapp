"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";

type Row = { id: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; moment: boolean; with: { uid: string; username: string; displayName: string; avatar: string } };

export default function Inbox() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    api<{ conversations: Row[] }>("/api/messages").then((r) => setRows(r.conversations)).catch((e) => setError(e.message));
  }, [user]);

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your messages.</p>;
  if (error) return <p className="text-red-700" role="alert">{error}</p>;
  if (!rows) return <p className="text-slate">Loading…</p>;
  if (!rows.length) return <p className="text-slate">No messages yet. Replies to your moments, and messages from other members, land here.</p>;
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/messages/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-paper">
            <Avatar src={r.with.avatar} alt={r.with.displayName} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">{r.with.displayName} <span className="font-normal text-slate">@{r.with.username}</span></span>
              <span className="block truncate text-sm text-slate">{r.moment ? "↩ Moment reply · " : ""}{r.lastFromMe ? "You: " : ""}{r.lastText}</span>
            </span>
            {r.unread > 0 && <span className="rounded-full bg-crimson px-2 py-0.5 text-xs font-bold text-white">{r.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
