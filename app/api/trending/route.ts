import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { NA_NOTESAPP_PROFILE } from "@/lib/journals-directory";
import { toMillis } from "@/lib/dates";

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

    const [viewSnap, noteSnap, userSnap] = await Promise.all([
      db.collection("pageViews").where("day", ">=", cutoff).get(),
      db.collection("notes").where("status", "==", "published").get(),
      db.collection("users").get(),
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
    userSnap.docs.forEach((d) => {
      const u = d.data();
      if (u.suspended !== true && u.username) byName.set(u.displayName, { username: u.username, displayName: u.displayName, avatar: u.avatar });
    });
    byName.set(NA_NOTESAPP_PROFILE.displayName, {
      username: NA_NOTESAPP_PROFILE.username,
      displayName: NA_NOTESAPP_PROFILE.displayName,
      avatar: NA_NOTESAPP_PROFILE.avatar,
    });

    const notes = noteSnap.docs.map((d) => {
      const n = d.data();
      const lifetime = Number(n.viewCount) || 0;
      return {
        id: d.id,
        slug: n.slug as string,
        title: n.title as string,
        author: n.author as string,
        authorUsername: byName.get(n.author)?.username,
        featured_image: (n.featured_image as string) || "",
        date: n.date as string,
        views: windowed ? noteViews.get(d.id) || 0 : lifetime,
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

    return NextResponse.json(
      { basis: windowed ? `last ${days} days` : "all time", posts, publishers },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("trending failed:", err);
    return NextResponse.json({ error: "Couldn't load trending" }, { status: 500 });
  }
}
