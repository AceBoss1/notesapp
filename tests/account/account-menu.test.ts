// The account menu (lib/account-menu.ts): four tiles then "See more", the folding sections, "More from #NotesApp" in the owner's
// order, what drops out when it doesn't apply, the signed-out menu, and shortcuts from what was opened lately. Run: npm run test:menus
import assert from "node:assert/strict";
import { accountPages } from "../../lib/account-nav";
import { PINNED_MAX, RECENT_MAX, TILE_COUNT, accountMenu, allPlaces, forget, pin, pushRecent, shortcutsFrom, unpin, type MenuCtx } from "../../lib/account-menu";

const base: MenuCtx = { username: "ada", canPublish: true, isOrg: false, goLive: true, cycle: true, calToday: 2, wallet: true, messages: true, unreadDms: 3 };
const m = accountMenu(base);

// Four tiles, the most-used first; the rest under See more (owner, 22 Nov 2026: eight pushed Sign out out of reach).
assert.equal(m.tiles.length, TILE_COUNT);
assert.deepEqual(m.tiles.map((t) => t.label), ["My journal", "Messages", "Calendar", "My store"]);
assert.equal(m.tiles[1].badge, 3);
assert.equal(m.tiles[2].note, "2 today");
assert.deepEqual(m.more.map((t) => t.label), ["Wallet", "Saved", "Bookings", "Orders & parcels", "Go live", "My sounds", "Analytics", "My tickets", "My giving", "Shipments", "Co-author invites", "My Cycle", "Communities"]);

// The sections, in order, and "More from #NotesApp" as the owner listed it.
assert.deepEqual(m.sections.map((s) => s.label), ["Settings and privacy", "Business and jobs", "Upgrades", "Help and support", "More from #NotesApp"]);
const apps = m.sections.find((s) => s.key === "apps")!;
assert.deepEqual(apps.items.map((i) => i.label), ["Notes Arcade", "Notes Life", "Academy", "Exam Prep", "NotesApp Ventures", "Notes Jobs", "Notes Tasks", "Nana", "Notes Live", "Media Live Studio PRO"]);
assert.deepEqual(apps.items.map((i) => i.href), ["/arcade", "/life", "/academy", "/exam-prep", "/ventures", "/jobs", "/tasks", "/nana", "/lives", "/studio"]);

// Nothing appears twice anywhere in the menu.
// Every My account page (lib/account-nav.ts) and the other pages of your own are in the menu (owner, 22 Nov 2026: "I didn't see my sounds").
{
  const full = accountMenu({ ...base, isOrg: true, media: true });
  const all = [...full.tiles, ...full.more, ...full.sections.flatMap((s) => s.items)].map((i) => i.href);
  const own = [...accountPages({ wallet: true, media: true }).map((p) => p.href), "/profile/site", "/profile/jobs", "/profile/applications", "/profile/tasks", "/profile/boosts", "/profile/account", "/profile/family"];
  assert.deepEqual(own.filter((h) => !all.includes(h)), [], "a page of your own is missing from the menu");
  assert.ok(!accountMenu(base).sections.flatMap((s) => s.items).some((i) => i.href === "/profile/jobs"), "Jobs you post is for organisations");
  assert.ok(!accountMenu(base).more.some((i) => i.href === "/profile/media"), "My media only when Media is on");
}
const hrefs = [...m.tiles, ...m.more, ...m.sections.flatMap((s) => s.items)].map((i) => i.href);
const twice = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
assert.deepEqual(twice.filter((h) => h !== "/profile/publishing" && h !== "/nana"), [], "only Rates/Start publishing and Nana may sit in two places");

// What doesn't apply drops out, and the tiles fill up from the next places.
const plain = accountMenu({ ...base, canPublish: false, goLive: false, cycle: false, calToday: -1, wallet: false, messages: false, unreadDms: 0 });
assert.equal(plain.tiles[0].label, "Start publishing");
assert.ok(!plain.tiles.some((t) => ["Messages", "Calendar", "Wallet"].includes(t.label)));
assert.equal(plain.tiles.length, TILE_COUNT);
assert.ok(![...plain.tiles, ...plain.more].some((t) => ["Go live", "My Cycle", "Shipments"].includes(t.label)));
assert.ok(!plain.sections[0].items.some((i) => i.label === "Organisation setup"));
assert.ok(accountMenu({ ...base, isOrg: true }).sections[0].items.some((i) => i.label === "Organisation setup"));

// Signed out: no tiles, just help and the apps.
const out = accountMenu({ ...base, username: null });
assert.deepEqual(out.tiles, []); assert.deepEqual(out.sections.map((s) => s.key), ["help", "apps"]);

// Shortcuts: newest first, no repeats, at most six, never a tile, and only places still in the menu.
let r: string[] = [];
for (const h of ["/tickets", "/arcade", "/write", "/tickets", "/nope", "/badges", "/jobs", "/studio", "/giving", "/life"]) r = pushRecent(r, h);
assert.equal(r.length, RECENT_MAX);
assert.deepEqual(r, ["/life", "/giving", "/studio", "/jobs", "/badges", "/nope"]);
assert.deepEqual(shortcutsFrom(["/write", "/arcade", "/nope", "/badges"], m).map((s) => s.label), ["Notes Arcade", "Verification badges"]);

// Pinned shortcuts (add/remove): pins first in the order pinned (tiles allowed), then recent ones that aren't pins or tiles.
let p: string[] = [];
p = pin(p, "/studio"); p = pin(p, "/write"); p = pin(p, "/studio");
assert.deepEqual(p, ["/studio", "/write"], "pinning twice keeps one");
const sc = shortcutsFrom(["/studio", "/badges", "/write"], m, p);
assert.deepEqual(sc.map((s) => [s.label, s.pinned]), [["Media Live Studio PRO", true], ["My journal", true], ["Verification badges", false]]);
assert.deepEqual(shortcutsFrom(["/badges"], m, unpin(p, "/studio")).map((s) => s.label), ["My journal", "Verification badges"]);
assert.deepEqual(forget(["/badges", "/jobs"], "/badges"), ["/jobs"]);
assert.deepEqual(shortcutsFrom([], m, ["/gone", "/jobs"]).map((s) => s.href), ["/jobs"], "a pin that left the menu is skipped");
let many: string[] = []; for (let i = 0; i < 20; i++) many = pin(many, `/x${i}`);
assert.equal(many.length, PINNED_MAX);
// Every place appears once in the Add list.
const places = allPlaces(m).map((i) => i.href);
assert.equal(new Set(places).size, places.length);
assert.ok(places.includes("/studio") && places.includes("/write") && places.includes("/badges"));

console.log("ACCOUNT MENU (new) OK");
