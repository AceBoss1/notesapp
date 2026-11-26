// Discover events, calendars, themes and where things happen (lib/event-kit.ts). Pure.
// Run: npm run test:events-discover → "ALL OK".
import assert from "node:assert/strict";
import {
  CITY_MIN, EVENT_CATEGORIES, citiesFor, cleanTheme, cleanWhere, countUpcoming, coverStyle, defaultTheme, featured, isCategory, placeKey, shortCount, whereLine,
  type DiscoverEvent,
} from "../../lib/event-kit";

const STATES = ["Lagos", "FCT", "Rivers"] as const;
assert.equal(EVENT_CATEGORIES.length, 12);
assert.ok(isCategory("tech") && !isCategory("crypto"));

// Themes: a host's default is stable and never "paper"; a choice is kept; patterns only from the list.
assert.equal(defaultTheme("u_ada"), defaultTheme("u_ada"));
assert.notEqual(defaultTheme("u_ada"), "paper");
assert.deepEqual(cleanTheme({ theme: "forest", pattern: "africa" }, "x"), { theme: "forest", pattern: "africa" });
assert.deepEqual(cleanTheme({ theme: "neon", pattern: "kente" }, "u_ada"), { theme: defaultTheme("u_ada"), pattern: "none" });
assert.match(coverStyle({ theme: "forest", pattern: "africa" }).background, /africa-night\.svg.*#0F5132/);
assert.doesNotMatch(coverStyle({ theme: "forest", pattern: "none" }).background, /svg/);

// Where: in person needs a place; online uses #NotesApp video or an https link; hybrid needs both a place and a way online.
const ok = (v: Parameters<typeof cleanWhere>[0]) => { const r = cleanWhere(v, STATES); assert.ok(r.ok, JSON.stringify(r)); return r.ok ? r.where : null!; };
const no = (v: Parameters<typeof cleanWhere>[0], re: RegExp) => { const r = cleanWhere(v, STATES); assert.ok(!r.ok); if (!r.ok) assert.match(r.error, re); };
assert.deepEqual(ok({ format: "in_person", place: "The Workspace, Yaba", state: "Lagos", city: "Lagos" }), { format: "in_person", place: "The Workspace, Yaba", state: "Lagos", city: "Lagos", online: "", link: "" });
no({ format: "in_person", place: "" }, /where it is/);
assert.deepEqual(ok({ format: "online" }), { format: "online", place: "", state: "", city: "", online: "notesapp", link: "" });
assert.deepEqual(ok({ format: "online", online: "link", link: "https://meet.google.com/abc" }).link, "https://meet.google.com/abc");
assert.equal(ok({ format: "online", link: "https://zoom.us/j/1" }).online, "link", "a link given means the link");
no({ format: "online", online: "link" }, /online link/);
no({ format: "online", link: "http://insecure.example" }, /https/);
assert.deepEqual(ok({ format: "online", place: "ignored", state: "Lagos", city: "Lagos" }).place, "", "online drops the place");
const h = ok({ format: "hybrid", place: "Civic Centre", city: "Lagos", state: "Lagos" });
assert.equal(h.online, "notesapp");
no({ format: "hybrid", place: "" }, /where it is/);
assert.equal(ok({ format: "nonsense", place: "Hall" }).format, "in_person");
assert.equal(ok({ format: "in_person", place: "Hall", state: "Atlantis" }).state, "");
assert.equal(whereLine(h), "Civic Centre, Lagos · Online on #NotesApp");
assert.equal(whereLine({ format: "online", online: "link", link: "https://zoom.us/j/1" }), "Online", "the link itself is never shown");
assert.equal(whereLine({ format: "in_person", place: "Hall", city: "Ibadan" }), "Hall, Ibadan");

// Places.
assert.deepEqual(placeKey({ format: "online" }), { region: "online", city: "Online" });
assert.deepEqual(placeKey({ format: "in_person", city: "  lagos " }), { region: "nigeria", city: "Lagos" });
assert.deepEqual(placeKey({ format: "in_person", city: "accra" }), { region: "africa", city: "Accra" });
assert.deepEqual(placeKey({ format: "in_person", city: "", state: "FCT" }), { region: "nigeria", city: "Abuja" });
assert.deepEqual(placeKey({ format: "in_person", city: "owerri", state: "Imo" }), { region: "nigeria", city: "Owerri" });
assert.deepEqual(placeKey({ format: "in_person", city: "manchester" }), { region: "diaspora", city: "Manchester" });

// Featured and counts.
const NOW = "2026-11-26T09:00:00.000Z";
const e = (id: string, o: Partial<DiscoverEvent> = {}): DiscoverEvent => ({ id, title: id, startsAt: "2026-11-28T10:00:00.000Z", going: 0, visibility: "public", region: "nigeria", city: "Lagos", ...o });
const list = [
  e("a", { goingWeek: 5, category: "tech" }), e("b", { goingWeek: 30, category: "tech" }), e("c", { pinned: true, category: "faith" }),
  e("past", { startsAt: "2026-11-20T10:00:00.000Z", goingWeek: 99, category: "tech" }), e("members", { visibility: "members", goingWeek: 99 }),
  e("gone", { cancelled: true, goingWeek: 99 }), e("abj", { city: "Abuja", goingWeek: 50, category: "business" }),
  e("soon", { startsAt: "2026-11-27T10:00:00.000Z", category: "music" }),
  e("o1", { region: "online", city: "Online", category: "education" }),
  ...["1", "2", "3"].map((n) => e(`w${n}`, { city: "Owerri" })),
];
assert.deepEqual(featured(list, "lagos", NOW).map((x) => x.id), ["c", "b", "a", "soon"], "the city matches in any case");
assert.deepEqual(featured(list, "Lagos", NOW, 4).map((x) => x.id), ["c", "b", "a", "soon"], "pinned, then most Going this week, then soonest; never past, members-only or cancelled");
assert.deepEqual(featured(list, "Abuja", NOW).map((x) => x.id), ["abj"]);
const counts = countUpcoming(list, NOW);
assert.deepEqual(counts.categories, { tech: 2, faith: 1, business: 1, music: 1, education: 1 });
assert.deepEqual(counts.cities.slice(0, 3), [{ region: "nigeria", city: "Lagos", count: 4 }, { region: "nigeria", city: "Owerri", count: 3 }, { region: "nigeria", city: "Abuja", count: 1 }]);
const ng = citiesFor("nigeria", counts.cities);
assert.equal(ng[0].city, "Lagos");
assert.ok(ng.some((c) => c.city === "Owerri" && c.count === CITY_MIN), "a city not on the list shows once it has 3");
assert.ok(ng.some((c) => c.city === "Kano" && c.count === 0), "the known cities always show");
assert.ok(!citiesFor("nigeria", [{ region: "nigeria", city: "Nsukka", count: 2 }]).some((c) => c.city === "Nsukka"));
assert.equal(shortCount(999), "999");
assert.equal(shortCount(1200), "1.2k");
assert.equal(shortCount(3000), "3k");

console.log("ALL OK");
