"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { useInterests } from "@/lib/interests-client";
import { hashtag } from "@/lib/topics";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { AcademyIcon, ExploreIcon, HomeIcon, MarketIcon, MessagesIcon, ProfileIcon, SavedIcon, TrendingIcon } from "./icons";

// The left column of the app frame on a computer (Moda redesign): where to go, Start a journal, and your topics.
export default function AppSidebar() {
  const pathname = usePathname();
  const { profile, user, unreadDms } = useMember();
  const { interests } = useInterests();
  const me = profile ? `/u/${profile.username}` : "/login";
  const items = [
    { href: "/journals", label: "Feed", Icon: HomeIcon },
    { href: "/explore", label: "Explore", Icon: ExploreIcon },
    { href: "/trending", label: "Trending", Icon: TrendingIcon },
    { href: "/shop", label: "Market", Icon: MarketIcon },
    { href: "/academy", label: "Academy", Icon: AcademyIcon },
    ...(MESSAGES_LIVE ? [{ href: "/messages", label: "Messages", Icon: MessagesIcon, badge: unreadDms }] : []),
    { href: "/saved", label: "Saved", Icon: SavedIcon },
    { href: me, label: "Profile", Icon: ProfileIcon },
  ];
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-5 pb-10">
        <nav aria-label="Sections">
          <ul className="space-y-1">
            {items.map(({ href, label, Icon, ...i }) => {
              const on = pathname === href;
              return (
                <li key={label}>
                  <Link href={href} aria-current={on ? "page" : undefined} className={`flex items-center gap-3.5 rounded-full px-5 py-3 font-ui text-[15px] ${on ? "bg-crimson/[0.07] font-bold text-crimson" : "font-medium text-ink hover:bg-card"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{label}</span>
                    {"badge" in i && !!i.badge && <span className="rounded-full bg-crimson px-2 py-0.5 font-mono text-[10px] font-bold text-paper">{i.badge > 9 ? "9+" : i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link href={user ? "/write/new" : "/login?next=/write/new"} className="block rounded-full bg-crimson-bright py-3.5 text-center font-ui text-[15px] font-bold text-paper shadow-sm hover:bg-crimson">Start a journal</Link>
        <div className="rounded-2xl border border-rule bg-card p-4">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Your topics</p>
          {(interests ?? []).length > 0
            ? <p className="mt-3 text-sm leading-relaxed text-ink">{(interests ?? []).map((t, n) => <span key={t}>{n > 0 && " · "}<Link href={`/journals?topic=${t}`} className="hover:text-crimson">{hashtag(t)}</Link></span>)}</p>
            : <p className="mt-3 text-sm text-slate">Pick the topics you like and journals on them come first.</p>}
          <Link href="/interests" className="mt-4 inline-block font-ui text-sm font-semibold text-crimson-bright hover:text-crimson">{(interests ?? []).length ? "Change your interests" : "Choose your interests"}</Link>
        </div>
      </div>
    </aside>
  );
}
