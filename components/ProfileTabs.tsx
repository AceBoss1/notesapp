"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JournalRow from "@/components/JournalRow";
import NotesAppPostRow from "@/components/NotesAppPostRow";
import ItemCard from "@/components/StoreItemCard";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";
import type { NoteWithComputed } from "@/lib/firestore-notes";
import type { StoreItem } from "@/lib/store";
import { hashtag, topicsOf } from "@/lib/topics";
import { byMostViewed, byRecent } from "@/lib/discovery";
import { useWeeklyViews } from "@/lib/weekly-views-client";

// A profile's Notes · Store · Courses (/u/<username>; ?tab=store or ?tab=courses opens one). Notes can be sorted by Most viewed
// or Recent and narrowed to one of the topics they write about. Courses come with Notes Academy (docs/COURSES.md).
type Tab = "notes" | "store" | "courses";
type Sort = "viewed" | "recent";

export default function ProfileTabs({ username, notes, storeItems, isOfficial, suspended, storeFirst }: {
  username: string; notes: NoteWithComputed[]; storeItems: StoreItem[]; isOfficial: boolean; suspended: boolean; storeFirst: boolean;
}) {
  const [tab, setTab] = useState<Tab>(storeFirst ? "store" : "notes");
  const [sort, setSort] = useState<Sort>("recent");
  const [topic, setTopic] = useState<string | null>(null);
  const weekly = useWeeklyViews("note");
  useEffect(() => { if (storeFirst) setTab("store"); }, [storeFirst]);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "store" || t === "courses" || t === "notes") setTab(t);
  }, []);

  const noteCount = isOfficial ? NOTESAPP_POSTS.length : notes.length;
  const topics = useMemo(() => {
    const c = new Map<string, number>();
    notes.forEach((n) => topicsOf(n).forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [notes]);
  const listed = useMemo(() => {
    const anyWeek = Object.keys(weekly).length > 0;
    const shelf = notes.filter((n) => !topic || topicsOf(n).includes(topic))
      .map((n) => ({ ...n, topics: topicsOf(n), publishedAt: n.date, views: n.viewCount || 0, viewsWeek: anyWeek ? weekly[n.id] ?? 0 : undefined }));
    return sort === "viewed" ? byMostViewed(shelf) : byRecent(shelf);
  }, [notes, topic, sort, weekly]);
  const chip = (on: boolean) => `flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-ink text-paper" : "bg-card text-slate ring-1 ring-rule hover:text-ink"}`;
  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
      className={`flex-shrink-0 border-b-2 px-1 py-3 font-ui text-sm font-semibold ${tab === t ? "border-crimson text-crimson" : "border-transparent text-slate hover:text-ink"}`}>
      {label}{count !== undefined ? ` · ${count}` : ""}
    </button>
  );

  return (
    <div className="mt-10">
      <div className="-mx-4 border-b border-rule px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-6 overflow-x-auto" role="tablist">
          {tabBtn("notes", "Notes", noteCount)}
          {tabBtn("store", "Store", storeItems.length)}
          {tabBtn("courses", "Courses", 0)}
        </div>
      </div>

      {tab === "notes" && (
        <div className="mt-5">
          {isOfficial ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{NOTESAPP_POSTS.map((post) => <NotesAppPostRow key={post.slug} post={post} />)}</div>
          ) : suspended ? (
            <p className="text-sm italic text-slate">Entries are hidden while this account is temporarily suspended.</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-slate">No public entries yet.</p>
          ) : (
            <>
              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <button onClick={() => setSort("viewed")} className={chip(sort === "viewed" && !topic)}>Most viewed</button>
                <button onClick={() => { setSort("recent"); setTopic(null); }} className={chip(sort === "recent" && !topic)}>Recent</button>
                {topics.map((t) => <button key={t} onClick={() => setTopic(topic === t ? null : t)} className={chip(topic === t)}>{hashtag(t)}</button>)}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{listed.map((n) => <JournalRow key={n.id} note={n} />)}</div>
            </>
          )}
        </div>
      )}

      {tab === "store" && (
        <div className="mt-5">
          {storeItems.length === 0 ? (
            <p className="text-sm text-slate">Nothing in the store yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{storeItems.map((item) => <ItemCard key={item.id ?? item.title} item={item} />)}</div>
              <p className="mt-4"><Link href={`/u/${username}/store`} className="font-ui text-sm font-semibold text-crimson">Open the full store →</Link></p>
            </>
          )}
        </div>
      )}

      {tab === "courses" && (
        <div className="card mt-5 p-6 text-sm text-slate">
          <p className="font-display text-xl text-ink">No courses yet</p>
          <p className="mt-1">Courses are coming with <Link href="/academy" className="font-semibold text-crimson">Notes Academy</Link>: free courses from the teacher&apos;s YouTube, paid courses on #NotesApp, and certificates anyone can check.</p>
        </div>
      )}
    </div>
  );
}
