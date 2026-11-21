"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import LinkedText from "@/components/LinkedText";
import { FollowListDialog, type FollowKind } from "@/components/FollowLists";
import { bioIsLong, compactCount } from "@/lib/profile-view";

// The top of a profile (/u/<username>), after the owner's Facebook-on-a-phone example (21 Nov 2026), in #NotesApp's own look: the
// pattern band across the top, the picture overlapping its bottom-left, the name in large type with its badges, ONE stats line
// ("7.1K followers · Following · 18 posts"), the bio cut to two lines with See more, the key facts as icon rows on one wrapped line,
// then whatever else the page adds (`children`: Notes Life, partners, a live now, notices) and the buttons (`actions`, then `more`).
// Followers and Following open the lists (components/FollowLists.tsx, which asks visitors to sign in and honours each member's
// privacy switch); Posts jumps to the Posts tab. How many an account follows is shown only on your own profile: it isn't public.
export type Fact = { key: string; icon: ReactNode; text: string; href?: string; external?: boolean };

export default function ProfileHeader({
  avatar, name, eyebrow, bio, facts, stats, children, actions, more, listsOwner = false, square = false,
}: {
  avatar: ReactNode;
  name: ReactNode;
  eyebrow: ReactNode;
  bio: string;
  facts: Fact[];
  stats: { username: string; followers: number | null | "off"; following?: number | null; posts: number | null; lists: boolean; onPosts?: () => void };
  children?: ReactNode;
  actions?: ReactNode;
  more?: ReactNode;
  listsOwner?: boolean;
  square?: boolean;
}) {
  const [open, setOpen] = useState<FollowKind | null>(null);
  const statBtn = "rounded font-ui text-ink hover:underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
  const parts: ReactNode[] = [];
  if (stats.followers !== "off") {
    const n = stats.followers;
    const label = <><b className="font-semibold">{n === null ? "…" : compactCount(n)}</b> {n === 1 ? "follower" : "followers"}</>;
    parts.push(stats.lists ? <button key="f" type="button" onClick={() => setOpen("followers")} className={statBtn}>{label}</button> : <span key="f">{label}</span>);
  }
  if (stats.lists) {
    parts.push(
      <button key="g" type="button" onClick={() => setOpen("following")} className={statBtn}>
        {typeof stats.following === "number" ? <><b className="font-semibold">{compactCount(stats.following)}</b> following</> : "Following"}
      </button>
    );
  }
  if (stats.posts !== null && stats.posts > 0) {
    const label = <><b className="font-semibold">{compactCount(stats.posts)}</b> {stats.posts === 1 ? "post" : "posts"}</>;
    parts.push(stats.onPosts ? <button key="p" type="button" onClick={stats.onPosts} className={statBtn}>{label}</button> : <span key="p">{label}</span>);
  }

  return (
    <div>
      {/* The band across the top: the #NotesApp African pattern (ivory by Day, maroon by Night). */}
      <div className="na-pattern na-pattern-cover h-36 border-b border-rule sm:h-52" aria-hidden="true" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-end sm:gap-6">
          <div className={`relative -mt-16 inline-block bg-paper p-1 sm:-mt-20 ${square ? "rounded-[1.4rem]" : "rounded-full"}`}>{avatar}</div>
          <div className="mt-2 min-w-0 sm:mb-2 sm:mt-0 sm:flex-1">
            <h1 className="break-words font-display text-[2rem] font-semibold leading-[1.1] text-ink sm:text-[2.5rem]">{name}</h1>
            <div className="mt-1">{eyebrow}</div>
            {parts.length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[15px] text-slate">
                {parts.map((p, i) => <span key={i} className="inline-flex items-center gap-1.5">{i > 0 && <span aria-hidden="true">·</span>}{p}</span>)}
              </p>
            )}
          </div>
        </div>

        {bio.trim() && <Bio text={bio} />}

        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] text-ink" aria-label="About">
            {facts.map((f) => (
              <li key={f.key} className="flex min-w-0 max-w-full items-center gap-1.5">
                <span className="shrink-0 text-slate">{f.icon}</span>
                {f.href ? (
                  <a href={f.href} {...(f.external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})} className="truncate font-semibold text-crimson hover:underline underline-offset-2">{f.text}</a>
                ) : <span className="truncate">{f.text}</span>}
              </li>
            ))}
          </ul>
        )}

        {children}

        {actions && <div className="profile-main mt-4 flex gap-2 sm:max-w-xl">{actions}</div>}
        {more && <div className="profile-more mt-2 flex flex-wrap items-start gap-2 empty:hidden">{more}</div>}
      </div>
      {open && <FollowListDialog username={stats.username} start={open} owner={listsOwner} onClose={() => setOpen(null)} />}
    </div>
  );
}

// useLayoutEffect warns during server rendering; this page renders in the browser, but keep the fallback.
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// The bio, two lines at most until See more (measured once it's on screen; a long-looking bio counts before that).
function Bio({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(() => bioIsLong(text));
  useIsoLayout(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, expanded]);
  return (
    <div className="mt-3 max-w-2xl">
      <p ref={ref} className={`whitespace-pre-line break-words text-[15px] leading-relaxed text-ink ${expanded ? "" : "line-clamp-2"}`}><LinkedText text={text} /></p>
      {long && (
        <button type="button" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded} className="mt-0.5 font-ui text-sm font-semibold text-slate hover:text-ink">
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
