"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { getAllNotes, NoteWithComputed } from "@/lib/firestore-notes";
import { getAllUsers, UserProfile } from "@/lib/users";
import { FOUNDER_JOURNALS, CHANNEL_JOURNALS, MANDATORY_USERNAMES } from "@/lib/journals-directory";
import { followJournal, getFollowedUsernames } from "@/lib/follows";
import MomentsStrip from "@/components/moments/MomentsStrip";
import Avatar from "@/components/Avatar";
import { BadgePitchCard } from "@/components/BadgeToast";
import { beacon, useBoostImpression, type Boost } from "@/components/BoostedStrip";
import FeedPost from "@/components/feed/FeedPost";
import { feedAuthorOf, type FeedAuthor } from "@/lib/feed-author";
import { MostRead, WhoToFollow, type FollowRow } from "@/components/feed/FeedModules";
import { PenIcon } from "@/components/shell/icons";
import { useBottomTabs } from "@/components/shell/BottomTabs";
import { useMember } from "@/lib/member-client";
import { hashtag, isTopic, topicLabel, topicsOf } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";
import { useWeeklyViews } from "@/lib/weekly-views-client";
import { useSavedJournals } from "@/lib/saved-journals-client";
import { byForYou, byMostViewed, byRecent, type Shelfable } from "@/lib/discovery";

// Journals (/journals): the feed (Moda redesign, October 2026). Tabs For you (your interests first, then everything newest
// first), Following, Latest and Top · 7d (lib/discovery.ts). Between posts on a phone: Most read this week, Who to follow and
// the badge suggestion; on a computer those sit in the right column. Boosted journals appear in the feed marked Promoted, and
// the journals ad slot after the fifth post. Topics, People and Channels moved to /explore.
type Tab = "foryou" | "following" | "latest" | "top";
const TABS: { id: Tab; label: string }[] = [
  { id: "foryou", label: "For you" }, { id: "following", label: "Following" }, { id: "latest", label: "Latest" }, { id: "top", label: "Top · 7d" },
];
// Links from before the feed: ?tab=viewed and ?tab=recent, and the tabs that moved to Explore.
const OLD_TABS: Record<string, Tab> = { viewed: "top", recent: "latest" };
const MOVED = new Set(["topics", "people", "channels"]);
const PAGE = 15;
const GAP = "border-b-[10px] border-[#F3ECE7] lg:border-b lg:border-rule";
type Shelved = NoteWithComputed & Shelfable;
const uniq = <T extends { id: string }>(list: T[]) => { const seen = new Set<string>(); return list.filter((x) => !seen.has(x.id) && !!seen.add(x.id)); };

function Promoted({ boost, children }: { boost: Boost; children: React.ReactNode }) {
  const ref = useBoostImpression<HTMLDivElement>(boost.id);
  return <div ref={ref} onClickCapture={() => beacon(boost.id, "click")}>{children}</div>;
}

