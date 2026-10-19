// Shipments for logistics businesses (lib/shipments.ts) and the Track site section (lib/site-settings.ts): the booking form's checks,
// where the receiver's link goes, the message they're sent, hand-off input. Run: npm run test:shipments → "ALL OK".
import assert from "node:assert/strict";
import { cleanServices, cleanShipment, receiverMessage, serviceName, servicesOf, shipmentOpen, shipmentStatusLabel, trackingLink, waNumber } from "../../lib/shipments";
import { parseCustody } from "../../lib/orders";
import { cleanSiteSections, siteSectionsOf } from "../../lib/site-settings";

const good = { service: "waybill", itemTitle: "2 cartons of shoes", quantity: 2, senderName: "Frazo Logistics", receiverName: "Ada Obi", receiverPhone: "0803 123 4567", pickup: "Ikeja office", address: "12 Allen Avenue", city: "Ikeja", state: "Lagos", note: "" };
const ok = cleanShipment(good);
assert.ok(ok.ok);
if (ok.ok) { assert.equal(ok.value.receiverPhone, "08031234567", "spaces come out of the phone number"); assert.equal(ok.value.quantity, 2); }
const err = (v: Record<string, unknown>) => { const r = cleanShipment({ ...good, ...v }); return r.ok ? null : r.error; };
assert.match(err({ service: "teleport" })!, /service/);
assert.match(err({ itemTitle: " " })!, /being sent/);
assert.match(err({ quantity: 0 })!, /quantity/);
assert.match(err({ quantity: 1000 })!, /quantity/);
assert.match(err({ quantity: 1.5 })!, /quantity/);
assert.match(err({ receiverPhone: "12345" })!, /phone/);
assert.match(err({ address: "12" })!, /address/);
assert.match(err({ state: "Atlantis" })!, /state/);
assert.match(err({ senderName: "" })!, /sender/);
assert.equal(cleanShipment(null).ok, false);
assert.equal(serviceName("bulk"), "Bulk delivery");
assert.ok(shipmentOpen("paid") && shipmentOpen("dispatched") && !shipmentOpen("delivered") && !shipmentOpen("cancelled"));

// each business offers its own services: an errands company, a full logistics company…
assert.equal(servicesOf(null).length, 6, "not chosen yet: all of them");
assert.deepEqual(servicesOf({ logistics: { services: ["errand_office", "errand_home", "nope"] } }), ["errand_home", "errand_office"], "in the list's order, unknown ones dropped");
assert.deepEqual(cleanServices(["warehouse", "delivery"]), ["delivery", "warehouse"]);
assert.equal(cleanServices([]), null); assert.equal(cleanServices(["delivery", "teleport"]), null); assert.equal(cleanServices("delivery"), null);
assert.equal(shipmentStatusLabel("paid", "warehouse"), "In storage — waiting to be despatched");
assert.equal(shipmentStatusLabel("dispatched", "errand_home"), "On the way");
assert.equal(shipmentStatusLabel("delivered", "errand_office"), "Done — delivered");
assert.equal(shipmentStatusLabel("dispatched", "waybill"), "In transit");
assert.equal(shipmentStatusLabel("cancelled", "errand_home"), "Cancelled");
assert.equal(serviceName("errand_home"), "Home errand");

// the receiver's link: their own domain when Track is on, their site on #NotesApp without a domain, #NotesApp's page when Track is off
const base = { siteUrl: "https://www.notesapp.name.ng", username: "frazo", parcelId: "NA-7K2M9QXD" };
assert.equal(trackingLink({ ...base, trackOn: true, domain: "track.frazo.ng" }), "https://track.frazo.ng/track/NA-7K2M9QXD");
assert.equal(trackingLink({ ...base, trackOn: true, domain: null }), "https://www.notesapp.name.ng/s/frazo/track/NA-7K2M9QXD");
assert.equal(trackingLink({ ...base, trackOn: false, domain: "track.frazo.ng" }), "https://www.notesapp.name.ng/track/NA-7K2M9QXD");
assert.equal(receiverMessage({ business: "Frazo Logistics", receiverName: "Ada Obi", itemTitle: "2 cartons", parcelId: "NA-7K2M9QXD", link: "https://x/track/NA-7K2M9QXD" }),
  "Hello Ada, Frazo Logistics has your parcel (2 cartons). Your tracking number is NA-7K2M9QXD. Follow it here: https://x/track/NA-7K2M9QXD");
assert.equal(waNumber("0803 123 4567"), "2348031234567");
assert.equal(waNumber("+2348031234567"), "2348031234567");

// a hand-off: the consent message names who sees the number
assert.deepEqual(parseCustody({ holderType: "bike", holderName: " Musa ", location: "Ojota" }, "receiver"), { holderType: "bike", holderName: "Musa", location: "Ojota" });
assert.equal(parseCustody({ holderType: "bike", holderName: "Musa", location: "Ojota", holderPhone: "08031234567" }, "receiver"), "Confirm the holder agrees to their phone number being shown to the receiver.");
assert.deepEqual(parseCustody({ holderType: "park", holderName: "Agent", location: "Jibowu", holderPhone: "08031234567", consent: true }, "buyer"), { holderType: "park", holderName: "Agent", holderPhone: "08031234567", location: "Jibowu" });
assert.equal(parseCustody({ holderType: "buyer", holderName: "x", location: "y" }, "buyer"), "Choose who holds the parcel.");
assert.match(String(parseCustody({ holderType: "bike", holderName: "x", location: "y", holderPhone: "123", consent: true }, "buyer")), /valid Nigerian phone/);

// Track is off until switched on; older clients that don't send it still save; at least one section on
assert.equal(siteSectionsOf(null).track, false);
assert.equal(siteSectionsOf({ siteSections: { track: true } }).track, true);
assert.equal(siteSectionsOf({ siteSections: {} }).journals, true);
assert.deepEqual(cleanSiteSections({ journals: true, shop: false, courses: false }), { journals: true, shop: false, courses: false, track: false });
assert.deepEqual(cleanSiteSections({ journals: false, shop: false, courses: false, track: true }), { journals: false, shop: false, courses: false, track: true }, "a site can be just Track");
assert.equal(cleanSiteSections({ journals: false, shop: false, courses: false, track: false }), null);
assert.equal(cleanSiteSections({ journals: true, shop: true, courses: true, track: "yes" }), null);

console.log("ALL OK");
