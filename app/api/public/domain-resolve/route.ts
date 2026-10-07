import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { DomainDoc, whiteLabelOwner } from "@/lib/domains";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeHost } from "@/lib/host";

export const dynamic = "force-dynamic";

// Used by middleware.ts to map a custom domain to its owner, and (with `check`) to confirm a journal slug or store
// item belongs to that owner before it's served on the domain. Active domains only. Nothing sensitive is returned.
//   /api/public/domain-resolve?host=notes.brand.com[&check=journal:<slug> | item:<id>]
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "domain-resolve", clientIp(req), 300, 60);
  if (limited) return limited;
  const host = normalizeHost(req.nextUrl.searchParams.get("host") || "");
  const headers = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" };
  // Misses are never cached: a domain that has just been activated must start working straight away.
  const miss = { "Cache-Control": "no-store" };
  if (!host) return NextResponse.json({ found: false }, { headers: miss });
  const db = getAdminDb();
  const d = (await db.doc(`customDomains/${host}`).get()).data() as DomainDoc | undefined;
  if (!d || d.status !== "active") return NextResponse.json({ found: false }, { headers: miss });
  // `full`: Enterprise full white label, so sign-in and sign-up happen on the domain itself (middleware.ts).
  const out: Record<string, unknown> = { found: true, host, uid: d.uid, username: d.username, home: d.home, full: !!(await whiteLabelOwner(host).catch(() => null)) };
  const check = req.nextUrl.searchParams.get("check");
  if (check) {
    const [kind, ref] = [check.split(":")[0], check.slice(check.indexOf(":") + 1)];
    if (kind === "journal") {
      const n = await db.collection("notes").where("slug", "==", ref).limit(1).get();
      out.owned = !n.empty && n.docs[0].data().authorUid === d.uid;
    } else if (kind === "item") {
      out.owned = (await db.doc(`storeItems/${ref}`).get()).data()?.ownerUid === d.uid;
    }
  }
  return NextResponse.json(out, { headers });
}
