import { createHash, randomBytes } from "crypto";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { sendEmail } from "./email";
import { ESCROW_AUTO_RELEASE_DAYS, StoreOrder } from "./orders";
import { formatNaira } from "./booking-time";

// Server-only helpers for seller orders and parcel links.
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newLinkToken = () => randomBytes(18).toString("base64url");
export const holderUrl = (token: string) => `${site()}/p/${token}`;

// Buyer confirmed (or the 7 days ran out, or an admin resolved a dispute): the
// seller's money stops being held and becomes payable.
export async function confirmOrder(reference: string, by: "buyer" | "auto" | "admin"): Promise<void> {
  const db = getAdminDb();
  const oref = db.doc(`storeOrders/${reference}`);
  const now = new Date().toISOString();
  let order: StoreOrder | undefined;
  await db.runTransaction(async (t) => {
    const snap = await t.get(oref);
    order = snap.data() as StoreOrder | undefined;
    if (!order) throw new Error("Order not found");
    if (order.status === "confirmed" || order.status === "refunded") return;
    const lref = db.doc(`ledger/${reference}`);
    const l = (await t.get(lref)).data();
    t.update(oref, { status: "confirmed", confirmedAt: now, ...(by === "auto" ? { autoConfirmed: true } : {}) });
    t.update(db.doc(`parcels/${order.parcelId}`), { status: "confirmed" });
    if (l && ["held", "disputed"].includes(l.status)) t.update(lref, { releaseAfter: now, ...(l.status === "disputed" && by === "admin" ? { status: "held" } : {}) });
  });
  if (order && by !== "buyer") {
    const to = await getUserEmail(order.sellerUid);
    if (to) await sendEmail({ to, subject: "Your order payout is ready", text: `The order for ${order.itemTitle} (${formatNaira(order.amountKobo)}) is ${by === "auto" ? "automatically confirmed after the 7-day window" : "confirmed"}, so your money is no longer held and will be paid out to your bank.\n\n#NotesApp` }).catch(() => {});
  }
}

// Called by the daily cron: orders marked delivered whose 7 days are up.
export async function releaseDueOrders(): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection("storeOrders").where("status", "==", "delivered").get();
  let n = 0;
  for (const d of snap.docs) {
    const o = d.data() as StoreOrder;
    if (o.autoReleaseAt && new Date(o.autoReleaseAt).getTime() <= Date.now()) {
      await confirmOrder(o.reference, "auto").catch((e) => console.error("auto-confirm failed", o.reference, e));
      n++;
    }
  }
  return n;
}

export const autoReleaseAt = () => new Date(Date.now() + ESCROW_AUTO_RELEASE_DAYS * 86_400_000).toISOString();

// A holder's no-login link works only until the NEXT party confirms custody.
export async function expireLinks(parcelId: string, exceptEntryId?: string): Promise<void> {
  const db = getAdminDb();
  const snap = await db.collection("parcelLinks").where("parcelId", "==", parcelId).where("active", "==", true).get();
  const batch = db.batch();
  snap.docs.forEach((d) => {
    if (d.data().entryId !== exceptEntryId) batch.update(d.ref, { active: false });
  });
  await batch.commit();
}
