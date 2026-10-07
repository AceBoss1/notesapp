import type { Firestore } from "firebase-admin/firestore";
import { removeDomain } from "./domains";

// Server-only. A member's data rights under the Nigeria Data Protection Act: get a copy of what we
// hold about them (export) and have their account erased (deletion). Money records are different:
// payments, payouts and orders are kept (anonymised) because tax and dispute rules require it.
const clean = (data: FirebaseFirestore.DocumentData) => {
  const { expireAt, ...rest } = data;
  void expireAt;
  return rest;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { id: string } & Record<string, any>;
async function docs(db: Firestore, col: string, field: string, uid: string, limit = 1000): Promise<Row[]> {
  const snap = await db.collection(col).where(field, "==", uid).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...clean(d.data()) }));
}

// Everything we hold that is about this person, in one JSON-able object.
export async function collectExport(db: Firestore, uid: string, email: string) {
  const profile = (await db.doc(`users/${uid}`).get()).data();
  const username = profile?.username as string | undefined;
  const comments = await db.collectionGroup("comments").where("authorUid", "==", uid).limit(1000).get();
  const payout = (await db.doc(`payoutAccounts/${uid}`).get()).data();
  // Other people's personal details (a seller's customers) are left out of what a seller receives.
  const strip = <T extends Record<string, unknown>>(rows: T[], keys: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))));
  return {
    exportedAt: new Date().toISOString(),
    account: { uid, email, ...(profile ? clean(profile) : {}) },
    notes: await docs(db, "notes", "authorUid", uid),
    comments: comments.docs.map((d) => ({ id: d.id, ...clean(d.data()) })),
    following: await docs(db, "follows", "followerUid", uid),
    followers: username ? strip(await docs(db, "follows", "username", username), ["followerUid"]).length : 0,
    notifications: await docs(db, "notifications", "recipientUid", uid, 500),
    bookingsAsClient: await docs(db, "bookings", "clientUid", uid),
    bookingsAsPublisher: strip(await docs(db, "bookings", "publisherUid", uid), ["clientEmail", "clientUid"]),
    payments: strip(await docs(db, "payments", "uid", uid), ["email"]),
    earnings: await docs(db, "ledger", "publisherUid", uid),
    subscriptions: await docs(db, "subscriptions", "subscriberUid", uid),
    storeItems: await docs(db, "storeItems", "ownerUid", uid),
    storeOrdersAsBuyer: await docs(db, "storeOrders", "buyerUid", uid),
    storeOrdersAsSeller: strip(await docs(db, "storeOrders", "sellerUid", uid), ["address", "buyerEmail", "buyerUid"]),
    digitalPurchases: await docs(db, "digitalPurchases", "buyerUid", uid),
    digitalSales: strip(await docs(db, "digitalPurchases", "sellerUid", uid), ["buyerEmail", "buyerUid"]),
    merchOrders: await docs(db, "merchOrders", "uid", uid),
    adCampaigns: await docs(db, "adCampaigns", "uid", uid),
    boosts: await docs(db, "boosts", "publisherUid", uid),
    giftsSent: await docs(db, "gifts", "fromUid", uid),
    giftsReceived: await docs(db, "gifts", "toUid", uid),
    teamMemberships: await docs(db, "orgMembers", "memberUid", uid),
    badgeApplication: (await db.doc(`badgeRequests/${uid}`).get()).data() ?? null,
    publisherSettings: (await db.doc(`publisherSettings/${uid}`).get()).data() ?? null,
    videoUploads: await docs(db, "videoUploads", "uid", uid),
    moments: await docs(db, "moments", "ownerUid", uid), // only the ones still live; expired ones are already gone
    messagesSent: await sentMessages(db, uid),
    apiKeys: strip(await docs(db, "apiKeys", "uid", uid), ["hash"]),
    webhookEndpoints: strip(await docs(db, "webhookEndpoints", "uid", uid), ["secret"]),
    customDomains: await docs(db, "customDomains", "uid", uid),
    payoutAccount: payout ? { bankName: payout.bankName, accountName: payout.accountName, accountLast4: payout.accountLast4 } : null,
  };
}

// The messages this person wrote (not what others wrote to them).
async function sentMessages(db: Firestore, uid: string) {
  const convs = await db.collection("conversations").where("participants", "array-contains", uid).limit(200).get();
  const out: Row[] = [];
  for (const c of convs.docs) {
    const msgs = await c.ref.collection("messages").where("from", "==", uid).limit(1000).get();
    for (const m of msgs.docs) out.push({ id: m.id, conversationId: c.id, ...clean(m.data()) });
  }
  return out;
}

const OPEN_STORE = ["paid", "dispatched", "delivered", "disputed"];
const OPEN_MERCH = ["preordered", "printed", "shipped"];

