import type { Firestore } from "firebase-admin/firestore";
import { notifyBell } from "./email";
import { notifyMentions } from "./mentions-server";
import {
  ReviewError, breakdownOf, cleanRecommendation, recommendationSummary, cleanReply, cleanReview, summarise,
  type RatingSummary, type Recommendation, type RecommendationStatus, type Review,
} from "./reviews";

// Server side of store reviews and profile recommendations. Collections (all server-only in firestore.rules; the pages read them through
// /api/store/reviews and /api/recommendations): storeReviews/{uid}_{itemId}, recommendations/{authorUid}_{subjectUid}.
// Ratings are also kept as a running total on storeStats/{itemId} (ratingSum, ratingCount) so lists and Trending don't read every review.
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new ReviewError(msg, status); };
type Who = { uid: string; name: string; username: string; avatar: string; isOrg?: boolean };

export async function whoIs(db: Firestore, uid: string): Promise<Who> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  return { uid, name: String(u?.displayName || u?.username || "Member"), username: String(u?.username || ""), avatar: String(u?.avatar || ""), isOrg: u?.accountKind === "organisation" };
}

// Only someone who really bought the item can review it: a physical order that was delivered or confirmed, or a digital purchase.
export async function boughtItem(db: Firestore, uid: string, itemId: string): Promise<boolean> {
  const orders = await db.collection("storeOrders").where("buyerUid", "==", uid).where("itemId", "==", itemId).get();
  if (orders.docs.some((d) => ["delivered", "confirmed"].includes(String(d.data().status)))) return true;
  const digital = await db.collection("digitalPurchases").where("buyerUid", "==", uid).where("itemId", "==", itemId).limit(1).get();
  return !digital.empty;
}

const toReview = (id: string, d: FirebaseFirestore.DocumentData): Review => ({ ...(d as Omit<Review, "id">), id, verified: true });

export async function submitReview(db: Firestore, uid: string, itemId: string, input: { rating?: unknown; text?: unknown }, now = new Date()): Promise<{ summary: RatingSummary }> {
  const clean = cleanReview(input);
  const itemRef = db.doc(`storeItems/${itemId}`);
  const item = await itemRef.get();
  need(item.exists, "That item wasn't found.", 404);
  const ownerUid = String(item.data()!.ownerUid);
  need(ownerUid !== uid, "You can't review your own item.");
  need(await boughtItem(db, uid, itemId), "Only people who bought this item can review it, once it has arrived.");
  const me = await whoIs(db, uid);
  const ref = db.doc(`storeReviews/${uid}_${itemId}`), statRef = db.doc(`storeStats/${itemId}`);
  const at = now.toISOString();
  const summary = await db.runTransaction(async (t) => {
    const [old, stat] = await Promise.all([t.get(ref), t.get(statRef)]);
    let sum = Number(stat.data()?.ratingSum) || 0, count = Number(stat.data()?.ratingCount) || 0;
    if (old.exists) sum -= Number(old.data()!.rating) || 0; else count += 1;
    sum += clean.rating;
    t.set(statRef, { ownerUid, ratingSum: sum, ratingCount: count }, { merge: true });
    t.set(ref, {
      itemId, itemTitle: String(item.data()!.title ?? ""), ownerUid, uid, name: me.name, username: me.username, avatar: me.avatar,
      rating: clean.rating, text: clean.text, createdAt: old.exists ? old.data()!.createdAt : at, ...(old.exists ? { updatedAt: at, reply: old.data()!.reply ?? null } : {}),
    });
    return summarise(sum, count);
  });
  await notifyBell({ uid: ownerUid, type: "review", linkHref: `/shop/${itemId}`, message: `${me.name} left ${clean.rating} star${clean.rating === 1 ? "" : "s"} on ${String(item.data()!.title ?? "your item")}.` }).catch(() => {});
  if (clean.text) await notifyMentions(db, { kind: "review", sourceId: ref.id, text: clean.text, author: { uid, name: me.name, username: me.username, avatar: me.avatar }, where: `in a review of ${String(item.data()!.title ?? "an item")}`, linkHref: `/shop/${itemId}`, skipUids: [ownerUid] }, now).catch(() => {});
  return { summary };
}

