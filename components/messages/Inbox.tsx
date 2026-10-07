"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import MessageSettings from "./MessageSettings";

type Who = { uid: string; username: string; displayName: string; avatar: string };
type Row = { id: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; moment: boolean; with: Who };

// The inbox, live: new messages and unread counts appear as they arrive (it listens to the member's own conversations, which
// firestore.rules let only the two people in each one read).
export default function Inbox() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = useRef(new Map<string, Who>());
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, "conversations"), where("participants", "array-contains", uid)),
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, c: d.data() }));
        const others = Array.from(new Set(docs.map(({ c }) => (c.participants as string[]).find((p) => p !== uid) ?? uid)));
        await Promise.all(others.filter((o) => !people.current.has(o)).map(async (o) => {
          // A profile that can't be read (or doesn't exist) shows as "Member" rather than breaking the list.
          const u = o ? await getDoc(doc(db, "users", o)).then((s) => s.data()).catch(() => undefined) : undefined;
          people.current.set(o, { uid: o, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "" });
        }));
        setRows(docs.map(({ id, c }) => {
          const o = (c.participants as string[]).find((p) => p !== uid) ?? uid;
          return {
            id, with: people.current.get(o) ?? { uid: o, username: "", displayName: "Member", avatar: "" }, lastText: c.lastMessage?.text ?? "", lastAt: c.lastMessageAt ?? c.createdAt ?? "",
            lastFromMe: c.lastMessage?.from === uid, unread: (c.unread?.[uid] as number | undefined) ?? 0, moment: c.lastMessage?.moment === true,
          };
        }).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)));
      },
      (e) => setError(e.message)
    );
  }, [user]);

  if (user === null) return <p className="text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your messages.</p>;
  if (error) return <p className="text-red-700" role="alert">{error}</p>;
  if (!rows) return <p className="text-slate">Loading…</p>;
  return (
    <>
      {!rows.length ? (
        <p className="text-slate">No messages yet. Replies to your moments, and messages from other members, land here.</p>
      ) : (
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
      )}
      <MessageSettings />
    </>
  );
}
