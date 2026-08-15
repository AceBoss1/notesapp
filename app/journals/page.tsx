"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, UserProfile } from "@/lib/users";
import { FOUNDER_JOURNALS, MANDATORY_USERNAMES, CHANNEL_JOURNALS } from "@/lib/journals-directory";
import JournalsHero, { JournalsTab } from "@/components/JournalsHero";
import ChannelSpotlight from "@/components/ChannelSpotlight";
import SocialChannelSpotlight from "@/components/SocialChannelSpotlight";
import FoundersSpotlight from "@/components/FoundersSpotlight";
import JournalDirectory from "@/components/JournalDirectory";
import TopicsBrowser from "@/components/TopicsBrowser";
import JournalRow from "@/components/JournalRow";

export default function JournalsPage() {
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<JournalsTab>("all");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    getAllNotes({ publishedOnly: true }).then(setNotes).catch((e) => setError(e.message));
    getAllUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  // "People" — every individual journal: both founders plus any other
  // registered member who isn't a brand/channel account.
  const people = useMemo(() => {
    const others = users
      .filter((u) => !MANDATORY_USERNAMES.includes(u.username))
      .map((u) => ({ username: u.username, displayName: u.displayName, avatar: u.avatar, bio: u.bio }));
    return [...FOUNDER_JOURNALS, ...others];
  }, [users]);

  // "Channels" — brand/company journals. @notesapp (synthetic posts)
  // and @na-notesapp (real, Firestore-backed) today.
  const channels = CHANNEL_JOURNALS;

  const q = query.trim().toLowerCase();

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.author.toLowerCase().includes(q) ||
        n.categories.some((c) => c.toLowerCase().includes(q)) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, q]);

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
                  <p className="eyebrow">More Journals</p>
                  {filteredNotes.length === 0 ? (
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
                      {filteredNotes.map((n) => (
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
                  <p className="mt-1 text-sm text-slate">Brand and company journals.</p>
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
                  <p className="mt-1 text-sm text-slate">Browse by category.</p>
                  <div className="mt-5">
                    <TopicsBrowser
                      notes={filteredNotes}
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
    </div>
  );
}
