"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { showsBottomTabs } from "@/lib/chrome";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { ExploreIcon, HomeIcon, MarketIcon, MessagesIcon, ProfileIcon, TrendingIcon } from "./icons";

// Whether the phone tab bar is on screen, for things that sit above it (Nana's button, the write button).
export function useBottomTabs(): boolean {
  const pathname = usePathname();
  const { user, appHost } = useMember();
  return showsBottomTabs(pathname, { member: !!user, appHost });
}

// The tab bar along the bottom of a phone (Moda redesign): Feed, Explore, Market, Messages, Profile.
export default function BottomTabs() {
  const pathname = usePathname();
  const { profile, user, unreadDms } = useMember();
  const shown = useBottomTabs();
  if (!shown) return null;
  const me = profile ? `/u/${profile.username}` : user === null ? "/login" : "/profile/edit";
  const tabs = [
    { href: "/journals", label: "Feed", Icon: HomeIcon, on: pathname === "/journals" || pathname.startsWith("/journals/") },
    { href: "/explore", label: "Explore", Icon: ExploreIcon, on: pathname === "/explore" },
    { href: "/shop", label: "Market", Icon: MarketIcon, on: pathname === "/shop" },
    MESSAGES_LIVE
      ? { href: "/messages", label: "Messages", Icon: MessagesIcon, on: pathname.startsWith("/messages"), badge: unreadDms }
      : { href: "/trending", label: "Trending", Icon: TrendingIcon, on: pathname === "/trending" },
    { href: me, label: "Profile", Icon: ProfileIcon, on: !!profile && pathname === me },
  ];
  return (
    <>
      <div aria-hidden className="h-[4.5rem] lg:hidden" />
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around">
          {tabs.map(({ href, label, Icon, on, ...t }) => (
            <li key={label} className="flex-1">
              <Link href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 font-ui text-[11px] font-semibold ${on ? "text-crimson" : "text-slate"}`}>
                <Icon className="h-6 w-6" />
                {label}
                {"badge" in t && !!t.badge && <span className="absolute right-[calc(50%-1.25rem)] top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-crimson px-1 font-mono text-[9px] font-bold text-paper">{t.badge > 9 ? "9+" : t.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
