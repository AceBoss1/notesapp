import type { Firestore } from "firebase-admin/firestore";
import { cleanShareRef, certificateCard, courseCard, couponCard, journalCard, postCard, type ShareCard } from "./share-targets";
import { isDiscoverable, isPublicPost, type Community } from "./community";
import { couponCard as openCoupon } from "./discounts-server";

// Server side of "Share to Moments" / "Share to Journals": the card for an item, built from the item as it is now, or null when it is
// a draft, private, members-only, revoked, ended or gone (then nothing can be shared from it). Never trusts what the browser says
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
  }
}
