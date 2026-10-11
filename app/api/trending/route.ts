import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import { toMillis } from "@/lib/dates";
import { getAllNotes } from "@/lib/firestore-notes";
import { getAllUsers } from "@/lib/users";
import { ttlCache } from "@/lib/ttl-cache";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

type Bucket = { kind: "note" | "profile"; id: string; count: number };

// Trending posts + publishers. Score = visits in the last N days
// (pageViews buckets). Until any windowed data exists it falls back
// to lifetime view counts, and says so via `basis`.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "trending", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));
    const limit = 10;
    const db = getAdminDb();
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    // Notes and users come from the shared 5-minute caches; only the
    // pageViews buckets (bounded by days × pages) are read fresh.
    const [viewSnap, allNotes, allUsers] = await Promise.all([
      db.collection("pageViews").where("day", ">=", cutoff).get(),
      getAllNotes({ publishedOnly: true }),
      getAllUsers(),
    ]);

    const noteViews = new Map<string, number>();
    const profileViews = new Map<string, number>();
    viewSnap.docs.forEach((d) => {
      const b = d.data() as Bucket;
      const m = b.kind === "note" ? noteViews : profileViews;
      m.set(b.id, (m.get(b.id) || 0) + (b.count || 0));
    });
    const windowTotal = [...noteViews.values(), ...profileViews.values()].reduce((a, b) => a + b, 0);
    const windowed = windowTotal > 0;

    const byName = new Map<string, { username: string; displayName: string; avatar: string }>();
    allUsers.forEach((u) => {
      if (u.suspended !== true && u.username) byName.set(u.displayName, { username: u.username, displayName: u.displayName, avatar: u.avatar });
    });
    byName.set(NA_NOTESAPP_PROFILE.displayName, {
      username: NA_NOTESAPP_PROFILE.username,
      displayName: NA_NOTESAPP_PROFILE.displayName,
      avatar: NA_NOTESAPP_PROFILE.avatar,
    });

    const notes = allNotes.map((n) => {
      const lifetime = Number(n.viewCount) || 0;
      return {
        id: n.id,
        slug: n.slug as string,
        title: n.title as string,
        author: n.author as string,
        authorUsername: byName.get(n.author)?.username,
        featured_image: (n.featured_image as string) || "",
        date: n.date as string,
        views: windowed ? noteViews.get(n.id) || 0 : lifetime,
        lifetime,
        premium: !!n.premium,
      };
    });

    const posts = [...notes]
      .filter((n) => n.views > 0)
      .sort((a, b) => b.views - a.views || b.lifetime - a.lifetime || toMillis(b.date) - toMillis(a.date))
      .slice(0, limit);

    const pubs = new Map<string, { username: string; displayName: string; avatar: string; views: number; posts: number }>();
    const touch = (name: string) => {
      const u = byName.get(name);
      if (!u) return null;
      if (!pubs.has(u.username)) pubs.set(u.username, { ...u, views: 0, posts: 0 });
      return pubs.get(u.username)!;
    };
    notes.forEach((n) => {
      const p = touch(n.author);
      if (p) {
        p.views += n.views;
        p.posts += 1;
      }
    });
    if (windowed) {
      profileViews.forEach((count, username) => {
        const entry = [...byName.values()].find((u) => u.username === username);
        if (entry) {
          const p = touch(entry.displayName);
          if (p) p.views += count;
        }
      });
    }
    const publishers = [...pubs.values()]
      .filter((p) => p.views > 0)
      .sort((a, b) => b.views - a.views || b.posts - a.posts)
      .slice(0, limit);

    // Store items: what buyers look at and save most (all time; store views aren't kept per day). Score = views + 5 per save.
    const statSnap = await db.collection("storeStats").orderBy("views", "desc").limit(60).get();
    const ranked = statSnap.docs
      .map((d) => ({ id: d.id, views: Number(d.data().views) || 0, favs: Number(d.data().favs) || 0, ratingSum: Number(d.data().ratingSum) || 0, ratingCount: Number(d.data().ratingCount) || 0 }))
      .map((x) => ({ ...x, score: x.views + 5 * x.favs }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    const itemDocs = ranked.length ? await db.getAll(...ranked.map((x) => db.doc(`storeItems/${x.id}`))) : [];
    const byUid = new Map(allUsers.map((u) => [u.uid, u]));
    const items = ranked
      .map((x, i) => ({ x, d: itemDocs[i]?.data() }))
      .filter(({ d }) => !!d && d.sellable === true && byUid.get(String(d.ownerUid))?.suspended !== true)
      .slice(0, limit)
      .map(({ x, d }) => {
        const owner = byUid.get(String(d!.ownerUid));
        return {
          id: x.id, title: String(d!.title ?? ""), price: String(d!.price ?? ""), image: String(d!.image ?? ""), digital: d!.kind === "digital",
          seller: owner?.displayName ?? "", sellerUsername: owner?.username ?? "", sellerIsOrg: owner?.accountKind === "organisation",
          views: x.views, favs: x.favs, rating: x.ratingCount ? Math.round((x.ratingSum / x.ratingCount) * 10) / 10 : 0, reviews: x.ratingCount,
        };
      });

    // Fewer than ten have been looked at yet: fill the list with the newest items nobody has opened (shown after the ranked ones, marked as new).
    if (items.length < limit) {
      const have = new Set(items.map((i) => i.id));
      const fresh = await db.collection("storeItems").where("sellable", "==", true).limit(300).get();
      fresh.docs
        .filter((d) => !have.has(d.id) && byUid.get(String(d.data().ownerUid))?.suspended !== true)
        .sort((a, b) => String(b.data().createdAt ?? "").localeCompare(String(a.data().createdAt ?? "")))
        .slice(0, limit - items.length)
        .forEach((d) => {
          const x = d.data(), owner = byUid.get(String(x.ownerUid));
          items.push({ id: d.id, title: String(x.title ?? ""), price: String(x.price ?? ""), image: String(x.image ?? ""), digital: x.kind === "digital", seller: owner?.displayName ?? "", sellerUsername: owner?.username ?? "", sellerIsOrg: owner?.accountKind === "organisation", views: 0, favs: 0, rating: 0, reviews: 0 });
        });
    }

    return NextResponse.json(
      { basis: windowed ? `last ${days} days` : "all time", posts, publishers, items },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
    );
  } catch (err) {
    console.error("trending failed:", err);
    const { message, status } = friendlyMessage(err, "Couldn't load trending");
    return NextResponse.json({ error: message }, { status });
  }
}
