"use client";

import TabsMore from "@/components/TabsMore";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import FeedPost from "@/components/feed/FeedPost";
import { feedAuthorOf, type FeedAuthor } from "@/lib/feed-author";
import { useMember } from "@/lib/member-client";
import { useSavedJournals } from "@/lib/saved-journals-client";
import NotesAppPostRow from "@/components/NotesAppPostRow";
import ItemCard from "@/components/StoreItemCard";
import { NOTESAPP_POSTS } from "@/lib/notesapp-posts";
import type { NoteWithComputed } from "@/lib/firestore-notes";
import type { StoreItem } from "@/lib/store";
import { hashtag, topicsOf } from "@/lib/topics";
import { byMostViewed, byRecent } from "@/lib/discovery";
import { useWeeklyViews } from "@/lib/weekly-views-client";
import CourseCard, { courseCardOf } from "@/components/CourseCard";
import { ACADEMY_LIVE, courseHref } from "@/lib/courses";
import { useAcademy } from "@/lib/courses-client";
import CreatorMedia from "@/components/media/CreatorMedia";
import { useCreatorMedia } from "@/lib/media-client";
import { MEDIA_LIVE } from "@/lib/media-rules";
import ReceivedGifts from "@/components/gifts/ReceivedGifts";
import { EventCard, type Ev } from "@/components/events/Events";
import { capi } from "@/components/community/api";

// A profile's tabs (/u/<username>), as pills after the owner's Facebook example (21 Nov 2026): All · Posts · Media · Gifts · Store ·
// Courses · Events. A tab with nothing in it is left out (Gifts stays: it also holds the member's withdrawals and the week's top
// gifters); on a phone the first four show and the rest go under More (components/TabsMore.tsx, the owner's rule of 12 Nov 2026).
// All is the overview: the About sections (`about`), the booking card (`book`, #book), the latest posts and store items, then
// whatever the page adds (`after`: recommendations, recent activity). ?tab=notes|posts|media|gifts|store|courses|events opens one,
// /u/<username>/media is the Media tab as a page, and #posts / #book switch to Posts / All from anywhere on the page.
// Media (components/media/CreatorMedia.tsx) is the creator's videos and pictures. Posts can be sorted by Most viewed or Recent and
// narrowed to one of the topics they write about, shown as in the journal feed (FeedPost). Courses are the ones they teach on Notes
// Academy (published only), most viewed first. Events are the public events they host (components/events/Events.tsx).
type Tab = "all" | "notes" | "media" | "gifts" | "store" | "courses" | "events";
type Sort = "viewed" | "recent";
const TABS: Tab[] = ["all", "notes", "media", "gifts", "store", "courses", "events"];

