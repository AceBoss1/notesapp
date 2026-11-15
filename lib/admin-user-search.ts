// Finding members on Admin → Users (owner, 15 Nov 2026: "/admin/users should have search to be able to locate users"). Pure, so the page
// and the tests agree. Every account is already loaded on that page; this narrows, counts and orders them.
import type { UserProfile } from "./users";

export type UserFilter = "all" | "action" | "suspended" | "duplicates" | "team" | "organisations" | "campus" | "new";
export const USER_FILTERS: { id: UserFilter; label: string; hint: string }[] = [
  { id: "all", label: "Everyone", hint: "Every account" },
  { id: "action", label: "Needs action", hint: "Waiting on us: badge or Free Basic applications, and appeals" },
  { id: "suspended", label: "Suspended", hint: "Suspended accounts" },
  { id: "duplicates", label: "Possible duplicates", hint: "Same sign-in email, or same name and work, as another account" },
  { id: "team", label: "Team", hint: "Staff, volunteers and admins" },
  { id: "organisations", label: "Organisations", hint: "Organisation accounts" },
  { id: "campus", label: "Campus", hint: "Campus coordinators, Campus Leads and ambassadors" },
  { id: "new", label: "New this week", hint: "Joined in the last 7 days" },
];
export const isUserFilter = (f: unknown): f is UserFilter => USER_FILTERS.some((x) => x.id === f);

export type UserSort = "newest" | "oldest" | "name";
export const USER_SORTS: { id: UserSort; label: string }[] = [{ id: "newest", label: "Newest first" }, { id: "oldest", label: "Oldest first" }, { id: "name", label: "Name A–Z" }];
export const isUserSort = (s: unknown): s is UserSort => USER_SORTS.some((x) => x.id === s);

// What the page knows besides the profile: masked emails, pending badge applications, and who looks like a duplicate.
export type SearchCtx = { emails?: Record<string, string>; badgePending?: Set<string>; duplicates?: Set<string>; now?: number };

type U = Pick<UserProfile, "uid" | "username" | "displayName"> & Partial<Pick<UserProfile, "createdAt" | "suspended" | "role" | "accountTier" | "accountKind" | "jobTitle" | "workplace" | "tierRequest" | "suspension" | "campusBadge">>;

const fold = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Every word typed must be found in the name, @username, uid, work or (masked) email; "@ada" means the username starts with "ada".
export function matchesQuery(u: U, q: string, ctx: SearchCtx = {}): boolean {
  const words = fold(q).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([u.displayName, u.username, `@${u.username}`, u.uid, u.jobTitle, u.workplace, ctx.emails?.[u.uid]].filter(Boolean).join(" "));
  return words.every((w) => (w.startsWith("@") && w.length > 1 ? fold(u.username).startsWith(w.slice(1)) : hay.includes(w)));
}

export function needsAction(u: U, ctx: SearchCtx = {}): boolean {
  return !!ctx.badgePending?.has(u.uid) || u.tierRequest?.status === "pending" || (u.suspended === true && u.suspension?.appealStatus === "pending");
}

export function inFilter(u: U, f: UserFilter, ctx: SearchCtx = {}): boolean {
  switch (f) {
    case "all": return true;
    case "action": return needsAction(u, ctx);
    case "suspended": return u.suspended === true;
    case "duplicates": return !!ctx.duplicates?.has(u.uid);
    case "team": return u.role === "staff" || u.role === "volunteer" || u.role === "admin";
    case "organisations": return u.accountKind === "organisation";
    case "campus": return !!u.campusBadge;
    case "new": return !!u.createdAt && (ctx.now ?? Date.now()) - Date.parse(u.createdAt) < 7 * 86_400_000;
  }
}

export type UserQuery = { q?: string; filter?: UserFilter; tier?: string; sort?: UserSort };

export function filterUsers<T extends U>(users: T[], query: UserQuery, ctx: SearchCtx = {}): T[] {
  const f = query.filter ?? "all";
  const out = users.filter((u) => inFilter(u, f, ctx) && (!query.tier || (u.accountTier ?? "standard") === query.tier) && matchesQuery(u, query.q ?? "", ctx));
  const at = (u: U) => Date.parse(u.createdAt ?? "") || 0;
  const sort = query.sort ?? "newest";
  return out.sort((a, b) => (sort === "name" ? fold(a.displayName).localeCompare(fold(b.displayName)) : sort === "oldest" ? at(a) - at(b) : at(b) - at(a)));
}

// How many accounts each filter has (with the search and tier applied), for the counts on the chips.
export function filterCounts(users: U[], query: Omit<UserQuery, "filter" | "sort">, ctx: SearchCtx = {}): Record<UserFilter, number> {
  const base = users.filter((u) => (!query.tier || (u.accountTier ?? "standard") === query.tier) && matchesQuery(u, query.q ?? "", ctx));
  return Object.fromEntries(USER_FILTERS.map((x) => [x.id, base.filter((u) => inFilter(u, x.id, ctx)).length])) as Record<UserFilter, number>;
}

// Possible duplicates: the same sign-in email (the server's groups), or the same name with the same work and field. A shared name alone
// isn't one ("David" and "David").
export function duplicateMap<T extends U & Partial<Pick<UserProfile, "industry">>>(users: T[], sharedEmail: Record<string, number>, headline: (u: T) => string): Map<string, { other: T; why: "same email as" | "same name and work as" }[]> {
  const norm = (x: string) => x.trim().toLowerCase();
  const byName = new Map<string, T[]>();
  for (const u of users) byName.set(norm(u.displayName), [...(byName.get(norm(u.displayName)) ?? []), u]);
  const byEmail = new Map<number, T[]>();
  for (const u of users) if (sharedEmail[u.uid] !== undefined) byEmail.set(sharedEmail[u.uid], [...(byEmail.get(sharedEmail[u.uid]) ?? []), u]);
  const out = new Map<string, { other: T; why: "same email as" | "same name and work as" }[]>();
  for (const u of users) {
    const hits: { other: T; why: "same email as" | "same name and work as" }[] = [];
    for (const o of byEmail.get(sharedEmail[u.uid]) ?? []) if (o.uid !== u.uid) hits.push({ other: o, why: "same email as" });
    const h = headline(u);
    if (h) for (const o of byName.get(norm(u.displayName)) ?? []) {
      if (o.uid !== u.uid && !hits.some((x) => x.other.uid === o.uid) && norm(headline(o)) === norm(h) && (o.industry ?? "") === (u.industry ?? "")) hits.push({ other: o, why: "same name and work as" });
    }
    if (hits.length) out.set(u.uid, hits);
  }
  return out;
}

export const PAGE_SIZE = 50;
