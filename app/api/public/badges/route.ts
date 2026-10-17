import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cacheGet, cacheSet } from "@/lib/shared-store";
import { badgesOf, officialBadges, NO_BADGES, type NameBadges } from "@/lib/name-badges";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

// GET /api/public/badges?u=ada,chef_adams (up to 50) → { badges: { ada: { level, goldKind?, team } } }. Public: badges are shown
// to everyone. Each answer is kept 5 minutes in the shared store, so a page full of names costs one read per person.
const NAME = /^[a-z0-9_-]{2,30}$/;
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "badges", clientIp(req), 120, 60);
  if (limited) return limited;
  const names = Array.from(new Set((req.nextUrl.searchParams.get("u") ?? "").toLowerCase().split(",").map((s) => s.trim()).filter((s) => NAME.test(s)))).slice(0, 50);
  const out: Record<string, NameBadges> = {};
  const missing: string[] = [];
  await Promise.all(names.map(async (n) => {
    const official = officialBadges(n);
    if (official) { out[n] = official; return; }
    const hit = await cacheGet<NameBadges>(`badges:${n}`);
    if (hit) out[n] = hit; else missing.push(n);
  }));
  if (missing.length) {
    const db = getAdminDb();
    const claims = await db.getAll(...missing.map((n) => db.doc(`usernames/${n}`)));
    const uids = claims.map((c) => (c.exists ? String(c.data()?.uid ?? "") : ""));
    const users = await Promise.all(uids.map((u) => (u ? db.doc(`users/${u}`).get() : Promise.resolve(null))));
    await Promise.all(missing.map(async (n, i) => {
      const b = users[i]?.exists ? badgesOf(users[i]!.data() as UserProfile) : NO_BADGES;
      out[n] = b;
      await cacheSet(`badges:${n}`, b, 300);
    }));
  }
  return NextResponse.json({ badges: out }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
