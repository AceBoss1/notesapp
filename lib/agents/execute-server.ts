import type { Firestore } from "firebase-admin/firestore";
import { sendMessage, type Alerts, type Notify } from "@/lib/messages-server";
import { changeMessage } from "@/lib/message-edits";
import { slugify } from "@/lib/firestore-notes";
import { roleLabelFor } from "@/lib/users";
import { emitWebhook } from "@/lib/webhooks";
import { canActForSeller, dispatchWithCourier } from "@/lib/orders-server";
import { cleanText, isHttpsUrl, type StoreOrder } from "@/lib/orders";
import { postJson } from "@/lib/api-v1";
import { MONEY_KINDS, type Proposal } from "./proposals";

// What happens when the member approves a proposal (or a rule lets Nana or an agent go ahead), and how it is taken back. Every change
// goes through the same code the member's own buttons use, as the member, with the same checks. Money never moves here: a "money"
// proposal can't be executed at all.

export class ExecError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export type ExecDeps = { notify?: Notify; alerts?: Alerts };

const MESSAGE_KINDS = new Set(["booking_reply", "booking_confirm", "customer_reply", "shipping_nudge"]);

// A journal saved as a draft, like the v1 API's POST /posts (never published here).
export async function createDraftNote(db: Firestore, uid: string, input: { title: unknown; content: unknown; topics?: unknown }, now = new Date()): Promise<{ noteId: string; slug: string }> {
  const title = String(input.title ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
  const content = String(input.content ?? "").replace(/\u0000/g, "").slice(0, 100_000);
  if (!title || !content.trim()) throw new ExecError("A draft needs a title and some text.");
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) throw new ExecError("No profile for this account.", 404);
  let slug = slugify(title) || "post";
  if (!(await db.collection("notes").where("slug", "==", slug).limit(1).get()).empty) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  const topics = Array.isArray(input.topics) ? input.topics.map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40)).filter(Boolean).slice(0, 5) : [];
  const ref = await db.collection("notes").add({
    viewCount: 0, likeCount: 0, shareCount: 0, slug, title, date: now.toISOString(), categories: [], tags: [], featured_image: "", content,
    author: u.displayName ?? u.username, author_role: roleLabelFor(u as never), author_avatar: u.avatar || "", authorUid: uid, authorUsername: u.username, status: "draft",
    ...(topics.length ? { topics } : {}),
  });
  return { noteId: ref.id, slug };
}

async function ownNote(db: Firestore, uid: string, noteId: unknown) {
  const ref = db.doc(`notes/${String(noteId ?? "").replace(/\//g, "")}`);
  const n = (await ref.get()).data();
  if (!n || n.authorUid !== uid) throw new ExecError("That journal wasn't found on this account.", 404);
  return { ref, n };
}

// Store item changes an agent may make: wording, stock and price (price changes always ask first; that's decided before this runs).
export const STORE_FIELDS = ["title", "subtitle", "stock", "priceKobo"] as const;
export function cleanStoreChanges(input: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (typeof input.title === "string" && input.title.trim()) out.title = input.title.trim().slice(0, 120);
  if (typeof input.subtitle === "string") out.subtitle = input.subtitle.trim().slice(0, 300);
  if (input.stock !== undefined && Number.isInteger(Number(input.stock)) && Number(input.stock) >= 0 && Number(input.stock) <= 100_000) out.stock = Number(input.stock);
  if (input.priceKobo !== undefined && Number.isInteger(Number(input.priceKobo)) && Number(input.priceKobo) >= 100 * 100 && Number(input.priceKobo) <= 5_000_000 * 100) out.priceKobo = Number(input.priceKobo);
  return out;
}