export async function deleteReview(db: Firestore, uid: string, reviewId: string): Promise<void> {
  const ref = db.doc(`storeReviews/${String(reviewId)}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That review wasn't found.", 404);
    need(s.data()!.uid === uid, "You can only remove your own review.");
    const statRef = db.doc(`storeStats/${s.data()!.itemId}`);
    const stat = await t.get(statRef);
    t.delete(ref);
    t.set(statRef, { ratingSum: Math.max(0, (Number(stat.data()?.ratingSum) || 0) - Number(s.data()!.rating)), ratingCount: Math.max(0, (Number(stat.data()?.ratingCount) || 0) - 1) }, { merge: true });
  });
}

export async function replyToReview(db: Firestore, sellerUid: string, reviewId: string, text: unknown, now = new Date()): Promise<void> {
  const reply = cleanReply(text);
  const ref = db.doc(`storeReviews/${String(reviewId)}`);
  const s = await ref.get();
  need(s.exists, "That review wasn't found.", 404);
  need(s.data()!.ownerUid === sellerUid, "Only the seller can reply to a review of their item.");
  await ref.update({ reply: { text: reply, at: now.toISOString() } });
  await notifyBell({ uid: String(s.data()!.uid), type: "review", linkHref: `/shop/${s.data()!.itemId}`, message: `The seller replied to your review of ${String(s.data()!.itemTitle ?? "an item")}.` }).catch(() => {});
  const seller = await whoIs(db, sellerUid);
  await notifyMentions(db, { kind: "review_reply", sourceId: ref.id, text: reply, author: { uid: sellerUid, name: seller.name, username: seller.username, avatar: seller.avatar }, where: `in a reply to a review of ${String(s.data()!.itemTitle ?? "an item")}`, linkHref: `/shop/${s.data()!.itemId}`, skipUids: [String(s.data()!.uid)] }, now).catch(() => {});
}

export type ReviewList = { reviews: Review[]; summary: RatingSummary; breakdown: number[]; canReview: boolean; mine: Review | null };

// An item's reviews (newest first) or, with ownerUid, every review across a seller's items. `viewerUid` only decides canReview/mine.
export async function listReviews(db: Firestore, q: { itemId?: string; ownerUid?: string }, viewerUid?: string): Promise<ReviewList> {
  const field = q.itemId ? "itemId" : "ownerUid";
  const value = q.itemId ?? q.ownerUid ?? "";
  need(!!value && !value.includes("/"), "Which item or seller?", 400);
  const [snap, stats] = await Promise.all([
    db.collection("storeReviews").where(field, "==", value).get(),
    q.itemId ? db.doc(`storeStats/${q.itemId}`).get() : db.collection("storeStats").where("ownerUid", "==", value).get(),
  ]);
  const everyReview = snap.docs.map((d) => toReview(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviews = everyReview.slice(0, 50);
  const docs = "docs" in stats ? stats.docs.map((d) => d.data()) : [stats.data() ?? {}];
  const summary = summarise(docs.reduce((s, d) => s + (Number(d.ratingSum) || 0), 0), docs.reduce((s, d) => s + (Number(d.ratingCount) || 0), 0));
  const mine = viewerUid && q.itemId ? reviews.find((r) => r.uid === viewerUid) ?? null : null;
  let canReview = false;
  if (viewerUid && q.itemId) {
    const owner = (await db.doc(`storeItems/${q.itemId}`).get()).data()?.ownerUid;
    canReview = !!owner && owner !== viewerUid && (!!mine || (await boughtItem(db, viewerUid, q.itemId)));
  }
  return { reviews, summary, breakdown: breakdownOf(everyReview.map((r) => r.rating)), canReview, mine };
}

// ── Recommendations ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A member (or organisation) writes a few sentences about another member or organisation. It shows on the profile only after the
// person recommended approves it; they can hide it later. One per pair; the author can rewrite it (it goes back to waiting).
const toRec = (id: string, d: FirebaseFirestore.DocumentData): Recommendation => ({ ...(d as Omit<Recommendation, "id">), id });
export const MAX_PENDING_PER_AUTHOR = 10;

export async function writeRecommendation(db: Firestore, authorUid: string, subjectUid: string, input: { relationship?: unknown; rating?: unknown; text?: unknown }, now = new Date()): Promise<void> {
  need(!!subjectUid && !subjectUid.includes("/"), "Who is it for?", 400);
  need(authorUid !== subjectUid, "You can't recommend yourself.");
  const clean = cleanRecommendation(input);
  const subject = await db.doc(`users/${subjectUid}`).get();
  need(subject.exists && subject.data()!.suspended !== true, "That profile wasn't found.", 404);
  const ref = db.doc(`recommendations/${authorUid}_${subjectUid}`);
  const old = await ref.get();
  if (!old.exists) {
    const open = await db.collection("recommendations").where("authorUid", "==", authorUid).where("status", "==", "pending").get();
    need(open.size < MAX_PENDING_PER_AUTHOR, "You have several recommendations still waiting for approval. Wait for some to be answered.", 429);
  }
  const me = await whoIs(db, authorUid);
  const at = now.toISOString();
  await ref.set({
    authorUid, authorName: me.name, authorUsername: me.username, authorAvatar: me.avatar, authorIsOrg: !!me.isOrg, subjectUid, ...clean,
    status: "pending" as RecommendationStatus, createdAt: old.exists ? old.data()!.createdAt : at, ...(old.exists ? { updatedAt: at } : {}),
  });
  await notifyBell({ uid: subjectUid, type: "recommendation", linkHref: `/u/${String(subject.data()!.username)}#recommendations`, message: `${me.name} wrote you a recommendation. Approve it to show it on your profile.` }).catch(() => {});
}

export async function answerRecommendation(db: Firestore, subjectUid: string, id: string, action: unknown): Promise<void> {
  need(action === "approve" || action === "hide", "Unknown action.", 400);
  const ref = db.doc(`recommendations/${String(id)}`);
  const s = await ref.get();
  need(s.exists, "That recommendation wasn't found.", 404);
  need(s.data()!.subjectUid === subjectUid, "Only the person recommended can approve or hide it.");
  await ref.update({ status: action === "approve" ? "approved" : "hidden" });
  // Mentions in a recommendation only go out once it is public, on the profile of the person it's about.
  if (action === "approve") {
    const r = s.data()!;
    const subject = (await db.doc(`users/${subjectUid}`).get()).data();
    await notifyMentions(db, { kind: "recommendation", sourceId: ref.id, text: String(r.text ?? ""), author: { uid: String(r.authorUid), name: String(r.authorName ?? "Someone"), username: String(r.authorUsername ?? ""), avatar: String(r.authorAvatar ?? "") }, where: `in a recommendation of ${String(subject?.displayName ?? "a member")}`, linkHref: `/u/${String(subject?.username ?? "")}#recommendations`, skipUids: [subjectUid] }).catch(() => {});
  }
}

export async function deleteRecommendation(db: Firestore, uid: string, id: string): Promise<void> {
  const ref = db.doc(`recommendations/${String(id)}`);
  const s = await ref.get();
  need(s.exists, "That recommendation wasn't found.", 404);
  need(s.data()!.authorUid === uid, "You can only withdraw your own recommendation.");
  await ref.delete();
}

// Approved ones for everyone; the subject also sees what is waiting and what they hid; an author sees their own for this subject.
export async function listRecommendations(db: Firestore, subjectUid: string, viewerUid?: string): Promise<{ approved: Recommendation[]; waiting: Recommendation[]; mine: Recommendation | null; summary: ReturnType<typeof recommendationSummary> }> {
  const snap = await db.collection("recommendations").where("subjectUid", "==", subjectUid).get();
  const all = snap.docs.map((d) => toRec(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const isSubject = viewerUid === subjectUid;
  const approved = all.filter((r) => r.status === "approved");
  return {
    approved, summary: recommendationSummary(approved),
    waiting: isSubject ? all.filter((r) => r.status !== "approved") : [],
    mine: viewerUid && !isSubject ? all.find((r) => r.authorUid === viewerUid) ?? null : null,
  };
}
