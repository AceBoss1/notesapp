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
import { isTopic } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";

// Explore (/explore, Moda redesign): what used to be the Topics, People and Channels tabs of Journals, now that Journals is the feed.
type Tab = "topics" | "people" | "channels";
const TABS: { id: Tab; label: string }[] = [{ id: "topics", label: "Topics" }, { id: "people", label: "People" }, { id: "channels", label: "Channels" }];

export default function ExplorePageClient() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("topics");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { interests } = useInterests();

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
  const match = <P extends { displayName: string; username: string }>(list: P[]) => (q ? list.filter((p) => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)) : list);

  return (
    <div className="px-4 py-6 lg:px-0">
      <h1 className="font-display text-4xl text-ink">Explore</h1>
      <p className="mt-1 text-sm text-slate">Topics, people and channels on #NotesApp.</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find people and channels" aria-label="Find people and channels"
        className="mt-4 w-full max-w-md rounded-full border border-rule bg-card px-5 py-2.5 text-sm outline-none focus:border-crimson" />
      <div className="mt-5 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-5 py-2 font-ui text-sm font-semibold ${tab === t.id ? "bg-crimson-deep text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`}>{t.label}</button>
        ))}
      </div>
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