// Reasons the account can't be deleted yet, in plain language. Empty = fine to delete.
export async function deletionBlockers(db: Firestore, uid: string, opts: { isAdmin?: boolean } = {}): Promise<string[]> {
  const out: string[] = [];
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (opts.isAdmin) out.push("This is an admin account — ask another admin to remove admin access first.");

  const unpaid = (await docs(db, "ledger", "publisherUid", uid)).filter((l) => ["held", "disputed", "transferring"].includes(String(l.status)));
  if (unpaid.length) out.push(`${unpaid.length} earning${unpaid.length === 1 ? "" : "s"} haven't been paid out yet. They are paid automatically after their hold; delete once they have.`);

  const openOrders = [...(await docs(db, "storeOrders", "sellerUid", uid)), ...(await docs(db, "storeOrders", "buyerUid", uid))].filter((o) => OPEN_STORE.includes(String(o.status)));
  if (openOrders.length) out.push(`${openOrders.length} store order${openOrders.length === 1 ? " is" : "s are"} still open (not yet confirmed or resolved).`);
  const openMerch = (await docs(db, "merchOrders", "uid", uid)).filter((o) => OPEN_MERCH.includes(String(o.status)));
  if (openMerch.length) out.push(`${openMerch.length} merch order${openMerch.length === 1 ? " hasn't" : "s haven't"} been delivered yet.`);

  const now = Date.now();
  const upcoming = [...(await docs(db, "bookings", "clientUid", uid)), ...(await docs(db, "bookings", "publisherUid", uid))].filter((b) => b.status === "confirmed" && new Date(String(b.startsAt)).getTime() > now);
  if (upcoming.length) out.push(`${upcoming.length} upcoming session${upcoming.length === 1 ? "" : "s"} — cancel them first (refunds follow the booking policy).`);

  const plans = await Promise.all(["tierSubscriptions", "badgeSubscriptions", "goldSubscriptions"].map((c) => db.doc(`${c}/${uid}`).get()));
  const activePlans = plans.filter((p) => p.exists && p.data()?.status === "active");
  const activeSubs = (await docs(db, "subscriptions", "subscriberUid", uid)).filter((s) => s.status === "active");
  if (activePlans.length || activeSubs.length) out.push("You have active paid plans or subscriptions — cancel them first so you're not billed again.");

  const ads = (await docs(db, "adCampaigns", "uid", uid)).filter((c) => ["in_review", "live"].includes(String(c.status)));
  if (ads.length) out.push("An ad campaign is still running or in review.");
  const boosts = (await docs(db, "boosts", "publisherUid", uid)).filter((b) => b.status === "active" && new Date(String(b.endsAt)).getTime() > now);
  if (boosts.length) out.push("A paid boost is still running.");

  const coWritten = (await docs(db, "notes", "authorUid", uid)).filter((n) => Array.isArray(n.coAuthorUids) && n.coAuthorUids.length > 0);
  if (coWritten.length) out.push(`${coWritten.length} post${coWritten.length === 1 ? " has" : "s have"} co-authors — remove the co-authors first (a post shared with other people can't be erased with you).`);

  if (u?.accountKind === "organisation") {
    const members = await db.collection("orgMembers").where("orgUid", "==", uid).limit(1).get();
    if (!members.empty) out.push("Your organisation still has team members — remove them first.");
  }
  return out;
}

async function deleteAll(db: Firestore, refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}
async function updateAll(db: Firestore, snaps: FirebaseFirestore.QueryDocumentSnapshot[], data: Record<string, unknown>) {
  for (let i = 0; i < snaps.length; i += 400) {
    const batch = db.batch();
    snaps.slice(i, i + 400).forEach((s) => batch.update(s.ref, data));
    await batch.commit();
  }
}

const GONE = "[deleted]";
const ANON_ADDRESS = (city: unknown, state: unknown) => ({ fullName: GONE, phone: "", street: "", city: city ?? "", state: state ?? "" });

