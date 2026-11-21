// The account menu (owner, 21 Nov 2026: "see how clean and easily accessible Facebook is… borrow ideas"). One list for the phone menu
// (components/shell/AccountSheet.tsx) and the computer's menu (components/AuthNav.tsx), so the two never drift apart again. Pure.
//   1. Your profile, with ▾ to switch to a community you run, your store or your organisation (components/shell/AccountMenu.tsx)
//   2. Your shortcuts: what you opened from this menu lately (kept in this browser)
//   3. Eight tiles, the places people use most, then "See more" for the rest
//   4. Sections that fold: Settings and privacy, Upgrades, Help and support, More from #NotesApp
//   5. Sign out
// Icons are keys into components/shell/menuIcons.tsx: one line-icon set, no emoji.

export type IconKey =
  | "journal" | "messages" | "calendar" | "store" | "wallet" | "saved" | "bookings" | "orders" | "live" | "tickets" | "giving" | "shipments"
  | "invites" | "cycle" | "interests" | "family" | "profile" | "account" | "payouts" | "org" | "plans" | "badge" | "boost" | "stats"
  | "ads" | "nana" | "help" | "contact" | "terms" | "privacy" | "arcade" | "life" | "academy" | "ventures" | "market" | "explore"
  | "trending" | "exam" | "community" | "link" | "jobs" | "studio";

export type MenuItem = { href: string; label: string; icon: IconKey; badge?: number; note?: string };
export type MenuSection = { key: "settings" | "upgrades" | "help" | "apps"; label: string; icon: "settings" | "upgrades" | "help" | "apps"; items: MenuItem[] };
export type MenuCtx = {
  username: string | null; // null: not signed in
  canPublish: boolean;
  isOrg: boolean;
  goLive: boolean; // Go live is on for this account
  cycle: boolean; // My Cycle is for this account
  calToday: number; // today's calendar count; -1: no calendar (a child profile)
  wallet: boolean;
  messages: boolean;
  unreadDms: number;
};
export type AccountMenu = { tiles: MenuItem[]; more: MenuItem[]; sections: MenuSection[] };

export const TILE_COUNT = 8;

export function accountMenu(c: MenuCtx): AccountMenu {
  if (!c.username) {
    return { tiles: [], more: [], sections: [help(), apps()] };
  }
  const u = c.username;
  // The places people use most, in order; the first eight are tiles, the rest go under "See more".
  const places: MenuItem[] = [
    c.canPublish ? { href: "/write", label: "My journal", icon: "journal" } : { href: "/profile/publishing", label: "Start publishing", icon: "journal" },
    ...(c.messages ? [{ href: "/messages", label: "Messages", icon: "messages" as const, ...(c.unreadDms ? { badge: c.unreadDms } : {}) }] : []),
    ...(c.calToday !== -1 ? [{ href: "/calendar", label: "Calendar", icon: "calendar" as const, ...(c.calToday ? { note: `${c.calToday} today` } : {}) }] : []),
    { href: `/u/${u}/store`, label: "My store", icon: "store" },
    ...(c.wallet ? [{ href: "/profile/wallet", label: "Wallet", icon: "wallet" as const }] : []),
    { href: "/saved", label: "Saved", icon: "saved" },
    { href: "/bookings", label: "Bookings", icon: "bookings" },
    { href: "/orders", label: "Orders & parcels", icon: "orders" },
    ...(c.goLive ? [{ href: "/lives/start", label: "Go live", icon: "live" as const }] : []),
    { href: "/tickets", label: "My tickets", icon: "tickets" },
    { href: "/giving", label: "My giving", icon: "giving" },
    ...(c.canPublish ? [{ href: "/shipments", label: "Shipments", icon: "shipments" as const }] : []),
    { href: "/invites", label: "Co-author invites", icon: "invites" },
    ...(c.cycle ? [{ href: "/cycle", label: "My Cycle", icon: "cycle" as const }] : []),
    { href: "/community", label: "Communities", icon: "community" },
  ];
  return {
    tiles: places.slice(0, TILE_COUNT),
    more: places.slice(TILE_COUNT),
    sections: [
      {
        key: "settings", label: "Settings and privacy", icon: "settings", items: [
          { href: "/profile/edit", label: "Edit profile", icon: "profile" },
          { href: "/profile/account", label: "Account: email and username", icon: "account" },
          { href: "/profile/publishing", label: c.canPublish ? "Rates and payouts" : "Start publishing", icon: "payouts" },
          { href: "/profile/family", label: "Family: child profiles", icon: "family" },
          { href: "/interests", label: "Your interests", icon: "interests" },
          ...(c.isOrg ? [{ href: "/organisation", label: "Organisation setup", icon: "org" as const }] : []),
        ],
      },
      {
        key: "upgrades", label: "Upgrades", icon: "upgrades", items: [
          { href: "/pricing", label: "Plans: Pro, Business, Enterprise", icon: "plans" },
          { href: "/badges", label: "Verification badges", icon: "badge" },
          { href: "/boost", label: "Boost a post", icon: "boost" },
          { href: "/profile/boosts", label: "Boost performance", icon: "stats" },
          { href: "/advertise/campaigns", label: "My ad campaigns", icon: "ads" },
        ],
      },
      help(),
      apps(),
    ],
  };
}

const help = (): MenuSection => ({
  key: "help", label: "Help and support", icon: "help", items: [
    { href: "/nana", label: "Ask Nana", icon: "nana" },
    { href: "/help", label: "Help centre", icon: "help" },
    { href: "/contact", label: "Contact us or report a problem", icon: "contact" },
    { href: "/terms", label: "Terms of Service", icon: "terms" },
    { href: "/privacy", label: "Privacy Policy", icon: "privacy" },
  ],
});

// "Also from Meta" → the rest of the #NotesApp family (owner, 21 Nov 2026: Arcade, Notes Life, Academy, Exam Prep, Ventures, Notes Jobs,
// Nana, Notes Live, Media Live Studio PRO).
const apps = (): MenuSection => ({
  key: "apps", label: "More from #NotesApp", icon: "apps", items: [
    { href: "/arcade", label: "Notes Arcade", icon: "arcade" },
    { href: "/life", label: "Notes Life", icon: "life" },
    { href: "/academy", label: "Academy", icon: "academy" },
    { href: "/exam-prep", label: "Exam Prep", icon: "exam" },
    { href: "/ventures", label: "NotesApp Ventures", icon: "ventures" },
    { href: "/jobs", label: "Notes Jobs", icon: "jobs" },
    { href: "/nana", label: "Nana", icon: "nana" },
    { href: "/lives", label: "Notes Live", icon: "live" },
    { href: "/studio", label: "Media Live Studio PRO", icon: "studio" },
  ],
});

// Shortcuts: menu places opened lately, newest first, kept in this browser only (a per-viewer convenience).
export const RECENT_KEY = "notesapp-menu-recent";
export const RECENT_MAX = 6;
export function pushRecent(list: string[], href: string): string[] {
  return [href, ...list.filter((h) => h !== href)].slice(0, RECENT_MAX);
}
// The shortcuts to show: recent hrefs that are still in the menu, as their menu items (the tiles excluded, they're already on screen).
export function shortcutsFrom(recent: string[], menu: AccountMenu): MenuItem[] {
  const all = new Map([...menu.more, ...menu.sections.flatMap((s) => s.items)].map((i) => [i.href, i]));
  const tiles = new Set(menu.tiles.map((t) => t.href));
  return recent.filter((h) => !tiles.has(h)).map((h) => all.get(h)).filter((i): i is MenuItem => !!i).slice(0, RECENT_MAX);
}
