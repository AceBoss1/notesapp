"use client";

import AdSlot from "@/components/AdSlot";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, badgeLevel, goldKindOf, isTeamMember, UserProfile } from "@/lib/users";
import { FOUNDER_JOURNALS, MANDATORY_USERNAMES, CHANNEL_JOURNALS } from "@/lib/journals-directory";
import BoostedStrip from "@/components/BoostedStrip";
import MomentsStrip from "@/components/moments/MomentsStrip";
import JournalsHero, { JournalsTab } from "@/components/JournalsHero";
import ChannelSpotlight from "@/components/ChannelSpotlight";
import SocialChannelSpotlight from "@/components/SocialChannelSpotlight";
import FoundersSpotlight from "@/components/FoundersSpotlight";
import JournalDirectory from "@/components/JournalDirectory";
import TopicsBrowser from "@/components/TopicsBrowser";
import JournalRow from "@/components/JournalRow";
import BadgeToast from "@/components/BadgeToast";
import { hashtag, interestsFirst, isTopic, topicLabel, topicsOf } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";

export default function JournalsPageClient() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<JournalsTab>("all");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const { interests, signedIn } = useInterests();

  useEffect(() => {
    getAllNotes({ publishedOnly: true }).then(setNotes).catch((e) => setError(e.message));
    getAllUsers().then(setUsers).catch(() => setUsers([]));
    // Links from a journal's hashtags: /journals?topic=fintech opens the Topics tab on it; /journals?q=word searches.
    const sp = new URLSearchParams(window.location.search);
    const topic = sp.get("topic"), q0 = sp.get("q");
    if (topic && isTopic(topic)) { setActiveTab("topics"); setSelectedTopic(topic); }
    if (q0) setQuery(q0.slice(0, 80));
  }, []);

  // "People" — every individual journal: both founders plus any other
  // registered member who isn't a brand/channel account.
  const people = useMemo(() => {
    const others = users
      .filter((u) => !MANDATORY_USERNAMES.includes(u.username) && u.accountKind !== "organisation")
      .map((u) => ({ username: u.username, displayName: u.displayName, avatar: u.avatar, bio: u.bio, badge: badgeLevel(u), goldKind: goldKindOf(u), team: isTeamMember(u) }));
    return [...FOUNDER_JOURNALS, ...others];
  }, [users]);

  // "Channels" — brand/company journals. @notesapp (synthetic posts)
  // and @na-notesapp (real, Firestore-backed) today.
  // Organisation accounts are channels too — each is a company, NGO, church or school's own journal.
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

  // Journals on the reader's interests first ("For you"), the rest after (lib/topics.ts). Not while searching.
  const forYou = useMemo(() => interestsFirst(filteredNotes, interests ?? []), [filteredNotes, interests]);

  const filteredPeople = useMemo(() => {
    if (!q) return people;
    return people.filter(
      (p) => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
    );
  }, [people, q]);

  const filteredChannels = useMemo(() => {
    if (!q) return channels;
    return channels.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
    );
  }, [channels, q]);

  return (
    <div>
      <JournalsHero
        query={query}
        onQueryChange={setQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <BoostedStrip />
      <MomentsStrip />
      <AdSlot placement="journals" />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {error ? (
          <div className="card p-8 text-sm text-slate">
            Couldn't load journals yet — connect Firebase in{" "}
            <code className="font-mono text-crimson-bright">.env.local</code>{" "}
            (same project as precheks-site) to see live data here. ({error})
          </div>
        ) : notes === null ? (
          <p className="py-16 text-center text-sm text-slate">Loading journals…</p>
        ) : (
          <>
            {/* @notesapp first, then @na-notesapp, then the founders'
                big card — shown regardless of tab, same as merch
                shows official products first every time. */}
            <div className="grid gap-6">
              <ChannelSpotlight />
              <SocialChannelSpotlight allNotes={notes} />
              {/* The channels, listed as on the Channels tab, right under the Public Channels card (the two official ones are the cards above). */}
              {orgChannels.length > 0 && (
                <div className="-mt-2">
                  <JournalDirectory entries={orgChannels} allNotes={notes} emptyMessage="" />
                </div>
              )}
              <FoundersSpotlight allNotes={notes} />
            </div>

            <div className="mt-16">
              {activeTab === "all" && (
                <>
                  {q && (filteredPeople.length > 0 || filteredChannels.length > 0) && (
                    <div className="mb-10">
                      <p className="eyebrow">People &amp; Channels</p>
                      <div className="mt-4">
                        <JournalDirectory
                          entries={[...filteredChannels, ...filteredPeople]}
                          allNotes={notes}
                          emptyMessage=""
                        />
                      </div>
                    </div>
                  )}
                  {!q && signedIn && interests !== null && interests.length === 0 && (
                    <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 border-crimson/30 p-5">
                      <div>
                        <p className="font-display text-xl">Make this feed yours</p>
                        <p className="mt-1 text-sm text-slate">Choose the topics you like and journals on them come first, here and in your weekly digest.</p>
                      </div>
                      <Link href="/interests" className="btn-primary !px-5 !py-2 text-sm">Choose your interests</Link>
                    </div>
                  )}
                  {!q && forYou.picked.length > 0 && (
                    <div className="mb-12">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="eyebrow">For you</p>
                        <Link href="/interests" className="font-ui text-xs font-semibold text-crimson">Your interests: {(interests ?? []).slice(0, 4).map(hashtag).join(" ")}{(interests ?? []).length > 4 ? " …" : ""} · Change</Link>
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {forYou.picked.map((n) => <JournalRow key={n.id} note={n} showAuthor />)}
                      </div>
                    </div>
                  )}
                  <p className="eyebrow">{!q && forYou.picked.length > 0 ? "Everything else" : "More Journals"}</p>
                  {(q ? filteredNotes : forYou.rest).length === 0 && forYou.picked.length > 0 && !q ? (
                    <p className="mt-4 text-sm text-slate">That's everything for now.</p>
                  ) : filteredNotes.length === 0 ? (
                    <p className="mt-4 text-sm text-slate">
                      No published entries{q ? ` matching "${query}"` : ""} yet.{" "}
                      {!q && (
                        <Link href="/admin/journals/new" className="text-crimson underline underline-offset-2">
                          Write the first one
                        </Link>
                      )}
                    </p>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(q ? filteredNotes : forYou.rest).map((n) => (
                        <JournalRow key={n.id} note={n} showAuthor />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === "people" && (
                <>
                  <p className="eyebrow">People</p>
                  <p className="mt-1 text-sm text-slate">Individual journals — a person's own writing.</p>
                  <div className="mt-5">
                    <JournalDirectory
                      entries={filteredPeople}
                      allNotes={notes}
                      emptyMessage="No people match that search."
                    />
                  </div>
                </>
              )}

              {activeTab === "channels" && (
                <>
                  <p className="eyebrow">Channels</p>
                  <p className="mt-1 text-sm text-slate">Brand, company and organisation journals — the official #NotesApp channels plus every organisation account.</p>
                  <div className="mt-5">
                    <JournalDirectory
                      entries={filteredChannels}
                      allNotes={notes}
                      emptyMessage="More channels are joining soon."
                    />
                  </div>
                </>
              )}

              {activeTab === "topics" && (
                <>
                  <p className="eyebrow">Topics</p>
                  <p className="mt-1 text-sm text-slate">Browse by topic. <Link href="/interests" className="text-crimson underline underline-offset-2">Choose your interests</Link> to see your topics first.</p>
                  <div className="mt-5">
                    <TopicsBrowser
                      notes={filteredNotes}
                      interests={interests ?? []}
                      selectedTopic={selectedTopic}
                      onSelectTopic={setSelectedTopic}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <BadgeToast />
    </div>
  );
}
