// The My account menu (components/account/AccountShell.tsx), from the Moda "User Dashboard Redesign" (owner, 15 Nov 2026): four groups,
// Profile · Money · Store · Growth, each opening to its pages. The pages that only show when their feature is on (Media, Wallet) drop out
// of their group's count when it's off. Pure, so the menu, the phone bar and the tests agree.
import { WALLET_LIVE } from "./wallet";
import { MEDIA_LIVE } from "./media-rules";
import { activePage, groupPages, type MenuPage } from "./side-menu";

export const ACCOUNT_GROUPS = ["Profile", "Money", "Store", "Growth"] as const;

export function accountPages(flags: { wallet?: boolean; media?: boolean } = {}): MenuPage[] {
  const wallet = flags.wallet ?? WALLET_LIVE, media = flags.media ?? MEDIA_LIVE;
  return [
    { href: "/write", label: "My journal", group: "Profile", exact: true },
    { href: "/profile/edit", label: "Edit profile", group: "Profile" },
    ...(media ? [{ href: "/profile/media", label: "Media", group: "Profile" }] : []),
    { href: "/profile/sounds", label: "Sounds", group: "Profile" },
    ...(wallet ? [{ href: "/profile/wallet", label: "Wallet", group: "Money" }] : []),
    { href: "/profile/publishing", label: "Rates & payouts", group: "Money" },
    { href: "/profile/analytics", label: "Analytics", group: "Money" },
    { href: "/profile/books", label: "Business books", group: "Store" },
    { href: "/profile/inventory", label: "Inventory", group: "Store" },
    { href: "/bookings", label: "Bookings", group: "Store" },
    { href: "/profile/hotel", label: "Your hotel", group: "Store" },
    { href: "/profile/discounts", label: "Discount codes", group: "Growth" },
    { href: "/profile/coupons", label: "My coupons", group: "Growth" },
    { href: "/profile/referrals", label: "Referrals", group: "Growth" },
    { href: "/boost", label: "Boost", group: "Growth", exact: true },
  ];
}
export const accountGroups = (pages: MenuPage[] = accountPages()) => groupPages(pages, ACCOUNT_GROUPS);

// Account pages that aren't in the menu still get their name in the phone bar ("My account / Account settings").
const OTHER: Record<string, string> = {
  "/profile/account": "Account settings", "/profile/site": "Your site", "/profile/family": "Family", "/profile/jobs": "Jobs",
  "/profile/applications": "Applications", "/profile/boosts": "Your boosts",
};
export function whereAmI(pathname: string, pages: MenuPage[] = accountPages()): { group?: string; label?: string; page?: MenuPage } {
  const page = activePage(pages, pathname);
  if (page) return { group: page.group, label: page.label, page };
  const other = Object.keys(OTHER).find((k) => pathname === k || pathname.startsWith(`${k}/`));
  return other ? { label: OTHER[other] } : {};
}