export default function ProfileTabs({ username, owner, notes, notesLoaded = true, storeItems, isOfficial, suspended, storeFirst, initialTab, synthetic, isOwn = false, about, book, after }: {
  username: string; owner: FeedAuthor & { displayName: string }; notes: NoteWithComputed[]; notesLoaded?: boolean; storeItems: StoreItem[]; isOfficial: boolean; suspended: boolean; storeFirst: boolean;
  initialTab?: Tab; synthetic?: boolean; isOwn?: boolean; about?: ReactNode; book?: ReactNode; after?: ReactNode;
}) {
  const { user } = useMember();
  const { saved, toggle } = useSavedJournals(user);
  // Their own journals carry their picture as it is now; co-authored ones are drawn under the main author.
  const authorOf = (n: NoteWithComputed): FeedAuthor => (n.authorUsername === username || (!n.authorUsername && n.author === owner.displayName) ? owner : feedAuthorOf(n, []));
  const [tab, setTab] = useState<Tab>(initialTab ?? (storeFirst ? "store" : "all"));
  const top = useRef<HTMLDivElement>(null);
  // Media: the official channels have none, and nothing shows while an account is suspended.
  const mediaOn = MEDIA_LIVE && !synthetic && !isOfficial && !suspended;
  const media = useCreatorMedia(username, mediaOn);
  const giftsOn = !synthetic && !isOfficial && !suspended;
  const [sort, setSort] = useState<Sort>("recent");
  const [topic, setTopic] = useState<string | null>(null);
  const weekly = useWeeklyViews("note");
  const courses = useAcademy(username, ACADEMY_LIVE && !suspended && !isOfficial);
  // The events they host: public and upcoming only (the server leaves out members-only and cancelled ones).
  const [events, setEvents] = useState<Ev[]>([]);
  useEffect(() => {
    if (synthetic || isOfficial || suspended) return;
    let live = true;
    capi<{ events: Ev[] }>(`/api/events?host=${encodeURIComponent(username)}`).then((d) => { if (live) setEvents(d.events ?? []); }).catch(() => {});
    return () => { live = false; };
  }, [username, synthetic, isOfficial, suspended]);
  useEffect(() => { if (storeFirst && !initialTab && !/^#(book|posts)$/.test(window.location.hash)) setTab("store"); }, [storeFirst, initialTab]);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    const want = t === "posts" ? "notes" : t;
    if (want === "all" || want === "store" || want === "courses" || want === "notes" || want === "events" || (want === "media" && mediaOn) || (want === "gifts" && giftsOn)) setTab(want);
  }, [mediaOn, giftsOn]);
  // #book (Book a session, links from journals and live rooms) is on All; #posts (the stats line) opens Posts.
  useEffect(() => {
    const go = () => {
      const h = window.location.hash;
      if (h === "#posts") { setTab("notes"); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }
      else if (h === "#book") { setTab("all"); requestAnimationFrame(() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "center" })); }
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
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
  const pill = (on: boolean) => `shrink-0 rounded-full px-4 py-2 font-ui text-sm font-semibold transition-colors ${on ? "bg-crimson/10 text-crimson" : "text-slate hover:bg-field hover:text-ink"}`;
  // Only tabs with something in them (and always the one that's open, say from ?tab= or /u/<username>/media).
  const has: Record<Tab, boolean> = {
    all: true,
    notes: !suspended && noteCount > 0,
    media: mediaOn && (isOwn || (media.data?.counts.all ?? 0) > 0),
    gifts: giftsOn,
    store: storeItems.length > 0,
    courses: (courses?.length ?? 0) > 0,
    events: events.length > 0,
  };
  const LABEL: Record<Tab, string> = { all: "All", notes: "Posts", media: "Media", gifts: "Gifts", store: "Store", courses: "Courses", events: "Events" };
  const tabs = TABS.filter((t) => has[t] || t === tab).map((t) => ({ id: t, label: LABEL[t] }));
  const recent = useMemo(() => byRecent(notes.map((n) => ({ ...n, topics: topicsOf(n), publishedAt: n.date, views: n.viewCount || 0 }))).slice(0, 3), [notes]);
  const seeAll = (t: Tab, text: string) => (
    <button type="button" onClick={() => { setTab(t); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="font-ui text-sm font-semibold text-crimson hover:underline underline-offset-2">{text}</button>
  );

  return (
    <div className="mt-6">
      <div ref={top} className="scroll-mt-24 border-b border-rule pb-3">
        <TabsMore label="Profile" active={tab} onSelect={(t) => setTab(t as Tab)} mobile={4} tabClass={pill} tabs={tabs} />
      </div>

      {tab === "all" && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          {about && <div className="grid gap-3 lg:sticky lg:top-24">{about}</div>}
          <div className={`min-w-0 ${about ? "" : "lg:col-span-2"}`}>
            {book}
            <section className={book ? "mt-8" : ""} aria-label="Latest posts">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-ui text-[17px] font-bold text-ink">Posts</h2>
                {has.notes && noteCount > (isOfficial ? 4 : 3) && seeAll("notes", `See all ${noteCount}`)}
              </div>
              {isOfficial ? (
                <div className="mt-3 grid grid-cols-1 gap-3">{NOTESAPP_POSTS.slice(0, 4).map((post) => <NotesAppPostRow key={post.slug} post={post} />)}</div>
              ) : suspended ? (
                <p className="mt-3 text-sm italic text-slate">Entries are hidden while this account is temporarily suspended.</p>
              ) : !notesLoaded ? (
                <div className="mt-3 h-32 animate-pulse rounded-2xl bg-rule/40" />
              ) : recent.length === 0 ? (
                <p className="mt-3 text-sm text-slate">No public entries yet.</p>
              ) : (
                <div className="-mx-4 mt-3 overflow-hidden sm:mx-0 sm:rounded-2xl sm:border sm:border-rule sm:bg-card">
                  {recent.map((n) => <FeedPost key={n.id} note={n} author={authorOf(n)} user={user} views={n.viewCount || 0} saved={saved.has(n.id)} onSave={toggle} />)}
                </div>
              )}
            </section>
            {storeItems.length > 0 && !suspended && (
              <section className="mt-8" aria-label="From the store">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-ui text-[17px] font-bold text-ink">Store</h2>
                  {seeAll("store", storeItems.length > 2 ? `See all ${storeItems.length}` : "Open")}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">{storeItems.slice(0, 2).map((item) => <ItemCard key={item.id ?? item.title} item={item} />)}</div>
              </section>
            )}
            {after}
          </div>
        </div>
      )}

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
              <div className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-2xl sm:border sm:border-rule sm:bg-card">
                {listed.map((n) => <FeedPost key={n.id} note={n} author={authorOf(n)} user={user} views={n.viewCount || 0} saved={saved.has(n.id)} onSave={toggle} />)}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "media" && mediaOn && <CreatorMedia data={media.data} isOwn={!!user && media.data?.owner.uid === user.uid} onChanged={media.reload} />}

      {tab === "gifts" && giftsOn && <ReceivedGifts username={username} user={user} />}

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

      {tab === "courses" && (courses?.length ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...courses].sort((a, b) => b.views - a.views || b.publishedAt.localeCompare(a.publishedAt)).map((c) => <CourseCard key={c.id} c={courseCardOf(c)} href={courseHref(c.slug)} />)}
        </div>
      ) : ACADEMY_LIVE ? (
        <div className="card mt-5 p-6 text-sm text-slate">
          <p className="font-display text-xl text-ink">{courses === undefined && !suspended && !isOfficial ? "Loading courses…" : "No courses yet"}</p>
          <p className="mt-1">Free and paid courses on <Link href="/academy" className="font-semibold text-crimson">Notes Academy</Link>: lessons from the teacher&apos;s YouTube, written on #NotesApp, PDFs and videos, with your progress saved as you go.</p>
        </div>
      ) : (
        <div className="card mt-5 p-6 text-sm text-slate">
          <p className="font-display text-xl text-ink">No courses yet</p>
          <p className="mt-1">Courses are coming with <Link href="/academy" className="font-semibold text-crimson">Notes Academy</Link>: free courses from the teacher&apos;s YouTube, paid courses on #NotesApp, and certificates anyone can check.</p>
        </div>
      ))}

      {tab === "events" && (events.length ? <ul className="mt-5 grid gap-3 sm:grid-cols-2">{events.map((e) => <EventCard key={e.id} e={e} />)}</ul> : <p className="card mt-5 p-6 text-sm text-slate">No upcoming events.</p>)}
    </div>
  );
}
