import type { MenuLink } from "./menu-groups";

// The account menus, grouped behind a drop-down each (owner, 15 Nov 2026: the menus were long flat lists on a phone). One list for
// the desktop menu (components/AuthNav.tsx) and the phone sheet (components/shell/AccountSheet.tsx), so the two never drift apart.
// The everyday links stay outside any group; the rest sit in Profile & content, Money, and Orders & bookings. Switches (Messages,
// Wallet, My Cycle, the calendar, Go live) are passed in, so this file stays free of settings and runs in the plain tests.

export const ACCOUNT_GROUPS = ["Profile & content", "Money", "Orders & bookings"] as const;

export type AccountMenuInput = {
  username?: string; canPublish: boolean; organisation: boolean;
  messages: boolean; wallet: boolean; cycle: boolean; calendar: boolean; goLive: boolean;
};

export function accountMenu(o: AccountMenuInput): MenuLink[] {
  const P = "Profile & content", M = "Money", O = "Orders & bookings";
  const out: (MenuLink | false)[] = [
    !!o.username && { href: `/u/${o.username}`, label: "My profile", exact: true },
    o.calendar && { href: "/calendar", label: "📅 My Calendar" },
    o.goLive && { href: "/lives/start", label: "🔴 Go live" },
    o.canPublish && { href: "/write", label: "My journal (write)" },
    o.messages && { href: "/messages", label: "💬 Messages" },
    o.cycle && { href: "/cycle", label: "🌸 My Cycle" },
    { href: "/profile/edit", label: "Edit profile", group: P },
    { href: "/profile/account", label: "Account (email, username)", group: P },
    !!o.username && { href: `/u/${o.username}/store`, label: "My store", group: P },
    { href: "/invites", label: "Co-author invites", group: P },
    { href: "/saved", label: "♥ Saved items", group: P },
    { href: "/interests", label: "Your interests", group: P },
    { href: "/badges", label: "Verification badges", group: P },
    { href: "/profile/family", label: "👨‍👩‍👧 Family (child profiles)", group: P },
    o.organisation && { href: "/organisation", label: "Organisation setup", group: P },
    { href: "/profile/publishing", label: o.canPublish ? "Rates & payouts" : "Start publishing", group: M },
    o.wallet && { href: "/profile/wallet", label: "💳 Wallet", group: M },
    { href: "/giving", label: "My giving", group: M },
    { href: "/boost", label: "Boost a post", exact: true, group: M },
    { href: "/profile/boosts", label: "Boost performance", group: M },
    { href: "/advertise/campaigns", label: "My ad campaigns", group: M },
    { href: "/bookings", label: "Bookings", group: O },
    { href: "/orders", label: "Orders & parcels", group: O },
    { href: "/tickets", label: "🎟 My tickets", group: O },
    o.canPublish && { href: "/shipments", label: "Shipments (logistics)", group: O },
  ];
  return out.filter((l): l is MenuLink => !!l);
}

// The "My account" bar on /profile pages and /bookings (components/AccountSubNav.tsx). Media was listed twice there before
// (once behind its switch, once always, both /profile/media): it's one link now.
export function accountSubNav(o: { media: boolean; wallet: boolean }): MenuLink[] {
  const P = "Profile & content", M = "Money", B = "Business", I = "Insights";
  const out: (MenuLink | false)[] = [
    { href: "/write", label: "My journal", group: P },
    { href: "/profile/edit", label: "Edit profile", group: P },
    o.media && { href: "/profile/media", label: "Media", group: P },
    { href: "/profile/sounds", label: "Sounds", group: P },
    { href: "/profile/publishing", label: "Rates & payouts", group: M },
    o.wallet && { href: "/profile/wallet", label: "Wallet", group: M },
    { href: "/profile/discounts", label: "Discount codes", group: M },
    { href: "/profile/coupons", label: "My coupons", group: M },
    { href: "/profile/referrals", label: "Referrals", group: M },
    { href: "/boost", label: "Boost", exact: true, group: M },
    { href: "/bookings", label: "Bookings", group: B },
    { href: "/profile/books", label: "Business books", group: B },
    { href: "/profile/inventory", label: "Inventory", group: B },
    { href: "/profile/hotel", label: "Your hotel", group: B },
    { href: "/profile/analytics", label: "Analytics", group: I },
  ];
  return out.filter((l): l is MenuLink => !!l);
}
