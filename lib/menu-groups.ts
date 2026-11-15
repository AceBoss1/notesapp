// Collapsible menu groups (owner, 15 Nov 2026: the admin and account menus "with drop down for each"), the pure rules.
// Every group starts closed except the one holding the page you're on; what you open or close is remembered in this browser
// (lib/use-open-groups.ts). Used by components/SectionNav.tsx (Admin, My account), components/AuthNav.tsx and the phone AccountSheet.

export type MenuLink = { href: string; label: string; exact?: boolean; group?: string };
export type Saved = Record<string, boolean>;

// Is this link the page we're on? Exact links match only themselves; others also match their sub-pages.
export const linkMatches = (l: Pick<MenuLink, "href" | "exact">, pathname: string) =>
  l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/");

// Only the most specific match is the current page (Money ledger, not also Team hub).
export function currentLink<T extends Pick<MenuLink, "href" | "exact">>(links: T[], pathname: string): T | undefined {
  return links.filter((l) => linkMatches(l, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
}

// Links in their groups, in first-seen order; links without a group come first, outside any group. A group is never split in two,
// even if its links aren't listed together.
export function groupLinks<T extends MenuLink>(links: T[]): { loose: T[]; groups: { name: string; links: T[] }[] } {
  const loose: T[] = [];
  const groups: { name: string; links: T[] }[] = [];
  for (const l of links) {
    if (!l.group) { loose.push(l); continue; }
    const g = groups.find((x) => x.name === l.group);
    if (g) g.links.push(l); else groups.push({ name: l.group, links: [l] });
  }
  return { loose, groups };
}

// The current page's group opens when you arrive on it; every other group keeps what you chose (closed if you never opened it).
export const openState = (saved: Saved, current: string | undefined): Saved => (current ? { ...saved, [current]: true } : { ...saved });

// What's kept in localStorage: only true/false per group name; anything else is ignored.
export function parseSaved(raw: string | null): Saved {
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([, b]) => typeof b === "boolean")) as Saved;
  } catch { return {}; }
}