// Erases the account's personal data. Run deletionBlockers() first. Returns counts for the log.
// The caller removes the Firebase Authentication user afterwards.
export async function eraseAccount(db: Firestore, uid: string, deleteFile: (key: string) => Promise<void> = async () => {}, deleteMedia: (key: string) => Promise<void> = async () => {}) {
  const counts: Record<string, number> = {};
  const u = (await db.doc(`users/${uid}`).get()).data();
  const username = u?.username as string | undefined;

  // --- content and relationships: deleted ---
  const notes = await db.collection("notes").where("authorUid", "==", uid).get();
  // Videos on their posts (and uploads never attached to a post) live in the media bucket: remove the files too.
  const uploads = await db.collection("videoUploads").where("uid", "==", uid).get();
  const videoKeys = new Set<string>([...notes.docs.map((n) => n.data().videoKey as string | undefined), ...uploads.docs.map((u) => u.data().key as string | undefined)].filter((k): k is string => !!k));
  for (const k of Array.from(videoKeys)) await deleteMedia(k).catch(() => {});
  await deleteAll(db, uploads.docs.map((d) => d.ref));
  counts.videos = videoKeys.size;
  for (const n of notes.docs) await db.recursiveDelete(n.ref); // includes the post's own comments and likes
  counts.notes = notes.size;
  const comments = await db.collectionGroup("comments").where("authorUid", "==", uid).get();
  await deleteAll(db, comments.docs.map((d) => d.ref));
  counts.comments = comments.size;

  // Moments (and anyone's reshares of them) go with their files. Messages: the ones this person wrote are deleted; a thread
  // nobody else wrote in goes entirely, and one the other member wrote in stays for them, without the deleted member's words.
  const moments = await db.collection("moments").where("ownerUid", "==", uid).get();
  let momentCount = 0;
  for (const m of moments.docs) {
    const d = m.data();
    const reshares = await db.collection("moments").where("resharedFrom.momentId", "==", m.id).get();
    for (const r of reshares.docs) await db.recursiveDelete(r.ref);
    if (d.ownsMedia) for (const k of [d.imageKey, d.videoKey, d.audioKey]) if (k) await deleteMedia(String(k)).catch(() => {});
    await db.recursiveDelete(m.ref);
    momentCount++;
  }
  counts.moments = momentCount;
  const convs = await db.collection("conversations").where("participants", "array-contains", uid).get();
  for (const c of convs.docs) {
    const mine = await c.ref.collection("messages").where("from", "==", uid).get();
    await deleteAll(db, mine.docs.map((d) => d.ref));
    const last = await c.ref.collection("messages").orderBy("createdAt", "desc").limit(1).get();
    if (last.empty) await db.recursiveDelete(c.ref);
    else { const l = last.docs[0].data(); await c.ref.update({ lastMessage: { from: l.from, text: String(l.text).slice(0, 120), at: l.createdAt }, lastMessageAt: l.createdAt }); }
  }
  counts.conversations = convs.size;
  const usage = await db.collection("momentUsage").where("uid", "==", uid).get();
  await deleteAll(db, usage.docs.map((d) => d.ref));

  const items = await db.collection("storeItems").where("ownerUid", "==", uid).get();
  for (const it of items.docs) {
    const f = (await db.doc(`storeFiles/${it.id}`).get()).data();
    if (f?.key) await deleteFile(String(f.key)).catch(() => {});
    await db.doc(`storeFiles/${it.id}`).delete();
  }
  await deleteAll(db, items.docs.map((d) => d.ref));
  counts.storeItems = items.size;

  const own = async (col: string, field: string, value: string) => (await db.collection(col).where(field, "==", value).get()).docs;
  for (const d of await own("customDomains", "uid", uid)) await removeDomain(d.id).catch(() => {});
  const toDelete = [
    ...(await own("follows", "followerUid", uid)),
    ...(username ? await own("follows", "username", username) : []),
    ...(await own("notifications", "recipientUid", uid)),
    ...(await own("stockWatches", "uid", uid)),
    ...(await own("orgMembers", "memberUid", uid)),
    ...(await own("orgInvites", "inviteeUid", uid)),
    ...(await own("apiKeys", "uid", uid)),
    ...(await own("webhookEndpoints", "uid", uid)),
    ...(await own("webhookDeliveries", "uid", uid)),
    ...(await own("customDomains", "uid", uid)),
  ];
  await deleteAll(db, toDelete.map((d) => d.ref));
  counts.relationships = toDelete.length;
  await deleteAll(db, ["badgeRequests", "suspensions", "tierSubscriptions", "badgeSubscriptions", "goldSubscriptions", "payoutAccounts", "publisherSettings"].map((c) => db.doc(`${c}/${uid}`)));

  // --- money and order records: kept for tax and disputes, with the personal details removed ---
  await updateAll(db, await own("payments", "uid", uid), { email: GONE });
  await updateAll(db, await own("bookings", "clientUid", uid), { clientEmail: GONE });
  for (const o of await own("storeOrders", "buyerUid", uid)) await o.ref.update({ buyerEmail: GONE, address: ANON_ADDRESS(o.data().address?.city, o.data().address?.state) });
  for (const o of await own("merchOrders", "uid", uid)) await o.ref.update({ email: GONE, address: ANON_ADDRESS(o.data().address?.city, o.data().address?.state) });
  await updateAll(db, await own("digitalPurchases", "buyerUid", uid), { buyerEmail: GONE });
  await updateAll(db, await own("adCampaigns", "uid", uid), { email: GONE });
  await updateAll(db, await own("parcels", "buyerUid", uid), { buyerPhoneLast4: "" });

  // --- identity: free the username, remove the profile ---
  if (username) await db.doc(`usernames/${username}`).delete();
  await db.doc(`users/${uid}`).delete();
  return counts;
}
