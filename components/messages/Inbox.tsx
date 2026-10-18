"use client";

import { EmojiText } from "@/components/NotesAppEmoji";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import Avatar from "@/components/Avatar";
import GroupAvatar from "./GroupAvatar";
import { stripFormat } from "@/lib/message-format";
import MessageSettings from "./MessageSettings";
import HandleLine from "./HandleLine";
import { PinIcon } from "./icons";
import { usePresence } from "@/lib/presence-client";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgeLevel, goldKindOf, isTeamMember, type UserProfile } from "@/lib/users";
import type { GoldBadgeKind } from "@/lib/badges";
import { INBOX_TABS, filterInbox, tabCounts, type Contexts, type InboxTab } from "@/lib/chat-tools";

type Who = { uid: string; username: string; displayName: string; avatar: string; level?: "verified" | "gold" | null; goldKind?: GoldBadgeKind; team?: boolean; isOrg?: boolean };
type Row = { id: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; moment: boolean; with: Who; group?: { title: string; team: boolean; members: number; lastFrom: string; avatar?: string } };

// The inbox, live: new messages and unread counts appear as they arrive (it listens to the member's own conversations, which
// firestore.rules let only the two people in each one read). It fills its card: the title on top, the list scrolling under it; the
// open conversation's row is tinted.
export default function Inbox({ as = "h2" }: { as?: "h1" | "h2" }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = useRef(new Map<string, Who>());
  const [pins, setPins] = useState<string[]>([]); // your pinned chats (chatPins/{uid}, 3 at most)
  const [q, setQ] = useState(""); // the search box
  const [tab, setTab] = useState<InboxTab>("all");
  const [contexts, setContexts] = useState<Contexts | null>(null); // who you have bookings and orders with (for those two chips)
  useEffect(() => { if (user) api<Contexts>("/api/messages/contexts").then(setContexts).catch(() => setContexts({ bookings: [], orders: [] })); }, [user]);
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

  const Heading = as;
  const top = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rule px-5 py-4">
      <Heading className="font-display text-3xl text-ink">Messages</Heading>
      {user && <Link href="/messages/new-group" className="rounded-full px-3 py-1.5 font-ui text-xs font-bold text-ink hover:bg-paper hover:text-crimson">+ New group</Link>}
    </div>
  );
  if (user === null) return <>{top}<p className="p-5 text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to see your messages.</p></>;
  if (error) return <>{top}<p className="p-5 text-red-700" role="alert">{error}</p></>;
  if (!rows) return <>{top}<p className="p-5 text-slate">Loading…</p></>;
  const pill = "shrink-0 rounded px-1.5 py-0.5 font-ui text-[10px] font-bold tracking-wideish";
  const counts = tabCounts(rows, contexts);
  const shown = filterInbox(rows, q, tab, contexts);
  const filtering = !!q.trim() || tab !== "all";
  return (
    <>
      {top}
      {/* Search and the filter chips, as in most messengers: All · Unread · Groups, plus Bookings and Orders (chats with people you have a
          session or a store order with). A chip only shows when it has chats in it. */}
      <div className="shrink-0 space-y-2.5 border-b border-rule px-4 py-3">
        <label className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm text-slate focus-within:ring-2 focus-within:ring-crimson/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4 shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats and people" aria-label="Search chats" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-slate/80" />
        </label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Filter chats">
          {INBOX_TABS.filter((t) => t.key === "all" || t.key === tab || counts[t.key] > 0).map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 font-ui text-xs font-semibold ${tab === t.key ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink hover:bg-paper"}`}>
              {t.label}{t.key !== "all" && counts[t.key] > 0 ? <span className="ml-1.5 font-mono text-[11px] opacity-80">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-rule border-b border-rule">
          {!filtering && <li>
            <Link href="/messages/nana" aria-current={pathname === "/messages/nana" ? "page" : undefined} className={`flex items-center gap-3 px-5 py-3.5 ${pathname === "/messages/nana" ? "bg-paper" : "bg-amber-50/60 hover:bg-paper"}`}>
              <Image src="/images/nana/nana-sm.webp" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-ui text-sm font-bold text-ink">Nana AI <span className={`${pill} bg-crimson/10 text-crimson`}>PINNED</span></span>
                <span className="mt-0.5 block truncate text-[13px] text-slate">Your #NotesApp helper. Ask me anything about the platform.</span>
              </span>
            </Link>
          </li>}
          {[...shown].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)) || (pins.includes(a.id) ? pins.indexOf(a.id) - pins.indexOf(b.id) : 0)).map((r) => {
            const pinned = pins.includes(r.id);
            const open = pathname === `/messages/${r.id}`;
            const status = r.group ? undefined : presence.statuses[r.with.uid];
            const preview = `${r.moment ? "↩ Moment reply · " : ""}${r.lastFromMe ? "You: " : r.group && r.group.lastFrom ? `${r.group.lastFrom}: ` : ""}${stripFormat(r.lastText)}`;
            return (
              <li key={r.id} className={`group flex items-center ${open ? "bg-paper" : ""}`}>
                <Link href={`/messages/${r.id}`} aria-current={open ? "page" : undefined} className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-5 pr-2 ${open ? "" : "hover:bg-paper/70"}`}>
                  {r.group ? <GroupAvatar title={r.group.title} size={40} team={r.group.team} src={r.group.avatar} /> : <Avatar src={r.with.avatar} alt={r.with.displayName} size={40} square={!!r.with.isOrg} className="shrink-0" />}
                  <span className="min-w-0 flex-1">
                    {r.group ? (<>
                      <span className="flex min-w-0 items-center gap-2 font-ui text-sm font-bold text-ink"><span className="truncate">{r.group.title}</span>{r.group.team && <span className={`${pill} bg-amber-100 text-amber-900`}>TEAM</span>}</span>
                      <span className="block text-xs text-slate">{r.group.members} members</span>
                    </>) : (<>
                      {/* Name, badges, then the handle: beside the name, or on the next line with their online status when that's shown. */}
                      <span className="flex min-w-0 items-center font-ui text-sm font-bold text-ink">
                        <span className="truncate">{r.with.displayName}</span>
                        <NameBadgeIcons username={r.with.username} size={14} badges={{ level: r.with.level ?? null, goldKind: r.with.goldKind, team: !!r.with.team }} />
                        {!status && r.with.username && <span className="ml-2 truncate text-xs font-normal text-slate">@{r.with.username}</span>}
                      </span>
                      {status && <HandleLine username={r.with.username} status={status} className="text-xs text-slate" />}
                    </>)}
                    {(r.lastText || r.moment) && <span className={`mt-0.5 block truncate text-[13px] ${r.unread > 0 ? "font-semibold text-ink" : "text-slate"}`}><EmojiText text={preview} /></span>}
                  </span>
                  {r.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-crimson-bright px-1.5 font-ui text-[11px] font-bold text-white">{r.unread}</span>}
                </Link>
                {/* Pinned chats show their pin; on the others it's faint (on desktop, until you point at the row). */}
                <button type="button" onClick={() => togglePin(r.id, !pinned)} title={pinned ? "Unpin this chat" : "Pin this chat to the top (up to 3)"} aria-label={pinned ? "Unpin chat" : "Pin chat"} aria-pressed={pinned} className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-paper ${pinned ? "text-crimson-bright" : "text-slate opacity-30 hover:opacity-90 focus-visible:opacity-90 lg:opacity-0 lg:group-hover:opacity-60"}`}>
                  <PinIcon size={15} />
                </button>
              </li>
            );
          })}
        </ul>
        {filtering && !shown.length && <p className="px-5 pt-4 text-sm text-slate">{q.trim() ? <>No chats match “{q.trim()}”.</> : "No chats here yet."} <button type="button" onClick={() => { setQ(""); setTab("all"); }} className="text-crimson underline">Show all chats</button></p>}
        {!rows.length && <p className="px-5 pt-4 text-sm text-slate">No messages yet. Replies to your moments, and messages from other members, land here. You can also <Link href="/messages/new-group" className="text-crimson underline">start a group</Link>.</p>}
        <div className="px-5 pb-5"><MessageSettings /></div>
      </div>
    </>
  );
}
