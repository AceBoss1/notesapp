import { notifyBell } from "./email";
import { BooksError, catalog, recordExpense, recordPayment, recordPurchase, recordSale, type Ctx } from "./books-server";
import { can, cleanName, lagosDay, type Party } from "./books";
import { OUTBOX_ACTIONS, SYNC_BATCH, isClientId, recordedAt, type OutboxAction, type SyncResult } from "./books-outbox";

// Offline entries arriving (docs/BUSINESS-BOOKS.md, step 8; the phone's side is lib/books-outbox.ts). POST /api/books { action: "sync",
// items: [{ clientId, action, at, body }] } → { results }. Up to SYNC_BATCH at a time.
//
// - Once only: each entry is bookEntries/{owner}_{clientId}, for every kind (sale, expense, payment received, purchase), so an entry sent
//   twice (Background Sync and the page both trying, or a retry after a dropped answer) is "already saved", never counted twice.
// - Its own day: an entry keeps the moment it was recorded on the phone (within 14 days, never in the future), so yesterday's offline
//   sales are yesterday's.
// - Stock is checked here, when it syncs: a sale is never dropped for stock (two phones may sell the last bag offline), but the seller is
//   told which items sold more than was on the shelf, to count them.
// - A customer chosen offline who isn't in the books any more (or one typed in) is added, and the result says so.
// - What can't be saved (a cap reached, a payment bigger than what's owed now) comes back as not saved, with the reason, for the seller.
//   Only failures that may pass (the server busy) are marked to retry.
export async function syncOutbox(c: Ctx, raw: unknown): Promise<SyncResult[]> {
  const items = Array.isArray(raw) ? raw.slice(0, SYNC_BATCH) : [];
  if (!items.length) throw new BooksError(400, "Nothing to sync.");
  const out: SyncResult[] = [];
  let cat: Awaited<ReturnType<typeof catalog>> | null = null;
  for (const it of items) {
    const x = (it ?? {}) as { clientId?: unknown; action?: unknown; at?: unknown; body?: unknown };
    const clientId = isClientId(x.clientId) ? x.clientId : "";
    if (!clientId) { out.push({ clientId: String(x.clientId ?? ""), status: "failed", notes: [], error: "This entry has no id, so it can't be synced safely." }); continue; }
    const action = x.action as OutboxAction;
    if (!OUTBOX_ACTIONS.includes(action)) { out.push({ clientId, status: "failed", notes: [], error: "That kind of entry can't be saved offline." }); continue; }
    if (!can(c.role, action)) { out.push({ clientId, status: "failed", notes: [], error: "Your role on these books can't record this. Ask the owner." }); continue; }
    const ref = c.db.doc(`bookEntries/${c.owner}_${clientId}`);
    const have = await ref.get();
    if (have.exists) { out.push({ clientId, status: "duplicate", notes: [], entryId: ref.id }); continue; }
    const when = recordedAt(x.at, c.now);
    const at = { ...c, now: when, today: lagosDay(when) };
    const body: Record<string, unknown> = { ...((x.body ?? {}) as Record<string, unknown>), clientId };
    const notes: string[] = [];
    try {
      // The customer: one chosen offline may have been removed since, and one typed in may already be there.
      if ((action === "sale" || action === "payment") && typeof body.partyId === "string" && body.partyId) {
        const p = await c.db.doc(`bookParties/${body.partyId}`).get();
        if (!p.exists || p.data()?.ownerUid !== c.owner) {
          const name = cleanName(body.partyName);
          if (action === "payment" || !name) { out.push({ clientId, status: "failed", notes, error: "Customer not found. They may have been removed: choose them again." }); continue; }
          delete body.partyId; body.party = { name };
        }
      }
      if (action === "sale" && body.party && typeof body.party === "object") {
        const name = cleanName((body.party as { name?: unknown }).name).toLowerCase();
        const exists = (await c.db.collection("bookParties").where("ownerUid", "==", c.owner).where("kind", "==", "customer").get()).docs.some((d) => String((d.data() as Party).name).trim().toLowerCase() === name);
        if (name && !exists) notes.push(`${cleanName((body.party as { name?: unknown }).name)} wasn't in your customers, so they were added`);
      }
      // Stock, as it is now.
      const short: string[] = [];
      if (action === "sale" && c.inventory && Array.isArray(body.lines)) {
        cat ??= await catalog(c);
        for (const l of body.lines as { ref?: string; qty?: number }[]) {
          const item = l.ref ? cat.find((y) => y.ref === l.ref) : null;
          if (item && item.stock !== null && Number(l.qty) > item.stock) short.push(`${item.title}: ${item.stock <= 0 ? "it was out of stock" : `only ${item.stock} ${item.stock === 1 ? "was" : "were"} in stock`}`);
        }
      }
      let entryId = ref.id, receiptUrl: string | undefined, duplicate = false;
      if (action === "sale") { const r = await recordSale(at, body); entryId = r.entry.id; receiptUrl = r.receiptUrl; duplicate = !!r.duplicate; }
      else if (action === "expense") entryId = (await recordExpense(at, body)).id;
      else if (action === "payment") entryId = (await recordPayment(at, body)).id;
      else entryId = (await recordPurchase(at, body)).id;
      if (duplicate) { out.push({ clientId, status: "duplicate", notes: [], entryId }); continue; }
      await c.db.doc(`bookEntries/${entryId}`).update({ offline: true, syncedAt: c.now.toISOString() }).catch(() => {});
      if (short.length) {
        notes.push(`Item out of stock: ${short.join("; ")}. The sale is saved; count the shelf`);
        await notifyBell({ uid: c.owner, type: "stock", linkHref: "/profile/books?tab=stock", message: `A sale made offline sold more than was in stock (${short.join("; ")}). Count it and fix the stock.` }).catch(() => {});
      }
      if (when.getTime() < c.now.getTime() - 60_000) notes.push(`Recorded ${when.toLocaleString("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" })}`);
      out.push({ clientId, status: "saved", notes, entryId, ...(receiptUrl ? { receiptUrl } : {}) });
    } catch (e) {
      if (e instanceof BooksError) out.push({ clientId, status: "failed", notes, error: e.message, retry: e.status >= 500 || e.status === 429 });
      else { console.error("books sync failed", c.owner, clientId, e); out.push({ clientId, status: "failed", notes, error: "The server couldn't save it just now. It will try again.", retry: true }); }
    }
  }
  return out;
}
