import type { Metadata } from "next";
import { getAdminDb } from "./firebase-admin";
import { getNoteBySlug } from "./firestore-notes";

// Share previews (Open Graph / Twitter cards). Each post and store item should preview with ITS OWN image; the
// site-wide default is only the last resort.
export const OG_DEFAULT = "/images/brand/og-default.jpg";

// First image in a post body — Markdown ![alt](url) or an HTML <img src="url"> from the rich-text editor.
export function firstImageIn(content: string | undefined): string {
  if (!content) return "";
  const md = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^)\s>]+)/.exec(content);
  if (md) return md[1];
  const html = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i.exec(content);
  return html ? html[1] : "";
}

// Best image for a post: featured image → video cover → first image in the body → default.
export function postOgImage(note: { featured_image?: string; videoPoster?: string; content?: string }): string {
  return note.featured_image || note.videoPoster || firstImageIn(note.content) || OG_DEFAULT;
}

const cardFor = (title: string, description: string, image: string, alt: string, extra: Record<string, unknown> = {}): Metadata => ({
  title,
  description,
  openGraph: { title, description, images: [{ url: image, alt }], ...extra },
  twitter: { card: "summary_large_image", title, description, images: [image] },
});

// Shared by /journals/<slug> and the legacy /notes/<slug> (which redirects — scrapers that don't follow the redirect
// would otherwise only ever see the site default).
export async function journalMetadata(slug: string): Promise<Metadata> {
  const note = await getNoteBySlug(slug);
  if (!note) return { title: "Journal Not Found" };
  // Premium entries still get a real card — the teaser/excerpt is public by design (PremiumGate only gates the body).
  const meta = cardFor(note.title, note.excerpt, postOgImage(note), note.title, {
    type: "article",
    publishedTime: note.date,
    authors: [note.author],
    url: `/journals/${note.slug}`,
  });
  return { ...meta, alternates: { canonical: `/journals/${note.slug}` } };
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

// Store item: its own photo, title and price. Never exposes anything about a download's private file.
export async function storeItemMetadata(itemId: string): Promise<Metadata> {
  try {
    const db = getAdminDb();
    const item = (await db.doc(`storeItems/${itemId}`).get()).data();
    if (!item) return { title: "Store item" };
    const owner = (await db.doc(`users/${item.ownerUid}`).get()).data();
    const price = typeof item.priceKobo === "number" ? ` · ${naira(item.priceKobo)}` : "";
    const description = `${item.subtitle ? `${item.subtitle} — ` : ""}${item.kind === "digital" ? "Digital download" : "Sold"} by ${owner?.displayName ?? "a #NotesApp seller"}${price}`.slice(0, 280);
    const meta = cardFor(String(item.title), description, item.image || owner?.avatar || OG_DEFAULT, String(item.title), { type: "website", url: `/shop/${itemId}` });
    return { ...meta, alternates: { canonical: `/shop/${itemId}` } };
  } catch (err) {
    console.error("[og] store item metadata failed", err);
    return { title: "Store item" };
  }
}

// A member's store page: item count and the first item that has a photo.
export async function storeMetadata(ownerUid: string, displayName: string, avatar?: string): Promise<Metadata> {
  let count = 0;
  let image = "";
  try {
    const snap = await getAdminDb().collection("storeItems").where("ownerUid", "==", ownerUid).limit(100).get();
    count = snap.size;
    image = snap.docs.map((d) => d.data().image as string | undefined).find((i) => !!i) ?? "";
  } catch (err) {
    console.error("[og] store metadata failed", err);
  }
  const title = `${displayName}'s Store`;
  const description = `${displayName}'s store on #NotesApp — ${count} item${count === 1 ? "" : "s"}.`;
  return cardFor(title, description, image || avatar || OG_DEFAULT, title);
}
