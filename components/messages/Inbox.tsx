"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import GroupAvatar from "./GroupAvatar";
import { stripFormat } from "@/lib/message-format";
import MessageSettings from "./MessageSettings";
import PresenceText from "@/components/PresenceText";
import { usePresence } from "@/lib/presence-client";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgeLevel, goldKindOf, isTeamMember, type UserProfile } from "@/lib/users";
import type { GoldBadgeKind } from "@/lib/badges";

type Who = { uid: string; username: string; displayName: string; avatar: string; level?: "verified" | "gold" | null; goldKind?: GoldBadgeKind; team?: boolean; isOrg?: boolean };
type Row = { id: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; moment: boolean; with: Who; group?: { title: string; team: boolean; members: number; lastFrom: string; avatar?: string } };

// The inbox, live: new messages and unread counts appear as they arrive (it listens to the member's own conversations, which
// firestore.rules let only the two people in each one read).
export default function Inbox() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = useRef(new Map<string, Who>());
  const [pins, setPins] = useState<string[]>([]); // your pinned chats (chatPins/{uid}, 3 at most)
  useEffect(() => { if (!user) return; return onSnapshot(doc(db, "chatPins", user.uid), (d) => setPins((d.data()?.list as string[] | undefined) ?? []), () => {}); }, [user]);
  async function togglePin(id: string, pin: boolean) {
    setError(null);
    try { await api(`/api/messages/${id}`, { body: { action: "pin_chat", pin } }); }
    catch (e) { alert(e instanceof Error ? e.message : "Couldn't pin that chat."); }
  }
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const presence = usePresence((rows ?? []).filter((r) => !r.group && r.with.uid && r.with.uid !== user?.uid).map((r) => r.with.uid));

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, "conversations"), where("participants", "array-contains", uid)),
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, c: d.data() }));
        const others = Array.from(new Set(docs.filter(({ c }) => c.kind !== "group").map(({ c }) => (c.participants as string[]).find((p) => p !== uid) ?? uid)));
        await Promise.all(others.filter((o) => !people.current.has(o)).map(async (o) => {
          // A profile that can't be read (or doesn't exist) shows as "Member" rather than breaking the list.
          const u = o ? await getDoc(doc(db, "users", o)).then((s) => s.data()).catch(() => undefined) : undefined;
          people.current.set(o, { uid: o, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "", isOrg: u?.accountKind === "organisation", ...(u ? { level: badgeLevel(u as UserProfile), goldKind: goldKindOf(u as UserProfile), team: isTeamMember(u as UserProfile) } : {}) });
        }));
        setRows(docs.map(({ id, c }) => {
          const isGroup = c.kind === "group";
          const o = isGroup ? "" : (c.participants as string[]).find((p) => p !== uid) ?? uid;
          return {
            id, with: people.current.get(o) ?? { uid: o, username: "", displayName: "Member", avatar: "" },
            ...(isGroup ? { group: { title: String(c.title ?? "Group"), avatar: c.avatar ? String(c.avatar) : undefined, team: c.scope === "team", members: (c.participants as string[]).length, lastFrom: String(c.lastMessage?.fromName ?? "").split(" ")[0] } } : {}), lastText: c.lastMessage?.text ?? "", lastAt: c.lastMessageAt ?? c.createdAt ?? "",
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
      <p className="mb-3 text-right"><Link href="/messages/new-group" className="btn-ghost !px-4 !py-2 text-xs">+ New group</Link></p>
      <ul className="divide-y divide-rule border-y border-rule">
          <li className="bg-amber-50/60">
            <Link href="/messages/nana" className="flex items-center gap-3 px-2 py-3 hover:bg-paper">
              <Image src="/images/nana/nana-sm.webp" alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">Nana AI <span className="rounded bg-crimson/10 px-1.5 py-0.5 text-[10px] font-bold text-crimson">PINNED</span></span>
                <span className="block truncate text-sm text-slate">Your #NotesApp helper. Ask me anything about the platform.</span>
              </span>
            </Link>
          </li>
          {[...rows].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || (pins.includes(a.id) ? pins.indexOf(a.id) - pins.indexOf(b.id) : 0)).map((r) => (
            <li key={r.id} className={`flex items-center ${pins.includes(r.id) ? "bg-paper/60" : ""}`}>
              <Link href={`/messages/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 hover:bg-paper">
                {r.group ? <GroupAvatar title={r.group.title} size={44} team={r.group.team} src={r.group.avatar} /> : <Avatar src={r.with.avatar} alt={r.with.displayName} size={44} square={!!r.with.isOrg} />}
                <span className="min-w-0 flex-1">
                  {r.group ? (
                    <span className="block font-bold text-ink">{r.group.title} {r.group.team && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">TEAM</span>} <span className="font-normal text-slate">{r.group.members} members</span></span>
                  ) : (
                    <span className="block font-bold text-ink">{r.with.displayName}<NameBadgeIcons username={r.with.username} size={14} badges={{ level: r.with.level ?? null, goldKind: r.with.goldKind, team: !!r.with.team }} /> <span className="font-normal text-slate">@{r.with.username}</span></span>
                  )}
                  {!r.group && <PresenceText status={presence.statuses[r.with.uid]} className="block" />}
                  <span className="block truncate text-sm text-slate">{r.moment ? "↩ Moment reply · " : ""}{r.lastFromMe ? "You: " : r.group && r.group.lastFrom ? `${r.group.lastFrom}: ` : ""}{stripFormat(r.lastText)}</span>
                </span>
                {r.unread > 0 && <span className="rounded-full bg-crimson px-2 py-0.5 text-xs font-bold text-white">{r.unread}</span>}
              </Link>
              <button type="button" onClick={() => togglePin(r.id, !pins.includes(r.id))} title={pins.includes(r.id) ? "Unpin this chat" : "Pin this chat to the top (up to 3)"} aria-label={pins.includes(r.id) ? "Unpin chat" : "Pin chat"} className={`ml-1 shrink-0 rounded-full px-2 py-1 text-sm ${pins.includes(r.id) ? "" : "opacity-30 hover:opacity-80"}`}>📌</button>
            </li>
          ))}
        </ul>
      {!rows.length && <p className="mt-4 text-slate">No messages yet. Replies to your moments, and messages from other members, land here. You can also <Link href="/messages/new-group" className="text-crimson underline">start a group</Link>.</p>}
      <MessageSettings />
    </>
  );
}
