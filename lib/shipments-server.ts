import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { newParcelId, parseCustody, phoneLast4, type CustodyEntry, type Parcel } from "./orders";
import { canActForSeller, expireLinks, hashToken, holderUrl, newLinkToken } from "./orders-server";
import { cleanServices, cleanShipment, serviceName, servicesOf, shipmentOpen, type ShipmentInfo, type ShipmentService } from "./shipments";
import { canChooseSiteTheme } from "./site-themes";
import { siteSectionsOf } from "./site-settings";
import { activeHostForUsername } from "./domains";
import type { UserProfile } from "./users";

// Server side of shipments (lib/shipments.ts): booking, the hand-off chain and the end of the road, for a logistics business on
// Business or Enterprise. The business itself or a team member it gave store access may run them (canActForSeller), the same people
// who run an organisation's store orders. Shipments live in `parcels` (kind "shipment"), which only the server writes.

export class ShipmentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type Business = { uid: string; username: string; name: string; trackOn: boolean; domain: string | null; services: ShipmentService[] };

// The business `uid` may act for, or an error saying why not.
export async function shipmentBusiness(db: Firestore, uid: string, businessUid: string): Promise<Business> {
  const p = (await db.doc(`users/${businessUid}`).get()).data() as UserProfile | undefined;
  if (!p || p.suspended) throw new ShipmentError("That account isn't available.", 404);
  if (!(await canActForSeller(uid, businessUid))) throw new ShipmentError("You can't manage this business's shipments.", 403);
  if (!canChooseSiteTheme(p)) throw new ShipmentError("Shipments and tracking are on the Business and Enterprise plans.", 403);
  return { uid: businessUid, username: p.username, name: p.displayName || p.username, trackOn: siteSectionsOf(p).track, domain: await activeHostForUsername(p.username), services: servicesOf(p) };
}

// Every business the member runs shipments for: their own account (on Business or Enterprise) and organisations that gave them store
// access. Accounts they may not book for are left out rather than failing the list.
export async function myBusinesses(db: Firestore, uid: string): Promise<Business[]> {
  const ids = [uid];
  const mem = await db.collection("orgMembers").where("memberUid", "==", uid).get();
  for (const m of mem.docs) if (m.data().store === true) ids.push(String(m.data().orgUid));
  const out: Business[] = [];
  for (const id of ids) {
    try { out.push(await shipmentBusiness(db, uid, id)); } catch (e) { if (!(e instanceof ShipmentError)) throw e; }
  }
  return out;
}

export const SHIPMENTS_LIST_MAX = 200;
export async function listShipments(db: Firestore, businessUid: string): Promise<Parcel[]> {
  const snap = await db.collection("parcels").where("sellerUid", "==", businessUid).where("kind", "==", "shipment").orderBy("createdAt", "desc").limit(SHIPMENTS_LIST_MAX).get();
  return snap.docs.map((d) => d.data() as Parcel);
}

// Book a shipment: a new parcel ID (tried again in the rare case it's taken) and the receiver's details kept with it.
export async function createShipment(db: Firestore, uid: string, businessUid: string, raw: unknown, now = new Date()): Promise<Parcel> {
  const input = cleanShipment(raw);
  if (!input.ok) throw new ShipmentError(input.error);
  const biz = await shipmentBusiness(db, uid, businessUid);
  const v = input.value;
  if (!biz.services.includes(v.service)) throw new ShipmentError(`${biz.name} doesn't offer ${serviceName(v.service)}. Add it under Your services first.`);
  const shipment: ShipmentInfo = {
    service: v.service, senderName: v.senderName, receiverName: v.receiverName, receiverPhone: v.receiverPhone, pickup: v.pickup,
    address: v.address, note: v.note, createdBy: uid,
  };
  for (let i = 0; i < 5; i++) {
    const parcelId = newParcelId();
    const parcel: Parcel = {
      parcelId, orderRef: parcelId, sellerUid: biz.uid, sellerUsername: biz.username, sellerName: biz.name, buyerUid: "",
      buyerPhoneLast4: phoneLast4(v.receiverPhone), itemTitle: v.itemTitle, quantity: v.quantity, city: v.city, state: v.state,
      status: "paid", kind: "shipment", shipment, custody: [], createdAt: now.toISOString(),
    };
    try {
      await db.doc(`parcels/${parcelId}`).create(parcel);
      return parcel;
    } catch (e) {
      if ((e as { code?: number }).code !== 6) throw e; // 6 = ALREADY_EXISTS: draw another ID
    }
  }
  throw new ShipmentError("Couldn't make a tracking number. Try again.", 503);
}

