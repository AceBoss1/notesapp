import type { Firestore } from "firebase-admin/firestore";
import { cleanShareRef, certificateCard, courseCard, couponCard, eventCard, itemCard, journalCard, postCard, sessionCard, siteServiceCard, type ShareCard } from "./share-targets";
import { isDiscoverable, isPublicPost, type Community } from "./community";
import { couponCard as openCoupon } from "./discounts-server";

// Server side of "Share to Moments" / "Share to Journals": the card for an item, built from the item as it is now, or null when it is
// a draft, private, members-only, revoked, ended, switched off or gone (then nothing can be shared from it). Never trusts what the browser says
// about the item: only its kind and id.
export async function resolveShareCard(db: Firestore, refIn: unknown): Promise<ShareCard | null> {
  const ref = cleanShareRef(refIn);
  if (!ref) return null;
  switch (ref.kind) {
    case "journal":
      return journalCard(ref.id, (await db.doc(`notes/${ref.id}`).get()).data());
    case "course":
      return courseCard(ref.id, (await db.doc(`courses/${ref.id}`).get()).data());
    case "certificate": {
      const c = (await db.doc(`certificates/${ref.id}`).get()).data();
      if (!c) return null;
      const learner = c.uid ? (await db.doc(`users/${c.uid}`).get()).data() : undefined;
      return certificateCard(ref.id, c, learner?.username);
    }
    case "coupon": {
      const [seller, code] = ref.id.split("/");
      return couponCard(seller, code, await openCoupon(db, seller, code));
    }
    case "post": {
      const p = (await db.doc(`communityPosts/${ref.id}`).get()).data();
      if (!p?.cid) return null;
      const c = (await db.doc(`communities/${p.cid}`).get()).data() as Community | undefined;
      return postCard(ref.id, p, c, !!c && isDiscoverable(c) && isPublicPost(c, String(p.channel ?? "")));
    }
    case "item": {
      const i = (await db.doc(`storeItems/${ref.id}`).get()).data();
      if (!i?.ownerUid) return null;
      return itemCard(ref.id, i, (await db.doc(`users/${i.ownerUid}`).get()).data());
    }
    case "service": {
      const [username, n] = ref.id.split("~");
      const uid = (await db.doc(`usernames/${username}`).get()).data()?.uid as string | undefined;
      if (!uid) return null;
      const owner = (await db.doc(`users/${uid}`).get()).data();
      if (n === undefined) return sessionCard(username, owner, (await db.doc(`publisherSettings/${uid}`).get()).data()?.session);
      return siteServiceCard(username, Number(n), owner, (await db.doc(`sites/${uid}`).get()).data()?.blocks?.services);
    }
    case "event":
      return eventCard(ref.id, (await db.doc(`events/${ref.id}`).get()).data());
  }
}
