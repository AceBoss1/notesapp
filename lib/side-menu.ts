// The grouped side menus (components/shell/SideShell.tsx): Admin (lib/admin-access.ts) and My account (lib/account-nav.ts), from the Moda
// redesigns of November 2026. Pure, so the menus, the phone bar and the tests agree.
export type MenuPage = { href: string; label: string; group: string; exact?: boolean };
export type MenuGroup<T extends MenuPage = MenuPage> = { name: string; pages: T[] };

// The open page: the most specific one the path falls under (Money ledger, not also Team hub).
export function activePage<T extends MenuPage>(pages: T[], pathname: string): T | undefined {
  return pages
    .filter((s) => (s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
// The groups in the given order, each with its pages in list order; empty groups left out.
export const groupPages = <T extends MenuPage>(pages: T[], order: readonly string[]): MenuGroup<T>[] =>
  order.map((name) => ({ name, pages: pages.filter((s) => s.group === name) })).filter((g) => g.pages.length > 0);
// "Jump to a page": every page whose name (or group) has all the words typed.
export function jumpTo<T extends MenuPage>(pages: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return pages.filter((s) => words.every((w) => `${s.label} ${s.group}`.toLowerCase().includes(w)));
}
