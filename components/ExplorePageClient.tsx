"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, badgeLevel, goldKindOf, isTeamMember, UserProfile } from "@/lib/users";
import { FOUNDER_JOURNALS, MANDATORY_USERNAMES, CHANNEL_JOURNALS } from "@/lib/journals-directory";
import ChannelSpotlight from "@/components/ChannelSpotlight";
import SocialChannelSpotlight from "@/components/SocialChannelSpotlight";
import FoundersSpotlight from "@/components/FoundersSpotlight";
import JournalDirectory from "@/components/JournalDirectory";
import TopicsBrowser from "@/components/TopicsBrowser";
import Shelf from "@/components/Shelf";
import AdSlot from "@/components/AdSlot";
import { isTopic } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";
import MarketCard from "@/components/MarketCard";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { useAcademy } from "@/lib/courses-client";
import { courseHref } from "@/lib/courses";
import type { MarketItem } from "@/lib/shop-directory";

// Explore (/explore, Moda redesign): what used to be the Topics, People and Channels tabs of Journals, now that Journals is the feed,
// plus Market and Academy: the most looked-at items and courses this week, searchable here, with a way into each.
type Tab = "topics" | "people" | "channels" | "market" | "academy";
const TABS: { id: Tab; label: string }[] = [
  { id: "topics", label: "Topics" }, { id: "people", label: "People" }, { id: "channels", label: "Channels" }, { id: "market", label: "Market" }, { id: "academy", label: "Academy" },
];
const SHOW = 24;

export default function ExplorePageClient() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("topics");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { interests } = useInterests();
  const [market, setMarket] = useState<MarketItem[] | null>(null);
  const courses = useAcademy(undefined, tab === "academy");
  useEffect(() => {
    if (tab !== "market" || market) return;
    fetch("/api/public/market").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setMarket(d.items ?? [])).catch(() => setMarket([]));
  }, [tab, market]);

  useEffect(() => {
    getAllNotes({ publishedOnly: true }).then(setNotes).catch(() => setNotes([]));
    getAllUsers().then(setUsers).catch(() => setUsers([]));
    const sp = new URLSearchParams(window.location.search);
    const t0 = sp.get("tab"), topic = sp.get("topic"), q0 = sp.get("q");
    if (t0 && TABS.some((t) => t.id === t0)) setTab(t0 as Tab);
    if (topic && isTopic(topic)) { setTab("topics"); setSelectedTopic(topic); }
    if (q0) setQuery(q0.slice(0, 80));
  }, []);

  // "People": every individual journal, both founders first. "Channels": brand and organisation journals.
  const people = useMemo(() => {
    const others = users
      .filter((u) => !MANDATORY_USERNAMES.includes(u.username) && u.accountKind !== "organisation")
      .map((u) => ({ username: u.username, displayName: u.displayName, avatar: u.avatar, bio: u.bio, badge: badgeLevel(u), goldKind: goldKindOf(u), team: isTeamMember(u) }));
    return [...FOUNDER_JOURNALS, ...others];
  }, [users]);
  const channels = useMemo(() => {
    const orgs = users
      .filter((u) => u.accountKind === "organisation" && u.suspended !== true)
      .map((u) => ({ username: u.username, displayName: u.displayName, avatar: u.avatar, bio: u.bio, badge: badgeLevel(u), goldKind: goldKindOf(u), organisation: true, unverified: u.org?.rcStatus !== "verified" }));
    return [...CHANNEL_JOURNALS, ...orgs];
  }, [users]);
  const q = query.trim().toLowerCase();
  const items = useMemo(() => (market ?? [])
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.sellerName.toLowerCase().includes(q) || i.sellerUsername.includes(q) || i.category.toLowerCase().includes(q))
    .sort((a, b) => b.viewsWeek - a.viewsWeek).slice(0, SHOW), [market, q]);
  const courseList = useMemo(() => (courses ?? [])
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.topics.some((t) => t.includes(q)))
    .sort((a, b) => b.viewsWeek - a.viewsWeek || b.enrolCount - a.enrolCount).slice(0, SHOW), [courses, q]);
  const match = <P extends { displayName: string; username: string }>(list: P[]) => (q ? list.filter((p) => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)) : list);

  return (
    <div className="px-4 py-6 lg:px-0">
      <h1 className="font-display text-4xl text-ink">Explore</h1>
      <p className="mt-1 text-sm text-slate">Topics, people, channels, things to buy and courses on #NotesApp.</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "market" ? "Find products and stores" : tab === "academy" ? "Find courses and teachers" : "Find people and channels"} aria-label="Search Explore"
        className="mt-4 w-full max-w-md rounded-full border border-rule bg-card px-5 py-2.5 text-sm outline-none focus:border-crimson" />
      <div className="mt-5 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-5 py-2 font-ui text-sm font-semibold ${tab === t.id ? "bg-crimson-deep text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`}>{t.label}</button>
        ))}
      </div>
      <div className="mt-5 empty:hidden"><AdSlot key={tab} placement="explore" offset={TABS.findIndex((t) => t.id === tab)} className="!my-0" /></div>
      <div className="mt-6">
        {notes === null ? <p className="py-16 text-center text-sm text-slate">Loading…</p> : (
          <>
            {tab === "topics" && (
              <Shelf title="Topics" why={<>Browse by topic. <Link href="/interests" className="text-crimson underline underline-offset-2">Choose your interests</Link> to see your topics first.</>}>
                <TopicsBrowser notes={notes} interests={interests ?? []} selectedTopic={selectedTopic} onSelectTopic={setSelectedTopic} />
              </Shelf>
            )}
            {tab === "people" && (
              <>
                {!q && <FoundersSpotlight allNotes={notes} />}
                <div className="mt-8"><Shelf title="People" why="Individual journals: a person's own writing."><JournalDirectory entries={match(people)} allNotes={notes} emptyMessage="No people match that search." /></Shelf></div>
              </>
            )}
            {tab === "market" && (
              <Shelf title="Notes Market" why={<>Most looked at this week, from every #NotesApp store. <Link href="/shop" className="font-semibold text-crimson">Open Notes Market →</Link></>}>
                {market === null ? <p className="py-10 text-center text-sm text-slate">Loading…</p> : items.length
                  ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{items.map((i) => <MarketCard key={i.id} item={i} />)}</div>
                  : <p className="py-10 text-center text-sm text-slate">{q ? "Nothing matches that search." : "No items yet."}</p>}
              </Shelf>
            )}
            {tab === "academy" && (
              <Shelf title="Notes Academy" why={<>Free and paid courses from people who&apos;ve done it, with a certificate anyone can check. <Link href="/academy" className="font-semibold text-crimson">Open Notes Academy →</Link></>}>
                {courses === undefined ? <p className="py-10 text-center text-sm text-slate">Loading…</p> : courseList.length
                  ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{courseList.map((c) => <CourseCard key={c.id} c={courseCardOf(c)} href={courseHref(c.slug)} />)}</div>
                  : <p className="py-10 text-center text-sm text-slate">{q ? "No courses match that search." : "No courses yet."}</p>}
              </Shelf>
            )}
            {tab === "channels" && (
              <>
                {!q && <div className="grid gap-6"><ChannelSpotlight /><SocialChannelSpotlight allNotes={notes} /></div>}
                <div className="mt-8"><Shelf title="Channels" why="Brand, company and organisation journals: the official #NotesApp channels and every organisation account."><JournalDirectory entries={match(channels)} allNotes={notes} emptyMessage="More channels are joining soon." /></Shelf></div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