export async function execute(db: Firestore, uid: string, p: Proposal, draft: string, now = new Date(), deps: ExecDeps = {}): Promise<Record<string, unknown>> {
  if (MONEY_KINDS.includes(p.kind)) throw new ExecError("Money never moves through Nana or an agent. Open the order to decide.", 403);
  const pl = p.payload ?? {};
  if (MESSAGE_KINDS.has(p.kind)) {
    const text = draft.trim();
    if (!text) throw new ExecError("The reply is empty.");
    const sent = await sendMessage(db, uid, String(pl.toUid ?? ""), { text }, now, deps.notify, deps.alerts);
    return { cid: sent.conversationId, messageId: sent.messageId };
  }
  switch (p.kind) {
    case "journal_draft": {
      const r = await createDraftNote(db, uid, { title: pl.title, content: draft || pl.content, topics: pl.topics }, now);
      return { noteId: r.noteId, slug: r.slug, href: `/write?id=${r.noteId}` };
    }
    case "publish_post": {
      const { ref, n } = await ownNote(db, uid, pl.noteId);
      if (n.status === "published") return { noteId: ref.id, already: true };
      await ref.update({ status: "published", date: now.toISOString() });
      void emitWebhook(uid, "post.published", postJson(ref.id, { ...n, status: "published" }));
      return { noteId: ref.id, slug: n.slug, href: `/journals/${n.slug}` };
    }
    case "store_edit": {
      const ref = db.doc(`storeItems/${String(pl.itemId ?? "").replace(/\//g, "")}`);
      const item = (await ref.get()).data();
      if (!item || item.ownerUid !== uid) throw new ExecError("That store item wasn't found on this account.", 404);
      const changes = cleanStoreChanges((pl.changes ?? {}) as Record<string, unknown>);
      if (!Object.keys(changes).length) throw new ExecError("Nothing to change.");
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, item[k] ?? null]));
      const update: Record<string, unknown> = { ...changes, updatedAt: now.toISOString() };
      if (changes.priceKobo !== undefined) update.price = `₦${Math.round(Number(changes.priceKobo) / 100).toLocaleString("en-NG")}`;
      if (changes.priceKobo !== undefined) before.price = item.price ?? null;
      await ref.update(update);
      return { itemId: ref.id, before };
    }
    case "mark_shipped": {
      const ref = db.doc(`storeOrders/${String(pl.reference ?? "").replace(/\//g, "")}`);
      const order = (await ref.get()).data() as StoreOrder | undefined;
      if (!order || !(await canActForSeller(uid, order.sellerUid))) throw new ExecError("That order wasn't found on this account.", 404);
      if (order.status !== "paid") throw new ExecError("That order has already been sent or closed.", 409);
      const name = cleanText(pl.courier, 60), trackingNumber = cleanText(pl.trackingNumber, 60), trackingUrl = String(pl.trackingUrl ?? "").trim();
      if (!name || !trackingNumber) throw new ExecError("Give the courier's name and the tracking number.");
      if (trackingUrl && !isHttpsUrl(trackingUrl)) throw new ExecError("The tracking link must start with https://");
      await dispatchWithCourier(order, { name, trackingNumber, trackingUrl });
      return { reference: order.reference, parcelId: order.parcelId };
    }
  }
  throw new ExecError("This can't be done from Nana's inbox.", 400);
}

// Taking it back: a sent message is deleted (once read, the reader is asked to agree, as for any message); a draft Nana saved is
// removed while it's still a draft; a published journal goes back to draft; a store item gets its old values back.
export async function undo(db: Firestore, uid: string, p: Proposal): Promise<Record<string, unknown>> {
  const r = p.result ?? {};
  if (MESSAGE_KINDS.has(p.kind)) {
    const out = await changeMessage(db, uid, String(r.cid), String(r.messageId), "delete", "");
    return out.done ? { deleted: true } : { deleteRequested: true };
  }
  switch (p.kind) {
    case "journal_draft": {
      const { ref, n } = await ownNote(db, uid, r.noteId);
      if (n.status !== "draft") throw new ExecError("That journal is already published, so it stays.", 409);
      await ref.delete();
      return { deleted: true };
    }
    case "publish_post": {
      const { ref } = await ownNote(db, uid, r.noteId);
      await ref.update({ status: "draft" });
      return { unpublished: true };
    }
    case "store_edit": {
      const ref = db.doc(`storeItems/${String(r.itemId)}`);
      const item = (await ref.get()).data();
      if (!item || item.ownerUid !== uid) throw new ExecError("That store item wasn't found.", 404);
      await ref.update({ ...(r.before as Record<string, unknown>), updatedAt: new Date().toISOString() });
      return { restored: true };
    }
  }
  throw new ExecError("This can't be undone.", 409);
}
