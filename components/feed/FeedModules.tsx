"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { compact } from "./FeedPost";

// The two side pieces of the journal feed (Moda redesign). On a phone they sit between posts; on a computer in the right column.

export type MostReadRow = { href: string; title: string; author: string; views: number };
export function MostRead({ rows, seeAll = "/trending", card = false }: { rows: MostReadRow[]; seeAll?: string; card?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className={card ? "rounded-2xl border border-rule bg-card p-5" : "border-b-[10px] border-field bg-card px-4 py-6"}>
      <div className="flex items-baseline justify-between">
        <h2 className={`font-display text-ink ${card ? "text-[1.4rem]" : "text-[1.75rem]"}`}>Most read this week</h2>
        {!card && <Link href={seeAll} className="font-ui text-[15px] font-semibold text-crimson-bright">See all</Link>}
      </div>
      <ol className={card ? "mt-4 space-y-4" : "mt-5 space-y-6"}>
        {rows.map((r, i) => (
          <li key={r.href} className="flex gap-4">
            <span className="w-6 shrink-0 font-display text-[1.9rem] leading-none text-slate/40">{i + 1}</span>
            <Link href={r.href} className="min-w-0">
              <span className={`block font-ui font-semibold leading-snug text-ink hover:text-crimson ${card ? "text-[15px]" : "text-base"}`}>{r.title}</span>
              <span className="mt-1 block text-sm text-slate">{card ? "" : `${r.author} · `}{compact(r.views)} views</span>
            </Link>
          </li>
        ))}
      </ol>
      {card && <Link href={seeAll} className="mt-5 inline-block font-ui text-sm font-semibold text-crimson-bright">See all trending →</Link>}
    </section>
  );
}

export type FollowRow = { username: string; displayName: string; avatar: string; about?: string; isOrg?: boolean };
export function WhoToFollow({ rows, following, onFollow, card = false }: { rows: FollowRow[]; following: Set<string>; onFollow: (username: string) => void; card?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className={card ? "rounded-2xl border border-rule bg-card p-5" : "border-b-[10px] border-field bg-card px-4 py-6"}>
      <h2 className={`font-display text-ink ${card ? "text-[1.4rem]" : "text-[1.75rem]"}`}>Who to follow</h2>
      <ul className="mt-4 space-y-4">
        {rows.map((p) => (
          <li key={p.username} className="flex items-center gap-3">
            <Link href={`/u/${p.username}`} className="shrink-0"><Avatar src={p.avatar} alt={p.displayName} size={card ? 44 : 48} square={p.isOrg} /></Link>
            <Link href={`/u/${p.username}`} className="min-w-0 flex-1">
              <span className="flex items-center font-ui text-[15px] font-bold text-ink"><span className="truncate">{p.displayName}</span><NameBadgeIcons username={p.username} size={13} /></span>
              <span className="block truncate text-sm text-slate">@{p.username}{p.about && !card ? ` · ${p.about}` : ""}</span>
            </Link>
            {following.has(p.username)
              ? <span className="shrink-0 px-3 font-ui text-sm font-semibold text-ink">Following</span>
              : <button type="button" onClick={() => onFollow(p.username)} className="shrink-0 rounded-full bg-ink px-5 py-2 font-ui text-sm font-bold text-paper hover:bg-crimson-deep">Follow</button>}
          </li>
        ))}
      </ul>
      <Link href="/explore?tab=people" className="mt-5 inline-block font-ui text-sm font-semibold text-crimson-bright">{card ? "Show more" : "Show more people"}</Link>
    </section>
  );
}
