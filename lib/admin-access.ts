// Who may do what in the admin area. Pure functions, shared by the browser (to hide what you can't use) and the server (which is what actually
// decides: the API routes and the Firestore rules both check the same claims).
//
// Custom claims on an account:
//   admin: true                      any staff member
//   adminRole: "super" | "admin"     a super admin sees everything and manages the team; an admin sees only the departments below.
//                                    A bare `admin: true` with no adminRole (every account set up before roles existed) counts as super.
//   depts: ["support", ...]          the departments an admin works in
// The owner (OWNER_EMAIL, the founder) is a super admin who alone appoints and removes other super admins.

export const DEPARTMENTS = [
  { key: "support", label: "Customer care", blurb: "Looks up members, answers contact messages and leads, helps with organisations, stores and orders." },
  { key: "moderation", label: "Trust & safety", blurb: "Reports, suspensions and appeals, and removing content." },
  { key: "finance", label: "Finance", blurb: "Payments, revenue, payouts, ad share, merch and store orders, plans and tiers." },
  { key: "growth", label: "Growth & partnerships", blurb: "Ads and advertisers, enterprise and organisations, the numbers, leads." },
  { key: "content", label: "Editorial", blurb: "Journals and notes." },
  { key: "product", label: "Product & tech", blurb: "Errors, video storage, limits, site settings, API access and domains." },
] as const;
export type Dept = (typeof DEPARTMENTS)[number]["key"];
export const DEPT_KEYS = DEPARTMENTS.map((d) => d.key) as Dept[];
export const DEPT_LABEL = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d.label])) as Record<Dept, string>;
export const isDept = (d: unknown): d is Dept => typeof d === "string" && (DEPT_KEYS as string[]).includes(d);

export type AdminRole = "super" | "admin";
export type Access = { role: AdminRole; depts: Dept[] };

// What the claims on a signed-in account say. null = not staff.
export function accessFromClaims(claims: Record<string, unknown> | null | undefined): Access | null {
  if (!claims || claims.admin !== true) return null;
  if (claims.adminRole === undefined || claims.adminRole === "super") return { role: "super", depts: [] };
  const depts = Array.isArray(claims.depts) ? claims.depts.filter(isDept) : [];
  return { role: "admin", depts: Array.from(new Set(depts)) }; // anything else is the safe reading: an admin with only the departments listed
}

export const isSuper = (a: Access | null | undefined) => a?.role === "super";
// Super admins have every department; an admin has the ones they were given.
export const hasDept = (a: Access | null | undefined, d: Dept) => !!a && (a.role === "super" || a.depts.includes(d));
export const hasAnyDept = (a: Access | null | undefined, ds: readonly Dept[]) => ds.some((d) => hasDept(a, d));

// Every page in the admin area and who can open it: "all" (any staff), "super", or the departments that include it.
export type Need = "all" | "super" | readonly Dept[];
export type Section = { href: string; label: string; need: Need; exact?: boolean };
export const ADMIN_SECTIONS: Section[] = [
  { href: "/admin", label: "Dashboard", need: "all", exact: true },
  { href: "/admin/team", label: "Team hub", need: "all" },
  { href: "/admin/journals", label: "Journals", need: ["content", "moderation"] },
  { href: "/admin/notes", label: "Notes", need: ["content", "moderation"] },
  { href: "/admin/users", label: "Users", need: ["support", "moderation", "finance"] },
  { href: "/admin/organisations", label: "Organisations", need: ["support", "growth"] },
  { href: "/admin/revenue", label: "Revenue", need: ["finance"] },
  { href: "/admin/payments", label: "Payments", need: ["finance"] },
  { href: "/admin/merch", label: "Merch", need: ["finance", "support"] },
  { href: "/admin/ads", label: "Ads", need: ["growth", "finance"] },
  { href: "/admin/ad-share", label: "Ad share", need: ["finance"] },
  { href: "/admin/leads", label: "Leads", need: ["support", "growth"] },
  { href: "/admin/reports", label: "Reports", need: ["moderation"] },
  { href: "/admin/traction", label: "Traction", need: ["growth", "finance"] },
  { href: "/admin/errors", label: "Errors", need: ["product"] },
  { href: "/admin/enterprise", label: "Enterprise", need: ["growth"] },
  { href: "/admin/shops", label: "Shops", need: ["support", "moderation"] },
  { href: "/admin/stream", label: "Video storage", need: ["product"] },
  { href: "/admin/paylony", label: "Paylony", need: ["finance"] },
  { href: "/admin/api-access", label: "API & domains", need: ["product"] },
  { href: "/admin/domains", label: "Domain sales", need: ["product"] },
  { href: "/admin/limits", label: "Limits", need: ["product"] },
  { href: "/admin/settings", label: "Settings", need: ["product"] },
  { href: "/admin/seed", label: "Seed", need: "super" },
  { href: "/admin/access", label: "Team access", need: "super" },
];

export function canOpen(a: Access | null | undefined, need: Need): boolean {
  if (!a) return false;
  if (need === "all") return true;
  if (need === "super") return a.role === "super";
  return hasAnyDept(a, need);
}

export const sectionFor = (pathname: string): Section | undefined =>
  ADMIN_SECTIONS.filter((s) => (s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`))).sort((x, y) => y.href.length - x.href.length)[0];

// The login page is open to everyone; every other admin page needs its section's access. A page we have no section for is for super admins only.
export function pathAllowed(a: Access | null | undefined, pathname: string): boolean {
  if (pathname.startsWith("/admin/login")) return true;
  const s = sectionFor(pathname);
  return canOpen(a, s ? s.need : "super");
}

export const allowedSections = (a: Access | null | undefined) => ADMIN_SECTIONS.filter((s) => canOpen(a, s.need));

export function roleLabel(a: Access | null | undefined, owner = false): string {
  if (!a) return "";
  return owner ? "Owner" : a.role === "super" ? "Super admin" : "Admin";
}
export const deptSummary = (a: Access | null | undefined) => (a?.role === "super" ? "Everything" : (a?.depts ?? []).map((d) => DEPT_LABEL[d]).join(", ") || "No departments");