// The services the business offers (an errands company, a full logistics company, …): what can be booked and what its site lists.
export async function setServices(db: Firestore, uid: string, businessUid: string, raw: unknown): Promise<Business> {
  const services = cleanServices(raw);
  if (!services) throw new ShipmentError("Choose at least one service.");
  await shipmentBusiness(db, uid, businessUid);
  await db.doc(`users/${businessUid}`).update({ logistics: { services } });
  return shipmentBusiness(db, uid, businessUid);
}

export type ShipmentAction = "add_custody" | "holder_link" | "mark_delivered" | "cancel";

// One step on a shipment. Returns the parcel as it is now, and for holder_link the link to send the rider.
export async function shipmentAction(db: Firestore, uid: string, parcelId: string, body: Record<string, unknown>, now = new Date()): Promise<{ parcel: Parcel; url?: string }> {
  const ref = db.doc(`parcels/${parcelId}`);
  const parcel = (await ref.get()).data() as Parcel | undefined;
  if (!parcel || parcel.kind !== "shipment") throw new ShipmentError("No shipment with that tracking number.", 404);
  await shipmentBusiness(db, uid, parcel.sellerUid);
  const at = now.toISOString();
  const open = shipmentOpen(parcel.status);
  const reload = async () => (await ref.get()).data() as Parcel;

  switch (body.action as ShipmentAction) {
    case "add_custody": {
      if (!open) throw new ShipmentError("This shipment can't be changed now.", 409);
      const c = parseCustody(body, "receiver");
      if (typeof c === "string") throw new ShipmentError(c);
      const entry: CustodyEntry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...c, at, status: "confirmed", by: "seller" };
      await ref.update({ status: "dispatched", mode: "handoff", custody: FieldValue.arrayUnion(entry), ...(parcel.shipment?.dispatchedAt ? {} : { "shipment.dispatchedAt": at }) });
      await expireLinks(parcelId).catch(() => {}); // recording the next holder ends earlier holders' links
      return { parcel: await reload() };
    }
    case "holder_link": {
      if (!open) throw new ShipmentError("This shipment can't be changed now.", 409);
      const entry = parcel.custody.find((c) => c.id === body.entryId);
      if (!entry) throw new ShipmentError("No such hand-off.", 404);
      const token = newLinkToken();
      await db.doc(`parcelLinks/${hashToken(token)}`).set({ parcelId, entryId: entry.id, active: true, createdAt: at, expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString() });
      return { parcel, url: holderUrl(token) };
    }
    case "mark_delivered": {
      if (!open) throw new ShipmentError("This shipment can't be changed now.", 409);
      await ref.update({ status: "delivered", "shipment.deliveredAt": at });
      await expireLinks(parcelId).catch(() => {});
      return { parcel: await reload() };
    }
    case "cancel": {
      if (parcel.status !== "paid") throw new ShipmentError(parcel.status === "dispatched" ? "It's already on its way: mark it delivered, or record where it is." : "This shipment can't be cancelled now.", 409);
      await ref.update({ status: "cancelled", "shipment.cancelledAt": at });
      await expireLinks(parcelId).catch(() => {});
      return { parcel: await reload() };
    }
  }
  throw new ShipmentError("Unknown action.");
}
