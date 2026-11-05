import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { liveTicketId, type LiveTicketDoc } from "./live-tickets";

// The door of a paid live (lib/live-tickets.ts), used by the rooms (lib/rooms-server.ts) without pulling in the rest of the paid-live
// code: whether someone holds a valid ticket, and what happens to the ticket money when the room ends or is reopened.

export async function holdsLiveTicket(db: Firestore, eventId: string, uid: string): Promise<boolean> {
  if (!eventId || !uid) return false;
  const t = (await db.doc(`liveTickets/${liveTicketId(eventId, uid)}`).get()).data() as LiveTicketDoc | undefined;
  return !!t && t.status === "valid";
}

// The ledger entries of a live's valid tickets (one per ticket, under the payment's reference).
async function ticketLedgers(db: Firestore, eventId: string) {
  const snap = await db.collection("liveTickets").where("eventId", "==", eventId).limit(20_000).get();
  return snap.docs.map((d) => d.data() as LiveTicketDoc).filter((t) => t.status === "valid").map((t) => db.doc(`ledger/${t.reference}`));
}
async function patchAll(db: Firestore, refs: FirebaseFirestore.DocumentReference[], patch: Record<string, unknown>) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = db.batch();
    for (const ref of refs.slice(i, i + 400)) b.set(ref, patch, { merge: true });
    await b.commit();
  }
}

// The room of a paid live ended: the live is over (the host can reopen it for a short while: LIVE_RESUME_MS), and the ticket money now
// waits the problem window from this end (lib/payouts.ts autoReleasePayouts: releaseAfter + PAYOUT_HOLD_HOURS).
export async function markLiveEnded(db: Firestore, eventId: string, now = new Date()): Promise<void> {
  const ref = db.doc(`liveEvents/${eventId}`);
  const ok = await db.runTransaction(async (t) => {
    const e = (await t.get(ref)).data();
    if (!e || e.status !== "live") return false;
    t.update(ref, { status: "ended", endedAt: now.toISOString() });
    return true;
  });
  if (!ok) return;
  await patchAll(db, await ticketLedgers(db, eventId), { releaseAfter: now.toISOString(), awaitingLive: FieldValue.delete() });
}

// Reopened after a drop: the money waits again until it ends.
export async function markLiveReopened(db: Firestore, eventId: string): Promise<void> {
  await patchAll(db, await ticketLedgers(db, eventId), { awaitingLive: true });
}
