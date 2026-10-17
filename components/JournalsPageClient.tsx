"use client";

import AdSlot from "@/components/AdSlot";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, badgeLevel, goldKindOf, isTeamMember, UserProfile } from "@/lib/users";
import { FOUNDER_JOURNALS, MANDATORY_USERNAMES, CHANNEL_JOURNALS } from "@/lib/journals-directory";
import BoostedStrip from "@/components/BoostedStrip";
import MomentsStrip from "@/components/moments/MomentsStrip";
import DiscoveryHero from "@/components/DiscoveryHero";
import ChannelSpotlight from "@/components/ChannelSpotlight";
import SocialChannelSpotlight from "@/components/SocialChannelSpotlight";
import FoundersSpotlight from "@/components/FoundersSpotlight";
import JournalDirectory from "@/components/JournalDirectory";
import TopicsBrowser from "@/components/TopicsBrowser";
import JournalRow from "@/components/JournalRow";
import BadgeToast from "@/components/BadgeToast";
import Shelf from "@/components/Shelf";
import RankedList from "@/components/RankedList";
import FollowCards from "@/components/FollowCards";
import { hashtag, isTopic, topicLabel, topicsOf } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";
import { useWeeklyViews } from "@/lib/weekly-views-client";
import { byForYou, byMostViewed, byRecent, shelves, type Shelfable } from "@/lib/discovery";

// Journals (/journals): the reader's interests first, then what most people read this week, then the newest (lib/discovery.ts),
// then people and channels to follow. Each shelf has its own tab; Topics, People and Channels as before.
type Tab = "all" | "foryou" | "viewed" | "recent" | "topics" | "people" | "channels";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" }, { id: "foryou", label: "For you" }, { id: "viewed", label: "Most viewed" }, { id: "recent", label: "Recent" },
  { id: "topics", label: "Topics" }, { id: "people", label: "People" }, { id: "channels", label: "Channels" },
];
type Shelved = NoteWithComputed & Shelfable;
const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2";