export default function JournalsPageClient() {
  const router = useRouter();
  const { user, profile } = useMember();
  const [notes, setNotes] = useState<NoteWithComputed[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("foryou");
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [draft, setDraft] = useState("");
  const { interests } = useInterests();
  const weekly = useWeeklyViews("note");
  const { saved, toggle: toggleSave } = useSavedJournals(user);
  const tabsBar = useBottomTabs();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t0 = sp.get("tab") ?? "", topic0 = sp.get("topic"), q0 = sp.get("q");
    if (MOVED.has(t0)) { router.replace(`/explore?tab=${t0}`); return; }
    if (TABS.some((t) => t.id === t0)) setTab(t0 as Tab);
    else if (OLD_TABS[t0]) setTab(OLD_TABS[t0]);
    if (topic0 && isTopic(topic0)) setTopic(topic0);
    if (q0) setQuery(q0.slice(0, 80));
    getAllNotes({ publishedOnly: true }).then(setNotes).catch((e) => setError(e.message));
    getAllUsers().then(setUsers).catch(() => setUsers([]));
    fetch("/api/boosts/active?kind=post&limit=2").then((r) => r.json()).then((d) => setBoosts(d.boosts || [])).catch(() => {});
  }, [router]);
  useEffect(() => {
    if (!user) { setFollowing(new Set()); return; }
    // The founders and @na-notesapp are followed for every member without a follow record (lib/journals-directory.ts).
    setFollowing(new Set(MANDATORY_USERNAMES));
    getFollowedUsernames(user.uid).then((l) => setFollowing(new Set([...MANDATORY_USERNAMES, ...l]))).catch(() => {});
  }, [user]);
  useEffect(() => setShown(PAGE), [tab, topic]);

  const shelved = useMemo<Shelved[]>(() => {
    const q = query.trim().toLowerCase();
    return (notes ?? [])
      .filter((n) => !topic || topicsOf(n).includes(topic))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q) || topicsOf(n).some((t) => topicLabel(t).toLowerCase().includes(q)) || n.tags.some((t) => t.toLowerCase().includes(q)))
      .map((n) => ({ ...n, topics: topicsOf(n), publishedAt: n.date, views: n.viewCount || 0, viewsWeek: Object.keys(weekly).length ? weekly[n.id] ?? 0 : undefined, ownerUsername: n.authorUsername }));
  }, [notes, topic, query, weekly]);
  const reader = useMemo(() => ({ interests: interests ?? [], follows: following, self: profile?.username }), [interests, following, profile]);

  const feed = useMemo(() => {
    if (tab === "following") return byRecent(shelved.filter((n) => n.authorUsername && following.has(n.authorUsername)));
    if (tab === "latest") return byRecent(shelved);
    if (tab === "top") return byMostViewed(shelved).filter((n) => (n.viewsWeek ?? n.views) > 0);
    return uniq([...byForYou(shelved, reader), ...byRecent(shelved)]);
  }, [tab, shelved, following, reader]);
  const mostRead = useMemo(() => byMostViewed(shelved).filter((n) => (n.viewsWeek ?? n.views) > 0).slice(0, 4)
    .map((n) => ({ href: `/journals/${n.slug}`, title: n.title, author: n.author, views: n.viewsWeek ?? n.views })), [shelved]);
  // Who to follow: the official channels, the founders, then everyone else; people you don't follow yet first.
  const toFollow = useMemo<FollowRow[]>(() => {
    const pool: FollowRow[] = [
      ...CHANNEL_JOURNALS.map((c) => ({ username: c.username, displayName: c.displayName, avatar: c.avatar, about: c.bio?.slice(0, 40), isOrg: true })),
      ...FOUNDER_JOURNALS.map((p) => ({ username: p.username, displayName: p.displayName, avatar: p.avatar, about: p.bio?.slice(0, 40) })),
      ...users.filter((u) => u.suspended !== true).map((u) => ({ username: u.username, displayName: u.displayName, avatar: u.avatar, about: u.bio?.slice(0, 40), isOrg: u.accountKind === "organisation" })),
    ];
    const seen = new Set<string>();
    const all = pool.filter((p) => p.username && p.username !== profile?.username && !seen.has(p.username) && !!seen.add(p.username));
    return [...all.filter((p) => !following.has(p.username)), ...all.filter((p) => following.has(p.username))].slice(0, 3);
  }, [users, following, profile]);

  function follow(username: string) {
    if (!user) return router.push("/login?next=/journals");
    setFollowing((s) => new Set(s).add(username));
    followJournal(user.uid, username).catch(() => setFollowing((s) => { const n = new Set(s); n.delete(username); return n; }));
  }
  function startWriting(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) return router.push("/login?next=/write/new");
    // The journal editor offers to pick this up: it is the editor's own autosave key for a new journal.
    if (draft.trim()) try { localStorage.setItem("notesapp:draft:new", draft.trim()); } catch {}
    router.push("/write/new");
  }
  const authorOf = (n: NoteWithComputed): FeedAuthor => feedAuthorOf(n, users);
  const followControl = (username: string | undefined) => {
    if (!user || !username || username === profile?.username) return undefined;
    return following.has(username)
      ? <span className="px-3 font-ui text-sm font-semibold text-ink">Following</span>
      : <button type="button" onClick={() => follow(username)} className="rounded-full bg-ink px-5 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-deep">Follow</button>;
  };
  const post = (n: NoteWithComputed, label?: string) => (
    <FeedPost note={n} author={authorOf(n)} user={user} views={n.viewCount || 0} saved={saved.has(n.id)} onSave={toggleSave} follow={followControl(authorOf(n).username)} label={label} />
  );
  const promoted = boosts
    .map((b) => ({ b, n: notes?.find((x) => b.href.endsWith(`/journals/${x.slug}`)) }))
    .filter((p): p is { b: Boost; n: NoteWithComputed } => !!p.n);
  const page = feed.slice(0, shown);

  const tabsRow = (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-rule bg-card px-2 lg:px-4">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
          className={`relative shrink-0 px-3 py-4 font-ui text-[17px] lg:px-5 lg:text-base ${tab === t.id ? "font-bold text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-crimson-bright lg:after:inset-x-5" : "text-slate hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
  const composer = (
    <form onSubmit={startWriting} className={`flex items-center gap-3 bg-card px-4 py-4 lg:px-6 ${GAP}`}>
      {profile ? <Avatar src={profile.avatar} alt="" size={44} square={profile.accountKind === "organisation"} /> : <span className="h-11 w-11 shrink-0 rounded-full bg-rule" />}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={() => { if (user === null) router.push("/login?next=/write/new"); }}
        placeholder="Share a thought or start a journal…" aria-label="Share a thought or start a journal"
        className="min-w-0 flex-1 bg-transparent font-body text-base text-ink outline-none placeholder:text-slate" />
      <button type="submit" className="shrink-0 rounded-full bg-crimson-bright px-6 py-2.5 font-ui text-sm font-bold text-paper hover:bg-crimson"><span className="lg:hidden">Write</span><span className="hidden lg:inline">Post</span></button>
    </form>
  );
  const filterBar = (topic || query) && (
    <div className="flex items-center justify-between gap-3 border-b border-rule bg-card px-4 py-3 lg:px-6">
      <p className="text-sm text-ink">{topic ? <>Journals on <strong>{hashtag(topic)}</strong></> : <>Journals matching <strong>“{query}”</strong></>}</p>
      <Link href="/journals" onClick={() => { setTopic(null); setQuery(""); }} className="font-ui text-sm font-semibold text-crimson">Clear</Link>
    </div>
  );
  const empty = tab === "following"
    ? <p className="bg-card px-6 py-12 text-center text-sm text-slate">Nobody you follow has posted yet. <Link href="/explore?tab=people" className="text-crimson underline">Find people to follow</Link>.</p>
    : <p className="bg-card px-6 py-12 text-center text-sm text-slate">No journals here yet. <Link href="/write/new" className="text-crimson underline">Write the first one</Link>.</p>;
  const between = (i: number) => (
    <>
      {i === 1 && <div className="lg:hidden"><MostRead rows={mostRead} /></div>}
      {i === 2 && promoted[0] && <Promoted boost={promoted[0].b}>{post(promoted[0].n, "Promoted")}</Promoted>}
      {i === 2 && <div className="lg:hidden"><WhoToFollow rows={toFollow} following={following} onFollow={follow} /></div>}
      {i === 3 && <div className="border-b-[10px] border-[#F3ECE7] bg-card px-4 py-5 empty:hidden lg:hidden"><BadgePitchCard /></div>}
      {i === 4 && <div className={`bg-card px-4 empty:hidden lg:px-6 ${GAP}`}><AdSlot placement="journals" /></div>}
      {i === 7 && promoted[1] && <Promoted boost={promoted[1].b}>{post(promoted[1].n, "Promoted")}</Promoted>}
    </>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr),20rem] lg:gap-6 lg:pb-12">
      <div className="min-w-0">
        <div className="sticky top-[65px] z-30 lg:hidden">{tabsRow}</div>
        <div className="lg:mb-5"><MomentsStrip look="feed" /></div>
        <div className="overflow-hidden lg:rounded-2xl lg:border lg:border-rule lg:bg-card">
          <div className="hidden lg:block">{tabsRow}</div>
          {composer}
          {filterBar}
          {error ? (
            <p className="bg-card px-6 py-12 text-center text-sm text-slate">Couldn&apos;t load journals right now. Try again in a minute. ({error})</p>
          ) : notes === null ? (
            <p className="bg-card px-6 py-16 text-center text-sm text-slate">Loading journals…</p>
          ) : page.length === 0 ? empty : (
            <>
              {page.map((n, i) => <Fragment key={n.id}>{post(n)}{between(i)}</Fragment>)}
              <p className="bg-card px-6 py-8 text-center text-[15px] text-slate">
                {shown < feed.length
                  ? <button type="button" onClick={() => setShown((s) => s + PAGE)} className="font-ui font-semibold text-crimson-bright hover:text-crimson">Load more</button>
                  : <>You&apos;re all caught up · <button type="button" onClick={() => setTab(tab === "latest" ? "top" : "latest")} className="text-crimson-bright hover:text-crimson">{tab === "latest" ? "See the most read" : "See the latest"}</button></>}
              </p>
            </>
          )}
        </div>
      </div>

      {/* The right column on a computer */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-5">
          <MostRead rows={mostRead} card />
          <WhoToFollow rows={toFollow} following={following} onFollow={follow} card />
          <BadgePitchCard />
          <p className="px-1 text-xs leading-relaxed text-slate">
            {[["About", "/about"], ["Pricing", "/pricing"], ["Help", "/help"], ["Brand", "/brand"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([l, h], i) => <Fragment key={h}>{i > 0 && " · "}<Link href={h} className="hover:text-crimson">{l}</Link></Fragment>)} · © {new Date().getFullYear()} #NotesApp
          </p>
        </div>
      </aside>

      {/* Write, on a phone */}
      {user && (
        <Link href="/write/new" aria-label="Start a journal" className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-crimson-bright text-paper shadow-[0_8px_24px_rgba(166,9,61,0.45)] lg:hidden ${tabsBar ? "bottom-[5.25rem]" : "bottom-5"}`}>
          <PenIcon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
