// The collapsible menus (lib/menu-groups.ts, lib/account-menu.ts, the admin sections in lib/admin-access.ts). Run: npm run test:menus → "ALL OK".
import assert from "node:assert/strict";
import { currentLink, groupLinks, linkMatches, openState, parseSaved } from "../../lib/menu-groups";
import { ACCOUNT_GROUPS, accountMenu, accountSubNav } from "../../lib/account-menu";
import { GROUP_ORDER, allowedSections } from "../../lib/admin-access";

// Matching: exact links only match themselves; the most specific link wins.
assert.equal(linkMatches({ href: "/admin", exact: true }, "/admin/team"), false);
assert.equal(linkMatches({ href: "/admin/team" }, "/admin/team/hr"), true);
assert.equal(linkMatches({ href: "/admin/team" }, "/admin/teams"), false);
const admin = allowedSections({ role: "super", depts: [] } as never);
assert.equal(currentLink(admin, "/admin/team/hr")?.label, "Nana-HR & hiring");
assert.equal(currentLink(admin, "/admin/team/hr")?.group, "Workspace");
assert.equal(currentLink(admin, "/admin")?.label, "Dashboard");
assert.equal(currentLink(admin, "/nowhere"), undefined);

// Admin: every group once, in the menu's order (Ad share and Pricing sit in Money even though they're listed among other groups).
const ag = groupLinks(admin);
assert.deepEqual(ag.groups.map((g) => g.name), GROUP_ORDER);
assert.equal(ag.loose.length, 0);
assert.ok(ag.groups.find((g) => g.name === "Money")!.links.some((l) => l.label === "Ad share"));
assert.equal(ag.groups.reduce((n, g) => n + g.links.length, 0), admin.length, "no link lost");
// A group listed in two places is still one group.
assert.deepEqual(groupLinks([{ href: "/a", label: "A", group: "X" }, { href: "/b", label: "B", group: "Y" }, { href: "/c", label: "C", group: "X" }, { href: "/d", label: "D" }]).groups.map((g) => [g.name, g.links.length]), [["X", 2], ["Y", 1]]);

// Open state: collapsed by default, the current page's group open, and remembered choices kept for the others.
assert.deepEqual(openState({}, undefined), {});
assert.deepEqual(openState({}, "Workspace"), { Workspace: true });
assert.deepEqual(openState({ Money: true, Content: false }, "Workspace"), { Money: true, Content: false, Workspace: true });
assert.deepEqual(openState({ Workspace: false }, "Workspace"), { Workspace: true }, "arriving on a page opens its group");
// Saved state is only ever true/false per group; broken or odd values are ignored.
assert.deepEqual(parseSaved(null), {});
assert.deepEqual(parseSaved("not json"), {});
assert.deepEqual(parseSaved("[1,2]"), {});
assert.deepEqual(parseSaved('{"Money":true,"Content":"yes","Growth":false}'), { Money: true, Growth: false });

// My account bar: Media once (it was listed twice), grouped Profile & content, Money, Business, Insights.
const sub = accountSubNav({ media: true, wallet: true });
assert.equal(sub.filter((l) => l.href === "/profile/media").length, 1, "Media once");
assert.equal(new Set(sub.map((l) => l.href)).size, sub.length, "no duplicate links");
assert.equal(new Set(sub.map((l) => l.label)).size, sub.length, "no duplicate labels");
assert.deepEqual(groupLinks(sub).groups.map((g) => g.name), ["Profile & content", "Money", "Business", "Insights"]);
assert.deepEqual(groupLinks(sub).groups.map((g) => g.links.map((l) => l.label)), [
  ["My journal", "Edit profile", "Media", "Sounds"],
  ["Rates & payouts", "Wallet", "Discount codes", "My coupons", "Referrals", "Boost"],
  ["Bookings", "Business books", "Inventory", "Your hotel"],
  ["Analytics"],
]);
const subOff = accountSubNav({ media: false, wallet: false });
assert.ok(!subOff.some((l) => l.href === "/profile/media" || l.href === "/profile/wallet"), "switched-off pages are hidden");
assert.equal(currentLink(sub, "/profile/hotel/rooms")?.group, "Business");

// The account menu (desktop and phone): the everyday links outside any group, the rest in three groups; switches respected.
const full = accountMenu({ username: "ada", canPublish: true, organisation: true, messages: true, wallet: true, cycle: true, calendar: true, goLive: true });
const fg = groupLinks(full);
assert.deepEqual(fg.loose.map((l) => l.href), ["/u/ada", "/calendar", "/lives/start", "/write", "/messages", "/cycle"]);
assert.deepEqual(fg.groups.map((g) => g.name), [...ACCOUNT_GROUPS]);
assert.equal(new Set(full.map((l) => l.href)).size, full.length, "no duplicate links");
assert.ok(fg.groups.every((g) => g.links.length <= 9), "no group is a long list again");
const min = accountMenu({ username: "ada", canPublish: false, organisation: false, messages: false, wallet: false, cycle: false, calendar: false, goLive: false });
assert.deepEqual(groupLinks(min).loose.map((l) => l.href), ["/u/ada"]);
assert.ok(!min.some((l) => ["/write", "/shipments", "/organisation", "/profile/wallet", "/messages", "/cycle", "/calendar"].includes(l.href)));
assert.equal(min.find((l) => l.href === "/profile/publishing")?.label, "Start publishing");
assert.equal(currentLink(full, "/u/ada/store")?.label, "My store", "the store, not the profile");
assert.equal(currentLink(full, "/boost/123"), undefined, "Boost a post is exact");

console.log("ALL OK");
