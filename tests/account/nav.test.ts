// The My account menu (lib/account-nav.ts, components/account/AccountShell.tsx): the four groups with the counts in the design, every
// page the old account links had, features that are off dropping out, and the phone bar's "where am I". Run: npm run test:menus
import assert from "node:assert/strict";
import { ACCOUNT_GROUPS, accountGroups, accountPages, whereAmI } from "../../lib/account-nav";

const all = accountPages({ wallet: true, media: true });
const groups = accountGroups(all);
assert.deepEqual(groups.map((g) => g.name), [...ACCOUNT_GROUPS]);
assert.deepEqual(Object.fromEntries(groups.map((g) => [g.name, g.pages.length])), { Profile: 4, Money: 3, Store: 4, Growth: 4 }, "the counts in the design");
assert.deepEqual(groups.find((g) => g.name === "Money")!.pages.map((p) => p.label), ["Wallet", "Rates & payouts", "Analytics"]);
assert.deepEqual(groups.find((g) => g.name === "Store")!.pages.map((p) => p.label), ["Business books", "Inventory", "Bookings", "Your hotel"]);
assert.equal(new Set(all.map((p) => p.href)).size, all.length, "no page twice");
// Every page the old My account links had is still in the menu.
for (const href of ["/write", "/profile/edit", "/profile/media", "/profile/publishing", "/profile/analytics", "/profile/sounds", "/bookings", "/profile/books",
  "/profile/inventory", "/profile/hotel", "/profile/discounts", "/profile/coupons", "/profile/referrals", "/boost", "/profile/wallet"]) {
  assert.ok(all.some((p) => p.href === href), `${href} is in the menu`);
}
// Features that are off drop out of their group's count.
const off = accountGroups(accountPages({ wallet: false, media: false }));
assert.equal(off.find((g) => g.name === "Money")!.pages.length, 2);
assert.equal(off.find((g) => g.name === "Profile")!.pages.length, 3);

assert.deepEqual(whereAmI("/profile/analytics", all), { group: "Money", label: "Analytics", page: all.find((p) => p.label === "Analytics") });
assert.equal(whereAmI("/bookings", all).group, "Store");
assert.equal(whereAmI("/profile/books/import", all).label, "Business books");
assert.deepEqual(whereAmI("/profile/account", all), { label: "Account settings" }, "not in the menu: its name, no group");
assert.deepEqual(whereAmI("/profile/unknown", all), {});
assert.equal(whereAmI("/boost/x", all).page, undefined, "Boost is its page only");

console.log("ACCOUNT MENU OK");
