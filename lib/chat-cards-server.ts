import type { Firestore } from "firebase-admin/firestore";
import type { CardRef, ChatCard } from "./chat-cards";

// What a #NotesApp link's card shows, from our own data. Only things anyone can see: published journals (a members-only one says so but
// shows nothing of its body), items on sale, published courses and profiles that aren't suspended. Anything else gets no card.
export async function cardFor(db: Firestore, ref: CardRef): Promise<ChatCard | null> {
  if (ref.kind === "journal") {
    const snap = await db.collection("notes").where("slug", "==", ref.id).where("status", "==", "published").limit(1).get();
    const n = snap.docs[0]?.data();
    if (!n) return null;
    return { kind: "journal", href: `/journals/${ref.id}`, title: String(n.title ?? "Journal"), subtitle: `Journal by ${String(n.author ?? "a member")}`, image: String(n.featured_image ?? ""), cta: "Read", ...(n.premium ? { badge: "Members only" } : {}) };
  }
  if (ref.kind === "item") {
    const i = (await db.doc(`storeItems/${ref.id}`).get()).data();
    if (!i || i.sellable !== true) return null;
    return { kind: "item", href: `/shop/${ref.id}`, title: String(i.title ?? "Item"), subtitle: [String(i.price ?? ""), i.kind === "digital" ? "Download" : ""].filter(Boolean).join(" · "), image: String(i.image ?? ""), cta: "Buy" };
  }
  if (ref.kind === "course") {
    const id = (await db.doc(`courseSlugs/${ref.id}`).get()).data()?.courseId;
    const c = id ? (await db.doc(`courses/${id}`).get()).data() : undefined;
    if (!c || c.status !== "published") return null;
    return { kind: "course", href: `/academy/${ref.id}`, title: String(c.title ?? "Course"), subtitle: `Free course · ${Number(c.lessonCount) || 0} lessons · ${String(c.ownerName ?? "")}`, image: String(c.cover ?? ""), cta: "Enrol" };
  }
  const uid = (await db.doc(`usernames/${ref.id}`).get()).data()?.uid;
  const u = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  if (!u || u.suspended === true) return null;
  return { kind: "profile", href: `/u/${ref.id}`, title: String(u.displayName ?? ref.id), subtitle: `@${ref.id}${u.bio ? ` · ${String(u.bio).slice(0, 80)}` : ""}`, image: String(u.avatar ?? ""), cta: "View profile" };
}