export default function JournalsPageClient() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { interests, signedIn } = useInterests();
  const weekly = useWeeklyViews("note");

  useEffect(() => {
    getAllNotes({ publishedOnly: true }).then(setNotes).catch((e) => setError(e.message));
    getAllUsers().then(setUsers).catch(() => setUsers([]));
    // Links from a journal's hashtags: /journals?topic=fintech opens the Topics tab on it; /journals?q=word searches;
    // /journals?tab=recent opens a shelf.
    const sp = new URLSearchParams(window.location.search);
    const topic = sp.get("topic"), q0 = sp.get("q"), t0 = sp.get("tab");
    if (topic && isTopic(topic)) { setTab("topics"); setSelectedTopic(topic); }
    else if (t0 && TABS.some((t) => t.id === t0)) setTab(t0 as Tab);
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
      .map((u) => ({
        username: u.username, displayName: u.displayName, avatar: u.avatar, bio: u.bio,
        badge: badgeLevel(u), goldKind: goldKindOf(u), organisation: true, unverified: u.org?.rcStatus !== "verified",
      }));
    return [...CHANNEL_JOURNALS, ...orgs];
  }, [users]);
  const orgChannels = useMemo(() => channels.filter((c) => !CHANNEL_JOURNALS.some((o) => o.username === c.username)), [channels]);

  const q = query.trim().toLowerCase();
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.author.toLowerCase().includes(q) ||
        topicsOf(n).some((t) => topicLabel(t).toLowerCase().includes(q) || t.includes(q)) ||
        n.categories.some((c) => c.toLowerCase().includes(q)) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, q]);
  const filteredPeople = useMemo(() => (q ? people.filter((p) => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)) : people), [people, q]);
  const filteredChannels = useMemo(() => (q ? channels.filter((c) => c.displayName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)) : channels), [channels, q]);

  // The shelves (lib/discovery.ts): each journal with its topics, date and visits.
  const shelved = useMemo<Shelved[]>(
    // This week's visits once any exist, so every journal is compared on the same count; lifetime visits until then.
    () => filteredNotes.map((n) => ({ ...n, topics: topicsOf(n), publishedAt: n.date, views: n.viewCount || 0, viewsWeek: Object.keys(weekly).length ? weekly[n.id] ?? 0 : undefined, ownerUsername: n.authorUsername })),
    [filteredNotes, weekly],
  );
  const reader = useMemo(() => ({ interests: interests ?? [] }), [interests]);
  const s = useMemo(() => shelves(shelved, reader, 6), [shelved, reader]);
  const toFollow = useMemo(() => [...FOUNDER_JOURNALS, ...CHANNEL_JOURNALS, ...orgChannels].slice(0, 10).map((p) => ({ username: p.username, displayName: p.displayName, avatar: p.avatar, isOrg: "organisation" in p })), [orgChannels]);

  const why = (interests ?? []).length > 0
    ? <>Because you chose {(interests ?? []).slice(0, 4).map(hashtag).join(" ")}{(interests ?? []).length > 4 ? " …" : ""} · <Link href="/interests" className="text-crimson">Change your interests</Link></>
    : null;
  const pickInterests = signedIn ? (
    <div className="card flex flex-wrap items-center justify-between gap-4 border-crimson/30 p-5">
      <div>
        <p className="font-display text-xl">Make this feed yours</p>
        <p className="mt-1 text-sm text-slate">Choose the topics you like and journals on them come first, here and in your weekly digest.</p>
      </div>
      <Link href="/interests" className="btn-primary !px-5 !py-2 text-sm">Choose your interests</Link>
    </div>
  ) : (
    <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
      <p className="text-sm text-slate">Sign in and choose your interests to see journals on your topics first.</p>
      <Link href="/login?next=/interests" className="btn-ghost !px-5 !py-2 text-sm">Sign in</Link>
    </div>
  );
  const views = (n: Shelved) => n.viewsWeek ?? n.views;
  const ranked = (list: Shelved[]) => (
    <RankedList rows={list.map((n) => ({ key: n.id, href: `/journals/${n.slug}`, title: n.title, sub: <>{n.author} · {topicsOf(n)[0] ? hashtag(topicsOf(n)[0]) : "Journal"}</>, count: views(n), image: n.featured_image || undefined }))} />
  );
  const rows = (list: Shelved[]) => <div className={grid}>{list.map((n) => <JournalRow key={n.id} note={n} showAuthor />)}</div>;
  const weekBasis = Object.keys(weekly).length > 0 ? "this week" : "all time";

  return (
    <div>
      <DiscoveryHero eyebrow="Journals" title="Read what matters to you" sub="Your interests first, then what everyone's reading, then what's new."
        query={query} onQuery={setQuery} placeholder="Search journals, people and #topics" tabs={TABS} tab={tab} onTab={setTab} />

      <MomentsStrip />
      <BoostedStrip />
      <AdSlot placement="journals" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {error ? (
          <div className="card p-8 text-sm text-slate">Couldn&apos;t load journals right now. Try again in a minute. ({error})</div>
        ) : notes === null ? (
          <p className="py-16 text-center text-sm text-slate">Loading journals…</p>
        ) : (
          <>
            {tab === "all" && (q ? (
              <>
                {(filteredPeople.length > 0 || filteredChannels.length > 0) && (
                  <Shelf title="People and channels"><JournalDirectory entries={[...filteredChannels, ...filteredPeople]} allNotes={notes} emptyMessage="" /></Shelf>
                )}
                <Shelf title={`Journals matching “${query.trim()}”`}>
                  {filteredNotes.length ? rows(byRecent(shelved)) : <p className="text-sm text-slate">No journals match that yet.</p>}
                </Shelf>
              </>
            ) : (
              <>
                <Shelf title="For you" why={why} seeAll={s.forYou.length ? { href: "/journals?tab=foryou" } : undefined}>
                  {s.forYou.length ? rows(s.forYou) : (interests ?? []).length ? <p className="text-sm text-slate">Nothing new on your topics yet. <Link href="/interests" className="text-crimson">Add more interests</Link>.</p> : pickInterests}
                </Shelf>
                {s.mostViewed.length > 0 && (
                  <Shelf title={`Most viewed ${weekBasis}`} why={`What people on #NotesApp read most ${weekBasis === "this week" ? "in the last 7 days" : "so far"}.`} seeAll={{ href: "/journals?tab=viewed" }}>{ranked(s.mostViewed)}</Shelf>
                )}
                <Shelf title="Recent" why="The newest journals from everyone." seeAll={{ href: "/journals?tab=recent" }}>
                  {s.recent.length ? rows(s.recent) : <p className="text-sm text-slate">No published journals yet. <Link href="/write" className="text-crimson">Write the first one</Link>.</p>}
                </Shelf>
                <Shelf title="People and channels to follow" seeAll={{ href: "/journals?tab=people", label: "All people" }}><FollowCards people={toFollow} /></Shelf>
              </>
            ))}

            {tab === "foryou" && (
              <Shelf title="For you" why={why}>{(interests ?? []).length ? (byForYou(shelved, reader).length ? rows(byForYou(shelved, reader)) : <p className="text-sm text-slate">Nothing on your topics yet.</p>) : pickInterests}</Shelf>
            )}
            {tab === "viewed" && <Shelf title={`Most viewed ${weekBasis}`}>{ranked(byMostViewed(shelved).filter((n) => views(n) > 0).slice(0, 50))}</Shelf>}
            {tab === "recent" && <Shelf title="Recent">{rows(byRecent(shelved))}</Shelf>}
            {tab === "topics" && (
              <Shelf title="Topics" why={<>Browse by topic. <Link href="/interests" className="text-crimson underline underline-offset-2">Choose your interests</Link> to see your topics first.</>}>
                <TopicsBrowser notes={filteredNotes} interests={interests ?? []} selectedTopic={selectedTopic} onSelectTopic={setSelectedTopic} />
              </Shelf>
            )}
            {tab === "people" && (
              <>
                <FoundersSpotlight allNotes={notes} />
                <div className="mt-8"><Shelf title="People" why="Individual journals: a person's own writing."><JournalDirectory entries={filteredPeople} allNotes={notes} emptyMessage="No people match that search." /></Shelf></div>
              </>
            )}
            {tab === "channels" && (
              <>
                <div className="grid gap-6"><ChannelSpotlight /><SocialChannelSpotlight allNotes={notes} /></div>
                <div className="mt-8"><Shelf title="Channels" why="Brand, company and organisation journals: the official #NotesApp channels and every organisation account."><JournalDirectory entries={filteredChannels} allNotes={notes} emptyMessage="More channels are joining soon." /></Shelf></div>
              </>
            )}
          </>
        )}
      </div>
      <BadgeToast />
    </div>
  );
}
