import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeParcelId, type Parcel, type StoreOrder } from "@/lib/orders";
import type { Firestore } from "firebase-admin/firestore";
import { trackingLink } from "@/lib/shipments";
import { ShipmentError, createShipment, listShipments, myBusinesses, setServices, shipmentAction, shipmentBusiness, type Business } from "@/lib/shipments-server";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
// What the dashboard shows for one shipment: everything on the parcel, plus the link the receiver follows.
const row = (b: Business, p: Parcel) => ({ ...p, failedLookups: undefined, lockedUntil: undefined, link: trackingLink({ siteUrl: SITE_URL, username: b.username, domain: b.domain, trackOn: b.trackOn, parcelId: p.parcelId }) });

// Store orders this business delivers as a store's delivery partner (lib/logistics.ts), newest first, with each parcel's hand-offs. The
// partner needs the buyer's address and phone to deliver; it never sees what the store was paid.
async function carried(db: Firestore, uid: string) {
  const snap = await db.collection("storeOrders").where("carrier.uid", "==", uid).limit(200).get();
  const orders = snap.docs.map((d) => d.data() as StoreOrder).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1)).slice(0, 100);
  const parcels = await Promise.all(orders.map(async (o) => (await db.doc(`parcels/${o.parcelId}`).get()).data() as Parcel | undefined));
  return orders.map((o, i) => ({
    reference: o.reference, parcelId: o.parcelId, sellerUsername: o.sellerUsername, itemTitle: o.itemTitle, quantity: o.quantity, variantLabel: o.variantLabel ?? null,
    address: o.address, status: o.status, paidAt: o.paidAt, feeKobo: o.carrier?.feeKobo ?? 0, earnKobo: (o.carrier?.feeKobo ?? 0) - (o.carrier?.cutKobo ?? 0),
    custody: parcels[i]?.custody ?? [],
  }));
}

// GET → { businesses: [{ uid, username, name, trackOn, domain, services, shipments: [...] }] }: every business the member books for (their own
// on Business or Enterprise, and organisations that gave them store access), each with its latest shipments.
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    const businesses = await myBusinesses(db, me.uid);
    const out = await Promise.all(businesses.map(async (b) => ({ ...b, shipments: (await listShipments(db, b.uid)).map((p) => row(b, p)), carried: await carried(db, b.uid) })));
    return NextResponse.json({ businesses: out }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load shipments");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// POST { action: "create", businessUid, shipment } → { shipment }
// POST { action: "set_services", businessUid, services } → { business }
// POST { action: "add_custody" | "holder_link" | "mark_delivered" | "cancel", parcelId, … } → { shipment, url? }
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getAdminDb();
    if (body.action === "create") {
      const limited = await rateLimit(req, "shipment-create", me.uid, 300, 3600);
      if (limited) return limited;
      const businessUid = String(body.businessUid || me.uid);
      const parcel = await createShipment(db, me.uid, businessUid, body.shipment);
      return NextResponse.json({ shipment: row(await shipmentBusiness(db, me.uid, businessUid), parcel) });
    }
    if (body.action === "set_services") {
      const limited = await rateLimit(req, "shipment-services", me.uid, 30, 3600);
      if (limited) return limited;
      return NextResponse.json({ business: await setServices(db, me.uid, String(body.businessUid || me.uid), body.services) });
    }
    const limited = await rateLimit(req, "shipment-act", me.uid, 120, 60);
    if (limited) return limited;
    const parcelId = normalizeParcelId(body.parcelId);
    if (!parcelId) throw new ShipmentError("That isn't a tracking number.");
    const r = await shipmentAction(db, me.uid, parcelId, body);
    return NextResponse.json({ shipment: row(await shipmentBusiness(db, me.uid, r.parcel.sellerUid), r.parcel), ...(r.url ? { url: r.url } : {}) });
  } catch (err) {
    if (err instanceof ShipmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the shipment");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
