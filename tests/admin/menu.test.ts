// The admin sidebar's rules (lib/admin-access.ts, used by components/admin/AdminShell.tsx): every admin page is in the menu, the groups
// are in order with the counts the design shows, the open page is the most specific one, and "Jump to a page" finds pages by any words.
// Run: npm run test:menus
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { ADMIN_SECTIONS, GROUP_ORDER, activeSection, allowedSections, groupSections, jumpMatches, pathAllowed } from "../../lib/admin-access";
import { campusPages } from "../../lib/campus";

const superAdmin = { role: "super", depts: [] } as never;
const all = allowedSections(superAdmin);
// Every folder under app/(main)/admin (but the login page) has its menu entry, and every entry is in a known group.
for (const dir of readdirSync("app/(main)/admin")) {
  if (dir === "login" || !statSync(`app/(main)/admin/${dir}`).isDirectory()) continue;
  if (dir === "campus") { assert.ok(campusPages({ lead: true, role: null }).every((p) => p.href.startsWith("/admin/campus"))); continue; } // its own menu (lib/campus.ts)
  assert.ok(ADMIN_SECTIONS.some((s) => s.href === `/admin/${dir}` || s.href.startsWith(`/admin/${dir}/`)), `/admin/${dir} is in the menu`);
}
for (const s of ADMIN_SECTIONS) assert.ok(GROUP_ORDER.includes(s.group), `${s.label}: ${s.group} is a group`);
// Campus pages are open to the gate for everyone (coordinators and ambassadors aren't staff); /api/campus decides.
assert.ok(pathAllowed(null, "/admin/campus") && pathAllowed(null, "/admin/campus/tasks") && !pathAllowed(null, "/admin/campusx"));
for (const p of campusPages({ lead: true, role: null })) assert.equal(p.group, "Campus");

const groups = groupSections(all);
assert.deepEqual(groups.map((g) => g.name), GROUP_ORDER.filter((g) => g !== "Campus"), "Campus pages come from lib/campus.ts");
const count = Object.fromEntries(groups.map((g) => [g.name, g.pages.length]));
assert.deepEqual(count, { Workspace: 9, Content: 6, "People & Trust": 10, Money: 9, Growth: 12, Platform: 7, Admin: 4 }, "the counts in the design, plus Content checks (v0.174.0), Growth (v0.175.0), Promos (v0.196.0) and Arcade tournaments");
assert.deepEqual(groups.find((g) => g.name === "People & Trust")!.pages.map((p) => p.label).slice(0, 3), ["Users", "Throwaway emails", "Organisations"]);

assert.equal(activeSection(all, "/admin")?.label, "Dashboard");
assert.equal(activeSection(all, "/admin/throwaway-emails")?.label, "Throwaway emails");
assert.equal(activeSection(all, "/admin/team/finance")?.label, "Money ledger", "the most specific");
assert.equal(activeSection(all, "/admin/users/abc")?.label, "Users");
assert.equal(activeSection(all, "/admin/growth")?.label, "Growth", "Admin → Growth sits in the Growth group");
assert.equal(activeSection(all, "/admin/nowhere"), undefined);

assert.deepEqual(jumpMatches(all, "  "), []);
assert.deepEqual(jumpMatches(all, "throw").map((s) => s.label), ["Throwaway emails"]);
assert.ok(jumpMatches(all, "money pay").some((s) => s.label === "Payments"), "words from the group count too");

// Staff only see their own pages, and only those groups.
const care = allowedSections({ role: "admin", depts: ["support"] } as never);
assert.ok(care.some((s) => s.label === "Throwaway emails"));
assert.ok(!groupSections(care).some((g) => g.name === "Admin"));

console.log("ADMIN MENU OK");
