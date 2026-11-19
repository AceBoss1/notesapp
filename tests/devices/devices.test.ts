// NotesPhone (lib/devices.ts): what a reservation keeps, and the count toward the factory's minimum order. Run: npm run test:devices.
import assert from "node:assert/strict";
import { DEVICES, MOQ, PARTNER_NAMED, checkReservation, colourLabel, deviceName, moqProgress, reservationMessage } from "../../lib/devices";

const ok = { name: "  Ada  Obi ", email: " Ada@Example.com ", model: "e-pro", colour: "crimson", city: "Lagos", notify: true };
const r = checkReservation(ok);
assert.ok(r.ok);
if (r.ok) assert.deepEqual(r.value, { name: "Ada Obi", email: "ada@example.com", model: "e-pro", colour: "crimson", city: "Lagos", notify: true });
const err = (o: Record<string, unknown>) => { const c = checkReservation({ ...ok, ...o }); return c.ok ? "" : c.error; };
assert.match(err({ name: "" }), /name/);
assert.match(err({ email: "nope" }), /email/);
assert.match(err({ model: "iphone" }), /Choose a phone/);
assert.match(err({ city: " " }), /city/);
assert.equal(checkReservation({ ...ok, colour: "neon" }).ok && (checkReservation({ ...ok, colour: "neon" }) as { value: { colour: string } }).value.colour, "any", "an unknown colour means any");
assert.equal((checkReservation({ ...ok, notify: false }) as { value: { notify: boolean } }).value.notify, false);
assert.equal(checkReservation(null).ok, false);

// Only E Pro is first; the others wait for 2027, with no specification shown until it's confirmed.
assert.deepEqual(DEVICES.filter((d) => d.status === "first").map((d) => d.id), ["e-pro"]);
assert.ok(DEVICES.filter((d) => d.status === "2027").every((d) => d.specs.length === 0));
assert.equal(PARTNER_NAMED, false, "the partner isn't named until the agreement is signed");
// No price or date anywhere in what the page says.
for (const d of DEVICES) assert.doesNotMatch(`${d.line} ${d.about} ${d.specs.flat().join(" ")}`, /₦|\$|price is|on sale|(january|february|march|april|may|june|july|august|september|october|november|december) \d/i, d.id);

assert.equal(deviceName("e-ultra-plus"), "NotesPhone E Ultra+"); assert.equal(colourLabel("any"), "Any colour"); assert.equal(colourLabel("ivory"), "Ivory");
assert.equal(reservationMessage({ model: "e-prestige", colour: "gold", city: "Abuja", notify: false }), "Phone: NotesPhone E Prestige\nColour: Gold\nCity: Abuja\nEmail me news: no");
assert.deepEqual(moqProgress(0), { count: 0, left: MOQ, reached: false, pct: 0 });
assert.deepEqual(moqProgress(MOQ - 1).reached, false);
assert.deepEqual(moqProgress(MOQ + 30), { count: MOQ + 30, left: 0, reached: true, pct: 100 });
console.log("DEVICES OK");
