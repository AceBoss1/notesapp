// Shipments (lib/shipments-server.ts) against the Firestore emulator: who may book, the tracking number, hand-offs and their links,
// delivered and cancelled. Run: npm run test:shipments-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ShipmentError, createShipment, listShipments, myBusinesses, setServices, shipmentAction } from "../../lib/shipments-server";
import type { Parcel } from "../../lib/orders";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, re: RegExp, status?: number) => {
  await assert.rejects(p, (e: unknown) => e instanceof ShipmentError && re.test(e.message) && (status === undefined || e.status === status));
};
const input = { service: "delivery", itemTitle: "Documents", quantity: 1, senderName: "Frazo Logistics", receiverName: "Ada Obi", receiverPhone: "08031234567", pickup: "Ikeja office", address: "12 Allen Avenue", city: "Ikeja", state: "Lagos", note: "Call first" };

(async () => {
  await db.doc("users/frazo").set({ username: "frazo", displayName: "Frazo Logistics", role: "publisher", accountTier: "business", accountKind: "organisation", siteSections: { journals: true, shop: false, courses: false, track: true } });
  await db.doc("users/rider_boss").set({ username: "dispatch1", displayName: "Dispatch One", role: "reader", accountTier: "standard" });
  await db.doc("users/small").set({ username: "smallshop", displayName: "Small Shop", role: "publisher", accountTier: "pro" });
  await db.doc("users/other").set({ username: "otherco", displayName: "Other Co", role: "publisher", accountTier: "business" });
  await db.doc("orgMembers/frazo_rider_boss").set({ orgUid: "frazo", memberUid: "rider_boss", role: "writer", store: true });

  // only Business and Enterprise, and only for yourself or a business that gave you store access
  await fails(createShipment(db, "small", "small", input), /Business and Enterprise/, 403);
  await fails(createShipment(db, "other", "frazo", input), /can't manage/, 403);
  await fails(createShipment(db, "frazo", "frazo", { ...input, receiverPhone: "123" }), /phone/, 400);
  const s = await createShipment(db, "frazo", "frazo", input, new Date("2026-10-18T09:00:00Z"));
  assert.match(s.parcelId, /^NA-[2-9A-HJ-NP-Z]{8}$/);
  assert.equal(s.kind, "shipment"); assert.equal(s.status, "paid"); assert.equal(s.buyerUid, ""); assert.equal(s.orderRef, s.parcelId);
  assert.equal(s.buyerPhoneLast4, "4567", "the receiver's last 4 digits unlock riders' numbers on the tracking page");
  assert.equal(s.shipment?.receiverPhone, "08031234567"); assert.equal(s.sellerUsername, "frazo");
  // a team member with store access books for the business, in the business's name
  const t = await createShipment(db, "rider_boss", "frazo", { ...input, itemTitle: "Carton" }, new Date("2026-10-18T10:00:00Z"));
  assert.equal(t.sellerUid, "frazo"); assert.equal(t.shipment?.createdBy, "rider_boss");
  // an errands-only company: only errands can be booked
  await db.doc("users/runners").set({ username: "runners", displayName: "Quick Runners", role: "publisher", accountTier: "business" });
  await fails(setServices(db, "runners", "runners", []), /at least one/);
  await fails(setServices(db, "other", "runners", ["errand_home"]), /can't manage/, 403);
  const qr = await setServices(db, "runners", "runners", ["errand_office", "errand_home"]);
  assert.deepEqual(qr.services, ["errand_home", "errand_office"]);
  await fails(createShipment(db, "runners", "runners", input), /doesn't offer Delivery/);
  const e = await createShipment(db, "runners", "runners", { ...input, service: "errand_home", itemTitle: "Market run" });
  assert.equal(e.shipment?.service, "errand_home");
  assert.equal((await myBusinesses(db, "frazo"))[0].services.length, 6, "a business that hasn't chosen offers everything");
  console.log("booking ok");

  const mine = await myBusinesses(db, "rider_boss");
  assert.deepEqual(mine.map((b) => b.uid), ["frazo"], "a standard member only sees the business they work for");
  assert.equal(mine[0].trackOn, true);
  assert.deepEqual((await myBusinesses(db, "small")).map((b) => b.uid), [], "Pro isn't enough");
  const listed = await listShipments(db, "frazo");
  assert.deepEqual(listed.map((p) => p.parcelId), [t.parcelId, s.parcelId], "newest first");

  // hand-offs: someone else's business can't touch it; a rider's link; delivered
  await fails(shipmentAction(db, "other", s.parcelId, { action: "add_custody", holderType: "bike", holderName: "Musa", location: "Ikeja" }), /can't manage/, 403);
  await fails(shipmentAction(db, "frazo", s.parcelId, { action: "add_custody", holderType: "bike", holderName: "Musa", location: "Ikeja", holderPhone: "08022223333" }), /receiver/);
  let r = await shipmentAction(db, "frazo", s.parcelId, { action: "add_custody", holderType: "bike", holderName: "Musa", location: "Ikeja", holderPhone: "08022223333", consent: true });
  assert.equal(r.parcel.status, "dispatched"); assert.equal(r.parcel.mode, "handoff"); assert.equal(r.parcel.custody.length, 1);
  assert.ok(r.parcel.shipment?.dispatchedAt); assert.equal(r.parcel.shipment?.receiverName, "Ada Obi", "the rest of the shipment stays");
  r = await shipmentAction(db, "rider_boss", s.parcelId, { action: "holder_link", entryId: r.parcel.custody[0].id });
  assert.match(r.url!, /\/p\/[A-Za-z0-9_-]+$/);
  const links = await db.collection("parcelLinks").where("parcelId", "==", s.parcelId).where("active", "==", true).get();
  assert.equal(links.size, 1);
  await fails(shipmentAction(db, "frazo", s.parcelId, { action: "cancel" }), /on its way/, 409);
  r = await shipmentAction(db, "frazo", s.parcelId, { action: "mark_delivered" });
  assert.equal(r.parcel.status, "delivered"); assert.ok(r.parcel.shipment?.deliveredAt);
  assert.equal((await db.collection("parcelLinks").where("parcelId", "==", s.parcelId).where("active", "==", true).get()).size, 0, "delivered ends the riders' links");
  await fails(shipmentAction(db, "frazo", s.parcelId, { action: "add_custody", holderType: "bike", holderName: "Musa", location: "Ikeja" }), /can't be changed/, 409);
  console.log("hand-offs ok");

  // a booked shipment can be cancelled; then nothing more
  r = await shipmentAction(db, "frazo", t.parcelId, { action: "cancel" });
  assert.equal(r.parcel.status, "cancelled"); assert.ok(r.parcel.shipment?.cancelledAt);
  await fails(shipmentAction(db, "frazo", t.parcelId, { action: "mark_delivered" }), /can't be changed/, 409);
  await fails(shipmentAction(db, "frazo", t.parcelId, { action: "fly" }), /Unknown/);

  // a store order's parcel isn't a shipment
  await db.doc("parcels/NA-2222AAAA").set({ parcelId: "NA-2222AAAA", kind: "store", sellerUid: "frazo", status: "paid", custody: [] } as Partial<Parcel>);
  await fails(shipmentAction(db, "frazo", "NA-2222AAAA", { action: "cancel" }), /No shipment/, 404);

  // losing the plan stops new bookings and steps (the record stays)
  await db.doc("users/frazo").update({ accountTier: "pro" });
  await fails(createShipment(db, "frazo", "frazo", input), /Business and Enterprise/, 403);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
